/**
 * Split the configured total into hundredths of a percent using the CURRENT
 * objective list. Integer arithmetic prevents rounding drift and negative
 * final-row values when objectives have been added or removed.
 */
export const distributeObjectiveWeights = (rows, requiredWeight = 100) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const totalHundredths = Math.round(Number(requiredWeight) * 100);
  if (!Number.isFinite(totalHundredths) || totalHundredths < rows.length) return rows;

  const base = Math.floor(totalHundredths / rows.length);
  const extra = totalHundredths % rows.length;
  return rows.map((row, index) => ({
    ...row,
    weight_percent: (base + (index < extra ? 1 : 0)) / 100,
  }));
};
