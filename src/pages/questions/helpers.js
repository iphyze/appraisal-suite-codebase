export const isKpiType = (type) => type === 'kpi';

export const prettyType = (type) => (isKpiType(type) ? 'KPI Question' : 'General Question');
export const prettyTypePlural = (type) => (isKpiType(type) ? 'KPI Questions' : 'General Questions');
export const basePath = (type) => (isKpiType(type) ? '/questions/kpi' : '/questions/general');
export const sectionType = (type) => (isKpiType(type) ? 'kpi' : 'general');

export const questionRouteType = (type) => (isKpiType(type) ? 'kpi' : 'general');

export const scopeLabel = (scope) => {
  if (scope === 'supervisor') return 'Supervisor Specific';
  if (scope === 'individual') return 'Individual Staff';
  return 'Department Default';
};

export const toIntOrEmpty = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const parsed = Number(value);
  return Number.isNaN(parsed) ? '' : parsed;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

export const getQuestionText = (text) => text || 'Untitled question';

export const initials = (first = '', last = '') => `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'U';

export const makePages = (current, total) => {
  const totalPages = Math.max(Number(total || 1), 1);
  const active = Math.min(Math.max(Number(current || 1), 1), totalPages);

  if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = [1];
  const start = Math.max(2, active - 1);
  const end = Math.min(totalPages - 1, active + 1);

  if (start > 2) pages.push('start-ellipsis');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('end-ellipsis');
  pages.push(totalPages);

  return pages;
};
