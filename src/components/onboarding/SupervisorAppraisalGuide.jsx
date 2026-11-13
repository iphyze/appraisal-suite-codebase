import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Lock,
  LockOpen,
  Mail,
  MessageSquareReply,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  History,
  BarChart3,
  CalendarCheck,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useLocaleStore from '../../stores/useLocaleStore';
import { needsLanguageChoice } from '../../utils/localeRules';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatScore } from '../../utils/format';
import AppIcon from '../ui/AppIcon';
import './SupervisorAppraisalGuide.css';

export const SUPERVISOR_GUIDE_EVENT = 'appraisalsuite:open-supervisor-guide';
const GUIDE_VERSION = 'v6';
const SUPERVISOR_GUIDE_VERSION = 'v7';

export const isAppraisalSupervisorUser = (user) => (
  user?.role === 'supervisor'
  || (user?.role === 'admin' && Number(user?.is_supervisor || 0) === 1)
);

/** Guide content is tailored to the user's actual app roles (never an API permission). */
export const getAppraisalGuideTracks = (user) => {
  if (!user) return [];
  const isManagement = ['admin', 'super_admin'].includes(user.role);
  const tracks = [];
  if (isAppraisalSupervisorUser(user)) tracks.push('supervisor');
  if (isManagement) tracks.push('management');
  if (user.role !== 'super_admin') tracks.push('employee');
  return tracks;
};

export const canOpenAppraisalGuide = (user) => getAppraisalGuideTracks(user).length > 0;

const userGuideKey = (user) => {
  const identity = user?.id || user?.user_id || user?.email || user?.username || 'user';
  const version = isAppraisalSupervisorUser(user) ? SUPERVISOR_GUIDE_VERSION : GUIDE_VERSION;
  return `appraisalsuite.appraisal-guide.${version}.${identity}`;
};

/* ------------------------------------------------------------------ */
/*  Demo engine                                                        */
/* ------------------------------------------------------------------ */

/** Advances through `count` phases using the given durations (ms). */
const useTimeline = (count, durations, runKey, reduced) => {
  const [phase, setPhase] = useState(reduced ? count - 1 : 0);

  useEffect(() => {
    if (reduced) {
      setPhase(count - 1);
      return undefined;
    }
    setPhase(0);
    const timers = [];
    let elapsed = 0;
    for (let i = 1; i < count; i += 1) {
      elapsed += durations[i - 1] ?? 900;
      timers.push(window.setTimeout(() => setPhase(i), elapsed));
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [count, runKey, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return phase;
};

const CountUp = ({ to, from = 0, decimals = 2, run, duration = 1100, render }) => {
  const { i18n } = useTranslation('appraisals');
  const [value, setValue] = useState(run ? from : to);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!run || reduced) {
      setValue(run ? to : from);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, from, run, duration, reduced]);

  return <>{render ? render(Math.round(value)) : formatNumber(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }, i18n.language)}</>;
};

const Typewriter = ({ text, run, speed = 28 }) => {
  const [count, setCount] = useState(run ? 0 : text.length);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!run || reduced) {
      setCount(run ? text.length : 0);
      return undefined;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((value) => {
        if (value >= text.length) {
          window.clearInterval(id);
          return value;
        }
        return value + 1;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, run, speed, reduced]);

  return (
    <>
      {text.slice(0, count)}
      {run && count < text.length && <span className="ag-caret" aria-hidden="true" />}
    </>
  );
};

/** The guiding pointer. `at` is [x%, y%] inside the stage; `tap` shows a click. */
const Pointer = ({ at, tap, hidden }) => (
  <motion.div
    className="ag-pointer"
    aria-hidden="true"
    initial={false}
    animate={{ left: `${at[0]}%`, top: `${at[1]}%`, opacity: hidden ? 0 : 1 }}
    transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
  >
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M5 3l14 8-6 1.6L10 19z" fill="#0E1E33" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
    <AnimatePresence>
      {tap != null && (
        <motion.span
          key={String(tap)}
          className="ag-pointer__tap"
          initial={{ scale: 0.2, opacity: 0.7 }}
          animate={{ scale: 1.8, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
        />
      )}
    </AnimatePresence>
  </motion.div>
);

const Pill = ({ tone = 'neutral', children }) => (
  <motion.span
    className={`ag-pill ag-pill--${tone}`}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.span>
);

const RATING_LABEL_KEYS = ['guide.strings.unsatisfactory', 'guide.strings.needsImprovement', 'guide.strings.fullyMeets', 'guide.strings.exceeds', 'guide.strings.outstanding'];

const RatingButtons = ({ active, labels = false }) => {
  const { t } = useTranslation('appraisals');
  return (
    <div className="ag-rating">
    {[1, 2, 3, 4, 5].map((n) => (
      <motion.span
        key={n}
        className={`ag-rating__btn ${active === n ? 'is-active' : ''}`}
        animate={active === n ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <strong>{n}</strong>
        {labels && <small>{t(RATING_LABEL_KEYS[n - 1])}</small>}
      </motion.span>
    ))}
    </div>
  );
};

const ScoreRing = ({ value, run, max = 5 }) => {
  const { t } = useTranslation('appraisals');
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="ag-ring">
      <svg viewBox="0 0 100 100" width="112" height="112" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="ag-ring__track" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          className="ag-ring__value"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: run ? c * (1 - value / max) : c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ag-ring__label"><strong><CountUp to={value} run={run} /></strong><small>{t('guide.strings.overall')}</small></div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Supervisor demos                                                   */
/* ------------------------------------------------------------------ */

/** A visual replay of the real supervisor onboarding gate on the Dashboard. */
const DemoSupervisorOnboarding = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(7, [800, 900, 1000, 900, 800, 900], runKey, reduced);
  const reviewed = p >= 4 ? 5 : p >= 3 ? 3 : p >= 2 ? 1 : 0;
  const accepted = p >= 5;
  const complete = p >= 6;

  return (
    <div className="ag-stage__inner ag-onboarding">
      <div className="ag-mock ag-mock--card ag-onboarding__card">
        <div className="ag-onboarding__top">
          <span className="ag-onboarding__icon"><AppIcon icon={UserCheck} size={18} /></span>
          <div className="ag-onboarding__heading">
            <strong>{t('guide.strings.supervisorOnboarding')}</strong>
            <small>{t('guide.strings.getReadyToAppraiseYourTeamFairly')}</small>
          </div>
          <Pill tone={complete ? 'green' : 'amber'}>
            {complete ? <><AppIcon icon={Check} size={12} /> {t('guide.strings.onboarded')}</> : t('guide.strings.notOnboarded')}
          </Pill>
        </div>
        <div className="ag-onboarding__details">
          <div><AppIcon icon={CalendarCheck} size={14} /><span>{t('guide.strings.annualAppraisal2026')}</span><AppIcon icon={Check} size={12} /></div>
          <div><AppIcon icon={Users} size={14} /><span>{t('guide.strings.label3AssignedStaff')}</span><AppIcon icon={Check} size={12} /></div>
        </div>
        <div className="ag-onboarding__scale">
          <div className="ag-onboarding__scale-heading">
            <span>{t('guide.strings.reviewTheRatingScale')}</span><small>{t('guide.strings.reviewedOfTotal', { count: reviewed, total: 5 })}</small>
          </div>
          <div className="ag-onboarding__ratings">
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.span
                key={n}
                className={n <= reviewed ? 'is-reviewed' : ''}
                animate={{ scale: n === reviewed && !complete ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.35 }}
              >
                {n <= reviewed ? <AppIcon icon={Check} size={14} /> : n}
              </motion.span>
            ))}
          </div>
        </div>
        <div className={`ag-onboarding__agreement ${accepted ? 'is-accepted' : ''}`}>
          <span className="ag-onboarding__checkbox">{accepted && <AppIcon icon={Check} size={13} />}</span>
          <span>{t('guide.strings.iHaveReviewedTheRatingScaleAnd')}</span>
        </div>
        <div className="ag-onboarding__bottom">
          <span className={`ag-btn ${complete ? 'ag-btn--done' : accepted ? 'ag-btn--primary' : 'ag-btn--ghost'}`}>
            {complete && <AppIcon icon={Check} size={14} />}
            {complete ? t('guide.strings.teamAppraisalsUnlocked') : t('guide.strings.complete2026Onboarding')}
          </span>
        </div>
      </div>
      <Pointer
        at={p < 2 ? [48, 34] : p < 5 ? [63, 61] : [76, 88]}
        tap={p === 2 || p === 5 || p === 6 ? p : null}
        hidden={p >= 6}
      />
    </div>
  );
};

const DemoContext = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(6, [700, 700, 700, 800, 700], runKey, reduced);
  const year = p >= 4 ? 2026 : 2025;
  const menuOpen = p >= 2 && p < 4;
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--bar">
        <span className="ag-mock__label">{t('guide.strings.cycle')}</span>
        <span className={`ag-select ${menuOpen ? 'is-open' : ''}`}>
          {t('guide.strings.annualAppraisalYear', { year })} <AppIcon icon={ChevronDown} size={14} />
          <AnimatePresence>
            {menuOpen && (
              <motion.span className="ag-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                <span className={p === 3 ? 'is-hover' : ''}>{t('guide.strings.annualAppraisal2026')}</span>
                <span>{t('guide.strings.annualAppraisal2025')}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <div className="ag-mock ag-mock--card ag-context-card">
        <div>
          <strong>{t('guide.strings.annualAppraisalYear', { year })}</strong>
          <small>{p >= 4 ? t('guide.strings.ratingPointsWeightsAndQuestionsFor2026') : t('guide.strings.lastYearsCycleIsSelected')}</small>
        </div>
        <AnimatePresence mode="wait">
          {p >= 5
            ? <Pill key="on" tone="green"><AppIcon icon={Check} size={13} /> {t('guide.strings.onboarded')}</Pill>
            : <Pill key="off" tone="amber">{t('guide.strings.notOnboarded')}</Pill>}
        </AnimatePresence>
      </div>
      <Pointer
        at={p < 1 ? [24, 88] : p < 3 ? [40, 20] : p < 5 ? [30, 38] : [84, 62]}
        tap={p === 2 || p === 4 ? p : null}
        hidden={p >= 5}
      />
    </div>
  );
};

const DemoReadiness = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [800, 700, 800, 900], runKey, reduced);
  const rows = [
    { initials: 'OM', name: 'Olaleye Mary', role: t('guide.strings.asstAccountOfficer') },
    { initials: 'AB', name: 'Ajadi Bashir', role: t('guide.strings.accountOfficer') },
    { initials: 'IN', name: 'Ifeanyi Nzekwue', role: t('guide.strings.asstAccountOfficer') },
  ];
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-list">
        {rows.map((row, index) => (
          <div className="ag-list__row" key={row.name}>
            <span className="ag-avatar">{row.initials}</span>
            <div className="ag-list__who"><strong>{row.name}</strong><small>{row.role}</small></div>
            <div className="ag-list__badges">
              {index === 0 && (
                <AnimatePresence mode="wait">
                  {p >= 3
                    ? <Pill key="lvl" tone="green">{t('guide.strings.seniorStaff')}</Pill>
                    : <Pill key="req" tone="amber">{t('guide.strings.levelRequired')}</Pill>}
                </AnimatePresence>
              )}
              {index === 0 && <Pill tone="amber">{t('guide.strings.objectivesNotSet')}</Pill>}
              {index === 1 && <><Pill tone="green">{t('guide.strings.seniorStaff')}</Pill><Pill tone="green"><AppIcon icon={Lock} size={12} /> {t('guide.strings.locked')}</Pill></>}
              {index === 2 && <Pill tone="neutral">{t('guide.strings.submitted')}</Pill>}
            </div>
            <span className={`ag-btn ${index === 1 ? 'ag-btn--primary' : 'ag-btn--ghost'}`}>
              {index === 0 ? t('guide.strings.setLevel') : index === 1 ? t('guide.strings.start') : t('guide.strings.view')}
            </span>
          </div>
        ))}
        <AnimatePresence>
          {p === 2 && (
            <motion.div className="ag-popover" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <span>{t('guide.strings.siteJuniorStaff')}</span>
              <span className="is-hover">{t('guide.strings.seniorStaff')}</span>
              <span>{t('guide.strings.manager')}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Pointer
        at={p < 1 ? [40, 94] : p < 2 ? [90, 22] : p < 4 ? [76, 46] : [90, 50]}
        tap={p === 1 || p === 3 ? p : null}
        hidden={p >= 4}
      />
    </div>
  );
};

