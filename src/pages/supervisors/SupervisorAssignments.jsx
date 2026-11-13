import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, formatPercentage, localeCollator } from '../../utils/format';
import { displayAppraisalStatus } from '../appraisals/helpers';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useSupervisorAssignmentsStore from '../../stores/useSupervisorAssignmentsStore';
import './SupervisorAssignments.css';
import AppIcon from '../../components/ui/AppIcon';

// The backend filter values stay unchanged when the language changes.
const STAFF_TYPE_OPTIONS = ['', 'Local', 'Expatriate'].map((value) => ({ value }));
const ASSIGNMENT_STATUS_OPTIONS = ['all', 'assigned', 'unassigned', 'other'].map((value) => ({ value }));
const LIMIT_OPTIONS = [10, 20, 50, 100].map((value) => ({ value }));
const sx = (key, options) => i18n.t(`sup_${key}`, { ns: 'users', ...options });
const fmtNumber = (value) => formatNumber(Number(value || 0));
const fmtPct = (value) => { const number = Number(value || 0); return formatPercentage(number / 100, number % 1 === 0 ? 0 : 1); };
const staffTypeLabel = (value) => value === 'Local' ? sx('local') : value === 'Expatriate' ? sx('expatriate') : value;

const getInitials = (user) => {
  const first = user?.first_name?.[0] || '';
  const last = user?.last_name?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'S';
};

const getPaginationPages = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [];
  pages.push(1);

  if (currentPage > 4) pages.push('left-ellipsis');

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 3) pages.push('right-ellipsis');

  pages.push(totalPages);

  return pages;
};

const StatCard = ({ label, value, icon }) => (
  <motion.div className="sup-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <span className="sup-stat-icon"><AppIcon icon={icon} /></span>
    <div>
      <strong>{fmtNumber(value)}</strong>
      <span>{label}</span>
    </div>
  </motion.div>
);

const EmptyPickState = ({ hasCycles, hasSupervisors }) => (
  <div className="sup-empty-state sup-empty-state--table">
    <div className="sup-empty-icon"><AppIcon icon="ArrowRightLeft" /></div>
    <h3>{sx('choose_cycle_supervisor')}</h3>
    <p>
      {!hasCycles
        ? sx('no_cycles_description')
        : !hasSupervisors
          ? sx('no_active_supervisors')
          : sx('select_cycle_supervisor_description')}
    </p>
  </div>
);

const TableSkeleton = () => (
  Array.from({ length: 6 }).map((_, index) => (
    <tr key={`sk-${index}`}>
      <td colSpan="8"><div className="sup-row-skeleton" /></td>
    </tr>
  ))
);

