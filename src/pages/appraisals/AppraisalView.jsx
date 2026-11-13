import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime, formatNumber, formatScore } from '../../utils/format';
import React, { useEffect, useState } from 'react';
import { ratingRingStyle } from '../../utils/ratingRingStyle';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PageNav from '../../components/PageNav';
import AppIcon from '../../components/ui/AppIcon';
import { CircleCheck, FileDown, History, Info, MessageSquare, MessageSquareReply, PenLine, RefreshCw, ShieldCheck, Target, TriangleAlert, UserCheck } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useAppraisalsStore from '../../stores/useAppraisalsStore';
import AppraisalShell from './AppraisalShell';
import AppraisalPdfDocument from '../../components/pdf/AppraisalPdfDocument';
import ManagementReviewModal from './ManagementReviewModal';
import AiWritingModal from '../../components/ai/AiWritingModal';
import { getAiWritingStatus, getAiFreeTextTranslationStatus } from '../../services/aiAssistant';
import FreeTextTranslation from '../../components/ai/FreeTextTranslation';
import { Sparkles } from 'lucide-react';
import RestoreAppraisalUpdatesModal from './RestoreAppraisalUpdatesModal';
import VerifyBreachModal from './VerifyBreachModal';
import ManagementFollowUpResponseModal from './ManagementFollowUpResponseModal';
import './Appraisals.css';
import ObjectiveSetupModal from './ObjectiveSetupModal';
import { canAdjustSubmittedObjectives, isObjectiveReratingPending, objectiveDenialKey } from '../../utils/postSubmissionObjectives';
import ExplainAppraisalCard from '../../components/ai/ExplainAppraisalCard';

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};


const reviewStatusLabel = (status, t) => t(`view.reviewStatus.${status === 'follow_up' ? 'followUp' : status === 'follow_up_responded' ? 'responded' : status === 'reviewed' ? 'reviewed' : 'unreviewed'}`);

const STATUS_KEYS = { submitted: 'submitted', acknowledged: 'acknowledged', pending: 'pending', completed: 'completed', draft: 'draft', pending_acknowledgement: 'pendingAcknowledgement' };
const BREACH_KEYS = { confirmed: 'confirmed', dismissed: 'dismissed', not_required: 'notRequired', pending: 'pending', awaiting_review: 'awaitingReview' };

const RatingRing = ({ score, label, compact = false, maxScore = 5 }) => {
  const { t } = useTranslation('appraisals');
  const numericScore = safeNumber(score);
  const numericMax = Math.max(safeNumber(maxScore, 5), 0.01);
  const pct = Math.max(0, Math.min(100, (numericScore / numericMax) * 100));
  return (
    <div
      className={`apr-rating-ring ap-gradient-ring ${compact ? 'apr-rating-ring--compact' : ''}`}
      style={{ '--score-pct': `${pct}%`, ...ratingRingStyle(pct) }}
    >
      <div className="apr-rating-ring__inner">
        <strong>{numericScore ? formatScore(numericScore) : '—'}</strong>
        <span>{label || t('view.rating')}</span>
      </div>
    </div>
  );
};

const ScoreHero = ({ appraisal }) => {
  const { t } = useTranslation('appraisals');
  return (
  <section className="apr-view-score-hero">
    <RatingRing score={appraisal?.appraisal_summary} label={t('view.overallRating')} maxScore={appraisal?.rating_config?.rating_max || 5} />
    <div className="apr-view-score-hero__content">
      <span className="apr-eyebrow">{appraisal?.cycle_title} • {appraisal?.cycle_year}</span>
      <h2>{appraisal?.staff_fullname}</h2>
      <p>{appraisal?.staff_department_display || appraisal?.staff_department} • {appraisal?.staff_job_title_display || appraisal?.staff_job_title || t('view.noJobTitle')}</p>
      <span className="apr-view-statement">{appraisal?.evaluation_statement || t('view.unrated')}</span>
    </div>
  </section>
  );
};

