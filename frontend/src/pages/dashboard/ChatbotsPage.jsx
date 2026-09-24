import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import {
  Bot,
  Plus,
  Zap,
  Trash2,
  Lock,
  Globe,
  Code2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  X
} from 'lucide-react';

export default function ChatbotsPage() {
  const [chatbots, setChatbots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    api_endpoint: '',
    api_key: '',
    http_method: 'POST',
    request_template: '{\n  "messages": [\n    {"role": "user", "content": "{{prompt}}"}\n  ]\n}',
    response_json_path: 'choices[0].message.content',
  });

  // Test Ping Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState(null);
  const [testPrompt, setTestPrompt] = useState("Hello, reply with 'Connection Verified' to test endpoint connection.");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Copied helper
  const [copiedId, setCopiedId] = useState(null);

  const fetchChatbots = async () => {
    try {
      setLoading(true);
      const res = await api.get('/chatbots/');
      setChatbots(res.data);
    } catch (err) {
      console.error('Error fetching chatbots:', err);
      setError('Failed to load registered chatbots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatbots();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setAddError('');
    setCreating(true);

    try {
      await api.post('/chatbots/', formData);
      setShowAddModal(false);
      setFormData({
        name: '',
        api_endpoint: '',
        api_key: '',
        http_method: 'POST',
        request_template: '{\n  "messages": [\n    {"role": "user", "content": "{{prompt}}"}\n  ]\n}',
        response_json_path: 'choices[0].message.content',
      });
      fetchChatbots();
    } catch (err) {
      console.error('Error creating chatbot:', err);
      setAddError(err.response?.data?.detail || 'Failed to add chatbot. Check endpoint URL and format.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/chatbots/${id}`);
      setChatbots((prev) => prev.filter((cb) => cb.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete chatbot connection.');
    }
  };

  const openTestModal = (bot) => {
    setSelectedBot(bot);
    setTestResult(null);
    setTestModalOpen(true);
  };

  const runTestPing = async () => {
    if (!selectedBot) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await api.post(`/chatbots/${selectedBot.id}/test`, {
        test_prompt: testPrompt,
      });
      setTestResult(res.data);
    } catch (err) {
      console.error('Test connection error:', err);
      setTestResult({
        success: false,
        status_code: err.response?.status || 0,
        latency_ms: 0,
        extracted_response: '',
        error_message: err.response?.data?.detail || 'Outbound connection failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyEndpoint = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-brand-yellow" />
            <span>Chatbot Connections</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Register external chatbot and LLM endpoints to benchmark factual consistency and latency.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-brand-yellow hover:bg-brand-gold text-black font-semibold text-xs rounded-xl transition-all shadow-glow-yellow flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Chatbot Connection</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-yellow" />
          <span className="text-xs font-mono tracking-wider uppercase">Loading connections...</span>
        </div>
      ) : chatbots.length === 0 ? (
        /* Empty State */
        <div className="border border-dashed border-surface-border rounded-2xl p-12 text-center bg-surface-card/40 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto mb-4 text-brand-yellow">
            <Bot className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">No Chatbot Endpoints Connected</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto mb-6">
            Connect your OpenAI-compatible API, custom self-hosted LLM, or backend agent to evaluate its responses.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl transition-all shadow-glow-yellow inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Chatbot Now</span>
          </button>
        </div>
      ) : (
        /* Grid of Chatbots */
        <div className="grid md:grid-cols-2 gap-6">
          {chatbots.map((bot) => (
            <div
              key={bot.id}
              className="bg-surface-card border border-surface-border hover:border-slate-600 rounded-2xl p-6 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-center text-brand-yellow font-bold text-base">
                      {bot.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{bot.name}</h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Added {new Date(bot.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-bold uppercase">
                    {bot.http_method}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-3 mb-6">
                  {/* Endpoint */}
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block mb-1">
                      Endpoint URL
                    </span>
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-darkest border border-surface-border/70 text-xs font-mono text-slate-300">
                      <span className="truncate">{bot.api_endpoint}</span>
                      <button
                        onClick={() => handleCopyEndpoint(bot.api_endpoint, bot.id)}
                        className="text-slate-400 hover:text-white p-1 transition-colors shrink-0"
                        title="Copy endpoint"
                      >
                        {copiedId === bot.id ? (
                          <Check className="w-3.5 h-3.5 text-brand-emerald" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block mb-1">
                        API Key (Masked)
                      </span>
                      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-darkest border border-surface-border/70 text-xs font-mono text-slate-300">
                        <Lock className="w-3 h-3 text-brand-emerald shrink-0" />
                        <span className="truncate">{bot.masked_api_key || 'No Auth'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block mb-1">
                        Response Extraction
                      </span>
                      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-darkest border border-surface-border/70 text-xs font-mono text-slate-300 truncate">
                        <Code2 className="w-3 h-3 text-brand-cyan shrink-0" />
                        <span className="truncate">{bot.response_json_path}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-surface-border flex items-center justify-between gap-3">
                <button
                  onClick={() => openTestModal(bot)}
                  className="flex-1 py-2 px-3 bg-surface-elevated hover:bg-surface-hover border border-surface-border hover:border-brand-yellow/40 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-brand-yellow" />
                  <span>Test Connection</span>
                </button>

                <button
                  onClick={() => handleDelete(bot.id, bot.name)}
                  title="Delete Chatbot"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Chatbot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-brand-yellow" />
                <span>Add Chatbot Endpoint</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Chatbot Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production GPT-4 Agent"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  API Endpoint URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.openai.com/v1/chat/completions"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Must be accessible via http/https. Loopback addresses are blocked for security.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  API Key (Encrypted at Rest)
                </label>
                <input
                  type="password"
                  placeholder="sk-proj-••••••••••••••••"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                />
                <span className="text-[10px] text-brand-emerald mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Key is encrypted with AES-256 Fernet and never logged or exposed.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase tracking-wider">
                    HTTP Method
                  </label>
                  <select
                    value={formData.http_method}
                    onChange={(e) => setFormData({ ...formData, http_method: e.target.value })}
                    className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase tracking-wider">
                    Response JSON Path
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.response_json_path}
                    onChange={(e) => setFormData({ ...formData, response_json_path: e.target.value })}
                    placeholder="choices[0].message.content"
                    className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase tracking-wider">
                  Request Template JSON (use {'{{prompt}}'} placeholder)
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.request_template}
                  onChange={(e) => setFormData({ ...formData, request_template: e.target.value })}
                  className="w-full bg-surface-darkest border border-surface-border rounded-xl p-3 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-surface-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-surface-border rounded-xl hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-brand-yellow hover:bg-brand-gold disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-glow-yellow flex items-center gap-2 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Connection</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Connection Modal */}
      {testModalOpen && selectedBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Test Connection</h2>
                  <span className="text-xs text-slate-400">{selectedBot.name}</span>
                </div>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono uppercase tracking-wider">
                  Test Prompt
                </label>
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={runTestPing}
                  disabled={testing}
                  className="px-5 py-2.5 bg-brand-yellow hover:bg-brand-gold disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-glow-yellow flex items-center gap-2 cursor-pointer"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test Ping...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Execute Test Ping</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Results Display */}
              {testResult && (
                <div className={`mt-4 p-4 rounded-xl border ${
                  testResult.success 
                    ? 'border-brand-emerald/40 bg-brand-emerald/10' 
                    : 'border-red-500/40 bg-red-500/10'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-brand-emerald" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className={`text-xs font-bold ${
                        testResult.success ? 'text-brand-emerald' : 'text-red-400'
                      }`}>
                        {testResult.success ? 'Connection Verified' : 'Connection Failed'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      {testResult.status_code > 0 && (
                        <span className="text-slate-300">
                          HTTP {testResult.status_code}
                        </span>
                      )}
                      {testResult.latency_ms > 0 && (
                        <span className="text-brand-yellow flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {testResult.latency_ms} ms
                        </span>
                      )}
                    </div>
                  </div>

                  {testResult.success ? (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold block mb-1">
                        Extracted Response:
                      </span>
                      <div className="p-3 rounded-lg bg-surface-darkest border border-surface-border text-xs text-slate-200 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {testResult.extracted_response || '(Empty response returned)'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-red-300 font-semibold block mb-1">
                        Error Message:
                      </span>
                      <div className="p-2.5 rounded-lg bg-surface-darkest border border-red-500/30 text-xs text-red-300 font-mono">
                        {testResult.error_message}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
