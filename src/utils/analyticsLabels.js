/** Fixed rating bands from the analytics framework; never translate user/DB-authored labels here. */
const BAND_KEYS = Object.freeze({
  outstanding: 'band_outstanding',
  exceeds: 'band_exceeds',
  fully_meets: 'band_fully_meets',
  needs_improvement: 'band_needs_improvement',
  unsatisfactory: 'band_unsatisfactory',
});
const BAND_LABELS = Object.freeze({
  Outstanding: BAND_KEYS.outstanding,
  Exceeds: BAND_KEYS.exceeds,
  'Fully Meets': BAND_KEYS.fully_meets,
  'Needs Improvement': BAND_KEYS.needs_improvement,
  Unsatisfactory: BAND_KEYS.unsatisfactory,
});

export function translatedRatingBand(t, { key, label }) {
  const token = BAND_KEYS[key] || BAND_LABELS[label];
  return token ? t(token) : label;
}