const SectionScoreBreakdown = ({ scores = [], canSeeWeighted, maxRating = 5 }) => {
  const { t } = useTranslation('appraisals');
  return (
  <section className="apr-section-card">
    <div className="apr-section-head">
      <div>
        <span>{t('view.sectionScores')}</span>
        <h3>{t(canSeeWeighted ? 'view.weightedBreakdown' : 'view.breakdown')}</h3>
        <p>{t(canSeeWeighted ? 'view.weightedDetail' : 'view.breakdownDetail')}</p>
      </div>
    </div>
    <div className="apr-view-breakdown">
      {scores.map((score) => {
        const rawScore = canSeeWeighted ? score.weighted_score : score.section_avg;
        const numericScore = safeNumber(rawScore);
        const displayScore = formatScore(numericScore);
        const maxValue = canSeeWeighted ? Math.max(safeNumber(score.section_weight) / 100 * safeNumber(maxRating, 5), 0.01) : Math.max(safeNumber(maxRating, 5), 0.01);
        const pct = Math.min((numericScore / maxValue) * 100, 100);
        return (
          <div className="apr-view-breakdown__row" data-score={numericScore} key={score.section_id}>
            <div>
              <span>{score.section_label}</span>
              <strong>{displayScore}</strong>
            </div>
            <div className="apr-view-breakdown__track"><span style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
    </div>
  </section>
  );
};

const AppraisalView = () => {
  const { t, i18n } = useTranslation('appraisals');
  const statusLabel = (value) => STATUS_KEYS[value] ? t(`view.status.${STATUS_KEYS[value]}`) : value;
  const breachDecisionLabel = (value) => BREACH_KEYS[value] ? t(`view.breach.${BREACH_KEYS[value]}`) : String(value || '');
  const categoryLabel = (value) => t(`reviewModal.category.${value || 'general'}`, { defaultValue: String(value || 'general').replace('_', ' ') });
  const { id } = useParams();
  const location = useLocation();
  const returnTo = ['/my-appraisals', '/my-team-appraisals'].includes(location.state?.from) ? location.state.from : '/appraisals';
  const returnLabel = returnTo === '/my-team-appraisals' ? t('list.teamPageTitle') : returnTo === '/my-appraisals' ? t('mine.pageTitle') : t('list.pageTitle');
  const { user } = useAuthStore();
  const { isViewOnly } = useCompanyWritePermission();
  const { current, formLoading, saving, fetchSingleAppraisal, submitFeedback } = useAppraisalsStore();
  const [feedback, setFeedback] = useState('');
  const [writingEnabled, setWritingEnabled] = useState(false);
  const [writingOpen, setWritingOpen] = useState(false);
  const [freeTextEnabled, setFreeTextEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    getAiFreeTextTranslationStatus().then((status) => {
      if (active) setFreeTextEnabled(!!status?.enabled);
    }).catch(() => { if (active) setFreeTextEnabled(false); });
    return () => { active = false; };
  }, []);
  // The API selects source text by a server-owned field and verified record ID;
  // never send a translated or user-authored text value to the translator.
  const note = (text, field, recordId = 0) => (
    <FreeTextTranslation text={text} field={field} recordId={recordId}
      appraisalId={id} enabled={freeTextEnabled} />
  );

  useEffect(() => {
    let active = true;
    getAiWritingStatus().then((status) => { if (active) setWritingEnabled(!!status?.enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [acknowledged, setAcknowledged] = useState(false);
  const [managementReviewOpen, setManagementReviewOpen] = useState(false);
  const [followUpResponseOpen, setFollowUpResponseOpen] = useState(false);
  const [restoreUpdatesOpen, setRestoreUpdatesOpen] = useState(false);
  const [verifyBreachOpen, setVerifyBreachOpen] = useState(false);
  const [objectiveEditorSectionId, setObjectiveEditorSectionId] = useState(null);

  const isOwnAppraisal = Number(current?.staff_user_id || 0) === Number(user?.id || 0);
  const canVerifyBreach = !isViewOnly && ['admin', 'super_admin'].includes(user?.role)
    && !isOwnAppraisal
    && Number(current?.supervisor_id || 0) !== Number(user?.id || 0)
    && (Number(current?.breach_cap_active) === 1 || Number(current?.serious_breach_declared) === 1);
  const canRespond = ['staff', 'supervisor', 'admin'].includes(user?.role) && isOwnAppraisal;
  const isConductingSupervisor = ['admin', 'supervisor'].includes(user?.role)
    && Number(current?.supervisor_id || 0) === Number(user?.id || 0);
  const canEdit = Number(current?.can_manage_appraisal) === 1;
  const canUpdate = Number(current?.can_update_appraisal) === 1;
  const canAdjustObjectives = canAdjustSubmittedObjectives(current);
  const objectiveDenial = t(objectiveDenialKey(current?.reason_key));
  const objectiveSections = (current?.sections || []).filter((section) => section.section_type === 'kpi' && Number(section.section_id) > 0);
  const canSeeWeighted = ['super_admin', 'admin'].includes(user?.role);
  const canSeeStaffFeedback = canRespond || canEdit || ['super_admin', 'admin'].includes(user?.role);
  const managementReviewEnabled = Number(current?.management_review_enabled || 0) === 1;
  const canManageManagementReview = !isViewOnly && managementReviewEnabled && ['super_admin', 'admin'].includes(user?.role) && !isOwnAppraisal;
  const canSeeManagementOversight = managementReviewEnabled && ((['super_admin', 'admin'].includes(user?.role) && !isOwnAppraisal) || (isConductingSupervisor && !isOwnAppraisal));
  const openManagementFollowUp = current?.management_open_follow_up || null;
  const canRespondToManagementFollowUp = Boolean(managementReviewEnabled && isConductingSupervisor && !isOwnAppraisal && openManagementFollowUp);
  const managementFollowUpHasResponse = Boolean(openManagementFollowUp?.latest_response);
  const updateCount = safeNumber(current?.update_count);
  const attemptsLeft = Math.max(2 + safeNumber(current?.extra_update_allowance) - updateCount, 0);
  const canRestoreUpdates = !isViewOnly && ['admin', 'super_admin'].includes(user?.role)
    && !isOwnAppraisal
    && Number(current?.supervisor_id || 0) !== Number(user?.id || 0)
    && attemptsLeft === 0;

  useEffect(() => {
    document.title = t('view.documentTitle');
  }, [t]);

  useEffect(() => {
    fetchSingleAppraisal(id);
  }, [id, fetchSingleAppraisal, i18n.resolvedLanguage]);

  useEffect(() => {
    setFeedback(current?.feedback || '');
    setAcknowledged(false);
  }, [current?.feedback]);

  const handleFeedback = async (event) => {
    event.preventDefault();
    const result = await submitFeedback({ id: Number(id), feedback, acknowledged });
    if (result.success) fetchSingleAppraisal(id);
  };

  const canSubmitFeedback = acknowledged && feedback.trim().length > 0 && !saving;

  return (
    <AppraisalShell>
      <PageNav pageTitle={t('view.pageTitle')} links={[{ label: returnLabel, to: returnTo, active: true }, { label: t('view.view') }]} />

      {formLoading ? (
        <div className="apr-card apr-loading-panel"><span className="apr-row-skeleton" /><span className="apr-row-skeleton" /><span className="apr-row-skeleton" /></div>
      ) : current ? (
        <>
          <ScoreHero appraisal={current} />
          {isObjectiveReratingPending(current) && (
            <div className="apr-objective-flow-notice" role="status"><AppIcon icon={Info} /><span>{t('objectiveFlow.pendingBanner')}</span></div>
          )}

          <div className="apr-summary-grid apr-summary-grid--view">
            <div className="apr-summary-card"><span>{t('view.score')}</span><strong>{formatScore(safeNumber(current.appraisal_summary))}</strong></div>
            <div className="apr-summary-card"><span>{t('view.kpiRating')}</span><strong>{formatScore(safeNumber(current.kpi_rating))}</strong></div>
            <div className="apr-summary-card"><span>{t('view.statusTitle')}</span><strong>{statusLabel(current.status)}</strong></div>
            <div className="apr-summary-card"><span>{t('view.updated')}</span><strong>{current.updated_at ? formatDate(current.updated_at) : '—'}</strong></div>
          </div>

          {isConductingSupervisor && (
            <div className={`apr-callout ${attemptsLeft <= 0 ? 'apr-callout--danger' : 'apr-callout--warn'}`}>
              <AppIcon icon={RefreshCw} />
              <div>
                <strong>{t('view.remainingAttempts', { count: attemptsLeft })}</strong>
                <p>{t(attemptsLeft <= 0 ? 'view.closedEdits' : 'view.attemptsDetail')}</p>
              </div>
            </div>
          )}

          {Number(id) > 0 && <ExplainAppraisalCard appraisalId={Number(id)} isOwn={isOwnAppraisal} />}

          <div className="apr-view-grid">
            <section className="apr-section-card apr-current-review-card">
              <div className="apr-section-head"><div><span>{t('view.currentAppraisal')}</span><h3>{current.cycle_title} • {current.cycle_year}</h3></div></div>
              <div className="apr-current-review-card__body">
                <div className="apr-current-review-card__rating">
                  <RatingRing score={current.appraisal_summary} label={t('view.rating')} compact maxScore={current?.rating_config?.rating_max || 5} />
                  <p>{current.evaluation_statement || t('view.unrated')}</p>
                </div>
                <div className="apr-current-review-card__meta">
                  <span><AppIcon icon={UserCheck} /> {t('view.supervisor')} <strong>{current.supervisor_name || '—'}</strong></span>
                  <span><AppIcon icon={Info} /> {t('view.statusTitle')} <strong>{statusLabel(current.status)}</strong></span>
                  <span><AppIcon icon={MessageSquare} /> {t('view.feedback')} <strong>{t(current.feedback ? 'view.submitted' : 'view.notSubmitted')}</strong></span>
                </div>
              </div>
            </section>

            <SectionScoreBreakdown scores={current.section_scores || []} canSeeWeighted={canSeeWeighted} maxRating={current?.rating_config?.rating_max || 5} />
          </div>

          <section className="apr-section-card apr-breach-card" aria-label={t('view.safetyAria')}>
            <div className="apr-section-head">
              <div>
                <span>{t('view.safety')}</span>
                <h3>{t('view.breachDeclaration')}</h3>
                <p>{t('view.breachIntro')}</p>
              </div>
              <span className={`apr-breach-tag ${Number(current.serious_breach_declared) === 1 ? 'apr-breach-tag--yes' : ''}`}>
                {t(current.serious_breach_declared == null ? 'view.breach.notRecorded' : Number(current.serious_breach_declared) === 1 ? 'view.breach.declared' : 'view.breach.noBreachTag')}
              </span>
            </div>
            <div className="apr-breach-summary">
              <span>{t('view.calculatedScore')} <strong>{formatScore(safeNumber(current.raw_appraisal_summary ?? current.appraisal_summary))}</strong></span>
              <span>{t('view.finalScore')} <strong>{formatScore(safeNumber(current.appraisal_summary))}</strong></span>
              <span>{t('view.managementDecision')} <strong>{breachDecisionLabel(current.serious_breach_review_status || 'not_required')}</strong></span>
              {Number(current.breach_cap_active) === 1 && <span className="apr-breach-cap-label">{t('view.capActive')}</span>}
            </div>
            {current.serious_breach_review_note && <p className="apr-breach-hint"><strong>{t('view.managementNoteLabel')}</strong> {note(current.serious_breach_review_note, 'breach_review_note')}</p>}
            {canVerifyBreach && (
              <div className="apr-breach-action"><button type="button" className="apr-btn apr-btn--secondary" onClick={() => setVerifyBreachOpen(true)}>
                <AppIcon icon={ShieldCheck} /> {t('view.verifyBreach')}
              </button></div>
            )}
            {(current.breach_verification_history || []).length > 0 && (
              <div className="apr-breach-history">
                <strong>{t('view.verificationHistory')}</strong>
                {current.breach_verification_history.map((entry) => (
                  <p key={entry.id}><b>{breachDecisionLabel(entry.decision)}</b> — {entry.reviewer_name || t('view.management')}, {formatDateTime(entry.created_at)} ({t('view.revisionNumberLower', { number: entry.appraisal_revision_no })}): {note(entry.note, 'breach_verification_note', entry.id)} · {formatScore(safeNumber(entry.raw_score))} → {formatScore(safeNumber(entry.final_score))}</p>
                ))}
              </div>
            )}
            {Number(current.serious_breach_declared) === 1 && current.serious_breach_declared != null && (
              <div className="apr-breach-details">
                <div><span>{t('view.reason')}</span><p>{current.serious_breach_reason ? note(current.serious_breach_reason, 'breach_reason') : '—'}</p></div>
                <div><span>{t('view.supportingReference')}</span><p>{current.serious_breach_reference || '—'}</p></div>
                <p className="apr-breach-hint">{t('view.breachFootnote')}</p>
              </div>
            )}
          </section>

          {canSeeManagementOversight && current.management_review_status && (
            <section className="apr-section-card apr-management-oversight-card">
              <div className="apr-section-head">
                <div>
                  <span>{t('view.oversight')}</span>
                  <h3>{t('view.postReview')}</h3>
                  <p>{t('view.oversightDetail')}</p>
                </div>
                <span className={`apr-management-pill apr-management-pill--${current.management_review_status}`}>
                  <AppIcon icon={current.management_review_status === 'follow_up' ? TriangleAlert : current.management_review_status === 'follow_up_responded' ? MessageSquareReply : ShieldCheck} />
                  {reviewStatusLabel(current.management_review_status, t)}
                </span>
              </div>

              {current.management_review ? (
                <div className="apr-management-review-current">
                  <div>
                    <span>{t('view.category')}</span>
                    <strong>{categoryLabel(current.management_review.category)}</strong>
                  </div>
                  <div>
                    <span>{t('view.reviewedBy')}</span>
                    <strong>{current.management_review.reviewer_name || current.management_review.reviewer_email || t('view.management')}</strong>
                  </div>
                  <div>
                    <span>{t('view.revision')}</span>
                    <strong>#{current.management_review.appraisal_revision_no || current.current_revision_no || 1}</strong>
                  </div>
                  <div>
                    <span>{t('view.reviewedAt')}</span>
                    <strong>{formatDateTime(current.management_review.created_at)}</strong>
                  </div>
                  {current.management_review.note && <p><b>{t('view.managementNoteLabel')}</b> {note(current.management_review.note, 'management_note', current.management_review.id)}</p>}
                </div>
              ) : (
                <div className="apr-callout apr-callout--warn">
                  <AppIcon icon={ShieldCheck} />
                  <div>
                    <strong>{t('view.currentUnreviewed')}</strong>
                    <p>{t((current.management_review_history || []).length ? 'view.previousReviewed' : 'view.notYetReviewed')}</p>
                  </div>
                </div>
              )}

              {openManagementFollowUp && (
                <div className="apr-follow-up-thread">
                  <div className="apr-follow-up-thread__request">
                    <span>{t('view.managementFollowUp')}</span>
                    <strong>{openManagementFollowUp.note ? note(openManagementFollowUp.note, 'management_note', openManagementFollowUp.id) : t('view.requestFallback')}</strong>
                    <small>{categoryLabel(openManagementFollowUp.category)} • {t('view.revisionNumber', { number: openManagementFollowUp.appraisal_revision_no || 1 })}</small>
                  </div>
                  {(openManagementFollowUp.responses || []).map((response) => (
                    <div className="apr-follow-up-thread__response" key={response.id}>
                      <span>{t('view.supervisorResponse')}</span>
                      <p>{note(response.response, 'management_response', response.id)}</p>
                      <small>{response.responder_name || response.responder_email || t('reviewModal.supervisor')} • {t('view.revisionNumber', { number: response.appraisal_revision_no || current.current_revision_no || 1 })} • {formatDateTime(response.created_at)}</small>
                    </div>
                  ))}
                  {!managementFollowUpHasResponse && <small className="apr-follow-up-thread__pending">{t('view.awaitingResponse')}</small>}
                </div>
              )}

              {(canManageManagementReview || canRespondToManagementFollowUp) && (
                <div className="apr-management-oversight-actions">
                  {canRespondToManagementFollowUp && (
                    <button type="button" className="apr-btn apr-btn--secondary" onClick={() => setFollowUpResponseOpen(true)}>
                      <AppIcon icon={MessageSquareReply} /> {t(managementFollowUpHasResponse ? 'view.addResponse' : 'view.respondToFollowUp')}
                    </button>
                  )}
                  {canManageManagementReview && (
                    <button type="button" className="apr-btn apr-btn--primary" onClick={() => setManagementReviewOpen(true)}>
                      <AppIcon icon={ShieldCheck} /> {t(managementFollowUpHasResponse ? 'view.resolveFollowUp' : openManagementFollowUp ? 'view.viewFollowUp' : current.management_review ? 'view.updateReview' : 'view.reviewAppraisal')}
                    </button>
                  )}
                </div>
              )}

              {(current.management_review_history || []).length > 0 && (
                <div className="apr-management-history">
                  <h4>{t('view.reviewHistory')}</h4>
                  {(current.management_review_history || []).slice(0, 5).map((review) => (
                    <div className="apr-management-history__row" key={review.id}>
                      <span><AppIcon icon={review.review_status === 'follow_up' ? TriangleAlert : ShieldCheck} /></span>
                      <div>
                        <strong>{review.review_status === 'follow_up' && review.follow_up_state === 'resolved' ? t('view.resolved') : reviewStatusLabel(review.review_status === 'follow_up' && review.follow_up_state === 'responded' ? 'follow_up_responded' : review.review_status, t)} • {t('view.revisionNumber', { number: review.appraisal_revision_no })}</strong>
                        <small>{review.reviewer_name || review.reviewer_email || t('view.management')} • {formatDateTime(review.created_at)}</small>
                        {review.note && <p>{note(review.note, 'management_note', review.id)}</p>}
                        {(review.responses || []).map((response) => (
                          <div className="apr-management-history__response" key={response.id}>
                            <AppIcon icon={MessageSquareReply} />
                            <div>
                              <span>{t('view.supervisorResponseAlt')}</span>
                              <p>{note(response.response, 'management_response', response.id)}</p>
                              <small>{response.responder_name || response.responder_email || t('reviewModal.supervisor')} • {formatDateTime(response.created_at)}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {canSeeManagementOversight && (current.revision_history || []).length > 0 && (
            <section className="apr-section-card">
              <div className="apr-section-head">
                <div>
                  <span>{t('view.revisionAudit')}</span>
                  <h3>{t('view.versionHistory')}</h3>
                  <p>{t('view.versionDetail')}</p>
                </div>
                <span className="apr-response-tag"><AppIcon icon={History} /> {t('view.versionCount', { count: current.revision_history.length })}</span>
              </div>
              <div className="apr-revision-list">
                {(current.revision_history || []).map((revision, index, rows) => {
                  const older = rows[index + 1];
                  const delta = older?.appraisal_summary !== null && older?.appraisal_summary !== undefined
                    ? safeNumber(revision.appraisal_summary) - safeNumber(older.appraisal_summary)
                    : null;
                  return (
                    <div className="apr-revision-row" key={revision.id}>
                      <div className="apr-revision-row__number">#{revision.revision_no}</div>
                      <div className="apr-revision-row__copy">
                        <strong>{t(revision.action === 'updated' ? 'view.revisionUpdated' : revision.action === 'baseline' ? 'view.revisionBaseline' : 'view.revisionInitial')}</strong>
                        <small>{revision.created_by_name || revision.created_by_email || t('view.system')} • {formatDateTime(revision.created_at)}</small>
                        <span>{revision.evaluation_statement || t('view.unrated')}</span>
                        <small>{revision.serious_breach_declared == null ? t('view.breach.notRecordedShort') : Number(revision.serious_breach_declared) === 1 ? t('view.breach.declaredRevision', { reason: revision.serious_breach_reason || '—', reference: revision.serious_breach_reference || '—' }) : t('view.breach.noBreach')}</small>
                        {(revision.objective_changes || []).map((event) => (
                          <details key={event.event_id} className="apr-objective-revision-detail">
                            <summary>{t('objectiveFlow.revisionTitle')} · {formatDateTime(event.unlocked_at)}</summary>
                            <p><strong>{t('objectiveFlow.unlockReason')}</strong> {event.unlock_reason}</p>
                            <div className="apr-objective-revision-pair">
                              {[['before', event.before], ['after', event.after]].map(([kind, items]) => (
                                <div key={kind}>
                                  <strong>{t(`objectiveFlow.${kind}`)}</strong>
                                  {(items || []).map((item, idx) => (
                                    <p key={`${item.kpi_question_id || item.question_id}-${idx}`}>
                                      {item.question_text || '—'}
                                      {item.objective_target && <small>{t('objectiveFlow.target')} {item.objective_target}</small>}
                                      {item.question_weight != null && <small>{t('objectiveFlow.weight', { value: formatNumber(safeNumber(item.question_weight), { maximumFractionDigits: 2 }) })}</small>}
                                      {item.rating != null && <small>{t('objectiveFlow.rating', { value: formatNumber(safeNumber(item.rating), { maximumFractionDigits: 2 }) })}</small>}
                                    </p>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                      <div className="apr-revision-row__score">
                        <strong>{revision.appraisal_summary !== null && revision.appraisal_summary !== undefined ? formatScore(safeNumber(revision.appraisal_summary)) : '—'}</strong>
                        {delta !== null && Math.abs(delta) > 0.0001 && <small className={delta > 0 ? 'is-up' : 'is-down'}>{delta > 0 ? '+' : ''}{formatScore(Math.abs(delta))}</small>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(current.sections || []).map((section) => {
            const cumulative = section.rating_mode === 'overall' || section.rating_mode === 'historical_summary';
            const customQuestionWeights = section.section_type === 'kpi'
              && section.rating_mode === 'per_question'
              && section.question_weighting_mode === 'custom';
            const modeLabel = section.rating_mode === 'overall'
              ? t('view.mode.cumulative')
              : section.rating_mode === 'historical_summary'
                ? t('view.mode.historical')
                : section.section_type === 'kpi'
                  ? customQuestionWeights ? t('view.mode.custom') : t('view.mode.equal')
                  : t('view.mode.perQuestion');

            return (
              <section className="apr-section-card" key={section.section_id}>
                <div className="apr-section-head">
                  <div>
                    <span>{t('view.responses')}</span>
                    <h3>{section.section_code} — {section.section_label}</h3>
                    {section.is_historical_reference && (
                      <p className="apr-section-mode-note">{t('view.historicalQuestion')}</p>
                    )}
                  </div>
                  <span className="apr-response-tag">{modeLabel} • {formatScore(safeNumber(section.section_avg || section.overall_rating))}</span>
                </div>
                {section.overall_rating_comment && (
                  <p className="apr-section-mode-note"><b>{t('view.overallComment')}</b> {note(section.overall_rating_comment, 'section_comment', section.section_id)}</p>
                )}
                {(section.responses || []).length ? (
                  <div className="apr-response-list">
                    {(section.responses || []).map((response, index) => (
                      <div className="apr-response-row" key={`${section.section_id}-${response.question_id}-${index}-${response.question_text}`}>
                        <div className="apr-response-row__copy">
                          <span>{response.question_text}</span>
                          {response.objective_target && <small className="apr-response-detail"><b>{t('view.target')}</b> {response.objective_target}</small>}
                          {response.evidence_source && <small className="apr-response-detail"><b>{t('view.evidence')}</b> {response.evidence_source}</small>}
                          {response.actual_result && <small className="apr-response-detail"><b>{t('view.actualResult')}</b> {response.actual_result}</small>}
                          {response.rating_comment && <small className="apr-response-detail"><b>{t('view.ratingComment')}</b> {response.response_id && response.response_table ? note(response.rating_comment, `${response.response_table}_comment`, response.response_id) : response.rating_comment}</small>}
                          {customQuestionWeights && response.question_weight !== null && response.question_weight !== undefined && response.question_weight !== '' && (
                            <small className="apr-response-weight">{t('view.weight', { value: formatNumber(safeNumber(response.question_weight), { maximumFractionDigits: 2 }) })}</small>
                          )}
                        </div>
                        <strong>{response.rating !== null && response.rating !== undefined && response.rating !== ''
                          ? formatNumber(safeNumber(response.rating), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                          : cumulative ? t('view.sectionRated') : '—'}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="apr-section-mode-note">{t('view.noQuestionSnapshot')}</p>
                )}
              </section>
            );
          })}

          <section className="apr-section-card">
            <div className="apr-section-head"><div><span>{t('view.recommendations')}</span><h3>{t('view.supervisorNotes')}</h3></div></div>
            <div className="apr-note-grid">
              <div><span>{t('view.statusUpgrade')}</span><p>{current.status_upgrade ? note(current.status_upgrade, 'supervisor_status') : '—'}</p></div>
              <div><span>{t('view.salaryUpgrade')}</span><p>{current.salary_upgrade ? note(current.salary_upgrade, 'supervisor_salary') : '—'}</p></div>
              <div><span>{t('view.development')}</span><p>{current.development ? note(current.development, 'supervisor_development') : '—'}</p></div>
            </div>
          </section>

          {canSeeStaffFeedback && (
            <section className="apr-section-card">
              <div className="apr-section-head">
                <div>
                  <span>{t('view.staffFeedback')}</span>
                  <h3>{t(canRespond ? 'view.yourResponse' : 'view.staffResponse')}</h3>
                  <p>{t(canRespond ? 'view.acknowledgeDetail' : 'view.staffFeedbackDetail')}</p>
                </div>
              </div>
              {current.feedback ? (
                <div className="apr-feedback-done"><AppIcon icon={CircleCheck} /><p>{note(current.feedback, 'feedback')}</p></div>
              ) : canRespond ? (
                <form className="apr-feedback-form" onSubmit={handleFeedback}>
                  <label className="apr-checkline apr-checkline--boxed">
                    <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                    <span>{t('view.acknowledge')}</span>
                  </label>
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={t('view.feedbackPlaceholder')} required />
                  {writingEnabled && <button type="button" className="apr-ai-write-action" onClick={() => setWritingOpen(true)}><Sparkles size={14} /> {t('view.improveAi')}</button>}
                  <button type="submit" className="apr-btn apr-btn--primary" disabled={!canSubmitFeedback}>{t(saving ? 'view.submitting' : 'view.submitFeedback')}</button>
                </form>
              ) : (
                <div className="apr-empty apr-empty--compact"><span><AppIcon icon={MessageSquare} /></span><h3>{t('view.noFeedback')}</h3><p>{t('view.noFeedbackDetail')}</p></div>
              )}
            </section>
          )}

          <div className="apr-form-actions">
            <Link className="apr-btn apr-btn--ghost" to={isOwnAppraisal ? '/my-appraisals' : '/appraisals'}>{t('view.back')}</Link>
            <PDFDownloadLink
              key={`appraisal-pdf-${i18n.language}-${current.id || id}`}
              document={<AppraisalPdfDocument appraisal={current} role={user?.role} locale={i18n.language} />}
              fileName={`${i18n.language === 'fr' ? 'Evaluation' : 'Appraisal'}_${String(current.staff_fullname || 'Staff').replace(/\s+/g, '_')}_${current.cycle_year || ''}.pdf`}
              className="apr-btn apr-btn--ghost"
            >
              {({ loading }) => loading ? t('view.preparingPdf') : <><AppIcon icon={FileDown} /> {t('view.downloadPdf')}</>}
            </PDFDownloadLink>
            {canRestoreUpdates && (
              <button type="button" className="apr-btn apr-btn--secondary" onClick={() => setRestoreUpdatesOpen(true)}>
                <AppIcon icon={RefreshCw} /> {t('view.restoreUpdates')}
              </button>
            )}
            {isConductingSupervisor && objectiveSections.map((section) => (
              <span key={section.section_id} className="apr-objective-adjust-wrapper" title={!canAdjustObjectives ? objectiveDenial : undefined} tabIndex={!canAdjustObjectives ? 0 : undefined} aria-label={!canAdjustObjectives ? t('objectiveFlow.adjustUnavailable', { name: current.staff_fullname, reason: objectiveDenial }) : undefined}>
                <button
                  type="button"
                  className="apr-btn apr-btn--secondary"
                  disabled={!canAdjustObjectives}
                  title={canAdjustObjectives ? t('objectiveFlow.adjust') : undefined}
                  aria-label={t('objectiveFlow.adjustFor', { name: current.staff_fullname })}
                  onClick={() => setObjectiveEditorSectionId(Number(section.section_id))}
                ><AppIcon icon={Target} /> {t('objectiveFlow.adjust')}{objectiveSections.length > 1 ? ` · ${section.section_label || section.section_code}` : ''}</button>
              </span>
            ))}
            {canEdit && canUpdate && <Link className="apr-btn apr-btn--primary" to={`/appraisals/edit/${id}`} state={{ from: returnTo }}><AppIcon icon={PenLine} /> {t('view.editAppraisal')}</Link>}
          </div>
        </>
      ) : (
        <div className="apr-empty"><span><AppIcon icon={Info} /></span><h3>{t('view.notFound')}</h3><p>{t('view.notFoundDetail')}</p></div>
      )}

      {objectiveEditorSectionId && current && (
        <ObjectiveSetupModal
          staff={{ staff_user_id: Number(current.staff_user_id), staff_fullname: current.staff_fullname }}
          sectionId={objectiveEditorSectionId}
          cycle={{ id: current.cycle_id, title: current.cycle_title, year: current.cycle_year }}
          onClose={() => setObjectiveEditorSectionId(null)}
          onChanged={() => fetchSingleAppraisal(id)}
        />
      )}

      {verifyBreachOpen && current && (
        <VerifyBreachModal appraisal={current} onClose={() => setVerifyBreachOpen(false)} onSaved={() => fetchSingleAppraisal(id)} />
      )}

      {restoreUpdatesOpen && current && (
        <RestoreAppraisalUpdatesModal
          appraisal={current}
          onClose={() => setRestoreUpdatesOpen(false)}
          onSaved={() => fetchSingleAppraisal(id)}
        />
      )}

      {writingOpen && <AiWritingModal
        purpose="staff_feedback"
        currentText={feedback}
        onApply={setFeedback}
        onClose={() => setWritingOpen(false)}
      />}

      {managementReviewOpen && current && (
        <ManagementReviewModal
          appraisal={current}
          onClose={() => setManagementReviewOpen(false)}
          onSaved={() => fetchSingleAppraisal(id)}
        />
      )}

      {followUpResponseOpen && current && openManagementFollowUp && (
        <ManagementFollowUpResponseModal
          appraisal={current}
          followUp={openManagementFollowUp}
          onClose={() => setFollowUpResponseOpen(false)}
          onSaved={() => fetchSingleAppraisal(id)}
        />
      )}
    </AppraisalShell>
  );
};

export default AppraisalView;
