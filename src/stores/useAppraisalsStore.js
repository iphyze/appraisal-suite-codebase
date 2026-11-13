import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import useToastStore from './useToastStore';
import api from '../services/api';

const authHeader = () => ({}); // Session is sent securely via HttpOnly cookie.

const cleanParams = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });

  return searchParams.toString();
};

const useAppraisalsStore = create((set) => ({
  appraisals: [],
  candidates: [],
  current: null,
  formData: null,
  meta: { total: 0, page: 1, limit: 10, total_pages: 1 },
  candidateMeta: { total: 0, page: 1, limit: 10, total_pages: 1 },
  loading: true,
  formLoading: false,
  saving: false,
  onboardingLoading: false,
  error: null,

  fetchAppraisals: async (params = {}) => {
    set({ loading: true, error: null });

    try {
      const query = cleanParams(params);
      const response = await api.get(`/appraisals/list${query ? `?${query}` : ''}`, { headers: authHeader() });

      set({ appraisals: response.data?.data || [], meta: response.data?.meta || {}, loading: false });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to fetch appraisals';

      set({ loading: false, error: message });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  fetchCandidates: async (params = {}) => {
    set({ loading: true, error: null });

    try {
      const query = cleanParams(params);
      const response = await api.get(`/appraisals/candidates${query ? `?${query}` : ''}`, { headers: authHeader() });

      set({ candidates: response.data?.data || [], candidateMeta: response.data?.meta || {}, loading: false });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to fetch appraisal candidates';

      set({ candidates: [], loading: false, error: message });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  fetchFormData: async (params = {}) => {
    set({ formLoading: true, error: null });

    try {
      const query = cleanParams(params);
      const response = await api.get(`/appraisals/form-data${query ? `?${query}` : ''}`, { headers: authHeader() });

      set({ formData: response.data?.data || null, formLoading: false });

      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to fetch appraisal form data';

      set({ formData: null, formLoading: false, error: message });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  fetchSingleAppraisal: async (id) => {
    const appraisalId = Number(id);

    if (!Number.isInteger(appraisalId) || appraisalId <= 0) {
      const message = 'Invalid appraisal reference. Please open the appraisal from the list.';
      set({ current: null, formLoading: false, error: message });
      return { success: false, message };
    }

    set({ formLoading: true, error: null });

    try {
      const response = await api.get(`/appraisals/single?id=${appraisalId}`, { headers: authHeader() });

      set({ current: response.data?.data || null, formLoading: false });

      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to fetch appraisal';

      set({ current: null, formLoading: false, error: message });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  createAppraisal: async (payload) => {
    set({ saving: true });

    try {
      const response = await api.post('/appraisals/create', payload, { headers: authHeader() });

      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Appraisal created successfully', 'success');

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to create appraisal';

      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  updateAppraisal: async (payload) => {
    set({ saving: true });

    try {
      const response = await api.put('/appraisals/update', payload, { headers: authHeader() });

      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Appraisal updated successfully', 'success');

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to update appraisal';

      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  restoreAppraisalUpdates: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.post('/appraisals/restore-updates', payload, { headers: authHeader() });
      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Update attempts restored', 'success');
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to restore update attempts';
      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  onboardSupervisor: async (payload = {}) => {
    set({ onboardingLoading: true, error: null });

    try {
      const response = await api.post('/supervisors/onboard', payload, { headers: authHeader() });

      set({ onboardingLoading: false });
      useToastStore.getState().showToast(response.data?.message || 'Onboarding completed successfully', 'success');

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to complete onboarding';

      set({ onboardingLoading: false, error: message });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },

  submitFeedback: async (payload) => {
    set({ saving: true });

    try {
      const response = await api.put('/appraisals/submit-feedback', payload, { headers: authHeader() });

      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Feedback submitted successfully', 'success');

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to submit feedback';

      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },


  saveManagementReview: async (payload) => {
    set({ saving: true });

    try {
      const response = await api.post('/appraisals/management-review', payload, { headers: authHeader() });

      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Management review saved successfully', 'success');

      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to save management review';

      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },


  verifySeriousBreach: async (payload) => {
    set({ saving: true });
    try {
      const response = await api.post('/appraisals/verify-breach', payload, { headers: authHeader() });
      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Safety decision recorded', 'success');
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to record safety decision';
      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  respondManagementFollowUp: async (payload) => {
    set({ saving: true });

    try {
      const response = await api.post('/appraisals/management-follow-up-response', payload, { headers: authHeader() });

      set({ saving: false });
      useToastStore.getState().showToast(response.data?.message || 'Follow-up response sent to management', 'success');

      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to send follow-up response';

      set({ saving: false });
      useToastStore.getState().showToast(message, 'error');

      return { success: false, message };
    }
  },
}));

export default useAppraisalsStore;
