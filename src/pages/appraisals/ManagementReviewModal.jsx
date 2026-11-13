import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CircleCheck, MessageSquareReply, MessageSquareWarning, ShieldCheck, X } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import AppSelect from '../../components/ui/AppSelect';
import useAppraisalsStore from '../../stores/useAppraisalsStore';

const REVIEW_OPTIONS = [
  { value: 'reviewed', labelKey: 'reviewModal.reviewed', descriptionKey: 'reviewModal.reviewedDetail' },
  { value: 'follow_up', labelKey: 'reviewModal.followUp', descriptionKey: 'reviewModal.followUpDetail' },
];

const CATEGORY_OPTIONS = [
  { value: 'general', key: 'general' },
  { value: 'score', key: 'score' },
  { value: 'documentation', key: 'documentation' },
  { value: 'hse', key: 'hse' },
  { value: 'integrity', key: 'integrity' },
  { value: 'development', key: 'development' },
  { value: 'other', key: 'other' },
];

const ManagementReviewModal = ({ appraisal, onClose, onSaved }) => {
  const { t } = useTranslation('appraisals');
  const { saving, saveManagementReview } = useAppraisalsStore();
  const reviewOptions = REVIEW_OPTIONS.map((item) => ({ value: item.value, label: t(item.labelKey), description: t(item.descriptionKey) }));
  const categoryOptions = CATEGORY_OPTIONS.map((item) => ({ value: item.value, label: t(`reviewModal.category.${item.key}`) }));
  const categoryLabel = (value) => t(`reviewModal.category.${value}`, { defaultValue: String(value || 'general').replace('_', ' ') });
  const openFollowUp = appraisal?.management_open_follow_up || null;
  const latestResponse = openFollowUp?.latest_response || null;
  const resolvingFollowUp = Boolean(openFollowUp && latestResponse);
  const waitingForResponse = Boolean(openFollowUp && !latestResponse);

  const [reviewStatus, setReviewStatus] = useState(resolvingFollowUp ? 'reviewed' : (appraisal?.management_review_status === 'follow_up' ? 'follow_up' : 'reviewed'));
  const [category, setCategory] = useState(openFollowUp?.category || appraisal?.management_review?.category || 'general');
  const [note, setNote] = useState('');

  useEffect(() => {
    setReviewStatus(resolvingFollowUp ? 'reviewed' : (appraisal?.management_review_status === 'follow_up' ? 'follow_up' : 'reviewed'));
    setCategory(openFollowUp?.category || appraisal?.management_review?.category || 'general');
    setNote('');
  }, [appraisal?.id, appraisal?.management_review_status, appraisal?.management_review?.category, openFollowUp?.id, latestResponse?.id, resolvingFollowUp]);

  const requiresNote = reviewStatus === 'follow_up';
  const canSubmit = !saving && (!requiresNote || note.trim().length > 0);
  const statusIcon = useMemo(() => reviewStatus === 'follow_up' ? MessageSquareWarning : CircleCheck, [reviewStatus]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const result = await saveManagementReview({
      appraisal_id: Number(appraisal?.id),
      review_status: resolvingFollowUp ? 'reviewed' : reviewStatus,
      category,
      note: note.trim(),
      resolve_follow_up_id: resolvingFollowUp ? Number(openFollowUp?.id) : 0,
    });

    if (result.success) {
      await onSaved?.();
      onClose?.();
    }
  };

  return (
    <motion.div
      className="apr-objective-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <motion.form
        className="apr-objective-modal apr-management-review-modal"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        onSubmit={handleSubmit}
      >
        <div className="apr-objective-modal__head">
          <div>
            <span className="apr-eyebrow">{t('reviewModal.eyebrow')}</span>
            <h3>{resolvingFollowUp ? t('reviewModal.resolveTitle', { name: appraisal?.staff_fullname || t('reviewModal.staffFallback') }) : waitingForResponse ? t('reviewModal.pendingTitle', { name: appraisal?.staff_fullname || t('reviewModal.staffFallback') }) : t('reviewModal.reviewTitle', { name: appraisal?.staff_fullname || t('reviewModal.staffFallback') })}</h3>
            <p>{resolvingFollowUp ? t('reviewModal.resolveDetail') : waitingForResponse ? t('reviewModal.pendingDetail') : t('reviewModal.reviewDetail')}</p>
          </div>
          <button type="button" className="apr-objective-close" onClick={onClose} disabled={saving} aria-label={t('reviewModal.close')}>
            <AppIcon icon={X} />
          </button>
        </div>

        <div className="apr-management-review-modal__body">
          {resolvingFollowUp ? (
            <>
              <div className="apr-follow-up-resolution-grid">
                <div className="apr-follow-up-question-card">
                  <div className="apr-follow-up-question-card__icon"><AppIcon icon={MessageSquareWarning} /></div>
                  <div>
                    <span>{t('reviewModal.managementRequest')}</span>
                    <strong>{openFollowUp?.note}</strong>
                    <small>{categoryLabel(openFollowUp?.category || 'general')} • {t('reviewModal.revision', { number: openFollowUp?.appraisal_revision_no || 1 })}</small>
                  </div>
                </div>
                <div className="apr-follow-up-response-card">
                  <div className="apr-follow-up-response-card__icon"><AppIcon icon={MessageSquareReply} /></div>
                  <div>
                    <span>{t('reviewModal.supervisorResponse')}</span>
                    <strong>{latestResponse?.response}</strong>
                    <small>{latestResponse?.responder_name || latestResponse?.responder_email || t('reviewModal.supervisor')} • {t('reviewModal.revision', { number: latestResponse?.appraisal_revision_no || appraisal?.current_revision_no || 1 })}</small>
                  </div>
                </div>
              </div>

              <div className="apr-callout">
                <AppIcon icon={CircleCheck} />
                <div>
                  <strong>{t('reviewModal.resolvedCallout')}</strong>
                  <p>{t('reviewModal.resolvedDetail')}</p>
                </div>
              </div>
            </>
          ) : waitingForResponse ? (
            <>
              <div className="apr-follow-up-question-card">
                <div className="apr-follow-up-question-card__icon"><AppIcon icon={MessageSquareWarning} /></div>
                <div>
                  <span>{t('reviewModal.managementRequest')}</span>
                  <strong>{openFollowUp?.note}</strong>
                  <small>{categoryLabel(openFollowUp?.category || 'general')} • {t('reviewModal.revision', { number: openFollowUp?.appraisal_revision_no || 1 })}</small>
                </div>
              </div>
              <div className="apr-callout apr-callout--warn">
                <AppIcon icon={MessageSquareWarning} />
                <div>
                  <strong>{t('reviewModal.waitingResponse')}</strong>
                  <p>{t('reviewModal.waitingDetail')}</p>
                </div>
              </div>
            </>
          ) : (
            <div className={`apr-callout ${reviewStatus === 'follow_up' ? 'apr-callout--warn' : ''}`}>
              <AppIcon icon={statusIcon} />
              <div>
                <strong>{reviewStatus === 'follow_up' ? t('reviewModal.requestFollowUp') : t('reviewModal.markReviewed')}</strong>
                <p>{t('reviewModal.revisionDetail', { number: appraisal?.current_revision_no || 1 })}</p>
              </div>
            </div>
          )}

          {!resolvingFollowUp && !waitingForResponse && (
            <div className="apr-management-review-modal__grid">
              <AppSelect
                label={t('reviewModal.reviewStatus')}
                value={reviewStatus}
                onChange={setReviewStatus}
                options={reviewOptions}
                searchable={false}
                clearable={false}
                icon={ShieldCheck}
              />
              <AppSelect
                label={t('reviewModal.categoryLabel')}
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                searchable={false}
                clearable={false}
                icon={MessageSquareWarning}
              />
            </div>
          )}

          {!waitingForResponse && (
          <label className="apr-management-review-note">
            <span>{resolvingFollowUp ? t('reviewModal.closingNote') : t(requiresNote ? 'reviewModal.noteRequired' : 'reviewModal.noteOptional')}</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={resolvingFollowUp ? t('reviewModal.closingPlaceholder') : t(requiresNote ? 'reviewModal.requiredPlaceholder' : 'reviewModal.optionalPlaceholder')}
              rows={5}
              maxLength={5000}
              required={!resolvingFollowUp && requiresNote}
            />
            <small>{formatNumber(note.length)} / {formatNumber(5000)}</small>
          </label>
          )}
        </div>

        <div className="apr-objective-modal__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={onClose} disabled={saving}>{t('reviewModal.cancel')}</button>
          {!waitingForResponse && (
            <button type="submit" className="apr-btn apr-btn--primary" disabled={!canSubmit}>
              {saving
                ? <><span className="apr-spinner" /> {t('reviewModal.saving')}</>
                : resolvingFollowUp
                  ? <><AppIcon icon={CircleCheck} /> {t('reviewModal.resolveButton')}</>
                  : <><AppIcon icon={ShieldCheck} /> {t('reviewModal.saveReview')}</>}
            </button>
          )}
        </div>
      </motion.form>
    </motion.div>
  );
};

export default ManagementReviewModal;
