/** Accept either locale's decimal separator; return a canonical numeric string. */
export function canonicalRatingText(input) {
  const raw = String(input ?? '').trim();
  if (raw === '') return '';
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(raw)) return null;
  return raw.replace(',', '.');
}
