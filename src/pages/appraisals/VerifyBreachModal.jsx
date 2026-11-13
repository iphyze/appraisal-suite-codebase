import { formatScore, formatNumber } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import AppSelect from '../../components/ui/AppSelect';
import useAppraisalsStore from '../../stores/useAppraisalsStore';

const DECISIONS = [
  { value: 'confirmed', key: 'breachModal.confirm' },
  { value: 'dismissed', key: 'breachModal.dismiss' },
];

const VerifyBreachModal = ({ appraisal, onClose, onSaved }) => {
  const { t } = useTranslation('appraisals');
  const { saving, verifySeriousBreach } = useAppraisalsStore();
  const [decision, setDecision] = useState('');
  const [note, setNote] = useState('');
  const canSave = !!decision && !!note.trim() && !saving;
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    const result = await verifySeriousBreach({
      appraisal_id: Number(appraisal.id),
      expected_revision_no: Number(appraisal.current_revision_no || (Number(appraisal.update_count || 0) + 1)),
      decision,
      note: note.trim(),
    });
    if (result.success) {
      await onSaved?.();
      onClose?.();
    }
  };
  return (
    <motion.div className="apr-objective-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose?.(); }}>
      <motion.form className="apr-objective-modal apr-management-review-modal" onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="apr-objective-modal__head">
          <div>
            <span className="apr-eyebrow">{t('breachModal.eyebrow')}</span>
            <h3>{t('breachModal.title', { name: appraisal.staff_fullname })}</h3>
            <p>{t('breachModal.intro')}</p>
          </div>
          <button type="button" className="apr-objective-close" onClick={onClose} disabled={saving} aria-label="Close"><AppIcon icon={X} /></button>
        </div>
        <div className="apr-management-review-modal__body">
          <div className="apr-breach-details">
            <div><span>{t('breachModal.reasonSupplied')}</span><p>{appraisal.serious_breach_reason || t('breachModal.notProvided')}</p></div>
            <div><span>{t('breachModal.reference')}</span><p>{appraisal.serious_breach_reference || t('breachModal.notProvided')}</p></div>
            <div><span>{t('breachModal.rawScore')}</span><p>{formatScore(appraisal.raw_appraisal_summary ?? appraisal.appraisal_summary)}</p></div>
            <div><span>{t('breachModal.finalScore')}</span><p>{formatScore(appraisal.appraisal_summary)}</p></div>
          </div>
          <AppSelect label={t('breachModal.decision')} value={decision} onChange={setDecision} options={DECISIONS.map((option) => ({ value: option.value, label: t(option.key) }))}
            clearable={false} searchable={false} icon={ShieldCheck} />
          <label className="apr-management-review-note">
            <span>{t('breachModal.reason')}</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={5000} required
              placeholder={t('breachModal.placeholder')} />
            <small>{formatNumber(note.length)} / {formatNumber(5000)}</small>
          </label>
          <div className="apr-callout">
            <AppIcon icon={ShieldCheck} />
            <div><strong>{decision === 'confirmed' ? t('breachModal.capRemain') : decision === 'dismissed' ? t('breachModal.restoreScore') : t('breachModal.choose')}</strong>
              <p>{t('breachModal.audit')}</p></div>
          </div>
        </div>
        <div className="apr-objective-modal__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={onClose} disabled={saving}>{t('breachModal.cancel')}</button>
          <button type="submit" className="apr-btn apr-btn--primary" disabled={!canSave}>
            {saving ? t('breachModal.saving') : <><AppIcon icon={ShieldCheck} /> {t('breachModal.save')}</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

export default VerifyBreachModal;
