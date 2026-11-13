import { create } from 'zustand';
import api from '../services/api';
import useToastStore from './useToastStore';

const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const useObjectivePlansStore = create((set) => ({
  data: null,
  loading: false,
  saving: false,
  error: null,

  fetchObjectivePlan: async ({ staffUserId, sectionId }) => {
    set({ loading: true, error: null, data: null });
    try {
      const params = new URLSearchParams({
        staff_user_id: String(staffUserId),
        section_id: String(sectionId),
      });
      const response = await api.get(`/objective-plans/get?${params.toString()}`);
      const data = response.data?.data || null;
      set({ data, loading: false });
      return { success: true, data };
    } catch (error) {
      const message = errorMessage(error, 'Unable to load objective setup.');
      set({ loading: false, error: message, data: null });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  saveObjectivePlan: async (payload) => {
    set({ saving: true, error: null });
    try {
      const response = await api.post('/objective-plans/save', payload);
      const data = response.data?.data || null;
      set({ saving: false, data });
      useToastStore.getState().showToast(response.data?.message || 'Objective plan saved successfully.', 'success');
      return { success: true, data };
    } catch (error) {
      const message = errorMessage(error, 'Unable to save objective plan.');
      set({ saving: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  unlockObjectivePlan: async ({ staffUserId, sectionId }) => {
    set({ saving: true, error: null });
    try {
      const response = await api.post('/objective-plans/unlock', {
        staff_user_id: Number(staffUserId),
        section_id: Number(sectionId),
      });
      const data = response.data?.data || null;
      set({ saving: false, data });
      useToastStore.getState().showToast(response.data?.message || 'Objective plan unlocked.', 'success');
      return { success: true, data };
    } catch (error) {
      const message = errorMessage(error, 'Unable to unlock objective plan.');
      set({ saving: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  clearObjectivePlan: () => set({ data: null, error: null, loading: false, saving: false }),
}));

export default useObjectivePlansStore;