const DemoObjectives = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(6, [500, 900, 900, 700, 700], runKey, reduced);
  const kpis = [['ACC-01', t('guide.strings.deliveryTimeliness'), 25], ['ACC-02', t('guide.strings.accuracyQuality'), 20], ['ACC-03', t('guide.strings.controlsDocumentation'), 15], ['ACC-04', t('guide.strings.ownershipFollowUp'), 10]];
  const total = p >= 3 ? 100 : p >= 2 ? 70 : 0;
  const locked = p >= 5;
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-plan">
        <div className="ag-plan__head">
          <strong>{t('guide.strings.objectivePlanOlaleyeMary')}</strong>
          <AnimatePresence>{p >= 1 && <Pill tone="green">{t('guide.strings.label8DepartmentKPIsLoaded')}</Pill>}</AnimatePresence>
        </div>
        <div className="ag-plan__rows">
          {kpis.map(([code, label, weight], i) => (
            <motion.div
              key={code}
              className="ag-plan__row"
              initial={false}
              animate={{ opacity: p >= 1 ? 1 : 0, x: p >= 1 ? 0 : 14 }}
              transition={{ delay: reduced ? 0 : i * 0.12 }}
            >
              <span className="ag-code">{code}</span><span>{label}</span><strong>{formatNumber(weight / 100, { style: 'percent', maximumFractionDigits: 0 }, i18n.language)}</strong>
            </motion.div>
          ))}
          <motion.div className="ag-plan__more" initial={false} animate={{ opacity: p >= 2 ? 1 : 0 }}>{t('guide.strings.label4MoreObjectives')}</motion.div>
        </div>
        <div className="ag-meter">
          <div className="ag-meter__track"><motion.span className={`ag-meter__fill ${total === 100 ? 'is-full' : ''}`} initial={false} animate={{ width: `${total}%` }} transition={{ duration: 0.8 }} /></div>
          <small>{t('guide.strings.percentOfTotal', { amount: formatNumber(total, {}, i18n.language) })}</small>
        </div>
        <div className="ag-plan__foot">
          <span className="ag-btn ag-btn--ghost">{t('guide.strings.saveDraft')}</span>
          <span className={`ag-btn ${locked ? 'ag-btn--done' : 'ag-btn--primary'}`}>
            <AppIcon icon={locked ? Lock : LockOpen} size={14} /> {locked ? t('guide.strings.objectivesLocked') : t('guide.strings.lockObjectives')}
          </span>
        </div>
      </div>
      <Pointer at={p < 4 ? [30, 96] : [82, 88]} tap={p === 4 ? p : null} hidden={p >= 5} />
    </div>
  );
};

