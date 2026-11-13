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

const useGeneralQuestionsStore = create((set) => ({
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

  fetchGeneralQuestions: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/general-questions/list${buildQuery(params)}`, {
        headers: authHeader(),
      });
      set({
        questions: response.data?.data || [],
        meta: response.data?.meta || { total: 0, page: 1, limit: params.limit || 10, total_pages: 1 },
        loading: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = toastError('Failed to fetch general questions', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  fetchGeneralQuestionGroups: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/general-questions/groups${buildQuery(params)}`, {
        headers: authHeader(),
      });
      set({
        questionGroups: response.data?.data || [],
        groupMeta: response.data?.meta || { total: 0, total_questions: 0, page: 1, limit: params.limit || 10, total_pages: 1 },
        loading: false,
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = toastError('Failed to fetch general question sets', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  fetchGeneralQuestionGroup: async (id) => {
    set({ loading: true, error: null, selectedQuestionGroup: null });
    try {
      const response = await api.get(`/general-questions/group?id=${id}`, {
        headers: authHeader(),
      });
      set({ selectedQuestionGroup: response.data?.data || null, loading: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to fetch general question set', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  fetchSingleGeneralQuestion: async (id) => {
    set({ loading: true, error: null, selectedQuestion: null });
    try {
      const response = await api.get(`/general-questions/single?id=${id}`, {
        headers: authHeader(),
      });
      set({ selectedQuestion: response.data?.data || null, loading: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to fetch general question', error);
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  createGeneralQuestion: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.post('/general-questions/create', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(response.data?.message || 'General question created successfully', 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to create general question', error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  bulkCreateGeneralQuestions: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.post('/general-questions/bulk-create', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(localizedQuestionMessage('form_general_questions_created', response.data?.message || i18n.t('form_general_questions_created', { ns: 'questions' })), 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError(i18n.t('form_general_questions_create_failed', { ns: 'questions' }), error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  updateGeneralQuestion: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.put('/general-questions/update', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(response.data?.message || 'General question updated successfully', 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError('Failed to update general question', error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  bulkUpdateGeneralQuestions: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.put('/general-questions/bulk-update', payload, {
        headers: authHeader(),
      });
      useToastStore.getState().showToast(localizedQuestionMessage('form_general_questions_saved', response.data?.message || i18n.t('form_general_questions_saved', { ns: 'questions' })), 'success');
      set({ saving: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = toastError(i18n.t('form_general_questions_save_failed', { ns: 'questions' }), error);
      set({ saving: false });
      return { success: false, message };
    }
  },

  deleteGeneralQuestions: async (ids = []) => {
    set({ deleting: true });
    try {
      const response = await api.delete('/general-questions/delete', {
        headers: authHeader(),
        data: { ids },
      });
      useToastStore.getState().showToast(response.data?.message || 'General question deleted successfully', 'success');
      set({ deleting: false });
      return { success: true, data: response.data };
    } catch (error) {
      const message = toastError('Failed to delete general question', error);
      set({ deleting: false });
      return { success: false, message };
    }
  },

  clearSelectedQuestion: () => set({ selectedQuestion: null }),
  clearSelectedQuestionGroup: () => set({ selectedQuestionGroup: null }),
}));

export default useGeneralQuestionsStore;
