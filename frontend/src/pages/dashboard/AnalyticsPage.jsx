import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Bot,
  Calendar,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  PlayCircle,
  FileSpreadsheet
} from 'lucide-react';

export default function AnalyticsPage() {
  const [timeFilter, setTimeFilter] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/overview', {
        params: { time_filter: timeFilter },
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await api.get('/evaluations/export', {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `verifa_analytics_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export analytics report:', err);
    } finally {
      setExporting(false);
    }
  };

  // Custom Dark Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-darkest border border-surface-border p-3 rounded-xl shadow-xl text-xs space-y-1">
          <div className="font-mono text-slate-400 font-semibold">{label}</div>
          {payload.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300">{entry.name}:</span>
              <span className="font-mono font-bold text-white">
                {typeof entry.value === 'number'
                  ? entry.name.toLowerCase().includes('score') || entry.name.toLowerCase().includes('consistency')
                    ? `${(entry.value * 100).toFixed(1)}%`
                    : entry.name.toLowerCase().includes('latency')
                    ? `${entry.value.toFixed(1)} ms`
                    : entry.value
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const hasData = data && data.total_evaluations > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Evaluation Analytics</h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20">
              Live Neural Metrics
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time factual consistency trends, latency telemetry, and model performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Filter Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-surface-card border border-surface-border text-xs">
            {['7d', '30d', '90d', 'all'].map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setTimeFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all uppercase text-[11px] ${
                  timeFilter === filterKey
                    ? 'bg-brand-yellow text-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filterKey === 'all' ? 'All Time' : filterKey}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-slate-300 transition-colors"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting || !hasData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-brand-yellow" />}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-yellow" />
          <span className="text-xs font-mono">Aggregating evaluation telemetry...</span>
        </div>
      ) : !hasData ? (
        /* Empty State */
        <div className="p-12 rounded-3xl border border-surface-border bg-surface-card/40 text-center flex flex-col items-center justify-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-400">
            <BarChart3 className="w-8 h-8 text-brand-yellow" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Evaluation Telemetry Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              There are no stored evaluations recorded in the selected time range. Run your first chatbot evaluation or upload a CSV benchmark to generate genuine telemetry.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Link
              to="/dashboard/new-eval"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-yellow text-black font-bold text-xs hover:bg-yellow-400 transition-all shadow-glow-yellow"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Run Single Evaluation</span>
            </Link>
            <Link
              to="/dashboard/batch"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-border bg-surface-dark hover:bg-surface-hover text-slate-200 font-semibold text-xs transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-brand-yellow" />
              <span>Batch CSV Evaluation</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl border border-surface-border bg-surface-card/50">
              <span className="text-xs text-slate-400 font-medium">Total Evaluations</span>
              <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                {data.total_evaluations}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">In selected timeframe</span>
            </div>

            <div className="p-5 rounded-2xl border border-surface-border bg-surface-card/50">
              <span className="text-xs text-slate-400 font-medium">Avg Factual Consistency</span>
              <div className="text-3xl font-extrabold text-brand-yellow mt-1 font-mono">
                {data.average_hhem_score !== null
                  ? `${(data.average_hhem_score * 100).toFixed(1)}%`
                  : 'N/A'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                HHEM Cross-Encoder Mean
              </span>
            </div>

            <div className="p-5 rounded-2xl border border-surface-border bg-surface-card/50">
              <span className="text-xs text-slate-400 font-medium">Avg Latency</span>
              <div className="text-3xl font-extrabold text-brand-cyan mt-1 font-mono">
                {data.average_latency_ms !== null ? `${data.average_latency_ms} ms` : 'N/A'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Round-trip execution</span>
            </div>

            <div className="p-5 rounded-2xl border border-surface-border bg-surface-card/50">
              <span className="text-xs text-slate-400 font-medium">Failed Evaluations</span>
              <div className="text-3xl font-extrabold text-red-400 mt-1 font-mono">
                {data.failed_evaluations}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">HTTP or timeout errors</span>
            </div>

            <div className="p-5 rounded-2xl border border-surface-border bg-surface-card/50">
              <span className="text-xs text-slate-400 font-medium">Evaluated Chatbots</span>
              <div className="text-3xl font-extrabold text-brand-emerald mt-1 font-mono">
                {data.evaluated_chatbots_count}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Unique connected bots</span>
            </div>
          </div>

          {/* Charts Row 1: Volume & Consistency Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Evaluation Volume */}
            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Evaluation Volume Over Time</h3>
                  <p className="text-xs text-slate-400">Total evaluations executed per day</p>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {data.evaluations_over_time.length} data points
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.evaluations_over_time}>
                    <defs>
                      <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FACC15" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#FACC15" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Evaluations"
                      stroke="#FACC15"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#volGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: HHEM Consistency Trend */}
            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Vectara HHEM Consistency Trend</h3>
                  <p className="text-xs text-slate-400">Average factual consistency score (0% - 100%)</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20">
                  Target: &ge; 85%
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.consistency_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      domain={[0, 1]}
                      tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="avg_hhem_score"
                      name="Avg Consistency Score"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ fill: '#10B981', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Latency Trend & Chatbot Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Latency Trend */}
            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Round-Trip Latency Telemetry</h3>
                  <p className="text-xs text-slate-400">Mean endpoint response time (ms)</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 flex items-center justify-center text-brand-cyan">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.latency_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} tickFormatter={(val) => `${val}ms`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="avg_latency_ms"
                      name="Avg Latency (ms)"
                      stroke="#06B6D4"
                      strokeWidth={2}
                      dot={{ fill: '#06B6D4', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Chatbot Distribution */}
            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Evaluation Distribution by Chatbot</h3>
                  <p className="text-xs text-slate-400">Volume breakdown across connected endpoints</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-brand-yellow/10 flex items-center justify-center text-brand-yellow">
                  <Bot className="w-4 h-4" />
                </div>
              </div>

              <div className="h-64 w-full">
                {data.chatbot_distribution.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No chatbot distribution available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chatbot_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                      <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Evaluations Count" fill="#FACC15" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