const LEVEL_WEIGHTS = [
  ['guide.strings.siteJunior', [40, 45, 15]],
  ['guide.strings.senior', [55, 30, 15]],
  ['guide.strings.manager', [50, 25, 25]],
];

const DemoSections = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    if (reduced) return undefined;
    const id = window.setInterval(() => setTick((v) => v + 1), 1800);
    return () => window.clearInterval(id);
  }, [runKey, reduced]);
  const level = reduced ? 1 : tick % 3;
  const [levelLabel, weights] = LEVEL_WEIGHTS[level];
  const name = t(levelLabel);
  const sections = [['A', t('guide.strings.resultsObjectives'), t('guide.strings.whatWasDelivered')], ['B', t('guide.strings.coreBehaviours'), t('guide.strings.howTheWorkWasDone')], ['C', t('guide.strings.roleCompetencies'), t('guide.strings.skillsForTheLevel')]];
  return (
    <div className="ag-stage__inner">
      <div className="ag-tabs">
        {LEVEL_WEIGHTS.map(([label], i) => (
          <span key={label} className={i === level ? 'is-active' : ''}>
            {i === level && <motion.span layoutId="ag-tab-bg" className="ag-tabs__bg" transition={{ type: 'spring', stiffness: 200, damping: 26 }} />}
            <span className="ag-tabs__text">{t(label)}</span>
          </span>
        ))}
      </div>
      <div className="ag-stack" aria-label={t('guide.strings.sectionWeights', { level: name })}>
        {weights.map((w, i) => (
          <motion.div key={sections[i][0]} className={`ag-stack__seg ag-stack__seg--${i}`} initial={false} animate={{ flexGrow: w }} transition={{ type: 'spring', stiffness: 90, damping: 18 }}>
            <strong>{sections[i][0]}</strong><span>{formatNumber(w / 100, { style: 'percent', maximumFractionDigits: 0 }, i18n.language)}</span>
          </motion.div>
        ))}
      </div>
      <div className="ag-legend">
        {sections.map(([code, label, sub], i) => (
          <div key={code}><span className={`ag-dot ag-dot--${i}`} /><div><strong>{label}</strong><small>{sub}</small></div></div>
        ))}
      </div>
    </div>
  );
};

const DemoAnchors = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(6, [700, 800, 800, 800, 600], runKey, reduced);
  const anchors = [
    ['1', t('guide.strings.oftenIgnoresSafetyOrQualityRequirementsNeeds')],
    ['3', t('guide.strings.consistentlyFollowsProceduresAndStandardsWorkMeets')],
    ['5', t('guide.strings.promotesSafeHighQualityPracticeSpotsRisks')],
  ];
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-question">
        <strong className="ag-question__title">{t('guide.strings.b1SafetyQuality')}</strong>
        <div className="ag-anchors">
          {anchors.map(([n, text], i) => (
            <motion.div key={n} className={`ag-anchor ${p === i + 1 ? 'is-reading' : ''}`} initial={false} animate={{ opacity: p >= i + 1 || reduced ? 1 : 0.35 }}>
              <span>{n}</span><p>{text}</p>
            </motion.div>
          ))}
        </div>
        <RatingButtons active={p >= 4 ? 4 : null} />
        <div className="ag-hint-slot">
          <AnimatePresence>
            {p >= 5 && (
              <motion.p className="ag-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {t('guide.strings.label4ExceedsBetterThanThe3Description')}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Pointer at={p < 1 ? [8, 92] : p < 4 ? [6, 24 + (p - 1) * 15] : [60, 74]} tap={p === 4 ? p : null} hidden={p >= 5} />
    </div>
  );
};

