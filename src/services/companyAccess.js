/** Display-only grant metadata. PHP validates the grant on every request. */
export const companyAccessCompanyId = (entry) => String(entry?.company_id ?? entry?.id ?? '');

export const selectedCompanyAccess = (role, homeCompanyId, selectedCompanyId, companies = []) => {
  if (role !== 'admin') return { isGranted: false, isViewOnly: false, canManage: true, canEditCompanySettings: true };
  const selected = String(selectedCompanyId || '');
  if (!selected || selected === String(homeCompanyId || '')) {
    return { isGranted: false, isViewOnly: false, canManage: true, canEditCompanySettings: true };
  }
  const company = companies.find((entry) => companyAccessCompanyId(entry) === selected && !entry.is_home);
  if (!company) {
    // Unknown or stale grants must NOT enable editing while awaiting validation.
    return { isGranted: true, isViewOnly: true, canManage: false, canEditCompanySettings: false, company: null };
  }
  const isViewOnly = company.access_level !== 'manage';
  // Company-wide settings affect every employee, so a grant needs Manage for ALL staff.
  const canEditCompanySettings = !isViewOnly && (company.staff_scope || 'All') === 'All';
  return { isGranted: true, isViewOnly, canManage: !isViewOnly, canEditCompanySettings, company };
};

export const isGrantRevocationError = (error) => (
  Number(error?.response?.status) === 403
  && /you do not have access to that company/i.test(String(error?.response?.data?.message_source || error?.response?.data?.message || ''))
);
