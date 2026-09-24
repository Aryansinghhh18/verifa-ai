import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import EvaluationDetailModal from '../../components/evaluations/EvaluationDetailModal';
import {
  History,
  Search,
  Filter,
  Download,
  Bot,
  PlayCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';

export default function EvaluationHistoryPage() {
  const [historyData, setHistoryData] = useState({
    total_count: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters & State
  const [search, setSearch] = useState('');
  const [selectedChatbotId, setSelectedChatbotId] = useState('');
  const [evaluationType, setEvaluationType] = useState('all'); // all, single, batch
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Chatbot list for dropdown filter
  const [chatbots, setChatbots] = useState([]);

  // Active Report Modal
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchChatbots();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [search, selectedChatbotId, evaluationType, sortBy, page, pageSize]);

  const fetchChatbots = async () => {
    try {
      const res = await api.get('/chatbots/');
      setChatbots(res.data);
    } catch (err) {
      console.error('Failed to load chatbots:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedChatbotId) params.chatbot_id = selectedChatbotId;
      if (evaluationType !== 'all') params.evaluation_type = evaluationType;

      const res = await api.get('/evaluations/history', { params });
      setHistoryData(res.data);
    } catch (err) {
      console.error('Failed to fetch evaluation history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = async (evalId) => {
    try {
      setLoadingDetail(true);
      const res = await api.get(`/evaluations/${evalId}`);
      setSelectedEvaluation(res.data);
    } catch (err) {
      console.error('Failed to load evaluation detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = {};
      if (selectedChatbotId) params.chatbot_id = selectedChatbotId;
      if (evaluationType !== 'all') params.evaluation_type = evaluationType;

      const res = await api.get('/evaluations/export', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `verifa_evaluation_history_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export evaluations:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Evaluation History</h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-slate-400 border border-surface-border">
              {historyData.total_count} Total Evaluations
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Search, filter, and inspect previous evaluations with real Vectara HHEM factual consistency metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting || historyData.total_count === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-brand-yellow" />}
            <span>Export CSV</span>
          </button>
          <Link
            to="/dashboard/new-eval"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold transition-all shadow-glow-yellow"
          >
            <PlayCircle className="w-4 h-4" />
            <span>New Evaluation</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search prompt or response..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-darkest border border-surface-border rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow"
            />
          </div>

          {/* Filter by Chatbot */}
          <div>
            <select
              value={selectedChatbotId}
              onChange={(e) => {
                setSelectedChatbotId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow"
            >
              <option value="">All Chatbots</option>
              {chatbots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Evaluation Type */}
          <div>
            <select
              value={evaluationType}
              onChange={(e) => {
                setEvaluationType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow"
            >
              <option value="all">All Types (Single & Batch)</option>
              <option value="single">Single Evaluation Only</option>
              <option value="batch">Batch CSV Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="score_desc">Highest Consistency Score</option>
              <option value="score_asc">Lowest Consistency Score</option>
              <option value="latency_desc">Highest Latency</option>
              <option value="latency_asc">Lowest Latency</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-surface-border bg-surface-card/40 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-yellow" />
            <span className="text-xs">Loading evaluation records...</span>
          </div>
        ) : historyData.items.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-500 mb-3">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">No Evaluations Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              {search || selectedChatbotId || evaluationType !== 'all'
                ? 'No evaluations match your active search and filter criteria.'
                : 'You have not run any evaluations yet. Start by testing a single prompt or uploading a batch CSV dataset.'}
            </p>
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/new-eval"
                className="px-4 py-2 rounded-xl bg-brand-yellow text-black font-semibold text-xs hover:bg-yellow-400 transition-colors"
              >
                Run Single Evaluation
              </Link>
              <Link
                to="/dashboard/batch"
                className="px-4 py-2 rounded-xl border border-surface-border bg-surface-dark hover:bg-surface-hover text-slate-300 font-semibold text-xs transition-colors"
              >
                Batch Evaluation (CSV)
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-darkest/70 border-b border-surface-border text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4 min-w-[130px]">Chatbot / Source</th>
                  <th className="py-3 px-4 w-20">Type</th>
                  <th className="py-3 px-4 min-w-[220px]">Prompt Preview</th>
                  <th className="py-3 px-4 w-32">Consistency Score</th>
                  <th className="py-3 px-4 w-28">Risk Level</th>
                  <th className="py-3 px-4 w-20">Latency</th>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {historyData.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenReport(item.id)}
                    className="hover:bg-surface-hover/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-semibold text-white truncate max-w-[140px]" title={item.chatbot_name}>
                      {item.chatbot_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-slate-400 border border-surface-border uppercase">
                        {item.evaluation_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium truncate max-w-[220px]" title={item.prompt}>
                      {item.prompt}
                    </td>
                    <td className="py-3 px-4">
                      {item.hallucination_score !== null ? (
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-white">
                            {(item.hallucination_score * 100).toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.hallucination_score.toFixed(4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.risk_level === 'low' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                          Low Risk
                        </span>
                      )}
                      {item.risk_level === 'medium' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />
                          Med Risk
                        </span>
                      )}
                      {item.risk_level === 'high' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          High Risk
                        </span>
                      )}
                      {item.risk_level === 'unknown' && (
                        <span className="text-slate-500 text-[10px] font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                      {item.response_latency_ms ? `${Math.round(item.response_latency_ms)}ms` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenReport(item.id);
                        }}
                        className="p-1.5 rounded-lg border border-surface-border bg-surface-dark hover:bg-surface-elevated text-slate-300 hover:text-white transition-colors"
                        title="View Full Report"
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

        {/* Pagination Footer */}
        {historyData.total_count > 0 && (
          <div className="px-6 py-4 border-t border-surface-border bg-surface-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-slate-400">
              Showing <span className="text-white font-mono">{((page - 1) * pageSize) + 1}</span> to{' '}
              <span className="text-white font-mono">
                {Math.min(page * pageSize, historyData.total_count)}
              </span>{' '}
              of <span className="text-white font-mono">{historyData.total_count}</span> evaluations
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-surface-darkest border border-surface-border rounded-lg px-2 py-1 text-xs text-slate-200"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-surface-border bg-surface-dark hover:bg-surface-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-mono text-slate-300">
                  {page} / {historyData.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(historyData.total_pages, p + 1))}
                  disabled={page >= historyData.total_pages}
                  className="p-1.5 rounded-lg border border-surface-border bg-surface-dark hover:bg-surface-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Evaluation Report Modal */}
      {selectedEvaluation && (
        <EvaluationDetailModal
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}
    </div>
  );
}
