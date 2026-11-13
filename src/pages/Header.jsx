import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Building2,
  ChevronDown,
  CircleUserRound,
  Info,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  Volume2,
  Gauge,
  BookOpenCheck,
} from 'lucide-react';
import useAuthStore from '../stores/useAuthStore';
import useThemeStore from '../stores/useThemeStore';
import useNotificationsStore from '../stores/useNotificationsStore';
import GlobalSearch from '../components/GlobalSearch';
import AppIcon from '../components/ui/AppIcon';
import { canOpenAppraisalGuide, SUPERVISOR_GUIDE_EVENT } from '../components/onboarding/SupervisorAppraisalGuide';
import { playNotificationSound, primeNotificationSound } from '../utils/notificationSound';
import AskAiPanel from '../components/ai/AskAiPanel';
import './Header.css';
import CompanyContextBanner from '../components/CompanyContextBanner';
import useToastStore from '../stores/useToastStore';
import { openVerifiedNotification } from '../services/notificationNavigation';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import MemberWorkspaceSwitcher from '../components/MemberWorkspaceSwitcher';

const getInitials = (user) => {
  const first = user?.first_name?.[0] || user?.fname?.[0] || '';
  const last = user?.last_name?.[0] || user?.lname?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'U';
};

const getFullName = (user) => {
  const first = user?.first_name || user?.fname || '';
  const last = user?.last_name || user?.lname || '';
  return `${first} ${last}`.trim() || user?.username || 'User';
};

