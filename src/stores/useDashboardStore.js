import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import useAuthStore from './useAuthStore';
import useToastStore from './useToastStore';
import api from '../services/api';
import i18n from '../i18n';

const authHeader = () => ({}); // Session is sent securely via HttpOnly cookie.

const useDashboardStore = create(
  persist(
    (set, get) => ({
      data: null,
      loading: true,
      error: null,
      onboardingLoading: false,
      feedbackLoading: false,
      cycleId: '',
      viewCompanyId: '',

      fetchDashboardData: async (
        nextCycleId = get().cycleId,
        nextViewCompanyId = get().viewCompanyId
      ) => {
        set({ loading: true, error: null });

        try {
          const params = new URLSearchParams();
          if (nextCycleId) params.append('cycle_id', nextCycleId);
          if (nextViewCompanyId) params.append('view_company_id', nextViewCompanyId);

          const query = params.toString();
          const response = await api.get(`/dashboard${query ? `?${query}` : ''}`, {
            headers: authHeader(),
          });

          set({
            data: response.data,
            loading: false,
            error: null,
            cycleId: nextCycleId || '',
            viewCompanyId: nextViewCompanyId || '',
          });

          return { success: true, data: response.data };
        } catch (error) {
          const message = error.response?.data?.message || error.message || i18n.t('toast.dashboardFailed', { ns: 'dashboard' });
          set({ error: message, loading: false });
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      setCycleId: (cycleId) => {
        set({ cycleId });
        return get().fetchDashboardData(cycleId, get().viewCompanyId);
      },

      clearCycleId: () => {
        set({ cycleId: '' });
        return get().fetchDashboardData('', get().viewCompanyId);
      },

      setViewCompanyId: (viewCompanyId) => {
        set({ viewCompanyId });
        return get().fetchDashboardData(get().cycleId, viewCompanyId);
      },

      clearViewCompanyId: () => {
        set({ viewCompanyId: '' });
        return get().fetchDashboardData(get().cycleId, '');
      },

      onboardSupervisor: async (payload = {}) => {
        set({ onboardingLoading: true });
        try {
          const response = await api.post('/supervisors/onboard', payload, {
            headers: authHeader(),
          });

          useToastStore.getState().showToast(response.data?.message || i18n.t('toast.onboardingCompleted', { ns: 'dashboard' }), 'success');
          await get().fetchDashboardData();
          set({ onboardingLoading: false });
          return { success: true, data: response.data };
        } catch (error) {
          const message = error.response?.data?.message || error.message || i18n.t('toast.onboardingFailed', { ns: 'dashboard' });
          set({ onboardingLoading: false });
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      submitAppraisalFeedback: async (appraisalId, feedback, acknowledged = false) => {
        set({ feedbackLoading: true });
        try {
          const response = await api.put('/appraisals/submit-feedback', {
            id: appraisalId,
            feedback,
            acknowledged,
          }, {
            headers: authHeader(),
          });

          useToastStore.getState().showToast(response.data?.message || i18n.t('toast.feedbackSubmitted', { ns: 'dashboard' }), 'success');
          await get().fetchDashboardData();
          set({ feedbackLoading: false });
          return { success: true, data: response.data };
        } catch (error) {
          const message = error.response?.data?.message || error.message || i18n.t('toast.feedbackFailed', { ns: 'dashboard' });
          set({ feedbackLoading: false });
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },
    }),
    {
      name: 'appraisal-dashboard-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cycleId: state.cycleId,
        viewCompanyId: state.viewCompanyId,
      }),
    }
  )
);

export default useDashboardStore;