const DemoEvidence = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [700, 600, 900, 2200], runKey, reduced);
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-question">
        <strong className="ag-question__title">{t('guide.strings.acc01DeliveryOfAssignedResponsibilities')}</strong>
        <RatingButtons active={p >= 1 ? 5 : null} labels />
        <AnimatePresence>
          {p >= 2 && (
            <motion.div className={`ag-field ${p >= 4 ? 'is-valid' : 'is-required'}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <span className="ag-field__label">
                {t('guide.strings.ratingCommentEvidence')}
                {p < 4 ? <em> {t('guide.strings.requiredForThisRating')}</em> : <em className="is-ok"> {t('guide.strings.complete')}</em>}
              </span>
              <span className="ag-field__box"><Typewriter text={t('guide.strings.closedAll12MonthEndReportsTwo')} run={p >= 3} /></span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Pointer at={p < 1 ? [20, 94] : p < 3 ? [88, 42] : [40, 82]} tap={p === 1 ? p : null} hidden={p >= 3} />
    </div>
  );
};

const DemoBreach = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(6, [800, 700, 1500, 1000, 900], runKey, reduced);
  const yes = p >= 1;
  const capped = p >= 4;
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-breach">
        <div className="ag-breach__score">
          <small>{t('guide.strings.liveOverallScore')}</small>
          <strong className={capped ? 'is-capped' : ''}>{capped ? <CountUp from={4.57} to={2} run /> : formatScore(4.57, i18n.language)}</strong>
          <AnimatePresence mode="wait">
            {capped
              ? <Pill key="cap" tone="amber">{t('guide.strings.label200MaximumApplies')}</Pill>
              : <Pill key="band" tone="green">{t('guide.strings.outstanding')}</Pill>}
          </AnimatePresence>
        </div>
        <div className="ag-breach__q">
          <AppIcon icon={ShieldAlert} size={18} />
          <span>{t('guide.strings.seriousHSEOrIntegrityBreachThisPeriod')}</span>
          <span className="ag-toggle">
            <span className={!yes ? 'is-on' : ''}>{t('guide.strings.no')}</span>
            <span className={yes ? 'is-on is-yes' : ''}>{t('guide.strings.yes')}</span>
          </span>
        </div>
        <AnimatePresence>
          {yes && (
            <motion.div className="ag-breach__fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <span className="ag-field__label">{t('guide.strings.reason')}</span>
              <span className="ag-field__box"><Typewriter text={t('guide.strings.bypassedTheLockOutProcedureOnDB')} run={p >= 2} speed={22} /></span>
              <span className="ag-field__label">{t('guide.strings.supportingReference')}</span>
              <span className="ag-field__box"><Typewriter text={t('guide.strings.hseIncidentReportIR2026031')} run={p >= 3} speed={30} /></span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ag-hint-slot">
          <AnimatePresence>
            {p >= 5 && <motion.p className="ag-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{t('guide.strings.managementHROrHSEWillVerifyIt')}</motion.p>}
          </AnimatePresence>
        </div>
      </div>
      <Pointer at={p < 1 ? [60, 94] : [92, 36]} tap={p === 1 ? p : null} hidden={p >= 2} />
    </div>
  );
};

const DemoRecommendations = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [300, 1300, 1700, 1700], runKey, reduced);
  const fields = [[t('guide.strings.statusUpgrade'), t('guide.strings.no')], [t('guide.strings.salaryUpgrade'), t('guide.strings.yesInLineWithTheMeritGuide')], [t('guide.strings.development'), t('guide.strings.erpReportingAndExcelModellingTraining')]];
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-recs">
        <strong className="ag-question__title">{t('guide.strings.upgradeDevelopmentNotes')}</strong>
        {fields.map(([label, value], i) => (
          <div key={label} className={`ag-recs__row ${p > i + 1 || reduced ? 'is-done' : ''}`}>
            <span className="ag-field__label">{label}<em> {t('guide.strings.required')}</em></span>
            <span className="ag-field__box"><Typewriter text={value} run={p >= i + 1} speed={26} /></span>
            <span className="ag-recs__check"><AppIcon icon={Check} size={14} /></span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DemoSubmit = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [300, 1400, 700, 800], runKey, reduced);
  const rated = p >= 1;
  const sent = p >= 3;
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-submit">
        <div className="ag-submit__score">
          <div>
            <small>{t('guide.strings.liveOverallScore')}</small>
            <strong><CountUp to={4.57} run={rated} /></strong>
          </div>
          <span className="ag-submit__count"><CountUp to={18} decimals={0} run={rated} render={(count) => t('guide.strings.ratedOfTotal', { count, total: 18 })} /></span>
        </div>
        <div className="ag-meter ag-meter--slim"><div className="ag-meter__track"><motion.span className="ag-meter__fill is-full" initial={false} animate={{ width: rated ? '100%' : '0%' }} transition={{ duration: 1.1 }} /></div></div>
        <div className="ag-submit__foot">
          <span className="ag-btn ag-btn--ghost">{t('guide.strings.cancel')}</span>
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.span key="done" className="ag-btn ag-btn--done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><AppIcon icon={Check} size={14} /> {t('guide.strings.submitted')}</motion.span>
            ) : (
              <motion.span key="go" className="ag-btn ag-btn--primary" exit={{ scale: 0.9, opacity: 0 }}>{t('guide.strings.submitAppraisal')} <AppIcon icon={ArrowRight} size={14} /></motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="ag-hint-slot">
          <AnimatePresence>
            {p >= 4 && (
              <motion.div className="ag-toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <AppIcon icon={Send} size={15} /> {t('guide.strings.employeeNotifiedByEmailAndInThe')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Pointer at={p < 2 ? [50, 96] : [84, 58]} tap={p === 2 ? p : null} hidden={p >= 3} />
    </div>
  );
};

const DemoAfter = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(6, [600, 700, 700, 700, 700], runKey, reduced);
  const steps = [
    [t('guide.strings.employeeReviewsAndAcknowledges'), t('guide.strings.theirFeedbackComesBackToYou'), 'green'],
    [t('guide.strings.managementReview'), t('guide.strings.markedReviewedOrAFollowUpIs'), 'navy'],
    [t('guide.strings.youRespondToTheFollowUp'), t('guide.strings.updateTheAppraisalOrExplain'), 'amber'],
    [t('guide.strings.followUpResolved'), t('guide.strings.everyVersionStaysInTheHistory'), 'green'],
  ];
  return (
    <div className="ag-stage__inner">
      <div className="ag-timeline">
        {steps.map(([title, sub, tone], i) => (
          <motion.div key={title} className={`ag-timeline__item ag-timeline__item--${tone}`} initial={false} animate={{ opacity: p >= i + 1 ? 1 : 0.25, x: p >= i + 1 ? 0 : 8 }}>
            <span className="ag-timeline__dot">{i === 2 ? <AppIcon icon={MessageSquareReply} size={13} /> : <AppIcon icon={Check} size={13} />}</span>
            <div><strong>{title}</strong><small>{sub}</small></div>
          </motion.div>
        ))}
      </div>
      <motion.div className="ag-chip-row" initial={false} animate={{ opacity: p >= 5 ? 1 : 0 }}>
        <span className="ag-pill ag-pill--neutral">{t('guide.strings.label2SupervisorUpdates')}</span>
        <span className="ag-pill ag-pill--neutral">{t('guide.strings.eachUpdateNeedsAFreshAcknowledgement')}</span>
      </motion.div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Employee demos                                                     */
/* ------------------------------------------------------------------ */

const DemoInbox = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(4, [600, 800, 700], runKey, reduced);
  return (
    <div className="ag-stage__inner ag-inbox">
      <div className="ag-bell">
        <AppIcon icon={Bell} size={20} />
        <AnimatePresence>{p >= 2 && <motion.span className="ag-bell__badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>1</motion.span>}</AnimatePresence>
      </div>
      <motion.div className="ag-mail" initial={false} animate={{ y: p >= 1 ? 0 : 30, opacity: p >= 1 ? 1 : 0 }} transition={{ type: 'spring', stiffness: 110, damping: 16 }}>
        <div className="ag-mail__head"><AppIcon icon={Mail} size={16} /><span>{t('guide.strings.yourCompany')}</span><small>{t('guide.strings.now')}</small></div>
        <strong>{t('guide.strings.your2026AppraisalIsReadyForReview')}</strong>
        <p>{t('guide.strings.yourSupervisorHasCompletedYourAppraisalSign')}</p>
        <motion.span className="ag-btn ag-btn--primary" initial={false} animate={{ scale: p >= 3 ? [1, 1.06, 1] : 1 }}>{t('guide.strings.reviewMyAppraisal')}</motion.span>
      </motion.div>
    </div>
  );
};

const DemoMyAppraisals = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(4, [600, 800, 600], runKey, reduced);
  const rows = [['2026', t('guide.strings.pendingAcknowledgement'), 'amber', t('guide.strings.open')], ['2025', t('guide.strings.acknowledged'), 'green', t('guide.strings.view')], ['2024', t('guide.strings.acknowledged'), 'green', t('guide.strings.view')]];
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-list">
        {rows.map(([year, status, tone, action], i) => (
          <div key={year} className={`ag-list__row ${i === 0 && p >= 2 ? 'is-focus' : ''}`}>
            <span className="ag-avatar ag-avatar--year">{year}</span>
            <div className="ag-list__who"><strong>{t('guide.strings.annualAppraisalSpaceYear', { year })}</strong><small>{t('guide.strings.appraisedByYourSupervisor')}</small></div>
            <div className="ag-list__badges"><span className={`ag-pill ag-pill--${tone}`}>{status}</span></div>
            <span className={`ag-btn ${i === 0 ? 'ag-btn--primary' : 'ag-btn--ghost'}`}>{action}</span>
          </div>
        ))}
      </div>
      <Pointer at={p < 1 ? [50, 96] : [90, 22]} tap={p === 3 ? p : null} />
    </div>
  );
};

const DemoResult = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(3, [400, 900], runKey, reduced);
  const bars = [[t('guide.strings.resultsObjectives'), 4.55], [t('guide.strings.coreBehaviours'), 4.57], [t('guide.strings.roleCompetencies'), 4.67]];
  return (
    <div className="ag-stage__inner ag-result">
      <ScoreRing value={4.57} run={p >= 1} />
      <div className="ag-result__bars">
        <span className="ag-pill ag-pill--green">{t('guide.strings.outstanding')}</span>
        {bars.map(([label, v], i) => (
          <div key={label} className="ag-result__bar">
            <span>{label}</span>
            <div className="ag-meter__track"><motion.span className="ag-meter__fill is-full" initial={false} animate={{ width: p >= 2 ? `${(v / 5) * 100}%` : '0%' }} transition={{ duration: 0.8, delay: reduced ? 0 : i * 0.12 }} /></div>
            <strong>{formatScore(v, i18n.language)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const DemoAcknowledge = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [400, 2700, 600, 600], runKey, reduced);
  const done = p >= 3;
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-ack">
        <span className="ag-field__label">{t('guide.strings.yourFeedback')}</span>
        <span className="ag-field__box ag-field__box--tall"><Typewriter text={t('guide.strings.thankYouForTheReviewIAgree')} run={p >= 1} speed={22} /></span>
        <div className="ag-ack__foot">
          <AnimatePresence mode="wait">
            {done
              ? <Pill key="ack" tone="green"><AppIcon icon={Check} size={13} /> {t('guide.strings.acknowledged')}</Pill>
              : <Pill key="pend" tone="amber">{t('guide.strings.pendingAcknowledgement')}</Pill>}
          </AnimatePresence>
          <span className={`ag-btn ${done ? 'ag-btn--done' : 'ag-btn--primary'}`}>{done ? t('guide.strings.sentToYourSupervisor') : t('guide.strings.submitAndAcknowledge')}</span>
        </div>
      </div>
      <Pointer at={p < 2 ? [30, 94] : [82, 80]} tap={p === 2 ? p : null} hidden={p >= 3} />
    </div>
  );
};

const DemoUpdated = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(4, [700, 900, 1000], runKey, reduced);
  const versions = [['#2', t('guide.strings.updatedByYourSupervisor'), '4.57', p >= 1], ['#1', t('guide.strings.firstSubmission'), '4.52', true]];
  return (
    <div className="ag-stage__inner">
      <div className="ag-versions">
        {versions.map(([v, label, score, show]) => (
          <motion.div key={v} className="ag-versions__item" initial={false} animate={{ opacity: show ? 1 : 0, y: show ? 0 : -14 }}>
            <span className="ag-code">{v}</span><span>{label}</span><strong>{formatScore(score, i18n.language)}</strong>
          </motion.div>
        ))}
      </div>
      <div className="ag-chip-row">
        <AnimatePresence mode="wait">
          {p >= 3
            ? <Pill key="a" tone="green"><AppIcon icon={Check} size={13} /> {t('guide.strings.acknowledgedAgain')}</Pill>
            : p >= 2
              ? <Pill key="b" tone="amber">{t('guide.strings.pendingAcknowledgement')}</Pill>
              : <Pill key="c" tone="green">{t('guide.strings.acknowledged')}</Pill>}
        </AnimatePresence>
      </div>
    </div>
  );
};

/* The following demonstrations are illustrative; no live appraisal is changed. */
const DemoFollowup = ({ runKey, reduced, management = false }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [650, 900, 1400, 1000], runKey, reduced);
  const response = t('guide.strings.theSupportingRecordsAreNowAttachedTo');
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-workflow">
        <div className="ag-workflow__heading">
          <AppIcon icon={MessageSquareReply} size={17} />
          <strong>{t('guide.strings.managementFollowUp')}</strong>
          <Pill tone={p >= 4 ? 'green' : 'amber'}>{p >= 4 ? t('guide.strings.resolved') : t('guide.strings.open')}</Pill>
        </div>
        <div className="ag-workflow__request">
          <small>{t('guide.strings.managementRequestDocumentation')}</small>
          <span>{t('guide.strings.pleaseProvideEvidenceForTheRatingsIn')}</span>
        </div>
        <AnimatePresence>
          {p >= 1 && (
            <motion.div className="ag-workflow__response" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <small>{t('guide.strings.supervisorHODResponse')}</small>
              <span><Typewriter text={response} run={p >= 2} speed={24} /></span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ag-workflow__actions">
          {management ? (
            <span className={`ag-btn ${p >= 4 ? 'ag-btn--done' : 'ag-btn--primary'}`}>
              <AppIcon icon={Check} size={14} /> {p >= 4 ? t('guide.strings.followUpResolved') : t('guide.strings.resolveFollowUp')}
            </span>
          ) : (
            <span className={`ag-btn ${p >= 3 ? 'ag-btn--done' : 'ag-btn--primary'}`}>
              <AppIcon icon={p >= 3 ? Check : Send} size={14} /> {p >= 3 ? t('guide.strings.responseSubmitted') : t('guide.strings.sendResponse')}
            </span>
          )}
        </div>
      </div>
      <Pointer at={management ? [77, 83] : [80, 86]} tap={p === (management ? 3 : 2) ? p : null} hidden={p >= 4} />
    </div>
  );
};

const DemoSupervisorUpdates = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(5, [600, 900, 1100, 900], runKey, reduced);
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-workflow">
        <div className="ag-workflow__heading"><AppIcon icon={History} size={17} /><strong>{t('guide.strings.appraisalRevisions')}</strong><Pill tone="neutral">{t('guide.strings.historyRetained')}</Pill></div>
        <div className="ag-versions">
          <div className="ag-versions__item"><span className="ag-code">#3</span><span>{t('guide.strings.secondSupervisorUpdate')}</span><Pill tone="green">{t('guide.strings.saved')}</Pill></div>
          <div className="ag-versions__item"><span className="ag-code">#2</span><span>{t('guide.strings.firstSupervisorUpdate')}</span><span>{formatScore(4.52, i18n.language)}</span></div>
          <div className="ag-versions__item"><span className="ag-code">#1</span><span>{t('guide.strings.initialSubmission')}</span><span>{formatScore(4.40, i18n.language)}</span></div>
        </div>
        <div className="ag-workflow__bottom">
          <span>{t('guide.strings.supervisorUpdatesUsed')}</span><strong>{t('guide.strings.usedOfTotal', { used: 2, total: p >= 3 ? 4 : 2 })}</strong>
        </div>
        <AnimatePresence>
          {p >= 2 && (
            <motion.div className="ag-workflow__notice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AppIcon icon={p >= 3 ? Check : Lock} size={16} />
              {p >= 3 ? t('guide.strings.adminRestoredTwoAdditionalUpdates') : t('guide.strings.updateAllowanceExhaustedAskAnAuthorizedAdmin')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Pointer at={[77, 86]} tap={p === 3 ? p : null} hidden={p >= 4} />
    </div>
  );
};

const DemoManagementOverview = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(4, [750, 900, 1050], runKey, reduced);
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-workflow">
        <div className="ag-workflow__heading"><AppIcon icon={BarChart3} size={17}/><strong>{t('guide.strings.appraisalOversight')}</strong><Pill tone="neutral">{t('guide.strings.annualAppraisal2026_3a0788a')}</Pill></div>
        <div className="ag-workflow__stats">
          <div><small>{t('guide.strings.submitted')}</small><strong>12</strong></div>
          <div><small>{t('guide.strings.awaitingReview')}</small><strong>3</strong></div>
          <div><small>{t('guide.strings.followUpsOpen')}</small><strong>1</strong></div>
        </div>
        <div className={`ag-workflow__person ${p >= 1 ? 'is-highlighted' : ''}`}>
          <span className="ag-avatar">IN</span>
          <div><strong>{t('guide.strings.sampleAppraisal')}</strong><small>{t('guide.strings.accountSeniorStaff')}</small></div>
          <span>{formatScore(4.57, i18n.language)}</span>
        </div>
        <AnimatePresence>
          {p >= 2 && <motion.div className="ag-workflow__notice" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}>
            <AppIcon icon={Check} size={16}/> {t('guide.strings.compareSectionScoresEvidenceAndRevisionHistory')}
          </motion.div>}
        </AnimatePresence>
      </div>
      <Pointer at={p < 2 ? [70, 62] : [72, 85]} tap={p === 1 ? p : null} hidden={p >= 3} />
    </div>
  );
};

const DemoVerification = ({ runKey, reduced }) => {
  const { t, i18n } = useTranslation('appraisals');
  const p = useTimeline(5, [850, 950, 1250, 1000], runKey, reduced);
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-workflow">
        <div className="ag-workflow__heading"><AppIcon icon={ShieldCheck} size={17}/><strong>{t('guide.strings.verifySeriousBreach')}</strong><Pill tone={p >= 3 ? 'green' : 'amber'}>{p >= 3 ? t('guide.strings.dismissed') : t('guide.strings.pendingReview')}</Pill></div>
        <div className="ag-workflow__request">
          <small>{t('guide.strings.supervisorDeclarationHSE')}</small>
          <span>{t('guide.strings.reasonReportedNonComplianceWithSafetyProcedure')}</span>
          <small>{t('guide.strings.referenceIncidentIR2026031')}</small>
        </div>
        <div className="ag-workflow__score">
          <div><small>{t('guide.strings.originalWeightedScore')}</small><strong>{formatScore(4.57, i18n.language)}</strong></div>
          <div><small>{t('guide.strings.finalScore')}</small><strong>{p >= 3 ? formatScore(4.57, i18n.language) : formatScore(2, i18n.language)}</strong></div>
        </div>
        <AnimatePresence>
          {p >= 1 && (
            <motion.div className="ag-workflow__response" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <small>{t('guide.strings.managementDecisionReason')}</small>
              <span><Typewriter text={t('guide.strings.investigationFoundThatTheIncidentWasNot')} run={p >= 2} speed={19}/></span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Pointer at={[78, 80]} tap={p === 2 ? p : null} hidden={p >= 3} />
    </div>
  );
};

const DemoRestore = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(5, [650, 900, 1400, 900], runKey, reduced);
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-workflow">
        <div className="ag-workflow__heading"><AppIcon icon={History} size={17}/><strong>{t('guide.strings.restoreSupervisorUpdates')}</strong><Pill tone="neutral">{t('guide.strings.exceptionOnly')}</Pill></div>
        <div className="ag-workflow__bottom"><span>{t('guide.strings.updateAttemptsUsed')}</span><strong>{t('guide.strings.usedOfTotal', { used: 2, total: p >= 3 ? 4 : 2 })}</strong></div>
        <div className="ag-workflow__response">
          <small>{t('guide.strings.administrativeReasonRequired')}</small>
          <span><Typewriter text={t('guide.strings.approvedCorrectionFollowingAdditionalManagementEvidence')} run={p >= 1} speed={24}/></span>
        </div>
        <div className="ag-workflow__actions">
          <span className={`ag-btn ${p >= 3 ? 'ag-btn--done' : 'ag-btn--primary'}`}>
            <AppIcon icon={p >= 3 ? Check : RotateCcw} size={14}/>{p >= 3 ? t('guide.strings.twoUpdatesRestored') : t('guide.strings.restoreTwoUpdates')}
          </span>
        </div>
        <AnimatePresence>
          {p >= 4 && <motion.div className="ag-workflow__notice" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}><AppIcon icon={Bell} size={15}/> {t('guide.strings.supervisorNotifiedPreviousVersionsPreserved')}</motion.div>}
        </AnimatePresence>
      </div>
      <Pointer at={[82, 73]} tap={p === 2 ? p : null} hidden={p >= 3}/>
    </div>
  );
};

const DemoAudit = ({ runKey, reduced }) => {
  const { t } = useTranslation('appraisals');
  const p = useTimeline(4, [650, 850, 900], runKey, reduced);
  const activities = [
    ['#3', t('guide.strings.supervisorUpdatedAppraisal'), t('guide.strings.recordedRevision')],
    ['#2', t('guide.strings.managementFollowUpResolved'), t('guide.strings.recordedResponse')],
    ['#1', t('guide.strings.originalAppraisalSubmitted'), t('guide.strings.originalSnapshot')],
  ];
  return (
    <div className="ag-stage__inner">
      <div className="ag-mock ag-mock--card ag-workflow">
        <div className="ag-workflow__heading"><AppIcon icon={History} size={17}/><strong>{t('guide.strings.historyReporting')}</strong><Pill tone="green">{t('guide.strings.traceable')}</Pill></div>
        <div className="ag-versions">
          {activities.map(([revision, action, note], i) => (
            <motion.div key={revision} className="ag-versions__item" initial={false} animate={{ opacity: p >= i + 1 ? 1 : 0.3 }}>
              <span className="ag-code">{revision}</span><span>{action}</span><small>{note}</small>
            </motion.div>
          ))}
        </div>
        <div className="ag-workflow__actions"><span className="ag-btn ag-btn--ghost">{t('guide.strings.exportPermittedRecords')}</span></div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

const buildGuideTracks = (t) => ({
  supervisor: {
    label: t('guide.strings.appraisingMyTeam'),
    steps: [
      {
        phase: t('guide.strings.getStarted'), title: t('guide.strings.completeSupervisorOnboarding'), Demo: DemoSupervisorOnboarding,
        text: t('guide.strings.startFromYourDashboardBeforeYourTeam'),
        points: [
          t('guide.strings.confirmTheCycleAndYourAssignedStaff'),
          t('guide.strings.reviewAllRatingScaleExplanationsUsingNext'),
          t('guide.strings.tickTheFairnessAcknowledgementThenSelectComplete'),
          t('guide.strings.onboardingIsRecordedForTheSelectedCycle'),
        ],
      },
      {
        phase: t('guide.strings.prepare'), title: t('guide.strings.checkTheCycle'), Demo: DemoContext,
        text: t('guide.strings.afterOnboardingConfirmTheCorrectAppraisalCycle'),
        points: [t('guide.strings.theCycleDecidesTheRatingPointsSection'), t('guide.strings.ifTheWrongCycleIsShowingSwitch')],
      },
      {
        phase: t('guide.strings.prepare'), title: t('guide.strings.setEachPersonsLevel'), Demo: DemoReadiness,
        text: t('guide.strings.yourAssignedStaffAppearInYourAppraisal'),
        points: [t('guide.strings.siteJuniorStaffSeniorStaffOrManager'), t('guide.strings.theLevelSetsTheSectionWeightsAnd'), t('guide.strings.itAppliesToThisCycleOnlyAnd')],
      },
      {
        phase: t('guide.strings.prepare'), title: t('guide.strings.agreeAndLockTheObjectives'), Demo: DemoObjectives,
        text: t('guide.strings.theDepartmentsKPIsAreAlreadyLoadedWith'),
        points: [t('guide.strings.followTheMinimumAndMaximumSetFor'), t('guide.strings.whenWeightsAreRequiredTheyMustAdd'), t('guide.strings.startAppearsOnceThePlanIsLocked')],
      },
      {
        phase: t('guide.strings.rate'), title: t('guide.strings.knowWhatEachSectionMeasures'), Demo: DemoSections,
        text: t('guide.strings.everyAppraisalHasThreeSectionsTheirWeights'),
        points: [t('guide.strings.aWhatWasDeliveredAgainstTheObjectives'), t('guide.strings.bHowTheWorkWasDoneB7'), t('guide.strings.cTheSkillsExpectedAtThatLevel')],
      },
      {
        phase: t('guide.strings.rate'), title: t('guide.strings.rateAgainstTheDescriptions'), Demo: DemoAnchors,
        text: t('guide.strings.behaviourAndCompetencyQuestionsDescribeWhatA'),
        points: [t('guide.strings.choose2Or4WhenPerformanceSits'), t('guide.strings.a3FullyMeetsIsAGood')],
      },
      {
        phase: t('guide.strings.rate'), title: t('guide.strings.addEvidenceWhereItIsAskedFor'), Demo: DemoEvidence,
        text: t('guide.strings.someRatingsNeedAWrittenExampleWhen'),
        points: [t('guide.strings.giveASpecificExampleFromThePeriod'), t('guide.strings.optionalFieldsCanBeShownWithShow')],
      },
      {
        phase: t('guide.strings.rate'), title: t('guide.strings.declareAnySeriousHSEOrIntegrityBreach'), Demo: DemoBreach,
        text: t('guide.strings.answerYesOrNoOnEveryAppraisal'),
        points: [t('guide.strings.useARealIncidentReportNCROr'), t('guide.strings.submissionDoesNotWaitForApprovalAuthorized'), t('guide.strings.aDismissalRemovesTheCapWhileRetaining')],
      },
      {
        phase: t('guide.strings.submit'), title: t('guide.strings.completeTheThreeRecommendations'), Demo: DemoRecommendations,
        text: t('guide.strings.statusUpgradeSalaryUpgradeAndDevelopmentAre'),
        points: [t('guide.strings.writeNoWhenNothingIsRecommendedSo'), t('guide.strings.beSpecificAboutDevelopmentNameTheTraining')],
      },
      {
        phase: t('guide.strings.submit'), title: t('guide.strings.checkAndSubmit'), Demo: DemoSubmit,
        text: t('guide.strings.watchTheLiveScoreAndTheCount'),
        points: [t('guide.strings.submittingNotifiesTheEmployeeStraightAway'), t('guide.strings.questionsWeightsAndRatingsAreSavedAs')],
      },
      {
        phase: t('guide.strings.after'), title: t('guide.strings.whatHappensNext'), Demo: DemoAfter,
        text: t('guide.strings.theEmployeeReviewsGivesFeedbackAndAcknowledges'),
        points: [t('guide.strings.aFollowUpDoesNotBlockEmployee'), t('guide.strings.youCanReplyWithClarificationOrMake')],
      },
      {
        phase: t('guide.strings.after'), title: t('guide.strings.replyToManagementFollowUps'), Demo: DemoFollowup,
        text: t('guide.strings.openTheManagementRequestExplainYourEvidence'),
        points: [t('guide.strings.aResponseCanBeAnExplanationAn'), t('guide.strings.useTheExistingFollowUpResponseAction')],
      },
      {
        phase: t('guide.strings.after'), title: t('guide.strings.trackRevisionsAndExtraAttempts'), Demo: DemoSupervisorUpdates,
        text: t('guide.strings.updatesCreateNewAppraisalVersionsOnceThe'),
        points: [t('guide.strings.previousRevisionsRemainVisibleAndAreNever'), t('guide.strings.theAdminMustProvideAReasonThe')],
      },
    ],
  },
  employee: {
    label: t('guide.strings.myOwnAppraisal'),
    steps: [
      {
        phase: t('guide.strings.receive'), title: t('guide.strings.youWillBeToldWhenItIs'), Demo: DemoInbox,
        text: t('guide.strings.whenYourSupervisorSubmitsYourAppraisalYou'),
        points: [t('guide.strings.forPrivacyTheEmailNeverShowsYour'), t('guide.strings.signInWithYourWorkEmailTo')],
      },
      {
        phase: t('guide.strings.receive'), title: t('guide.strings.openItFromMyAppraisals'), Demo: DemoMyAppraisals,
        text: t('guide.strings.myAppraisalsListsEveryCycleTheCurrent'),
        points: [t('guide.strings.earlierYearsStayAvailableToView')],
      },
      {
        phase: t('guide.strings.read'), title: t('guide.strings.readYourResult'), Demo: DemoResult,
        text: t('guide.strings.youWillSeeYourOverallScoreIts'),
        points: [t('guide.strings.resultsObjectivesWhatYouDelivered'), t('guide.strings.coreBehavioursAndRoleCompetenciesHowYou')],
      },
      {
        phase: t('guide.strings.respond'), title: t('guide.strings.writeYourFeedbackAndAcknowledge'), Demo: DemoAcknowledge,
        text: t('guide.strings.addYourCommentsThenAcknowledgeAcknowledgingConfirms'),
        points: [t('guide.strings.useTheFeedbackToAgreeRaiseA')],
      },
      {
        phase: t('guide.strings.respond'), title: t('guide.strings.ifYourAppraisalIsUpdated'), Demo: DemoUpdated,
        text: t('guide.strings.yourSupervisorCanUpdateYourAppraisalEach'),
        points: [t('guide.strings.everyVersionIsKeptSoChangesAre')],
      },
    ],
  },
  management: {
    label: t('guide.strings.managementReview'),
    steps: [
      {
        phase: t('guide.strings.review'), title: t('guide.strings.inspectSubmittedAppraisals'), Demo: DemoManagementOverview,
        text: t('guide.strings.openAppraisalsToExamineTheRecordsWithin'),
        points: [t('guide.strings.adminsWhoAlsoSuperviseHaveASeparate'), t('guide.strings.companyAndStaffAccessRestrictionsStillApply')],
      },
      {
        phase: t('guide.strings.review'), title: t('guide.strings.askForClarification'), Demo: (props) => <DemoFollowup {...props} management />,
        text: t('guide.strings.requestClarificationOrSupportingEvidenceFromThe'),
        points: [t('guide.strings.aFollowUpDoesNotPreventEmployee'), t('guide.strings.aSupervisorCanRespondWithoutRevisingThe')],
      },
      {
        phase: t('guide.strings.decide'), title: t('guide.strings.verifyADeclaredSeriousBreach'), Demo: DemoVerification,
        text: t('guide.strings.checkTheStatedReasonAndSupportingReference'),
        points: [t('guide.strings.pendingAndConfirmedBreachesCapTheFinal'), t('guide.strings.dismissingABreachRestoresTheOriginalWeighted'), t('guide.strings.doNotVerifyAnAppraisalThatYou')],
      },
      {
        phase: t('guide.strings.decide'), title: t('guide.strings.restoreExhaustedUpdateAttempts'), Demo: DemoRestore,
        text: t('guide.strings.forAJustifiedExceptionAnAuthorizedAdmin'),
        points: [t('guide.strings.theResetRequiresAReasonAndNotifies'), t('guide.strings.theOldUpdateCountAndEveryRevision'), t('guide.strings.adminsCannotRestoreTheirOwnAppraisalUpdate')],
      },
      {
        phase: t('guide.strings.audit'), title: t('guide.strings.traceDecisionsAndExportReports'), Demo: DemoAudit,
        text: t('guide.strings.useReviewHistoryRevisionSnapshotsAndAudit'),
        points: [t('guide.strings.finalScoresIncorporateAnyActiveSeriousBreach'), t('guide.strings.reportsAndExportsMustRespectYourCompany')],
      },
    ],
  },
});

/* ------------------------------------------------------------------ */
/*  Guide shell                                                        */
/* ------------------------------------------------------------------ */

const SupervisorAppraisalGuide = () => {
  const { t } = useTranslation('appraisals');
  const user = useAuthStore((state) => state.user);
  const authenticated = useAuthStore((state) => state.authenticated);
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const transferringLoginChoice = useLocaleStore((state) => state.transferringLoginChoice);
  const location = useLocation();
  const reduced = Boolean(useReducedMotion());

  const availableTracks = useMemo(() => getAppraisalGuideTracks(user), [user]);
  const allowed = availableTracks.length > 0;
  const key = useMemo(() => userGuideKey(user), [user]);

  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState('employee');
  const [step, setStep] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const dialogRef = useRef(null);

  const activeTrack = availableTracks.includes(track) ? track : (availableTracks[0] || 'employee');
  const tracks = useMemo(() => buildGuideTracks(t), [t]);
  const steps = tracks[activeTrack].steps;
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const go = useCallback((next) => {
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
    setRunKey((v) => v + 1);
  }, [steps.length]);

  const switchTrack = (id) => {
    if (!availableTracks.includes(id)) return;
    setTrack(id);
    setStep(0);
    setRunKey((v) => v + 1);
  };

  const openGuide = useCallback(() => {
    setTrack(availableTracks[0] || 'employee');
    setStep(0);
    setRunKey((v) => v + 1);
    setOpen(true);
  }, [availableTracks]);

  useEffect(() => {
    const handleManualOpen = () => { if (allowed) openGuide(); };
    window.addEventListener(SUPERVISOR_GUIDE_EVENT, handleManualOpen);
    return () => window.removeEventListener(SUPERVISOR_GUIDE_EVENT, handleManualOpen);
  }, [allowed, openGuide]);

  // Open once per guide version, the first time the person signs in.
  useEffect(() => {
    if (!sessionChecked || !authenticated || !allowed) return undefined;
    if (location.pathname === '/change-password' || location.pathname === '/login') return undefined;
    // The one-time language choice must complete before the existing guide opens.
    if (transferringLoginChoice || needsLanguageChoice(user)) return undefined;
    if (window.localStorage.getItem(key) === 'seen') return undefined;
    const timer = window.setTimeout(openGuide, 900);
    return () => window.clearTimeout(timer);
  }, [authenticated, allowed, key, location.pathname, sessionChecked, transferringLoginChoice, user, openGuide]);

  const closeGuide = useCallback(() => {
    if (allowed) window.localStorage.setItem(key, 'seen');
    setOpen(false);
  }, [allowed, key]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 40);

    const handleKey = (event) => {
      if (event.key === 'Escape') closeGuide();
      if (event.key === 'ArrowRight') go(step + 1);
      if (event.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open, step, go, closeGuide]);

  // Keep the current step visible in the rail (it scrolls sideways on phones).
  useEffect(() => {
    if (!open) return;
    const active = dialogRef.current?.querySelector('.ag__rail-step.is-active');
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [open, step, track, reduced, t]);

  if (!allowed) return null;

  const Demo = current.Demo;
  const phases = [...new Set(steps.map((s) => s.phase))];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
          className="ag-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeGuide}
        >
          <motion.section
            ref={dialogRef}
            tabIndex={-1}
            className="ag"
            initial={{ opacity: 0, y: reduced ? 0 : 28, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 16 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ag-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="ag__header">
              <div className="ag__heading">
                <h2 id="ag-title">{t('guide.strings.appraisalGuide')}</h2>
                {availableTracks.length > 1 ? (
                  <div className="ag__tracks" role="tablist" aria-label={t('guide.strings.chooseAGuide')}>
                    {availableTracks.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={activeTrack === id}
                        className={activeTrack === id ? 'is-active' : ''}
                        onClick={() => switchTrack(id)}
                      >
                        {activeTrack === id && <motion.span layoutId="ag-track-bg" className="ag__tracks-bg" transition={{ type: 'spring', stiffness: 260, damping: 28 }} />}
                        <span className="ag__tracks-text">{tracks[id].label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="ag__sub">{activeTrack === 'management' ? t('guide.strings.howToReviewVerifyAndProtectThe') : t('guide.strings.howYourAppraisalReachesYouAndWhat')}</p>
                )}
              </div>
              <button type="button" className="ag__close" onClick={closeGuide} aria-label={t('guide.strings.closeAppraisalGuide')}><AppIcon icon={X} size={18} /></button>
            </header>

            <div className="ag__body">
              <nav className="ag__rail" aria-label={t('guide.strings.guideSteps')}>
                {phases.map((phase) => (
                  <div className="ag__rail-group" key={phase}>
                    <span className="ag__rail-phase">{phase}</span>
                    {steps.map((s, i) => (s.phase !== phase ? null : (
                      <button
                        key={s.title}
                        type="button"
                        className={`ag__rail-step ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}
                        aria-current={i === step ? 'step' : undefined}
                        onClick={() => go(i)}
                      >
                        <span className="ag__rail-num">{i < step ? <AppIcon icon={Check} size={12} /> : i + 1}</span>
                        <span className="ag__rail-text">{s.title}</span>
                      </button>
                    )))}
                  </div>
                ))}
              </nav>

              <div className="ag__main">
                <div className="ag__progress" aria-hidden="true">
                  <motion.span initial={false} animate={{ width: `${((step + 1) / steps.length) * 100}%` }} transition={{ duration: 0.4 }} />
                </div>

                <div className="ag-stage">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeTrack}-${step}`}
                      className="ag-stage__frame"
                      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Demo runKey={runKey} reduced={reduced} />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`copy-${activeTrack}-${step}`}
                    className="ag__copy"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-live="polite"
                  >
                    <div className="ag__meta">
                      <span className="ag__count">{t('guide.strings.stepOfTotal', { step: step + 1, total: steps.length })}</span>
                      {!reduced && (
                        <button type="button" className="ag__replay" onClick={() => setRunKey((v) => v + 1)}>
                          <AppIcon icon={RotateCcw} size={13} /> {t('guide.strings.replayDemo')}
                        </button>
                      )}
                    </div>
                    <h3>{current.title}</h3>
                    <p>{current.text}</p>
                    {current.points?.length > 0 && (
                      <ul>{current.points.map((point) => <li key={point}>{point}</li>)}</ul>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <footer className="ag__footer">
              <button type="button" className="ag__link" onClick={closeGuide}>{t('guide.strings.closeGuide')}</button>
              <div className="ag__nav">
                <button type="button" className="ag__back" disabled={step === 0} onClick={() => go(step - 1)}>
                  <AppIcon icon={ArrowLeft} size={15} /> {t('guide.strings.back')}
                </button>
                <button type="button" className="ag__next" onClick={() => (isLast ? closeGuide() : go(step + 1))}>
                  {isLast ? t('guide.strings.finish') : t('guide.strings.next')}
                  {!isLast && <AppIcon icon={ArrowRight} size={15} />}
                </button>
              </div>
            </footer>
          </motion.section>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SupervisorAppraisalGuide;
