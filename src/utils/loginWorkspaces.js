/** Never preselect a company that is not among the authenticated options. */
export const preferredLoginWorkspaceId = (companies, preferredCompanyId) => {
  const target = Number(preferredCompanyId || 0);
  if (!Number.isSafeInteger(target) || target <= 0) return null;
  return (Array.isArray(companies) ? companies : []).some(
    (company) => Number(company?.id) === target
  ) ? target : null;
};
