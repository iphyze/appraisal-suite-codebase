/** Display-only formatting for PDF documents. Never mutate API or persisted values. */
const effectiveLocale = (locale) => locale === 'fr' ? 'fr-FR' : 'en-GB';

export function pdfScore(value, locale = 'en') {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '-';
  return new Intl.NumberFormat(effectiveLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

/** A percentage already expressed on a 0–100 scale, not a ratio. */
export function pdfPercentPoints(value, locale = 'en') {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '-';
  const number = Number(value);
  const formatted = new Intl.NumberFormat(effectiveLocale(locale), { maximumFractionDigits: 2 }).format(number);
  return `${formatted}${locale === 'fr' ? '\u00a0' : ''}%`;
}

export function pdfNumber(value, locale = 'en') {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '-';
  return new Intl.NumberFormat(effectiveLocale(locale)).format(Number(value));
}

export function pdfDate(value, locale = 'en') {
  if (!value) return '-';
  const input = String(value);
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? new Date(`${input}T12:00:00`)
    : new Date(input.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2'));
  return Number.isNaN(candidate.getTime()) ? input : new Intl.DateTimeFormat(effectiveLocale(locale), {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(candidate);
}

export function pdfLongDate(value, locale = 'en') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function pdfMoney(value, currency = 'EUR', locale = 'en') {
  const valueNumber = Number(value);
  if (!Number.isFinite(valueNumber)) return '-';
  // Preserve the existing sample's currency-symbol placement in English.
  return locale === 'fr'
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(valueNumber)
    : `€ ${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valueNumber)}`;
}
