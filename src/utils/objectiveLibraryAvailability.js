/**
 * A previously selected objective may remain on a staff plan after its library
 * question is deactivated. The active library list remains the sole source of
 * assignable IDs: never silently reactivate or remap the historical question.
 */
const clean = (value) => String(value ?? '').trim();

export const unavailableSelectedObjectives = (rows = [], available = []) => {
  const activeIds = new Set(available.map((item) => Number(item.id)).filter((id) => id > 0));
  return rows.filter((row) => Number(row.question_id) > 0 && !activeIds.has(Number(row.question_id)));
};

/** Only propose a substitution when exactly one ACTIVE, unselected library row
 * matches both the original code and the full objective wording and scope.
 * Different wording/department/scope or multiple matches require manual choice.
 */
export const matchingActiveObjective = (row, rows = [], available = []) => {
  if (Number(row?.question_id) <= 0) return null;
  const selectedIds = new Set(rows.map((item) => Number(item.question_id)));
  const code = clean(row.objective_code);
  const text = clean(row.question_text);
  const scope = clean(row.scope);
  if (!text) return null;
  const matches = available.filter((candidate) => Number(candidate.id) > 0
    && !selectedIds.has(Number(candidate.id))
    && clean(candidate.objective_code) === code
    && clean(candidate.question_text) === text
    && clean(candidate.scope) === scope);
  return matches.length === 1 ? matches[0] : null;
};

/** Preserve the employee's overrides; change only the library reference. */
export const replaceUnavailableObjective = (row, replacement) => ({
  ...row,
  question_id: Number(replacement.id),
  objective_code: replacement.objective_code || '',
  question_text: replacement.question_text || '',
  scope: replacement.scope || row.scope,
  review_status: replacement.review_status || 'ready',
  review_note: replacement.review_note || '',
  is_active: 1,
  is_new: false,
});
