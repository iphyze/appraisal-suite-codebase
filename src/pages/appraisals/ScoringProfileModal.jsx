import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, UserRoundCheck, Users, X } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import AppSelect from '../../components/ui/AppSelect';
import useToastStore from '../../stores/useToastStore';
import api from '../../services/api';

const ScoringProfileModal = ({
  staff,
  staffList = [],
  cycle,
  profiles = [],
  required = false,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation('appraisals');
  const { showToast } = useToastStore();
  const [profileId, setProfileId] = useState('');
  const [saving, setSaving] = useState(false);

  const bulkStaff = useMemo(
    () => (Array.isArray(staffList) ? staffList.filter(Boolean) : []),
    [staffList]
  );
  const isBulk = bulkStaff.length > 0;

  useEffect(() => {
    setProfileId(isBulk ? '' : (staff?.scoring_profile_id ? String(staff.scoring_profile_id) : ''));
  }, [staff, isBulk]);

  const options = useMemo(() => profiles.map((profile) => ({
    value: String(profile.id),
    label: profile.label,
    description: profile.description || profile.code,
  })), [profiles]);

  const save = async () => {
    if (!profileId) {
      showToast(t('scoringModal.required'), 'warning');
      return;
    }

    setSaving(true);
    try {
      const response = isBulk
        ? await api.post('/appraisals/staff-profile/bulk', {
            cycle_id: Number(cycle?.id),
            profile_id: Number(profileId),
            staff_user_ids: bulkStaff.map((item) => Number(item.staff_user_id)).filter((id) => id > 0),
          })
        : await api.post('/appraisals/staff-profile', {
            cycle_id: Number(cycle?.id),
            staff_user_id: Number(staff?.staff_user_id),
            profile_id: Number(profileId),
          });

      showToast(
        response.data?.message || t(isBulk ? 'scoringModal.bulkSuccess' : 'scoringModal.saveSuccess'),
        'success'
      );
      await onChanged?.(response.data?.data);
      onClose();
    } catch (error) {
      showToast(error.response?.data?.message || t('scoringModal.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const staffName = staff?.fullname || `${staff?.first_name || ''} ${staff?.last_name || ''}`.trim();

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
      <motion.div
        className="apr-objective-modal apr-profile-modal"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.97 }}
      >
        <div className="apr-objective-modal__head">
          <div>
            <span className="apr-eyebrow">{t(isBulk ? 'scoringModal.bulkEyebrow' : 'scoringModal.eyebrow')}</span>
            <h3>{isBulk ? t('scoringModal.selected', { count: bulkStaff.length }) : staffName}</h3>
            <p>{cycle?.title} ({cycle?.year}) • {t('scoringModal.description')}</p>
          </div>
          <button type="button" className="apr-objective-close" onClick={onClose} disabled={saving} aria-label={t('reviewModal.close')}><AppIcon icon={X} /></button>
        </div>

        <div className="apr-objective-modal__body apr-profile-modal__body">
          <div className="apr-callout apr-callout--info">
            <AppIcon icon={isBulk ? Users : UserRoundCheck} />
            <div>
              <strong>{t(isBulk ? 'scoringModal.bulkCallout' : 'scoringModal.singleCallout')}</strong>
              <p>
                {t(isBulk ? 'scoringModal.bulkDetail' : 'scoringModal.singleDetail')}
              </p>
            </div>
          </div>

          {isBulk && (
            <div className="apr-profile-selection-summary">
              {bulkStaff.slice(0, 6).map((item) => (
                <span key={item.staff_user_id}>{item.staff_fullname || item.fullname || `${item.first_name || ''} ${item.last_name || ''}`.trim()}</span>
              ))}
              {bulkStaff.length > 6 && <span>+{bulkStaff.length - 6} {t('scoringModal.more')}</span>}
            </div>
          )}

          <AppSelect
            label={`${t('scoringModal.level')}${required || isBulk ? ' *' : ''}`}
            value={profileId}
            onChange={(value) => setProfileId(value ? String(value) : '')}
            options={options}
            searchable={false}
            clearable={false}
            placeholder={t('scoringModal.placeholder')}
            icon={UserRoundCheck}
          />
        </div>

        <div className="apr-objective-modal__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={onClose} disabled={saving}>{t('scoringModal.cancel')}</button>
          <button type="button" className="apr-btn apr-btn--primary" disabled={saving || !profileId} onClick={save}>
            {saving
              ? <><span className="apr-spinner" /> {t('scoringModal.saving')}</>
              : <><AppIcon icon={Save} /> {isBulk ? t('scoringModal.bulkSave', { count: bulkStaff.length }) : t('scoringModal.save')}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ScoringProfileModal;
