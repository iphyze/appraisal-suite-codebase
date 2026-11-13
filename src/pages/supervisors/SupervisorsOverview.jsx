import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, formatPercentage, localeCollator } from '../../utils/format';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useThemeStore from '../../stores/useThemeStore';
import useSupervisorsStore from '../../stores/useSupervisorsStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import './Supervisors.css';
import AppIcon from '../../components/ui/AppIcon';
import ResetOnboardingDialog from './ResetOnboardingDialog';
import useToastStore from '../../stores/useToastStore';
import api from '../../services/api';

// Only display labels are translated; these values are used by the existing API.
const STAFF_TYPE_OPTIONS = ['', 'Local', 'Expatriate'].map((value) => ({ value }));
const ACTIVE_OPTIONS = ['', '1', '0'].map((value) => ({ value }));
const ONBOARDING_OPTIONS = ['', 'onboarded', 'not_onboarded'].map((value) => ({ value }));
const LIMIT_OPTIONS = [10, 20, 50, 100].map((value) => ({ value }));
const sx = (key, options) => i18n.t(`sup_${key}`, { ns: 'users', ...options });
const fmtNumber = (value) => formatNumber(Number(value || 0));
const fmtPct = (value) => {
  const number = Number(value || 0);
  return formatPercentage(number / 100, number % 1 === 0 ? 0 : 1);
};
const staffTypeLabel = (value) => value === 'Local' ? sx('local') : value === 'Expatriate' ? sx('expatriate') : value;

const getInitials = (user) => {
  const first = user?.first_name?.[0] || '';
  const last = user?.last_name?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'S';
};

