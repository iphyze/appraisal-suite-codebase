import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import { selectedCompanyAccess } from '../services/companyAccess';

/** Presentation helper only; the server remains authoritative. */
export default function useCompanyWritePermission() {
  const user = useAuthStore((state) => state.user);
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const companies = usePortalContextStore((state) => state.accessibleCompanies);
  const access = selectedCompanyAccess(user?.role, user?.company_id, viewCompanyId, companies);
  const settingsLocked = !access.canEditCompanySettings;
  return {
    ...access,
    reason: access.isViewOnly ? 'View-only access. Return to your home company or request Manage access.' : '',
    // Cycles, sections, scoring, general questions and departments (company-wide settings).
    settingsLocked,
    settingsReason: settingsLocked && !access.isViewOnly
      ? 'Company-wide settings need Manage access for all staff. Your access covers part of the staff only.'
      : '',
  };
}
