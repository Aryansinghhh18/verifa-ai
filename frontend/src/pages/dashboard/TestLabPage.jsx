import React, { useState, useEffect, useRef } from 'react';
import {
  FlaskConical,
  Plus,
  Play,
  Bot,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  FileCode2,
  Sliders,
  Check,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Database,
  BarChart3,
  History,
  Activity,
  Zap,
  Info,
  Layers,
  ArrowRight,
  XCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  StopCircle,
  Copy,
  Download,
  FileText,
} from 'lucide-react';
import api from '../../api/client';
import {
  getTestSuites,
  getDatasetPreview,
  validateTestRunConfig,
  startTestRun,
  getTestRunProgress,
  getTestRunDetail,
  getTestRunHistory,
  cancelTestRun,
  downloadReportPdf,
  downloadReportCsv,
  downloadReportJson,
} from '../../api/testlab';

export default function TestLabPage() {
  // Navigation / Tab state
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'progress' | 'results' | 'history'

  // Chatbots loaded from existing user connections
  const [registeredBots, setRegisteredBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(true);

  // Test Suites catalog loaded from backend dataset architecture
  const [suites, setSuites] = useState([]);
  const [loadingSuites, setLoadingSuites] = useState(true);

  // Report download states (Phase 5)
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Test Configuration Form State
  const [selectedBotId, setSelectedBotId] = useState('custom');
  const [chatbotName, setChatbotName] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState('full');
  const [testCount, setTestCount] = useState(100);

  // Validation & Launch State
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [launching, setLaunching] = useState(false);

  // Active Test Run State
  const [currentRunId, setCurrentRunId] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Run History state
  const [historyRuns, setHistoryRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Results Dashboard Filters State (Phase 4)
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'PASS' | 'POTENTIAL ISSUE' | 'EXECUTION ERROR'
  const [filterSeverity, setFilterSeverity] = useState('ALL'); // 'ALL' | 'critical' | 'high' | 'medium' | 'low'
  const [filterSearch, setFilterSearch] = useState('');
  const [expandedTestId, setExpandedTestId] = useState(null);

  // Architecture preview modal state
  const [showDataSchemaModal, setShowDataSchemaModal] = useState(false);
  const [datasetPreview, setDatasetPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load registered chatbots & benchmark suites on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingBots(true);
        const botsRes = await api.get('/chatbots/');
        setRegisteredBots(botsRes.data);
        if (botsRes.data.length > 0) {
          const firstBot = botsRes.data[0];
          setSelectedBotId(firstBot.id);
          setChatbotName(firstBot.name);
          setApiEndpoint(firstBot.api_endpoint);
        }
      } catch (err) {
        console.error('Error fetching registered chatbots:', err);
      } finally {
        setLoadingBots(false);
      }

      try {
        setLoadingSuites(true);
        const suitesData = await getTestSuites();
        setSuites(suitesData);
      } catch (err) {
        console.error('Error fetching test suites:', err);
      } finally {
        setLoadingSuites(false);
      }
    };

    fetchData();
  }, []);

  // Fetch History when history tab is activated
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await getTestRunHistory();
      setHistoryRuns(data);
    } catch (err) {
      console.error('Error loading TestLab history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Real-time polling hook for live test execution
  useEffect(() => {
    if (!currentRunId) return;
    if (activeRun && ['Completed', 'Failed', 'Cancelled'].includes(activeRun.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const progress = await getTestRunProgress(currentRunId);
        setActiveRun((prev) => ({
          ...(prev || {}),
          ...progress,
        }));

        if (['Completed', 'Failed', 'Cancelled'].includes(progress.status)) {
          clearInterval(interval);
          // Fetch full detail with all results and calculated Phase 4 metrics
          const fullDetail = await getTestRunDetail(currentRunId);
          setActiveRun(fullDetail);
          // Automatically switch to Results Dashboard on completion
          setActiveTab('results');
        }
      } catch (err) {
        console.error('Polling error for testlab run:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRunId, activeRun?.status]);

  // Handle chatbot selection change
  const handleChatbotSelect = (e) => {
    const value = e.target.value;
    setSelectedBotId(value);
    setValidationResult(null);
    setValidationError('');

    if (value === 'custom') {
      setChatbotName('');
      setApiEndpoint('');
      setApiKey('');
    } else {
      const bot = registeredBots.find((b) => b.id === value);
      if (bot) {
        setChatbotName(bot.name);
        setApiEndpoint(bot.api_endpoint);
        setApiKey('');
      }
    }
  };

  // Open dataset specification modal
  const handleOpenDataSchema = async () => {
    setShowDataSchemaModal(true);
    if (datasetPreview.length === 0) {
      try {
        setLoadingPreview(true);
        const data = await getDatasetPreview();
        setDatasetPreview(data);
      } catch (err) {
        console.error('Error fetching dataset preview:', err);
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  // Validate configuration handler
  const handleValidateConfig = async (e) => {
    if (e) e.preventDefault();
    setValidationError('');
    setValidationResult(null);

    if (!chatbotName.trim()) {
      setValidationError('Please specify the Chatbot Name.');
      return;
    }
    if (!apiEndpoint.trim()) {
      setValidationError('Please enter a valid Chatbot Endpoint URL.');
      return;
    }

    try {
      setValidating(true);
      const res = await validateTestRunConfig({
        chatbot_id: selectedBotId === 'custom' ? null : selectedBotId,
        chatbot_name: chatbotName.trim(),
        api_endpoint: apiEndpoint.trim(),
        api_key: apiKey.trim() || null,
        test_suite: selectedSuite,
        test_count: parseInt(testCount, 10),
      });
      setValidationResult(res);
    } catch (err) {
      console.error('Validation error:', err);
      setValidationError(
        err.response?.data?.detail || 'Configuration validation failed. Check endpoint format.'
      );
    } finally {
      setValidating(false);
    }
  };

  // Launch Real Test Run
  const handleLaunchTestRun = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!chatbotName.trim() || !apiEndpoint.trim()) {
      handleValidateConfig();
      return;
    }

    try {
      setLaunching(true);
      const newRun = await startTestRun({
        chatbot_id: selectedBotId === 'custom' ? null : selectedBotId,
        chatbot_name: chatbotName.trim(),
        api_endpoint: apiEndpoint.trim(),
        api_key: apiKey.trim() || null,
        test_suite: selectedSuite,
        test_count: parseInt(testCount, 10),
      });

      setCurrentRunId(newRun.id);
      setActiveRun(newRun);
      setActiveTab('progress');
    } catch (err) {
      console.error('Launch test run error:', err);
      setValidationError(
        err.response?.data?.detail || 'Failed to start TestLab execution. Please verify endpoint.'
      );
    } finally {
      setLaunching(false);
    }
  };

  // Cancel running test
  const handleCancelRun = async () => {
    if (!currentRunId) return;
    try {
      setCancelling(true);
      await cancelTestRun(currentRunId);
      setActiveRun((prev) => (prev ? { ...prev, status: 'Cancelled' } : null));
    } catch (err) {
      console.error('Cancel run error:', err);
    } finally {
      setCancelling(false);
    }
  };

  // Open past run from history
  const handleOpenHistoricalRun = async (runId) => {
    try {
      setCurrentRunId(runId);
      const detail = await getTestRunDetail(runId);
      setActiveRun(detail);
      setActiveTab('results');
    } catch (err) {
      console.error('Error opening historical run:', err);
    }
  };

  // Export & Download Report Handlers (Phase 5)
  const handleDownloadPdf = async (runId = null, botName = null) => {
    const targetId = runId || activeRun?.id;
    const targetBot = botName || activeRun?.chatbot_name || 'Chatbot';
    if (!targetId) return;

    try {
      setDownloadingPdf(true);
      await downloadReportPdf(targetId, targetBot);
    } catch (err) {
      console.error('Error downloading PDF report:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async (runId = null, botName = null) => {
    const targetId = runId || activeRun?.id;
    const targetBot = botName || activeRun?.chatbot_name || 'Chatbot';
    if (!targetId) return;

    try {
      setDownloadingCsv(true);
      await downloadReportCsv(targetId, targetBot);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleDownloadJson = async (runId = null, botName = null) => {
    const targetId = runId || activeRun?.id;
    const targetBot = botName || activeRun?.chatbot_name || 'Chatbot';
    if (!targetId) return;

    try {
      setDownloadingJson(true);
      await downloadReportJson(targetId, targetBot);
    } catch (err) {
      console.error('Error exporting JSON:', err);
    } finally {
      setDownloadingJson(false);
    }
  };

  // Helper icon for suite cards
  const getSuiteIcon = (id) => {
    switch (id) {
      case 'hallucination':
        return <ShieldAlert className="w-5 h-5 text-brand-yellow" />;
      case 'toxicity':
        return <AlertOctagon className="w-5 h-5 text-red-400" />;
      case 'consistency':
        return <CheckCircle2 className="w-5 h-5 text-brand-cyan" />;
      case 'instruction_following':
        return <FileCode2 className="w-5 h-5 text-brand-emerald" />;
      case 'adversarial':
        return <Lock className="w-5 h-5 text-purple-400" />;
      case 'full':
      default:
        return <Sparkles className="w-5 h-5 text-brand-yellow" />;
    }
  };

  // Filtered test items for Phase 4 Results Dashboard
  const allResults = activeRun?.results || [];
  const filteredResults = allResults.filter((item) => {
    // Category filter
    if (filterCategory !== 'ALL' && item.category.toLowerCase() !== filterCategory.toLowerCase()) {
      return false;
    }
    // Status filter
    if (filterStatus !== 'ALL' && item.status !== filterStatus) {
      return false;
    }
    // Severity filter
    if (filterSeverity !== 'ALL' && item.severity.toLowerCase() !== filterSeverity.toLowerCase()) {
      return false;
    }
    // Search query filter
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const matchId = item.test_id?.toLowerCase().includes(q);
      const matchPrompt = item.prompt?.toLowerCase().includes(q);
      const matchResp = item.chatbot_response?.toLowerCase().includes(q);
      if (!matchId && !matchPrompt && !matchResp) return false;
    }
    return true;
  });

  const testsRequiringAttention = allResults.filter(
    (item) => item.status === 'POTENTIAL ISSUE' || item.status === 'EXECUTION ERROR'
  );

  const summaryMetrics = activeRun?.summary_metrics || {};

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow shadow-glow-yellow/20">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">TestLab</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-yellow/15 border border-brand-yellow/40 text-brand-yellow font-bold uppercase tracking-wider">
                  Automated Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated chatbot testing and multi-metric evaluation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab('config');
            }}
            className="px-4 py-2.5 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl transition-all shadow-glow-yellow flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Test Run</span>
          </button>
        </div>
      </div>

      {/* Short Explanation Banner */}
      <div className="p-4 rounded-2xl border border-surface-border bg-gradient-to-r from-surface-card via-surface-card/90 to-surface-card border-l-4 border-l-brand-yellow text-xs text-slate-300 flex items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-brand-yellow shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold text-white">Connect your chatbot</span> and let VeriFa automatically execute and evaluate standardized benchmark test suites using actual models.
          </p>
        </div>
        <button
          onClick={handleOpenDataSchema}
          className="text-slate-400 hover:text-brand-yellow font-mono text-[11px] underline flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Benchmark Dataset Spec</span>
        </button>
      </div>

      {/* Navigation Tabs for TestLab Sections */}
      <div className="border-b border-surface-border">
        <nav className="flex gap-2 sm:gap-6 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-1 border-b-2 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'border-brand-yellow text-brand-yellow font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>1. New Test Run</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`py-3 px-1 border-b-2 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'progress'
                ? 'border-brand-yellow text-brand-yellow font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>2. Test Progress</span>
            {activeRun && ['Pending', 'Running'].includes(activeRun.status) && (
              <span className="w-2 h-2 rounded-full bg-brand-yellow animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`py-3 px-1 border-b-2 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'results'
                ? 'border-brand-yellow text-brand-yellow font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>3. Test Results</span>
            {activeRun && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-brand-yellow">
                {activeRun.completed_tests}/{activeRun.total_tests}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-brand-yellow text-brand-yellow font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>4. Test History</span>
          </button>
        </nav>
      </div>

      {/* SECTION 1: NEW TEST RUN CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-border">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-brand-yellow" />
                  <span>Test Run Configuration</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure your target chatbot endpoint, benchmark suite, and test sample volume.
                </p>
              </div>

              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-surface-darkest border border-surface-border text-slate-300">
                Target: <strong className="text-brand-yellow">100–120 tests</strong>
              </span>
            </div>

            {/* Validation Banner if validated */}
            {validationResult && (
              <div className="mb-6 p-4 rounded-xl border border-brand-emerald/40 bg-brand-emerald/10 text-emerald-300 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Configuration Verified</span>
                  <span>{validationResult.message}</span>
                </div>
              </div>
            )}

            {/* Validation Error Banner */}
            {validationError && (
              <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Configuration Error</span>
                  <span>{validationError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleLaunchTestRun} className="space-y-6">
              {/* Row 1: Chatbot Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-2">
                  Chatbot Connection *
                </label>
                <div className="relative">
                  <select
                    value={selectedBotId}
                    onChange={handleChatbotSelect}
                    disabled={loadingBots}
                    className="w-full bg-surface-darkest border border-surface-border rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-brand-yellow transition-colors font-mono cursor-pointer"
                  >
                    {loadingBots ? (
                      <option value="loading">Loading registered bots...</option>
                    ) : (
                      <>
                        {registeredBots.map((bot) => (
                          <option key={bot.id} value={bot.id}>
                            {bot.name} ({bot.api_endpoint})
                          </option>
                        ))}
                        <option value="custom">+ Configure Custom Chatbot Endpoint</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 2: Chatbot Details (Custom or Pre-filled) */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-2">
                    Chatbot Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production Support Bot v2.1"
                    value={chatbotName}
                    onChange={(e) => setChatbotName(e.target.value)}
                    className="w-full bg-surface-darkest border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-2">
                    Chatbot API Endpoint *
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://api.openai.com/v1/chat/completions"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      className="w-full bg-surface-darkest border border-surface-border rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                      required
                    />
                    <Globe className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                      API Key / Authentication Secret
                    </label>
                    {selectedBotId !== 'custom' ? (
                      <span className="text-[10px] text-brand-emerald font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Managed securely in database
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">Optional / Bearer Token</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={
                        selectedBotId !== 'custom'
                          ? '•••••••••••••••• (Encrypted in database)'
                          : 'Bearer sk-proj-•••••••• / gsk_••••'
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-surface-darkest border border-surface-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-yellow transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block flex items-center gap-1">
                    <Lock className="w-3 h-3 text-brand-emerald shrink-0" />
                    Secrets are processed in RAM for request execution and never exposed in client bundles.
                  </span>
                </div>
              </div>

              {/* Row 3: Test Suite Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Select Test Suite *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Predefined Benchmark Suites
                  </span>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {suites.map((suite) => {
                    const isSelected = selectedSuite === suite.id;
                    return (
                      <div
                        key={suite.id}
                        onClick={() => {
                          setSelectedSuite(suite.id);
                          setValidationResult(null);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-surface-elevated border-brand-yellow/60 shadow-glow-yellow'
                            : 'bg-surface-darkest/70 border-surface-border hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              {getSuiteIcon(suite.id)}
                              <span className="text-xs font-bold text-white">{suite.name}</span>
                            </div>
                            {suite.badge && (
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                                  isSelected
                                    ? 'bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {suite.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {suite.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-surface-border/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>Pool: {suite.total_available_tests} cases</span>
                          <span className={isSelected ? 'text-brand-yellow font-semibold' : ''}>
                            {isSelected ? 'Selected' : 'Click to select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Number of Tests Selection */}
              <div className="p-5 rounded-xl border border-surface-border bg-surface-darkest/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                      Number of Tests (Target: 100–120 tests)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Select how many standardized cases to run against your chatbot.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-xl font-bold text-brand-yellow">{testCount}</span>
                    <span className="text-xs text-slate-400">tests</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { count: 10, label: '10 Tests (Quick Verification)' },
                    { count: 50, label: '50 Tests (Intermediate)' },
                    { count: 100, label: '100 Tests (Standard Benchmark)' },
                    { count: 120, label: '120 Tests (Full Suite)' }
                  ].map((preset) => (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => {
                        setTestCount(preset.count);
                        setValidationResult(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        testCount === preset.count
                          ? 'bg-brand-yellow text-black font-bold shadow-glow-yellow'
                          : 'bg-surface-elevated text-slate-300 hover:text-white border border-surface-border hover:border-slate-500'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={testCount}
                    onChange={(e) => {
                      setTestCount(parseInt(e.target.value, 10));
                      setValidationResult(null);
                    }}
                    className="w-full accent-brand-yellow cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>10 (Quick)</span>
                    <span className="text-brand-yellow font-semibold">100 (Standard)</span>
                    <span>120 (Complete Pool)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleValidateConfig}
                  disabled={validating}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-surface-border hover:border-brand-yellow/40 bg-surface-elevated hover:bg-surface-hover text-slate-200 hover:text-white text-xs font-semibold font-mono flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {validating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating SSRF & Parameters...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-emerald" />
                      <span>Validate Configuration</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="submit"
                    disabled={launching}
                    className="w-full sm:w-auto px-6 py-2.5 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl shadow-glow-yellow flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {launching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Initializing Suite...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Launch Automated TestLab Run</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 2: TEST PROGRESS (LIVE TELEMETRY) */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-surface-border">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-yellow" />
                  <span>TestLab Execution Telemetry</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live dispatch orchestration, timeout guarding, and real model evaluation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {activeRun && ['Pending', 'Running'].includes(activeRun.status) && (
                  <button
                    onClick={handleCancelRun}
                    disabled={cancelling}
                    className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <StopCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>{cancelling ? 'Cancelling...' : 'Stop Test Run'}</span>
                  </button>
                )}

                <span
                  className={`text-[11px] font-mono px-3 py-1 rounded-full font-bold uppercase ${
                    activeRun?.status === 'Running'
                      ? 'bg-brand-yellow/15 border border-brand-yellow/40 text-brand-yellow animate-pulse'
                      : activeRun?.status === 'Completed'
                      ? 'bg-brand-emerald/15 border border-brand-emerald/40 text-brand-emerald'
                      : activeRun?.status === 'Cancelled'
                      ? 'bg-slate-700/50 border border-slate-600 text-slate-300'
                      : 'bg-surface-darkest border border-surface-border text-slate-400'
                  }`}
                >
                  {activeRun?.status === 'Running'
                    ? 'TestLab Evaluation Running'
                    : activeRun?.status
                    ? `Status: ${activeRun.status}`
                    : 'Awaiting Run Initiation'}
                </span>
              </div>
            </div>

            {/* Live Progress Bar Section */}
            {activeRun && (
              <div className="mb-8 p-5 rounded-xl border border-surface-border bg-surface-darkest/70 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">Tests completed:</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {activeRun.completed_tests || 0} / {activeRun.total_tests || testCount}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[11px] font-mono text-slate-400 block">Current test:</span>
                    <span className="text-xs font-bold font-mono text-brand-yellow">
                      {activeRun.current_test_name || 'Preparing test case...'}
                    </span>
                  </div>
                </div>

                {/* Responsive Progress Bar */}
                <div className="w-full bg-surface-elevated rounded-full h-3.5 overflow-hidden border border-surface-border">
                  <div
                    className="h-full bg-gradient-to-r from-brand-yellow via-brand-gold to-brand-emerald transition-all duration-300 rounded-full"
                    style={{
                      width: `${
                        activeRun.total_tests > 0
                          ? Math.min(100, Math.round((activeRun.completed_tests / activeRun.total_tests) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400">Passed: {activeRun.passed_tests || 0}</span>
                    <span className="text-yellow-400">Potential Issues: {activeRun.potential_issue_tests || 0}</span>
                    <span className="text-red-400">Errors: {activeRun.failed_tests || 0}</span>
                  </div>
                  <span>
                    {activeRun.total_tests > 0
                      ? Math.round((activeRun.completed_tests / activeRun.total_tests) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            )}

            {/* Telemetry Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-darkest p-4 rounded-xl border border-surface-border">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Target Chatbot</span>
                <span className="text-sm font-bold font-mono text-white truncate block">
                  {activeRun?.chatbot_name || chatbotName || 'Selected Bot'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Live Connected</span>
              </div>

              <div className="bg-surface-darkest p-4 rounded-xl border border-surface-border">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Target Suite</span>
                <span className="text-sm font-bold font-mono text-brand-yellow truncate block uppercase">
                  {activeRun?.test_suite || selectedSuite}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Benchmark Pool</span>
              </div>

              <div className="bg-surface-darkest p-4 rounded-xl border border-surface-border">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Vectara HHEM</span>
                <span className="text-sm font-bold font-mono text-brand-emerald block">Active (Local PyTorch)</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Cross-Encoder</span>
              </div>

              <div className="bg-surface-darkest p-4 rounded-xl border border-surface-border">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Elapsed Time</span>
                <span className="text-xl font-bold font-mono text-brand-cyan">
                  {activeRun?.duration_seconds ? `${activeRun.duration_seconds}s` : 'Running...'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">Real-time latency</span>
              </div>
            </div>

            {/* Test Log Terminal Frame */}
            <div className="rounded-xl bg-surface-darkest border border-surface-border p-4 font-mono text-xs text-slate-400 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/50 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeRun?.status === 'Running'
                        ? 'bg-brand-yellow animate-pulse'
                        : activeRun?.status === 'Completed'
                        ? 'bg-brand-emerald'
                        : 'bg-slate-600'
                    }`}
                  />
                  TestLab Live Console
                </span>
                <span>Run ID: {currentRunId ? currentRunId.substring(0, 8) : 'none'}</span>
              </div>
              <p className="text-slate-300">
                [INIT] Connected to chatbot &quot;{activeRun?.chatbot_name || chatbotName || 'Target Chatbot'}&quot;
              </p>
              <p className="text-slate-400">
                [ORCHESTRATOR] Suite: {(activeRun?.test_suite || selectedSuite).toUpperCase()} • Target: {activeRun?.total_tests || testCount} tests
              </p>
              <p className="text-brand-yellow">
                [STATUS] {activeRun?.current_test_name || 'Ready for test dispatch.'}
              </p>
              {activeRun?.status === 'Completed' && (
                <div className="pt-2 text-brand-emerald flex items-center justify-between">
                  <span>[COMPLETE] All benchmark evaluations completed successfully!</span>
                  <button
                    onClick={() => setActiveTab('results')}
                    className="px-3 py-1 bg-brand-yellow text-black font-bold text-xs rounded-lg hover:bg-brand-gold transition-colors cursor-pointer"
                  >
                    View Results Dashboard →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: TEST RESULTS & SCORECARD (PHASE 4 COMPLETE DASHBOARD) */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!activeRun ? (
            /* Empty State when no run has been selected */
            <div className="bg-surface-card border border-surface-border rounded-2xl p-10 text-center shadow-xl">
              <FlaskConical className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Active Run Selected</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                Launch a new test run or open a completed run from <strong>Test History</strong> to view the multi-metric scorecard, category analytics, and individual test cases.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('config')}
                  className="px-4 py-2.5 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl shadow-glow-yellow flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Configure New Run</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2.5 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-semibold rounded-xl border border-surface-border flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>Browse Test History</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* RESULTS HEADER */}
              <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-yellow/15 text-brand-yellow font-bold uppercase border border-brand-yellow/30">
                        {activeRun.test_suite} suite
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Run #{activeRun.id?.substring(0, 8)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-brand-yellow" />
                      <span>Evaluation Summary — {activeRun.chatbot_name}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Multi-metric assessment based on real connected chatbot executions and VeriFA models.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Prominent Generate Report Button (Phase 5) */}
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="px-4 py-2 bg-gradient-to-r from-brand-yellow to-brand-gold hover:from-brand-gold hover:to-yellow-500 text-black font-bold text-xs rounded-xl shadow-glow-yellow flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <FileText className="w-4 h-4 fill-current" />
                      <span>Generate Report</span>
                    </button>

                    {/* Quick Export PDF */}
                    <button
                      onClick={() => handleDownloadPdf()}
                      disabled={downloadingPdf}
                      className="px-3 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-semibold rounded-xl border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Download PDF Report"
                    >
                      {downloadingPdf ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-brand-yellow" />
                      )}
                      <span>Download PDF</span>
                    </button>

                    {/* Quick Export CSV */}
                    <button
                      onClick={() => handleDownloadCsv()}
                      disabled={downloadingCsv}
                      className="px-3 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-semibold rounded-xl border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Export Results CSV"
                    >
                      {downloadingCsv ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-brand-emerald" />
                      )}
                      <span>Export CSV</span>
                    </button>

                    {/* Quick Export JSON */}
                    <button
                      onClick={() => handleDownloadJson()}
                      disabled={downloadingJson}
                      className="px-3 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-semibold rounded-xl border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Export Full JSON"
                    >
                      {downloadingJson ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileCode2 className="w-3.5 h-3.5 text-brand-cyan" />
                      )}
                      <span>Export JSON</span>
                    </button>

                    <span
                      className={`text-xs font-mono px-3 py-1.5 rounded-xl font-bold uppercase ml-1 ${
                        activeRun.status === 'Completed'
                          ? 'bg-brand-emerald/15 border border-brand-emerald/40 text-brand-emerald'
                          : activeRun.status === 'Cancelled'
                          ? 'bg-slate-700/50 border border-slate-600 text-slate-300'
                          : 'bg-brand-yellow/15 border border-brand-yellow/40 text-brand-yellow'
                      }`}
                    >
                      {activeRun.status}
                    </span>
                  </div>
                </div>

                {/* 1. EVALUATION SUMMARY CARDS (Phase 4 requirement) */}
                <div className="mt-6">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-3">
                    Evaluation Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-4 rounded-xl bg-surface-darkest border border-surface-border">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Total Tests</span>
                      <span className="text-2xl font-bold font-mono text-white">
                        {activeRun.total_tests || activeRun.completed_tests}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">Executed cases</span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-darkest border border-brand-emerald/30">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-1">Passed</span>
                      <span className="text-2xl font-bold font-mono text-brand-emerald">
                        {activeRun.passed_tests || 0}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-mono block mt-1">
                        {activeRun.completed_tests > 0
                          ? Math.round((activeRun.passed_tests / activeRun.completed_tests) * 100)
                          : 0}
                        % pass rate
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-darkest border border-yellow-500/30">
                      <span className="text-[10px] font-mono uppercase text-yellow-400 block mb-1">Potential Issues</span>
                      <span className="text-2xl font-bold font-mono text-yellow-400">
                        {activeRun.potential_issue_tests || 0}
                      </span>
                      <span className="text-[10px] text-yellow-500 font-mono block mt-1">Require review</span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-darkest border border-red-500/30">
                      <span className="text-[10px] font-mono uppercase text-red-400 block mb-1">Execution Errors</span>
                      <span className="text-2xl font-bold font-mono text-red-400">
                        {activeRun.failed_tests || 0}
                      </span>
                      <span className="text-[10px] text-red-500 font-mono block mt-1">Endpoint timeouts/429</span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-darkest border border-brand-cyan/30 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-mono uppercase text-brand-cyan block mb-1">Duration</span>
                      <span className="text-2xl font-bold font-mono text-brand-cyan">
                        {activeRun.duration_seconds ? `${activeRun.duration_seconds}s` : '---'}
                      </span>
                      <span className="text-[10px] text-cyan-500 font-mono block mt-1">Total runtime</span>
                    </div>
                  </div>
                </div>

                {/* 2. METRICS (Phase 4 requirement) */}
                <div className="mt-8 pt-6 border-t border-surface-border">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-3">
                    Evaluation Metrics
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface-darkest/90 border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Potential Hallucination Rate</span>
                      <div className="text-xl font-bold font-mono text-yellow-400">
                        {summaryMetrics.potential_hallucination_rate !== undefined
                          ? `${summaryMetrics.potential_hallucination_rate}%`
                          : '0.0%'}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">HHEM cross-encoder</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-darkest/90 border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Toxicity Rate</span>
                      <div className="text-xl font-bold font-mono text-red-400">
                        {summaryMetrics.toxicity_rate !== undefined ? `${summaryMetrics.toxicity_rate}%` : '0.0%'}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Safety & profanity scan</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-darkest/90 border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Consistency Score</span>
                      <div className="text-xl font-bold font-mono text-brand-cyan">
                        {summaryMetrics.consistency_score !== undefined
                          ? `${summaryMetrics.consistency_score}%`
                          : '100%'}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Pairwise stability</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-darkest/90 border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Instruction Following</span>
                      <div className="text-xl font-bold font-mono text-brand-emerald">
                        {summaryMetrics.instruction_following_score !== undefined
                          ? `${summaryMetrics.instruction_following_score}%`
                          : '100%'}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Constraint compliance</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-darkest/90 border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Tests Passed</span>
                      <div className="text-xl font-bold font-mono text-white">
                        {activeRun.passed_tests || 0}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Verified compliant</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-darkest/90 border border-surface-border">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Tests With Issues</span>
                      <div className="text-xl font-bold font-mono text-yellow-400">
                        {activeRun.potential_issue_tests || 0}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Potential anomalies</span>
                    </div>
                  </div>
                </div>

                {/* 3. CATEGORY ANALYTICS CHARTS (Phase 4 requirement) */}
                <div className="mt-8 pt-6 border-t border-surface-border">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono mb-4">
                    Category Analytics
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: 'Hallucination', label: 'Hallucination & Factual Consistency', icon: <ShieldAlert className="w-4 h-4 text-brand-yellow" /> },
                      { key: 'Toxicity', label: 'Toxicity & Content Safety', icon: <AlertOctagon className="w-4 h-4 text-red-400" /> },
                      { key: 'Consistency', label: 'Response Consistency', icon: <CheckCircle2 className="w-4 h-4 text-brand-cyan" /> },
                      { key: 'Instruction Following', label: 'Instruction Following', icon: <FileCode2 className="w-4 h-4 text-brand-emerald" /> },
                      { key: 'Adversarial', label: 'Adversarial Testing & Jailbreak Resistance', icon: <Lock className="w-4 h-4 text-purple-400" /> },
                    ].map((cat) => {
                      const stat = summaryMetrics.category_analytics?.[cat.key] || {
                        total: 0,
                        passed: 0,
                        issues: 0,
                        errors: 0,
                        pass_rate: 100,
                      };
                      return (
                        <div
                          key={cat.key}
                          className="p-4 rounded-xl bg-surface-darkest/70 border border-surface-border space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                            <div className="flex items-center gap-2">
                              {cat.icon}
                              <span className="font-bold text-white">{cat.label}</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono text-[11px]">
                              <span className="text-emerald-400">{stat.passed} Passed</span>
                              <span className="text-yellow-400">{stat.issues} Issues</span>
                              {stat.errors > 0 && <span className="text-red-400">{stat.errors} Errors</span>}
                              <span className="text-slate-400">Total: {stat.total}</span>
                              <span className="font-bold text-brand-yellow">{stat.pass_rate}% Pass Rate</span>
                            </div>
                          </div>

                          {/* Progress bar visualizer for this category */}
                          <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden flex">
                            <div
                              className="bg-brand-emerald h-full transition-all"
                              style={{ width: `${stat.total > 0 ? (stat.passed / stat.total) * 100 : 100}%` }}
                              title={`${stat.passed} Passed`}
                            />
                            <div
                              className="bg-yellow-400 h-full transition-all"
                              style={{ width: `${stat.total > 0 ? (stat.issues / stat.total) * 100 : 0}%` }}
                              title={`${stat.issues} Potential Issues`}
                            />
                            <div
                              className="bg-red-400 h-full transition-all"
                              style={{ width: `${stat.total > 0 ? (stat.errors / stat.total) * 100 : 0}%` }}
                              title={`${stat.errors} Execution Errors`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. TESTS REQUIRING ATTENTION (Phase 4 requirement) */}
                <div className="mt-8 pt-6 border-t border-surface-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span>Tests Requiring Attention ({testsRequiringAttention.length})</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Test cases flagged with potential hallucinations, violations, or execution errors.
                      </p>
                    </div>

                    <span className="text-[11px] font-mono px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/30 text-yellow-400">
                      {testsRequiringAttention.length} flagged of {allResults.length}
                    </span>
                  </div>

                  {testsRequiringAttention.length === 0 ? (
                    <div className="p-6 rounded-xl border border-brand-emerald/30 bg-brand-emerald/5 text-center text-xs text-emerald-300">
                      <CheckCircle2 className="w-6 h-6 text-brand-emerald mx-auto mb-2" />
                      <span className="font-bold text-white block">No Anomalies Flagged</span>
                      <span>All evaluated tests satisfied safety, consistency, and constraint criteria.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {testsRequiringAttention.map((test) => {
                        const isExpanded = expandedTestId === test.test_id;
                        return (
                          <div
                            key={test.test_id}
                            className={`rounded-xl border transition-all ${
                              test.status === 'EXECUTION ERROR'
                                ? 'border-red-500/40 bg-red-500/5'
                                : 'border-yellow-500/40 bg-yellow-500/5'
                            }`}
                          >
                            {/* Accordion Header */}
                            <div
                              onClick={() => setExpandedTestId(isExpanded ? null : test.test_id)}
                              className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-elevated/40 rounded-xl transition-colors"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span className="font-mono text-xs font-bold text-brand-yellow shrink-0">
                                  #{test.test_id}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-darkest border border-surface-border text-slate-300 shrink-0">
                                  {test.category}
                                </span>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                                    test.severity === 'critical'
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                      : test.severity === 'high'
                                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                      : 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {test.severity}
                                </span>
                                <p className="text-xs text-slate-200 truncate">{test.prompt}</p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                                    test.status === 'EXECUTION ERROR'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-yellow-500/20 text-yellow-400'
                                  }`}
                                >
                                  {test.status}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {/* Accordion Expanded Body */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 border-t border-surface-border/60 text-xs space-y-3 font-mono">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                                    Test Prompt:
                                  </span>
                                  <div className="p-3 rounded-lg bg-surface-darkest border border-surface-border text-slate-200 font-sans">
                                    {test.prompt}
                                  </div>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                                    Chatbot Response:
                                  </span>
                                  <div className="p-3 rounded-lg bg-surface-darkest border border-surface-border text-slate-300 font-sans whitespace-pre-wrap">
                                    {test.chatbot_response || '(No response received)'}
                                  </div>
                                </div>

                                {test.reference_information && (
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                                      Expected / Reference Information:
                                    </span>
                                    <div className="p-3 rounded-lg bg-surface-darkest/70 border border-surface-border text-emerald-300/90 font-sans">
                                      {test.reference_information}
                                    </div>
                                  </div>
                                )}

                                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                                  <div className="p-3 rounded-lg bg-surface-darkest border border-surface-border">
                                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                                      Evaluation Result:
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-bold ${
                                          test.status === 'EXECUTION ERROR' ? 'text-red-400' : 'text-yellow-400'
                                        }`}
                                      >
                                        {test.status}
                                      </span>
                                      {test.score !== null && (
                                        <span className="text-slate-400 text-[11px]">
                                          (Score: {test.score} / Threshold: {test.threshold})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-surface-darkest border border-surface-border">
                                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                                      Evaluation Reason:
                                    </span>
                                    <p className="text-slate-300 text-[11px] font-sans">{test.reason}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. ALL TESTS AUDIT TABLE WITH COMPLETE FILTERS (Phase 4 requirement) */}
                <div className="mt-8 pt-6 border-t border-surface-border space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-brand-cyan" />
                        <span>All Executed Test Cases ({filteredResults.length} of {allResults.length})</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Inspect every benchmark test case, model response, and evaluation outcome.
                      </p>
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="p-3 rounded-xl bg-surface-darkest border border-surface-border flex flex-wrap items-center gap-3 text-xs">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search by Test ID (e.g. HL-001) or prompt keyword..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full bg-surface-card border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-yellow font-mono"
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-mono text-[11px]">Category:</span>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow font-mono cursor-pointer"
                      >
                        <option value="ALL">All Categories</option>
                        <option value="Hallucination">Hallucination</option>
                        <option value="Factual Accuracy">Factual Accuracy</option>
                        <option value="Unanswerable">Unanswerable</option>
                        <option value="False Premise">False Premise</option>
                        <option value="Consistency">Consistency</option>
                        <option value="Instruction Following">Instruction Following</option>
                        <option value="Toxicity">Toxicity</option>
                        <option value="Adversarial">Adversarial</option>
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-mono text-[11px]">Status:</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow font-mono cursor-pointer"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PASS">PASS</option>
                        <option value="POTENTIAL ISSUE">POTENTIAL ISSUE</option>
                        <option value="EXECUTION ERROR">EXECUTION ERROR</option>
                      </select>
                    </div>

                    {/* Severity Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-mono text-[11px]">Severity:</span>
                      <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value)}
                        className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow font-mono cursor-pointer"
                      >
                        <option value="ALL">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Filtered Table */}
                  <div className="overflow-x-auto rounded-xl border border-surface-border">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-surface-darkest border-b border-surface-border font-mono text-[11px] uppercase text-slate-400">
                        <tr>
                          <th className="py-3 px-4">Test ID</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Prompt</th>
                          <th className="py-3 px-4">Chatbot Response</th>
                          <th className="py-3 px-4">Latency</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border/50 bg-surface-card/60">
                        {filteredResults.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-slate-500 font-mono">
                              No test cases match the active filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredResults.map((item) => (
                            <React.Fragment key={item.test_id}>
                              <tr className="hover:bg-surface-hover/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-brand-yellow">
                                  {item.test_id}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-darkest border border-surface-border">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-3 px-4 max-w-xs truncate" title={item.prompt}>
                                  {item.prompt}
                                </td>
                                <td className="py-3 px-4 max-w-xs truncate text-slate-400" title={item.chatbot_response}>
                                  {item.chatbot_response || '(No response)'}
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                                  {item.latency_ms ? `${item.latency_ms}ms` : '---'}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-[10px]">
                                  <span
                                    className={`px-2 py-0.5 rounded uppercase ${
                                      item.status === 'PASS'
                                        ? 'bg-brand-emerald/15 text-brand-emerald'
                                        : item.status === 'EXECUTION ERROR'
                                        ? 'bg-red-500/15 text-red-400'
                                        : 'bg-yellow-500/15 text-yellow-400'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() =>
                                      setExpandedTestId(expandedTestId === item.test_id ? null : item.test_id)
                                    }
                                    className="text-slate-400 hover:text-white font-mono text-[11px] underline cursor-pointer"
                                  >
                                    {expandedTestId === item.test_id ? 'Hide' : 'Inspect'}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Row Inspector */}
                              {expandedTestId === item.test_id && (
                                <tr className="bg-surface-darkest/90 border-b border-surface-border/80">
                                  <td colSpan="7" className="p-4 font-mono text-xs space-y-3">
                                    <div className="grid sm:grid-cols-2 gap-4">
                                      <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                                          Full Prompt:
                                        </span>
                                        <div className="p-3 rounded-lg bg-surface-card border border-surface-border text-white font-sans text-xs">
                                          {item.prompt}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                                          Full Chatbot Response:
                                        </span>
                                        <div className="p-3 rounded-lg bg-surface-card border border-surface-border text-slate-300 font-sans text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
                                          {item.chatbot_response || '(Empty response)'}
                                        </div>
                                      </div>
                                    </div>

                                    {item.reference_information && (
                                      <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                                          Reference Evidence / Ground Truth:
                                        </span>
                                        <div className="p-2.5 rounded-lg bg-surface-card border border-surface-border text-emerald-300 font-sans text-xs">
                                          {item.reference_information}
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] border-t border-surface-border/50">
                                      <div className="flex items-center gap-4">
                                        <span>
                                          <strong>Score:</strong>{' '}
                                          <span className="text-brand-yellow">
                                            {item.score !== null ? item.score : 'N/A'}
                                          </span>
                                        </span>
                                        <span>
                                          <strong>Threshold:</strong>{' '}
                                          <span className="text-slate-400">
                                            {item.threshold !== null ? item.threshold : 'N/A'}
                                          </span>
                                        </span>
                                        <span>
                                          <strong>Severity:</strong>{' '}
                                          <span className="uppercase text-slate-300">{item.severity}</span>
                                        </span>
                                      </div>
                                      <div className="text-slate-300 font-sans">
                                        <strong>Reason:</strong> {item.reason}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION 4: TEST HISTORY (PHASE 4 COMPLETE HISTORY SYSTEM) */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-surface-border">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-yellow" />
                  <span>Test Run History</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit logs of previously scheduled and executed benchmark evaluations.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="px-3 py-1.5 rounded-lg border border-surface-border hover:border-slate-500 bg-surface-elevated text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <span className="text-[11px] font-mono px-3 py-1 rounded-xl bg-surface-darkest border border-surface-border text-slate-400">
                  Total Runs: {historyRuns.length}
                </span>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-xs font-mono text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-yellow" />
                <span>Loading TestLab execution history...</span>
              </div>
            ) : historyRuns.length === 0 ? (
              /* Empty History State */
              <div className="border border-dashed border-surface-border rounded-xl p-12 text-center bg-surface-darkest/40">
                <History className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">No Test Runs Recorded Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
                  Execute benchmark evaluations from the <strong>New Test Run</strong> tab to automatically record run telemetry, pass rates, and evaluation metrics here.
                </p>
                <button
                  onClick={() => setActiveTab('config')}
                  className="px-4 py-2.5 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl shadow-glow-yellow inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Run First TestLab Suite</span>
                </button>
              </div>
            ) : (
              /* History Table (Phase 4 requirement) */
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-surface-darkest border-b border-surface-border font-mono text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Run ID</th>
                      <th className="py-3.5 px-4">Chatbot</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Tests</th>
                      <th className="py-3.5 px-4">Hallucination Rate</th>
                      <th className="py-3.5 px-4">Toxicity Rate</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/50 bg-surface-card/60 font-mono">
                    {historyRuns.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-brand-yellow">
                          #{r.id.substring(0, 8)}
                        </td>
                        <td className="py-3.5 px-4 font-sans font-medium text-white truncate max-w-[140px]">
                          {r.chatbot_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {r.completed_tests} / {r.total_tests}
                        </td>
                        <td className="py-3.5 px-4 text-yellow-400 font-bold">
                          {r.potential_hallucination_rate !== undefined ? `${r.potential_hallucination_rate}%` : '0.0%'}
                        </td>
                        <td className="py-3.5 px-4 text-red-400 font-bold">
                          {r.toxicity_rate !== undefined ? `${r.toxicity_rate}%` : '0.0%'}
                        </td>
                        <td className="py-3.5 px-4 text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase ${
                              r.status === 'Completed'
                                ? 'bg-brand-emerald/15 text-brand-emerald'
                                : r.status === 'Cancelled'
                                ? 'bg-slate-700/50 text-slate-300'
                                : 'bg-brand-yellow/15 text-brand-yellow animate-pulse'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDownloadPdf(r.id, r.chatbot_name)}
                              disabled={downloadingPdf}
                              className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 hover:text-brand-yellow border border-surface-border text-xs transition-colors cursor-pointer"
                              title="Download PDF Report"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenHistoricalRun(r.id)}
                              className="px-3 py-1 bg-surface-elevated hover:bg-brand-yellow hover:text-black text-slate-200 font-bold rounded-lg border border-surface-border text-xs transition-colors cursor-pointer inline-flex items-center gap-1 font-sans"
                            >
                              <span>View Results</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DATASET SPECIFICATION MODAL (Architecture Showcase) */}
      {showDataSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Benchmark Dataset Architecture</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Decoupled server-side benchmark specifications (122 standardized tests)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDataSchemaModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-surface-darkest border border-surface-border text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-white block mb-1">Architecture Guarantee:</span>
                All 122 prompts across 8 benchmark categories are decoupled from the UI, stored on the backend, and executed using real models and ground truth references.
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono mb-2">
                  Sample Dataset Items
                </h4>
                {loadingPreview ? (
                  <div className="p-4 text-center text-xs font-mono text-slate-500">Loading preview...</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {datasetPreview.map((item) => (
                      <div
                        key={item.test_id}
                        className="p-2.5 rounded-lg bg-surface-darkest border border-surface-border text-xs font-mono"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-brand-yellow">{item.test_id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-slate-400">
                            {item.category} • {item.severity}
                          </span>
                        </div>
                        <p className="text-slate-300 font-sans text-xs truncate">
                          <strong>Q:</strong> {item.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-surface-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowDataSchemaModal(false)}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-semibold rounded-xl border border-surface-border cursor-pointer"
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT GENERATION MODAL (Phase 5 Complete Report System) */}
      {showReportModal && activeRun && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-yellow/15 border border-brand-yellow/40 flex items-center justify-center text-brand-yellow shadow-glow-yellow/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">TestLab Evaluation Report Generator</h3>
                  <span className="text-xs text-slate-400 font-mono">
                    VeriFa-AI Certified Benchmark Report
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-hover cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Report Cover Preview Box */}
            <div className="p-5 rounded-xl bg-surface-darkest border border-surface-border space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-surface-border/50 pb-2">
                <span className="font-bold text-brand-yellow">VeriFa-AI Platform</span>
                <span>Automated Benchmark Audit</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Chatbot:</span>
                  <span className="text-sm font-bold text-white font-sans">{activeRun.chatbot_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Evaluation Date:</span>
                  <span className="text-xs text-slate-300">
                    {new Date(activeRun.created_at).toLocaleDateString()} {new Date(activeRun.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Test Run ID:</span>
                  <span className="text-xs text-slate-400">{activeRun.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Suite & Sample:</span>
                  <span className="text-xs text-slate-300 uppercase">{activeRun.test_suite} ({activeRun.total_tests} cases)</span>
                </div>
              </div>
            </div>

            {/* Metrics & Evidence Included */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Report Contents Included
              </h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-surface-darkest/70 border border-surface-border flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0" />
                  <span>Executive Summary ({activeRun.passed_tests} Passed, {activeRun.potential_issue_tests} Issues)</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-darkest/70 border border-surface-border flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0" />
                  <span>Vectara HHEM Hallucination Rate ({summaryMetrics.potential_hallucination_rate || 0}%)</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-darkest/70 border border-surface-border flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0" />
                  <span>Category Performance Analytics & Charts</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-darkest/70 border border-surface-border flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0" />
                  <span>Detailed Findings & Ground Truth Evidence</span>
                </div>
              </div>
            </div>

            {/* Conclusion Preview (Strictly grounded, no absolute claims) */}
            <div className="p-4 rounded-xl bg-surface-darkest/90 border border-surface-border text-xs text-slate-300 space-y-1 leading-relaxed">
              <span className="font-bold text-white block font-mono text-[11px] uppercase text-brand-cyan">
                Report Conclusion Preview:
              </span>
              <p>
                &quot;The evaluation identified {activeRun.potential_issue_tests || 0} potential issue case(s) across {activeRun.total_tests || activeRun.completed_tests} executed benchmark tests. A total of {activeRun.passed_tests || 0} tests fully satisfied automated compliance criteria.&quot;
              </p>
            </div>

            {/* Mandatory Disclaimer (Phase 5 requirement) */}
            <div className="p-3.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Disclaimer:</strong> Automated evaluation results are indicative and should be reviewed by humans for important or high-risk use cases.
              </span>
            </div>

            {/* Export Buttons */}
            <div className="pt-3 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs font-semibold rounded-xl border border-surface-border cursor-pointer transition-colors"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleDownloadCsv()}
                  disabled={downloadingCsv}
                  className="px-3.5 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-bold font-mono rounded-xl border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {downloadingCsv ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-brand-emerald" />}
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadJson()}
                  disabled={downloadingJson}
                  className="px-3.5 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-200 text-xs font-bold font-mono rounded-xl border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {downloadingJson ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCode2 className="w-3.5 h-3.5 text-brand-cyan" />}
                  <span>Export JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  disabled={downloadingPdf}
                  className="px-5 py-2 bg-brand-yellow hover:bg-brand-gold text-black font-bold text-xs rounded-xl shadow-glow-yellow flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {downloadingPdf ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
