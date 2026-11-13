import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { motion } from 'framer-motion';
import AppIcon from '../../components/ui/AppIcon';

const sx = (key, options) => i18n.t(`sup_${key}`, { ns: 'users', ...options });

const fullName = (user) => `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
  || user?.fullname
  || user?.email
  || sx('supervisor');

const ResetOnboardingDialog = ({ supervisor, cycle, loading = false, onCancel, onConfirm }) => {
  useTranslation('users');
  if (!supervisor || !cycle) return null;

  return (
    <motion.div
      className="supv-modal-backdrop"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel?.();
      }}
    >
      <motion.div
        className="supv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supv-reset-onboarding-title"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="supv-modal-head">
          <div className="supv-modal-heading">
            <div className="supv-modal-icon supv-modal-icon--warning"><AppIcon icon="RefreshCw" /></div>
            <div><p className="supv-modal-eyebrow">{sx('reset_onboarding_eyebrow')}</p><h3 id="supv-reset-onboarding-title">{sx('reset_onboarding_title')}</h3></div>
          </div>
          <button type="button" className="supv-modal-close" onClick={onCancel} disabled={loading} aria-label={sx('close_reset')}><AppIcon icon="X" /></button>
        </div>
        <div className="supv-modal-body">
          <p>
            <Trans
              ns="users"
              i18nKey="sup_reset_message"
              values={{ name: fullName(supervisor), cycle: `${cycle.title} (${cycle.year})` }}
              components={{ name: <strong />, cycle: <strong /> }}
            />
          </p>
        </div>
        <div className="supv-modal-actions">
          <button type="button" className="supv-btn supv-btn--ghost" onClick={onCancel} disabled={loading}>{sx('cancel')}</button>
          <button type="button" className="supv-btn supv-btn--warning" onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="supv-spinner" /> {sx('resetting')}</> : <><AppIcon icon="RefreshCw" /> {sx('reset_onboarding')}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ResetOnboardingDialog;
