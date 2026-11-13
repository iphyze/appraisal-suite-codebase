import i18n from '../i18n';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../services/api';
import useToastStore from './useToastStore';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const getSuccessMessage = (response, fallbackKey) => (i18n.language === 'fr'
  ? ux(fallbackKey) : response.data?.message || ux(fallbackKey));

const getMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const getIdentityMessage = (error, fallback) => {
  const code = error?.response?.data?.code;
  const key = {
    IDENTITY_MANUAL_REVIEW: 'identity_manual_review',
    IDENTITY_EXISTING_PASSWORD: 'identity_existing_password',
    IDENTITY_MANAGE_DENIED: 'identity_manage_denied',
    IDENTITY_COMPANY_CONFLICT: 'identity_company_conflict',
    IDENTITY_EMAIL_REQUIRED: 'identity_email_required',
  }[code];
  return key ? ux(key, { company: error?.response?.data?.company_name || ux('identity_other_company') }) : getMessage(error, fallback);
};

const useUsersStore = create(
  persist(
    (set, get) => ({
      data: [],
      meta: null,
      loading: true,
      error: null,
      selectedItems: [],

      singleUser: null,
      fetchingSingle: false,
      singleUserError: null,

      currentPage: 1,
      itemsPerPage: 10,
      searchQuery: '',
      roleFilter: '',
      departmentFilter: '',
      staffTypeFilter: '',
      statusFilter: '',
      sortBy: 'id',
      sortOrder: 'DESC',

      fetchUsers: async () => {
        const {
          currentPage,
          itemsPerPage,
          searchQuery,
          roleFilter,
          departmentFilter,
          staffTypeFilter,
          statusFilter,
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
          if (roleFilter) params.append('role', roleFilter);
          if (departmentFilter) params.append('department', departmentFilter);
          if (staffTypeFilter) params.append('staff_type', staffTypeFilter);
          if (statusFilter !== '') params.append('is_active', statusFilter);

          const response = await api.get(`/users/list?${params.toString()}`);

          set({
            data: response.data?.data || [],
            meta: response.data?.meta || null,
            currentPage: response.data?.meta?.page || currentPage,
            itemsPerPage: response.data?.meta?.limit || itemsPerPage,
            loading: false,
          });
        } catch (error) {
          const message = getMessage(error, ux('toast_fetch_users'));
          set({ loading: false, error: message });
          useToastStore.getState().showToast(message, 'error');
        }
      },

      fetchSingleUser: async (id) => {
        set({ fetchingSingle: true, singleUserError: null, singleUser: null });
        try {
          const response = await api.get(`/users/single?id=${encodeURIComponent(id)}`);
          set({ singleUser: response.data?.data || null, fetchingSingle: false });
        } catch (error) {
          const message = getMessage(error, ux('toast_fetch_user'));
          set({ fetchingSingle: false, singleUserError: message, singleUser: null });
          useToastStore.getState().showToast(message, 'error');
        }
      },

      clearSingleUser: () => set({ singleUser: null, singleUserError: null }),

      createUser: async (payload) => {
        try {
          const response = await api.post('/users/create', payload);
          useToastStore.getState().showToast(getSuccessMessage(response, 'toast_create_success'), 'success');
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getIdentityMessage(error, ux('toast_create_error'));
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      updateUser: async (payload) => {
        try {
          const response = await api.put('/users/update', payload);
          useToastStore.getState().showToast(getSuccessMessage(response, 'toast_update_success'), 'success');
          return { success: true, data: response.data?.data };
        } catch (error) {
          const code = error.response?.data?.code;
          const message = getIdentityMessage(error, ux('toast_update_error'));
          if (code !== 'IDENTITY_LINK_CONFIRM_REQUIRED') {
            useToastStore.getState().showToast(message, 'error');
          }
          return { success: false, message, code };
        }
      },



      bulkUpdateStaff: async (payload) => {
        try {
          const response = await api.put('/users/bulk-update', payload);
          useToastStore.getState().showToast(getSuccessMessage(response, 'toast_bulk_success'), 'success');
          set({ selectedItems: [] });
          await get().fetchUsers();
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, ux('toast_bulk_error'));
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      resetPassword: async (userId) => {
        try {
          const response = await api.put('/users/reset-password', { user_id: Number(userId) });
          const defaultPassword = response.data?.data?.default_password;
          useToastStore.getState().showToast(getSuccessMessage(response, 'toast_reset_success'), 'success');
          await get().fetchUsers();
          return { success: true, data: response.data?.data, defaultPassword };
        } catch (error) {
          const reason = error?.response?.data?.code;
          const message = reason === 'IDENTITY_RESET_DENIED'
            ? ux('reset_denied_company', { company: error.response?.data?.company_name || '' })
            : reason === 'IDENTITY_RESET_ADMIN_PROTECTED'
              ? ux('reset_admin_protected')
              : reason === 'IDENTITY_RESET_SELF'
                ? ux('reset_yourself')
                : getMessage(error, ux('toast_reset_error'));
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      deleteUsers: async (ids) => {
        const safeIds = Array.isArray(ids) ? ids : [ids];
        if (!safeIds.length) return { success: false, message: ux('toast_none_selected') };

        try {
          const response = await api.delete('/users/delete', { data: { ids: safeIds } });
          useToastStore.getState().showToast(getSuccessMessage(response, 'toast_delete_success'), 'success');
          set({ selectedItems: [] });
          await get().fetchUsers();
          return { success: true, data: response.data?.data };
        } catch (error) {
          const message = getMessage(error, ux('toast_delete_error'));
          useToastStore.getState().showToast(message, 'error');
          return { success: false, message };
        }
      },

      setSearchQuery: (value) => set({ searchQuery: value, currentPage: 1, selectedItems: [] }),
      setRoleFilter: (value) => set({ roleFilter: value || '', currentPage: 1, selectedItems: [] }),
      setDepartmentFilter: (value) => set({ departmentFilter: value || '', currentPage: 1, selectedItems: [] }),
      setStaffTypeFilter: (value) => set({ staffTypeFilter: value || '', currentPage: 1, selectedItems: [] }),
      setStatusFilter: (value) => set({ statusFilter: value == null ? '' : String(value), currentPage: 1, selectedItems: [] }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setItemsPerPage: (limit) => set({ itemsPerPage: Number(limit) || 10, currentPage: 1 }),

      setSorting: (field) => {
        const { sortBy, sortOrder } = get();
        const nextOrder = sortBy === field && sortOrder === 'ASC' ? 'DESC' : 'ASC';
        set({ sortBy: field, sortOrder: nextOrder, currentPage: 1 });
      },

      clearFilters: () =>
        set({
          searchQuery: '',
          roleFilter: '',
          departmentFilter: '',
          staffTypeFilter: '',
          statusFilter: '',
          currentPage: 1,
          selectedItems: [],
        }),

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
      name: 'appraisal-users-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        itemsPerPage: state.itemsPerPage,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      }),
    }
  )
);

export default useUsersStore;
