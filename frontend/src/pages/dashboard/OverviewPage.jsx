import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import EvaluationDetailModal from '../../components/evaluations/EvaluationDetailModal';
import {
  Bot,
  ShieldCheck,
  Zap,
  ArrowRight,
  Plus,
  PlayCircle,
  FileSpreadsheet,
  Activity,
  Layers,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Loader2,
  TrendingUp,
  History
} from 'lucide-react';

export default function OverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total_evaluations: 0,
    connected_chatbots: 0,
    average_consistency: null,
    average_latency_ms: null,
  });
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Report Modal
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, botsRes, historyRes] = await Promise.all([
        api.get('/analytics/overview', { params: { time_filter: 'all' } }).catch(() => ({ data: {} })),
        api.get('/chatbots/').catch(() => ({ data: [] })),
        api.get('/evaluations/history', { params: { page: 1, page_size: 5 } }).catch(() => ({ data: { items: [] } })),
      ]);

      const aData = analyticsRes.data || {};
      const bData = botsRes.data || [];
      const hData = historyRes.data || { items: [] };

      setStats({
        total_evaluations: aData.total_evaluations || 0,
        connected_chatbots: bData.length || 0,
        average_consistency: aData.average_hhem_score,
        average_latency_ms: aData.average_latency_ms,
      });

      setRecentEvaluations(hData.items || []);
    } catch (err) {
      console.error('Error loading dashboard overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = async (evalId) => {
    try {
      const res = await api.get(`/evaluations/${evalId}`);
      setSelectedEvaluation(res.data);
    } catch (err) {
      console.error('Failed to load evaluation detail:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl border border-surface-border bg-gradient-to-r from-surface-card via-surface-card to-surface-elevated relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-yellow/5 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-surface-border bg-surface-darkest text-xs font-mono text-brand-yellow mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>VeriFA AI Evaluation Workspace</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome back, <span className="text-brand-yellow">{user?.full_name || 'Engineer'}</span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Benchmark external chatbots for hallucination risk, factual consistency, and latency telemetry using Vectara HHEM.
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/dashboard/new-eval"
              className="px-4 py-2.5 bg-brand-yellow hover:bg-yellow-400 text-black font-bold text-xs rounded-xl transition-all shadow-glow-yellow flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>+ New Evaluation</span>
            </Link>
            <Link
              to="/dashboard/chatbots"
              className="px-4 py-2.5 border border-surface-border bg-surface-dark hover:bg-surface-hover text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-2"
            >
              <Bot className="w-4 h-4 text-brand-yellow" />
              <span>+ Connect Chatbot</span>
            </Link>
            <Link
              to="/dashboard/batch"
              className="px-4 py-2.5 border border-surface-border bg-surface-dark hover:bg-surface-hover text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-brand-yellow" />
              <span>+ Batch Evaluation</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Real Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Evaluations */}
        <div className="p-6 rounded-2xl border border-surface-border bg-surface-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Total Evaluations
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow">
              <PlayCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white font-mono">
              {loading ? '-' : stats.total_evaluations}
            </div>
            <Link
              to="/dashboard/history"
              className="text-xs text-brand-yellow hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
            >
              <span>View History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Connected Chatbots */}
        <div className="p-6 rounded-2xl border border-surface-border bg-surface-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Connected Chatbots
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white font-mono">
              {loading ? '-' : stats.connected_chatbots}
            </div>
            <Link
              to="/dashboard/chatbots"
              className="text-xs text-purple-400 hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
            >
              <span>Manage Bots</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Average Consistency */}
        <div className="p-6 rounded-2xl border border-surface-border bg-surface-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Avg Consistency
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-brand-emerald font-mono">
              {loading
                ? '-'
                : stats.average_consistency !== null
                ? `${(stats.average_consistency * 100).toFixed(1)}%`
                : 'N/A'}
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block font-mono">
              Vectara HHEM Mean
            </span>
          </div>
        </div>

        {/* Average Latency */}
        <div className="p-6 rounded-2xl border border-surface-border bg-surface-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Avg Latency
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-brand-cyan font-mono">
              {loading
                ? '-'
                : stats.average_latency_ms !== null
                ? `${stats.average_latency_ms} ms`
                : 'N/A'}
            </div>
            <Link
              to="/dashboard/analytics"
              className="text-xs text-brand-cyan hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
            >
              <span>View Analytics</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Evaluations Table */}
      <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-yellow" />
            <h2 className="text-base font-bold text-white">Recent Evaluations</h2>
          </div>
          <Link
            to="/dashboard/history"
            className="text-xs text-brand-yellow hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-brand-yellow" />
            <span>Loading recent activity...</span>
          </div>
        ) : recentEvaluations.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-surface-border rounded-xl text-slate-500 text-xs">
            No evaluations recorded yet. Run a single evaluation or upload a batch CSV.
          </div>
        ) : (
          <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-darkest/70 border-b border-surface-border text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Chatbot</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Prompt</th>
                  <th className="py-3 px-4">Consistency Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {recentEvaluations.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => handleOpenReport(ev.id)}
                    className="hover:bg-surface-hover/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-semibold text-white truncate max-w-[140px]">
                      {ev.chatbot_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-400 border border-surface-border uppercase">
                        {ev.evaluation_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 truncate max-w-[200px]" title={ev.prompt}>
                      {ev.prompt}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {ev.hallucination_score !== null ? `${(ev.hallucination_score * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {ev.risk_level === 'low' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                          Low Risk
                        </span>
                      )}
                      {ev.risk_level === 'medium' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />
                          Med Risk
                        </span>
                      )}
                      {ev.risk_level === 'high' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          High Risk
                        </span>
                      )}
                      {ev.risk_level === 'unknown' && <span className="text-slate-500 font-mono text-[10px]">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(ev.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReport(ev.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white"
                        title="View Report"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {selectedEvaluation && (
        <EvaluationDetailModal
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}
    </div>
  );
}
