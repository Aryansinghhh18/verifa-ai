import api from './client';

/**
 * TestLab API Service
 * Encapsulates backend calls for TestLab suite definitions, configuration validation,
 * execution orchestration, progress telemetry, results history, and report exports.
 */

export const getTestSuites = async () => {
  const response = await api.get('/testlab/suites');
  return response.data;
};

export const getDatasetPreview = async () => {
  const response = await api.get('/testlab/dataset-preview');
  return response.data;
};

export const validateTestRunConfig = async (config) => {
  const response = await api.post('/testlab/validate-config', config);
  return response.data;
};

export const startTestRun = async (config) => {
  const response = await api.post('/testlab/start', config);
  return response.data;
};

export const getTestRunProgress = async (runId) => {
  const response = await api.get(`/testlab/runs/${runId}/progress`);
  return response.data;
};

export const getTestRunDetail = async (runId) => {
  const response = await api.get(`/testlab/runs/${runId}`);
  return response.data;
};

export const getTestRunHistory = async () => {
  const response = await api.get('/testlab/runs');
  return response.data;
};

export const cancelTestRun = async (runId) => {
  const response = await api.post(`/testlab/runs/${runId}/cancel`);
  return response.data;
};

export const downloadReportPdf = async (runId, chatbotName = 'Chatbot') => {
  const response = await api.get(`/testlab/runs/${runId}/report/pdf`, {
    responseType: 'blob',
  });
  const safeName = chatbotName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `VeriFa_TestLab_Report_${safeName}_${runId.substring(0, 8)}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadReportCsv = async (runId, chatbotName = 'Chatbot') => {
  const response = await api.get(`/testlab/runs/${runId}/report/csv`, {
    responseType: 'blob',
  });
  const safeName = chatbotName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `VeriFa_TestLab_Results_${safeName}_${runId.substring(0, 8)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadReportJson = async (runId, chatbotName = 'Chatbot') => {
  const response = await api.get(`/testlab/runs/${runId}/report/json`, {
    responseType: 'blob',
  });
  const safeName = chatbotName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `VeriFa_TestLab_Report_${safeName}_${runId.substring(0, 8)}.json`);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};
