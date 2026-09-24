import React, { useState } from 'react';
import {
  X,
  Bot,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  Layers,
  FileText,
  Info
} from 'lucide-react';

export default function EvaluationDetailModal({ evaluation, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!evaluation) return null;

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(evaluation.chatbot_response || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Find hallucination metric
  const hMetric = (evaluation.metrics || []).find((m) => m.metric_type === 'hallucination');
  const hScore = hMetric ? hMetric.raw_score : evaluation.hallucination_score;
  const hRisk = hMetric ? hMetric.risk_level : (evaluation.risk_level || 'unknown');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface-dark border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-card/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Evaluation Report</h2>
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-surface-elevated text-slate-400 border border-surface-border">
                  {evaluation.evaluation_type || 'single'}
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                    evaluation.status === 'success'
                      ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {evaluation.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID: {evaluation.id} · {new Date(evaluation.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-300 transition-colors"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs print:p-0">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-surface-border bg-surface-card/40">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Chatbot Target</span>
              <span className="text-xs font-bold text-white mt-0.5 block truncate">
                {evaluation.chatbot_name || 'Direct Benchmark / CSV'}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-surface-border bg-surface-card/40">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Round-Trip Latency</span>
              <span className="text-xs font-bold text-brand-cyan font-mono mt-0.5 block">
                {evaluation.response_latency_ms ? `${evaluation.response_latency_ms} ms` : 'N/A'}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-surface-border bg-surface-card/40">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">HTTP Status</span>
              <span className="text-xs font-bold text-slate-200 font-mono mt-0.5 block">
                {evaluation.status_code || 200} OK
              </span>
            </div>
            <div className="p-3 rounded-xl border border-surface-border bg-surface-card/40">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Model Engine</span>
              <span className="text-xs font-bold text-brand-yellow mt-0.5 block truncate">
                Vectara HHEM v2
              </span>
            </div>
          </div>

          {/* Vectara HHEM Metric Card */}
          <div className="rounded-xl border border-surface-border bg-surface-card/60 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-yellow" />
                <h3 className="text-sm font-bold text-white">Vectara HHEM Factual Consistency</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20">
                  Cross-Encoder
                </span>
              </div>

              {/* Risk Badge */}
              {hRisk === 'low' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/30 flex items-center gap-1.5 w-max">
                  <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
                  Low Hallucination Risk
                </span>
              )}
              {hRisk === 'medium' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/30 flex items-center gap-1.5 w-max">
                  <span className="w-2 h-2 rounded-full bg-brand-yellow animate-pulse" />
                  Medium Hallucination Risk
                </span>
              )}
              {hRisk === 'high' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5 w-max">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  High Hallucination Risk
                </span>
              )}
            </div>

            {/* Score Differentiation Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-lg bg-surface-darkest border border-surface-border">
                <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-brand-yellow" />
                  <span>Raw Model Score (Probability)</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-white">
                    {hScore !== null && hScore !== undefined ? `${(hScore * 100).toFixed(2)}%` : 'N/A'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    ({hScore !== null && hScore !== undefined ? hScore.toFixed(4) : 'N/A'})
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Softmax probability P(consistent) output by <code>vectara/hallucination_evaluation_model</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-darkest border border-surface-border">
                <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-emerald" />
                  <span>VeriFA AI Platform Interpretation</span>
                </div>
                <div className="text-xs font-medium text-slate-200">
                  {hRisk === 'low' && 'The chatbot response exhibits strong factual alignment with the reference premise. Negligible hallucination risk detected.'}
                  {hRisk === 'medium' && 'Moderate ambiguity or partial consistency. The generated response contains unverified claims requiring human review.'}
                  {hRisk === 'high' && 'Factual contradiction or unsupported hallucination detected relative to the reference premise.'}
                  {hRisk === 'unknown' && 'No factual consistency score computed.'}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  * Note: In accordance with model documentation, this score measures factual consistency, not general accuracy.
                </p>
              </div>
            </div>
          </div>

          {/* Test Prompt */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase font-mono text-slate-400">
              Evaluated Test Prompt
            </label>
            <div className="p-3.5 rounded-xl bg-surface-darkest border border-surface-border text-slate-200 leading-relaxed font-mono text-xs">
              {evaluation.prompt}
            </div>
          </div>

          {/* Reference / Evidence */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase font-mono text-slate-400">
                Reference Evidence / Ground Truth Premise
              </label>
              {!evaluation.reference_evidence && (
                <span className="text-[10px] text-brand-yellow font-mono">
                  (Prompt used as premise fallback)
                </span>
              )}
            </div>
            <div className="p-3.5 rounded-xl bg-surface-darkest border border-surface-border text-slate-300 leading-relaxed italic text-xs">
              {evaluation.reference_evidence || evaluation.prompt}
            </div>
          </div>

          {/* Chatbot Extracted Response */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase font-mono text-slate-400">
                Chatbot Extracted Response (Hypothesis)
              </label>
              <button
                onClick={handleCopyResponse}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Response'}</span>
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-darkest border border-surface-border text-slate-100 leading-relaxed text-xs">
              {evaluation.chatbot_response || <span className="text-slate-500 italic">No response returned.</span>}
            </div>
          </div>

          {/* Error Message if any */}
          {evaluation.error_message && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <span className="font-semibold block mb-0.5">Execution Error:</span>
              {evaluation.error_message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-border bg-surface-card/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            VeriFA AI · Zero Key Logging Verified · In-Memory Cross-Encoder
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-surface-border text-xs font-semibold text-slate-200 transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
