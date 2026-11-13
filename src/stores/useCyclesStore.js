import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../services/api';
import useToastStore from './useToastStore';

const getMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const useCyclesStore = create(
  persist(
    (set, get) => ({
      data: [],
      meta: null,
      loading: true,
      deleting: false,
      error: null,
      selectedItems: [],

      singleCycle: null,
      fetchingSingle: false,
      singleCycleError: null,

      scoringConfig: null,
      scoringConfigLoading: false,
      scoringConfigError: null,

      currentPage: 1,
      itemsPerPage: 10,
      searchQuery: '',
      activeFilter: '',
      yearFilter: '',
      sortBy: 'year',
      sortOrder: 'DESC',

      fetchCycles: async () => {
        const {
          currentPage,
          itemsPerPage,
          searchQuery,
          activeFilter,
          yearFilter,
          sortBy,
          sortOrder,
        } = get();

        set({ loading: true, error: null });

        try {
          const params = new URLSearchParams({
            page: String(currentPage),
            limit: String(itemsPerPage),
            sortBy,
            sortOrder,
          });

          if (searchQuery) params.append('search', searchQuery);
          if (activeFilter !== '') params.append('is_active', activeFilter);
          if (yearFilter) params.append('year', yearFilter);

          const response = await api.get(`/cycles/list?${params.toString()}`);

          set({
            data: response.data?.data || [],
            meta: response.data?.meta || null,
            currentPage: response.data?.meta?.page || currentPage,
            itemsPerPage: response.data?.meta?.limit || itemsPerPage,
            loading: false,
          });
        } catch (error) {
          const message = getMessage(error, 'Failed to fetch appraisal cycles');
          set({ loading: false, error: message });
          useToastStore.getState().showToast(message, 'error');
        }
      },

      fetchSingleCycle: async (id) => {
        set({ fetchingSingle: true, singleCycleError: null, singleCycle: null });
        try {
          const response = await api.get(`/cycles/single?id=${encodeURIComponent(id)}`);
          set({ singleCycle: response.data?.data || null, fetchingSingle: false });
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, 'Failed to fetch appraisal cycle');
          set({ fetchingSingle: false, singleCycleError: message, singleCycle: null });
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      clearSingleCycle: () => set({ singleCycle: null, singleCycleError: null }),

      fetchScoringConfig: async (cycleId) => {
        set({ scoringConfig: null, scoringConfigLoading: true, scoringConfigError: null });
        try {
          const response = await api.get(`/cycles/scoring-config?cycle_id=${encodeURIComponent(cycleId)}`);
          const config = response.data?.data || null;
          set({ scoringConfig: config, scoringConfigLoading: false });
          return { success: true, data: config };
        } catch (error) {
          const message = getMessage(error, 'Failed to fetch cycle scoring configuration');
          set({ scoringConfigLoading: false, scoringConfigError: message });
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      updateScoringConfig: async (payload) => {
        set({ scoringConfigLoading: true, scoringConfigError: null });
        try {
          const response = await api.put('/cycles/scoring-config', payload);
          const config = response.data?.data || null;
          set({ scoringConfig: config, scoringConfigLoading: false });
          useToastStore.getState().showToast(response.data?.message || 'Cycle scoring configuration updated successfully', 'success');
          return { success: true, data: config };
        } catch (error) {
          const message = getMessage(error, 'Failed to update cycle scoring configuration');
          set({ scoringConfigLoading: false, scoringConfigError: message });
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      clearScoringConfig: () => set({ scoringConfig: null, scoringConfigError: null }),

      createCycle: async (payload) => {
        try {
          const response = await api.post('/cycles/create', payload);
          useToastStore.getState().showToast(response.data?.message || 'Appraisal cycle created successfully', 'success');
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, 'Failed to create appraisal cycle');
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      updateCycle: async (payload) => {
        try {
          const response = await api.put('/cycles/update', payload);
          useToastStore.getState().showToast(response.data?.message || 'Appraisal cycle updated successfully', 'success');
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, 'Failed to update appraisal cycle');
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      deleteCycles: async (ids) => {
        const safeIds = Array.isArray(ids) ? ids.map(Number).filter((id) => id > 0) : [Number(ids)].filter((id) => id > 0);
        if (!safeIds.length) return { success: false, message: 'No cycle selected' };

        set({ deleting: true });

        try {
          const response = await api.delete('/cycles/delete', { data: { ids: safeIds } });
          useToastStore.getState().showToast(response.data?.message || 'Cycle deleted successfully', 'success');
          set({ selectedItems: [] });
          await get().fetchCycles();
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, 'Failed to delete appraisal cycle');
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message, data: error?.response?.data?.data };
        } finally {
          set({ deleting: false });
        }
      },

      copyCycle: async (payload) => {
        try {
          const response = await api.post('/cycles/copy', payload);
          const stats = response.data?.data?.stats || {};
          const copiedSummary = [
            Number(stats.sections_copied || 0) > 0 ? `${stats.sections_copied} section${Number(stats.sections_copied) === 1 ? '' : 's'}` : '',
            Number(stats.kpi_questions_copied || 0) > 0 ? `${stats.kpi_questions_copied} KPI question${Number(stats.kpi_questions_copied) === 1 ? '' : 's'}` : '',
            Number(stats.general_questions_copied || 0) > 0 ? `${stats.general_questions_copied} general question${Number(stats.general_questions_copied) === 1 ? '' : 's'}` : '',
            Number(stats.scoring_config_copied || 0) > 0 ? `scoring configuration${Number(stats.scoring_profiles_copied || 0) > 0 ? ` with ${stats.scoring_profiles_copied} profile${Number(stats.scoring_profiles_copied) === 1 ? '' : 's'}` : ''}` : '',
          ].filter(Boolean).join(', ');

          const skippedCount = Number(stats.kpi_questions_skipped || 0) + Number(stats.general_questions_skipped || 0);
          const message = copiedSummary
            ? `Copied ${copiedSummary}${skippedCount > 0 ? `; ${skippedCount} existing question${skippedCount === 1 ? '' : 's'} skipped` : ''}.`
            : (response.data?.message || 'Cycle setup is already up to date.');

          useToastStore.getState().showToast(message, 'success');
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, 'Failed to copy cycle');
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      setSearchQuery: (value) => set({ searchQuery: value, currentPage: 1 }),
      setActiveFilter: (value) => set({ activeFilter: value === undefined || value === null ? '' : value, currentPage: 1 }),
      setYearFilter: (value) => set({ yearFilter: value || '', currentPage: 1 }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setItemsPerPage: (limit) => set({ itemsPerPage: Number(limit) || 10, currentPage: 1 }),

      setSorting: (field) => {
        const { sortBy, sortOrder } = get();
        const nextOrder = sortBy === field && sortOrder === 'ASC' ? 'DESC' : 'ASC';
        set({ sortBy: field, sortOrder: nextOrder, currentPage: 1 });
      },

      clearFilters: () => set({ searchQuery: '', activeFilter: '', yearFilter: '', currentPage: 1 }),

      toggleItemSelection: (id) => {
        set((state) => ({
          selectedItems: state.selectedItems.includes(id)
            ? state.selectedItems.filter((item) => item !== id)
            : [...state.selectedItems, id],
        }));
      },

      setSelectedItems: (items) => set({ selectedItems: items }),
      clearSelection: () => set({ selectedItems: [] }),
    }),
    {
      name: 'appraisal-cycles-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        itemsPerPage: state.itemsPerPage,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      }),
    }
  )
);

export default useCyclesStore;
