import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import useToastStore from './useToastStore';
import api from '../services/api';
import i18n from '../i18n';

const localizedQuestionMessage = (key, englishMessage) => (i18n.language === 'fr'
  ? i18n.t(key, { ns: 'questions' }) : englishMessage);

const authHeader = () => ({}); // Session is sent securely via HttpOnly cookie.

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, value);
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

const toastError = (fallback, error) => {
  const message = error.response?.data?.message || error.message || fallback;
  useToastStore.getState().showToast(message, 'error');
  return message;
};

const useKpiQuestionsStore = create((set) => ({
  questions: [],
  questionGroups: [],
  selectedQuestion: null,
  selectedQuestionGroup: null,
  meta: { total: 0, page: 1, limit: 10, total_pages: 1 },
  groupMeta: { total: 0, total_questions: 0, page: 1, limit: 10, total_pages: 1 },
  loading: true,
  saving: false,
  deleting: false,
  error: null,

  fetchKpiQuestions: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/kpi-questions/list${buildQuery(params)}`, {
        headers: authHeader(),
      });
      set({
        questions: response.data?.data || [],
        meta: response.data?.meta || { total: 0, page: 1, limit: params.limit || 10, total_pages: 1 },
        loading: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = toastError('Failed to fetch KPI questions', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  fetchKpiQuestionGroups: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/kpi-questions/groups${buildQuery(params)}`, {
        headers: authHeader(),
      });
      set({
        questionGroups: response.data?.data || [],
        groupMeta: response.data?.meta || { total: 0, total_questions: 0, page: 1, limit: params.limit || 10, total_pages: 1 },
        loading: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = toastError('Failed to fetch KPI question sets', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  fetchKpiQuestionGroup: async (id) => {
    set({ loading: true, error: null, selectedQuestionGroup: null });
    try {
      const response = await api.get(`/kpi-questions/group?id=${id}`, {
        headers: authHeader(),
      });
      set({ selectedQuestionGroup: response.data?.data || null, loading: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to fetch KPI question set', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  fetchSingleKpiQuestion: async (id) => {
    set({ loading: true, error: null, selectedQuestion: null });
    try {
      const response = await api.get(`/kpi-questions/single?id=${id}`, {
        headers: authHeader(),
      });
      set({ selectedQuestion: response.data?.data || null, loading: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to fetch KPI question', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  createKpiQuestion: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.post('/kpi-questions/create', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(response.data?.message || 'KPI question created successfully', 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to create KPI question', error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  bulkCreateKpiQuestions: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.post('/kpi-questions/bulk-create', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(localizedQuestionMessage('form_kpi_questions_created', response.data?.message || i18n.t('form_kpi_questions_created', { ns: 'questions' })), 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError(i18n.t('form_kpi_questions_create_failed', { ns: 'questions' }), error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  updateKpiQuestion: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.put('/kpi-questions/update', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(response.data?.message || 'KPI question updated successfully', 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to update KPI question', error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  bulkUpdateKpiQuestions: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.put('/kpi-questions/bulk-update', payload, {
        headers: authHeader(),
      });
      const deactivated = Number(response.data?.deactivated_count || 0);
      const savedMessage = localizedQuestionMessage('form_kpi_questions_saved', response.data?.message || i18n.t('form_kpi_questions_saved', { ns: 'questions' }));
      useToastStore.getState().showToast(deactivated > 0
        ? `${i18n.t('form_kpi_questions_saved', { ns: 'questions' })} ${i18n.t('form_kpi_deactivated_notice', { ns: 'questions', count: deactivated })}`
        : savedMessage, 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError(i18n.t('form_kpi_questions_save_failed', { ns: 'questions' }), error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  deleteKpiQuestions: async (ids = []) => {
    set({ deleting: true });
    try {
      const response = await api.delete('/kpi-questions/delete', {
        headers: authHeader(),
        data: { ids },
      });
      const deactivated = Number(response.data?.data?.deactivated_count || 0);
      const deleted = Number(response.data?.data?.deleted_count || 0);
      useToastStore.getState().showToast(deactivated > 0
        ? i18n.t('form_kpi_removed_notice', { ns: 'questions', deleted, deactivated })
        : (response.data?.message || 'KPI question deleted successfully'), 'success');
      set({ deleting: false });
      return { success: true, data: response.data };
    } catch (error) {
      const message = toastError('Failed to delete KPI question', error);
      set({ deleting: false });
      return { success: false, message };
    }
  },

  clearSelectedQuestion: () => set({ selectedQuestion: null }),
  clearSelectedQuestionGroup: () => set({ selectedQuestionGroup: null }),
}));

export default useKpiQuestionsStore;