const fullName = (user) => `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.fullname || user?.email || sx('supervisor');

const makePages = (current, total) => {
  const pages = [];
  const safeTotal = Math.max(Number(total || 1), 1);
  const safeCurrent = Math.min(Math.max(Number(current || 1), 1), safeTotal);

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  pages.push(1);

  if (safeCurrent > 4) pages.push('start-ellipsis');

  const start = Math.max(2, safeCurrent - 1);
  const end = Math.min(safeTotal - 1, safeCurrent + 1);

  for (let page = start; page <= end; page += 1) pages.push(page);

  if (safeCurrent < safeTotal - 3) pages.push('end-ellipsis');

  pages.push(safeTotal);

  return pages;
};

const StatCard = ({ icon, label, value, note }) => (
  <motion.div className="supv-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <span className="supv-stat-icon"><AppIcon icon={icon} /></span>
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </div>
  </motion.div>
);

const SupervisorsOverview = () => {
  useTranslation('users');
  const [nav, setNav] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToastStore();
  const { theme } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const { cycleId: portalCycleId, setCycleId: setPortalCycleId } = usePortalContextStore();
  const navigate = useNavigate();

  const {
    supervisors,
    cycles,
    meta,
    loading,
    error,
    currentPage,
    itemsPerPage,
    searchQuery,
    cycleId,
    departmentFilter,
    staffTypeFilter,
    activeFilter,
    onboardingFilter,
    sortBy,
    sortOrder,
    fetchCycles,
    fetchSupervisors,
    setSearchQuery,
    setCycleId,
    setDepartmentFilter,
    setStaffTypeFilter,
    setActiveFilter,
    setOnboardingFilter,
    setCurrentPage,
    setItemsPerPage,
    setSorting,
    clearFilters,
    resetOnboarding,
    resettingOnboarding,
  } = useSupervisorsStore();

  const { isViewOnly } = useCompanyWritePermission();
  const canManageUsers = ['super_admin', 'admin'].includes(currentUser?.role) && !isViewOnly;
  const totalPages = meta?.total_pages || 1;
  const total = meta?.total || 0;

  useEffect(() => {
    document.title = `Appraisal Portal | ${sx('supervisors')}`;
  }, [i18n.language]);

  // Cycle titles are translated by the server: reload them when the language changes.
  useEffect(() => { fetchCycles(); }, [fetchCycles, i18n.resolvedLanguage]);

  useEffect(() => {
    setSearchInput(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    if (currentUser?.role === 'super_admin' && portalCycleId && !cycleId && cycles.some((cycle) => String(cycle.id) === String(portalCycleId))) {
      setCycleId(portalCycleId);
    }
  }, [currentUser?.role, portalCycleId, cycleId, cycles, setCycleId]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors, currentPage, itemsPerPage, searchQuery, cycleId, departmentFilter, staffTypeFilter, activeFilter, onboardingFilter, sortBy, sortOrder]);

  const cycleOptions = useMemo(() => [
    { value: '', label: sx('all_cycles') },
    ...cycles.map((cycle) => ({
      value: cycle.id,
      label: `${cycle.title} (${cycle.year})`,
      description: cycle.is_active ? sx('active_cycle') : cycle.company_name || cycle.company_code,
    })),
  ], [cycles, i18n.language]);

  const selectedCycle = useMemo(() => cycles.find((cycle) => String(cycle.id) === String(cycleId)) || null, [cycles, cycleId]);

  const confirmResetOnboarding = async () => {
    if (!resetTarget || !selectedCycle) return;

    const result = await resetOnboarding({ supervisorId: resetTarget.id, cycleId: selectedCycle.id });
    if (result.success) {
      setResetTarget(null);
    }
  };

  const downloadSupervisorsExcel = async () => {
    if (exporting) return;
    if (!cycleId) {
      showToast(sx('select_cycle_before_export'), 'error');
      return;
    }

    setExporting(true);
    try {
      const response = await api.get('/exports/supervisors/excel', {
        params: { cycle_id: cycleId },
        responseType: 'blob',
      });
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
      const filename = match?.[1]
        ? decodeURIComponent(match[1].trim().replace(/"/g, ''))
        : `Supervisor_Assignments_${selectedCycle?.year || cycleId}.xlsx`;
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showToast(sx('export_success'), 'success');
    } catch (error) {
      let message = sx('export_error');
      if (error.response?.data instanceof Blob) {
        try {
          const result = JSON.parse(await error.response.data.text());
          message = result.message || message;
        } catch (_) { /* Keep the default error message. */ }
      } else {
        message = error.response?.data?.message || error.message || message;
      }
      showToast(message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const departmentOptions = useMemo(() => {
    const apiDepartments = Array.isArray(meta?.filter_options?.departments)
      ? meta.filter_options.departments
      : [];

    const values = new Map();
    apiDepartments.forEach((item) => {
      const name = String(item || '').trim();
      if (name) values.set(name.toLowerCase(), name);
    });

    // Current-page fallback keeps this compatible if the frontend is deployed
    // briefly against an older API version during rollout.
    supervisors.forEach((item) => {
      const name = String(item?.department || '').trim();
      if (name && !values.has(name.toLowerCase())) values.set(name.toLowerCase(), name);
    });

    return [
      { value: '', label: sx('all_departments') },
      ...[...values.values()]
        .sort(localeCollator(i18n.language).compare)
        .map((name) => ({ value: name, label: name })),
    ];
  }, [meta?.filter_options?.departments, supervisors, i18n.language]);

  const submitSearch = (event) => {
    event?.preventDefault?.();
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setCurrentPage(1);
    setSearchQuery('');
  };

  const handleSearchInputChange = (event) => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    if (nextValue === '' && searchQuery) {
      clearSearch();
    }
  };

  const sortIcon = (field) => {
    if (sortBy !== field) return 'ArrowUpDown';
    return sortOrder === 'ASC' ? 'ArrowUp' : 'ArrowDown';
  };

  const hasFilters = searchQuery || departmentFilter || staffTypeFilter || activeFilter !== '1' || onboardingFilter;
  const pages = makePages(currentPage, totalPages);
  const staffTypeOptions = STAFF_TYPE_OPTIONS.map(({ value }) => ({ value, label: value ? staffTypeLabel(value) : sx('all_staff_types') }));
  const activeOptions = ACTIVE_OPTIONS.map(({ value }) => ({ value, label: value === '1' ? sx('active') : value === '0' ? sx('inactive') : sx('all_status') }));
  const onboardingOptions = ONBOARDING_OPTIONS.map(({ value }) => ({ value, label: value === 'onboarded' ? sx('onboarded') : value === 'not_onboarded' ? sx('not_onboarded') : sx('all_onboarding') }));
  const limitOptions = LIMIT_OPTIONS.map(({ value }) => ({ value, label: sx('rows', { count: value }) }));

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`supv-page theme-${theme}`}>
          <PageNav
            pageTitle={sx('supervisors')}
            links={[
              { label: sx('dashboard'), to: '/dashboard', active: true },
              { label: sx('supervisors'), to: '/supervisors', active: false },
            ]}
          />

          <section className="supv-hero">
            <div>
              <p className="supv-eyebrow">{sx('supervisor_management')}</p>
              <h2>{sx('supervisors_headline')}</h2>
              <p>{sx('supervisors_description')}</p>
            </div>
            <div className="supv-hero-actions">
                <button type="button" className="supv-btn supv-btn--ghost" onClick={downloadSupervisorsExcel} disabled={exporting} title={!cycleId ? sx('select_cycle_to_export') : sx('download_cycle_assignments', { cycle: selectedCycle?.title || sx('selected_cycle') })}>
                  <AppIcon icon={exporting ? 'LoaderCircle' : 'FileSpreadsheet'} /> {exporting ? sx('exporting') : sx('export_excel')}
                </button>
                {canManageUsers && <Link to="/supervisors/assignments" className="supv-btn supv-btn--ghost">
                  <AppIcon icon="ArrowRightLeft" /> {sx('assign_staff')}
                </Link>}
                {canManageUsers && <Link to="/users/create-user" className="supv-btn supv-btn--primary">
                  <AppIcon icon="PlusCircle" /> {sx('create_user')}
                </Link>}
            </div>
          </section>

          <section className="supv-stat-grid">
            <StatCard icon="UserCheck" label={sx('supervisors')} value={fmtNumber(meta.total_appraisers ?? total)} />
            <StatCard icon="UserCheck" label={sx('onboarded')} value={fmtNumber(meta.onboarded_count)} note={cycleId ? sx('selected_cycle') : sx('all_visible')} />
            <StatCard icon="Users" label={sx('assigned_employees')} value={fmtNumber(meta.assigned_count)} />
            <StatCard icon="BarChart3" label={sx('progress')} value={fmtPct(meta.progress_percent)} note={sx('appraised_count', { count: Number(meta.appraised_count || 0), countDisplay: fmtNumber(meta.appraised_count) })} />
          </section>

          <section className="supv-card">
            <div className="supv-toolbar">
              <form className="supv-search" onSubmit={submitSearch}>
                <AppIcon icon="Search" />
                <input
                  name="supervisors_search"
                  autoComplete="on"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  placeholder={sx('supervisors_search')}
                />
                {searchInput && (
                  <button type="button" className="supv-search-clear" onClick={clearSearch} aria-label={sx('clear_search')}>
                    <AppIcon icon="X" />
                  </button>
                )}
                <button type="submit">{sx('search')}</button>
              </form>

              <div className="supv-filter-grid">
                <AppSelect value={cycleId} onChange={(value) => { setCycleId(value); if (currentUser?.role === 'super_admin') setPortalCycleId(value || ''); }} options={cycleOptions} placeholder={sx('all_cycles')} clearable={false} searchable icon="CalendarCheck" />
                <AppSelect value={itemsPerPage} onChange={(value) => setItemsPerPage(value)} options={limitOptions} placeholder={sx('rows', { count: itemsPerPage })} clearable={false} icon="List" />
              </div>
            </div>

            <div className="supv-filter-row">
              <AppSelect value={departmentFilter} onChange={(value) => setDepartmentFilter(value)} options={departmentOptions} placeholder={sx('all_departments')} clearable={false} searchable icon="Building2" />
              <AppSelect value={staffTypeFilter} onChange={(value) => setStaffTypeFilter(value)} options={staffTypeOptions} placeholder={sx('all_staff_types')} clearable={false} icon="UserCheck" />
              <AppSelect value={activeFilter} onChange={(value) => setActiveFilter(value)} options={activeOptions} placeholder={sx('status')} clearable={false} icon="ToggleRight" />
              <AppSelect value={onboardingFilter} onChange={(value) => setOnboardingFilter(value)} options={onboardingOptions} placeholder={sx('onboarding')} clearable={false} icon="UserCheck" />
            </div>

            <div className="supv-table-actions">
              <span>{sx('records_found', { count: Number(total), countDisplay: fmtNumber(total) })}</span>
              <div>
                {hasFilters && <button type="button" className="supv-link-btn" onClick={() => { setSearchInput(''); clearFilters(); }}>{sx('clear_filters')}</button>}
              </div>
            </div>

            <div className="supv-table-wrap">
              <table className="supv-table">
                <thead>
                  <tr>
                    <th onClick={() => setSorting('first_name')}>{sx('supervisor')} <AppIcon icon={sortIcon('first_name')} /></th>
                    <th onClick={() => setSorting('department')}>{sx('department')} <AppIcon icon={sortIcon('department')} /></th>
                    <th>{sx('staff_type')}</th>
                    <th>{sx('assigned')}</th>
                    <th>{sx('appraised')}</th>
                    <th>{sx('onboarding')}</th>
                    <th>{sx('status')}</th>
                    <th className="supv-action-th">{sx('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`sk-${index}`}>
                      <td colSpan="8"><div className="supv-row-skeleton" /></td>
                    </tr>
                  ))}

                  {!loading && supervisors.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="supv-user-cell">
                          <span className="supv-avatar">{getInitials(item)}</span>
                          <div>
                            <strong>{fullName(item)}</strong>
                            <span>{item.email}</span>
                            {item.staff_id && <small>{item.staff_id}</small>}
                          </div>
                        </div>
                      </td>
                      <td>{item.department || '—'}<small>{item.job_title_display || item.job_title || sx('supervisor')}</small></td>
                      <td>{item.staff_type ? <span className={`supv-type supv-type--${String(item.staff_type).toLowerCase()}`}>{staffTypeLabel(item.staff_type)}</span> : <span className="supv-muted">—</span>}</td>
                      <td><strong>{fmtNumber(item.assigned_count)}</strong><small>{sx('subordinates')}</small></td>
                      <td><strong>{fmtNumber(item.appraised_count)}</strong><small>{fmtPct(item.progress_percent)}</small></td>
                      <td>{Number(item.is_onboarded) === 1 ? <span className="supv-status supv-status--active">{sx('onboarded')}</span> : <span className="supv-status supv-status--pending">{sx('pending')}</span>}</td>
                      <td>{Number(item.is_active) === 1 ? <span className="supv-status supv-status--active">{sx('active')}</span> : <span className="supv-status supv-status--inactive">{sx('inactive')}</span>}</td>
                      <td>
                        <div className="supv-row-actions">
                          <button type="button" title={sx('view_supervisor_action')} onClick={() => navigate(`/supervisors/view/${item.id}${cycleId ? `?cycle_id=${cycleId}` : ''}`)}>
                            <AppIcon icon="Eye" />
                          </button>
                          {canManageUsers && <button type="button" title={sx('edit_user')} onClick={() => navigate(`/users/edit/${item.id}`)}>
                            <AppIcon icon="PenLine" />
                          </button>}
                          {canManageUsers && <button type="button" title={sx('assignments_action')} onClick={() => navigate(`/supervisors/assignments?supervisor_id=${item.id}${cycleId ? `&cycle_id=${cycleId}` : ''}`)}>
                            <AppIcon icon="ArrowRightLeft" />
                          </button>}
                          {canManageUsers && selectedCycle && Number(item.is_onboarded) === 1 && (
                            <button
                              type="button"
                              className="supv-reset-action"
                              title={sx('reset_cycle_action', { cycle: `${selectedCycle.title} (${selectedCycle.year})` })}
                              onClick={() => setResetTarget(item)}
                            >
                              <AppIcon icon="RefreshCw" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && supervisors.length === 0 && (
                <div className="supv-empty-state supv-empty-state--table">
                  <div className="supv-empty-icon"><AppIcon icon="UserCheck" /></div>
                  <h3>{sx('no_supervisors')}</h3>
                  <p>{sx('no_supervisors_description')}</p>
                </div>
              )}
            </div>

            {error && <div className="supv-inline-error"><AppIcon icon="AlertCircle" /> {error}</div>}

            <div className="supv-pagination">
              <span>{sx('page_of', { page: currentPage, total: totalPages })}</span>
              <div className="supv-page-list">
                <button type="button" disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage(currentPage - 1)}>
                  <AppIcon icon="ChevronLeft" /> {sx('prev')}
                </button>
                {pages.map((page) => typeof page === 'number' ? (
                  <button
                    type="button"
                    key={page}
                    className={Number(page) === Number(currentPage) ? 'supv-page-active' : ''}
                    disabled={Number(page) === Number(currentPage) || loading}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ) : <span key={page} className="supv-page-ellipsis">…</span>)}
                <button type="button" disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage(currentPage + 1)}>
                  {sx('next')} <AppIcon icon="ChevronRight" />
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <AnimatePresence>
        {resetTarget && selectedCycle && (
          <ResetOnboardingDialog
            supervisor={resetTarget}
            cycle={selectedCycle}
            loading={resettingOnboarding}
            onCancel={() => !resettingOnboarding && setResetTarget(null)}
            onConfirm={confirmResetOnboarding}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupervisorsOverview;
