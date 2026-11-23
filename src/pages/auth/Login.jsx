import { useTranslation } from 'react-i18next';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  Circle,
  CircleCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Moon,
  ShieldCheck,
  Star,
  Sun,
  Users,
  X,
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useThemeStore from '../../stores/useThemeStore';
import useToastStore from '../../stores/useToastStore';
import { safeReturnPath } from '../../utils/safeReturnPath';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import appraisalsuiteLogoLight from '../../assets/images/appraisalsuite/logo/appraisalsuite-logo-light.png';
import appraisalsuiteLogoDark from '../../assets/images/appraisalsuite/logo/appraisalsuite-logo-dark.png';
import './Login.css';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';
import { preferredLoginWorkspaceId } from '../../utils/loginWorkspaces';

const Feature = ({ icon: Icon, title, desc, delay }) => (
  <motion.div
    className="lp-feature"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay, ease: 'easeOut' }}
  >
    <div className="lp-feature__icon"><Icon size={16} /></div>
    <div>
      <p className="lp-feature__title">{title}</p>
      <p className="lp-feature__desc">{desc}</p>
    </div>
  </motion.div>
);

const WorkspaceModal = ({ companies, value, onSelect, onClose, onContinue, loading }) => {
  const { t } = useTranslation('auth');
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const loadingRef = useRef(loading);
  useEffect(() => {
    onCloseRef.current = onClose;
    loadingRef.current = loading;
  }, [loading, onClose]);
  useEffect(() => {
    const before = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll('button:not(:disabled)') || []);
    const chosen = dialog?.querySelector('[role="radio"][aria-checked="true"]');
    (chosen || focusable()[0])?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loadingRef.current) {
        event.preventDefault();
        onCloseRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const buttons = focusable();
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (before && typeof before.focus === 'function') before.focus();
    };
  }, []);
  return (
  <motion.div
    className="login-workspace-backdrop"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose?.();
    }}
  >
    <motion.section
      className="login-workspace-modal"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-title"
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="login-workspace-modal__head">
        <div className="login-workspace-modal__title">
          <div className="login-workspace-modal__icon"><Building2 size={23} /></div>
          <div>
            <p className="login-workspace-modal__eyebrow">{t('workspace_selection')}</p>
            <h2 id="workspace-title">{t('select_organisation')}</h2>
            <p className="login-workspace-modal__copy">{t('workspace_help')}</p>
          </div>
        </div>
        <button type="button" className="login-workspace-modal__close" onClick={onClose} disabled={loading} aria-label={t('close_workspace_selection')}><X size={17} /></button>
      </div>

      <div className="login-workspace-modal__body">
        <div className="login-workspace-list" role="radiogroup" aria-label={t('organisation_workspaces')}>
          {companies.map((company) => {
            const selected = String(value) === String(company.id);
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={`login-workspace-option ${selected ? 'login-workspace-option--active' : ''}`}
                key={company.id}
                onClick={() => onSelect(company.id)}
                disabled={loading}
              >
                <span className="login-workspace-option__badge">{company.code || 'ORG'}</span>
                <span className="login-workspace-option__name">{company.name}</span>
                {selected ? <CircleCheck size={17} /> : <Circle size={17} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="login-workspace-actions">
        <button type="button" className="login-workspace-actions__cancel" onClick={onClose} disabled={loading}>{t('cancel')}</button>
        <button type="button" className="login-workspace-actions__continue" onClick={onContinue} disabled={!value || loading}>
          {loading ? <><span className="rp-spinner" /> {t('signing_in')}</> : <>{t('continue')} <ArrowRight size={16} /></>}
        </button>
      </div>
    </motion.section>
  </motion.div>
);
};

const Login = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { showToast } = useToastStore();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    document.title = t('document_sign_in');
  }, [t]);

  const validate = useCallback(() => {
    const formErrors = {};

    if (!email.trim()) {
      formErrors.email = t('email_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formErrors.email = t('email_invalid');
    }

    if (!password) {
      formErrors.password = t('password_required');
    } else if (password.length < 6) {
      formErrors.password = t('password_min6');
    }

    return formErrors;
  }, [email, password, t]);

  const errors = submitted ? validate() : {};

  const signInSucceeded = () => {
    setWorkspaceOptions([]);
    setSelectedWorkspaceId(null);
    showToast(t('welcome_toast'), 'success');
    // Return to where the user was (e.g. an appraisal in progress) after a session expiry.
    navigate(safeReturnPath(location.state?.from), { replace: true });
  };

  const runLogin = async (companyId = null) => {
    setIsLoading(true);
    const result = await login(email.trim().toLowerCase(), password, companyId);
    setIsLoading(false);

    if (result.success) {
      signInSucceeded();
      return;
    }

    if (result.requiresCompanySelection) {
      setWorkspaceOptions(result.companies || []);
      setSelectedWorkspaceId(preferredLoginWorkspaceId(
        result.companies || [], result.preferredCompanyId
      ));
      return;
    }

    showToast(result.error || t('signin_failed'), 'error');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    if (Object.keys(validate()).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, t('signin_validation'));
      return;
    }

    await runLogin();
  };

  const handleWorkspaceContinue = async () => {
    if (!selectedWorkspaceId) {
      showToast(t('choose_organisation'), 'error');
      return;
    }

    await runLogin(selectedWorkspaceId);
  };

  const closeWorkspaceModal = () => {
    if (isLoading) return;
    setWorkspaceOptions([]);
    setSelectedWorkspaceId(null);
  };

  return (
    <div className={`login theme-${theme}`}>
      <div className="login__left">
        <div className="login__left-mesh" />
        <div className="lp-circle lp-circle--1" />
        <div className="lp-circle lp-circle--2" />
        <div className="lp-circle lp-circle--3" />

        <div className="login__left-content">
          <motion.div
            className="lp-brand"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img
              className="lp-brand__logo"
              src={isDark ? appraisalsuiteLogoDark : appraisalsuiteLogoLight}
              alt={t('logo_alt')}
            />
          </motion.div>

          <motion.div
            className="lp-headline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="lp-headline__h1">
              {t('headline_first')}<br />
              <span className="lp-headline__accent">{t('headline_second')}</span><br />
              {t('headline_third')}
            </h1>
            <p className="lp-headline__body">
              {t('headline_body')}
            </p>
          </motion.div>

          <div className="lp-features">
            <Feature icon={Star} title={t('feature_kpi')} desc={t('feature_kpi_desc')} delay={0.2} />
            <Feature icon={Users} title={t('feature_supervisor')} desc={t('feature_supervisor_desc')} delay={0.3} />
            <Feature icon={BarChart3} title={t('feature_analytics')} desc={t('feature_analytics_desc')} delay={0.4} />
            <Feature icon={Mail} title={t('feature_notifications')} desc={t('feature_notifications_desc')} delay={0.5} />
          </div>
        </div>
      </div>

      <div className="login__right">
        <div className="login__topbar">
          <LanguageSwitcher placement="login" hint={t('login_language_hint')} />
          <motion.button
          type="button"
          className="login__theme-btn"
          onClick={toggleTheme}
          title={isDark ? t('light_mode') : t('dark_mode')}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={theme}
              initial={{ rotate: -80, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 80, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        </div>

        <motion.div
          className="login__form-wrap"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rp-head">
            <h2 className="rp-head__title">{t('welcome_back')}</h2>
            <p className="rp-head__sub">{t('signin_description')}</p>
          </div>

          <form ref={formRef} className="rp-form" onSubmit={handleSubmit} autoComplete="on" noValidate>
            <div className="rp-field" data-invalid={errors.email ? 'true' : undefined}>
              <label className={`rp-label ${errors.email ? 'rp-label--err' : ''}`}>
                {t('email_address')}
              </label>
              <div className={`rp-input ${errors.email ? 'rp-input--err' : ''}`}>
                <Mail className="rp-input__icon" size={16} />
                <input
                  type="email"
                  name="username"
                  className="rp-input__el"
                  placeholder="you@lambertelectromec.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  spellCheck={false}
                  disabled={isLoading}
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    className="rp-err"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <AlertCircle size={12} /> {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="rp-field" data-invalid={errors.password ? 'true' : undefined}>
              <label className={`rp-label ${errors.password ? 'rp-label--err' : ''}`}>
                {t('password')}
              </label>
              <div className={`rp-input ${errors.password ? 'rp-input--err' : ''}`}>
                <LockKeyhole className="rp-input__icon" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="rp-input__el"
                  placeholder={t('enter_password')}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="rp-input__eye"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t('hide_password') : t('show_password')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    className="rp-err"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <AlertCircle size={12} /> {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Link to="/forgot-password" className="login-forgot-password">{t('forgot_password')}</Link>

            <motion.button
              type="submit"
              className="rp-submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.012 }}
              whileTap={{ scale: isLoading ? 1 : 0.988 }}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.span key="load" className="rp-submit__inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <span className="rp-spinner" /> {t('authenticating')}
                  </motion.span>
                ) : (
                  <motion.span key="idle" className="rp-submit__inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {t('sign_in')} <ArrowRight size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <div className="rp-security">
            <div className="rp-security__divider">
              <span>{t('encryption')}</span>
            </div>
            <div className="rp-security__badges">
              <span className="rp-security__badge"><ShieldCheck size={12} /> {t('ssl_protected')}</span>
              <span className="rp-security__badge"><LockKeyhole size={12} /> {t('secure_session')}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {workspaceOptions.length > 0 && (
          <WorkspaceModal
            companies={workspaceOptions}
            value={selectedWorkspaceId}
            onSelect={setSelectedWorkspaceId}
            onClose={closeWorkspaceModal}
            onContinue={handleWorkspaceContinue}
            loading={isLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
