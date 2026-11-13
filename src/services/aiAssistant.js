import api from './api';

import { makeRequestId } from '../utils/requestId';

export { makeRequestId };

// The assistant sends chat context only. All roles and data access come from the backend;
// the backend derives permissions from the authenticated session.
// Global navigation status. Display-only; PHP enforces permissions for every AI request.
export const getAiNavigationAvailability = async () => {
  const response = await api.get('/ai/navigation', { skipRetry: true });
  return response.data?.data?.features || {};
};

export const getAiAssistantStatus = async () => {
  const response = await api.get('/ai/status', { skipRetry: true });
  return response.data?.data;
};

export const askAiAssistant = async (message, history = [], conversationId = null, options = {}) => {
  const response = await api.post('/ai/ask', {
    message,
    ...(options.source ? { source: options.source } : {}),
    ...(conversationId ? { conversation_id: conversationId } : { history }),
    request_id: makeRequestId(),
  }, { skipRetry: true });
  return response.data?.data;
};

// Server-owned chat history; PHP validates user, role and selected company context.
export const listAiConversations = async (search = '') => {
  const response = await api.get('/ai/conversations', { params: { search }, skipRetry: true });
  return response.data?.data || [];
};
export const createAiConversation = async () => {
  const response = await api.post('/ai/conversations', {}, { skipRetry: true });
  return response.data?.data;
};
export const getAiConversationMessages = async (conversationId) => {
  const response = await api.get('/ai/conversations/messages', { params: { conversation_id: conversationId }, skipRetry: true });
  return response.data?.data || [];
};
export const renameAiConversation = async (conversationId, title) => {
  const response = await api.put('/ai/conversations', { conversation_id: conversationId, title }, { skipRetry: true });
  return response.data?.data;
};
export const deleteAiConversation = async (conversationId) => {
  const response = await api.delete('/ai/conversations', { data: { conversation_id: conversationId }, skipRetry: true });
  return response.data?.data;
};

// Super Admin only. Backend performs authorization for both calls.
export const getAiFeatureSettings = async () => {
  const response = await api.get('/ai/admin/features', { skipRetry: true });
  return response.data?.data;
};

export const updateAiFeatureSetting = async (feature, enabled, reason) => {
  const response = await api.put('/ai/admin/features', { feature, enabled, reason }, { skipRetry: true });
  return response.data?.data;
};

// Super Admin only: monthly token budget and usage by feature.
export const getAiBudget = async () => {
  const response = await api.get('/ai/admin/budget', { skipRetry: true });
  return response.data?.data;
};
export const updateAiBudget = async (monthlyTokenLimit, warnPercent, reason) => {
  const response = await api.put('/ai/admin/budget', {
    monthly_token_limit: monthlyTokenLimit, warn_percent: warnPercent, reason,
  }, { skipRetry: true });
  return response.data?.data;
};

// Analytics calculated inside AppraisalSuite (no AI tokens). PHP enforces switches and visibility.
export const getAiAnalytics = async (view, cycleId = 0, groupBy = 'department', department = '') => {
  const response = await api.get('/ai/analytics', {
    params: { view, cycle_id: cycleId || undefined, group_by: view === 'rankings' ? groupBy : undefined, department: view === 'progress' ? department || undefined : undefined },
    skipRetry: true,
  });
  return response.data?.data;
};

// Export all Analytics views enabled for this user and cycle, with server-side permissions.
// The request never invokes OpenAI and does not spend AI tokens.
export const downloadAiAnalyticsExcel = async (cycleId) => {
  const response = await api.get('/ai/analytics/excel', {
    params: { cycle_id: cycleId }, responseType: 'blob', skipRetry: true,
  });
  return response.data;
};

// ---- Stage 3 (token features). Each endpoint enforces its own switch, role and budget. ----
export const getAiFairnessStatus = async () => (await api.get('/ai/fairness-check', { skipRetry: true })).data?.data;
export const runAiFairnessCheck = async (draft) => (await api.post('/ai/fairness-check', { ...draft, request_id: makeRequestId() }, { skipRetry: true })).data?.data;

export const getAiBriefing = async (cycleId = 0) => (await api.get('/ai/briefing', { params: { cycle_id: cycleId || undefined }, skipRetry: true })).data?.data;
export const generateAiBriefing = async (cycleId, refresh = false) => (await api.post('/ai/briefing', { cycle_id: cycleId, refresh, request_id: makeRequestId() }, { skipRetry: true })).data?.data;

