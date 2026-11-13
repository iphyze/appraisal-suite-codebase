import api from './api';

// Super Admin listing only. Never inherit a currently selected View Context.
export const listSetupCompanies = async () => {
  const response = await api.get('/companies/list', {
    params: { include_inactive: 1 }, skipPortalContext: true,
  });
  return response.data?.data || [];
};

// The existing cycle-list route paginates; collect all active cycles rather than
// silently hiding a valid source that happens to be on a later page.
export const listSetupSourceCycles = async () => {
  const results = [];
  const pageSize = 200;
  let page = 1;
  let pages = 1;
  do {
    const response = await api.get('/cycles/list', {
      params: { is_active: 1, page, limit: pageSize }, skipPortalContext: true,
    });
    results.push(...(response.data?.data || []));
    const count = Number(response.data?.meta?.total_pages);
    pages = Number.isSafeInteger(count) && count > 0 ? count : 1;
    page += 1;
    if (pages > 50) throw new Error('Too many appraisal cycles to list. Contact an administrator.');
  } while (page <= pages);
  return results;
};

export const previewCompanySetup = async (sourceCycleId, targetCompanyId) => {
  const response = await api.get('/companies/setup-copy', {
    params: { source_cycle_id: Number(sourceCycleId), target_company_id: Number(targetCompanyId) },
    skipPortalContext: true,
  });
  return response.data?.data;
};

export const applyCompanySetup = async ({ sourceCycleId, targetCompanyId, reason }) => {
  const response = await api.post('/companies/setup-copy', {
    source_cycle_id: Number(sourceCycleId), target_company_id: Number(targetCompanyId), reason: reason.trim(),
  }, { skipPortalContext: true });
  return response.data?.data;
};
