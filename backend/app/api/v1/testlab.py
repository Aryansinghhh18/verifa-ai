import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.testlab_run import TestLabRun
from app.models.user import User
from app.schemas.testlab import (
    TestCase,
    TestSuiteInfo,
    TestRunConfigRequest,
    TestRunConfigValidationResponse,
    TestLabRunProgress,
    TestLabRunResponse,
    TestLabRunHistoryItem,
)
from app.services.testlab_dataset import testlab_service
from app.services.testlab_runner import TestLabRunner

logger = logging.getLogger("verifa.api.testlab")
router = APIRouter()


@router.get("/suites", response_model=List[TestSuiteInfo])
async def get_test_suites(
    current_user: User = Depends(get_current_user),
):
    """Returns available predefined benchmark test suites for TestLab."""
    suites = testlab_service.get_suites()
    return suites


@router.get("/dataset-preview", response_model=List[TestCase])
async def get_dataset_preview(
    current_user: User = Depends(get_current_user),
):
    """Returns sample test cases demonstrating the predefined dataset architecture."""
    sample_cases = testlab_service.get_sample_testcases(limit=10)
    return sample_cases


@router.post("/validate-config", response_model=TestRunConfigValidationResponse)
async def validate_test_run_config(
    config: TestRunConfigRequest,
    current_user: User = Depends(get_current_user),
):
    """Validates a proposed TestLab test run configuration without running tests.

    Applies SSRF prevention on endpoint URL, verifies suite parameters and test count boundaries.
    """
    res = testlab_service.validate_configuration(config)
    if not res.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.message
        )
    return res


