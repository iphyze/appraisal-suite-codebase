import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import useThemeStore from '../../stores/useThemeStore';
import useUsersStore from '../../stores/useUsersStore';
import useAuthStore from '../../stores/useAuthStore';
import useToastStore from '../../stores/useToastStore';
import api from '../../services/api';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import './Users.css';
import AppIcon from '../../components/ui/AppIcon';
import { formatDate, formatDateTime } from '../../utils/format';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const roleLabel = (role) => ({
  super_admin: 'Super Admin',
  admin: 'Admin',
  supervisor: 'Supervisor',
  staff: 'Staff',
}[role] || role || '—');

const ViewUser = () => {
  const { isViewOnly } = useCompanyWritePermission();
  useTranslation('users');
  const [nav, setNav] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const currentUser = useAuthStore((state) => state.user);
  const { showToast } = useToastStore();
  const [confirmIdentityStatus, setConfirmIdentityStatus] = useState(false);
  const [savingIdentityStatus, setSavingIdentityStatus] = useState(false);
  const identityDialogRef = useRef(null);
  const { singleUser, fetchingSingle, singleUserError, fetchSingleUser, clearSingleUser } = useUsersStore();

  useEffect(() => {
    document.title = `Appraisal Portal | ${ux('view_user')}`;
    fetchSingleUser(id);
    return () => clearSingleUser();
  }, [id, fetchSingleUser, clearSingleUser]);

  useEffect(() => { document.title = `Appraisal Portal | ${ux('view_user')}`; }, [i18n.language]);

  useEffect(() => {
    if (!confirmIdentityStatus) return undefined;
    const before = document.activeElement;
    identityDialogRef.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && !savingIdentityStatus) setConfirmIdentityStatus(false);
      if (event.key === 'Tab') {
        const items = Array.from(identityDialogRef.current?.querySelectorAll('button:not([disabled])') || []);
        if (items.length < 2) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
        if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [confirmIdentityStatus, savingIdentityStatus]);

  const updateIdentityStatus = async () => {
    if (savingIdentityStatus || !singleUser || currentUser?.role !== 'super_admin') return;
    setSavingIdentityStatus(true);
    try {
      await api.put('/users/identity-status', {
        user_id: Number(singleUser.id),
        is_active: Number(singleUser.identity_is_active) === 1 ? 0 : 1,
      });
      await fetchSingleUser(id);
      setConfirmIdentityStatus(false);
      showToast(ux('identity_status_success'), 'success');
    } catch (error) {
      showToast(ux('identity_status_error'), 'error');
    } finally { setSavingIdentityStatus(false); }
  };

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`usr-page theme-${theme}`}>
          <PageNav
            pageTitle={ux('view_user')}
            links={[
              { label: ux('dashboard'), to: '/dashboard', active: true },
              { label: ux('users'), to: '/users/home', active: true },
              { label: ux('view_user'), to: `/users/view/${id}`, active: false },
            ]}
          />

          {fetchingSingle && <ViewSkeleton />}

          {!fetchingSingle && singleUser && (
            <motion.section className="usr-profile" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className="usr-profile-hero">
                <div className="usr-profile-avatar">
                  {(singleUser.first_name?.[0] || 'U')}{singleUser.last_name?.[0] || ''}
                </div>
                <div>
                  <p className="usr-eyebrow">{['super_admin','admin','supervisor','staff'].includes(singleUser.role) ? ux(singleUser.role) : roleLabel(singleUser.role)}</p>
                  <h2>{singleUser.first_name} {singleUser.last_name}</h2>
                  <p>{singleUser.email}</p>
                  <div className="usr-profile-tags">
                    {singleUser.also_in_companies?.length > 0 && (
                      <span className="usr-also-in">{ux('identity_also_in', { companies: singleUser.also_in_companies.join(', ') })}</span>
                    )}
                    <span className={`usr-status ${Number(singleUser.is_active) === 1 ? 'usr-status--active' : 'usr-status--inactive'}`}>
                      {ux(Number(singleUser.is_active) === 1 ? 'active' : 'inactive')}
                    </span>
                    {singleUser.staff_type && <span className="usr-type">{['Local', 'Expatriate'].includes(singleUser.staff_type) ? ux(singleUser.staff_type.toLowerCase()) : singleUser.staff_type}</span>}
                    {singleUser.staff_scope && <span className="usr-type">{ux('scope', { scope: ['Local', 'Expatriate'].includes(singleUser.staff_scope) ? ux(singleUser.staff_scope.toLowerCase()) : singleUser.staff_scope === 'All' ? ux('all_staff_scope') : singleUser.staff_scope })}</span>}
                  </div>
                </div>
                <div className="usr-profile-actions">
                  {!isViewOnly && <button type="button" className="usr-btn usr-btn--primary" onClick={() => navigate(`/users/edit/${singleUser.id}`)}>
                    <AppIcon icon="PenLine" /> {ux('edit_user')}
                  </button>}
                  <Link to="/users/home" className="usr-btn usr-btn--ghost">{ux('back')}</Link>
                </div>
              </div>

              <div className="usr-detail-grid">
                <DetailCard title={ux('account')} icon="ShieldCheck">
                  <Info label={ux('role')} value={['super_admin','admin','supervisor','staff'].includes(singleUser.role) ? ux(singleUser.role) : roleLabel(singleUser.role)} />
                  <Info label={ux('username')} value={singleUser.username} />
                  <Info label={ux('company')} value={singleUser.company_name} />
                  <Info label={ux('company_code')} value={singleUser.company_code} />
                  {currentUser?.role === 'super_admin' && singleUser.identity_is_active != null && (
                    <div className="usr-identity-status">
                      <Info label={ux('identity_status')} value={ux(Number(singleUser.identity_is_active) === 1 ? 'identity_active' : 'identity_inactive')} />
                      <button type="button" className="usr-btn usr-btn--ghost" onClick={() => setConfirmIdentityStatus(true)}>
                        {ux(Number(singleUser.identity_is_active) === 1 ? 'identity_disable' : 'identity_enable')}
                      </button>
                    </div>
                  )}
                </DetailCard>

                <DetailCard title={ux('staff_information')} icon="IdCard">
                  <Info label={ux('staff_id')} value={singleUser.staff_id} />
                  <Info label={ux('unique_ref')} value={singleUser.unique_ref} />
                  <Info label={ux('department')} value={singleUser.department} />
                  <Info label={ux('job_title')} value={singleUser.job_title_display || singleUser.job_title} />
                  <Info label={ux('staff_type')} value={['Local','Expatriate'].includes(singleUser.staff_type) ? ux(singleUser.staff_type.toLowerCase()) : singleUser.staff_type} />
                  <Info label={ux('location')} value={singleUser.location} />
                  <Info label={ux('date_joined')} value={formatDate(singleUser.date_of_joining, {}, i18n.language)} />
                </DetailCard>

                <DetailCard title={ux('audit')} icon="History">
                  <Info label={ux('created_at')} value={formatDateTime(singleUser.created_at, {}, i18n.language)} />
                  <Info label={ux('last_login')} value={formatDateTime(singleUser.last_login_at, {}, i18n.language)} />
                </DetailCard>
              </div>
            </motion.section>
          )}

          {confirmIdentityStatus && (
            <div className={`usr-modal-backdrop usr-bulk-backdrop theme-${theme}`}>
              <section className="usr-modal usr-bulk-modal" role="alertdialog" aria-modal="true" aria-labelledby="usr-identity-status-title" ref={identityDialogRef}>
                <div className="usr-modal-head"><h3 id="usr-identity-status-title">{ux('identity_status_confirm_title')}</h3></div>
                <div className="usr-modal-body"><p>{ux('identity_status_confirm_message')}</p></div>
                <div className="usr-modal-actions">
                  <button type="button" className="usr-btn usr-btn--ghost" disabled={savingIdentityStatus} onClick={() => setConfirmIdentityStatus(false)}>{ux('cancel')}</button>
                  <button type="button" className="usr-btn usr-btn--primary" disabled={savingIdentityStatus} onClick={updateIdentityStatus}>{ux('identity_status_action')}</button>
                </div>
              </section>
            </div>
          )}

          {!fetchingSingle && singleUserError && (
            <div className="usr-empty-state">
              <div className="usr-empty-icon"><AppIcon icon="TriangleAlert" /></div>
              <h3>{ux('failed_to_load_user')}</h3>
              <p>{singleUserError}</p>
              <Link to="/users/home" className="usr-btn usr-btn--primary">{ux('back_to_users')}</Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const DetailCard = ({ title, icon, children }) => (
  <div className="usr-detail-card">
    <h3><AppIcon icon={icon} /> {title}</h3>
    <div>{children}</div>
  </div>
);

const Info = ({ label, value }) => (
  <div className="usr-info-row">
    <span>{label}</span>
    <strong>{value || '—'}</strong>
  </div>
);

const ViewSkeleton = () => (
  <div className="usr-form-card usr-skeleton-card">
    <div className="usr-skeleton usr-skeleton--title" />
    <div className="usr-skeleton-grid">
      {Array.from({ length: 8 }).map((_, index) => <div className="usr-skeleton" key={index} />)}
    </div>
  </div>
);

export default ViewUser;
