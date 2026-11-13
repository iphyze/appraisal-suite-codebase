/**
 * In-progress appraisal entries, saved on this device so nothing is lost if the
 * supervisor leaves, the page reloads, or the session has to be renewed.
 *
 * - One draft per signed-in user and appraisal (new: staff + cycle; edit: appraisal id).
 * - Drafts expire after 7 days and are removed after a successful submission,
 *   when the user discards them, and when the user signs out.
 */
const PREFIX = 'appraisalsuite.appraisal-draft.v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const keyFor = (userId, identity) => `${PREFIX}:${userId}:${identity}`;

export const readAppraisalDraft = (userId, identity) => {
  if (!userId || !identity) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId, identity));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object' || Date.now() - Number(draft.savedAt || 0) > MAX_AGE_MS) {
      window.localStorage.removeItem(keyFor(userId, identity));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

export const writeAppraisalDraft = (userId, identity, draft) => {
  if (!userId || !identity) return;
  try {
    window.localStorage.setItem(keyFor(userId, identity), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the form keeps working without saved progress.
  }
};

export const clearAppraisalDraft = (userId, identity) => {
  if (!userId || !identity) return;
  try { window.localStorage.removeItem(keyFor(userId, identity)); } catch { /* ignore */ }
};

/** Removes every saved draft for a user (sign-out on a shared computer). */
export const clearAllAppraisalDrafts = (userId) => {
  try {
    const prefix = userId ? `${PREFIX}:${userId}:` : `${PREFIX}:`;
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
};

const filled = (value) => value !== '' && value !== null && value !== undefined;

/**
 * Lays saved entries over freshly loaded form state, question by question.
 * Questions that no longer exist (e.g. objectives changed) are ignored;
 * questions the supervisor added are kept.
 */
export const mergeAppraisalProgress = (fresh, saved, { strictObjectivePlan = false } = {}) => {
  if (!saved) return fresh;
  const savedSections = new Map((saved.sections || []).map((section) => [String(section.id), section]));

  const sections = fresh.sections.map((section) => {
    const before = savedSections.get(String(section.id));
    if (!before) return section;
    const lockedObjectiveSection = strictObjectivePlan && section.type === 'kpi' && Number(section.objective_setup_enabled) === 1;
    const savedQuestions = new Map((before.questions || []).map((question) => [question.local_id, question]));
    const questions = section.questions.map((question) => {
      const old = savedQuestions.get(question.local_id);
      if (!old) return question;
      return {
        ...question,
        rating_comment: old.rating_comment ?? question.rating_comment,
        actual_result: old.actual_result ?? question.actual_result,
        removed: lockedObjectiveSection ? false : !!old.removed,
        ...(!lockedObjectiveSection && old.is_edited ? { question_text: old.question_text, is_edited: true } : {}),
      };
    });
    const freshIds = new Set(questions.map((question) => question.local_id));
    const added = lockedObjectiveSection ? [] : (before.questions || []).filter((question) => question.is_custom && !freshIds.has(question.local_id));
    return {
      ...section,
      questions: [...questions, ...added],
      overall_rating: lockedObjectiveSection ? section.overall_rating : filled(before.overall_rating) ? before.overall_rating : section.overall_rating,
      overall_rating_comment: before.overall_rating_comment || section.overall_rating_comment,
    };
  });

  const known = new Map(sections.map((section) => [String(section.id), new Set(section.questions.map((question) => question.local_id))]));
  const lockedObjectiveIds = new Set(strictObjectivePlan ? sections.filter((section) => section.type === 'kpi' && Number(section.objective_setup_enabled) === 1).map((section) => String(section.id)) : []);
  const perQuestion = (freshMap = {}, savedMap = {}, keepConfigured = false) => {
    const next = { ...freshMap };
    Object.entries(savedMap || {}).forEach(([sectionId, values]) => {
      const ids = known.get(String(sectionId));
      if (!ids || !values || typeof values !== 'object' || (keepConfigured && lockedObjectiveIds.has(String(sectionId)))) return;
      next[sectionId] = { ...(next[sectionId] || {}) };
      Object.entries(values).forEach(([localId, value]) => {
        if (ids.has(localId) && filled(value)) next[sectionId][localId] = value;
      });
    });
    return next;
  };
  const perSection = (freshMap = {}, savedMap = {}, keepConfigured = false) => {
    const next = { ...freshMap };
    Object.entries(savedMap || {}).forEach(([sectionId, value]) => {
      if (known.has(String(sectionId)) && filled(value) && !(keepConfigured && lockedObjectiveIds.has(String(sectionId)))) next[sectionId] = value;
    });
    return next;
  };
  const pickFilled = (freshObj, savedObj) => {
    const next = { ...freshObj };
    Object.entries(savedObj || {}).forEach(([key, value]) => {
      if (key in next && filled(value)) next[key] = value;
    });
    return next;
  };

  return {
    sections,
    ratings: perQuestion(fresh.ratings, saved.ratings),
    ratingModes: perSection(fresh.ratingModes, saved.ratingModes, true),
    sectionOverallRatings: perSection(fresh.sectionOverallRatings, saved.sectionOverallRatings, true),
    sectionOverallComments: perSection(fresh.sectionOverallComments, saved.sectionOverallComments),
    questionWeightingModes: perSection(fresh.questionWeightingModes, saved.questionWeightingModes, true),
    questionWeights: perQuestion(fresh.questionWeights, saved.questionWeights, true),
    breach: pickFilled(fresh.breach, saved.breach),
    recommendations: pickFilled(fresh.recommendations, saved.recommendations),
  };
};