const ConfirmDialog = ({ title, message, count, confirmLabel, loading, icon = 'TriangleAlert', danger = false, onCancel, onConfirm }) => (
  <motion.div
    className="sup-modal-backdrop"
    initial={false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onCancel?.();
    }}
  >
    <motion.div
      className="sup-modal"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="sup-modal-head">
        <div className="sup-modal-heading">
          <div className={`sup-modal-icon ${danger ? 'sup-modal-icon--danger' : ''}`}><AppIcon icon={icon} /></div>
          <div><span>{sx('confirmation')}</span><h3>{title}</h3></div>
        </div>
        <button type="button" className="sup-modal-close" onClick={onCancel} disabled={loading} aria-label={sx('close_confirmation')}><AppIcon icon="X" /></button>
      </div>
      <div className="sup-modal-body">
        <p>{message}</p>
        {count > 0 && <p className="sup-modal-count"><Trans ns="users" i18nKey="sup_selected_employees" values={{ count, countDisplay: fmtNumber(count) }} components={{ countValue: <strong /> }} /></p>}
      </div>
      <div className="sup-modal-actions">
        <button type="button" className="sup-btn sup-btn--ghost" onClick={onCancel} disabled={loading}>{sx('cancel')}</button>
        <button type="button" className={danger ? 'sup-btn sup-btn--danger' : 'sup-btn sup-btn--primary'} onClick={onConfirm} disabled={loading}>
          {loading ? <><span className="sup-spinner" /> {sx('processing')}</> : confirmLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const SupervisorSummary = ({ supervisor, meta }) => {
  if (!supervisor) return null;

  const stats = meta?.supervisor || {};
  const cycle = meta?.cycle;

  /* ── FIX: prefer meta.assigned_count when meta.supervisor is absent ── */
  const assignedCount = stats.total_subordinates ?? stats.assigned_count ?? meta?.assigned_count ?? supervisor.total_subordinates ?? supervisor.assigned_count ?? 0;
  const progressValue = stats.progress_percent ?? meta?.progress_percent ?? supervisor.progress_percent ?? 0;
  const isOnboarded = stats.is_onboarded ?? supervisor.is_onboarded ?? false;

  return (
    <section className="sup-profile-card">
      <div className="sup-profile-left">
        <span className="sup-profile-avatar">{getInitials(supervisor)}</span>
        <div>
          <p className="sup-eyebrow">{sx('selected_supervisor')}</p>
          <h3>{supervisor.first_name} {supervisor.last_name}</h3>
          <p>{supervisor.department || sx('no_department')} • {supervisor.job_title_display || supervisor.job_title || sx('supervisor')}</p>
        </div>
      </div>

      <div className="sup-profile-metrics">
        <span><AppIcon icon="CalendarCheck" /> {cycle ? `${cycle.title} (${cycle.year})` : sx('no_cycle')}</span>
        <span><AppIcon icon="Users" /> {sx('assigned')} <strong>{fmtNumber(assignedCount)}</strong></span>
        <span><AppIcon icon="ClipboardCheck" /> {sx('progress')} <strong>{fmtPct(progressValue)}</strong></span>
        <span className={isOnboarded ? 'sup-onboard sup-onboard--yes' : 'sup-onboard sup-onboard--no'}>
          <AppIcon icon="UserCheck" /> {isOnboarded ? sx('onboarded') : sx('not_onboarded')}
        </span>
      </div>
    </section>
  );
};

const SupervisorAssignments = () => {
  useTranslation('users');
  const { user } = useAuthStore();
  const { cycleId: portalCycleId, setCycleId: setPortalCycleId } = usePortalContextStore();
  const [nav, setNav] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [searchParams] = useSearchParams();
  const { theme } = useThemeStore();

  const {
    cycles,
    supervisors,
    departments,
    staff,
    meta,
    loading,
    lookupLoading,
    actionLoading,
    error,
    selectedItems,
    currentPage,
    itemsPerPage,
    searchQuery,
    cycleId,
    supervisorId,
    departmentFilter,
    staffTypeFilter,
    assignmentStatus,
    sortBy,
    sortOrder,
    fetchCycles,
    fetchSupervisors,
    fetchDepartments,
    fetchAssignmentStaff,
    assignStaff,
    unassignStaff,
    setCycleId,
    setSupervisorId,
    setSearchQuery,
    setDepartmentFilter,
    setStaffTypeFilter,
    setAssignmentStatus,
    setItemsPerPage,
    setCurrentPage,
    setSorting,
    toggleItemSelection,
    setSelectedItems,
    clearSelection,
    clearFilters,
  } = useSupervisorAssignmentsStore();

  const requestedSupervisorId = searchParams.get('supervisor_id') || '';
  const totalPages = meta?.total_pages || 1;
  const total = meta?.total || 0;
  const paginationPages = useMemo(() => getPaginationPages(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => { document.title = `Appraisal Portal | ${sx('assignments_page')}`; }, [i18n.language]);

  // Cycle titles and department names are translated by the server: reload on language change.
  useEffect(() => { fetchCycles(); }, [fetchCycles, i18n.resolvedLanguage]);

  useEffect(() => {
    setSearchInput(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    if (!cycleId && cycles.length > 0) {
      const scopedCycle = user?.role === 'super_admin' && portalCycleId
        ? cycles.find((cycle) => String(cycle.id) === String(portalCycleId))
        : null;
      const activeCycle = scopedCycle || cycles.find((cycle) => Number(cycle.is_active) === 1) || cycles[0];
      setCycleId(activeCycle.id);
    }
  }, [cycleId, cycles, portalCycleId, setCycleId, user?.role]);

  useEffect(() => {
    if (!cycleId) return;
    fetchSupervisors(cycleId);
  }, [cycleId, fetchSupervisors]);

  useEffect(() => {
    if (!cycleId) return;

    const selectedCycle = cycles.find((cycle) => String(cycle.id) === String(cycleId));
    fetchDepartments(selectedCycle?.company_id || '');
  }, [cycleId, cycles, fetchDepartments, i18n.resolvedLanguage]);

  useEffect(() => {
    if (!supervisorId && supervisors.length > 0) {
      const fromQuery = requestedSupervisorId && supervisors.find((sup) => String(sup.id) === String(requestedSupervisorId));
      if (fromQuery) setSupervisorId(fromQuery.id);
    }
  }, [requestedSupervisorId, supervisorId, supervisors, setSupervisorId]);

  useEffect(() => {
    fetchAssignmentStaff();
  }, [
    fetchAssignmentStaff,
    cycleId,
    supervisorId,
    currentPage,
    itemsPerPage,
    searchQuery,
    departmentFilter,
    staffTypeFilter,
    assignmentStatus,
    sortBy,
    sortOrder,
  ]);

  const selectedSupervisor = useMemo(
    () => supervisors.find((sup) => String(sup.id) === String(supervisorId)) || null,
    [supervisors, supervisorId]
  );

  const cycleOptions = useMemo(() => cycles.map((cycle) => ({
    value: cycle.id,
    label: `${cycle.title} (${cycle.year})`,
    description: cycle.company_name || cycle.company_code || (Number(cycle.is_active) === 1 ? sx('active_cycle') : ''),
  })), [cycles, i18n.language]);

  const supervisorOptions = useMemo(() => [
    { value: '', label: sx('all_supervisors'), description: sx('view_all_assigned') },
    ...supervisors.map((supervisor) => ({
      value: supervisor.id,
      label: `${supervisor.first_name || ''} ${supervisor.last_name || ''}`.trim() || supervisor.email,
      description: sx('supervisor_assigned', { role: supervisor.role_name === 'admin' ? sx('administrator_supervisor') : (supervisor.department || sx('supervisor')), count: Number(supervisor.total_subordinates ?? supervisor.assigned_count ?? 0), countDisplay: fmtNumber(supervisor.total_subordinates ?? supervisor.assigned_count ?? 0) }),
    })),
  ], [supervisors, i18n.language]);

  const departmentOptions = useMemo(() => {
    const values = new Map();

    const labels = new Map();
    departments.forEach((department) => {
      const name = String(department?.name || '').trim();
      if (name) {
        values.set(name.toLowerCase(), name);
        labels.set(name.toLowerCase(), String(department?.name_display || name));
      }
    });

    // Keep the filter useful even when a legacy staff department has not yet
    // been added to the departments master table.
    staff.forEach((item) => {
      const name = String(item?.department || '').trim();
      if (name && !values.has(name.toLowerCase())) values.set(name.toLowerCase(), name);
    });

    return [
      { value: '', label: sx('all_departments') },
      ...[...values.values()]
        // Filter by the stored (English) name; show the translated name when there is one.
        .map((department) => ({ value: department, label: labels.get(department.toLowerCase()) || department }))
        .sort((a, b) => localeCollator(i18n.language).compare(a.label, b.label)),
    ];
  }, [departments, staff, i18n.language]);

  const stats = useMemo(() => [
    { label: sx('visible_employees'), value: total, icon: 'Users' },
    { label: sx('assigned_here'), value: meta?.assigned_count || 0, icon: 'UserCheck' },
    { label: sx('unassigned'), value: meta?.unassigned_count || 0, icon: 'UserPlus' },
    { label: sx('already_appraised'), value: meta?.appraised_count || 0, icon: 'ClipboardCheck' },
  ], [meta, total, i18n.language]);

  const selectedRows = useMemo(
    () => staff.filter((item) => selectedItems.includes(Number(item.id))),
    [staff, selectedItems]
  );

  const assignableSelectedIds = selectedRows
    .filter((item) => Number(item.assigned_to_current) !== 1 && Number(item.assigned_to_other) !== 1)
    .map((item) => item.id);

  const removableSelectedIds = selectedRows
    .filter((item) => Number(item.assigned_to_current) === 1)
    .map((item) => item.id);

  const allCurrentSelected = staff.length > 0 && staff.every((item) => selectedItems.includes(Number(item.id)));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedItems(selectedItems.filter((id) => !staff.some((item) => Number(item.id) === Number(id))));
    } else {
      setSelectedItems(Array.from(new Set([...selectedItems, ...staff.map((item) => Number(item.id))])));
    }
  };

  const submitSearch = (event) => {
    event?.preventDefault?.();
    setCurrentPage(1);
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setCurrentPage(1);
    if (searchQuery) setSearchQuery('');
  };

  const handleSearchInputChange = (event) => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    if (nextValue === '' && searchQuery) {
      clearSearch();
    }
  };

  const runConfirmAction = async () => {
    if (confirmAction === 'bulkAssign') {
      const result = await assignStaff(assignableSelectedIds);
      if (result.success) setConfirmAction(null);
      return;
    }

    if (confirmAction === 'bulkRemove') {
      const result = await unassignStaff(removableSelectedIds);
      if (result.success) setConfirmAction(null);
      return;
    }

    if (confirmAction?.type === 'assign') {
      const result = await assignStaff([confirmAction.staffId]);
      if (result.success) setConfirmAction(null);
      return;
    }

    if (confirmAction?.type === 'remove') {
      const result = await unassignStaff([confirmAction.staffId]);
      if (result.success) setConfirmAction(null);
    }
  };

  const sortIcon = (field) => {
    if (sortBy !== field) return 'ArrowUpDown';
    return sortOrder === 'ASC' ? 'ArrowUp' : 'ArrowDown';
  };

  const canLoadTable = Boolean(cycleId);

  const getActionModal = () => {
    if (confirmAction === 'bulkAssign') {
      return {
        title: sx('assign_selected_question'),
        message: sx('bulk_assign_message', { count: assignableSelectedIds.length, countDisplay: fmtNumber(assignableSelectedIds.length), supervisor: selectedSupervisor?.first_name || sx('this_supervisor') }),
        count: assignableSelectedIds.length,
        confirmLabel: sx('assign_employees'),
        danger: false,
      };
    }

    if (confirmAction === 'bulkRemove') {
      return {
        title: sx('remove_selected_question'),
        message: sx('bulk_remove_message', { count: removableSelectedIds.length, countDisplay: fmtNumber(removableSelectedIds.length), supervisor: selectedSupervisor?.first_name || sx('this_supervisor') }),
        count: removableSelectedIds.length,
        confirmLabel: sx('remove_employees'),
        danger: true,
      };
    }

    if (confirmAction?.type === 'assign') {
      return {
        title: sx('assign_employee_question'),
        message: sx('single_assign_message', { name: confirmAction.name, supervisor: selectedSupervisor?.first_name || sx('this_supervisor') }),
        count: 1,
        confirmLabel: sx('assign_employees'),
        danger: false,
      };
    }

    if (confirmAction?.type === 'remove') {
      return {
        title: sx('remove_employee_question'),
        message: sx('single_remove_message', { name: confirmAction.name, supervisor: selectedSupervisor?.first_name || sx('this_supervisor') }),
        count: 1,
        confirmLabel: sx('remove_employees'),
        danger: true,
      };
    }

    return null;
  };

  const actionModal = getActionModal();
  const staffTypeOptions = STAFF_TYPE_OPTIONS.map(({ value }) => ({ value, label: value ? staffTypeLabel(value) : sx('all_employee_types') }));
  const assignmentStatusOptions = ASSIGNMENT_STATUS_OPTIONS.map(({ value }) => ({ value, label: value === 'all' ? sx('all_employees') : value === 'assigned' ? sx('assigned_here') : value === 'unassigned' ? sx('unassigned') : sx('assigned_elsewhere') }));
  const limitOptions = LIMIT_OPTIONS.map(({ value }) => ({ value, label: sx('rows', { count: value }) }));

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`sup-page theme-${theme}`}>
          <PageNav
            pageTitle={sx('assignments_page')}
            links={[
              { label: sx('dashboard'), to: '/dashboard', active: true },
              { label: sx('assignments_page'), to: '/supervisors/assignments', active: false },
            ]}
          />

          <section className="sup-hero">
            <div>
              <p className="sup-eyebrow">{sx('assignment_management')}</p>
              <h2>{sx('assignments_headline')}</h2>
              <p>{sx('assignments_description')}</p>
            </div>
            <Link to="/users/create-user" className="sup-btn sup-btn--primary sup-hero-create-btn">
              <AppIcon icon="PlusCircle" /> {sx('create_user')}
            </Link>
          </section>

          <section className="sup-stat-grid">
            {stats.map((item) => <StatCard key={item.label} {...item} />)}
          </section>

          <SupervisorSummary supervisor={selectedSupervisor} meta={meta} />

          {!supervisorId && cycleId && (
            <div className="sup-inline-note"><AppIcon icon="Info" /> {sx('viewing_all_supervisors')}</div>
          )}

          <section className="sup-card">
            <div className="sup-toolbar">
              <form className={`sup-search ${searchInput ? 'sup-search--has-value' : ''}`} onSubmit={submitSearch}>
                <AppIcon icon="Search" />
                <input
                  type="text"
                  name="supervisor_assignments_search"
                  autoComplete="on"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  placeholder={sx('assignments_search')}
                  spellCheck="false"
                />
                {searchInput && (
                  <button
                    type="button"
                    className="sup-search-clear"
                    onClick={clearSearch}
                    aria-label={sx('clear_search')}
                    title={sx('clear_search')}
                  >
                    <AppIcon icon="X" />
                  </button>
                )}
                <button type="submit" className="sup-search-submit">{sx('search')}</button>
              </form>

              <div className="sup-filter-grid sup-filter-grid--top">
                <AppSelect
                  value={itemsPerPage}
                  onChange={(value) => setItemsPerPage(value)}
                  options={limitOptions}
                  placeholder={sx('rows', { count: itemsPerPage })}
                  clearable={false}
                  icon="List"
                />
              </div>
            </div>

            <div className="sup-filter-bar">
              <AppSelect
                value={cycleId}
                onChange={(value) => { setCycleId(value); if (user?.role === 'super_admin') setPortalCycleId(value || ''); }}
                options={cycleOptions}
                placeholder={lookupLoading ? sx('loading_cycles') : sx('select_appraisal_cycle')}
                searchable
                clearable
                icon="CalendarCheck"
              />

              <AppSelect
                value={supervisorId}
                onChange={(value) => setSupervisorId(value)}
                options={supervisorOptions}
                placeholder={cycleId ? sx('all_supervisors') : sx('select_cycle_first')}
                searchable
                clearable
                icon="UserCheck"
              />

              <AppSelect
                value={departmentFilter}
                onChange={(value) => setDepartmentFilter(value)}
                options={departmentOptions}
                placeholder={sx('all_departments')}
                searchable
                clearable
                icon="Building2"
              />

              <AppSelect
                value={staffTypeFilter}
                onChange={(value) => setStaffTypeFilter(value)}
                options={staffTypeOptions}
                placeholder={sx('all_employee_types')}
                clearable
                icon="IdCard"
              />

              <AppSelect
                value={assignmentStatus}
                onChange={(value) => setAssignmentStatus(value)}
                options={assignmentStatusOptions}
                placeholder={sx('all_employees')}
                clearable
                icon="UserCheck"
              />
            </div>

            <div className="sup-table-actions">
              <span>{sx('records_found', { count: Number(total), countDisplay: fmtNumber(total) })}</span>
              <div className="sup-table-action-buttons">
                {(searchQuery || departmentFilter || staffTypeFilter || assignmentStatus !== 'all') && (
                  <button type="button" className="sup-btn sup-btn--ghost sup-btn--compact" onClick={() => { setSearchInput(''); clearFilters(); }}>
                    <AppIcon icon="FilterX" /> {sx('clear_filters')}
                  </button>
                )}
                {selectedItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="sup-btn sup-btn--primary sup-btn--compact"
                      onClick={() => setConfirmAction('bulkAssign')}
                      disabled={!supervisorId || assignableSelectedIds.length === 0 || actionLoading}
                    >
                      <AppIcon icon="UserPlus" /> {sx('assign_selected', { count: assignableSelectedIds.length })}
                    </button>
                    <button
                      type="button"
                      className="sup-btn sup-btn--danger sup-btn--compact"
                      onClick={() => setConfirmAction('bulkRemove')}
                      disabled={!supervisorId || removableSelectedIds.length === 0 || actionLoading}
                    >
                      <AppIcon icon="UserMinus" /> {sx('remove_selected', { count: removableSelectedIds.length })}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="sup-table-wrap">
              <table className="sup-table">
                <thead>
                  <tr>
                    <th className="sup-check-cell">
                      <input type="checkbox" aria-label={sx('select_all_page')} checked={allCurrentSelected} onChange={toggleSelectAll} disabled={!staff.length || loading} />
                    </th>
                    <th onClick={() => setSorting('first_name')}>{sx('employee')} <AppIcon icon={sortIcon('first_name')} /></th>
                    <th onClick={() => setSorting('department')}>{sx('department')} <AppIcon icon={sortIcon('department')} /></th>
                    <th>{sx('employee_type')}</th>
                    <th>{sx('assignment')}</th>
                    <th>{sx('appraisal')}</th>
                    <th>{sx('status')}</th>
                    <th className="sup-action-th">{sx('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <TableSkeleton />}

                  {!loading && canLoadTable && staff.map((item) => {
                    const assignedHere = Number(item.assigned_to_current) === 1;
                    const assignedOther = Number(item.assigned_to_other) === 1;
                    const appraised = Number(item.is_appraised) === 1;
                    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email;

                    return (
                      <tr key={item.id}>
                        <td className="sup-check-cell">
                          <input
                            type="checkbox"
                            aria-label={sx('select_employee', { name: fullName })}
                            checked={selectedItems.includes(Number(item.id))}
                            onChange={() => toggleItemSelection(item.id)}
                          />
                        </td>
                        <td>
                          <div className="sup-user-cell">
                            <span className="sup-avatar">{getInitials(item)}</span>
                            <div>
                              <strong>{fullName}</strong>
                              <span>{item.email}</span>
                              {item.staff_id && <small>{item.staff_id}</small>}
                            </div>
                          </div>
                        </td>
                        <td>{item.department || '—'}<small>{item.job_title_display || item.job_title || ''}</small></td>
                        <td>{item.staff_type ? <span className={`sup-type sup-type--${String(item.staff_type).toLowerCase()}`}>{staffTypeLabel(item.staff_type)}</span> : <span className="sup-muted">—</span>}</td>
                        <td>
                          {assignedHere ? (
                            <span className="sup-badge sup-badge--assigned">{sx('assigned_here')}</span>
                          ) : assignedOther ? (
                            <>
                              <span className="sup-badge sup-badge--other">{sx('assigned_elsewhere')}</span>
                              <small>{item.other_supervisor_names}</small>
                            </>
                          ) : (
                            <span className="sup-badge sup-badge--unassigned">{sx('unassigned')}</span>
                          )}
                        </td>
                        <td>
                          {appraised ? (
                            <>
                              <span className="sup-status sup-status--done">{sx('appraised')}</span>
                              <small>{item.appraisal_status ? displayAppraisalStatus((key) => i18n.t(key, { ns: 'appraisals' }), item.appraisal_status) : ''}</small>
                            </>
                          ) : (
                            <span className="sup-status sup-status--pending">{sx('pending')}</span>
                          )}
                        </td>
                        <td>{Number(item.is_active) === 1 ? <span className="sup-status sup-status--active">{sx('active')}</span> : <span className="sup-status sup-status--inactive">{sx('inactive')}</span>}</td>
                        <td>
                          <div className="sup-row-actions">
                            {assignedHere ? (
                              <button
                                type="button"
                                className="sup-row-danger"
                                onClick={() => setConfirmAction({ type: 'remove', staffId: item.id, name: fullName })}
                                title={sx('remove_assignment')}
                                disabled={!supervisorId || actionLoading}
                              >
                                <AppIcon icon="UserMinus" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmAction({ type: 'assign', staffId: item.id, name: fullName })}
                                title={assignedOther ? sx('already_assigned_elsewhere') : sx('assign_staff_action')}
                                disabled={!supervisorId || assignedOther || actionLoading}
                              >
                                <AppIcon icon="UserPlus" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!loading && !canLoadTable && (
                <EmptyPickState hasCycles={cycles.length > 0} hasSupervisors={supervisors.length > 0} />
              )}

              {!loading && canLoadTable && !staff.length && (
                <div className="sup-empty-state sup-empty-state--table">
                  <div className="sup-empty-icon"><AppIcon icon="UserX" /></div>
                  <h3>{sx('no_employees')}</h3>
                  <p>{sx('no_employees_description')}</p>
                </div>
              )}
            </div>

            {error && <div className="sup-inline-error"><AppIcon icon="AlertCircle" /> {error}</div>}

            <div className="sup-pagination" aria-label={sx('assignments_pagination')}>
              <button
                type="button"
                className="sup-page-btn sup-page-btn--edge"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <AppIcon icon="ChevronLeft" /> {sx('prev')}
              </button>

              <div className="sup-page-list">
                {paginationPages.map((page) => (
                  typeof page === 'string' ? (
                    <span key={page} className="sup-page-ellipsis">…</span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      className={`sup-page-btn sup-page-btn--number ${page === currentPage ? 'sup-page-btn--active' : ''}`}
                      disabled={loading || page === currentPage}
                      onClick={() => setCurrentPage(page)}
                      aria-current={page === currentPage ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>

              <button
                type="button"
                className="sup-page-btn sup-page-btn--edge"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                {sx('next')} <AppIcon icon="ChevronRight" />
              </button>
            </div>
          </section>
        </main>
      </div>

      <AnimatePresence>
        {actionModal && (
          <ConfirmDialog
            {...actionModal}
            loading={actionLoading}
            onCancel={() => setConfirmAction(null)}
            onConfirm={runConfirmAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupervisorAssignments;