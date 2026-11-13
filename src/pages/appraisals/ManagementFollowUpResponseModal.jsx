import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareReply, TriangleAlert, X } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import useAppraisalsStore from '../../stores/useAppraisalsStore';

const ManagementFollowUpResponseModal = ({ appraisal, followUp, onClose, onSaved }) => {
  const { t } = useTranslation('appraisals');
  const { saving, respondManagementFollowUp } = useAppraisalsStore();
  const latestResponse = followUp?.latest_response || null;
  const [response, setResponse] = useState(latestResponse?.response || '');

  useEffect(() => {
    setResponse(latestResponse?.response || '');
  }, [followUp?.id, latestResponse?.id]);

  const canSubmit = !saving && response.trim().length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const result = await respondManagementFollowUp({
      appraisal_id: Number(appraisal?.id),
      management_review_id: Number(followUp?.id),
      response: response.trim(),
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
        className="apr-objective-modal apr-management-review-modal apr-follow-up-response-modal"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        onSubmit={handleSubmit}
      >
        <div className="apr-objective-modal__head">
          <div>
            <span className="apr-eyebrow">{t('followUpModal.eyebrow')}</span>
            <h3>{t('followUpModal.title')}</h3>
            <p>{t('followUpModal.intro')}</p>
          </div>
          <button type="button" className="apr-objective-close" onClick={onClose} disabled={saving} aria-label={t('reviewModal.close')}>
            <AppIcon icon={X} />
          </button>
        </div>

        <div className="apr-management-review-modal__body">
          <div className="apr-follow-up-question-card">
            <div className="apr-follow-up-question-card__icon"><AppIcon icon={TriangleAlert} /></div>
            <div>
              <span>{t('followUpModal.request')}</span>
              <strong>{followUp?.note || t('followUpModal.requestFallback')}</strong>
              <small>
                {t(`reviewModal.category.${followUp?.category || 'general'}`, { defaultValue: String(followUp?.category || 'general').replace('_', ' ') })} • {t('followUpModal.revision', { number: followUp?.appraisal_revision_no || 1 })}
              </small>
            </div>
          </div>

          <div className="apr-callout apr-callout--soft">
            <AppIcon icon={MessageSquareReply} />
            <div>
              <strong>{t('followUpModal.callout')}</strong>
              <p>{t('followUpModal.calloutDetail')}</p>
            </div>
          </div>

          <label className="apr-management-review-note">
            <span>{t('followUpModal.responseLabel')}</span>
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder={t('followUpModal.responsePlaceholder')}
              rows={6}
              maxLength={5000}
              required
            />
            <small>{formatNumber(response.length)} / {formatNumber(5000)}</small>
          </label>
        </div>

        <div className="apr-objective-modal__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={onClose} disabled={saving}>{t('followUpModal.cancel')}</button>
          <button type="submit" className="apr-btn apr-btn--primary" disabled={!canSubmit}>
            {saving ? <><span className="apr-spinner" /> {t('followUpModal.sending')}</> : <><AppIcon icon={MessageSquareReply} /> {t('followUpModal.send')}</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

export default ManagementFollowUpResponseModal;
