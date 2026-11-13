import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useThemeStore from '../../stores/useThemeStore';
import useUsersStore from '../../stores/useUsersStore';
import useToastStore from '../../stores/useToastStore';
import api from '../../services/api';
import './Users.css';
import AppIcon from '../../components/ui/AppIcon';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

// Values are API filters. Display labels are derived at render time in the selected language.
const ROLE_OPTIONS = ['', 'super_admin', 'admin', 'supervisor', 'staff'].map((value) => ({ value }));
const STAFF_TYPE_OPTIONS = ['', 'Local', 'Expatriate'].map((value) => ({ value }));
const STATUS_FILTER_OPTIONS = ['', '1', '0'].map((value) => ({ value }));
const BULK_STATUS_OPTIONS = ['', '1', '0'].map((value) => ({ value }));
const LIMIT_OPTIONS = [10, 20, 50, 100, 150, 200, 250, 500].map((value) => ({ value }));

const roleLabel = (role) => role || '—';

const getInitials = (user) => {
  const first = user?.first_name?.[0] || '';
  const last = user?.last_name?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'U';
};

const getPaginationPages = (currentPage, totalPages) => {
  const pages = [];

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

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

const UsersOverview = () => {
  const [nav, setNav] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [checkingPassword, setCheckingPassword] = useState(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDepartment, setBulkDepartment] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const { theme } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const { showToast } = useToastStore();
  const navigate = useNavigate();
  useTranslation('users');

  const {
    data,
    meta,
    loading,
    error,
    selectedItems,
    currentPage,
    itemsPerPage,
    searchQuery,
    roleFilter,
    staffTypeFilter,
    statusFilter,
    departmentFilter,
    sortBy,
    sortOrder,
    fetchUsers,
    setSearchQuery,
    setRoleFilter,
    setStaffTypeFilter,
    setStatusFilter,
    setDepartmentFilter,
    setCurrentPage,
    setItemsPerPage,
    setSorting,
    clearFilters,
    toggleItemSelection,
    setSelectedItems,
    clearSelection,
    deleteUsers,
    bulkUpdateStaff,
    resetPassword,
  } = useUsersStore();

  const { isViewOnly } = useCompanyWritePermission();
  const canCreate = ['super_admin', 'admin'].includes(currentUser?.role) && !isViewOnly;
  const totalPages = meta?.total_pages || 1;
  const total = meta?.total || 0;
  const paginationPages = useMemo(() => getPaginationPages(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => {
    document.title = `Appraisal Portal | ${ux('users')}`;
  }, [i18n.language]);

  useEffect(() => {
    setSearchInput(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, currentPage, itemsPerPage, searchQuery, roleFilter, staffTypeFilter, statusFilter, departmentFilter, sortBy, sortOrder]);

  useEffect(() => {
    let valid = true;
    api.get('/departments/list?limit=500&page=1&is_active=1&sortBy=name&sortOrder=ASC')
      .then((response) => {
        if (!valid) return;
        // Filter by the stored (English) name; show the translated name when there is one.
        const labels = new Map();
        (response.data?.data || []).forEach((item) => { if (item.name && !labels.has(item.name)) labels.set(item.name, item.name_display || item.name); });
        const collator = new Intl.Collator(i18n.language === 'fr' ? 'fr' : 'en', { sensitivity: 'base' });
        const options = [...labels.entries()].map(([name, label]) => ({ value: name, label })).sort((a, b) => collator.compare(a.label, b.label));
        setDepartmentOptions([{ value: '', label: ux('all_departments') }, ...options]);
      })
      .catch(() => { if (valid) setDepartmentOptions([{ value: '', label: ux('all_departments') }]); });
    return () => { valid = false; };
  }, [viewCompanyId, i18n.language]);

  const stats = useMemo(() => {
    const counts = data.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    return [
      { label: ux('visible_users'), value: total, icon: 'Users' },
      { label: ux('admins'), value: counts.admin || 0, icon: 'ShieldCheck' },
      { label: ux('supervisors'), value: counts.supervisor || 0, icon: 'UserCheck' },
      { label: ux('staff'), value: counts.staff || 0, icon: 'IdCard' },
    ];
  }, [data, total, i18n.language]);

  const translatedRoles = ROLE_OPTIONS.map((entry) => ({ ...entry, label: entry.value ? ux(entry.value) : ux('all_roles') }));
  const translatedTypes = STAFF_TYPE_OPTIONS.map((entry) => ({ ...entry, label: entry.value ? ux(entry.value.toLowerCase()) : ux('all_staff_types') }));
  const translatedStatuses = STATUS_FILTER_OPTIONS.map((entry) => ({ ...entry, label: entry.value === '' ? ux('all_statuses') : ux(entry.value === '1' ? 'active' : 'inactive') }));
  const translatedBulkStatuses = BULK_STATUS_OPTIONS.map((entry) => ({ ...entry, label: entry.value === '' ? ux('keep_status') : ux(entry.value === '1' ? 'active' : 'inactive') }));
  const translatedLimits = LIMIT_OPTIONS.map((entry) => ({ ...entry, label: ux('rows', { count: entry.value }) }));
  const translatedDepartments = departmentOptions.map((entry) => entry.value ? entry : { ...entry, label: ux('all_departments') });
  const allCurrentSelected = data.length > 0 && data.every((user) => selectedItems.includes(user.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedItems(selectedItems.filter((id) => !data.some((user) => user.id === id)));
    } else {
      setSelectedItems(Array.from(new Set([...selectedItems, ...data.map((user) => user.id)])));
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

  useEffect(() => {
    if (!bulkOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event) => {
      if (event.key === 'Escape' && !bulkSaving) setBulkOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
    };
  }, [bulkOpen, bulkSaving]);

  const runBulkUpdate = async () => {
    if (bulkSaving || (!bulkDepartment && bulkStatus === '')) return;
    setBulkSaving(true);
    const payload = { ids: selectedItems.map(Number) };
    if (bulkDepartment) payload.department = bulkDepartment;
    if (bulkStatus !== '') payload.is_active = Number(bulkStatus);
    const result = await bulkUpdateStaff(payload);
    setBulkSaving(false);
    if (result.success) {
      setBulkOpen(false);
      setBulkDepartment('');
      setBulkStatus('');
    }
  };

  const runDelete = async () => {
    const ids = confirmDelete === 'bulk' ? selectedItems : [confirmDelete];
    const result = await deleteUsers(ids);
    if (result.success) {
      setConfirmDelete(null);
      clearSelection();
    }
  };

  const handleResetPassword = async (targetUser) => {
    if (checkingPassword !== null) return;
    setCheckingPassword(targetUser.id);
    try {
      const response = await api.get('/users/password-workspaces', {
        params: { user_id: targetUser.id },
      });
      setResetTarget({
        ...targetUser,
        passwordCompanies: response.data?.data?.company_names || [],
      });
    } catch (error) {
      const message = error?.response?.data?.code === 'IDENTITY_RESET_DENIED'
        ? ux('reset_denied_company', { company: error.response.data?.company_name || '' })
        : error?.response?.data?.code === 'IDENTITY_RESET_ADMIN_PROTECTED'
          ? ux('reset_admin_protected')
          : error?.response?.data?.code === 'IDENTITY_RESET_SELF'
            ? ux('reset_yourself') : ux('reset_company_fetch_error');
      showToast(message, 'error');
    } finally {
      setCheckingPassword(null);
    }
  };

  const confirmResetPassword = async () => {
    if (!resetTarget || resetSubmitting) return;
    setResetSubmitting(true);
    try {
      const result = await resetPassword(resetTarget.id);
      if (result.success) {
        setResetResult({ user: resetTarget, password: result.defaultPassword });
        setResetTarget(null);
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  const downloadUsersExcel = async () => {
    if (exportingUsers) return;

    setExportingUsers(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (roleFilter) params.set('role', roleFilter);
      if (staffTypeFilter) params.set('staff_type', staffTypeFilter);
      if (statusFilter !== '') params.set('is_active', statusFilter);
      if (departmentFilter) params.set('department', departmentFilter);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);

      const response = await api.get(`/exports/users/excel?${params.toString()}`, {
        responseType: 'blob',
      });

      const disposition = response.headers?.['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      const filename = filenameMatch?.[1]
        ? decodeURIComponent(filenameMatch[1].replace(/"/g, '').trim())
        : `Users_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);

      showToast(ux('download_success'), 'success');
    } catch (error) {
      let message = ux('download_error');

      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed?.message || message;
        } catch (_) {
          // Keep the fallback message when a binary error cannot be parsed.
        }
      } else {
        message = error.response?.data?.message || error.message || message;
      }

      showToast(message, 'error');
    } finally {
      setExportingUsers(false);
    }
  };

  const sortIcon = (field) => {
    if (sortBy !== field) return 'ArrowUpDown';
    return sortOrder === 'ASC' ? 'ArrowUp' : 'ArrowDown';
  };

  return (
    <div className={`main-container theme-${theme}`}>
      <Header setNav={setNav} nav={nav} />
      <NavBar setNav={setNav} nav={nav} />

      <div className={`content-container theme-${theme}`}>
        <main className={`usr-page theme-${theme}`}>
          <PageNav
            pageTitle={ux('users')}
            links={[
              { label: ux('dashboard'), to: '/dashboard', active: true },
              { label: ux('users'), to: '/users/home', active: false },
            ]}
          />

          <section className="usr-hero">
            <div>
              <p className="usr-eyebrow">{ux('access_management')}</p>
              <h2>{ux('list_headline')}</h2>
              <p>{ux('list_summary')}</p>
            </div>
            {['admin', 'super_admin'].includes(currentUser?.role) && (
              <div className="usr-hero-actions">
                <button
                  type="button"
                  className="usr-btn usr-btn--ghost usr-btn--export"
                  onClick={downloadUsersExcel}
                  disabled={exportingUsers}
                >
                  {exportingUsers ? (
                    <>
                      <span className="usr-btn-spinner" />
                      {ux('exporting')}
                    </>
                  ) : (
                    <>
                      <AppIcon icon="FileSpreadsheet" />
                      {ux('download_excel')}
                    </>
                  )}
                </button>

                {canCreate && <Link to="/users/create-user" className="usr-btn usr-btn--primary">
                  <AppIcon icon="PlusCircle" />
                  {ux('create_user')}
                </Link>}
              </div>
            )}
          </section>

          <section className="usr-stat-grid">
            {stats.map((item) => (
              <motion.div className="usr-stat-card" key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <span className="usr-stat-icon"><AppIcon icon={item.icon} /></span>
                <div>
                  <strong>{new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(item.value)}</strong>
                  <span>{item.label}</span>
                </div>
              </motion.div>
            ))}
          </section>

          <section className="usr-card">
            <div className="usr-toolbar">
              <form className={`usr-search ${searchInput ? 'usr-search--has-value' : ''}`} onSubmit={submitSearch}>
                <AppIcon icon="Search" />
                <input
                  type="text"
                  name="users_search"
                  autoComplete="on"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  placeholder={ux('search_users')}
                  spellCheck="false"
                />
                {searchInput && (
                  <button
                    type="button"
                    className="usr-search-clear"
                    onClick={clearSearch}
                    aria-label={ux('clear_search')}
                    title={ux('clear_search')}
                  >
                    <AppIcon icon="X" />
                  </button>
                )}
                <button type="submit" className="usr-search-submit">{ux('search')}</button>
              </form>

              <div className="usr-filter-grid">
                <AppSelect
                  value={roleFilter}
                  onChange={(value) => setRoleFilter(value)}
                  options={translatedRoles}
                  placeholder={ux('all_roles')}
                  clearable={false}
                />
                <AppSelect
                  value={staffTypeFilter}
                  onChange={(value) => setStaffTypeFilter(value)}
                  options={translatedTypes}
                  placeholder={ux('all_staff_types')}
                  clearable={false}
                />
                <AppSelect
                  value={departmentFilter}
                  onChange={setDepartmentFilter}
                  options={translatedDepartments.length ? translatedDepartments : [{ value: '', label: ux('all_departments') }]}
                  placeholder={ux('all_departments')}
                  searchable
                  clearable={false}
                />
                <AppSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={translatedStatuses}
                  placeholder={ux('all_statuses')}
                  clearable={false}
                />
                <AppSelect
                  value={itemsPerPage}
                  onChange={(value) => setItemsPerPage(value)}
                  options={translatedLimits}
                  placeholder={ux('page_limit')}
                  clearable={false}
                />
              </div>
            </div>

            <div className="usr-table-actions">
              <span>{ux('records_found', { count: total })}</span>
              <div>
                {(searchQuery || roleFilter || staffTypeFilter || departmentFilter || statusFilter !== '') && (
                  <button type="button" className="usr-link-btn" onClick={() => { setSearchInput(''); clearFilters(); }}>{ux('clear_filters')}</button>
                )}
                {canCreate && selectedItems.length > 0 && (
                  <button type="button" className="usr-btn usr-btn--ghost" onClick={() => setBulkOpen(true)}>
                    <AppIcon icon="ListChecks" /> {ux('bulk_update_staff', { count: selectedItems.length })}
                  </button>
                )}
                {canCreate && selectedItems.length > 0 && (
                  <button type="button" className="usr-danger-btn" onClick={() => setConfirmDelete('bulk')}>
                    <AppIcon icon="Trash2" />
                    {ux('delete_selected', { count: selectedItems.length })}
                  </button>
                )}
              </div>
            </div>

            <div className="usr-table-wrap">
              <table className="usr-table">
                <thead>
                  <tr>
                    <th className="usr-check-cell">
                      <input type="checkbox" aria-label={ux('select_page')} checked={allCurrentSelected} onChange={toggleSelectAll} />
                    </th>
                    <th onClick={() => setSorting('first_name')}>{ux('user_singular')} <AppIcon icon={sortIcon('first_name')} /></th>
                    <th onClick={() => setSorting('role')}>{ux('role')} <AppIcon icon={sortIcon('role')} /></th>
                    <th>{ux('department')}</th>
                    <th>{ux('staff_type')}</th>
                    <th>{ux('company')}</th>
                    <th>{ux('status')}</th>
                    <th className="usr-action-th">{ux('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <TableSkeleton />}

                  {!loading && data.map((user) => (
                    <tr key={user.id}>
                      <td className="usr-check-cell">
                        <input type="checkbox" aria-label={ux('select_user', { name: `${user.first_name} ${user.last_name}`.trim() })} checked={selectedItems.includes(user.id)} onChange={() => toggleItemSelection(user.id)} />
                      </td>
                      <td>
                        <div className="usr-user-cell">
                          <span className="usr-avatar">{getInitials(user)}</span>
                          <div>
                            <strong>{user.first_name} {user.last_name}</strong>
                            <span>{user.email}</span>
                            {user.also_in_companies?.length > 0 && (
                              <span className="usr-also-in">{ux('identity_also_in', { companies: user.also_in_companies.join(', ') })}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td>{user.department || '—'}<small>{user.job_title_display || user.job_title || ''}</small></td>
                      <td>{getTypeBadge(user.staff_type)}</td>
                      <td>{user.company_name || '—'}<small>{user.company_code || ''}</small></td>
                      <td>{getStatusBadge(user.is_active)}</td>
                      <td>
                        <div className="usr-row-actions">
                          <button type="button" onClick={() => navigate(`/users/view/${user.id}`)} title={ux('view')}><AppIcon icon="Eye" /></button>
                          {canCreate && <button type="button" onClick={() => navigate(`/users/edit/${user.id}`)} title={ux('edit')}><AppIcon icon="PenLine" /></button>}
                          {canCreate
                            && user.id !== currentUser?.id
                            && currentUser?.role === 'super_admin' && (
                            <button type="button" disabled={checkingPassword !== null} onClick={() => handleResetPassword(user)} title={ux('reset_password')} aria-label={checkingPassword === user.id ? ux('reset_loading_companies') : ux('reset_password')}><AppIcon icon="KeyRound" /></button>
                          )}
                          {canCreate && <button type="button" className="usr-row-danger" onClick={() => setConfirmDelete(user.id)} title={ux('delete')}><AppIcon icon="Trash2" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && !data.length && (
                <div className="usr-empty-state usr-empty-state--table">
                  <div className="usr-empty-icon"><AppIcon icon="UserX" /></div>
                  <h3>{ux('no_users')}</h3>
                  <p>{ux('no_users_help')}</p>
                </div>
              )}
            </div>

            {error && <div className="usr-inline-error"><AppIcon icon="AlertCircle" /> {error}</div>}

            <div className="usr-pagination" aria-label={ux('pagination')}>
              <button
                type="button"
                className="usr-page-btn usr-page-btn--edge"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <AppIcon icon="ChevronLeft" /> {ux('previous')}
              </button>

              <div className="usr-page-list">
                {paginationPages.map((page) => (
                  typeof page === 'string' ? (
                    <span key={page} className="usr-page-ellipsis">…</span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      className={`usr-page-btn usr-page-btn--number ${page === currentPage ? 'usr-page-btn--active' : ''}`}
                      disabled={loading || page === currentPage}
                      onClick={() => setCurrentPage(page)}
                      aria-current={page === currentPage ? 'page' : undefined}
                    >
                      {new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(page)}
                    </button>
                  )
                ))}
              </div>

              <button
                type="button"
                className="usr-page-btn usr-page-btn--edge"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                {ux('next')} <AppIcon icon="ChevronRight" />
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* Portal must sit outside AnimatePresence: Framer Motion filters portal children. */}
      {bulkOpen && typeof document !== 'undefined' && createPortal(
          <div className={`usr-modal-backdrop usr-bulk-backdrop theme-${theme}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !bulkSaving) setBulkOpen(false); }}>
            <div className="usr-modal usr-bulk-modal" role="dialog" aria-modal="true" aria-labelledby="usr-bulk-title">
              <div className="usr-modal-head">
                <div className="usr-modal-heading">
                  <span className="usr-modal-icon"><AppIcon icon="ListChecks" /></span>
                  <div><span>{ux('staff_administration')}</span><h3 id="usr-bulk-title">{ux('bulk_headline')}</h3></div>
                </div>
                <button type="button" className="usr-modal-close" onClick={() => setBulkOpen(false)} disabled={bulkSaving} autoFocus aria-label={ux('close_bulk')}><AppIcon icon="X" /></button>
              </div>
              <div className="usr-modal-body">
                <p>{ux('bulk_description', { count: selectedItems.length })}</p>
                <div className="usr-bulk-fields">
                  <AppSelect label={ux('department')} value={bulkDepartment} onChange={setBulkDepartment}
                    options={[{ value: '', label: ux('keep_department') }, ...translatedDepartments.filter((option) => option.value)]}
                    placeholder={ux('keep_department')} searchable clearable={false} />
                  <AppSelect label={ux('account_status')} value={bulkStatus} onChange={setBulkStatus}
                    options={translatedBulkStatuses} placeholder={ux('keep_status')} clearable={false} />
                </div>
                <p className="usr-bulk-hint">{ux('bulk_hint')}</p>
              </div>
              <div className="usr-modal-actions">
                <button type="button" className="usr-btn usr-btn--ghost" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>{ux('cancel')}</button>
                <button type="button" className="usr-btn usr-btn--primary" onClick={runBulkUpdate}
                  disabled={bulkSaving || selectedItems.length > 200 || (!bulkDepartment && bulkStatus === '')}>
                  {bulkSaving ? ux('bulk_working') : ux('bulk_submit', { count: selectedItems.length })}
                </button>
              </div>
            </div>
          </div>, document.body
      )}

      <AnimatePresence>
        {resetTarget && (
          <ResetPasswordDialog
            user={resetTarget}
            onCancel={() => setResetTarget(null)}
            onConfirm={confirmResetPassword}
            submitting={resetSubmitting}
          />
        )}
        {resetResult && (
          <ResetResultDialog result={resetResult} onClose={() => setResetResult(null)} />
        )}
        {confirmDelete && (
          <DeleteDialog
            count={confirmDelete === 'bulk' ? selectedItems.length : 1}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={runDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const getRoleBadge = (role) => <span className={`usr-badge usr-badge--${role || 'neutral'}`}>{['super_admin', 'admin', 'supervisor', 'staff'].includes(role) ? ux(role) : roleLabel(role)}</span>;
const getTypeBadge = (type) => type ? <span className={`usr-type usr-type--${type.toLowerCase()}`}>{['Local', 'Expatriate'].includes(type) ? ux(type.toLowerCase()) : type}</span> : <span className="usr-muted">—</span>;
const getStatusBadge = (status) => Number(status) === 1 ? <span className="usr-status usr-status--active">{ux('active')}</span> : <span className="usr-status usr-status--inactive">{ux('inactive')}</span>;

const TableSkeleton = () => (
  Array.from({ length: 5 }).map((_, index) => (
    <tr key={`sk-${index}`}>
      <td colSpan="8"><div className="usr-row-skeleton" /></td>
    </tr>
  ))
);

const ResetPasswordDialog = ({ user, onCancel, onConfirm, submitting = false }) => (
  <motion.div
    className="usr-modal-backdrop"
    initial={false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel?.();
    }}
  >
    <motion.div className="usr-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
      <div className="usr-modal-head">
        <div className="usr-modal-heading">
          <div className="usr-modal-icon"><AppIcon icon="KeyRound" /></div>
          <div><span>{ux('password_management')}</span><h3>{ux('reset_question')}</h3></div>
        </div>
        <button type="button" className="usr-modal-close" onClick={onCancel} aria-label={ux('close_reset')}><AppIcon icon="X" /></button>
      </div>
      <div className="usr-modal-body">
        <p><Trans ns="users" i18nKey="reset_help" values={{ name: `${user.first_name} ${user.last_name}`, password: `Lambert@${new Date().getFullYear()}` }} components={{ name: <strong />, password: <strong /> }} /></p>
        {user.passwordCompanies?.length > 1 && (
          <p className="usr-password-companies">{ux('shared_password_companies', { companies: user.passwordCompanies.join(', ') })}</p>
        )}
      </div>
      <div className="usr-modal-actions">
        <button type="button" className="usr-btn usr-btn--ghost" disabled={submitting} onClick={onCancel}>{ux('cancel')}</button>
        <button type="button" className="usr-btn usr-btn--primary" disabled={submitting} onClick={onConfirm}>{ux('reset_submit')}</button>
      </div>
    </motion.div>
  </motion.div>
);

const ResetResultDialog = ({ result, onClose }) => (
  <motion.div
    className="usr-modal-backdrop"
    initial={false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}
  >
    <motion.div className="usr-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
      <div className="usr-modal-head">
        <div className="usr-modal-heading">
          <div className="usr-modal-icon"><AppIcon icon="KeyRound" /></div>
          <div><span>{ux('password_management')}</span><h3>{ux('reset_complete')}</h3></div>
        </div>
        <button type="button" className="usr-modal-close" onClick={onClose} aria-label={ux('reset_result_close')}><AppIcon icon="X" /></button>
      </div>
      <div className="usr-modal-body">
        <p>{ux('reset_result', { name: `${result.user.first_name} ${result.user.last_name}` })}</p>
        <div className="usr-reset-password-box">{result.password}</div>
      </div>
      <div className="usr-modal-actions">
        <button type="button" className="usr-btn usr-btn--primary" onClick={onClose}>{ux('done')}</button>
      </div>
    </motion.div>
  </motion.div>
);

const DeleteDialog = ({ count, onCancel, onConfirm }) => (
  <motion.div
    className="usr-modal-backdrop"
    initial={false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel?.();
    }}
  >
    <motion.div className="usr-modal usr-delete-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
      <div className="usr-modal-head">
        <div className="usr-modal-heading">
          <div className="usr-modal-icon"><AppIcon icon="TriangleAlert" /></div>
          <div><span>{ux('confirmation')}</span><h3>{ux('delete_question', { count })}</h3></div>
        </div>
        <button type="button" className="usr-modal-close" onClick={onCancel} aria-label={ux('close_delete')}><AppIcon icon="X" /></button>
      </div>
      <div className="usr-modal-body">
        <p>{ux('delete_explanation', { count })}</p>
      </div>
      <div className="usr-modal-actions">
        <button type="button" className="usr-btn usr-btn--ghost" onClick={onCancel}>{ux('cancel')}</button>
        <button type="button" className="usr-btn usr-btn--danger" onClick={onConfirm}>{ux('delete')}</button>
      </div>
    </motion.div>
  </motion.div>
);

export default UsersOverview;
