import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
  Star,
  Sun,
  Users,
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useThemeStore from '../../stores/useThemeStore';
import useToastStore from '../../stores/useToastStore';
import api from '../../services/api';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import appraisalsuiteLogoLight from '../../assets/images/appraisalsuite/logo/appraisalsuite-logo-light.png';
import appraisalsuiteLogoDark from '../../assets/images/appraisalsuite/logo/appraisalsuite-logo-dark.png';
import './ChangePassword.css';
import LanguageSwitcher from '../../components/ui/LanguageSwitcher';

const Feature = ({ icon: Icon, title, desc, delay }) => (
  <motion.div
    className="cp-feature"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay, ease: 'easeOut' }}
  >
    <div className="cp-feature__icon"><Icon size={16} /></div>
    <div>
      <p className="cp-feature__title">{title}</p>
      <p className="cp-feature__desc">{desc}</p>
    </div>
  </motion.div>
);

const PasswordField = ({
  label,
  name,
  value,
  placeholder,
  autoComplete,
  icon: Icon,
  error,
  visible,
  disabled,
  onChange,
  onToggle,
}) => {
  const { t } = useTranslation('auth');
  return (
  <div className="cp-field" data-invalid={error ? 'true' : undefined}>
    <label htmlFor={name} className={`cp-label ${error ? 'cp-label--err' : ''}`}>
      {label}
    </label>

    <div className={`cp-input ${error ? 'cp-input--err' : ''}`}>
      <Icon className="cp-input__icon" size={16} />
      <input
        id={name}
        type={visible ? 'text' : 'password'}
        name={name}
        className="cp-input__el"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        disabled={disabled}
      />
      <button
        type="button"
        className="cp-input__eye"
        tabIndex={-1}
        onClick={() => onToggle(name)}
        aria-label={visible ? t('hide_password') : t('show_password')}
        title={visible ? t('hide_password') : t('show_password')}
        disabled={disabled}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>

    <AnimatePresence>
      {error && (
        <motion.p
          className="cp-error"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
        >
          <AlertCircle size={12} /> {error}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);
};

const ChangePassword = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, changePassword, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { showToast } = useToastStore();
  const isDark = theme === 'dark';

  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [visibility, setVisibility] = useState({
    current_password: false,
    new_password: false,
    confirm_password: false,
  });
  const [saving, setSaving] = useState(false);
  const [passwordCompanies, setPasswordCompanies] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);

  const fullName = useMemo(
    () => `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'User',
    [user],
  );
  const mustChange = Number(user?.must_change_password || 0) === 1 || user?.must_change_password === true;

  useEffect(() => {
    document.title = t('document_change_password');
  }, [t]);

  useEffect(() => {
    let valid = true;
    if (!user?.id) return undefined;
    api.get('/users/password-workspaces', { skipPortalContext: true })
      .then(({ data }) => {
        if (valid) setPasswordCompanies(data?.data?.company_names || []);
      })
      .catch(() => { if (valid) setPasswordCompanies([]); });
    return () => { valid = false; };
  }, [user?.id]);

  const setField = (name, value) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const toggleVisibility = (name) => {
    setVisibility((previous) => ({ ...previous, [name]: !previous[name] }));
  };

  const validate = () => {
    const formErrors = {};

    if (!form.current_password.trim()) {
      formErrors.current_password = t('current_required');
    }

    if (form.new_password.trim().length < 8) {
      formErrors.new_password = t('new_min8');
    } else if (form.current_password === form.new_password) {
      formErrors.new_password = t('new_different');
    }

    if (form.new_password !== form.confirm_password) {
      formErrors.confirm_password = t('confirm_mismatch');
    }

    return formErrors;
  };

  const errors = submitted ? validate() : {};

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, t('password_validation'));
      return;
    }

    setSaving(true);
    const result = await changePassword(form);
    setSaving(false);

    if (result.success) {
      showToast(result.data?.message || t('password_updated'), 'success');
      navigate(
        location.state?.from && location.state.from !== '/change-password'
          ? location.state.from
          : '/dashboard',
        { replace: true },
      );
      return;
    }

    showToast(result.error || t('password_update_failed'), 'error');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className={`change-password theme-${theme}`}>
      <section className="change-password__left">
        <div className="change-password__left-mesh" />
        <div className="cp-circle cp-circle--1" />
        <div className="cp-circle cp-circle--2" />
        <div className="cp-circle cp-circle--3" />

        <div className="change-password__left-content">
          <motion.div
            className="cp-brand"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img
              className="cp-brand__logo"
              src={isDark ? appraisalsuiteLogoDark : appraisalsuiteLogoLight}
              alt={t('logo_alt')}
            />
          </motion.div>

          <motion.div
            className="cp-headline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="cp-headline__h1">
              {t('headline_first')}<br />
              <span className="cp-headline__accent">{t('headline_second')}</span><br />
              {t('headline_third')}
            </h1>
            <p className="cp-headline__body">
              {t('headline_body')}
            </p>
          </motion.div>

          <div className="cp-features">
            <Feature icon={Star} title={t('feature_kpi')} desc={t('feature_kpi_desc')} delay={0.2} />
            <Feature icon={Users} title={t('feature_supervisor')} desc={t('feature_supervisor_desc')} delay={0.3} />
            <Feature icon={BarChart3} title={t('feature_analytics')} desc={t('feature_analytics_desc')} delay={0.4} />
            <Feature icon={Mail} title={t('feature_notifications')} desc={t('feature_notifications_desc')} delay={0.5} />
          </div>
        </div>
      </section>

      <section className="change-password__right">
        <LanguageSwitcher placement="password" />
        <motion.button
          type="button"
          className="change-password__theme-btn"
          onClick={toggleTheme}
          title={isDark ? t('light_mode') : t('dark_mode')}
          aria-label={isDark ? t('light_mode') : t('dark_mode')}
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

        <motion.div
          className="change-password__form-wrap"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="cp-form-head">
            <h2 className="cp-form-head__title">{t('secure_account')}</h2>
            <p className="cp-form-head__sub">
              {t('hello_update', { name: fullName })}
            </p>
          </div>

          {passwordCompanies.length > 1 && (
            <p className="cp-password-companies">
              <ShieldCheck size={16} aria-hidden="true" />
              {t('shared_password_companies', { companies: passwordCompanies.join(', ') })}
            </p>
          )}

          <form ref={formRef} className="cp-form" onSubmit={handleSubmit} autoComplete="on" noValidate>
            <PasswordField
              label={t('current_password')}
              name="current_password"
              value={form.current_password}
              placeholder={t('current_password_placeholder')}
              autoComplete="current-password"
              icon={LockKeyhole}
              error={errors.current_password}
              visible={visibility.current_password}
              disabled={saving}
              onChange={setField}
              onToggle={toggleVisibility}
            />

            <PasswordField
              label={t('new_password')}
              name="new_password"
              value={form.new_password}
              placeholder={t('new_password_placeholder')}
              autoComplete="new-password"
              icon={KeyRound}
              error={errors.new_password}
              visible={visibility.new_password}
              disabled={saving}
              onChange={setField}
              onToggle={toggleVisibility}
            />

            <PasswordField
              label={t('confirm_password')}
              name="confirm_password"
              value={form.confirm_password}
              placeholder={t('confirm_password_placeholder')}
              autoComplete="new-password"
              icon={CircleCheck}
              error={errors.confirm_password}
              visible={visibility.confirm_password}
              disabled={saving}
              onChange={setField}
              onToggle={toggleVisibility}
            />

            <motion.button
              type="submit"
              className="cp-submit"
              disabled={saving}
              whileHover={{ scale: saving ? 1 : 1.012 }}
              whileTap={{ scale: saving ? 1 : 0.988 }}
            >
              <AnimatePresence mode="wait">
                {saving ? (
                  <motion.span
                    key="saving"
                    className="cp-submit__inner"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className="cp-spinner" /> {t('updating_password')}
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    className="cp-submit__inner"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {t('update_continue')} <ArrowRight size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <div className="cp-security">
            <div className="cp-security__divider">
              <span>{t('encryption')}</span>
            </div>
            <div className="cp-security__badges">
              <span className="cp-security__badge"><ShieldCheck size={12} /> {t('ssl_protected')}</span>
              <span className="cp-security__badge"><LockKeyhole size={12} /> {t('secure_session')}</span>
            </div>
          </div>

          <div className="cp-secondary-actions">
            {!mustChange && (
              <button type="button" onClick={() => navigate('/dashboard')} disabled={saving}>
                <ArrowLeft size={15} /> {t('back_to_dashboard')}
              </button>
            )}
            <button type="button" onClick={handleLogout} disabled={saving}>
              <LogOut size={15} /> {t('sign_out')}
            </button>
          </div>
        </motion.div>
      </section>
    </main>
  );
};

export default ChangePassword;
