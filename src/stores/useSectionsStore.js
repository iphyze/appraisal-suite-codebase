import { create } from 'zustand';
import api from '../services/api';
import useToastStore from './useToastStore';

const getMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const useSectionsStore = create((set, get) => ({
  data: [],
  meta: null,
  loading: false,
  error: null,

  singleSection: null,
  fetchingSingle: false,
  singleSectionError: null,

  fetchSections: async ({ cycleId, page = 1, limit = 100, type = '', isActive = '', search = '', sortBy = 'sort_order', sortOrder = 'ASC' } = {}) => {
    set({ loading: true, error: null });

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });

      if (cycleId) params.append('cycle_id', cycleId);
      if (type) params.append('type', type);
      if (isActive !== '') params.append('is_active', isActive);
      if (search) params.append('search', search);

      const response = await api.get(`/sections/list?${params.toString()}`);
      set({ data: response.data?.data || [], meta: response.data?.meta || null, loading: false });
      return { success: true, data: response.data?.data || [], meta: response.data?.meta || null };
    } catch (error) {
      const message = getMessage(error, 'Failed to fetch sections');
      set({ loading: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  fetchSingleSection: async (id) => {
    set({ fetchingSingle: true, singleSectionError: null, singleSection: null });
    try {
      const response = await api.get(`/sections/single?id=${encodeURIComponent(id)}`);
      set({ singleSection: response.data?.data || null, fetchingSingle: false });
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = getMessage(error, 'Failed to fetch section');
      set({ fetchingSingle: false, singleSectionError: message, singleSection: null });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  clearSingleSection: () => set({ singleSection: null, singleSectionError: null }),

  createSection: async (payload) => {
    try {
      const response = await api.post('/sections/create', payload);
      useToastStore.getState().showToast(response.data?.message || 'Section created successfully', 'success');
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = getMessage(error, 'Failed to create section');
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  updateSection: async (payload) => {
    try {
      const response = await api.put('/sections/update', payload);
      useToastStore.getState().showToast(response.data?.message || 'Section updated successfully', 'success');
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = getMessage(error, 'Failed to update section');
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  deleteSections: async (ids, refreshArgs) => {
    const safeIds = Array.isArray(ids) ? ids : [ids];
    if (!safeIds.length) return { success: false, message: 'No section selected' };

    try {
      const response = await api.delete('/sections/delete', { data: { ids: safeIds } });
      useToastStore.getState().showToast(response.data?.message || 'Section deleted successfully', 'success');
      if (refreshArgs) await get().fetchSections(refreshArgs);
      return { success: true, data: response.data?.data };
    } catch (error) {
      const message = getMessage(error, 'Failed to delete section');
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  clearSections: () => set({ data: [], meta: null, error: null }),
}));

export default useSectionsStore;
