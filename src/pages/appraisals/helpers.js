import { currentFormatLocale, formatNumber } from '../../utils/format';

export const fmtNumber = (value) => formatNumber(value || 0);
export const dash = (value) => value === null || value === undefined || value === '' ? '—' : value;

// Preserve the English snapshot display; in French, show a localized numeric score.
export const displayAppraisalScore = (value) => {
  const source = dash(value);
  return currentFormatLocale() === 'fr-FR' && source !== '—' && Number.isFinite(Number(source))
    ? formatNumber(source, { maximumFractionDigits: 2 }) : source;
};
export const fullName = (user) => `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.fullname || user?.staff_fullname || '—';

const ratingMeaning = (value) => (
  value >= 4.6 ? 'Significant / Outstanding'
    : value >= 3.1 ? 'Consistently Exceeds Requirements'
      : value >= 2.1 ? 'Completely Meets Requirements'
        : value >= 1.1 ? 'Marginally Meets Requirements'
          : 'Requires Development'
);

export const ratingOptions = Array.from({ length: 41 }, (_, index) => {
  const value = Number((1 + (index * 0.1)).toFixed(1));
  return {
    value,
    label: value.toFixed(1),
    description: ratingMeaning(value),
  };
});

export const LIMIT_OPTIONS = [10, 20, 50, 100].map((value) => ({ value }));
export const STATUS_OPTIONS = [
  { value: 'all' },
  { value: 'pending' },
  { value: 'appraised' },
  { value: 'Pending' },
  { value: 'Acknowledged' },
];

export const makePages = (current, total) => {
  const pages = [];
  const safeTotal = Math.max(Number(total || 1), 1);
  const safeCurrent = Math.min(Math.max(Number(current || 1), 1), safeTotal);
  const add = (item) => pages.push(item);

  if (safeTotal <= 7) {
    for (let i = 1; i <= safeTotal; i += 1) add(i);
    return pages;
  }

  add(1);
  if (safeCurrent > 4) add('start-ellipsis');

  const start = Math.max(2, safeCurrent - 1);
  const end = Math.min(safeTotal - 1, safeCurrent + 1);
  for (let i = start; i <= end; i += 1) add(i);

  if (safeCurrent < safeTotal - 3) add('end-ellipsis');
  add(safeTotal);
  return pages;
};


// Keep filter values and server-facing statuses unchanged. Only their labels are localized.
const statusKeyByValue = {
  '': 'allStatus',
  all: 'allStatus',
  pending: 'notYetAppraised',
  appraised: 'appraisedStatus',
  Pending: 'pendingAcknowledgement',
  Acknowledged: 'acknowledged',
};

export const localizedStatusOptions = (t, options = STATUS_OPTIONS) => options.map((option) => ({
  ...option,
  label: t(`list.${statusKeyByValue[option.value]}`),
}));

export const localizedLimitOptions = (t) => LIMIT_OPTIONS.map((option) => ({
  ...option,
  label: t('list.rows', { count: option.value }),
}));

// Status is API data, not a localized field. Never change it before filtering or class-name use.
export const displayAppraisalStatus = (t, value, fallback = 'Pending') => {
  const raw = value || fallback;
  const normalized = String(raw).toLowerCase();
  const key = normalized === 'pending' ? 'pending'
    : normalized === 'acknowledged' ? 'acknowledged'
      : normalized === 'appraised' ? 'appraisedStatus'
        : normalized === 'unreviewed' ? 'unreviewed'
          : normalized === 'reviewed' ? 'reviewed'
            : normalized === 'follow_up' ? 'followUpReview'
              : normalized === 'not yet appraised' ? 'notYetAppraised' : null;
  return key ? t(`list.${key}`) : raw;
};
