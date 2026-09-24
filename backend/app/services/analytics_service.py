from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chatbot import Chatbot
from app.models.evaluation import Evaluation
from app.models.evaluation_metric import EvaluationMetric
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    ChatbotDistributionPoint,
    RiskBreakdown,
    TimeSeriesPoint,
)

logger = logging.getLogger("verifa.services.analytics")


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_overview(
        self,
        user_id: str,
        time_filter: str = "30d",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> AnalyticsOverviewResponse:
        """Computes comprehensive analytics across user's stored evaluations using real database records."""
        now = datetime.now(timezone.utc)
        filter_start = None

        if time_filter == "7d":
            filter_start = now - timedelta(days=7)
        elif time_filter == "30d":
            filter_start = now - timedelta(days=30)
        elif time_filter == "90d":
            filter_start = now - timedelta(days=90)
        elif time_filter == "custom" and start_date:
            filter_start = start_date

        stmt = (
            select(Evaluation)
            .options(
                selectinload(Evaluation.metrics),
                selectinload(Evaluation.chatbot),
            )
            .where(Evaluation.user_id == user_id)
        )

        if filter_start:
            stmt = stmt.where(Evaluation.created_at >= filter_start)
        if end_date:
            stmt = stmt.where(Evaluation.created_at <= end_date)

        stmt = stmt.order_by(Evaluation.created_at.asc())
        res = await self.db.execute(stmt)
        evaluations: List[Evaluation] = list(res.scalars().all())

        total_count = len(evaluations)
        if total_count == 0:
            return AnalyticsOverviewResponse(
                total_evaluations=0,
                average_hhem_score=None,
                average_latency_ms=None,
                failed_evaluations=0,
                evaluated_chatbots_count=0,
                risk_breakdown=RiskBreakdown(),
                time_filter=time_filter,
                evaluations_over_time=[],
                consistency_trend=[],
                latency_trend=[],
                chatbot_distribution=[],
            )

        failed_count = sum(1 for e in evaluations if e.status == "error")
        latencies = [e.response_latency_ms for e in evaluations if e.response_latency_ms is not None and e.response_latency_ms > 0]
        avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else None

        # Calculate HHEM scores & risk breakdown
        hhem_scores: List[float] = []
        low_count = 0
        med_count = 0
        high_count = 0
        evaluated_chatbot_ids = set()

        daily_data = defaultdict(lambda: {
            "count": 0,
            "hhem_scores": [],
            "latencies": [],
            "low": 0,
            "med": 0,
            "high": 0,
        })

        chatbot_data = defaultdict(lambda: {
            "name": "",
            "count": 0,
            "hhem_scores": [],
            "latencies": [],
        })

        for ev in evaluations:
            if ev.chatbot_id:
                evaluated_chatbot_ids.add(ev.chatbot_id)

            day_str = ev.created_at.strftime("%Y-%m-%d")
            daily_data[day_str]["count"] += 1
            if ev.response_latency_ms and ev.response_latency_ms > 0:
                daily_data[day_str]["latencies"].append(ev.response_latency_ms)

            # Determine bot name
            bot_name = ev.chatbot.name if ev.chatbot else ("Batch CSV Run" if ev.batch_job_id else "Direct Benchmark")
            bot_key = ev.chatbot_id or (f"batch_{ev.batch_job_id}" if ev.batch_job_id else "direct")
            chatbot_data[bot_key]["name"] = bot_name
            chatbot_data[bot_key]["count"] += 1
            if ev.response_latency_ms and ev.response_latency_ms > 0:
                chatbot_data[bot_key]["latencies"].append(ev.response_latency_ms)

            # Find HHEM metric
            h_metric = next((m for m in ev.metrics if m.metric_type == "hallucination"), None)
            if h_metric and h_metric.raw_score is not None:
                score = h_metric.raw_score
                hhem_scores.append(score)
                daily_data[day_str]["hhem_scores"].append(score)
                chatbot_data[bot_key]["hhem_scores"].append(score)

                if h_metric.risk_level == "low":
                    low_count += 1
                    daily_data[day_str]["low"] += 1
                elif h_metric.risk_level == "medium":
                    med_count += 1
                    daily_data[day_str]["med"] += 1
                elif h_metric.risk_level == "high":
                    high_count += 1
                    daily_data[day_str]["high"] += 1

        avg_hhem = round(sum(hhem_scores) / len(hhem_scores), 4) if hhem_scores else None

        # Build time-series points
        time_series: List[TimeSeriesPoint] = []
        for d in sorted(daily_data.keys()):
            entry = daily_data[d]
            day_avg_score = (
                round(sum(entry["hhem_scores"]) / len(entry["hhem_scores"]), 4)
                if entry["hhem_scores"]
                else None
            )
            day_avg_lat = (
                round(sum(entry["latencies"]) / len(entry["latencies"]), 1)
                if entry["latencies"]
                else None
            )
            time_series.append(
                TimeSeriesPoint(
                    date=d,
                    count=entry["count"],
                    avg_hhem_score=day_avg_score,
                    avg_latency_ms=day_avg_lat,
                    low_risk_count=entry["low"],
                    med_risk_count=entry["med"],
                    high_risk_count=entry["high"],
                )
            )

        # Build chatbot distribution points
        chatbot_dist: List[ChatbotDistributionPoint] = []
        for b_key, b_info in chatbot_data.items():
            b_avg_score = (
                round(sum(b_info["hhem_scores"]) / len(b_info["hhem_scores"]), 4)
                if b_info["hhem_scores"]
                else None
            )
            b_avg_lat = (
                round(sum(b_info["latencies"]) / len(b_info["latencies"]), 1)
                if b_info["latencies"]
                else None
            )
            chatbot_dist.append(
                ChatbotDistributionPoint(
                    chatbot_id=None if b_key.startswith("batch_") or b_key == "direct" else b_key,
                    name=b_info["name"],
                    count=b_info["count"],
                    avg_hhem_score=b_avg_score,
                    avg_latency_ms=b_avg_lat,
                )
            )

        # Sort distribution by count desc
        chatbot_dist.sort(key=lambda x: x.count, reverse=True)

        return AnalyticsOverviewResponse(
            total_evaluations=total_count,
            average_hhem_score=avg_hhem,
            average_latency_ms=avg_latency,
            failed_evaluations=failed_count,
            evaluated_chatbots_count=len(evaluated_chatbot_ids),
            risk_breakdown=RiskBreakdown(
                low=low_count,
                medium=med_count,
                high=high_count,
            ),
            time_filter=time_filter,
            evaluations_over_time=time_series,
            consistency_trend=time_series,
            latency_trend=time_series,
            chatbot_distribution=chatbot_dist,
        )
