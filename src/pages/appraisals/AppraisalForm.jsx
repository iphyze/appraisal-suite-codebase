import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatNumber, formatScore, parseLocalizedNumber, currentFormatLocale } from '../../utils/format';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageNav from '../../components/PageNav';
import AppIcon from '../../components/ui/AppIcon';
import { AlertCircle, ArrowRight, Info, Layers, ListChecks, Percent, Plus, RefreshCw, Scale, Trash2, Undo2, UnlockKeyhole } from 'lucide-react';
import RatingField from './RatingField';
import ObjectiveSetupModal from './ObjectiveSetupModal';
import AppraisalHelpTip from './AppraisalHelpTip';
import AiWritingModal from '../../components/ai/AiWritingModal';
import AiDevelopmentModal from '../../components/ai/AiDevelopmentModal';
import { getAiWritingStatus, getAiDevelopmentStatus, getAiFairnessStatus, runAiFairnessCheck } from '../../services/aiAssistant';
import FairnessCheckModal from '../../components/ai/FairnessCheckModal';
import { fairnessFindings } from '../../utils/fairnessRules';
import { Sparkles } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useAppraisalsStore from '../../stores/useAppraisalsStore';
import useToastStore from '../../stores/useToastStore';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import AppraisalShell from './AppraisalShell';
import { dash } from './helpers';
import { clearAppraisalDraft, mergeAppraisalProgress, readAppraisalDraft, writeAppraisalDraft } from '../../utils/appraisalDraft';
import './Appraisals.css';
import { objectiveChangeCounts, objectiveDenialKey, isObjectiveReratingPending, updatesRemaining } from '../../utils/postSubmissionObjectives';

