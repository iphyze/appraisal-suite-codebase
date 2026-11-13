/**
 * Free fairness checks for a draft appraisal (no AI, no tokens).
 * Each finding: { id, ref?, title, detail }. `ref` is the question's local_id, used to scroll to it.
 */
const isYes = (text) => /^\s*(yes|oui)\b/i.test(String(text || ''));
const isNo = (text) => /^\s*(no|non)\b/i.test(String(text || ''));

export function fairnessFindings({ items, ratingMin = 1, ratingMax = 5, breachDeclared, recommendations, score }) {
  const findings = [];
  const rated = items.filter((item) => Number.isFinite(item.rating) && item.rating > 0);
  if (!rated.length) return findings;

  // 1. Top or bottom ratings with no example (one finding, listing each question).
  const extremes = rated.filter((item) => (item.rating >= ratingMax || item.rating <= ratingMin) && !item.comment.trim());
  if (extremes.length) findings.push({
    id: 'extremes',
    title: extremes.length === 1 ? '1 top or lowest rating has no example' : `${extremes.length} top or lowest ratings have no example`,
    detail: 'A short example makes these ratings easier to justify if they are questioned.',
    questions: extremes.map((item) => ({ ref: item.ref, text: item.question, rating: item.rating, label: item.label })),
  });

  // 2. Identical ratings everywhere.
  const distinct = new Set(rated.map((item) => item.rating));
  if (rated.length >= 6 && distinct.size === 1) findings.push({
    id: 'same-rating', rating: rated[0].rating, title: `Every question is rated ${rated[0].rating}`,
    detail: 'Identical ratings across all questions can look like the appraisal was not considered question by question.',
  });

  // 3. Mostly top ratings with little evidence.
  const top = rated.filter((item) => item.rating >= ratingMax).length;
  const commented = rated.filter((item) => item.comment.trim()).length;
  if (rated.length >= 6 && top / rated.length >= 0.8 && commented <= 1 && distinct.size > 1) findings.push({
    id: 'mostly-top', percentage: Math.round((top / rated.length) * 100), maxRating: ratingMax, title: `${Math.round((top / rated.length) * 100)}% of ratings are ${ratingMax}`,
    detail: 'The 2026 framework expects about 5–10% Outstanding ratings company-wide. Add evidence, or review whether every top rating is deserved.',
  });

  // 4. Serious breach declared, but safety or integrity rated highly.
  if (breachDeclared) {
    rated.filter((item) => /safety|integrity|hse|cost & integrity/i.test(item.question) && item.rating >= 4).forEach((item) => findings.push({
      id: `breach-${item.ref}`, ref: item.ref, question: item.question.slice(0, 90), rating: item.rating, title: 'Safety or integrity rated highly despite a declared breach',
      detail: `"${item.question.slice(0, 90)}" is rated ${item.rating}, but a serious HSE or integrity breach is declared.`,
    }));
  }

  // 5. Recommendations that do not fit the score.
  if (Number.isFinite(score) && score > 0) {
    if (isYes(recommendations.status_upgrade) && score < 3.5) findings.push({ id: 'rec-status', target: 'recommendations', score: score.toFixed(2), title: 'Status upgrade recommended with a score below Exceeds', detail: `The overall score is ${score.toFixed(2)}.` });
    if (isYes(recommendations.salary_upgrade) && score < 2.5) findings.push({ id: 'rec-salary', target: 'recommendations', score: score.toFixed(2), title: 'Salary upgrade recommended with a score below Fully Meets', detail: `The overall score is ${score.toFixed(2)}.` });
    if (isNo(recommendations.development) && score < 2.5) findings.push({ id: 'rec-dev', target: 'recommendations', title: 'No development recommended for a score below Fully Meets', detail: 'A low score usually comes with a development action.' });
  }
  if (breachDeclared && (isYes(recommendations.status_upgrade) || isYes(recommendations.salary_upgrade))) findings.push({
    id: 'rec-breach', target: 'recommendations', title: 'Upgrade recommended despite a declared serious breach',
    detail: 'Check this is intended, as the final score is capped at 2.00 while the breach stands.',
  });
  return findings;
}