export const getAiFeedbackSummary = async (cycleId = 0) => (await api.get('/ai/feedback-summary', { params: { cycle_id: cycleId || undefined }, skipRetry: true })).data?.data;
export const generateAiFeedbackSummary = async (cycleId, refresh = false) => (await api.post('/ai/feedback-summary', { cycle_id: cycleId, refresh, request_id: makeRequestId() }, { skipRetry: true })).data?.data;

export const getAiExplanation = async (appraisalId) => (await api.get('/ai/explain', { params: { appraisal_id: appraisalId }, skipRetry: true })).data?.data;
export const generateAiExplanation = async (appraisalId, refresh = false) => (await api.post('/ai/explain', { appraisal_id: appraisalId, refresh, request_id: makeRequestId() }, { skipRetry: true })).data?.data;

export const draftAiReminder = async (details) => (await api.post('/ai/reminder-draft', { ...details, request_id: makeRequestId() }, { skipRetry: true })).data?.data;

// Management-only read-only aggregates. All visibility filters execute in PHP.
export const getAiManagementInsights = async (cycleId = 0) => {
  const response = await api.get('/ai/insights', { params: { cycle_id: cycleId }, skipRetry: true });
  return response.data?.data;
};

// Export exactly the same role- and company-scoped aggregate figures as the Insights page.
export const downloadAiManagementInsightsExcel = async (cycleId) => {
  const response = await api.get('/ai/insights/excel', {
    params: { cycle_id: cycleId }, responseType: 'blob', skipRetry: true,
  });
  return response.data;
};

export const generateAiManagementNarrative = async (cycleId, focus, refresh = false) => {
  const response = await api.post('/ai/insights', {
    cycle_id: cycleId, focus, request_id: makeRequestId(), ...(refresh ? { refresh: true } : {}),
  }, { skipRetry: true });
  return response.data?.data;
};

// Draft-only, user-initiated writing help. The backend enforces the feature switch and role.
export const getAiWritingStatus = async () => {
  const response = await api.get('/ai/writing', { skipRetry: true });
  return response.data?.data;
};

export const generateAiWritingDraft = async (details) => {
  const response = await api.post('/ai/writing', {
    ...details,
    request_id: makeRequestId(),
  }, { skipRetry: true });
  return response.data?.data;
};

// Human-reviewed development plan drafts. Nothing is written to employee records here.
export const getAiDevelopmentStatus = async () => {
  const response = await api.get('/ai/development-plan', { skipRetry: true });
  return response.data?.data;
};

export const generateAiDevelopmentPlan = async (details) => {
  const response = await api.post('/ai/development-plan', {
    ...details, request_id: makeRequestId(),
  }, { skipRetry: true });
  return response.data?.data;
};

// Configuration guidance, available only within the user's existing creation rights.
export const getAiSetupGuideStatus = async () => {
  const response = await api.get('/ai/setup-guide', { skipRetry: true });
  return response.data?.data;
};
export const generateAiSetupGuide = async (details) => {
  const response = await api.post('/ai/setup-guide', { ...details, request_id: makeRequestId() }, { skipRetry: true });
  return response.data?.data;
};

// KPI guidance stays in the objective form; the user edits and saves all fields manually.
export const getAiKpiSuggestionsStatus = async () => {
  const response = await api.get('/ai/kpi-suggestions', { skipRetry: true });
  return response.data?.data;
};

export const generateAiKpiSuggestions = async (details) => {
  const response = await api.post('/ai/kpi-suggestions', {
    ...details, request_id: makeRequestId(),
  }, { skipRetry: true });
  return response.data?.data;
};

// Read-only deterministic search interpretation. Backend verifies the user's role and company.
export const interpretSmartSearch = async (query, options = {}) => {
  const response = await api.get('/search/interpret', {
    params: { q: query },
    signal: options.signal,
    skipRetry: true,
  });
  return response.data?.data?.result || null;
};

// Batch 11: the server looks up the actual stored note after its appraisal-
// detail authorization check. Never send free text or an author name here.
export const getAiFreeTextTranslationStatus = async () =>
  (await api.get('/ai/translate-free-text', { skipRetry: true })).data?.data;

export const translateAppraisalFreeText = async ({ appraisalId, field, recordId = 0, locale }) =>
  (await api.post('/ai/translate-free-text', {
    appraisal_id: Number(appraisalId), field, record_id: Number(recordId),
    target_locale: locale, request_id: makeRequestId(),
  }, { skipRetry: true })).data?.data;
