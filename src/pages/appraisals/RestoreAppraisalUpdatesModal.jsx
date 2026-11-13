import { formatNumber } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import useAppraisalsStore from '../../stores/useAppraisalsStore';
import './Appraisals.css';

/** Management exception: grant two new edits without rewriting past revisions. */
const RestoreAppraisalUpdatesModal = ({ appraisal, onClose, onSaved }) => {
  const { t } = useTranslation('appraisals');
  const [reason, setReason] = useState('');
  const { saving, restoreAppraisalUpdates } = useAppraisalsStore();
  const canSubmit = reason.trim().length >= 10 && reason.trim().length <= 1000 && !saving;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const result = await restoreAppraisalUpdates({ appraisal_id: Number(appraisal?.id), reason: reason.trim() });
    if (result.success) {
      await onSaved?.();
      onClose?.();
    }
  };

  return (
    <div className="apr-objective-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose?.();
    }}>
      <form className="apr-objective-modal apr-management-review-modal" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="restore-updates-title">
        <div className="apr-objective-modal__head">
          <div>
            <span className="apr-eyebrow">{t('restoreModal.eyebrow')}</span>
            <h3 id="restore-updates-title">{t('restoreModal.title')}</h3>
            <p>{t('restoreModal.intro', { name: appraisal?.staff_fullname || t('restoreModal.appraisal') })}</p>
          </div>
          <button type="button" className="apr-objective-close" onClick={onClose} disabled={saving} aria-label={t('reviewModal.close')}>
            <AppIcon icon={X} />
          </button>
        </div>
        <div className="apr-management-review-modal__body apr-reset-updates-modal__body">
          <div className="apr-callout apr-callout--warn">
            <AppIcon icon={RefreshCw} />
            <div>
              <strong>{t('restoreModal.history')}</strong>
              <p>{t('restoreModal.info')}</p>
            </div>
          </div>
          <label className="apr-management-review-note" htmlFor="apr-reset-updates-reason">
            <span>{t('restoreModal.reason')}</span>
            <textarea
              id="apr-reset-updates-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t('restoreModal.placeholder')}
              required
            />
            <small>{formatNumber(reason.trim().length)} / {formatNumber(1000)} {t('restoreModal.characters')}</small>
          </label>
        </div>
        <div className="apr-objective-modal__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={onClose} disabled={saving}>{t('restoreModal.cancel')}</button>
          <button type="submit" className="apr-btn apr-btn--primary" disabled={!canSubmit}>
            <AppIcon icon={RefreshCw} /> {saving ? t('restoreModal.saving') : t('restoreModal.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RestoreAppraisalUpdatesModal;
