import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share2, X } from 'lucide-react';
import AppIcon from '../ui/AppIcon';
import appMark from '../../assets/images/appraisalsuite/logo/appraisalsuite-mark-128px.png';
import './InstallAppPrompt.css';

const DISMISS_KEY = 'appraisalsuite.pwa.install-dismissed-at';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

const isStandalone = () => (
  window.matchMedia?.('(display-mode: standalone)')?.matches
  || window.navigator.standalone === true
);

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');

const wasRecentlyDismissed = () => {
  const value = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
  return value > 0 && Date.now() - value < DISMISS_FOR_MS;
};

const InstallAppPrompt = () => {
  const { t } = useTranslation('common');
  const enabled = import.meta.env.PROD;
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const ios = useMemo(() => typeof window !== 'undefined' && isIos(), []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || isStandalone()) return undefined;

    let revealTimer = null;

    const reveal = () => {
      if (wasRecentlyDismissed()) return;
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => setVisible(true), 3200);
    };

    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      reveal();
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    if (ios && !wasRecentlyDismissed()) reveal();

    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [enabled, ios]);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome === 'accepted') {
        setVisible(false);
      } else {
        dismiss();
      }
    } finally {
      setInstallEvent(null);
    }
  };

  if (!enabled || installed || (!installEvent && !ios)) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          className="pwa-install-card"
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          aria-label={t('pwa_install_title')}
        >
          <button type="button" className="pwa-install-card__close" onClick={dismiss} aria-label={t('pwa_dismiss_prompt')}>
            <AppIcon icon={X} size={15} />
          </button>

          <div className="pwa-install-card__mark">
            <img src={appMark} alt="" />
          </div>

          <div className="pwa-install-card__copy">
            <span>APPRAISALSUITE</span>
            <strong>{t('pwa_heading')}</strong>
            <p>
              {ios
                ? t('pwa_ios_description')
                : t('pwa_device_description')}
            </p>
          </div>

          {ios ? (
            <div className="pwa-install-card__ios">
              <AppIcon icon={Share2} size={17} />
              <span><Trans ns="common" i18nKey="pwa_ios_instruction" components={{ strong: <strong /> }} /></span>
            </div>
          ) : (
            <button type="button" className="pwa-install-card__install" onClick={install}>
              <AppIcon icon={Download} size={16} />
              {t('pwa_install_button')}
            </button>
          )}

          <button type="button" className="pwa-install-card__later" onClick={dismiss}>{t('pwa_not_now')}</button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default InstallAppPrompt;
