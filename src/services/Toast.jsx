import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { Bell, CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import AppIcon from '../components/ui/AppIcon';
import useToastStore from '../stores/useToastStore';
import './Toast.css';

const TOAST_DURATION = 5200;
const CLOSE_ANIMATION = 280;

const CONFIGS = {
  success: { icon: CircleCheck, label: 'Success' },
  error: { icon: CircleAlert, label: 'Unable to continue' },
  warning: { icon: CircleAlert, label: 'Attention required' },
  info: { icon: Info, label: 'Information' },
  notification: { icon: Bell, label: 'Notification' },
};

const ToastItem = ({ toast, onClose }) => {
  const { t } = useTranslation('common');
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const type = CONFIGS[toast.type] ? toast.type : 'info';
  const config = CONFIGS[type];

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => onClose(toast.id), CLOSE_ANIMATION);
  };

  useEffect(() => {
    timerRef.current = window.setTimeout(close, toast.duration || TOAST_DURATION);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <article
      className={`sb-toast sb-toast--${type} ${closing ? 'sb-toast--out' : 'sb-toast--in'}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="sb-toast__accent" />
      <span className="sb-toast__icon"><AppIcon icon={config.icon} size={20} /></span>
      <span className="sb-toast__body">
        <strong className="sb-toast__label">{t(config.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'))}</strong>
        <span className="sb-toast__message">{toast.message}</span>
      </span>
      <button type="button" className="sb-toast__close" onClick={close} aria-label={t('dismiss_message')}>
        <AppIcon icon={X} size={17} />
      </button>
      <span className="sb-toast__progress" style={{ animationDuration: `${toast.duration || TOAST_DURATION}ms` }} />
    </article>
  );
};

const Toast = () => {
  const { t } = useTranslation('common');
  const { toasts, hideToast } = useToastStore();

  return (
    <section className="sb-toast-container" aria-label={t('system_messages')}>
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onClose={hideToast} />)}
    </section>
  );
};

export default Toast;
