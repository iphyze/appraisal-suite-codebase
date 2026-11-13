import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpenCheck, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore';
import useCompanyWritePermission from '../hooks/useCompanyWritePermission';
import useThemeStore from '../stores/useThemeStore';
import PortalContextSwitcher from '../components/PortalContextSwitcher';
import AppIcon from '../components/ui/AppIcon';
import { isAppraisalSupervisorUser, SUPERVISOR_GUIDE_EVENT } from '../components/onboarding/SupervisorAppraisalGuide';
import { getAiNavigationAvailability } from '../services/aiAssistant';
import appLogoLight from '../assets/images/appraisalsuite/logo/appraisalsuite-logo-light.png';
import appLogoDark from '../assets/images/appraisalsuite/logo/appraisalsuite-logo-dark.png';
import appLogoMark from '../assets/images/appraisalsuite/logo/appraisalsuite-mark-128px.png';
import './NavBar.css';

const keyForNav = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const SIDEBAR_COLLAPSED_KEY = 'appraisalsuite.sidebar.collapsed';

const roleCanSee = (allowedRoles, role) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(role);
};

const menuGroups = [
  {
    title: 'Workspace',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'Gauge',
        end: true,
      },
      {
        path: '/ai-assistant',
        label: 'AI Assistant',
        icon: 'BrainCircuit',
        aiFeature: 'assistant',
        activePaths: ['/ai-assistant'],
      },
      {
        path: '/ai/insights',
        label: 'AI Insights',
        icon: 'ChartNoAxesCombined',
        aiFeature: 'management_insights',
        roles: ['admin', 'super_admin'],
        activePaths: ['/ai/insights'],
      },
      {
        path: '/analytics',
        label: 'Analytics',
        icon: 'BarChart3',
        aiFeature: 'analytics',
        roles: ['admin', 'super_admin', 'supervisor'],
        activePaths: ['/analytics'],
      },
      {
        path: '/users/my-profile',
        label: 'My Profile',
        icon: 'IdCard',
        activePaths: ['/users/my-profile', '/profile'],
      },
      {
        path: '/appraisals',
        label: 'Appraisals',
        icon: 'ClipboardCheck',
        roles: ['super_admin', 'admin', 'supervisor'],
        activePaths: ['/appraisals'],
      },
      {
        path: '/my-team-appraisals',
        label: 'My Team Appraisals',
        icon: 'Users',
        roles: ['admin'],
        supervisorOnly: true,
        activePaths: ['/my-team-appraisals'],
      },
      {
        path: '/my-appraisals',
        label: 'My Appraisals',
        icon: 'UserCheck',
        roles: ['admin', 'supervisor', 'staff'],
        activePaths: ['/my-appraisals', '/staff/my-appraisals', '/staff/appraisals'],
      },
    ],
  },
  {
    title: 'People',
    items: [
      {
        path: '/supervisors',
        label: 'Supervisors',
        icon: 'UserCheck',
        roles: ['super_admin', 'admin'],
        end: true,
      },
      {
        path: '/users/home',
        label: 'Users & Access',
        icon: 'Users',
        roles: ['super_admin', 'admin'],
        activePaths: ['/users/home', '/users/create-user', '/users/edit', '/users/view'],
      },
      {
        path: '/users/company-access',
        label: 'Company Access',
        icon: 'ShieldCheck',
        roles: ['super_admin'],
        activePaths: ['/users/company-access'],
      },
    ],
  },
  {
    title: 'Setup',
    items: [
      {
        path: '/companies',
        label: 'Companies',
        icon: 'Building2',
        roles: ['super_admin'],
        activePaths: ['/companies'],
      },
      {
        path: '/cycles/home',
        label: 'Appraisal Cycles',
        icon: 'CalendarCheck',
        roles: ['super_admin', 'admin'],
        activePaths: ['/cycles'],
      },
      {
        path: '/departments',
        label: 'Departments',
        icon: 'Building2',
        roles: ['super_admin', 'admin'],
        activePaths: ['/departments'],
      },
    ],
  },
  {
    title: 'AI Administration',
    items: [{
      path: '/translations',
      label: 'Translations',
      icon: 'Globe',
      roles: ['super_admin'],
      activePaths: ['/translations'],
    }, {
      path: '/ai/settings',
      label: 'AI Settings',
      icon: 'SlidersHorizontal',
      roles: ['super_admin'],
      activePaths: ['/ai/settings'],
    }],
  },
  {
    title: 'Questions',
    items: [
      {
        path: '/questions/kpi',
        label: 'KPI Questions',
        icon: 'Target',
        roles: ['super_admin', 'admin'],
        activePaths: ['/questions/kpi'],
      },
      {
        path: '/questions/general',
        label: 'General Questions',
        icon: 'ListChecks',
        roles: ['super_admin', 'admin'],
        activePaths: ['/questions/general'],
      },
    ],
  },
  {
    title: 'Assignments',
    items: [
      {
        path: '/supervisors/assignments',
        requiresCompanyManage: true,
        label: 'Supervisor Assignments',
        icon: 'ArrowRightLeft',
        roles: ['super_admin', 'admin'],
        activePaths: ['/supervisors/assignments'],
      },
    ],
  },
  {
    title: 'Communication',
    items: [
      {
        path: '/notifications',
        label: 'Notifications',
        icon: 'Bell',
        activePaths: ['/notifications'],
      },
      {
        path: '/mail',
        requiresCompanyManage: true,
        label: 'Send Email',
        icon: 'Mail',
        roles: ['super_admin', 'admin'],
        activePaths: ['/mail'],
      },
      {
        path: '/email-delivery',
        label: 'Email Delivery',
        icon: 'Send',
        roles: ['super_admin'],
        activePaths: ['/email-delivery'],
      },
      {
        path: '/audit-log',
        label: 'Audit Log',
        icon: 'ShieldCheck',
        roles: ['super_admin', 'admin'],
        activePaths: ['/audit-log'],
      },
    ],
  },
];

const NavBar = ({ nav, setNav }) => {
  const { t } = useTranslation('nav');
  const location = useLocation();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const navRef = useRef(null);
  const scrollRef = useRef(null);
  const activeItemRef = useRef(null);
  const [openGroups, setOpenGroups] = useState({});
  // Fail closed while loading; presentation never grants backend permissions.
  const [aiMenuFeatures, setAiMenuFeatures] = useState(null);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });

  const role = user?.role || 'staff';
  const { isViewOnly } = useCompanyWritePermission();
  const userId = user?.id || null;
  useEffect(() => {
    if (!userId) { setAiMenuFeatures(null); return undefined; }
    let active = true;
    let lastCheckAt = 0;
    setAiMenuFeatures(null);
    const refresh = () => {
      if (!active) return;
      lastCheckAt = Date.now();
      getAiNavigationAvailability()
        .then((features) => { if (active) setAiMenuFeatures(features); })
        .catch(() => { if (active) setAiMenuFeatures(null); });
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckAt > 10000) refresh();
    };
    refresh();
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    window.addEventListener('appraisalsuite:ai-settings-updated', refresh);
    const timer = window.setInterval(refreshWhenActive, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
      window.removeEventListener('appraisalsuite:ai-settings-updated', refresh);
    };
  }, [userId, role]);

  const isDark = theme === 'dark';
  const brandLogo = isDark ? appLogoDark : appLogoLight;

  const isItemActive = (item) => {
    const withinAppraisal = /^\/appraisals\/(view|edit|create)\//.test(location.pathname);
    const viewingOwnAppraisal = withinAppraisal && location.state?.from === '/my-appraisals';
    const viewingTeamAppraisal = withinAppraisal && location.state?.from === '/my-team-appraisals';

    if (item.label === 'My Team Appraisals' && viewingTeamAppraisal) return true;
    if (item.label === 'Appraisals' && viewingTeamAppraisal) return false;

    if (item.label === 'My Appraisals' && viewingOwnAppraisal) {
      return true;
    }
    if (item.label === 'Appraisals' && viewingOwnAppraisal) {
      return false;
    }

    if (item.end) {
      return location.pathname === item.path;
    }

    if (item.activePaths?.length) {
      return item.activePaths.some(
        (activePath) =>
          location.pathname === activePath ||
          location.pathname.startsWith(`${activePath}/`)
      );
    }

    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  const visibleGroups = useMemo(() => {
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          roleCanSee(item.roles, role)
          && (!item.requiresCompanyManage || !isViewOnly)
          && (!item.supervisorOnly || Number(user?.is_supervisor) === 1)
          && (!item.aiFeature || aiMenuFeatures?.[item.aiFeature]?.available === true)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, user?.is_supervisor, aiMenuFeatures, isViewOnly]);


  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.documentElement.classList.toggle('ap-sidebar-collapsed', collapsed);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));

    return undefined;
  }, [collapsed]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };

      visibleGroups.forEach((group) => {
        if (group.items.some((item) => isItemActive(item))) {
          next[group.title] = true;
        }
      });

      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, visibleGroups]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const activeNode = activeItemRef.current;
      const scrollContainer = scrollRef.current;

      if (!activeNode || !scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const activeRect = activeNode.getBoundingClientRect();
      const targetTop = scrollContainer.scrollTop
        + (activeRect.top - containerRect.top)
        - ((scrollContainer.clientHeight - activeRect.height) / 2);

      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [location.pathname, openGroups]);

  useEffect(() => {
    const handler = (event) => {
      const toggleBtn = document.querySelector('.ap-header__nav-toggle');

      if (toggleBtn && toggleBtn.contains(event.target)) return;

      if (navRef.current && !navRef.current.contains(event.target)) {
        setNav(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => document.removeEventListener('mousedown', handler);
  }, [setNav]);

  const fullName =
    `${user?.first_name || user?.fname || ''} ${user?.last_name || user?.lname || ''}`.trim() ||
    user?.username ||
    'User';

  const initials =
    `${user?.first_name?.[0] || user?.fname?.[0] || ''}${user?.last_name?.[0] || user?.lname?.[0] || ''}`.toUpperCase() ||
    user?.username?.slice(0, 2)?.toUpperCase() ||
    'U';

  const roleLabel = role.replaceAll('_', ' ');

  return (
    <>
      {nav && (
        <button
          type="button"
          className="ap-nav__backdrop"
          onClick={() => setNav(false)}
          aria-label={t('close_navigation')}
        />
      )}

      <aside
        ref={navRef}
        className={`ap-nav ${nav ? 'ap-nav--open' : ''} ${collapsed ? 'ap-nav--collapsed' : ''} ${isDark ? 'ap-nav--dark' : 'ap-nav--light'}`}
      >
        <div className="ap-nav__top">
          <NavLink
            to="/dashboard"
            className="ap-nav__brand"
            onClick={() => setNav(false)}
            aria-label={t('appraisalsuite_dashboard')}
          >
            <img
              className="ap-nav__brand-logo ap-nav__brand-logo--full"
              src={brandLogo}
              alt="AppraisalSuite"
            />
            <img
              className="ap-nav__brand-logo ap-nav__brand-logo--mark"
              src={appLogoMark}
              alt=""
              aria-hidden="true"
            />
          </NavLink>

          <button
            type="button"
            className="ap-nav__collapse"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? t('expand_navigation') : t('collapse_navigation')}
            title={collapsed ? t('expand_navigation') : t('collapse_navigation')}
          >
            <AppIcon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={15} />
          </button>
        </div>

        <PortalContextSwitcher />

        <div ref={scrollRef} className="ap-nav__scroll">
          {visibleGroups.map((group) => {
            const open = openGroups[group.title] ?? true;

            return (
              <div key={group.title} className="ap-nav__group">
                <button
                  type="button"
                  className="ap-nav__group-title"
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group.title]: !open,
                    }))
                  }
                >
                  <span>{t(keyForNav(group.title))}</span>
                  <AppIcon icon="ChevronDown" size={14} className={open ? 'ap-nav__group-chev--open' : ''} />
                </button>

                <div className={`ap-nav__items ${open ? 'ap-nav__items--open' : ''}`}>
                  {group.items.map((item) => {
                    const active = isItemActive(item);
                    return (
                      <NavLink
                        key={item.path}
                        ref={active ? activeItemRef : null}
                        to={item.path}
                        end={item.end}
                        className={`ap-nav__item ${active ? 'ap-nav__item--active' : ''}`}
                        onClick={() => setNav(false)}
                        title={collapsed ? t(keyForNav(item.label)) : undefined}
                        aria-label={collapsed ? t(keyForNav(item.label)) : undefined}
                      >
                        <span className="ap-nav__item-icon">
                          <AppIcon icon={item.icon} size={16} />
                        </span>

                        <span className="ap-nav__item-label">
                          {t(keyForNav(item.label))}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {isAppraisalSupervisorUser(user) ? (
          <button
            type="button"
            className="ap-nav__footer ap-nav__footer--guide"
            onClick={() => {
              setNav(false);
              window.dispatchEvent(new CustomEvent(SUPERVISOR_GUIDE_EVENT));
            }}
            aria-label={t('replay_appraisal_guide')}
            title={t('replay_appraisal_guide')}
          >
            <span className="ap-nav__footer-guide-icon">
              <AppIcon icon={BookOpenCheck} size={18} />
            </span>
            <span className="ap-nav__footer-guide-label">{t('replay_appraisal_guide')}</span>
          </button>
        ) : (
          <div className="ap-nav__footer">
            <span className="ap-nav__footer-avatar">
              {initials}
            </span>

            <div className="ap-nav__footer-text">
              <strong>{fullName}</strong>
              <small>{roleLabel}</small>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default NavBar;