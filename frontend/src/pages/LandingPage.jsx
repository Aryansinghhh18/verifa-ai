import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Cpu, 
  AlertTriangle, 
  FileCheck, 
  Zap, 
  Terminal, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Layers, 
  BarChart3,
  Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const metrics = [
    {
      title: "Hallucination / Factual Consistency",
      status: "Active (Vectara HHEM)",
      active: true,
      desc: "Evaluates responses against ground-truth evidence using Vectara's neural Cross-Encoder model. Computes real factual consistency probabilities without mocking.",
      icon: ShieldCheck,
      color: "text-brand-yellow"
    },
    {
      title: "Latency & Performance",
      status: "Active",
      active: true,
      desc: "Real-time measurements of round-trip API latency, response speed profiling, and HTTP connection status.",
      icon: Zap,
      color: "text-brand-cyan"
    },
    {
      title: "Batch Evaluation",
      status: "Active",
      active: true,
      desc: "Upload benchmark datasets via CSV to evaluate multi-case datasets with asynchronous background processing and progress telemetry.",
      icon: Layers,
      color: "text-brand-yellow"
    },
    {
      title: "Evaluation Analytics",
      status: "Active",
      active: true,
      desc: "Aggregated consistency trends over time, latency distribution percentiles, and chatbot comparative performance analytics.",
      icon: BarChart3,
      color: "text-brand-cyan"
    },
    {
      title: "Toxicity",
      status: "Coming Soon",
      active: false,
      desc: "Detects abusive, profane, biased, or toxic generated content across multiple risk dimensions. (Roadmap Phase)",
      icon: AlertTriangle,
      color: "text-slate-400"
    },
    {
      title: "Safety",
      status: "Coming Soon",
      active: false,
      desc: "Audits outputs against safety guidelines, content moderation standards, and harmful instruction guardrails. (Roadmap Phase)",
      icon: Lock,
      color: "text-slate-400"
    },
    {
      title: "Jailbreak Testing",
      status: "Coming Soon",
      active: false,
      desc: "Tests chatbot defenses against adversarial persona adoption, hypothetical overrides, and jailbreak attacks. (Roadmap Phase)",
      icon: Terminal,
      color: "text-slate-400"
    },
    {
      title: "Prompt Injection Testing",
      status: "Coming Soon",
      active: false,
      desc: "Simulates direct and indirect prompt injection attempts to test system prompt leakage and control hijacking. (Roadmap Phase)",
      icon: Cpu,
      color: "text-slate-400"
    }
  ];

  return (
    <div className="min-h-screen bg-surface-darkest text-slate-100 flex flex-col selection:bg-brand-yellow selection:text-black">
      {/* Top Navigation */}
      <nav className="border-b border-surface-border bg-surface-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-yellow flex items-center justify-center font-black text-black text-lg tracking-wider shadow-glow-yellow">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-white text-lg">VeriFA <span className="text-brand-yellow">AI</span></span>
              <span className="text-[10px] text-slate-400 -mt-1 tracking-widest font-mono">EVALUATION PLATFORM</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-brand-yellow transition-colors">How It Works</a>
            <a href="#metrics" className="hover:text-brand-yellow transition-colors">Evaluation Metrics</a>
            <a href="#security" className="hover:text-brand-yellow transition-colors">Security</a>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="/login" 
              className="px-4 py-2 text-sm font-semibold text-slate-200 hover:text-white border border-surface-border rounded-lg bg-surface-card hover:bg-surface-hover transition-colors"
            >
              Sign In
            </a>
            <a 
              href="/register" 
              className="px-4 py-2 text-sm font-semibold text-black bg-brand-yellow hover:bg-brand-gold rounded-lg transition-all shadow-glow-yellow flex items-center gap-1.5"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        {/* Subtle grid background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-brand-yellow/10 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[300px] bg-brand-cyan/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-surface-border bg-surface-card text-xs font-mono text-slate-300 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse"></span>
            <span>Hugging Face Vectara HHEM Engine Integrated</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
            Evaluate, Benchmark & Guard Your <span className="text-brand-yellow">Chatbots & LLMs</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 font-normal leading-relaxed max-w-2xl mx-auto mb-10">
            VeriFA AI is an LLM and chatbot evaluation platform. Connect your chatbot’s API endpoint to detect hallucinations, verify factual consistency, benchmark latency, and monitor performance with genuine ML scores.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-base rounded-xl transition-all shadow-glow-yellow flex items-center justify-center gap-2"
            >
              Start Evaluating <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-surface-card hover:bg-surface-elevated text-slate-200 border border-surface-border font-semibold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Sign In to Dashboard
            </a>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-surface-border bg-surface-card/60 backdrop-blur-sm text-center">
              <div className="text-2xl font-black text-brand-yellow font-mono">100%</div>
              <div className="text-xs text-slate-400 mt-1">Real ML Scoring</div>
            </div>
            <div className="p-4 rounded-xl border border-surface-border bg-surface-card/60 backdrop-blur-sm text-center">
              <div className="text-2xl font-black text-brand-cyan font-mono">&lt; 50ms</div>
              <div className="text-xs text-slate-400 mt-1">Harness Latency</div>
            </div>
            <div className="p-4 rounded-xl border border-surface-border bg-surface-card/60 backdrop-blur-sm text-center">
              <div className="text-2xl font-black text-white font-mono">AES-256</div>
              <div className="text-xs text-slate-400 mt-1">Key Encryption</div>
            </div>
            <div className="p-4 rounded-xl border border-surface-border bg-surface-card/60 backdrop-blur-sm text-center">
              <div className="text-2xl font-black text-brand-emerald font-mono">HHEM v2</div>
              <div className="text-xs text-slate-400 mt-1">Pretrained Weights</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-6 border-t border-surface-border bg-surface-dark/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
              Automated Evaluation Workflow
            </h2>
            <p className="text-slate-400 text-base">
              VeriFA AI isolates your external API endpoints, fires test cases, runs neural evaluation models, and renders clear risk breakdowns.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card relative flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow font-mono font-bold flex items-center justify-center mb-5">
                01
              </div>
              <h3 className="text-base font-bold text-white mb-2">Connect Chatbot API</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add your endpoint URL and API key. Keys are encrypted with AES-256 and never logged or exposed.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card relative flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-mono font-bold flex items-center justify-center mb-5">
                02
              </div>
              <h3 className="text-base font-bold text-white mb-2">Enter Test & Context</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Provide test prompts plus ground-truth reference evidence for factual consistency evaluation.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card relative flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono font-bold flex items-center justify-center mb-5">
                03
              </div>
              <h3 className="text-base font-bold text-white mb-2">HHEM Neural Inference</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pretrained Vectara HHEM cross-encoder analyzes hypothesis claims against evidence pairs in RAM.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-surface-border bg-surface-card relative flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 text-brand-emerald font-mono font-bold flex items-center justify-center mb-5">
                04
              </div>
              <h3 className="text-base font-bold text-white mb-2">Inspect Risk Score</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                View raw consistency confidence, latency timings, risk classification, and save to evaluation history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section id="metrics" className="py-20 px-6 border-t border-surface-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-surface-border bg-surface-card text-xs font-mono text-brand-yellow mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Modular Evaluation Suite</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
              Comprehensive LLM Risk Metrics
            </h2>
            <p className="text-slate-400 text-base">
              Only authentic ML model scores are returned. Unreleased models are clearly marked as Coming Soon—no fake AI metrics.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div 
                  key={idx} 
                  className={`p-6 rounded-2xl border ${m.active ? 'border-surface-border bg-surface-card hover:border-slate-600' : 'border-surface-border/50 bg-surface-card/40'} transition-all flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.active ? 'bg-surface-elevated' : 'bg-surface-darkest'}`}>
                        <Icon className={`w-5 h-5 ${m.color}`} />
                      </div>
                      <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full font-semibold border ${
                        m.active 
                          ? 'border-brand-emerald/40 bg-brand-emerald/10 text-brand-emerald' 
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{m.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 px-6 border-t border-surface-border bg-surface-dark/40">
        <div className="max-w-5xl mx-auto rounded-3xl border border-surface-border bg-surface-card p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
              Enterprise-Grade Security by Design
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              We understand you are testing proprietary chatbots and sensitive LLM endpoints. VeriFA AI implements strict zero-leakage security boundaries:
            </p>
            <ul className="space-y-3.5">
              <li className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-brand-emerald shrink-0" />
                <span><strong>API Keys Encrypted at Rest:</strong> Encrypted with AES-256 Fernet; decrypted only in RAM during outbound execution.</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-brand-emerald shrink-0" />
                <span><strong>No Key Exposure:</strong> Keys are never echoed in API payloads or backend console logs (masked as <code>sk-...1a2b</code>).</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-brand-emerald shrink-0" />
                <span><strong>SSRF Protection:</strong> Internal IP ranges and metadata servers are blocked to prevent network traversal.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-surface-border py-8 px-6 bg-surface-darkest text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-brand-yellow text-black font-black flex items-center justify-center text-xs">V</div>
            <span className="text-slate-300 font-bold">VeriFA AI</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div>
            Built with FastAPI, PyTorch & Vectara HHEM
          </div>
        </div>
      </footer>
    </div>
  );
}
