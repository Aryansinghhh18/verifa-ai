import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import {
  FileSpreadsheet,
  UploadCloud,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Loader2,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  BarChart3,
  Bot,
  Sparkles,
  Info
} from 'lucide-react';

export default function BatchEvaluationPage() {
  // State: File & Chatbot Selection
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatbots, setChatbots] = useState([]);
  const [selectedChatbotId, setSelectedChatbotId] = useState('');
  const [loadingChatbots, setLoadingChatbots] = useState(false);

  // State: Batch Job execution & monitoring
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobProgress, setJobProgress] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // State: History / Past Jobs
  const [recentJobs, setRecentJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // State: Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all'); // all, low, medium, high, error
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Fetch connected chatbots & past batch jobs on mount
  useEffect(() => {
    fetchChatbots();
    fetchRecentJobs();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const fetchChatbots = async () => {
    try {
      setLoadingChatbots(true);
      const res = await api.get('/chatbots/');
      setChatbots(res.data);
    } catch (err) {
      console.error('Failed to load chatbots:', err);
    } finally {
      setLoadingChatbots(false);
    }
  };

  const fetchRecentJobs = async () => {
    try {
      setLoadingJobs(true);
      const res = await api.get('/batch/');
      setRecentJobs(res.data);
    } catch (err) {
      console.error('Failed to load batch jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setUploadError('');
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Invalid file type. Please upload a standard comma-separated .csv file.');
      setFile(null);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError('File exceeds maximum size of 5 MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  // Upload and start batch
  const handleStartBatch = async () => {
    if (!file) {
      setUploadError('Please select or drag a CSV file first.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      setJobDetail(null);
      setJobProgress(null);

      const formData = new FormData();
      formData.append('file', file);
      if (selectedChatbotId) {
        formData.append('chatbot_id', selectedChatbotId);
      }

      const res = await api.post('/batch/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const initialJob = res.data;
      setCurrentJobId(initialJob.id);
      setIsProcessing(true);
      setJobProgress({
        job_id: initialJob.id,
        status: initialJob.status,
        total_cases: initialJob.total_cases,
        completed_cases: initialJob.completed_cases,
        failed_cases: initialJob.failed_cases,
        progress_percentage: initialJob.total_cases > 0 
          ? Math.round((initialJob.completed_cases / initialJob.total_cases) * 100) 
          : 0,
      });

      // Start live polling every 1.5s
      startPolling(initialJob.id);
      fetchRecentJobs();
    } catch (err) {
      console.error('Batch upload error:', err);
      const detailMsg = err.response?.data?.detail;
      setUploadError(
        typeof detailMsg === 'string'
          ? detailMsg
          : 'Failed to process batch CSV. Ensure required columns "prompt" and "response" are included.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Live polling for batch progress
  const startPolling = (jobId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const progRes = await api.get(`/batch/${jobId}/progress`);
        const prog = progRes.data;
        setJobProgress(prog);

        if (prog.status === 'completed' || prog.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsProcessing(false);
          // Fetch final complete results
          const detailRes = await api.get(`/batch/${jobId}`);
          setJobDetail(detailRes.data);
          fetchRecentJobs();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
  };

  // Switch to viewing a previous job
  const handleSelectJob = async (jobId) => {
    try {
      setCurrentJobId(jobId);
      const [progRes, detailRes] = await Promise.all([
        api.get(`/batch/${jobId}/progress`),
        api.get(`/batch/${jobId}`),
      ]);
      setJobProgress(progRes.data);
      setJobDetail(detailRes.data);
      if (progRes.data.status === 'processing' || progRes.data.status === 'pending') {
        setIsProcessing(true);
        startPolling(jobId);
      } else {
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Failed to load job details:', err);
    }
  };

  // Export results CSV download
  const handleDownloadReport = async (jobId) => {
    try {
      const res = await api.get(`/batch/${jobId}/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `verifa_batch_report_${jobId.slice(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export batch report:', err);
    }
  };

  // Download Sample CSV template
  const handleDownloadSample = () => {
    const sampleCsv = `prompt,response,reference
"What is the capital of France?","Paris is the capital of France.","Paris is the capital and most populous city of France."
"Who discovered penicillin?","Penicillin was discovered in 1928 by Alexander Fleming.","Scottish physician Alexander Fleming discovered penicillin in 1928."
"Who walked on the Moon first?","Neil Armstrong stepped on the Moon in July 1969.","Neil Armstrong was the first person to walk on the Moon during Apollo 11 in 1969."
"What is the largest ocean?","The Atlantic Ocean is the largest ocean on Earth.","The Pacific Ocean is the largest and deepest of Earth's oceanic divisions."`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'verifa_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filter results
  const filteredResults = (jobDetail?.results || []).filter((r) => {
    const matchesSearch =
      searchQuery === '' ||
      r.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.response.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reference && r.reference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRisk =
      riskFilter === 'all' ||
      (riskFilter === 'low' && r.risk_level === 'low') ||
      (riskFilter === 'medium' && r.risk_level === 'medium') ||
      (riskFilter === 'high' && r.risk_level === 'high') ||
      (riskFilter === 'error' && r.status === 'error');

    return matchesSearch && matchesRisk;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Batch Evaluation</h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20">
              Vectara HHEM Powered
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Upload CSV benchmark datasets to run high-throughput hallucination detection and factual consistency scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-hover text-xs font-medium text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Sample Template CSV</span>
          </button>
          <button
            onClick={() => setShowFormatGuide(!showFormatGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-hover text-xs font-medium text-brand-yellow transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Format Guidelines</span>
          </button>
        </div>
      </div>

      {/* CSV Format Guide Dropdown / Card */}
      {showFormatGuide && (
        <div className="rounded-xl border border-surface-border bg-surface-card/60 p-5 backdrop-blur-md animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-brand-yellow font-semibold text-sm">
              <Info className="w-4 h-4" />
              <span>Expected CSV Structure</span>
            </div>
            <button
              onClick={() => setShowFormatGuide(false)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-xs text-slate-300">
            <div>
              <p className="font-semibold text-slate-200 mb-2">Required & Optional Columns:</p>
              <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                <li><code className="text-brand-yellow font-mono">prompt</code>: The input question or instruction (Required).</li>
                <li><code className="text-brand-yellow font-mono">response</code>: The response generated by the model/bot (Required).</li>
                <li><code className="text-brand-yellow font-mono">reference</code>: Optional ground-truth evidence or source premise for Vectara HHEM cross-encoding.</li>
              </ul>
              <p className="text-[11px] text-slate-500 mt-2">
                * If <code>reference</code> is omitted, VeriFA AI uses <code>prompt</code> as the premise fallback to evaluate factual alignment.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-200 mb-2">CSV Example:</p>
              <pre className="p-3 rounded-lg bg-surface-darkest border border-surface-border font-mono text-[11px] text-slate-300 overflow-x-auto">
{`prompt,response,reference
"What is the capital of France?","Paris is the capital of France.","Paris is the capital of France."
"Who invented the internet?","The internet was created in 1990 by one person.","The internet was developed by multiple teams starting with ARPANET."`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Upload & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Run Card (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-surface-border bg-surface-card/40 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-yellow" />
                <h2 className="text-base font-semibold text-white">Upload Benchmark CSV</h2>
              </div>
              <span className="text-xs text-slate-400">Max 500 rows · Max 5MB</span>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-brand-yellow bg-brand-yellow/5'
                  : file
                  ? 'border-brand-emerald/40 bg-brand-emerald/5'
                  : 'border-surface-border hover:border-slate-500 bg-surface-darkest/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-brand-emerald/20 border border-brand-emerald/40 flex items-center justify-center text-brand-emerald">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-200">{file.name}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    {(file.size / 1024).toFixed(1)} KB · Ready for evaluation
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 mt-1 underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    Drag and drop your CSV dataset here, or <span className="text-brand-yellow underline">browse</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Standard comma-delimited .csv files with header row
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Optional Chatbot Connector Dropdown */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-slate-400" />
                  <span>Associated Chatbot (Optional)</span>
                </label>
                <select
                  value={selectedChatbotId}
                  onChange={(e) => setSelectedChatbotId(e.target.value)}
                  disabled={loadingChatbots || uploading || isProcessing}
                  className="w-full bg-surface-darkest border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow"
                >
                  <option value="">None (Evaluate offline CSV responses directly)</option>
                  {chatbots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name} ({bot.endpoint_url})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tag which bot generated these responses or run evaluations offline.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-yellow" />
                  <span>Model Engine</span>
                </label>
                <div className="p-2.5 rounded-lg bg-surface-darkest border border-surface-border text-xs text-slate-300 flex items-center justify-between">
                  <span className="font-mono text-[11px]">vectara/hallucination_evaluation_model</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-emerald/10 text-brand-emerald font-semibold border border-brand-emerald/20">
                    Cross-Encoder Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-6 pt-4 border-t border-surface-border flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {file ? `1 file selected (${file.name})` : 'No file selected'}
            </div>
            <button
              onClick={handleStartBatch}
              disabled={!file || uploading || isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-yellow text-black font-semibold text-xs hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-yellow"
            >
              {uploading || isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploading ? 'Uploading...' : 'Evaluating Batch...'}</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Start Batch Evaluation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recent Batch Runs Sidebar (1 col) */}
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Batch Runs</h2>
            <button
              onClick={fetchRecentJobs}
              disabled={loadingJobs}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingJobs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[320px] pr-1">
            {recentJobs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No previous batch evaluations found.
              </div>
            ) : (
              recentJobs.map((job) => {
                const isSelected = currentJobId === job.id;
                return (
                  <div
                    key={job.id}
                    onClick={() => handleSelectJob(job.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-yellow/40 bg-surface-card text-white'
                        : 'border-surface-border bg-surface-darkest/40 hover:bg-surface-card text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate max-w-[140px]" title={job.file_name}>
                        {job.file_name || 'Batch Job'}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
                          job.status === 'completed'
                            ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20'
                            : job.status === 'processing'
                            ? 'bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{job.completed_cases} / {job.total_cases} evaluated</span>
                      <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Real-time Progress Bar & Status (Shown when active or completed) */}
      {jobProgress && (
        <div className="rounded-2xl border border-surface-border bg-surface-card/60 p-6 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  Batch Execution Progress
                </span>
                <span className="text-xs font-mono text-slate-400">
                  (Job: {jobProgress.job_id.slice(0, 8)}...)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {jobProgress.status === 'completed'
                  ? 'All test cases evaluated with Vectara HHEM.'
                  : jobProgress.status === 'processing'
                  ? `Processing cases with Vectara HHEM... (${jobProgress.completed_cases} of ${jobProgress.total_cases})`
                  : 'Batch initialized...'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xl font-bold font-mono text-brand-yellow">
                {jobProgress.progress_percentage.toFixed(0)}%
              </span>
              {jobProgress.status === 'completed' && (
                <button
                  onClick={() => handleDownloadReport(jobProgress.job_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-emerald/10 border border-brand-emerald/30 text-brand-emerald hover:bg-brand-emerald/20 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV Report</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress track */}
          <div className="w-full h-3 rounded-full bg-surface-darkest overflow-hidden border border-surface-border">
            <div
              className={`h-full transition-all duration-300 ${
                jobProgress.status === 'completed'
                  ? 'bg-brand-emerald'
                  : jobProgress.status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-brand-yellow'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, jobProgress.progress_percentage))}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Analytics Cards */}
      {jobDetail && jobDetail.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-surface-border bg-surface-card/40">
            <div className="text-xs text-slate-400 font-medium">Total Cases</div>
            <div className="text-2xl font-bold text-white mt-1 font-mono">
              {jobDetail.summary.total_cases}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {jobDetail.summary.completed_cases} success · {jobDetail.summary.failed_cases} errors
            </div>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface-card/40">
            <div className="text-xs text-slate-400 font-medium">Avg Factual Consistency</div>
            <div className="text-2xl font-bold text-brand-yellow mt-1 font-mono">
              {jobDetail.summary.average_hhem_score !== null
                ? `${(jobDetail.summary.average_hhem_score * 100).toFixed(1)}%`
                : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Score across all rows
            </div>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface-card/40">
            <div className="text-xs text-slate-400 font-medium">Risk Breakdown</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20">
                {jobDetail.summary.risk_breakdown.low} Low
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20">
                {jobDetail.summary.risk_breakdown.medium} Med
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                {jobDetail.summary.risk_breakdown.high} High
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5">
              Hallucination risk levels
            </div>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface-card/40">
            <div className="text-xs text-slate-400 font-medium">Execution Time</div>
            <div className="text-2xl font-bold text-slate-200 mt-1 font-mono">
              {jobDetail.summary.total_latency_seconds.toFixed(2)}s
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Total batch turnaround
            </div>
          </div>
        </div>
      )}

      {/* Detailed Results Table */}
      {jobDetail && jobDetail.results && (
        <div className="rounded-2xl border border-surface-border bg-surface-card/40 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">Batch Evaluation Results</h2>
              <p className="text-xs text-slate-400">
                Individual per-row consistency scores and hallucination classifications.
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search prompts or answers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-surface-darkest border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-yellow w-56"
                />
              </div>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-surface-darkest border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-yellow"
              >
                <option value="all">All Risks ({jobDetail.results.length})</option>
                <option value="low">Low Risk ({jobDetail.summary.risk_breakdown.low})</option>
                <option value="medium">Medium Risk ({jobDetail.summary.risk_breakdown.medium})</option>
                <option value="high">High Risk ({jobDetail.summary.risk_breakdown.high})</option>
                <option value="error">Errors ({jobDetail.summary.failed_cases})</option>
              </select>

              <button
                onClick={() => handleDownloadReport(jobDetail.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-darkest hover:bg-surface-hover text-xs font-semibold text-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-brand-yellow" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-darkest/70 border-b border-surface-border text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Prompt</th>
                  <th className="py-3 px-4 min-w-[240px]">Chatbot Response</th>
                  <th className="py-3 px-4 min-w-[180px]">Reference / Evidence</th>
                  <th className="py-3 px-4 w-32">Consistency Score</th>
                  <th className="py-3 px-4 w-28">Hallucination Risk</th>
                  <th className="py-3 px-4 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-300">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      No rows match the search query or risk filter.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((row) => (
                    <tr key={row.row_index} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {row.row_index}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div className="max-h-20 overflow-y-auto pr-1">
                          {row.prompt}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="max-h-20 overflow-y-auto pr-1 font-sans">
                          {row.response}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 italic">
                        <div className="max-h-20 overflow-y-auto pr-1 font-sans">
                          {row.reference || <span className="text-slate-600 not-italic">(Fallback to prompt)</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {row.hhem_score !== null ? (
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-white text-sm">
                              {(row.hhem_score * 100).toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {row.hhem_score.toFixed(4)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.risk_level === 'low' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                            Low Risk
                          </span>
                        )}
                        {row.risk_level === 'medium' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />
                            Med Risk
                          </span>
                        )}
                        {row.risk_level === 'high' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            High Risk
                          </span>
                        )}
                        {row.risk_level === 'unknown' && (
                          <span className="text-slate-500 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.status === 'success' ? (
                          <span className="text-brand-emerald flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1" title={row.error_message}>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