const makeLocalId = () => `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const isConfiguredRating = (rawValue, min, max, step, ratingPoints = []) => {
  if (rawValue === '' || rawValue === null || rawValue === undefined) return false;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < min || value > max) return false;
  const activePoints = (ratingPoints || []).filter((point) => Number(point.is_active ?? 1) === 1);
  if (activePoints.length) {
    return activePoints.some((point) => Math.abs(Number(point.rating_value) - value) <= 0.0001);
  }
  return Math.abs(((value - min) / step) - Math.round((value - min) / step)) <= 0.001;
};

const ratingPointFor = (value, ratingPoints = []) => (ratingPoints || []).find((point) => (
  Number(point.is_active ?? 1) === 1 && Math.abs(Number(point.rating_value) - Number(value)) <= 0.0001
));

const evaluationStatement = (score, ratingBands = []) => {
  const value = safeNumber(score);
  const band = (ratingBands || []).find((item) => (
    value >= safeNumber(item.min_score) - 0.0001 && value <= safeNumber(item.max_score) + 0.0001
  ));
  return band?.label || i18n.t('view.unrated', { ns: 'appraisals' });
};

const hasCompleteConfiguredKpiWeights = (section = {}) => {
  if (section.type !== 'kpi') return false;
  const questions = (section.questions || []).filter((question) => !question.removed);
  if (!questions.length) return false;

  const weights = questions.map((question) => safeNumber(question.question_weight ?? question.suggested_weight));
  const total = roundedWeight(weights.reduce((sum, value) => sum + value, 0));
  const requiredTotal = Number(section.objective_setup_enabled) === 1 && Number(section.objective_require_weights) === 1
    ? safeNumber(section.objective_required_weight_total, 100)
    : 100;
  return weights.every((value) => value > 0 && value <= 100) && Math.abs(total - requiredTotal) <= 0.01;
};

const normalizeSectionsForUi = (sections = [], isNewAppraisal = false) => sections.map((section) => {
  const questions = (section.questions || []).map((question) => ({
    ...question,
    local_id: `${section.id}-${question.question_id}`,
    original_question_text: question.question_text_source ?? question.question_text,
    // KPI text can be edited by a supervisor: the editor and submission must
    // begin with the English source, never its translated display value.
    question_text_display: question.question_text,
    question_text: question.question_type === 'kpi'
      ? (question.question_text_source ?? question.question_text)
      : question.question_text,
    removed: false,
    is_custom: false,
    is_edited: false,
  }));
  const normalized = { ...section, questions };
  const configuredKpiWeights = isNewAppraisal && hasCompleteConfiguredKpiWeights(normalized);

  return {
    ...normalized,
    // New KPI sections with a complete Admin-configured 100% weight set open in
    // per-question/custom mode. Other new sections retain the cumulative default.
    // Existing appraisals always retain the exact mode saved with the appraisal.
    rating_mode: (isNewAppraisal && Number(section.objective_setup_enabled) === 1 && Number(section.objective_force_per_question_ratings) === 1)
      ? 'per_question'
      : (configuredKpiWeights
        ? 'per_question'
        : (isNewAppraisal
          ? (section.default_rating_mode === 'per_question' ? 'per_question' : 'overall')
          : (section.rating_mode === 'overall' ? 'overall' : 'per_question'))),
    question_weighting_mode: (isNewAppraisal && Number(section.objective_setup_enabled) === 1 && Number(section.objective_require_weights) === 1)
      ? 'custom'
      : (configuredKpiWeights
        ? 'custom'
        : (section.question_weighting_mode === 'custom' ? 'custom' : 'equal')),
    overall_rating: section.overall_rating ?? '',
    overall_rating_comment: section.overall_rating_comment ?? '',
  };
});

const buildInitialRatings = (sections = []) => {
  const next = {};
  sections.forEach((section) => {
    next[section.id] = {};
    (section.questions || []).forEach((question) => {
      next[section.id][question.local_id] = question.rating !== '' && question.rating != null ? Number(question.rating) : '';
    });
  });
  return next;
};

const buildInitialModes = (sections = []) => sections.reduce((next, section) => {
  next[section.id] = section.rating_mode === 'overall' ? 'overall' : 'per_question';
  return next;
}, {});

const buildInitialOverallRatings = (sections = []) => sections.reduce((next, section) => {
  next[section.id] = section.overall_rating !== '' && section.overall_rating != null
    ? Number(section.overall_rating)
    : '';
  return next;
}, {});

const buildInitialOverallComments = (sections = []) => sections.reduce((next, section) => {
  next[section.id] = section.overall_rating_comment || '';
  return next;
}, {});

const buildInitialWeightingModes = (sections = []) => sections.reduce((next, section) => {
  next[section.id] = section.type === 'kpi' && section.question_weighting_mode === 'custom' ? 'custom' : 'equal';
  return next;
}, {});

const buildInitialQuestionWeights = (sections = []) => sections.reduce((next, section) => {
  next[section.id] = {};
  (section.questions || []).forEach((question) => {
    const configured = question.question_weight ?? question.suggested_weight;
    next[section.id][question.local_id] = configured !== null && configured !== undefined && configured !== ''
      ? Number(configured)
      : '';
  });
  return next;
}, {});

const roundedWeight = (value) => Math.round(safeNumber(value) * 100) / 100;

const AppraisalDockScore = ({ score, answered, total, ratingBands }) => {
  const { t, i18n } = useTranslation('appraisals');
  const locale = i18n.resolvedLanguage || i18n.language;
  const value = safeNumber(score);
  return (
    <div className="apr-action-dock__score" aria-live="polite">
      <span>{t('form.liveOverallScore')}</span>
      <strong>{answered === 0 ? '—' : formatScore(value, locale)}</strong>
      <div>
        <small>{answered === 0 ? t('form.notRatedYet') : evaluationStatement(score, ratingBands)}</small>
        <em>{t('form.ratedCount', { answered, total })}</em>
      </div>
    </div>
  );
};

const savedTimeLabel = (timestamp, t, locale) => {
  const date = new Date(Number(timestamp) || Date.now());
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = new Intl.DateTimeFormat(currentFormatLocale(locale), { hour: 'numeric', minute: '2-digit' }).format(date);
  return sameDay
    ? t('form.savedAtTime', { time })
    : t('form.savedOnDate', { date: formatDate(date, { day: 'numeric', month: 'short' }, locale), time });
};

const AppraisalForm = ({ mode = 'create' }) => {
  const { t, i18n } = useTranslation('appraisals');
  const locale = i18n.resolvedLanguage || i18n.language;
  const isEdit = mode === 'edit';
  const { id, staffUserId, cycleId: routeCycleId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from === '/my-team-appraisals' ? '/my-team-appraisals' : '/appraisals';
  const returnLabel = returnTo === '/my-team-appraisals' ? t('list.teamPageTitle') : t('list.pageTitle');
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const formRef = useRef(null);

  const { formData, formLoading, saving, fetchFormData, createAppraisal, updateAppraisal, error: formError } = useAppraisalsStore();
  // Which appraisal this screen is for. The shared store may still hold another
  // employee's form from an earlier visit, so data is only used when it matches.
  const routeStaffId = Number(staffUserId || searchParams.get('staff_user_id') || 0);
  const routeCycle = Number(routeCycleId || searchParams.get('cycle_id') || 0);
  const identity = isEdit ? (id ? `edit:${Number(id)}` : '') : (routeStaffId && routeCycle ? `create:${routeStaffId}:${routeCycle}` : '');
  const dataIdentity = !formData ? '' : (isEdit
    ? (formData.appraisal?.id ? `edit:${Number(formData.appraisal.id)}` : '')
    : `create:${Number(formData.staff?.id || 0)}:${Number(formData.cycle?.id || 0)}`);
  const dataMatches = !!formData && (!identity || dataIdentity === identity);
  const draftIdentity = identity || dataIdentity;
  const [sectionsUi, setSectionsUi] = useState([]);
  const [ratings, setRatings] = useState({});
  const [ratingModes, setRatingModes] = useState({});
  const [sectionOverallRatings, setSectionOverallRatings] = useState({});
  const [sectionOverallComments, setSectionOverallComments] = useState({});
  const [questionWeightingModes, setQuestionWeightingModes] = useState({});
  const [questionWeights, setQuestionWeights] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [writingEnabled, setWritingEnabled] = useState(false);
  const [writingContext, setWritingContext] = useState(null);
  const [developmentEnabled, setDevelopmentEnabled] = useState(false);
  const [developmentOpen, setDevelopmentOpen] = useState(false);
  // Fairness check before submit: free rule checks, plus an optional AI wording review.
  const [fairness, setFairness] = useState({ enabled: false, ai_available: false });
  const [fairnessReview, setFairnessReview] = useState(null);
  const fairnessCleared = useRef(false);
  useEffect(() => {
    let active = true;
    if (['supervisor', 'admin'].includes(user?.role)) {
      getAiFairnessStatus().then((status) => { if (active && status) setFairness(status); }).catch(() => {});
    }
    return () => { active = false; };
  }, [user?.role]);
  useEffect(() => {
    let active = true;
    getAiWritingStatus().then((status) => { if (active) setWritingEnabled(!!status?.enabled); }).catch(() => {});
    getAiDevelopmentStatus().then((status) => { if (active) setDevelopmentEnabled(!!status?.enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [objectiveEditorSectionId, setObjectiveEditorSectionId] = useState(null);
  const [showOptionalActualResults, setShowOptionalActualResults] = useState(false);
  const [showOptionalRatingComments, setShowOptionalRatingComments] = useState(false);
  const optionalDisplayInitializedRef = useRef(false);
  const [breachDeclaration, setBreachDeclaration] = useState({
    serious_breach_declared: '',
    serious_breach_reason: '',
    serious_breach_reference: '',
  });
  const [recommendations, setRecommendations] = useState({
    status_upgrade: '',
    salary_upgrade: '',
    development: '',
    notify_staff: false,
  });

  useEffect(() => {
    document.title = t('form.documentTitle', { action: isEdit ? t('form.editAppraisal') : t('form.createAppraisal') });
  }, [isEdit, t]);

  const loadForm = () => {
    if (isEdit && id) return fetchFormData({ appraisal_id: id });
    return fetchFormData({ cycle_id: routeCycle || null, staff_user_id: routeStaffId || null });
  };

  useEffect(() => {
    // Never show (or submit) another employee's form left in the shared store.
    const stored = useAppraisalsStore.getState().formData;
    if (stored && identity) {
      const storedIdentity = isEdit
        ? (stored.appraisal?.id ? `edit:${Number(stored.appraisal.id)}` : '')
        : `create:${Number(stored.staff?.id || 0)}:${Number(stored.cycle?.id || 0)}`;
      if (storedIdentity !== identity) useAppraisalsStore.setState({ formData: null });
    }
    loadForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, isEdit, fetchFormData, i18n.resolvedLanguage]);

  // ---- Progress kept across refreshes, idle time and re-login (saved on this device) ----
  const initializedForRef = useRef('');
  const baselineRef = useRef('');
  const planSignatureRef = useRef(null);
  const submittedRef = useRef(false);
  const progressRef = useRef(null);
  const [draftNotice, setDraftNotice] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const freshStateFrom = (data) => {
    const nextSections = normalizeSectionsForUi(data.sections || [], !isEdit);
    return {
      sections: nextSections,
      ratings: buildInitialRatings(nextSections),
      ratingModes: buildInitialModes(nextSections),
      sectionOverallRatings: buildInitialOverallRatings(nextSections),
      sectionOverallComments: buildInitialOverallComments(nextSections),
      questionWeightingModes: buildInitialWeightingModes(nextSections),
      questionWeights: buildInitialQuestionWeights(nextSections),
      breach: {
        serious_breach_declared: data.appraisal?.serious_breach_declared == null
          ? '' : Number(data.appraisal.serious_breach_declared) === 1 ? 'yes' : 'no',
        serious_breach_reason: data.appraisal?.serious_breach_reason || '',
        serious_breach_reference: data.appraisal?.serious_breach_reference || '',
      },
      recommendations: {
        status_upgrade: data.appraisal?.status_upgrade || '',
        salary_upgrade: data.appraisal?.salary_upgrade || '',
        development: data.appraisal?.development || '',
        notify_staff: false,
      },
    };
  };
  /** Only what the supervisor can change: keeps saved drafts small. */
  const progressSnapshot = (state) => ({
    sections: (state.sections || []).map((section) => ({
      id: section.id,
      overall_rating: section.overall_rating,
      overall_rating_comment: section.overall_rating_comment,
      questions: (section.questions || []).map((question) => (question.is_custom
        ? question
        : {
          local_id: question.local_id,
          rating_comment: question.rating_comment ?? '',
          actual_result: question.actual_result ?? '',
          removed: !!question.removed,
          is_edited: !!question.is_edited,
          ...(question.is_edited ? { question_text: question.question_text } : {}),
        })),
    })),
    ratings: state.ratings,
    ratingModes: state.ratingModes,
    sectionOverallRatings: state.sectionOverallRatings,
    sectionOverallComments: state.sectionOverallComments,
    questionWeightingModes: state.questionWeightingModes,
    questionWeights: state.questionWeights,
    breach: state.breach,
    recommendations: { ...state.recommendations, notify_staff: false },
  });
  const applyState = (state) => {
    setSectionsUi(state.sections);
    setRatings(state.ratings);
    setRatingModes(state.ratingModes);
    setSectionOverallRatings(state.sectionOverallRatings);
    setSectionOverallComments(state.sectionOverallComments);
    setQuestionWeightingModes(state.questionWeightingModes);
    setQuestionWeights(state.questionWeights);
    setBreachDeclaration(state.breach);
    setRecommendations(state.recommendations);
  };
  const discardDraft = () => {
    clearAppraisalDraft(user?.id, draftIdentity);
    setDraftNotice(null);
    setSavedAt(null);
    if (formData && dataMatches) applyState(freshStateFrom(formData));
  };

  useEffect(() => {
    if (!formData || !dataMatches) return;
    let state = freshStateFrom(formData);
    const currentPlanSignature = String(formData.objective_plan_signature || '');
    const pendingNewPlan = isEdit && isObjectiveReratingPending(formData);
    const reloadedWithChangedPlan = planSignatureRef.current !== null && planSignatureRef.current !== currentPlanSignature;
    if (initializedForRef.current === draftIdentity && progressRef.current) {
      // Retain free text and matching question ratings, but never revive deleted
      // objectives, custom KPI rows, old targets or old weights after a relock.
      state = mergeAppraisalProgress(state, progressRef.current, { strictObjectivePlan: pendingNewPlan || reloadedWithChangedPlan });
    } else {
      baselineRef.current = JSON.stringify(progressSnapshot(state));
      const draft = readAppraisalDraft(user?.id, draftIdentity);
      // For an existing appraisal, only restore if nobody has changed it since the draft was saved.
      const baseUpdatedAt = String(formData.appraisal?.updated_at || '');
      if (draft && (!isEdit || String(draft.baseUpdatedAt || '') === baseUpdatedAt)) {
        state = mergeAppraisalProgress(state, draft, { strictObjectivePlan: pendingNewPlan || String(draft.planSignature || '') !== currentPlanSignature });
        setDraftNotice({ savedAt: draft.savedAt });
        setSavedAt(draft.savedAt);
      } else if (draft) {
        clearAppraisalDraft(user?.id, draftIdentity);
      }
    }
    applyState(state);
    initializedForRef.current = draftIdentity;
    planSignatureRef.current = currentPlanSignature;

    if (!optionalDisplayInitializedRef.current) {
      const questions = state.sections.flatMap((section) => section.questions || []);
      setShowOptionalActualResults(questions.some((question) => String(question.actual_result || '').trim()));
      setShowOptionalRatingComments(
        questions.some((question) => String(question.rating_comment || '').trim())
        || state.sections.some((section) => String(section.overall_rating_comment || '').trim())
      );
      optionalDisplayInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, dataMatches]);

  const sections = sectionsUi;
  const staff = formData?.staff || {};
  const cycle = formData?.cycle || {};
  const supervisor = formData?.supervisor || {};
  const updateCount = safeNumber(formData?.appraisal?.update_count);
  const attemptsLeft = updatesRemaining(formData) ?? Math.max(2 + safeNumber(formData?.appraisal?.extra_update_allowance) - updateCount, 0);
  const objectiveRerating = isEdit && isObjectiveReratingPending(formData);
  const objectiveSummary = formData?.objective_change_summary || {};
  const changeCounts = objectiveChangeCounts(objectiveSummary);
  const addedObjectiveIds = new Set((objectiveSummary.added || []).map((item) => `${item.section_id ?? ''}:${Number(item.question_id)}`));
  // The summary flattens section arrays without copying section_id onto each
  // item; include the original per-section references for accurate highlighting.
  (objectiveSummary.sections || []).forEach((section) => (section.added || []).forEach((item) => addedObjectiveIds.add(`${Number(section.section_id)}:${Number(item.question_id)}`)));
  const isConductingAppraiser = ['admin', 'supervisor'].includes(user?.role) && Number(formData?.appraisal?.supervisor_id || supervisor?.id || 0) === Number(user?.id || 0);
  const ratingConfig = formData?.rating_config || {};
  const ratingMin = Number.isFinite(Number(ratingConfig.rating_min)) ? Number(ratingConfig.rating_min) : 1;
  const ratingMax = Number.isFinite(Number(ratingConfig.rating_max)) ? Number(ratingConfig.rating_max) : 5;
  const ratingStep = Number.isFinite(Number(ratingConfig.rating_step)) && Number(ratingConfig.rating_step) > 0
    ? Number(ratingConfig.rating_step)
    : 0.1;
  const ratingBands = Array.isArray(ratingConfig.rating_bands) ? ratingConfig.rating_bands : [];
  const ratingPoints = Array.isArray(ratingConfig.rating_points) ? ratingConfig.rating_points : [];

  progressRef.current = progressSnapshot({
    sections: sectionsUi, ratings, ratingModes, sectionOverallRatings, sectionOverallComments,
    questionWeightingModes, questionWeights, breach: breachDeclaration, recommendations,
  });
  const saveProgressNow = () => {
    if (!initializedForRef.current || initializedForRef.current !== draftIdentity || submittedRef.current || !user?.id) return;
    const text = JSON.stringify(progressRef.current);
    if (text === baselineRef.current) {
      clearAppraisalDraft(user.id, draftIdentity);
      return;
    }
    writeAppraisalDraft(user.id, draftIdentity, {
      ...progressRef.current,
      baseUpdatedAt: String(formData?.appraisal?.updated_at || ''),
      planSignature: String(formData?.objective_plan_signature || ''),
    });
    setSavedAt(Date.now());
  };
  const saveProgressRef = useRef(saveProgressNow);
  saveProgressRef.current = saveProgressNow;
  useEffect(() => {
    if (!initializedForRef.current) return undefined;
    const timer = window.setTimeout(() => saveProgressRef.current(), 700);
    return () => window.clearTimeout(timer);
  }, [sectionsUi, ratings, ratingModes, sectionOverallRatings, sectionOverallComments, questionWeightingModes, questionWeights, breachDeclaration, recommendations]);
  useEffect(() => {
    // Save immediately when the supervisor switches tab, minimises or leaves.
    const flush = () => { if (document.visibilityState === 'hidden') saveProgressRef.current(); };
    const onLeave = () => saveProgressRef.current();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', onLeave);
      saveProgressRef.current();
    };
  }, []);

  const refreshCurrentForm = async () => loadForm();

  const visibleQuestions = useMemo(
    () => sections.flatMap((section) => (section.questions || []).filter((question) => !question.removed).map((question) => ({ section, question }))),
    [sections]
  );

  const hasOptionalActualResults = useMemo(() => sections.some((section) => (
    section.type === 'kpi' && Number(section.objective_require_actual_result) !== 1
  )), [sections]);

  const hasOptionalRatingComments = useMemo(() => sections.some((section) => (
    ratingModes[section.id] === 'overall'
      ? Number(ratingPointFor(sectionOverallRatings[section.id], ratingPoints)?.requires_comment || 0) !== 1
      : (section.questions || []).filter((question) => !question.removed).some((question) => (
        Number(ratingPointFor(ratings?.[section.id]?.[question.local_id], ratingPoints)?.requires_comment || 0) !== 1
      ))
  )), [sections, ratingModes, sectionOverallRatings, ratings, ratingPoints]);

  const totalRatingInputs = useMemo(() => sections.reduce((total, section) => (
    total + (ratingModes[section.id] === 'overall'
      ? 1
      : (section.questions || []).filter((question) => !question.removed).length)
  ), 0), [sections, ratingModes]);

  const answeredRatingInputs = useMemo(() => sections.reduce((total, section) => {
    if (ratingModes[section.id] === 'overall') {
      return total + (isConfiguredRating(sectionOverallRatings[section.id], ratingMin, ratingMax, ratingStep, ratingPoints) ? 1 : 0);
    }

    const rated = (section.questions || []).filter((question) => !question.removed)
      .filter((question) => {
        return isConfiguredRating(ratings?.[section.id]?.[question.local_id], ratingMin, ratingMax, ratingStep, ratingPoints);
      }).length;

    return total + rated;
  }, 0), [sections, ratingModes, sectionOverallRatings, ratings, ratingMin, ratingMax, ratingStep, ratingPoints]);

  const scorePreview = useMemo(() => {
    let summary = 0;
    sections.forEach((section) => {
      if (ratingModes[section.id] === 'overall') {
        const overall = Number(sectionOverallRatings[section.id] || 0);
        if (isConfiguredRating(sectionOverallRatings[section.id], ratingMin, ratingMax, ratingStep, ratingPoints)) summary += overall * (safeNumber(section.weight) / 100);
        return;
      }

      const active = (section.questions || []).filter((question) => !question.removed);
      const useCustomWeights = section.type === 'kpi' && questionWeightingModes[section.id] === 'custom';

      if (useCustomWeights) {
        let ratedWeightTotal = 0;
        let weightedRatingTotal = 0;

        active.forEach((question) => {
          const rating = safeNumber(ratings?.[section.id]?.[question.local_id]);
          const weight = safeNumber(questionWeights?.[section.id]?.[question.local_id]);
          if (!isConfiguredRating(ratings?.[section.id]?.[question.local_id], ratingMin, ratingMax, ratingStep, ratingPoints) || weight <= 0) return;
          ratedWeightTotal += weight;
          weightedRatingTotal += rating * (weight / 100);
        });

        if (ratedWeightTotal > 0) {
          const weightedAverage = weightedRatingTotal / (ratedWeightTotal / 100);
          summary += weightedAverage * (safeNumber(section.weight) / 100);
        }
        return;
      }

      const sectionRatings = active
        .map((question) => safeNumber(ratings?.[section.id]?.[question.local_id]))
        .filter((rating) => isConfiguredRating(rating, ratingMin, ratingMax, ratingStep, ratingPoints));
      if (!sectionRatings.length) return;
      const avg = sectionRatings.reduce((sum, value) => sum + value, 0) / sectionRatings.length;
      summary += avg * (safeNumber(section.weight) / 100);
    });
    return Math.round(summary * 100) / 100;
  }, [sections, ratings, ratingModes, sectionOverallRatings, questionWeightingModes, questionWeights, ratingMin, ratingMax, ratingStep, ratingPoints]);


  const previousDeclaration = formData?.appraisal || {};
  const breachReviewStatus = String(previousDeclaration.serious_breach_review_status || 'not_required');
  const breachDeclarationLocked = isEdit && Number(previousDeclaration.breach_cap_active) === 1
    && ['pending', 'confirmed'].includes(breachReviewStatus);
  const breachEvidenceLocked = breachDeclarationLocked && breachReviewStatus === 'confirmed';
  const unchangedDismissedBreach = isEdit
    && previousDeclaration.serious_breach_review_status === 'dismissed'
    && Number(previousDeclaration.breach_cap_active) === 0
    && Number(previousDeclaration.serious_breach_declared) === 1
    && breachDeclaration.serious_breach_declared === 'yes'
    && breachDeclaration.serious_breach_reason.trim() === String(previousDeclaration.serious_breach_reason || '').trim()
    && breachDeclaration.serious_breach_reference.trim() === String(previousDeclaration.serious_breach_reference || '').trim();
  const scoreCapApplies = (breachDeclaration.serious_breach_declared === 'yes' && !unchangedDismissedBreach)
    || (isEdit && Number(previousDeclaration.breach_cap_active) === 1);
  const finalScorePreview = scoreCapApplies ? Math.min(scorePreview, 2) : scorePreview;

  const setRating = (sectionId, localId, value) => {
    setRatings((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || {}),
        [localId]: value,
      },
    }));
  };

  const setRatingMode = (sectionId, mode) => {
    setRatingModes((prev) => ({ ...prev, [sectionId]: mode }));
    setSubmitted(false);
  };

  const setOverallRating = (sectionId, value) => {
    setSectionOverallRatings((prev) => ({ ...prev, [sectionId]: value }));
  };

  const setQuestionWeightingMode = (sectionId, mode) => {
    setQuestionWeightingModes((prev) => ({ ...prev, [sectionId]: mode === 'custom' ? 'custom' : 'equal' }));
    setSubmitted(false);
  };

  const setQuestionWeight = (sectionId, localId, value) => {
    const parsed = parseLocalizedNumber(value);
    const normalized = parsed !== null ? String(parsed) : (value || '').replace(',', '.');
    setQuestionWeights((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || {}),
        [localId]: normalized,
      },
    }));
  };

  const distributeKpiWeightsEqually = (sectionId) => {
    const section = sections.find((item) => String(item.id) === String(sectionId));
    const active = (section?.questions || []).filter((question) => !question.removed);
    if (!active.length) return;

    const requiredTotal = Number(section?.objective_setup_enabled) === 1 && Number(section?.objective_require_weights) === 1
      ? safeNumber(section?.objective_required_weight_total, 100)
      : 100;
    const hundredths = Math.round(requiredTotal * 100);
    const base = Math.floor(hundredths / active.length);
    const remainder = hundredths - (base * active.length);
    const distributed = {};

    active.forEach((question, index) => {
      distributed[question.local_id] = (base + (index < remainder ? 1 : 0)) / 100;
    });

    setQuestionWeights((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), ...distributed },
    }));
    setSubmitted(false);
  };

  const getQuestionWeightSummary = (section) => {
    const active = (section.questions || []).filter((question) => !question.removed);
    const weights = active.map((question) => safeNumber(questionWeights?.[section.id]?.[question.local_id]));
    const total = roundedWeight(weights.reduce((sum, value) => sum + value, 0));
    const missing = weights.filter((value) => value <= 0 || value > 100).length;
    const requiredTotal = Number(section.objective_setup_enabled) === 1 && Number(section.objective_require_weights) === 1
      ? safeNumber(section.objective_required_weight_total, 100)
      : 100;
    return {
      total,
      requiredTotal,
      missing,
      remaining: roundedWeight(requiredTotal - total),
      valid: missing === 0 && Math.abs(total - requiredTotal) <= 0.01,
    };
  };

  const updateKpiQuestionText = (sectionId, localId, value) => {
    setSectionsUi((prev) => prev.map((section) => {
      if (String(section.id) !== String(sectionId)) return section;
      return {
        ...section,
        questions: (section.questions || []).map((question) => {
          if (question.local_id !== localId) return question;
          return {
            ...question,
            question_text: value,
            is_edited: question.original_question_text !== value,
          };
        }),
      };
    }));
  };

  const updateQuestionResponseField = (sectionId, localId, field, value) => {
    setSectionsUi((prev) => prev.map((section) => {
      if (String(section.id) !== String(sectionId)) return section;
      return {
        ...section,
        questions: (section.questions || []).map((question) => question.local_id === localId ? { ...question, [field]: value } : question),
      };
    }));
    setSubmitted(false);
  };

  const removeKpiQuestion = (sectionId, localId) => {
    setSectionsUi((prev) => prev.map((section) => {
      if (String(section.id) !== String(sectionId)) return section;
      return {
        ...section,
        questions: (section.questions || []).map((question) => question.local_id === localId ? { ...question, removed: true } : question),
      };
    }));
  };

  const restoreKpiQuestion = (sectionId, localId) => {
    setSectionsUi((prev) => prev.map((section) => {
      if (String(section.id) !== String(sectionId)) return section;
      return {
        ...section,
        questions: (section.questions || []).map((question) => question.local_id === localId ? { ...question, removed: false } : question),
      };
    }));
  };

  const addKpiQuestion = (sectionId) => {
    const localId = makeLocalId();
    setSectionsUi((prev) => prev.map((section) => {
      if (String(section.id) !== String(sectionId)) return section;
      return {
        ...section,
        questions: [
          ...(section.questions || []),
          {
            id: localId,
            question_id: 0,
            local_id: localId,
            question_type: 'kpi',
            question_text: '',
            original_question_text: '',
            sort_order: (section.questions || []).length + 1,
            scope: 'individual',
            rating: '',
            actual_result: '',
            rating_comment: '',
            is_custom: true,
            is_edited: true,
            removed: false,
          },
        ],
      };
    }));
    setRatings((prev) => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [localId]: '' } }));
    setQuestionWeights((prev) => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [localId]: '' } }));
    window.setTimeout(() => {
      const field = formRef.current?.querySelector(`[data-kpi-local-id="${localId}"] textarea`);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
    }, 60);
  };

  const buildSectionsPayload = () => sections.map((section) => {
    const ratingMode = ratingModes[section.id] === 'overall' ? 'overall' : 'per_question';
    const questionWeightingMode = section.type === 'kpi' && ratingMode === 'per_question' && questionWeightingModes[section.id] === 'custom'
      ? 'custom'
      : 'equal';

    return {
      section_id: Number(section.id),
      rating_mode: ratingMode,
      question_weighting_mode: questionWeightingMode,
      overall_rating: ratingMode === 'overall' ? Number(sectionOverallRatings[section.id] || 0) : null,
      overall_rating_comment: ratingMode === 'overall' ? (sectionOverallComments[section.id] || null) : null,
      responses: (section.questions || [])
        .filter((question) => !question.removed)
        .map((question) => ({
          question_id: Number(question.question_id || 0),
          question_text: (question.is_edited || question.is_custom)
            ? question.question_text
            : (question.original_question_text ?? question.question_text),
          sort_order: Number(question.sort_order || 0),
          is_custom: !!question.is_custom,
          is_edited: !!question.is_edited,
          objective_target: question.objective_target || null,
          evidence_source: question.evidence_source || null,
          actual_result: question.actual_result || null,
          rating_comment: question.rating_comment || null,
          question_weight: questionWeightingMode === 'custom'
            ? Number(questionWeights?.[section.id]?.[question.local_id] || 0)
            : null,
          rating: ratingMode === 'overall' ? null : Number(ratings?.[section.id]?.[question.local_id] || 0),
        })),
    };
  });


  const validate = () => {
    const errors = [];
    sections.forEach((section) => {
      const activeQuestions = (section.questions || []).filter((question) => !question.removed);
      if (!activeQuestions.length) {
        errors.push(t('form.errorSectionMissingQuestions', { code: section.code }));
        return;
      }

      activeQuestions.forEach((question) => {
        if (section.type === 'kpi' && !String(question.question_text || '').trim()) {
          errors.push(t('form.errorKpiText', { code: section.code }));
        }
        if (section.type === 'kpi' && Number(section.objective_require_actual_result) === 1 && !String(question.actual_result || '').trim()) {
          errors.push(t('form.errorActualResult', { code: section.code, question: String(question.question_text || t('form.objective')).trim() }));
        }
      });

      if (ratingModes[section.id] === 'overall') {
        if (!isConfiguredRating(sectionOverallRatings[section.id], ratingMin, ratingMax, ratingStep, ratingPoints)) errors.push(t('form.errorOverallRating', { code: section.code }));
        const overallPoint = ratingPointFor(sectionOverallRatings[section.id], ratingPoints);
        if (Number(overallPoint?.requires_comment || 0) === 1 && !String(sectionOverallComments[section.id] || '').trim()) {
          errors.push(t('form.errorOverallComment', { code: section.code }));
        }
        return;
      }

      if (section.type === 'kpi' && questionWeightingModes[section.id] === 'custom') {
        activeQuestions.forEach((question) => {
          const weight = safeNumber(questionWeights?.[section.id]?.[question.local_id]);
          if (weight <= 0 || weight > 100) {
            errors.push(t('form.errorWeight', { code: section.code, question: String(question.question_text || t('form.kpiQuestion')).trim() || t('form.kpiQuestion') }));
          }
        });
        const summary = getQuestionWeightSummary(section);
        if (Math.abs(summary.total - summary.requiredTotal) > 0.01) {
          errors.push(t('form.errorWeightTotal', { code: section.code, total: formatNumber(summary.requiredTotal, { maximumFractionDigits: 2 }, locale) }));
        }
      }

      activeQuestions.forEach((question) => {
        const questionText = String(question.question_text || '').trim();
        const rating = ratings?.[section.id]?.[question.local_id];
        if (!isConfiguredRating(rating, ratingMin, ratingMax, ratingStep, ratingPoints)) {
          errors.push(t('form.errorQuestionRating', { code: section.code, question: questionText || question.question_text || t('form.question') }));
          return;
        }
        const point = ratingPointFor(rating, ratingPoints);
        if (Number(point?.requires_comment || 0) === 1 && !String(question.rating_comment || '').trim()) {
          errors.push(t('form.errorQuestionComment', { code: section.code, question: questionText || t('form.thisRating') }));
        }
      });
    });

    if (!['yes', 'no'].includes(breachDeclaration.serious_breach_declared)) {
      errors.push(t('form.errorBreachChoice'));
    }
    if (breachDeclaration.serious_breach_declared === 'yes') {
      if (!breachDeclaration.serious_breach_reason.trim()) errors.push(t('form.errorBreachReason'));
      if (!breachDeclaration.serious_breach_reference.trim()) errors.push(t('form.errorBreachReference'));
      if (breachDeclaration.serious_breach_reason.length > 5000) errors.push(t('form.errorBreachReasonLong'));
      if (breachDeclaration.serious_breach_reference.length > 500) errors.push(t('form.errorBreachReferenceLong'));
    }

    if (!String(recommendations.status_upgrade || '').trim()) {
      errors.push(t('form.errorStatusUpgrade'));
    }
    if (!String(recommendations.salary_upgrade || '').trim()) {
      errors.push(t('form.errorSalaryUpgrade'));
    }
    if (!String(recommendations.development || '').trim()) {
      errors.push(t('form.errorDevelopment'));
    }

    return errors;
  };

  const errors = submitted ? validate() : [];

  // Questions in the shape the fairness check needs (no names).
  const fairnessItems = () => sections.flatMap((section) => {
    if (ratingModes[section.id] === 'overall') return [];
    return (section.questions || []).filter((question) => !question.removed).map((question) => {
      const rating = Number(ratings?.[section.id]?.[question.local_id] || 0);
      return {
        ref: String(question.local_id), section: `${section.code} ${section.label || ''}`.trim(),
        question: String(question.question_text || '').trim(), rating,
        label: ratingPointFor(rating, ratingPoints)?.label || '', comment: String(question.rating_comment || ''),
      };
    });
  });
  const currentFairnessFindings = () => fairnessFindings({
    items: fairnessItems(), ratingMin, ratingMax,
    breachDeclared: breachDeclaration.serious_breach_declared === 'yes',
    recommendations, score: finalScorePreview,
  });
  const openFairnessReview = () => setFairnessReview(currentFairnessFindings());
  const runFairnessAi = async () => {
    const result = await runAiFairnessCheck({
      items: fairnessItems().filter((item) => item.rating > 0).slice(0, 80),
      score: finalScorePreview,
      breach: { declared: breachDeclaration.serious_breach_declared === 'yes', reason: breachDeclaration.serious_breach_reason },
      recommendations: { status_upgrade: recommendations.status_upgrade, salary_upgrade: recommendations.salary_upgrade, development: recommendations.development },
    });
    return result?.findings || [];
  };
  const goToFairnessItem = (ref) => {
    setFairnessReview(null);
    if (ref === 'recommendations') {
      formRef.current?.querySelector('[data-fairness-target="recommendations"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setShowOptionalRatingComments(true);
    window.setTimeout(() => {
      const row = formRef.current?.querySelector(`[data-kpi-local-id="${CSS.escape(String(ref))}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row?.querySelector('textarea[data-rating-comment]')?.focus({ preventScroll: true });
    }, 80);
  };

  const handleSubmit = async (event) => {
    if (!dataMatches) {
      event?.preventDefault?.();
      showToast(t('form.stillLoading'), 'info');
      return;
    }
    event?.preventDefault?.();
    setSubmitted(true);
    const validationErrors = validate();
    if (validationErrors.length) {
      notifyAndFocusFormErrors(
        formRef.current,
        showToast,
        t('form.validationIssues', { count: validationErrors.length })
      );
      return;
    }
    if (fairness.enabled && !fairnessCleared.current) {
      const found = currentFairnessFindings();
      if (found.length) {
        setFairnessReview(found);
        return;
      }
    }
    fairnessCleared.current = false;

    const payload = {
      cycle_id: Number(cycle.id),
      staff_user_id: Number(staff.id),
      sections: buildSectionsPayload(),
      serious_breach_declared: breachDeclaration.serious_breach_declared === 'yes',
      serious_breach_reason: breachDeclaration.serious_breach_declared === 'yes' ? breachDeclaration.serious_breach_reason.trim() : null,
      serious_breach_reference: breachDeclaration.serious_breach_declared === 'yes' ? breachDeclaration.serious_breach_reference.trim() : null,
      status_upgrade: recommendations.status_upgrade,
      salary_upgrade: recommendations.salary_upgrade,
      development: recommendations.development,
      notify_staff: isEdit ? recommendations.notify_staff : true,
      ...(isEdit && objectiveRerating ? { objective_plan_signature: formData.objective_plan_signature } : {}),
    };

    const result = isEdit
      ? await updateAppraisal({ ...payload, id: Number(id) })
      : await createAppraisal(payload);

    if (!result.success) {
      saveProgressRef.current();
      return;
    }
    submittedRef.current = true;
    clearAppraisalDraft(user?.id, draftIdentity);

    const appraisalId = result?.data?.data?.appraisal_id
      || result?.data?.data?.id
      || result?.data?.appraisal_id
      || result?.data?.id
      || (isEdit ? id : null);

    if (!appraisalId) {
      showToast(t('form.savedNoReference'), 'info');
      navigate(returnTo, { replace: true });
      return;
    }

    navigate(`/appraisals/view/${appraisalId}`, { replace: true, state: { from: returnTo } });
  };

  // Keep the form on screen while the same appraisal reloads; only wait when the data is not this appraisal's.
  if (!dataMatches) {
    return (
      <AppraisalShell>
        <PageNav pageTitle={isEdit ? t('form.editAppraisal') : t('form.createAppraisal')} links={[{ label: returnLabel, to: returnTo, active: true }, { label: isEdit ? t('form.edit') : t('form.create') }]} />
        {formLoading || !formError ? (
          <div className="apr-card apr-loading-panel" role="status" aria-label={t('form.loadingAppraisal')}><span className="apr-row-skeleton" /><span className="apr-row-skeleton" /><span className="apr-row-skeleton" /></div>
        ) : (
          <div className="apr-card apr-form-retry" role="alert">
            <AppIcon icon={AlertCircle} size={20} />
            <div>
              <strong>{t('form.loadingFailed')}</strong>
              <p>{formError} {t('form.loadRetryDetail')}</p>
            </div>
            <button type="button" className="apr-btn apr-btn--primary" onClick={() => loadForm()}><AppIcon icon={RefreshCw} /> {t('form.tryAgain')}</button>
          </div>
        )}
      </AppraisalShell>
    );
  }

  return (
    <AppraisalShell>
      <PageNav
        pageTitle={isEdit ? t('form.editAppraisal') : t('form.createAppraisal')}
        links={[{ label: returnLabel, to: returnTo, active: true }, { label: isEdit ? t('form.editAppraisal') : t('form.createAppraisal') }]}
      />

      <form ref={formRef} className="apr-form" onSubmit={handleSubmit} noValidate>
        {draftNotice && (
          <div className="apr-draft-banner" role="status">
            <AppIcon icon={Undo2} size={18} />
            <div>
              <strong>{t('form.restored')}</strong>
              <span>{t('form.draftRestoredDetail', { when: savedTimeLabel(draftNotice.savedAt, t, locale) })}</span>
            </div>
            <div className="apr-draft-banner__actions">
              <button type="button" className="apr-btn apr-btn--ghost" onClick={discardDraft}>{t('form.discardDraft')}</button>
              <button type="button" className="apr-btn apr-btn--ghost" onClick={() => setDraftNotice(null)} aria-label={t('form.dismiss')}>{t('form.gotIt')}</button>
            </div>
          </div>
        )}

        {isEdit && Number(formData?.can_update_appraisal) !== 1 && (
          <div className="apr-objective-flow-notice" role="alert"><AppIcon icon={AlertCircle} /><span>{t(objectiveDenialKey(formData?.reason_key))}</span></div>
        )}
        {objectiveRerating && (
          <section className="apr-objective-change-summary" role="status" aria-label={t('objectiveFlow.summaryTitle')}>
            <div className="apr-objective-change-summary__head">
              <AppIcon icon={Info} />
              <div><strong>{t('objectiveFlow.summaryTitle')}</strong><p>{t('objectiveFlow.summaryDetail')}</p></div>
            </div>
            <div className="apr-objective-change-summary__counts">
              <span>{t('objectiveFlow.addedCount', { count: changeCounts.added })}</span>
              <span>{t('objectiveFlow.removedCount', { count: changeCounts.removed })}</span>
              <span>{t('objectiveFlow.changedCount', { count: changeCounts.changed })}</span>
            </div>
            {(objectiveSummary.sections || []).map((group) => (
              <div className="apr-objective-change-summary__group" key={group.section_id}>
                {[...(group.added || []).map((item) => ({ item, kind: 'added' })), ...(group.removed || []).map((item) => ({ item, kind: 'removed' })), ...(group.changed || []).map((item) => ({ item, kind: 'changed' }))].map(({ item, kind }, index) => (
                  <p key={`${kind}-${item.question_id}-${index}`}><b>{t(`objectiveFlow.${kind}`)}</b> {kind === 'changed' ? item.after?.question_text || item.before?.question_text : item.question_text}</p>
                ))}
              </div>
            ))}
          </section>
        )}
        <section className="apr-hero apr-hero--form apr-form-hero-live">
          <div className="apr-form-hero__identity">
            <p className="apr-eyebrow">{isEdit ? t('form.updateReview') : t('form.newReview')}</p>
            <h2>{staff.full_name || dash(staff.fullname)}</h2>
            <p>{cycle.title} • {cycle.year} • {t('form.supervisorName', { name: supervisor.full_name || dash(supervisor.fullname) })}</p>
            <div className="apr-form-hero__context">
              <span><AppIcon icon={Layers} /> {t('form.sectionCount', { count: sections.length })}</span>
              <span><AppIcon icon={ListChecks} /> {t('form.questionCount', { count: visibleQuestions.length })}</span>
              <span><AppIcon icon={Scale} /> {t('form.kpiSectionCount', { count: sections.filter((section) => section.type === 'kpi').length })}</span>
              {formData?.scoring_profile?.label && <span><AppIcon icon={Percent} /> {formData.scoring_profile.label}</span>}
            </div>
            {isEdit && isConductingAppraiser && (
              <div className="apr-attempt-pill">
                <AppIcon icon={RefreshCw} /> <Trans ns="appraisals" i18nKey="form.attemptsLeft" count={attemptsLeft} values={{ count: attemptsLeft }} components={{ strong: <strong /> }} />
              </div>
            )}
          </div>
          <div className="apr-review-overview">
            <span className="apr-review-overview__label">{t('form.reviewProgress')}</span>
            <strong>{answeredRatingInputs}/{totalRatingInputs}</strong>
            <small>{t('form.ratingInputsCompleted', { count: totalRatingInputs })}</small>
            <div className="apr-review-overview__track" aria-hidden="true">
              <span style={{ width: `${totalRatingInputs > 0 ? Math.min((answeredRatingInputs / totalRatingInputs) * 100, 100) : 0}%` }} />
            </div>
            <p>{t('form.reviewInstructions')}</p>
          </div>
        </section>

        <div className="apr-summary-grid">
          <div className="apr-summary-card"><span>{t('form.department')}</span><strong>{dash(staff.department)}</strong></div>
          <div className="apr-summary-card"><span>{t('form.jobTitle')}</span><strong>{dash(staff.job_title_display || staff.job_title)}</strong></div>
          <div className="apr-summary-card"><span>{t('form.staffType')}</span><strong>{dash(staff.staff_type)}</strong></div>
          <div className="apr-summary-card"><span>{t('form.location')}</span><strong>{dash(staff.location)}</strong></div>
        </div>

        {errors.length > 0 && (
          <div className="apr-callout apr-callout--danger">
            <AppIcon icon={AlertCircle} />
            <div>
              <strong>{t('form.completeRatings')}</strong>
              <p>{t('form.issueCount', { count: errors.length })}</p>
            </div>
          </div>
        )}

        {isConductingAppraiser && (hasOptionalActualResults || hasOptionalRatingComments) && (
          <div className="apr-optional-fields">
            <div className="apr-optional-fields__copy">
              <span><AppIcon icon="SlidersHorizontal" /></span>
              <div>
                <strong>{t('form.optionalFields')}<AppraisalHelpTip text={t('form.optionalTip')} /></strong>
                <small>{t('form.optionalFieldsDescription')}</small>
              </div>
            </div>
            <div className="apr-optional-fields__actions">
              {hasOptionalActualResults && (
                <button
                  type="button"
                  className={showOptionalActualResults ? 'is-active' : ''}
                  onClick={() => setShowOptionalActualResults((current) => !current)}
                >
                  <AppIcon icon={showOptionalActualResults ? 'Eye' : 'EyeOff'} />
                  {showOptionalActualResults ? t('form.hideResults') : t('form.showResults')}
                </button>
              )}
              {hasOptionalRatingComments && (
                <button
                  type="button"
                  className={showOptionalRatingComments ? 'is-active' : ''}
                  onClick={() => setShowOptionalRatingComments((current) => !current)}
                >
                  <AppIcon icon={showOptionalRatingComments ? 'MessageSquareText' : 'MessageSquare'} />
                  {showOptionalRatingComments ? t('form.hideComments') : t('form.showComments')}
                </button>
              )}
            </div>
          </div>
        )}

        {sections.map((section) => {
          const activeQuestions = (section.questions || []).filter((question) => !question.removed);
          const removedQuestions = (section.questions || []).filter((question) => question.removed);
          const isKpi = section.type === 'kpi';
          const objectiveQuestionsLocked = isKpi
            && Number(section.objective_setup_enabled) === 1
            && Number(section.objective_plan_locked) === 1
            && Number(section.objective_lock_questions_during_appraisal) === 1;
          const forcePerQuestion = isKpi
            && Number(section.objective_setup_enabled) === 1
            && Number(section.objective_force_per_question_ratings) === 1;
          const lockRatingMode = Number(section.lock_rating_mode || 0) === 1;
          const forceCustomWeights = isKpi
            && Number(section.objective_setup_enabled) === 1
            && Number(section.objective_require_weights) === 1;

          return (
            <section className="apr-section-card" key={section.id}>
              <div className="apr-section-head">
                <div>
                  <span>{isKpi ? t('form.kpiSection') : t('form.generalSection')}</span>
                  <h3>{section.code} — {section.label} {isKpi && <AppraisalHelpTip text={t('form.objectiveTip')} />}</h3>
                  {section.description && <p>{section.description}</p>}
                  {isKpi && (
                    <p className="apr-kpi-edit-note">
                      {objectiveQuestionsLocked
                        ? t('form.objectivesLocked')
                        : t('form.kpiEditing')}
                    </p>
                  )}
                </div>
                <div className="apr-section-head-actions">
                  {objectiveQuestionsLocked && isConductingAppraiser && (!isEdit || Number(formData?.can_adjust_objectives) === 1) && (
                    <button type="button" className="apr-mini-btn apr-objective-inline-edit" onClick={() => setObjectiveEditorSectionId(Number(section.id))}>
                      <AppIcon icon={UnlockKeyhole} /> {t('form.adjustObjectives')}
                    </button>
                  )}
                  <strong>{formatNumber(Number(section.weight) / 100, { style: 'percent', maximumFractionDigits: 0 }, locale)}</strong>
                  <div className="apr-rating-mode-switch" role="group" aria-label={t('form.ratingMethodAria', { section: section.label })}>
                    <button
                      type="button"
                      className={ratingModes[section.id] !== 'overall' ? 'active' : ''}
                      onClick={() => setRatingMode(section.id, 'per_question')}
                      disabled={forcePerQuestion || lockRatingMode}
                    >
                      {t('form.perQuestion')}
                    </button>
                    {!forcePerQuestion && (!lockRatingMode || section.default_rating_mode === 'overall') && (
                      <button
                        type="button"
                        className={ratingModes[section.id] === 'overall' ? 'active' : ''}
                        onClick={() => setRatingMode(section.id, 'overall')}
                        disabled={lockRatingMode}
                      >
                        {t('form.overallSection')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isKpi && ratingModes[section.id] !== 'overall' && (() => {
                const weightSummary = getQuestionWeightSummary(section);
                const hasSuggestedWeights = activeQuestions.some((question) => {
                  const suggested = question.suggested_weight ?? question.question_weight;
                  return suggested !== null && suggested !== undefined && suggested !== '';
                });
                const customWeighting = questionWeightingModes[section.id] === 'custom';

                return (
                  <div
                    className={`apr-kpi-weighting-panel ${customWeighting ? 'apr-kpi-weighting-panel--active' : ''} ${submitted && customWeighting && !weightSummary.valid ? 'apr-kpi-weighting-panel--error' : ''}`}
                    data-invalid={submitted && customWeighting && !weightSummary.valid ? 'true' : undefined}
                  >
                    <div className="apr-kpi-weighting-panel__intro">
                      <span className="apr-kpi-weighting-panel__icon"><AppIcon icon={Scale} /></span>
                      <div>
                        <strong>{t('form.weightTitle')}</strong>
                        <p>{t('form.weightHelp')}</p>
                        {hasSuggestedWeights && <small>{t('form.suggestedWeights')}</small>}
                      </div>
                    </div>

                    <div className="apr-kpi-weighting-panel__controls">
                      <div className="apr-weighting-mode-switch" role="group" aria-label={t('form.weightMethodAria', { section: section.label })}>
                        {!forceCustomWeights && (
                          <button
                            type="button"
                            className={!customWeighting ? 'active' : ''}
                            onClick={() => setQuestionWeightingMode(section.id, 'equal')}
                          >
                            {t('form.equalWeighting')}
                          </button>
                        )}
                        <button
                          type="button"
                          className={customWeighting ? 'active' : ''}
                          onClick={() => setQuestionWeightingMode(section.id, 'custom')}
                          disabled={forceCustomWeights}
                        >
                          {t('form.perQuestionWeighting')}
                        </button>
                      </div>

                      {customWeighting && (
                        <div className="apr-weight-total">
                          <div>
                            <span>{t('form.weightTotal', { total: formatNumber(weightSummary.total, { maximumFractionDigits: 2 }, locale), required: formatNumber(weightSummary.requiredTotal, { maximumFractionDigits: 2 }, locale) })}</span>
                            <small className={weightSummary.valid ? 'is-valid' : (weightSummary.remaining < 0 ? 'is-over' : '')}>
                              {weightSummary.valid
                                ? t('form.weightsComplete')
                                : weightSummary.missing > 0 && Math.abs(weightSummary.remaining) <= 0.01
                                  ? t('form.missingWeights', { count: weightSummary.missing })
                                  : weightSummary.remaining > 0
                                    ? t('form.weightRemaining', { amount: formatNumber(weightSummary.remaining, { maximumFractionDigits: 2 }, locale) })
                                    : t('form.weightOver', { amount: formatNumber(Math.abs(weightSummary.remaining), { maximumFractionDigits: 2 }, locale) })}
                            </small>
                          </div>
                          <button type="button" className="apr-mini-btn" onClick={() => distributeKpiWeightsEqually(section.id)}>
                            <AppIcon icon={Percent} /> {t('form.distributeEqually')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeQuestions.length === 0 ? (
                <div className="apr-empty apr-empty--compact">
                  <span><AppIcon icon={ListChecks} /></span>
                  <h3>{t('form.noActiveQuestions')}</h3>
                  <p>{isKpi ? t('form.noKpiQuestions') : t('form.noQuestions')}</p>
                  {isKpi && !objectiveQuestionsLocked && <button type="button" className="apr-btn apr-btn--primary" onClick={() => addKpiQuestion(section.id)}><AppIcon icon={Plus} /> {t('form.addKpiQuestion')}</button>}
                </div>
              ) : (
                <div className="apr-question-list">
                  {activeQuestions.map((question, index) => (
                    <div
                      className={`apr-question-row ${isKpi ? 'apr-question-row--kpi-editable' : ''} ${objectiveRerating && addedObjectiveIds.has(`${Number(section.id)}:${Number(question.question_id)}`) && !ratings?.[section.id]?.[question.local_id] ? 'apr-question-row--new-objective' : ''}`}
                      data-kpi-local-id={question.local_id}
                      key={`${section.id}-${question.local_id}`}
                    >
                      <div className="apr-question-text">
                        <span>{index + 1}</span>
                        <div className="apr-question-body">
                          {objectiveRerating && addedObjectiveIds.has(`${Number(section.id)}:${Number(question.question_id)}`) && (
                            <span className="apr-new-objective-label" role="status">{!ratings?.[section.id]?.[question.local_id] ? t('objectiveFlow.newNeedsRating') : t('objectiveFlow.newRated')}</span>
                          )}
                          {isKpi && !objectiveQuestionsLocked ? (
                            <textarea
                              className={`apr-kpi-question-input ${submitted && !String(question.question_text || '').trim() ? 'apr-field--error' : ''}`}
                              data-invalid={submitted && !String(question.question_text || '').trim() ? 'true' : undefined}
                              aria-invalid={submitted && !String(question.question_text || '').trim()}
                              value={question.question_text}
                              onChange={(event) => updateKpiQuestionText(section.id, question.local_id, event.target.value)}
                              placeholder={t('form.kpiQuestionPlaceholder')}
                              rows={2}
                            />
                          ) : (
                            <strong>{question.objective_code ? `${question.objective_code} — ` : ''}{question.question_code ? `${question.question_code} — ` : ''}{question.question_label ? `${question.question_label}: ` : ''}{(isKpi && !question.is_edited && !question.is_custom) ? (question.question_text_display || question.question_text) : question.question_text}</strong>
                          )}
                          {question.scope && <small>{question.scope} KPI</small>}
                          {isKpi && question.objective_target && <small className="apr-objective-detail"><b>{t('form.target')}</b> {question.objective_target}</small>}
                          {isKpi && question.evidence_source && <small className="apr-objective-detail"><b>{t('form.evidence')}</b> {question.evidence_source}</small>}
                          {isKpi && questionWeightingModes[section.id] === 'custom' && (
                            <label className="apr-kpi-weight-field apr-kpi-weight-field--inline">
                              <span>{t('form.questionWeight')}</span>
                              <div className={`apr-kpi-weight-input ${submitted && !(safeNumber(questionWeights?.[section.id]?.[question.local_id]) > 0 && safeNumber(questionWeights?.[section.id]?.[question.local_id]) <= 100) ? 'apr-kpi-weight-input--error' : ''}`}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={questionWeights?.[section.id]?.[question.local_id] ?? ''}
                                  onChange={(event) => setQuestionWeight(section.id, question.local_id, event.target.value)}
                                  disabled={objectiveQuestionsLocked}
                                  placeholder="0"
                                  aria-label={t('form.questionWeightAria', { question: question.question_text || t('form.kpiQuestion') })}
                                  data-invalid={submitted && !(safeNumber(questionWeights?.[section.id]?.[question.local_id]) > 0 && safeNumber(questionWeights?.[section.id]?.[question.local_id]) <= 100) ? 'true' : undefined}
                                />
                                <span>%</span>
                              </div>
                            </label>
                          )}
                          {!isKpi && (question.anchor_low_text || question.anchor_mid_text || question.anchor_high_text) && (
                            <div className="apr-rating-anchors">
                              {[
                                [question.anchor_low_value, question.anchor_low_text],
                                [question.anchor_mid_value, question.anchor_mid_text],
                                [question.anchor_high_value, question.anchor_high_text],
                              ].filter(([, anchorText]) => anchorText).map(([anchorValue, anchorText]) => (
                                <span key={`${question.local_id}-${anchorValue}`}><b>{t('form.anchorValue', { value: formatNumber(anchorValue, { maximumFractionDigits: 2 }, locale) })}</b> {anchorText}</span>
                              ))}
                              <small>{t('form.anchorsHint')}</small>
                            </div>
                          )}
                          {isKpi && (Number(section.objective_require_actual_result) === 1 || showOptionalActualResults || String(question.actual_result || '').trim()) && (
                            <label className="apr-actual-result-field">
                              <span>{t('form.actualResult')} {Number(section.objective_require_actual_result) === 1 ? <em>{t('form.required')}</em> : <em>{t('form.optional')}</em>}</span>
                              <textarea
                                rows={2}
                                value={question.actual_result || ''}
                                onChange={(event) => updateQuestionResponseField(section.id, question.local_id, 'actual_result', event.target.value)}
                                placeholder={t('form.actualResultPlaceholder')}
                                className={submitted && Number(section.objective_require_actual_result) === 1 && !String(question.actual_result || '').trim() ? 'apr-field--error' : ''}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      <div
                        className={`apr-rating-control ${ratingModes[section.id] !== 'overall' && submitted && !ratings?.[section.id]?.[question.local_id] ? 'apr-rating-control--error' : ''}`}
                        data-invalid={ratingModes[section.id] !== 'overall' && submitted && !ratings?.[section.id]?.[question.local_id] ? 'true' : undefined}
                      >
                        {ratingModes[section.id] !== 'overall' ? (
                          <>
                            <div className="apr-kpi-rating-selector">
                              <span>{t('form.performanceRating')}</span>
                              <RatingField
                                value={ratings?.[section.id]?.[question.local_id] ?? ''}
                                onChange={(next) => setRating(section.id, question.local_id, next)}
                                placeholder={t('form.enterRating')}
                                error={submitted && !isConfiguredRating(ratings?.[section.id]?.[question.local_id], ratingMin, ratingMax, ratingStep, ratingPoints)}
                                ratingConfig={ratingConfig}
                                ratingBands={ratingBands}
                                variant="cards"
                              />
                            </div>
                            {(() => {
                              const point = ratingPointFor(ratings?.[section.id]?.[question.local_id], ratingPoints);
                              const commentRequired = Number(point?.requires_comment || 0) === 1;
                              if (!commentRequired && !showOptionalRatingComments && !String(question.rating_comment || '').trim()) return null;
                              return (
                                <div className="apr-rating-evidence">
                                  <label>
                                    <span>{t('form.ratingEvidence')}<em>{commentRequired ? t('form.required') : t('form.optional')}</em></span>
                                    <textarea
                                      rows={2}
                                      data-rating-comment="true"
                                      value={question.rating_comment || ''}
                                      onChange={(event) => updateQuestionResponseField(section.id, question.local_id, 'rating_comment', event.target.value)}
                                      placeholder={commentRequired ? t('form.commentRequiredPlaceholder') : t('form.commentOptionalPlaceholder')}
                                      className={submitted && commentRequired && !String(question.rating_comment || '').trim() ? 'apr-field--error' : ''}
                                    />
                                  </label>
                                  {writingEnabled && <button type="button" className="apr-ai-write-action" onClick={() => setWritingContext({
                                    purpose: 'rating_comment', currentText: question.rating_comment || '',
                                    apply: (value) => updateQuestionResponseField(section.id, question.local_id, 'rating_comment', value),
                                  })}><Sparkles size={14} /> {t('form.improveAi')}</button>}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <span className="apr-cumulative-chip">
                            <AppIcon icon={Layers} /> {t('form.useCumulative')}
                          </span>
                        )}
                        {isKpi && !objectiveQuestionsLocked && (
                          <button type="button" className="apr-kpi-remove-btn" onClick={() => removeKpiQuestion(section.id, question.local_id)}>
                            <AppIcon icon={Trash2} /> {t('form.remove')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isKpi && !objectiveQuestionsLocked && (
                <div className="apr-section-add-kpi-row">
                  <button type="button" className="apr-mini-btn" onClick={() => addKpiQuestion(section.id)}><AppIcon icon={Plus} /> {t('form.addKpiQuestion')}</button>
                </div>
              )}

              {isKpi && !objectiveQuestionsLocked && removedQuestions.length > 0 && (
                <div className="apr-removed-kpis">
                  <span>{t('form.removedQuestions')}</span>
                  {removedQuestions.map((question) => (
                    <button key={question.local_id} type="button" onClick={() => restoreKpiQuestion(section.id, question.local_id)}>
                      <AppIcon icon={Undo2} /> {t('form.restoreQuestion', { question: question.question_text || t('form.untitledKpi') })}
                    </button>
                  ))}
                </div>
              )}


              {ratingModes[section.id] === 'overall' && activeQuestions.length > 0 && (
                <div
                  className={`apr-overall-rating apr-overall-rating--after-questions ${submitted && !isConfiguredRating(sectionOverallRatings[section.id], ratingMin, ratingMax, ratingStep, ratingPoints) ? 'apr-overall-rating--error' : ''}`}
                  data-invalid={submitted && !isConfiguredRating(sectionOverallRatings[section.id], ratingMin, ratingMax, ratingStep, ratingPoints) ? 'true' : undefined}
                >
                  <div>
                    <span className="apr-eyebrow">{t('form.cumulativeRating')}</span>
                    <h4>{t('form.overallTitle')}</h4>
                    <p>{t('form.overallHelp')}</p>
                  </div>
                  <RatingField
                    value={sectionOverallRatings[section.id] ?? ''}
                    onChange={(next) => setOverallRating(section.id, next)}
                    placeholder={t('form.enterRating')}
                    error={submitted && !isConfiguredRating(sectionOverallRatings[section.id], ratingMin, ratingMax, ratingStep, ratingPoints)}
                    ratingConfig={ratingConfig}
                    ratingBands={ratingBands}
                  />
                  {(() => {
                    const point = ratingPointFor(sectionOverallRatings[section.id], ratingPoints);
                    if (!point && !sectionOverallComments[section.id]) return null;
                    const commentRequired = Number(point?.requires_comment || 0) === 1;
                    const showCommentField = commentRequired || showOptionalRatingComments || String(sectionOverallComments[section.id] || '').trim();
                    return (
                      <div className="apr-rating-evidence apr-rating-evidence--overall">
                        {point && <p><strong>{point.label}</strong>{point.definition ? ` — ${point.definition}` : ''}{point.evidence_requirement ? <small>{point.evidence_requirement}</small> : null}</p>}
                        {showCommentField && (
                          <label>
                            <span>{t('form.ratingEvidence')}{commentRequired ? '*' : ''}</span>
                            <textarea
                              rows={2}
                              value={sectionOverallComments[section.id] || ''}
                              onChange={(event) => setSectionOverallComments((current) => ({ ...current, [section.id]: event.target.value }))}
                              placeholder={commentRequired ? t('form.overallRequiredPlaceholder') : t('form.overallOptionalPlaceholder')}
                              className={submitted && commentRequired && !String(sectionOverallComments[section.id] || '').trim() ? 'apr-field--error' : ''}
                            />
                          </label>
                        )}
                        {showCommentField && writingEnabled && <button type="button" className="apr-ai-write-action" onClick={() => setWritingContext({
                          purpose: 'section_comment', currentText: sectionOverallComments[section.id] || '',
                          apply: (value) => setSectionOverallComments((current) => ({ ...current, [section.id]: value })),
                        })}><Sparkles size={14} /> {t('form.improveAi')}</button>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>
          );
        })}

        <section className="apr-section-card apr-breach-card" aria-labelledby="apr-breach-title">
          <div className="apr-section-head">
            <div>
              <span>{t('form.safetyIntegrity')}</span>
              <h3 id="apr-breach-title">{t('form.breachTitle')}</h3>
              <p>{t('form.breachQuestion')}</p>
            </div>
          </div>
          {breachDeclarationLocked && (
            <p className="apr-breach-hint" role="status">
              {t('form.breachLocked', { status: t(`form.reviewStatus.${breachReviewStatus}`, { defaultValue: breachReviewStatus }) })}
              {breachEvidenceLocked ? t('form.breachEvidenceLocked') : t('form.breachMayClarify')}
            </p>
          )}
          <fieldset className="apr-breach-choice" data-invalid={submitted && !['yes','no'].includes(breachDeclaration.serious_breach_declared) ? 'true' : undefined}>
            <legend>{t('form.chooseOne')} <em>{t('form.required')}</em></legend>
            <div className="apr-breach-options">
              {['no', 'yes'].map((answer) => (
                <label key={answer} className={`apr-breach-option ${breachDeclaration.serious_breach_declared === answer ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="serious_breach_declared"
                    value={answer}
                    checked={breachDeclaration.serious_breach_declared === answer}
                    disabled={breachDeclarationLocked && answer === 'no'}
                    onChange={() => { setBreachDeclaration((prev) => ({ ...prev, serious_breach_declared: answer })); setSubmitted(false); }}
                  />
                  {answer === 'yes' ? t('form.yes') : t('form.no')}
                </label>
              ))}
            </div>
          </fieldset>
          {breachDeclaration.serious_breach_declared === 'yes' && (
            <>
              <p className="apr-breach-hint">{t('form.breachHelp')}</p>
              <div className="apr-breach-fields">
                <label>
                  <span>{t('form.breachReason')} <em>{t('form.required')}</em></span>
                  <textarea
                    rows={3}
                    maxLength={5000}
                    placeholder={t('form.breachReasonPlaceholder')}
                    value={breachDeclaration.serious_breach_reason}
                    disabled={breachEvidenceLocked}
                    onChange={(e) => setBreachDeclaration((prev) => ({ ...prev, serious_breach_reason: e.target.value }))}
                    className={submitted && !breachDeclaration.serious_breach_reason.trim() ? 'apr-field--error' : ''}
                    data-invalid={submitted && !breachDeclaration.serious_breach_reason.trim() ? 'true' : undefined}
                  />
                </label>
                <label>
                  <span>{t('form.supportingReference')} <em>{t('form.required')}</em></span>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder={t('form.breachReferencePlaceholder')}
                    value={breachDeclaration.serious_breach_reference}
                    disabled={breachEvidenceLocked}
                    onChange={(e) => setBreachDeclaration((prev) => ({ ...prev, serious_breach_reference: e.target.value }))}
                    className={submitted && !breachDeclaration.serious_breach_reference.trim() ? 'apr-field--error' : ''}
                    data-invalid={submitted && !breachDeclaration.serious_breach_reference.trim() ? 'true' : undefined}
                  />
                </label>
              </div>
            </>
          )}
        </section>

        <section className="apr-section-card" data-fairness-target="recommendations">
          <div className="apr-section-head">
            <div>
              <span>{t('form.recommendations')}</span>
              <h3>{t('form.recommendationsTitle')}<AppraisalHelpTip text={t('form.recommendationsTip')} /></h3>
              <p>{t('form.recommendationsHelp')}</p>
            </div>
          </div>

          <div className="apr-textarea-grid">
            <label data-invalid={submitted && !String(recommendations.status_upgrade || '').trim() ? 'true' : undefined}>
              <span className="apr-field-label-row">
                <span>{t('form.statusUpgrade')}</span>
                <em>{t('form.required')}</em>
              </span>
              <textarea
                className={submitted && !String(recommendations.status_upgrade || '').trim() ? 'apr-field--error' : ''}
                data-invalid={submitted && !String(recommendations.status_upgrade || '').trim() ? 'true' : undefined}
                aria-invalid={submitted && !String(recommendations.status_upgrade || '').trim()}
                value={recommendations.status_upgrade}
                onChange={(e) => setRecommendations((prev) => ({ ...prev, status_upgrade: e.target.value }))}
                placeholder={t('form.statusUpgradePlaceholder')}
              />
              {submitted && !String(recommendations.status_upgrade || '').trim() && (
                <small className="apr-field-error-message"><AlertCircle size={13} /> {t('form.statusRequiredError')}</small>
              )}
            </label>
            <label data-invalid={submitted && !String(recommendations.salary_upgrade || '').trim() ? 'true' : undefined}>
              <span className="apr-field-label-row">
                <span>{t('form.salaryUpgrade')}</span>
                <em>{t('form.required')}</em>
              </span>
              <textarea
                className={submitted && !String(recommendations.salary_upgrade || '').trim() ? 'apr-field--error' : ''}
                data-invalid={submitted && !String(recommendations.salary_upgrade || '').trim() ? 'true' : undefined}
                aria-invalid={submitted && !String(recommendations.salary_upgrade || '').trim()}
                value={recommendations.salary_upgrade}
                onChange={(e) => setRecommendations((prev) => ({ ...prev, salary_upgrade: e.target.value }))}
                placeholder={t('form.salaryUpgradePlaceholder')}
              />
              {submitted && !String(recommendations.salary_upgrade || '').trim() && (
                <small className="apr-field-error-message"><AlertCircle size={13} /> {t('form.salaryRequiredError')}</small>
              )}
            </label>
            <label className="apr-textarea-wide" data-invalid={submitted && !String(recommendations.development || '').trim() ? 'true' : undefined}>
              <span className="apr-field-label-row">
                <span>{t('form.development')}</span>
                <em>{t('form.required')}</em>
              </span>
              <textarea
                className={submitted && !String(recommendations.development || '').trim() ? 'apr-field--error' : ''}
                data-invalid={submitted && !String(recommendations.development || '').trim() ? 'true' : undefined}
                aria-invalid={submitted && !String(recommendations.development || '').trim()}
                value={recommendations.development}
                onChange={(e) => setRecommendations((prev) => ({ ...prev, development: e.target.value }))}
                placeholder={t('form.developmentPlaceholder')}
              />
              {submitted && !String(recommendations.development || '').trim() && (
                <small className="apr-field-error-message"><AlertCircle size={13} /> {t('form.developmentRequiredError')}</small>
              )}
            </label>
            {developmentEnabled && <div className="apr-ai-development-action">
              <button type="button" className="apr-ai-write-action" onClick={() => setDevelopmentOpen(true)}><Sparkles size={14} />{t('form.developmentAi')}</button>
              <small>{t('form.developmentAiHint')}</small>
            </div>}
          </div>

          {isEdit && (
            <label className="apr-checkline">
              <input type="checkbox" checked={recommendations.notify_staff} onChange={(e) => setRecommendations((prev) => ({ ...prev, notify_staff: e.target.checked }))} />
              <span>{t('form.notifyStaff')}</span>
            </label>
          )}
        </section>


        <div className="apr-action-dock" role="region" aria-label={t('form.submitControls')}>
          <div>
            <AppraisalDockScore score={finalScorePreview} answered={answeredRatingInputs} total={totalRatingInputs} ratingBands={ratingBands} />
            {scoreCapApplies && <small className="apr-breach-score-note">{t('form.breachScoreCap', { score: formatScore(scorePreview, locale), cap: formatScore(2, locale) })}</small>}
          </div>
          <div className="apr-action-dock__actions">
            {savedAt && <span className="apr-draft-saved" title={t('form.draftSavedTip')}>{t('form.progressSaved', { when: savedTimeLabel(savedAt, t, locale) })}</span>}
            <Link className="apr-btn apr-btn--ghost" to={returnTo}>{t('form.cancel')}</Link>
            {fairness.enabled && (
              <button type="button" className="apr-btn apr-btn--ghost" onClick={openFairnessReview} disabled={saving || totalRatingInputs === 0}
                title={t('form.fairnessTip')}>
                {t('form.checkBeforeSubmitting')}
              </button>
            )}
            <button type="submit" className="apr-btn apr-btn--primary" title={t('form.submitTip')} disabled={saving || totalRatingInputs === 0 || (isEdit && (attemptsLeft <= 0 || Number(formData?.can_update_appraisal) !== 1))}>
              {saving ? <><span className="apr-spinner" /> {t('form.saving')}</> : <>{isEdit ? t('form.updateAppraisal') : t('form.submitAppraisal')} <AppIcon icon={ArrowRight} /></>}
            </button>
          </div>
        </div>

      </form>

      {fairnessReview && <FairnessCheckModal
        findings={fairnessReview}
        aiAvailable={fairness.ai_available}
        onRunAi={runFairnessAi}
        onGoTo={goToFairnessItem}
        onClose={() => setFairnessReview(null)}
        saving={saving}
        submitLabel={isEdit ? t('form.updateLower') : t('form.submitLower')}
        onSubmit={() => { fairnessCleared.current = true; setFairnessReview(null); handleSubmit(); }}
      />}
      {developmentOpen && <AiDevelopmentModal
        currentText={recommendations.development}
        onApply={(plan) => setRecommendations((prev) => ({ ...prev, development: plan }))}
        onClose={() => setDevelopmentOpen(false)}
      />}
      {writingContext && <AiWritingModal
        purpose={writingContext.purpose}
        currentText={writingContext.currentText}
        onApply={writingContext.apply}
        onClose={() => setWritingContext(null)}
      />}
      {objectiveEditorSectionId && (
        <ObjectiveSetupModal
          staff={{ ...staff, staff_user_id: Number(staff.staff_user_id || staff.id) }}
          sectionId={objectiveEditorSectionId}
          cycle={cycle}
          autoUnlock
          closeOnLock
          onClose={() => setObjectiveEditorSectionId(null)}
          onChanged={async (nextData) => {
            if (nextData?.plan?.status === 'locked') await refreshCurrentForm();
          }}
          onUpdateNow={async () => {
            setObjectiveEditorSectionId(null);
            await refreshCurrentForm();
          }}
        />
      )}
    </AppraisalShell>
  );
};

export default AppraisalForm;