@router.post("/start", response_model=TestLabRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_test_run(
    config: TestRunConfigRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new TestLab run and initiates background execution of the test suite."""
    val_res = testlab_service.validate_configuration(config)
    if not val_res.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=val_res.message
        )

    # Initialize TestLabRun record
    run = TestLabRun(
        user_id=current_user.id,
        chatbot_id=config.chatbot_id,
        chatbot_name=config.chatbot_name,
        api_endpoint=config.api_endpoint,
        test_suite=config.test_suite,
        total_tests=config.test_count,
        status="Pending",
        current_test_name="Initializing benchmark pool...",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Launch background test execution
    background_tasks.add_task(
        TestLabRunner.start_run_background,
        run_id=run.id,
        user_id=current_user.id,
        chatbot_id=config.chatbot_id,
        custom_endpoint=config.api_endpoint,
        custom_api_key=config.api_key,
        suite_id=config.test_suite,
        test_count=config.test_count,
    )

    return TestLabRunResponse(
        id=run.id,
        user_id=run.user_id,
        chatbot_id=run.chatbot_id,
        chatbot_name=run.chatbot_name,
        api_endpoint=run.api_endpoint,
        test_suite=run.test_suite,
        total_tests=run.total_tests,
        completed_tests=0,
        passed_tests=0,
        potential_issue_tests=0,
        failed_tests=0,
        status=run.status,
        current_test_index=0,
        current_test_name=run.current_test_name,
        start_time=run.start_time,
        end_time=run.end_time,
        duration_seconds=run.duration_seconds,
        summary_metrics={},
        results=[],
        created_at=run.created_at,
    )


@router.get("/runs", response_model=List[TestLabRunHistoryItem])
async def list_user_test_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the history of all TestLab runs for the current user."""
    stmt = (
        select(TestLabRun)
        .where(TestLabRun.user_id == current_user.id)
        .order_by(TestLabRun.created_at.desc())
    )
    result = await db.execute(stmt)
    runs = result.scalars().all()

    items = []
    for r in runs:
        metrics = {}
        if r.summary_metrics_json:
            try:
                metrics = json.loads(r.summary_metrics_json)
            except Exception:
                pass

        items.append(
            TestLabRunHistoryItem(
                id=r.id,
                chatbot_name=r.chatbot_name,
                test_suite=r.test_suite,
                status=r.status,
                total_tests=r.total_tests,
                completed_tests=r.completed_tests,
                passed_tests=r.passed_tests,
                potential_issue_tests=r.potential_issue_tests,
                failed_tests=r.failed_tests,
                duration_seconds=r.duration_seconds,
                potential_hallucination_rate=metrics.get("potential_hallucination_rate", 0.0),
                toxicity_rate=metrics.get("toxicity_rate", 0.0),
                created_at=r.created_at,
            )
        )
    return items


@router.get("/runs/{run_id}/progress", response_model=TestLabRunProgress)
async def get_test_run_progress(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns lightweight real-time progress for live polling in the UI."""
    stmt = select(TestLabRun).where(
        TestLabRun.id == run_id,
        TestLabRun.user_id == current_user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )

    return TestLabRunProgress(
        run_id=run.id,
        chatbot_name=run.chatbot_name,
        test_suite=run.test_suite,
        status=run.status,
        total_tests=run.total_tests,
        completed_tests=run.completed_tests,
        passed_tests=run.passed_tests,
        potential_issue_tests=run.potential_issue_tests,
        failed_tests=run.failed_tests,
        current_test_index=run.current_test_index,
        current_test_name=run.current_test_name,
        duration_seconds=run.duration_seconds,
    )


@router.get("/runs/{run_id}", response_model=TestLabRunResponse)
async def get_test_run_detail(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns full details, evaluation summary metrics, and test cases for a TestLab run."""
    stmt = select(TestLabRun).where(
        TestLabRun.id == run_id,
        TestLabRun.user_id == current_user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )

    summary_metrics = {}
    if run.summary_metrics_json:
        try:
            summary_metrics = json.loads(run.summary_metrics_json)
        except Exception:
            pass

    results_items = []
    if run.results_json:
        try:
            results_items = json.loads(run.results_json)
        except Exception:
            pass

    return TestLabRunResponse(
        id=run.id,
        user_id=run.user_id,
        chatbot_id=run.chatbot_id,
        chatbot_name=run.chatbot_name,
        api_endpoint=run.api_endpoint,
        test_suite=run.test_suite,
        total_tests=run.total_tests,
        completed_tests=run.completed_tests,
        passed_tests=run.passed_tests,
        potential_issue_tests=run.potential_issue_tests,
        failed_tests=run.failed_tests,
        status=run.status,
        current_test_index=run.current_test_index,
        current_test_name=run.current_test_name,
        start_time=run.start_time,
        end_time=run.end_time,
        duration_seconds=run.duration_seconds,
        summary_metrics=summary_metrics,
        results=results_items,
        created_at=run.created_at,
    )


@router.post("/runs/{run_id}/cancel")
async def cancel_test_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancels a currently executing TestLab test run."""
    stmt = select(TestLabRun).where(
        TestLabRun.id == run_id,
        TestLabRun.user_id == current_user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )

    if run.status in ("Completed", "Failed", "Cancelled"):
        return {"message": f"TestLab run is already in terminal state '{run.status}'."}

    run.status = "Cancelled"
    run.end_time = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "TestLab run cancellation requested successfully."}


def _build_run_dict(run: TestLabRun) -> Dict[str, Any]:
    summary_metrics = {}
    if run.summary_metrics_json:
        try:
            summary_metrics = json.loads(run.summary_metrics_json)
        except Exception:
            pass

    results_items = []
    if run.results_json:
        try:
            results_items = json.loads(run.results_json)
        except Exception:
            pass

    return {
        "id": run.id,
        "chatbot_name": run.chatbot_name,
        "api_endpoint": run.api_endpoint,
        "test_suite": run.test_suite,
        "status": run.status,
        "total_tests": run.total_tests,
        "completed_tests": run.completed_tests,
        "passed_tests": run.passed_tests,
        "potential_issue_tests": run.potential_issue_tests,
        "failed_tests": run.failed_tests,
        "duration_seconds": run.duration_seconds,
        "created_at": run.created_at.isoformat() if run.created_at else "",
        "start_time": run.start_time.isoformat() if run.start_time else "",
        "end_time": run.end_time.isoformat() if run.end_time else "",
        "summary_metrics": summary_metrics,
        "results": results_items,
    }


@router.get("/runs/{run_id}/report/pdf")
async def download_report_pdf(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generates and downloads a professional PDF evaluation report."""
    from fastapi.responses import Response
    from app.services.testlab_report import TestLabReportGenerator

    stmt = select(TestLabRun).where(
        TestLabRun.id == run_id,
        TestLabRun.user_id == current_user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )

    run_dict = _build_run_dict(run)
    pdf_bytes = TestLabReportGenerator.generate_pdf(run_dict)

    safe_name = "".join(c for c in run.chatbot_name if c.isalnum() or c in ("-", "_")).strip() or "Chatbot"
    filename = f"VeriFa_TestLab_Report_{safe_name}_{run.id[:8]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/runs/{run_id}/report/csv")
async def download_report_csv(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generates and downloads test results as a standardized CSV file."""
    from fastapi.responses import Response
    from app.services.testlab_report import TestLabReportGenerator

    stmt = select(TestLabRun).where(
        TestLabRun.id == run_id,
        TestLabRun.user_id == current_user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )

    run_dict = _build_run_dict(run)
    csv_str = TestLabReportGenerator.generate_csv(run_dict)

    safe_name = "".join(c for c in run.chatbot_name if c.isalnum() or c in ("-", "_")).strip() or "Chatbot"
    filename = f"VeriFa_TestLab_Results_{safe_name}_{run.id[:8]}.csv"

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/runs/{run_id}/report/json")
async def download_report_json(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generates and downloads full structured TestLab report as a JSON file."""
    from fastapi.responses import Response
    from app.services.testlab_report import TestLabReportGenerator

    stmt = select(TestLabRun).where(
        TestLabRun.id == run_id,
        TestLabRun.user_id == current_user.id
    )
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )

    run_dict = _build_run_dict(run)
    json_data = TestLabReportGenerator.generate_json(run_dict)
    json_str = json.dumps(json_data, indent=2)

    safe_name = "".join(c for c in run.chatbot_name if c.isalnum() or c in ("-", "_")).strip() or "Chatbot"
    filename = f"VeriFa_TestLab_Report_{safe_name}_{run.id[:8]}.json"

    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.delete("/runs/{run_id}", status_code=status.HTTP_200_OK)
async def delete_test_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently deletes a TestLab run record strictly owned by the authenticated user."""
    stmt = select(TestLabRun).where(TestLabRun.id == run_id)
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TestLab run '{run_id}' not found."
        )
    if run.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this TestLab run."
        )

    await db.delete(run)
    await db.commit()
    return {
        "success": True,
        "message": "TestLab run deleted successfully.",
        "run_id": run_id,
    }


@router.delete("/runs", status_code=status.HTTP_200_OK)
async def delete_all_test_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently deletes all TestLab runs for the authenticated user."""
    stmt = delete(TestLabRun).where(TestLabRun.user_id == current_user.id)
    result = await db.execute(stmt)
    await db.commit()
    return {
        "success": True,
        "message": "All TestLab runs deleted successfully.",
        "deleted_count": result.rowcount or 0,
    }

