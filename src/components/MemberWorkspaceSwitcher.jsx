import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Check, ChevronDown, LoaderCircle } from 'lucide-react';
import AppIcon from './ui/AppIcon';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import useToastStore from '../stores/useToastStore';
import { selectableMemberWorkspace } from '../utils/memberWorkspaces';
import './MemberWorkspaceSwitcher.css';

/** Person's OWN membership switcher, never a Company Access / View Context switch. */
const MemberWorkspaceSwitcher = () => {
  const { t } = useTranslation('nav');
  const { t: tu } = useTranslation('users');
  const user = useAuthStore((state) => state.user);
  const switchWorkspace = useAuthStore((state) => state.switchWorkspace);
  const { showToast } = useToastStore();
  const [workspaces, setWorkspaces] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const switchLock = useRef(false);

  useEffect(() => {
    if (!user?.identity_id) return;
    let active = true;
    setWorkspaces([]);
    api.get('/auth/workspaces', { skipPortalContext: true, skipRetry: true })
      .then((response) => {
        if (active && response.data?.status === 'Success') {
          setWorkspaces(Array.isArray(response.data?.data?.workspaces)
            ? response.data.data.workspaces : []);
        }
      })
      .catch(() => {
        if (active) showToast(t('member_workspace_load_failed'), 'error');
      });
    return () => { active = false; };
  }, [user?.id, user?.identity_id, showToast, t]);

  if (workspaces.length <= 1) return null;

  const switchTo = async (workspace) => {
    if (switchLock.current || !selectableMemberWorkspace(workspaces, user?.id, workspace.user_id)) return;
    switchLock.current = true;
    setSwitchingId(workspace.user_id);
    const result = await switchWorkspace(workspace.user_id);
    if (result.success) {
      // Like the existing View Context switch, a full page load wipes all
      // in-memory company-specific stores and pending page requests. The
      // appraisal drafts in localStorage are deliberately NOT removed.
      window.location.assign('/dashboard');
      return;
    }
    switchLock.current = false;
    setSwitchingId(null);
    showToast(t('member_workspace_switch_failed'), 'error');
  };

  return (
    <section className="member-workspaces" aria-label={t('member_workspaces_title')}>
      <button type="button" className="member-workspaces__toggle"
        aria-expanded={expanded} onClick={() => setExpanded((before) => !before)}>
        <AppIcon icon={Building2} size={16} />
        <span>{t('member_workspaces_title')}</span>
        <AppIcon icon={ChevronDown} size={15}
          className={`member-workspaces__chevron ${expanded ? 'member-workspaces__chevron--open' : ''}`} />
      </button>
      {expanded && (
        <div className="member-workspaces__list">
          <p className="member-workspaces__description">{t('member_workspaces_description')}</p>
          {workspaces.map((workspace) => {
            const isCurrent = Number(workspace.user_id) === Number(user?.id);
            const busy = switchingId === workspace.user_id;
            const roleKey = String(workspace.role || '').toLowerCase().trim().replaceAll(' ', '_');
            const roleLabel = ['super_admin', 'admin', 'supervisor', 'staff'].includes(roleKey)
              ? tu(roleKey) : workspace.role;
            return (
              <button type="button" key={workspace.user_id}
                className={`member-workspaces__item ${isCurrent ? 'member-workspaces__item--current' : ''}`}
                disabled={isCurrent || switchingId !== null}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => switchTo(workspace)}>
                <span className="member-workspaces__details">
                  <strong>{workspace.company_name}</strong>
                  <small>{roleLabel}</small>
                </span>
                {isCurrent ? <AppIcon icon={Check} size={16} className="member-workspaces__indicator" />
                  : busy ? <AppIcon icon={LoaderCircle} size={16} className="member-workspaces__spinner" />
                    : null}
                {isCurrent && <span className="member-workspaces__sr-only">{t('member_workspace_current')}</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MemberWorkspaceSwitcher;
