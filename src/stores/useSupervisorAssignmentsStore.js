import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import useToastStore from './useToastStore';
import api from '../services/api';

const authHeader = () => ({}); // Session is sent securely via HttpOnly cookie.

const defaultMeta = {
  total: 0,
  page: 1,
  limit: 10,
  total_pages: 1,
  assigned_count: 0,
  unassigned_count: 0,
  assigned_to_other_count: 0,
  appraised_count: 0,
  pending_count: 0,
  progress_percent: 0,
  supervisor: null,
  cycle: null,
};

const useSupervisorAssignmentsStore = create((set, get) => ({
  cycles: [],
  supervisors: [],
  departments: [],
  staff: [],
  meta: defaultMeta,
  loading: false,
  lookupLoading: false,
  actionLoading: false,
  error: null,

  selectedItems: [],
  currentPage: 1,
  itemsPerPage: 10,
  searchQuery: '',
  cycleId: '',
  supervisorId: '',
  departmentFilter: '',
  staffTypeFilter: '',
  assignmentStatus: 'all',
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

  fetchSupervisors: async (nextCycleId = get().cycleId) => {
    set({ lookupLoading: true, error: null });

    try {
      const params = new URLSearchParams({
        limit: '1000',
        is_active: '1',
        sortBy: 'first_name',
        sortOrder: 'ASC',
      });

      if (nextCycleId) {
        params.append('cycle_id', nextCycleId);
      }

      // Use the search endpoint, not the paginated list endpoint, because this select should return all matching supervisors and includes
      // includes cycle-aware assignment totals: assigned_count, appraised_count,
      // pending_count, progress_percent and onboarding status.
      const response = await api.get(`/supervisors/search?${params.toString()}`, {
        headers: authHeader(),
      });

      const data = (response.data?.data || []).map((supervisor) => ({
        ...supervisor,
        total_subordinates: Number(supervisor.total_subordinates ?? supervisor.assigned_count ?? 0),
        assigned_count: Number(supervisor.assigned_count ?? supervisor.total_subordinates ?? 0),
        appraised_count: Number(supervisor.appraised_count ?? 0),
        pending_count: Number(supervisor.pending_count ?? 0),
        progress_percent: Number(supervisor.progress_percent ?? 0),
      }));

      set({
        supervisors: data,
        lookupLoading: false,
        supervisorId: data.some((item) => String(item.id) === String(get().supervisorId))
          ? get().supervisorId
          : '',
      });

      return { success: true, data };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch supervisors';

      set({
        supervisors: [],
        supervisorId: '',
        lookupLoading: false,
        error: message,
      });

      return { success: false, message };
    }
  },

  fetchDepartments: async (companyId = '') => {
    try {
      const params = new URLSearchParams({
        limit: '500',
        page: '1',
        sortBy: 'name',
        sortOrder: 'ASC',
      });

      if (companyId) params.append('company_id', companyId);

      const response = await api.get(`/departments/list?${params.toString()}`, {
        headers: authHeader(),
      });

      const departments = response.data?.data || [];
      set({ departments });
      return { success: true, data: departments };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch departments';
      set({ departments: [] });
      return { success: false, message };
    }
  },

  fetchAssignmentStaff: async (overrides = {}) => {
    const state = get();

    const cycleId = overrides.cycleId ?? state.cycleId;
    const supervisorId = overrides.supervisorId ?? state.supervisorId;

    if (!cycleId) {
      set({ staff: [], meta: defaultMeta, loading: false, error: null });
      return { success: true, data: [] };
    }

    set({ loading: true, error: null });

    try {
      const params = new URLSearchParams({
        cycle_id: cycleId,
        page: String(overrides.currentPage ?? state.currentPage),
        limit: String(overrides.itemsPerPage ?? state.itemsPerPage),
        sortBy: overrides.sortBy ?? state.sortBy,
        sortOrder: overrides.sortOrder ?? state.sortOrder,
        assignment_status: overrides.assignmentStatus ?? state.assignmentStatus,
      });

      if (supervisorId) params.append('supervisor_id', supervisorId);

      const search = overrides.searchQuery ?? state.searchQuery;
      const department = overrides.departmentFilter ?? state.departmentFilter;
      const staffType = overrides.staffTypeFilter ?? state.staffTypeFilter;

      if (search) params.append('search', search);
      if (department) params.append('department', department);
      if (staffType) params.append('staff_type', staffType);

      const response = await api.get(`/supervisors/assignment-staff?${params.toString()}`, {
        headers: authHeader(),
      });

      set({
        staff: response.data?.data || [],
        meta: response.data?.meta || defaultMeta,
        loading: false,
        error: null,
      });

      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch assignment staff';
      set({ staff: [], meta: defaultMeta, loading: false, error: message });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  assignStaff: async (staffIds = []) => {
    const { cycleId, supervisorId } = get();
    const ids = [...new Set(staffIds.map(Number).filter(Boolean))];

    if (!cycleId || !supervisorId) {
      const message = 'Select an appraisal cycle and supervisor first.';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }

    if (!ids.length) {
      const message = 'Select at least one staff member to assign.';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }

    set({ actionLoading: true });

    try {
      const response = await api.post('/supervisors/assign', {
        cycle_id: Number(cycleId),
        supervisor_id: Number(supervisorId),
        staff_ids: ids,
      }, {
        headers: authHeader(),
      });

      useToastStore.getState().showToast(response.data?.message || 'Staff assigned successfully', 'success');
      set({ actionLoading: false, selectedItems: [] });
      await get().fetchAssignmentStaff();
      await get().fetchSupervisors(cycleId);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to assign staff';
      set({ actionLoading: false });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  unassignStaff: async (staffIds = []) => {
    const { cycleId, supervisorId } = get();
    const ids = [...new Set(staffIds.map(Number).filter(Boolean))];

    if (!cycleId || !supervisorId) {
      const message = 'Select an appraisal cycle and supervisor first.';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }

    if (!ids.length) {
      const message = 'Select at least one assigned staff member to remove.';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }

    set({ actionLoading: true });

    try {
      const response = await api.delete('/supervisors/unassign', {
        headers: authHeader(),
        data: {
          cycle_id: Number(cycleId),
          supervisor_id: Number(supervisorId),
          staff_ids: ids,
        },
      });

      useToastStore.getState().showToast(response.data?.message || 'Staff removed successfully', 'success');
      set({ actionLoading: false, selectedItems: [] });
      await get().fetchAssignmentStaff();
      await get().fetchSupervisors(cycleId);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unable to remove staff';
      set({ actionLoading: false });
      useToastStore.getState().showToast(message, 'error');
      return { success: false, message };
    }
  },

  setCycleId: (cycleId) => {
    set({
      cycleId,
      supervisorId: '',
      departmentFilter: '',
      currentPage: 1,
      selectedItems: [],
      departments: [],
      staff: [],
      meta: defaultMeta,
    });
    get().fetchSupervisors(cycleId);
  },

  setSupervisorId: (supervisorId) => {
    set({ supervisorId, currentPage: 1, selectedItems: [] });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1, selectedItems: [] }),
  setDepartmentFilter: (departmentFilter) => set({ departmentFilter, currentPage: 1, selectedItems: [] }),
  setStaffTypeFilter: (staffTypeFilter) => set({ staffTypeFilter, currentPage: 1, selectedItems: [] }),
  setAssignmentStatus: (assignmentStatus) => set({ assignmentStatus, currentPage: 1, selectedItems: [] }),
  setItemsPerPage: (itemsPerPage) => set({ itemsPerPage: Number(itemsPerPage), currentPage: 1, selectedItems: [] }),
  setCurrentPage: (currentPage) => set({ currentPage, selectedItems: [] }),

  setSorting: (field) => {
    const { sortBy, sortOrder } = get();
    if (sortBy === field) {
      set({ sortOrder: sortOrder === 'ASC' ? 'DESC' : 'ASC', currentPage: 1 });
    } else {
      set({ sortBy: field, sortOrder: 'ASC', currentPage: 1 });
    }
  },

  toggleItemSelection: (id) => {
    const normalized = Number(id);
    const selected = get().selectedItems;
    set({
      selectedItems: selected.includes(normalized)
        ? selected.filter((item) => item !== normalized)
        : [...selected, normalized],
    });
  },

  setSelectedItems: (selectedItems) => set({ selectedItems }),
  clearSelection: () => set({ selectedItems: [] }),

  clearFilters: () => set({
    searchQuery: '',
    departmentFilter: '',
    staffTypeFilter: '',
    assignmentStatus: 'all',
    currentPage: 1,
    selectedItems: [],
  }),
}));

export default useSupervisorAssignmentsStore;