const Header = ({ nav, setNav }) => {
  const { t, i18n } = useTranslation('nav');
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const {
    previewItems: notifications,
    unread,
    fetchNotificationPreview,
    checkNotificationPulse,
    markRead,
  } = useNotificationsStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [openingNotificationId, setOpeningNotificationId] = useState(null);
  const [soundReady, setSoundReady] = useState(false);
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const isDark = theme === 'dark';

  const initials = useMemo(() => getInitials(user), [user]);
  const fullName = useMemo(() => getFullName(user), [user]);
  const role = user?.role || user?.integrity || 'User';
  const companyName = user?.company_name || 'Lambert Electromec';

  useEffect(() => {
    const notice = window.sessionStorage.getItem('appraisal-company-access-notice');
    if (notice) {
      window.sessionStorage.removeItem('appraisal-company-access-notice');
      showToast(notice === 'company:access_lost' ? t('access_lost', { ns: 'company' }) : notice, 'error');
    }
  }, [showToast, t]);

  useEffect(() => {
    const handler = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let disposed = false;
    let timer = null;
    let syncing = false;
    let previousLatestId = null;
    let pendingSoundId = 0;

    const soundKey = `appraisal-suite:last-notification-sound:${user?.id || 'user'}`;

    const rememberLatestWithoutSound = (latestId) => {
      const storedId = Number(window.localStorage.getItem(soundKey) || 0);
      if (latestId > storedId) window.localStorage.setItem(soundKey, String(latestId));
    };

    const syncNotifications = async ({ initial = false } = {}) => {
      if (disposed || syncing || !navigator.onLine) return;
      syncing = true;

      try {
        const pulseResult = await checkNotificationPulse();
        if (!pulseResult.success || disposed) return;

        const latestId = Number(pulseResult.data?.latest_id || 0);
        const firstSync = previousLatestId === null;
        const hasNewNotification = !firstSync && latestId > previousLatestId;

        // Other pages can refresh the shared pulse store first. Comparing the
        // header's own last-seen ID ensures we still pick up new notifications.
        if (firstSync || hasNewNotification || pulseResult.changed || initial) {
          const previewResult = await fetchNotificationPreview();
          if (!previewResult.success || disposed) return;

          if (hasNewNotification) {
            const newestUnreadId = (previewResult.items || []).reduce((highest, item) => {
              const itemId = Number(item.id || 0);
              return Number(item.is_read) === 0 && itemId > previousLatestId
                ? Math.max(highest, itemId)
                : highest;
            }, 0);

            if (newestUnreadId > 0) {
              const lastSoundedId = Number(window.localStorage.getItem(soundKey) || 0);
              if (newestUnreadId > lastSoundedId) {
                if (playNotificationSound()) {
                  window.localStorage.setItem(soundKey, String(newestUnreadId));
                  pendingSoundId = 0;
                } else {
                  // Audio requires a user gesture in many browsers. Keep the
                  // chime pending instead of incorrectly marking it as played.
                  pendingSoundId = newestUnreadId;
                }
              }
            }
          } else if (firstSync) {
            // Existing unread items are a baseline, not a newly-arrived notification.
            rememberLatestWithoutSound(latestId);
          }
        }

        previousLatestId = latestId;
      } finally {
        syncing = false;
      }
    };

    const scheduleNext = () => {
      window.clearTimeout(timer);
      const delay = document.hidden ? 30000 : 10000;
      timer = window.setTimeout(async () => {
        await syncNotifications();
        if (!disposed) scheduleNext();
      }, delay);
    };

    const refreshNow = () => {
      if (!document.hidden) syncNotifications();
      scheduleNext();
    };

    const unlockSound = async () => {
      const ready = await primeNotificationSound();
      if (disposed) return;
      setSoundReady(ready);
      if (ready && pendingSoundId > Number(window.localStorage.getItem(soundKey) || 0)) {
        if (playNotificationSound()) {
          window.localStorage.setItem(soundKey, String(pendingSoundId));
          pendingSoundId = 0;
        }
      }
    };

    window.addEventListener('pointerdown', unlockSound, true);
    window.addEventListener('keydown', unlockSound, true);
    window.addEventListener('focus', refreshNow);
    window.addEventListener('online', refreshNow);
    document.addEventListener('visibilitychange', refreshNow);

    syncNotifications({ initial: true }).finally(scheduleNext);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', unlockSound, true);
      window.removeEventListener('keydown', unlockSound, true);
      window.removeEventListener('focus', refreshNow);
      window.removeEventListener('online', refreshNow);
      document.removeEventListener('visibilitychange', refreshNow);
    };
  }, [checkNotificationPulse, fetchNotificationPreview, user?.id]);

  // Refresh server-rendered notification text even if the dropdown is closed.
  // The reader's language comes from their own session / X-App-Locale header.
  useEffect(() => {
    if (user?.id) fetchNotificationPreview();
  }, [fetchNotificationPreview, i18n.resolvedLanguage, user?.id]);

  useEffect(() => {
    if (showNotifications) fetchNotificationPreview();
  }, [showNotifications, fetchNotificationPreview]);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
    <header className={`ap-header ${isDark ? 'ap-header--dark' : 'ap-header--light'}`}>
      <div className="ap-header__left">
        <button
          type="button"
          className={`ap-header__nav-toggle ${nav ? 'ap-header__nav-toggle--open' : ''}`}
          onClick={() => setNav((prev) => !prev)}
          aria-label={nav ? t('close_navigation') : t('open_navigation')}
          aria-expanded={nav}
        >
          <span /><span /><span />
        </button>

        <NavLink to="/dashboard" className="ap-header__brand" aria-label={t('go_to_dashboard')}>
          <span className="ap-header__brand-mark"><AppIcon icon={Gauge} size={21} /></span>
          <span className="ap-header__brand-text">
            <strong>Lambert</strong>
            <small>{t('staff_appraisal')}</small>
          </span>
        </NavLink>
      </div>

      <div className="ap-header__center">
        <GlobalSearch />
      </div>

      <div className="ap-header__right">
        <div className="ap-header__utilities">
          <AskAiPanel />
          <button
            type="button"
            className="ap-header__utility-btn ap-header__theme"
            onClick={toggleTheme}
            title={isDark ? t('switch_to_light_mode') : t('switch_to_dark_mode')}
            aria-label={isDark ? t('switch_to_light_mode') : t('switch_to_dark_mode')}
          >
            <AppIcon icon={isDark ? Moon : Sun} size={16} />
          </button>

          <div className="ap-header__notification-wrap" ref={notificationRef}>
            <button
              type="button"
              className={`ap-header__utility-btn ap-header__icon-btn ${showNotifications ? 'ap-header__utility-btn--active' : ''}`}
              aria-label={t('notifications')}
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              <AppIcon icon={Bell} size={16} />
              {unread > 0 && <span className="ap-header__notification-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                className="ap-header__notifications"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16 }}
              >
                <div className="ap-header__notifications-head">
                  <strong>{t('notifications')}</strong>
                  <button
                    type="button"
                    title={t('test_notification_sound')}
                    onClick={async () => {
                      const ready = await primeNotificationSound();
                      setSoundReady(ready);
                      if (ready) playNotificationSound();
                    }}
                  >
                    <AppIcon icon={Volume2} size={13} /> {soundReady ? t('test_sound') : t('enable_sound')}
                  </button>
                  {unread > 0 && <button type="button" onClick={() => markRead()}>{t('mark_all_read')}</button>}
                </div>

                <div className="ap-header__notifications-list">
                  {notifications.length === 0 ? (
                    <div className="ap-header__notification-empty">{t('no_notifications_yet')}</div>
                  ) : notifications.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`ap-header__notification-item ${Number(item.is_read) === 0 ? 'ap-header__notification-item--unread' : ''}`}
                      disabled={openingNotificationId !== null}
                      aria-busy={openingNotificationId === item.id}
                      onClick={async () => {
                        if (openingNotificationId !== null) return;
                        setOpeningNotificationId(item.id);
                        try {
                          const opened = await openVerifiedNotification(item, { navigate, markRead, showToast });
                          if (opened) setShowNotifications(false);
                        } finally {
                          setOpeningNotificationId(null);
                        }
                      }}
                    >
                      <span><AppIcon icon={Info} size={16} /></span>
                      <div>
                        <strong>{item.title}</strong>
                        {item.company_name && <small className="ap-header__notification-company">{item.company_name}</small>}
                        <small>{item.message}</small>
                      </div>
                    </button>
                  ))}
                </div>
                <NavLink className="ap-header__notifications-more" to="/notifications" onClick={() => setShowNotifications(false)}>
                  {t('view_all_notifications')} <AppIcon icon={ArrowRight} size={15} />
                </NavLink>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>

        <div className="ap-header__user-wrap" ref={userMenuRef}>
          <button
            type="button"
            className={`ap-header__user ${showUserMenu ? 'ap-header__user--open' : ''}`}
            onClick={() => setShowUserMenu((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={showUserMenu}
          >
            <span className="ap-header__avatar">{initials}</span>
            <span className="ap-header__user-meta">
              <strong>{fullName}</strong>
              <small>{role.replaceAll('_', ' ')}</small>
            </span>
            <AppIcon icon={ChevronDown} size={15} className={`ap-header__user-chevron ${showUserMenu ? 'ap-header__user-chevron--open' : ''}`} />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                className="ap-header__dropdown"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                role="menu"
              >
                <div className="ap-header__dropdown-head">
                  <span className="ap-header__dropdown-avatar">{initials}</span>
                  <div>
                    <strong>{fullName}</strong>
                    <small>{user?.email}</small>
                  </div>
                </div>

                <div className="ap-header__company-pill">
                  <AppIcon icon={Building2} size={16} />
                  <span>{companyName}</span>
                </div>

                <LanguageSwitcher placement="menu" />

                <MemberWorkspaceSwitcher />

                <NavLink to="/users/my-profile" className="ap-header__dropdown-item" onClick={() => setShowUserMenu(false)}>
                  <AppIcon icon={CircleUserRound} size={17} />
                  <span>{t('my_profile')}</span>
                </NavLink>

                <NavLink to="/change-password" className="ap-header__dropdown-item" onClick={() => setShowUserMenu(false)}>
                  <AppIcon icon={KeyRound} size={17} />
                  <span>{t('change_password')}</span>
                </NavLink>

                {canOpenAppraisalGuide(user) && (
                  <button
                    type="button"
                    className="ap-header__dropdown-item"
                    onClick={() => {
                      setShowUserMenu(false);
                      window.dispatchEvent(new CustomEvent(SUPERVISOR_GUIDE_EVENT));
                    }}
                  >
                    <AppIcon icon={BookOpenCheck} size={17} />
                    <span>{t('appraisal_guide')}</span>
                  </button>
                )}

                <button type="button" className="ap-header__dropdown-item ap-header__dropdown-item--danger" onClick={handleLogout}>
                  <AppIcon icon={LogOut} size={17} />
                  <span>{t('sign_out')}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
    <CompanyContextBanner />
    </>
  );
};

export default Header;
