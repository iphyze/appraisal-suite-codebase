/** Central locale-aware display helpers. Never use formatted values for API writes. */
export function currentFormatLocale(locale) {
  const requested = locale || (typeof document !== 'undefined' ? document.documentElement.lang : 'en');
  return requested === 'fr' ? 'fr-FR' : 'en-GB';
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    // Treat ISO date-only values as local calendar dates (not UTC midnight).
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match) {
      const [year, month, day] = match.slice(1).map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    }
    value = value.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = {}, locale) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(currentFormatLocale(locale),
    { day: '2-digit', month: 'short', year: 'numeric', ...options }).format(date) : '—';
}

export function formatDateTime(value, options = {}, locale) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit', ...options }, locale);
}

export function formatNumber(value, options = {}, locale) {
  const number = Number(value);
  return value === null || value === '' || !Number.isFinite(number)
    ? '—' : new Intl.NumberFormat(currentFormatLocale(locale), options).format(number);
}

export function formatScore(value, locale) {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale);
}

/** Ratio (0.0–1.0) to localized percentage text. */
export function formatPercentage(ratio, digits = 0, locale) {
  return formatNumber(ratio, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }, locale);
}

export function formatRelativeTime(value, base = new Date(), locale) {
  const date = parseDate(value);
  const from = parseDate(base);
  if (!date || !from) return '—';
  const delta = (date.getTime() - from.getTime()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60]];
  const [unit, seconds] = units.find(([, threshold]) => Math.abs(delta) >= threshold) || ['second', 1];
  return new Intl.RelativeTimeFormat(currentFormatLocale(locale), { numeric: 'auto' })
    .format(Math.round(delta / seconds), unit);
}

/** Input supports both 4,5 and 4.5, with reasonable thousands-separator handling. */
export function parseLocalizedNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  let input = value.replace(/[\s\u00a0\u202f]/g, '').replace(/−/g, '-');
  if (!/^[+-]?[\d.,]+$/.test(input)) return null;
  const lastComma = input.lastIndexOf(',');
  const lastDot = input.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    input = input.replaceAll(grouping, '').replace(decimal, '.');
  } else if (lastComma !== -1) {
    // Commas are decimal marks for localized inputs, even without an explicit locale.
    input = input.replace(',', '.');
  }
  if (!/^[+-]?\d+(\.\d+)?$/.test(input)) return null;
  const number = Number(input);
  return Number.isFinite(number) ? number : null;
}

export function localeCollator(locale, options = {}) {
  return new Intl.Collator(currentFormatLocale(locale), { sensitivity: 'base', numeric: true, ...options });
}

export function compareLocalized(a, b, locale) {
  return localeCollator(locale).compare(String(a ?? ''), String(b ?? ''));
}
