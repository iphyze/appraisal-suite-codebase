import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, formatPercentage } from '../../utils/format';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useSupervisorsStore from '../../stores/useSupervisorsStore';
import './Supervisors.css';
import AppIcon from '../../components/ui/AppIcon';
import ResetOnboardingDialog from './ResetOnboardingDialog';

const sx = (key, options) => i18n.t(`sup_${key}`, { ns: 'users', ...options });
const fmtNumber = (value) => formatNumber(Number(value || 0));
const fmtPct = (value) => { const number = Number(value || 0); return formatPercentage(number / 100, number % 1 === 0 ? 0 : 1); };
const staffTypeLabel = (value) => value === 'Local' ? sx('local') : value === 'Expatriate' ? sx('expatriate') : value;
const dash = (value) => value === null || value === undefined || value === '' ? '—' : value;

const getInitials = (user) => `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'S';
const fullName = (user) => `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.fullname || user?.email || sx('supervisor');

const DetailItem = ({ label, value, icon }) => (
  <div className="supv-detail-item">
    <span><AppIcon icon={icon} /> {label}</span>
    <strong>{dash(value)}</strong>
  </div>
);

const ViewSupervisor = () => {
  useTranslation('users');
  const { id } = useParams();
  const [params] = useSearchParams();
  const initialCycleId = params.get('cycle_id') || '';
  const [nav, setNav] = useState(false);
  const [showResetOnboarding, setShowResetOnboarding] = useState(false);
  const { theme } = useThemeStore();
  const { user: currentUser } = useAuthStore();

  const {
    supervisor,
    subordinates,
    cycles,
    meta,
    detailLoading,
    error,
    cycleId,
    fetchCycles,
    fetchSupervisor,
    setCycleId,
    resetOnboarding,
    resettingOnboarding,
  } = useSupervisorsStore();

  useEffect(() => { document.title = `Appraisal Portal | ${sx('view_supervisor')}`; }, [i18n.language]);

  useEffect(() => {
    fetchCycles();
    if (initialCycleId) setCycleId(initialCycleId);
    // Cycle titles are translated by the server: reload them when the language changes.
  }, [fetchCycles, initialCycleId, setCycleId, i18n.resolvedLanguage]);

  useEffect(() => {
    fetchSupervisor(id, cycleId || initialCycleId);
  }, [fetchSupervisor, id, cycleId, initialCycleId]);

  const cycleOptions = useMemo(() => [
    { value: '', label: sx('all_cycles') },
    ...cycles.map((cycle) => ({
      value: cycle.id,
      label: `${cycle.title} (${cycle.year})`,
      description: cycle.is_active ? sx('active_cycle') : cycle.company_name || cycle.company_code,
    })),
  ], [cycles, i18n.language]);

  const selectedCycle = useMemo(() => cycles.find((cycle) => String(cycle.id) === String(cycleId || initialCycleId)) || null, [cycles, cycleId, initialCycleId]);
  const { isViewOnly } = useCompanyWritePermission();
  const canManageUsers = ['super_admin', 'admin'].includes(currentUser?.role) && !isViewOnly;

  const confirmResetOnboarding = async () => {
    if (!supervisor || !selectedCycle) return;

    const result = await resetOnboarding({ supervisorId: supervisor.id, cycleId: selectedCycle.id });
    if (result.success) {
      setShowResetOnboarding(false);
    }
  };

  const stats = meta?.supervisor || supervisor || {};

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`supv-page theme-${theme}`}>
          <PageNav
            pageTitle={sx('view_supervisor')}
            links={[
              { label: sx('dashboard'), to: '/dashboard', active: true },
              { label: sx('supervisors'), to: '/supervisors', active: true },
              { label: sx('view_supervisor') },
            ]}
          />

          {detailLoading ? (
            <section className="supv-profile supv-profile--loading">
              <div className="supv-row-skeleton" />
              <div className="supv-row-skeleton" />
              <div className="supv-row-skeleton" />
            </section>
          ) : supervisor ? (
            <>
              <section className="supv-profile">
                <div className="supv-profile-head">
                  <div className="supv-profile-left">
                    <span className="supv-profile-avatar">{getInitials(supervisor)}</span>
                    <div>
                      <p className="supv-eyebrow">{sx('supervisor_profile')}</p>
                      <h2>{fullName(supervisor)}</h2>
                      <p>{supervisor.department || sx('no_department')} • {supervisor.job_title_display || supervisor.job_title || sx('supervisor')}</p>
                    </div>
                  </div>

                  <div className="supv-hero-actions">
                    {canManageUsers && <Link to={`/users/edit/${id}`} className="supv-btn supv-btn--ghost"><AppIcon icon="PenLine" /> {sx('edit_user')}</Link>}
                    {canManageUsers && selectedCycle && Number(stats.is_onboarded) === 1 && (
                      <button type="button" className="supv-btn supv-btn--warning-outline" onClick={() => setShowResetOnboarding(true)}>
                        <AppIcon icon="RefreshCw" /> {sx('reset_onboarding')}
                      </button>
                    )}
                    {canManageUsers && <Link to={`/supervisors/assignments?supervisor_id=${id}${cycleId ? `&cycle_id=${cycleId}` : ''}`} className="supv-btn supv-btn--primary"><AppIcon icon="ArrowRightLeft" /> {sx('manage_assignments')}</Link>}
                  </div>
                </div>

                <div className="supv-profile-filter">
                  <AppSelect value={cycleId} onChange={(value) => setCycleId(value)} options={cycleOptions} placeholder={sx('all_cycles')} clearable={false} searchable icon="CalendarCheck" />
                </div>

                <div className="supv-detail-grid">
                  <DetailItem icon="Mail" label={sx('email')} value={supervisor.email} />
                  <DetailItem icon="IdCard" label={sx('staff_id')} value={supervisor.staff_id || supervisor.unique_ref} />
                  <DetailItem icon="UserCheck" label={sx('staff_type')} value={staffTypeLabel(supervisor.staff_type)} />
                  <DetailItem icon="MapPin" label={sx('location')} value={supervisor.location} />
                </div>
              </section>

              <section className="supv-stat-grid">
                <motion.div className="supv-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="supv-stat-icon"><AppIcon icon="Users" /></span>
                  <div><strong>{fmtNumber(stats.total_subordinates)}</strong><span>{sx('assigned_staff')}</span></div>
                </motion.div>
                <motion.div className="supv-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="supv-stat-icon"><AppIcon icon="ClipboardCheck" /></span>
                  <div><strong>{fmtNumber(stats.appraised_count)}</strong><span>{sx('appraised')}</span></div>
                </motion.div>
                <motion.div className="supv-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="supv-stat-icon"><AppIcon icon="BarChart3" /></span>
                  <div><strong>{fmtPct(stats.progress_percent)}</strong><span>{sx('progress')}</span></div>
                </motion.div>
                <motion.div className="supv-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="supv-stat-icon"><AppIcon icon="UserCheck" /></span>
                  <div><strong>{Number(stats.is_onboarded) === 1 ? sx('yes') : sx('no')}</strong><span>{sx('onboarded')}</span></div>
                </motion.div>
              </section>

              <section className="supv-card">
                <div className="supv-table-actions">
                  <span>{sx('assigned_staff_for_cycle', { cycle: meta?.cycle ? `${meta.cycle.title} (${meta.cycle.year})` : sx('selected_scope') })}</span>
                </div>

                <div className="supv-table-wrap">
                  <table className="supv-table supv-table--compact">
                    <thead>
                      <tr><th>{sx('staff')}</th><th>{sx('department')}</th><th>{sx('staff_type')}</th><th>{sx('appraisal')}</th><th>{sx('status')}</th></tr>
                    </thead>
                    <tbody>
                      {subordinates.map((staff) => (
                        <tr key={staff.id}>
                          <td>
                            <div className="supv-user-cell">
                              <span className="supv-avatar">{getInitials(staff)}</span>
                              <div>
                                <strong>{fullName(staff)}</strong>
                                <span>{staff.email}</span>
                                {staff.staff_id && <small>{staff.staff_id}</small>}
                              </div>
                            </div>
                          </td>
                          <td>{staff.department || '—'}<small>{staff.job_title_display || staff.job_title || sx('staff')}</small></td>
                          <td>{staff.staff_type ? <span className={`supv-type supv-type--${String(staff.staff_type).toLowerCase()}`}>{staffTypeLabel(staff.staff_type)}</span> : '—'}</td>
                          <td>{Number(staff.is_appraised) === 1 ? <span className="supv-status supv-status--active">{sx('appraised')}</span> : <span className="supv-status supv-status--pending">{sx('pending')}</span>}</td>
                          <td>{Number(staff.is_active) === 1 ? <span className="supv-status supv-status--active">{sx('active')}</span> : <span className="supv-status supv-status--inactive">{sx('inactive')}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {subordinates.length === 0 && (
                    <div className="supv-empty-state supv-empty-state--table">
                      <div className="supv-empty-icon"><AppIcon icon="UserX" /></div>
                      <h3>{sx('no_assigned_staff')}</h3>
                      <p>{sx('no_assigned_staff_description')}</p>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="supv-empty-state">
              <div className="supv-empty-icon"><AppIcon icon="TriangleAlert" /></div>
              <h3>{sx('supervisor_not_found')}</h3>
              <p>{error || sx('supervisor_not_found_description')}</p>
              <Link to="/supervisors" className="supv-btn supv-btn--primary">{sx('back_to_supervisors')}</Link>
            </section>
          )}
        </main>
      </div>

      <AnimatePresence>
        {showResetOnboarding && supervisor && selectedCycle && (
          <ResetOnboardingDialog
            supervisor={supervisor}
            cycle={selectedCycle}
            loading={resettingOnboarding}
            onCancel={() => !resettingOnboarding && setShowResetOnboarding(false)}
            onConfirm={confirmResetOnboarding}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ViewSupervisor;
