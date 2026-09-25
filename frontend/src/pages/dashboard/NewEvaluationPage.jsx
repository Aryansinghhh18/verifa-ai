import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import {
  PlayCircle,
  Bot,
  ShieldCheck,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Loader2,
  ArrowRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function NewEvaluationPage() {
  const [chatbots, setChatbots] = useState([]);
  const [loadingChatbots, setLoadingChatbots] = useState(true);

  // Form State
  const [selectedBotId, setSelectedBotId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [referenceEvidence, setReferenceEvidence] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState(['hallucination', 'latency']);

  // Execution State
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [evaluationResult, setEvaluationResult] = useState(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Derived validation states
  const isHhemActive = selectedMetrics.includes('hallucination');
  const isReferenceEmpty = !referenceEvidence || !referenceEvidence.trim();
  const isSubmitDisabled =
    running ||
    chatbots.length === 0 ||
    !prompt.trim() ||
    (isHhemActive && isReferenceEmpty);

  useEffect(() => {
    const fetchBots = async () => {
      try {
        setLoadingChatbots(true);
        const res = await api.get('/chatbots/');
        setChatbots(res.data);
        if (res.data.length > 0) {
          setSelectedBotId(res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching chatbots:', err);
      } finally {
        setLoadingChatbots(false);
      }
    };
    fetchBots();
  }, []);

  const toggleMetric = (metricKey) => {
    if (running) return;
    setSelectedMetrics((prev) => {
      if (prev.includes(metricKey)) {
        if (prev.length === 1) return prev; // Keep at least one metric selected
        return prev.filter((m) => m !== metricKey);
      } else {
        return [...prev, metricKey];
      }
    });
  };

  const handleRunEvaluation = async (e) => {
    e.preventDefault();

    if (isSubmitDisabled) {
      if (isHhemActive && isReferenceEmpty) {
        setError('Reference / evidence text is required to evaluate factual consistency with Vectara HHEM.');
      }
      return;
    }

    if (!selectedBotId) {
      setError('Please select a connected chatbot endpoint.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a test prompt.');
      return;
    }
    if (isHhemActive && isReferenceEmpty) {
      setError('Reference / evidence text is required to evaluate factual consistency with Vectara HHEM.');
      return;
    }

    setError('');
    setRunning(true);
    setEvaluationResult(null);

    try {
      const res = await api.post('/evaluations/run', {
        chatbot_id: selectedBotId,
        prompt: prompt.trim(),
        reference_evidence: isHhemActive ? referenceEvidence.trim() : (referenceEvidence.trim() || null),
        selected_metrics: selectedMetrics,
      });
      setEvaluationResult(res.data);
    } catch (err) {
      console.error('Evaluation error:', err);
      setEvaluationResult(null);
      setError(
        err.response?.data?.detail ||
        'Evaluation failed. Please verify that your chatbot endpoint is responsive and reachable.'
      );
    } finally {
      setRunning(false);
    }
  };

  const handleCopyResponse = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedBot = chatbots.find((b) => b.id === selectedBotId);

  // Extract metrics from result
  const hhemMetric = evaluationResult?.metrics?.find((m) => m.metric_type === 'hallucination');
  const latencyMetric = evaluationResult?.metrics?.find((m) => m.metric_type === 'latency');

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <PlayCircle className="w-6 h-6 text-brand-yellow" />
          <span>New Evaluation</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Send a prompt to your external chatbot and benchmark its factual consistency in real-time with Vectara HHEM.
        </p>
      </div>

      {/* No Chatbots Connected Warning */}
      {!loadingChatbots && chatbots.length === 0 && (
        <div className="p-6 rounded-2xl border border-brand-yellow/30 bg-brand-yellow/5 text-xs text-slate-300 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-brand-yellow shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-sm mb-1">No Chatbot Connected Yet</h3>
              <p className="text-slate-400 leading-relaxed">
                You must connect at least one external chatbot endpoint before running an evaluation.
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/chatbots"
            className="px-4 py-2 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl shadow-glow-yellow shrink-0"
          >
            Connect Chatbot
          </Link>
        </div>
      )}

      {/* Main Grid: Form on Left/Top, Results on Right/Bottom */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Form Container */}
        <div className="lg:col-span-7 bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleRunEvaluation} className="space-y-5">
            {/* Chatbot Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Select Target Chatbot *
              </label>
              {loadingChatbots ? (
                <div className="h-10 bg-surface-darkest rounded-xl animate-pulse border border-surface-border" />
              ) : (
                <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  disabled={chatbots.length === 0 || running}
                  className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-sans focus:outline-none focus:border-brand-yellow transition-colors"
                >
                  {chatbots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.http_method} • {b.api_endpoint})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Test Prompt */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Test Prompt *
              </label>
              <textarea
                rows={3}
                required
                disabled={running}
                placeholder="e.g. When and where was the Eiffel Tower built?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-surface-darkest border border-surface-border rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-sans"
              />
            </div>

            {/* Reference / Evidence Context */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Reference Evidence / Ground Truth {isHhemActive ? '*' : '(Optional)'}
                </label>
                {isHhemActive ? (
                  <span className="text-[10px] text-brand-yellow font-mono font-semibold">Required for HHEM</span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Optional for Latency only</span>
                )}
              </div>
              <textarea
                rows={4}
                required={isHhemActive}
                disabled={running}
                placeholder={
                  isHhemActive
                    ? "e.g. The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It was completed in 1889 for the Exposition Universelle."
                    : "Reference evidence is optional since HHEM hallucination metric is turned off."
                }
                value={referenceEvidence}
                onChange={(e) => setReferenceEvidence(e.target.value)}
                className={`w-full bg-surface-darkest border rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors font-sans ${
                  isHhemActive && isReferenceEmpty
                    ? 'border-brand-yellow/50 focus:border-brand-yellow'
                    : 'border-surface-border focus:border-brand-yellow'
                }`}
              />

              {/* Warning message stays visible while HHEM is active and Reference Evidence is empty */}
              {isHhemActive && isReferenceEmpty && (
                <div className="mt-2 p-2.5 rounded-lg border border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-brand-yellow" />
                  <span>Reference / evidence text is required to evaluate factual consistency with Vectara HHEM.</span>
                </div>
              )}

              <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                Vectara HHEM compares the chatbot hypothesis against this evidence premise to calculate factual consistency.
              </span>
            </div>

            {/* Metric Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Evaluation Metrics
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Click to toggle active metrics</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleMetric('hallucination')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    isHhemActive
                      ? 'border-brand-yellow/60 bg-brand-yellow/10'
                      : 'border-surface-border bg-surface-darkest/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${isHhemActive ? 'text-brand-yellow' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-white">Hallucination (HHEM)</span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      isHhemActive
                        ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isHhemActive ? 'ACTIVE' : 'OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleMetric('latency')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedMetrics.includes('latency')
                      ? 'border-brand-cyan/60 bg-brand-cyan/10'
                      : 'border-surface-border bg-surface-darkest/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${selectedMetrics.includes('latency') ? 'text-brand-cyan' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-white">Latency & Performance</span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      selectedMetrics.includes('latency')
                        ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {selectedMetrics.includes('latency') ? 'ACTIVE' : 'OFF'}
                  </span>
                </button>

                <div className="p-3 rounded-xl border border-surface-border bg-surface-darkest/60 flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs text-slate-400">Toxicity Detection</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    COMING SOON
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-surface-border bg-surface-darkest/60 flex items-center justify-between opacity-50 cursor-not-allowed">
                  <span className="text-xs text-slate-400">Jailbreak Resistance</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    COMING SOON
                  </span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              title={
                isHhemActive && isReferenceEmpty
                  ? "Reference evidence is required for HHEM evaluation"
                  : !prompt.trim()
                  ? "Prompt is required"
                  : ""
              }
              className={`w-full py-3 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
                isSubmitDisabled
                  ? 'bg-slate-800 text-slate-500 border border-surface-border cursor-not-allowed opacity-60 shadow-none'
                  : 'bg-brand-yellow hover:bg-brand-gold text-black shadow-glow-yellow cursor-pointer'
              }`}
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Calling Chatbot & Running Evaluators in RAM...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Live Evaluation</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-5 space-y-6">
          {evaluationResult ? (
            <div className="space-y-6">
              {/* Primary Score Card: HHEM Factual Consistency (if HHEM metric is evaluated) */}
              {hhemMetric && (
                <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-brand-yellow" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                        Factual Consistency Score
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase border ${
                        hhemMetric.risk_level === 'low'
                          ? 'border-brand-emerald/40 bg-brand-emerald/10 text-brand-emerald'
                          : hhemMetric.risk_level === 'medium'
                          ? 'border-brand-amber/40 bg-brand-amber/10 text-brand-amber'
                          : 'border-red-500/40 bg-red-500/10 text-red-400'
                      }`}
                    >
                      {hhemMetric.risk_level} Hallucination Risk
                    </span>
                  </div>

                  {/* Score Number Display */}
                  {hhemMetric.raw_score !== null ? (
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl font-black text-white font-mono tracking-tight">
                          {(hhemMetric.raw_score * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          (Raw: {hhemMetric.raw_score})
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-surface-darkest h-2.5 rounded-full overflow-hidden border border-surface-border">
                        <div
                          className={`h-full transition-all duration-700 ${
                            hhemMetric.risk_level === 'low'
                              ? 'bg-brand-emerald shadow-glow-yellow'
                              : hhemMetric.risk_level === 'medium'
                              ? 'bg-brand-amber'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.max(5, hhemMetric.raw_score * 100)}%` }}
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-surface-darkest border border-surface-border text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-white block mb-0.5">Model Interpretation:</span>
                        {hhemMetric.details?.interpretation || 'Factual consistency measured.'}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                        <span>Model: vectara/hallucination_evaluation_model</span>
                        <span>Device: {hhemMetric.details?.device || 'cpu'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-red-400">
                      {hhemMetric?.error_message || 'Evaluation could not be completed.'}
                    </div>
                  )}
                </div>
              )}

              {/* Chatbot Response Viewer */}
              <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-brand-cyan" />
                    <span>Chatbot Response</span>
                  </span>
                  <button
                    onClick={() => handleCopyResponse(evaluationResult.chatbot_response)}
                    className="text-xs text-slate-400 hover:text-white p-1 rounded transition-colors inline-flex items-center gap-1 font-mono"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-brand-emerald" />
                        <span className="text-[10px] text-brand-emerald">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-darkest border border-surface-border text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {evaluationResult.chatbot_response || '(Empty response returned)'}
                </div>
              </div>

              {/* Latency & Telemetry */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Round-Trip Latency
                  </span>
                  <div className="text-xl font-black text-brand-yellow font-mono flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{evaluationResult.response_latency_ms} ms</span>
                  </div>
                </div>

                <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    HTTP Status
                  </span>
                  <div className="text-xl font-black text-brand-emerald font-mono">
                    HTTP {evaluationResult.status_code}
                  </div>
                </div>
              </div>

              {/* Timestamp & Saved Notice */}
              <div className="p-3 rounded-xl bg-surface-elevated/40 border border-surface-border text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5 text-brand-emerald">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved to History
                </span>
                <span>{new Date(evaluationResult.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            /* Idle Placeholder */
            <div className="border border-dashed border-surface-border rounded-2xl p-10 text-center bg-surface-card/30">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto mb-4 text-slate-500">
                <PlayCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-300 mb-1">Awaiting Evaluation</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Fill out the test prompt and reference evidence on the left, then click "Run Live Evaluation".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
