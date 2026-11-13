import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import useToastStore from './useToastStore';
import useDashboardStore from './useDashboardStore';
import useSupervisorAssignmentsStore from './useSupervisorAssignmentsStore';
import api from '../services/api';

const authHeader = () => ({}); // Session is sent securely via HttpOnly cookie.

const defaultMeta = {
  total: 0,
  page: 1,
  limit: 10,
  total_pages: 1,
  total_supervisors: 0,
  onboarded_count: 0,
  assigned_count: 0,
  appraised_count: 0,
  pending_count: 0,
  progress_percent: 0,
  cycle: null,
};

const useSupervisorsStore = create((set, get) => ({
  supervisors: [],
  supervisor: null,
  subordinates: [],
  cycles: [],
  meta: defaultMeta,
  loading: true,
  detailLoading: false,
  lookupLoading: false,
  resettingOnboarding: false,
  error: null,

  currentPage: 1,
  itemsPerPage: 10,
  searchQuery: '',
  cycleId: '',
  departmentFilter: '',
  staffTypeFilter: '',
  activeFilter: '1',
  onboardingFilter: '',
  sortBy: 'first_name',
  sortOrder: 'ASC',

  fetchCycles: async () => {
    set({ lookupLoading: true });

    try {
      const response = await api.get('/cycles/list?limit=200&page=1&sortBy=year&sortOrder=DESC', {
        headers: authHeader(),
      });

      const cycles = response.data?.data || [];
      set({ cycles, lookupLoading: false });
      return { success: true, data: cycles };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch appraisal cycles';
      set({ cycles: [], lookupLoading: false, error: message });
      return { success: false, message };
    }
  },

  fetchSupervisors: async () => {
    set({ loading: true, error: null });

    try {
      const {
        currentPage,
        itemsPerPage,
        searchQuery,
        cycleId,
        departmentFilter,
        staffTypeFilter,
        activeFilter,
        onboardingFilter,
        sortBy,
        sortOrder,
      } = get();

      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (cycleId) params.append('cycle_id', cycleId);
      if (departmentFilter) params.append('department', departmentFilter);
      if (staffTypeFilter) params.append('staff_type', staffTypeFilter);
      if (activeFilter !== '') params.append('is_active', activeFilter);
      if (onboardingFilter) params.append('onboarding_status', onboardingFilter);

      const response = await api.get(`/supervisors/list?${params.toString()}`, {
        headers: authHeader(),
      });

      set({
        supervisors: response.data?.data || [],
        meta: response.data?.meta || defaultMeta,
        loading: false,
        error: null,
      });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch supervisors';
      set({ supervisors: [], loading: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  fetchSupervisor: async (id, cycleId = get().cycleId) => {
    set({ detailLoading: true, error: null });

    try {
      const params = new URLSearchParams({ id });
      if (cycleId) params.append('cycle_id', cycleId);

      const response = await api.get(`/supervisors/single?${params.toString()}`, {
        headers: authHeader(),
      });

      set({
        supervisor: response.data?.data?.supervisor || null,
        subordinates: response.data?.data?.subordinates || [],
        meta: response.data?.meta || defaultMeta,
        detailLoading: false,
        error: null,
      });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch supervisor';
      set({ supervisor: null, subordinates: [], detailLoading: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },


  resetOnboarding: async ({ supervisorId, cycleId }) => {
    const supervisor_id = Number(supervisorId || 0);
    const cycle_id = Number(cycleId || 0);

    if (!supervisor_id || !cycle_id) {
      const message = 'Select a specific appraisal cycle before resetting onboarding.';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }

    set({ resettingOnboarding: true, error: null });

    try {
      const response = await api.post('/supervisors/reset-onboarding', { supervisor_id, cycle_id }, {
        headers: authHeader(),
      });

      const payload = response.data || {};
      const message = payload.message || 'Supervisor onboarding reset successfully.';

      set((state) => {
        const updatedSupervisors = state.supervisors.map((item) =>
          Number(item.id) === supervisor_id ? { ...item, is_onboarded: 0, cycle_onboarded_at: null } : item
        );
        const filteringOnboarded = state.onboardingFilter === 'onboarded';
        const nextTotal = filteringOnboarded
          ? Math.max(Number(state.meta?.total || 0) - 1, 0)
          : Number(state.meta?.total || 0);

        return {
          resettingOnboarding: false,
          supervisors: filteringOnboarded
            ? updatedSupervisors.filter((item) => Number(item.id) !== supervisor_id)
            : updatedSupervisors,
          supervisor: Number(state.supervisor?.id) === supervisor_id
            ? { ...state.supervisor, is_onboarded: 0, cycle_onboarded_at: null }
            : state.supervisor,
          meta: {
            ...state.meta,
            total: nextTotal,
            total_pages: filteringOnboarded
              ? Math.max(Math.ceil(nextTotal / Math.max(Number(state.itemsPerPage || 10), 1)), 1)
              : state.meta?.total_pages,
            onboarded_count: Math.max(Number(state.meta?.onboarded_count || 0) - 1, 0),
          },
        };
      });

      useToastStore.getState().showToast(message, 'success');

      // Refresh every active/cached view that derives onboarding status or counts.
      // The optimistic update above makes the UI react immediately; these requests
      // then reconcile server totals, filters, detail stats and other mounted stores.
      const listResult = await get().fetchSupervisors();
      const latestState = get();
      const totalPages = Math.max(Number(latestState.meta?.total_pages || 1), 1);

      if (listResult.success && latestState.currentPage > totalPages) {
        set({ currentPage: totalPages });
        await get().fetchSupervisors();
      }

      const refreshes = [];

      if (Number(get().supervisor?.id) === supervisor_id) {
        refreshes.push(get().fetchSupervisor(supervisor_id, cycle_id));
      }

      const dashboardState = useDashboardStore.getState();
      const dashboardCycleId = String(dashboardState.cycleId || '');
      if (dashboardState.data && (!dashboardCycleId || dashboardCycleId === String(cycle_id))) {
        refreshes.push(dashboardState.fetchDashboardData(
          dashboardState.cycleId,
          dashboardState.viewCompanyId
        ));
      }

      const assignmentsState = useSupervisorAssignmentsStore.getState();
      if (String(assignmentsState.cycleId || '') === String(cycle_id)) {
        refreshes.push(assignmentsState.fetchSupervisors(cycle_id));
      }

      if (refreshes.length) {
        await Promise.allSettled(refreshes);
      }

      return { success: true, data: payload.data, message };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to reset supervisor onboarding';
      set({ resettingOnboarding: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setCycleId: (cycleId) => set({ cycleId, currentPage: 1 }),
  setDepartmentFilter: (departmentFilter) => set({ departmentFilter, currentPage: 1 }),
  setStaffTypeFilter: (staffTypeFilter) => set({ staffTypeFilter, currentPage: 1 }),
  setActiveFilter: (activeFilter) => set({ activeFilter, currentPage: 1 }),
  setOnboardingFilter: (onboardingFilter) => set({ onboardingFilter, currentPage: 1 }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setItemsPerPage: (itemsPerPage) => set({ itemsPerPage: Number(itemsPerPage), currentPage: 1 }),

  setSorting: (field) => {
    const { sortBy, sortOrder } = get();

    if (sortBy === field) {
      set({ sortOrder: sortOrder === 'ASC' ? 'DESC' : 'ASC', currentPage: 1 });
    } else {
      set({ sortBy: field, sortOrder: 'ASC', currentPage: 1 });
    }
  },

  clearFilters: () => set({
    searchQuery: '',
    departmentFilter: '',
    staffTypeFilter: '',
    activeFilter: '1',
    onboardingFilter: '',
    currentPage: 1,
  }),
}));

export default useSupervisorsStore;
