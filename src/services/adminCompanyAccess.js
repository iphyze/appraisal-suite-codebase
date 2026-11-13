import api from './api';

// Company grants are an administrative resource, not the current View Context.
// All of these endpoints independently require the Super Admin role on the server.
const administrativeRequest = { skipPortalContext: true, skipRetry: true };

export const listCompanyGrants = async ({ status = 'active', page = 1, limit = 25 } = {}) => {
  const response = await api.get('/users/company-access', {
    ...administrativeRequest,
    params: { status, page, limit },
  });
  return {
    grants: Array.isArray(response.data?.data) ? response.data.data : [],
    meta: response.data?.meta || { page, limit, total: 0, total_pages: 1 },
  };
};

export const listEligibleCompanyAdmins = async () => {
  const response = await api.get('/users/company-access/eligible', administrativeRequest);
  return Array.isArray(response.data?.data) ? response.data.data : [];
};

export const listActiveAccessCompanies = async () => {
  const response = await api.get('/companies/list', administrativeRequest);
  return (Array.isArray(response.data?.data) ? response.data.data : [])
    .filter((entry) => Number(entry.is_active) === 1);
};

export const createCompanyGrant = async (values, reason) => {
  const response = await api.post('/users/company-access', { ...values, reason }, administrativeRequest);
  return response.data?.data;
};

export const updateCompanyGrant = async (grantId, values, reason) => {
  const response = await api.patch('/users/company-access', {
    grant_id: Number(grantId), ...values, reason,
  }, administrativeRequest);
  return response.data?.data;
};

export const revokeCompanyGrant = async (grantId, reason) => {
  // Axios DELETE supports a JSON body only through config.data.
  const response = await api.delete('/users/company-access', {
    ...administrativeRequest,
    data: { grant_id: Number(grantId), reason },
  });
  return response.data?.data;
};
