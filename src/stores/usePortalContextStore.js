import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { selectedCompanyAccess } from '../services/companyAccess';

/**
 * Navigation view context, not a source of authorization. The backend checks
 * all requested company IDs and grant status on EVERY request.
 * Only the selector and owner ID are persisted; grants are fetched live.
 */
const usePortalContextStore = create(
  persist(
    (set, get) => ({
      viewCompanyId: '',
      cycleId: '',
      contextVersion: 0,
      ownerUserId: '',
      accessibleCompanies: [],
      accessStatus: 'idle',

      ensureOwner: (userId, role = '') => {
        const next = userId ? String(userId) : '';
        if (next === get().ownerUserId) return;
        // Preserve an existing Super Admin selector created by the old version
        // of this store, which did not save its owner ID.
        if (!get().ownerUserId && role === 'super_admin') {
          set({ ownerUserId: next, accessibleCompanies: [], accessStatus: 'idle' });
          return;
        }
        set((state) => ({
          ownerUserId: next, viewCompanyId: '', cycleId: '',
          accessibleCompanies: [], accessStatus: 'idle',
          contextVersion: state.contextVersion + 1,
        }));
      },

      setViewCompanyId: (viewCompanyId) => set((state) => ({
        viewCompanyId: viewCompanyId ? String(viewCompanyId) : '',
        cycleId: '',
        contextVersion: state.contextVersion + 1,
      })),

      setCycleId: (cycleId) => set((state) => ({
        cycleId: cycleId ? String(cycleId) : '',
        contextVersion: state.contextVersion + 1,
      })),

      setAccessibleCompanies: (companies, user) => {
        const rows = Array.isArray(companies) ? companies : [];
        const role = user?.role;
        const selection = get().viewCompanyId;
        const home = user?.company_id;
        const valid = role !== 'admin' || !selection || selection === String(home || '')
          || rows.some((row) => !row.is_home && String(row.company_id) === selection);
        set((state) => ({
          accessibleCompanies: rows,
          accessStatus: 'ready',
          ...(valid ? {} : {
            viewCompanyId: '', cycleId: '', contextVersion: state.contextVersion + 1,
          }),
        }));
        return valid;
      },

      setAccessStatus: (status) => set({ accessStatus: status }),

      getActingAccess: (user) => selectedCompanyAccess(
        user?.role, user?.company_id, get().viewCompanyId, get().accessibleCompanies
      ),

      // A workspace is a different users.id, not a View Context grant.
      // Clear the previous member's selected company/cycle AND cached grants,
      // even for Super Admin. Keep browser appraisal drafts per membership.
      resetForWorkspace: (userId) => set((state) => ({
        ownerUserId: String(userId), viewCompanyId: '', cycleId: '',
        accessibleCompanies: [], accessStatus: 'idle',
        contextVersion: state.contextVersion + 1,
      })),

      clearContext: () => set((state) => ({
        viewCompanyId: '', cycleId: '', contextVersion: state.contextVersion + 1,
      })),
    }),
    {
      name: 'lambert-portal-view-context',
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ viewCompanyId, cycleId, ownerUserId }) => ({ viewCompanyId, cycleId, ownerUserId }),
    }
  )
);

export default usePortalContextStore;
