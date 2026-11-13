import React, { useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  LockKeyhole,
  Scale,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import AppSelect from '../ui/AppSelect';
import AppIcon from '../ui/AppIcon';
import api from '../../services/api';
import './SupervisorOnboardingExperience.css';

const defaultRatingSlides = (t) => ([
  {
    score: '1',
    tone: 'danger',
    title: t('onboarding.ratings.1.title'),
    summary: t('onboarding.ratings.1.summary'),
    useWhen: [t('onboarding.ratings.1.useWhen.1'), t('onboarding.ratings.1.useWhen.2'), t('onboarding.ratings.1.useWhen.3')],
    evidence: [t('onboarding.ratings.1.evidence.1'), t('onboarding.ratings.1.evidence.2'), t('onboarding.ratings.1.evidence.3')],
    reminder: t('onboarding.ratings.1.reminder'),
  },
  {
    score: '2',
    tone: 'warning',
    title: t('onboarding.ratings.2.title'),
    summary: t('onboarding.ratings.2.summary'),
    useWhen: [t('onboarding.ratings.2.useWhen.1'), t('onboarding.ratings.2.useWhen.2'), t('onboarding.ratings.2.useWhen.3')],
    evidence: [t('onboarding.ratings.2.evidence.1'), t('onboarding.ratings.2.evidence.2'), t('onboarding.ratings.2.evidence.3')],
    reminder: t('onboarding.ratings.2.reminder'),
  },
  {
    score: '3',
    tone: 'info',
    title: t('onboarding.ratings.3.title'),
    summary: t('onboarding.ratings.3.summary'),
    useWhen: [t('onboarding.ratings.3.useWhen.1'), t('onboarding.ratings.3.useWhen.2'), t('onboarding.ratings.3.useWhen.3')],
    evidence: [t('onboarding.ratings.3.evidence.1'), t('onboarding.ratings.3.evidence.2'), t('onboarding.ratings.3.evidence.3')],
    reminder: t('onboarding.ratings.3.reminder'),
  },
  {
    score: '4',
    tone: 'success',
    title: t('onboarding.ratings.4.title'),
    summary: t('onboarding.ratings.4.summary'),
    useWhen: [t('onboarding.ratings.4.useWhen.1'), t('onboarding.ratings.4.useWhen.2'), t('onboarding.ratings.4.useWhen.3')],
    evidence: [t('onboarding.ratings.4.evidence.1'), t('onboarding.ratings.4.evidence.2'), t('onboarding.ratings.4.evidence.3')],
    reminder: t('onboarding.ratings.4.reminder'),
  },
  {
    score: '5',
    tone: 'primary',
    title: t('onboarding.ratings.5.title'),
    summary: t('onboarding.ratings.5.summary'),
    useWhen: [t('onboarding.ratings.5.useWhen.1'), t('onboarding.ratings.5.useWhen.2'), t('onboarding.ratings.5.useWhen.3')],
    evidence: [t('onboarding.ratings.5.evidence.1'), t('onboarding.ratings.5.evidence.2'), t('onboarding.ratings.5.evidence.3')],
    reminder: t('onboarding.ratings.5.reminder'),
  },
]);

const clampIndex = (value, length) => Math.max(0, Math.min(Math.max(length - 1, 0), value));

const SupervisorOnboardingExperience = ({
  cycle,
  cycleId,
  cycleOptions = [],
  onCycleChange,
  assignedCount = 0,
  supervisorName,
  roleLabel, 
  loading = false,
  onOnboard,
  backTo,
  backLabel,
}) => {
  const { t, i18n: translationI18n } = useTranslation('appraisals');
  const reduceMotion = useReducedMotion();
  const locale = translationI18n.resolvedLanguage || translationI18n.language;
  const localizedDefaultSlides = useMemo(() => defaultRatingSlides(t), [t]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [configuredPoints, setConfiguredPoints] = useState([]);

  const selectedCycleId = cycleId || cycle?.id || '';
  const year = cycle?.year || t('onboarding.currentYear');
  const cycleTitle = cycle?.title || t('onboarding.activeCycle');
  const ratingSlides = useMemo(() => {
    const points = (configuredPoints || [])
      .filter((point) => Number(point.is_active ?? 1) === 1 && Number.isFinite(Number(point.rating_value)))
      .sort((a, b) => (Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)) || (Number(a.rating_value) - Number(b.rating_value)));
    if (!points.length) return localizedDefaultSlides;

    const fallbackTones = ['danger', 'warning', 'info', 'success', 'primary'];
    return points.map((point, index) => {
      const score = String(Number(point.rating_value));
      const base = localizedDefaultSlides.find((item) => Number(item.score) === Number(point.rating_value));
      const position = points.length <= 1 ? 4 : Math.round((index / (points.length - 1)) * 4);
      const evidenceRequirement = String(point.evidence_requirement || '').trim();
      const hasEvidenceRequirement = evidenceRequirement && !/^(not required|none|n\/?a|not applicable|non requis|pas obligatoire|aucun(?:e)?|sans objet)$/i.test(evidenceRequirement);
      const definition = String(point.definition || '').trim();
      return {
        score,
        tone: base?.tone || fallbackTones[position],
        title: String(point.label || '').trim() || base?.title || t('onboarding.ratingWithScore', { score }),
        summary: definition || base?.summary || t('onboarding.definitionFallback'),
        useWhen: base?.useWhen || [definition || t('onboarding.whenFallback')],
        evidence: base?.evidence || [t('onboarding.evidenceFallback')],
        requirements: [
          ...(hasEvidenceRequirement ? [evidenceRequirement] : []),
          ...(Number(point.requires_comment ?? 0) === 1 ? [t('onboarding.requiresComment')] : []),
        ],
        reminder: base?.reminder || t('onboarding.reminderFallback'),
      };
    });
  }, [configuredPoints, localizedDefaultSlides, t]);
  const activeSlide = ratingSlides[activeIndex] || ratingSlides[0];
  const displayRating = (score) => formatNumber(score, { maximumFractionDigits: 3 }, locale);
  const guideComplete = furthestIndex >= ratingSlides.length - 1;
  const canOnboard = guideComplete && accepted && Number(assignedCount) > 0 && selectedCycleId && !loading;

  useEffect(() => {
    let cancelled = false;
    if (!selectedCycleId) {
      setConfiguredPoints([]);
      return () => { cancelled = true; };
    }
    api.get(`/cycles/scoring-config?cycle_id=${encodeURIComponent(selectedCycleId)}`)
      .then((response) => {
        if (!cancelled) setConfiguredPoints(response.data?.data?.rating_points || []);
      })
      .catch(() => {
        if (!cancelled) setConfiguredPoints([]);
      });
    return () => { cancelled = true; };
    // Rating labels are translated by the server: reload them when the language changes.
  }, [selectedCycleId, i18n.resolvedLanguage]);

  useEffect(() => {
    setActiveIndex(0);
    setFurthestIndex(0);
    setAccepted(false);
  }, [selectedCycleId, ratingSlides.length]);

  const progress = useMemo(
    () => Math.round(((activeIndex + 1) / ratingSlides.length) * 100),
    [activeIndex]
  );

  const goToSlide = (nextIndex) => {
    const safeIndex = clampIndex(nextIndex, ratingSlides.length);
    setActiveIndex(safeIndex);
    setFurthestIndex((current) => Math.max(current, safeIndex));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToSlide(activeIndex + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    }
  };

  const handleOnboard = async () => {
    if (!canOnboard || typeof onOnboard !== 'function') return;
    await onOnboard();
  };

  return (
    <motion.section
      className="sup-onboarding"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="supervisor-onboarding-title"
    >
      <div className="sup-onboarding__glow sup-onboarding__glow--top" />
      <div className="sup-onboarding__glow sup-onboarding__glow--bottom" />

      <aside className="sup-onboarding__sidebar">
        <div className="sup-onboarding__brand-icon"><AppIcon icon={UserCheck} /></div>
        <span className="sup-onboarding__eyebrow">{t('onboarding.roleOnboarding', { role: roleLabel || t('list.supervisor') })}</span>
        <h2 id="supervisor-onboarding-title">{t('onboarding.heading')}</h2>
        <p className="sup-onboarding__intro">
          {t('onboarding.intro', { year })}
        </p>

        {cycleOptions.length > 0 && typeof onCycleChange === 'function' && (
          <div className="sup-onboarding__cycle-select">
            <AppSelect
              label={t('onboarding.cycleLabel')}
              value={selectedCycleId}
              onChange={onCycleChange}
              options={cycleOptions}
              searchable
              clearable={false}
              placeholder={t('onboarding.selectCycle')}
              icon={CalendarCheck}
            />
          </div>
        )}

        <div className="sup-onboarding__facts">
          <div className="sup-onboarding__fact">
            <span><AppIcon icon={CalendarCheck} /> {t('list.cycle')}</span>
            <strong>{cycleTitle} ({year})</strong>
          </div>
          <div className="sup-onboarding__fact">
            <span><AppIcon icon={Users} /> {t('list.assignedEmployees')}</span>
            <strong>{formatNumber(assignedCount || 0)}</strong>
          </div>
          <div className="sup-onboarding__fact">
            <span><AppIcon icon={UserCheck} /> {t('list.supervisor')}</span>
            <strong>{supervisorName || t('list.supervisor')}</strong>
          </div>
        </div>

        <div className="sup-onboarding__journey" aria-label={t('onboarding.progressAria')}>
          <div className="sup-onboarding__journey-item sup-onboarding__journey-item--done">
            <span><AppIcon icon={Check} /></span>
            <div><strong>{t('onboarding.confirmCycle')}</strong><small>{t('onboarding.checkCycle')}</small></div>
          </div>
          <div className={`sup-onboarding__journey-item ${guideComplete ? 'sup-onboarding__journey-item--done' : 'sup-onboarding__journey-item--active'}`}>
            <span>{guideComplete ? <AppIcon icon={Check} /> : '2'}</span>
            <div><strong>{t('onboarding.reviewScale')}</strong><small>{t('onboarding.reviewConfigured', { count: ratingSlides.length })}</small></div>
          </div>
          <div className={`sup-onboarding__journey-item ${guideComplete && accepted ? 'sup-onboarding__journey-item--active' : ''}`}>
            <span>3</span>
            <div><strong>{t('onboarding.confirmBegin')}</strong><small>{t('onboarding.acknowledgeUnlock')}</small></div>
          </div>
        </div>

        {Number(assignedCount) <= 0 && (
          <div className="sup-onboarding__warning">
            <AppIcon icon={TriangleAlert} />
            <p>{t('onboarding.noEmployees')}</p>
          </div>
        )}
      </aside>

      <div className="sup-onboarding__guide" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="sup-onboarding__guide-head">
          <div>
            <span className="sup-onboarding__eyebrow">{t('onboarding.ratingScaleEyebrow')}</span>
            <h3>{t('onboarding.learnOne')}</h3>
            <p>{t('onboarding.guideInstructions')}</p>
          </div>
          <div className="sup-onboarding__counter" aria-live="polite">
            <span>{t('onboarding.rating')}</span>
            <strong>{activeIndex + 1}<small>/ {ratingSlides.length}</small></strong>
          </div>
        </div>

        <div className="sup-onboarding__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="sup-onboarding__slide-stage">
          <AnimatePresence mode="wait">
            <motion.article
              key={activeSlide.score}
              className={`sup-onboarding__slide sup-onboarding__slide--${activeSlide.tone}`}
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -18 }}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="sup-onboarding__slide-hero">
                <span className="sup-onboarding__score" aria-label={t('onboarding.ratingWithScore', { score: displayRating(activeSlide.score) })}>
                  {displayRating(activeSlide.score)}
                </span>
                <div className="sup-onboarding__slide-copy">
                  <h4>{activeSlide.title}</h4>
                  <p>{activeSlide.summary}</p>
                </div>
              </div>

              <div className="sup-onboarding__explanation-grid">
                <section>
                  <h5>{t('onboarding.useWhen')}</h5>
                  <ul>
                    {activeSlide.useWhen.map((item, index) => <li key={`${index}-${item}`}><span>{item}</span></li>)}
                  </ul>
                </section>

                <section>
                  <h5>{t('onboarding.lookForEvidence')}</h5>
                  <ul>
                    {activeSlide.evidence.map((item, index) => <li key={`${index}-${item}`}><span>{item}</span></li>)}
                  </ul>
                </section>
              </div>

              {activeSlide.requirements?.length > 0 && (
                <p className="sup-onboarding__requirement">
                  <strong>{t('onboarding.requiredWhenRating')}</strong>{' '}
                  {activeSlide.requirements.join(' · ')}
                </p>
              )}

              <p className="sup-onboarding__fairness-note">
                <AppIcon icon={Scale} />
                <span>{activeSlide.reminder}</span>
              </p>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="sup-onboarding__navigation">
          {activeIndex > 0 && (
            <button
              type="button"
              className="sup-onboarding__nav-btn sup-onboarding__nav-btn--secondary"
              onClick={() => goToSlide(activeIndex - 1)}
            >
              <AppIcon icon={ArrowLeft} /> {t('onboarding.previous')}
            </button>
          )}

          <div className="sup-onboarding__dots" role="tablist" aria-label={t('onboarding.dotsAria')}>
            {ratingSlides.map((item, index) => (
              <button
                type="button"
                key={item.score}
                className={`${index === activeIndex ? 'is-active' : ''} ${index <= furthestIndex ? 'is-viewed' : ''}`}
                onClick={() => goToSlide(index)}
                aria-label={t('onboarding.openRating', { score: displayRating(item.score), title: item.title })}
                title={`${displayRating(item.score)} · ${item.title}`}
                aria-selected={index === activeIndex}
                aria-current={index === activeIndex ? 'step' : undefined}
                role="tab"
              >
                {displayRating(item.score)}
              </button>
            ))}
          </div>

          {activeIndex < ratingSlides.length - 1 && (
            <button
              type="button"
              className="sup-onboarding__nav-btn sup-onboarding__nav-btn--primary"
              onClick={() => goToSlide(activeIndex + 1)}
            >
              {t('onboarding.nextRating')} <AppIcon icon={ArrowRight} />
            </button>
          )}
        </div>

        <div className={`sup-onboarding__confirmation ${guideComplete ? 'is-unlocked' : ''}`}>
          {guideComplete ? (
            <>
              <label className="sup-onboarding__agreement">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                <span>
                  {t('onboarding.agreement')}
                </span>
              </label>

              <div className="sup-onboarding__actions">
                {backTo && (
                  <Link className="sup-onboarding__action sup-onboarding__action--secondary" to={backTo}>
                    <AppIcon icon={ArrowLeft} /> {backLabel || t('list.backToDashboard')}
                  </Link>
                )}
                <button
                  type="button"
                  className="sup-onboarding__action sup-onboarding__action--primary"
                  disabled={!canOnboard}
                  onClick={handleOnboard}
                >
                  {loading ? (
                    <><span className="sup-onboarding__spinner" /> {t('onboarding.completeLoading')}</>
                  ) : (
                    <>{t('onboarding.completeYear', { year })} <AppIcon icon={ArrowRight} /></>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="sup-onboarding__locked-note">
              <span><AppIcon icon={LockKeyhole} /></span>
              <div><strong>{t('onboarding.lockedTitle')}</strong><p>{t('onboarding.lockedDetail')}</p></div>
              <em>{t('onboarding.reviewedCount', { reviewed: furthestIndex + 1, total: ratingSlides.length })}</em>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default SupervisorOnboardingExperience;
