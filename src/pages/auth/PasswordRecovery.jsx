import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleCheck, Eye, EyeOff, KeyRound, LockKeyhole, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';
import appraisalsuiteLogoLight from '../../assets/images/appraisalsuite/logo/appraisalsuite-logo-light.png';
import appraisalsuiteLogoDark from '../../assets/images/appraisalsuite/logo/appraisalsuite-logo-dark.png';
import './Login.css';
import './PasswordRecovery.css';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PasswordRecovery = () => {
  const { t } = useTranslation('auth');
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const location = useLocation();
  const navigate = useNavigate();
  const resetting = location.pathname === '/reset-password';
  // Capture once and promptly remove the one-time secret from the address bar.
  const [token] = useState(() => resetting ? new URLSearchParams(window.location.search).get('token') || '' : '');
  useLayoutEffect(() => {
    if (resetting && window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [resetting]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [sent, setSent] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = t(resetting ? 'recovery_reset_document' : 'recovery_request_document');
  }, [t, resetting]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!resetting && (!emailPattern.test(email.trim()) || email.length > 255)) {
      setError(t('email_invalid'));
      return;
    }
    if (resetting) {
      if (!/^[a-f0-9]{64}$/.test(token)) {
        setError(t('recovery_invalid'));
        return;
      }
      if (password.length < 8 || password.length > 128) {
        setError(t('recovery_password_length'));
        return;
      }
      if (password !== confirm) {
        setError(t('confirm_mismatch'));
        return;
      }
    }
    setBusy(true);
    try {
      if (resetting) {
        await api.post('/auth/reset-forgotten-password', {
          token, new_password: password, confirm_password: confirm,
        }, { skipRetry: true, skipAuthRedirect: true, skipPortalContext: true, skipCsrf: true });
        // Reset invalidates all previous sessions: discard any stale local identity.
        useAuthStore.getState().clearSession();
        setPassword('');
        setConfirm('');
        setCompleted(true);
      } else {
        await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() }, {
          skipRetry: true, skipAuthRedirect: true, skipPortalContext: true, skipCsrf: true,
        });
        setSent(true);
      }
    } catch (err) {
      const key = err.response?.data?.message_key;
      if (key === 'auth.recoveryPasswordDifferent') setError(t('recovery_password_different'));
      else if (key === 'auth.recoveryPasswordLength') setError(t('recovery_password_length'));
      else if (key === 'auth.recoveryInvalid') setError(t('recovery_invalid'));
      else if (key === 'auth.confirm_mismatch') setError(t('confirm_mismatch'));
      else setError(t('recovery_unavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`login password-recovery theme-${theme}`}>
      <div className="login__left">
        <div className="login__left-mesh" />
        <div className="lp-circle lp-circle--1" />
        <div className="lp-circle lp-circle--2" />
        <div className="lp-circle lp-circle--3" />
        <div className="login__left-content">
          <div className="lp-brand"><img className="lp-brand__logo" src={isDark ? appraisalsuiteLogoDark : appraisalsuiteLogoLight} alt={t('logo_alt')} /></div>
          <div className="lp-headline">
            <h1 className="lp-headline__h1">{t('recovery_brand_title')}</h1>
            <p className="lp-headline__body">{t('recovery_brand_description')}</p>
          </div>
          <div className="password-recovery__assurance"><ShieldCheck aria-hidden="true" size={20}/>{t('recovery_assurance')}</div>
        </div>
      </div>
      <div className="login__right">
        <div className="login__topbar">
          <LanguageSwitcher placement="login" />
          <button type="button" className="login__theme-btn" onClick={toggleTheme} title={t(isDark ? 'light_mode' : 'dark_mode')} aria-label={t(isDark ? 'light_mode' : 'dark_mode')}>
            {isDark ? <Sun size={17}/> : <Moon size={17}/>}
          </button>
        </div>
        <div className="login__form-wrap">
          <div className="password-recovery__symbol"><KeyRound aria-hidden="true" size={23}/></div>
          <div className="rp-head">
            <h2 className="rp-head__title">{t(resetting ? 'recovery_reset_title' : 'recovery_request_title')}</h2>
            <p className="rp-head__sub">{t(resetting ? 'recovery_reset_description' : 'recovery_request_description')}</p>
          </div>
          {(sent || completed) ? (
            <div className="password-recovery__result" role="status" aria-live="polite">
              <CircleCheck size={23} aria-hidden="true" />
              <p>{t(completed ? 'recovery_completed' : 'recovery_requested')}</p>
              {!completed && <p className="password-recovery__note">{t('recovery_check_spam')}</p>}
              {completed && <button className="rp-submit" type="button" onClick={() => navigate('/login', { replace: true })}>{t('recovery_sign_in')} <ArrowRight aria-hidden="true" size={16}/></button>}
            </div>
          ) : (
            <form className="rp-form" noValidate onSubmit={submit}>
              {resetting ? (
                <>
                  <div className="rp-field">
                    <label className="rp-label" htmlFor="recovery-new-password">{t('new_password')}</label>
                    <div className="rp-input"><LockKeyhole className="rp-input__icon" size={17} aria-hidden="true" />
                      <input id="recovery-new-password" className="rp-input__el" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder={t('new_password_placeholder')} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} disabled={busy}/>
                      <button className="rp-input__eye" type="button" onClick={() => setVisible(!visible)} aria-label={t(visible ? 'hide_password' : 'show_password')}><span>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</span></button>
                    </div>
                  </div>
                  <div className="rp-field">
                    <label className="rp-label" htmlFor="recovery-confirm-password">{t('confirm_password')}</label>
                    <div className="rp-input"><LockKeyhole className="rp-input__icon" size={17} aria-hidden="true" />
                      <input id="recovery-confirm-password" className="rp-input__el" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder={t('confirm_password_placeholder')} value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} maxLength={128} disabled={busy}/>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rp-field">
                  <label className="rp-label" htmlFor="recovery-email">{t('email_address')}</label>
                  <div className="rp-input"><Mail className="rp-input__icon" size={17} aria-hidden="true" />
                    <input id="recovery-email" className="rp-input__el" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required maxLength={255} disabled={busy}/>
                  </div>
                </div>
              )}
              {error && <p className="password-recovery__error" role="alert">{error}</p>}
              {resetting && !token && <p className="password-recovery__error" role="alert">{t('recovery_invalid')}</p>}
              <button type="submit" className="rp-submit" disabled={busy || (resetting && !token)}>
                <span className="rp-submit__inner">{busy ? <span className="rp-spinner" aria-hidden="true"/> : <ArrowRight size={17} aria-hidden="true"/>} {t(busy ? 'recovery_processing' : resetting ? 'recovery_reset_button' : 'recovery_request_button')}</span>
              </button>
              <p className="password-recovery__note">{t(resetting ? 'recovery_link_expires' : 'recovery_no_account_hint')}</p>
            </form>
          )}
          <Link className="password-recovery__back" to="/login"><ArrowLeft size={16} aria-hidden="true"/> {t('recovery_back_to_login')}</Link>
        </div>
      </div>
    </main>
  );
};

export default PasswordRecovery;
