export const DEFAULT_GRANT_FORM = Object.freeze({
  user_id: '', company_id: '', access_level: 'view',
  staff_scope: 'All', receive_notifications: false,
});

export const GRANT_LEVELS = Object.freeze(['view', 'manage']);
export const GRANT_SCOPES = Object.freeze(['All', 'Local', 'Expatriate']);

export const grantReasonValid = (reason) => {
  const length = Array.from(String(reason || '').trim()).length;
  return length >= 5 && length <= 500;
};

export const editFormForGrant = (grant) => ({
  user_id: String(grant.user_id),
  company_id: String(grant.company_id),
  access_level: grant.access_level,
  staff_scope: grant.staff_scope,
  receive_notifications: Boolean(grant.receive_notifications),
});

export const normalizedGrantSettings = (form) => ({
  access_level: form.access_level,
  staff_scope: form.staff_scope,
  receive_notifications: Boolean(form.receive_notifications),
});

export const hasGrantChanges = (grant, form) => !grant || (
  grant.access_level !== form.access_level
  || grant.staff_scope !== form.staff_scope
  || Boolean(grant.receive_notifications) !== Boolean(form.receive_notifications)
);

export const validateNewGrant = (form, admins, companies) => {
  const admin = admins.find((item) => String(item.id) === String(form.user_id));
  const company = companies.find((item) => String(item.id) === String(form.company_id));
  if (!admin) return 'Choose an active administrator.';
  if (!company || Number(company.is_active) !== 1) return 'Choose an active company.';
  if (String(admin.home_company_id) === String(company.id)) return 'An admin already has full access to their home company.';
  if (!GRANT_LEVELS.includes(form.access_level) || !GRANT_SCOPES.includes(form.staff_scope)) return 'Choose a valid access level and staff scope.';
  return '';
};

export const grantErrorMessage = (error) => error?.response?.data?.message
  || error?.message || 'Unable to complete this request. Please try again.';
