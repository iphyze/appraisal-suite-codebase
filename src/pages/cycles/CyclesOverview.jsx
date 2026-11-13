import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatNumber } from '../../utils/format';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useThemeStore from '../../stores/useThemeStore';
import useCyclesStore from '../../stores/useCyclesStore';
import './Cycles.css';
import AppIcon from '../../components/ui/AppIcon';

// API-facing filter values stay unchanged; only user-facing option text is translated.
const LIMIT_OPTIONS = [10, 20, 50, 100].map((value) => ({ value }));
const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const STATUS_OPTIONS = [
  { value: '', key: 'all_statuses' },
  { value: 1, key: 'active' },
  { value: 0, key: 'inactive' },
];

const buildYearOptions = (cycles = []) => {
  const currentYear = new Date().getFullYear();
  const cycleYears = cycles
    .map((cycle) => Number(cycle?.year || 0))
    .filter((year) => Number.isFinite(year) && year > 0);

  const highestYear = Math.max(currentYear + 5, ...cycleYears);
  const lowestYear = Math.min(2020, ...cycleYears);
  const years = [];

  for (let year = highestYear; year >= lowestYear; year -= 1) {
    years.push({ value: String(year), label: String(year) });
  }

  return [{ value: '', label: '' }, ...years];
};

const fmtDate = (value, locale) => formatDate(value, {}, locale);

const getPaginationPages = (currentPage, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = [1];
  if (currentPage > 4) pages.push('left-ellipsis');

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let page = start; page <= end; page += 1) pages.push(page);

  if (currentPage < totalPages - 3) pages.push('right-ellipsis');
  pages.push(totalPages);
  return pages;
};

const CyclesOverview = () => {
  const { i18n: language } = useTranslation('cycles');
  const [nav, setNav] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { theme } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();

  const {
    data,
    meta,
    loading,
    deleting,
    error,
    selectedItems,
    currentPage,
    itemsPerPage,
    searchQuery,
    activeFilter,
    yearFilter,
    sortBy,
    sortOrder,
    fetchCycles,
    setSearchQuery,
    setActiveFilter,
    setYearFilter,
    setCurrentPage,
    setItemsPerPage,
    setSorting,
    clearFilters,
    toggleItemSelection,
    setSelectedItems,
    clearSelection,
    deleteCycles,
  } = useCyclesStore();

  const { settingsLocked } = useCompanyWritePermission();
  const canManage = ['super_admin', 'admin'].includes(currentUser?.role) && !settingsLocked;
  const total = meta?.total || 0;
  const totalPages = meta?.total_pages || 1;
  const paginationPages = useMemo(() => getPaginationPages(currentPage, totalPages), [currentPage, totalPages]);
  const yearOptions = useMemo(() => buildYearOptions(data).map((entry) => entry.value === '' ? { ...entry, label: cx('all_years') } : entry), [data, language.language]);
  const statusOptions = STATUS_OPTIONS.map((entry) => ({ value: entry.value, label: cx(entry.key) }));
  const limitOptions = LIMIT_OPTIONS.map((entry) => ({ value: entry.value, label: cx('rows', { count: entry.value }) }));

  useEffect(() => {
    document.title = cx('page_document_title');
  }, [language.language]);

  useEffect(() => {
    setSearchInput(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles, currentPage, itemsPerPage, searchQuery, activeFilter, yearFilter, sortBy, sortOrder, language.language]);

  const stats = useMemo(() => {
    const active = data.filter((cycle) => Number(cycle.is_active) === 1).length;
    const inactive = data.filter((cycle) => Number(cycle.is_active) !== 1).length;
    const latestYear = data.reduce((max, cycle) => Math.max(max, Number(cycle.year || 0)), 0);

    return [
      { key: 'visible_cycles', value: total, icon: 'CalendarDays' },
      { key: 'active', value: active, icon: 'CircleCheck' },
      { key: 'inactive', value: inactive, icon: 'CirclePause' },
      { key: 'latest_year', value: latestYear || '—', icon: 'TrendingUp' },
    ];
  }, [data, total]);

  const allCurrentSelected = data.length > 0 && data.every((cycle) => selectedItems.includes(cycle.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedItems(selectedItems.filter((id) => !data.some((cycle) => cycle.id === id)));
    } else {
      setSelectedItems(Array.from(new Set([...selectedItems, ...data.map((cycle) => cycle.id)])));
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

  const runDelete = async () => {
    const ids = confirmDelete === 'bulk' ? selectedItems : [confirmDelete];
    const result = await deleteCycles(ids);
    if (result.success) {
      setConfirmDelete(null);
      clearSelection();
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
        <main className={`cyc-page theme-${theme}`}>
          <PageNav
            pageTitle={cx('page_title')}
            links={[
              { label: cx('dashboard'), to: '/dashboard', active: true },
              { label: cx('cycles'), to: '/cycles/home', active: false },
            ]}
          />

          <section className="cyc-hero">
            <div>
              <p className="cyc-eyebrow">{cx('setup')}</p>
              <h2>{cx('headline')}</h2>
              <p>{cx('intro')}</p>
            </div>
            <div className="cyc-view-actions">
              {currentUser?.role === 'super_admin' && (
                <Link to="/cycles/copy-questions" className="cyc-btn cyc-btn--ghost">
                  <AppIcon icon="Copy" /> {cx('copy_questions')}
                </Link>
              )}
              {canManage && (
                <Link to="/cycles/create" className="cyc-btn cyc-btn--primary">
                  <AppIcon icon="PlusCircle" /> {cx('create_cycle')}
                </Link>
              )}
            </div>
          </section>

          <section className="cyc-stat-grid">
            {stats.map((item) => (
              <motion.div className="cyc-stat-card" key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <span className="cyc-stat-icon"><AppIcon icon={item.icon} /></span>
                <div>
                  <strong>{typeof item.value === 'number' && item.key !== 'latest_year' ? formatNumber(item.value, {}, language.language) : item.value}</strong>
                  <span>{cx(item.key)}</span>
                </div>
              </motion.div>
            ))}
          </section>

          <section className="cyc-card">
            <div className="cyc-toolbar">
              <form className={`cyc-search ${searchInput ? 'cyc-search--has-value' : ''}`} onSubmit={submitSearch}>
                <AppIcon icon="Search" />
                <input
                  type="text"
                  name="cycles_search"
                  autoComplete="on"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  placeholder={cx('search_hint')}
                  spellCheck="false"
                />
                {searchInput && (
                  <button type="button" className="cyc-search-clear" onClick={clearSearch} aria-label={cx('clear_search')} title={cx('clear_search')}>
                    <AppIcon icon="X" />
                  </button>
                )}
                <button type="submit" className="cyc-search-submit">{cx('search')}</button>
              </form>

              <div className="cyc-filter-grid">
                <AppSelect
                  value={activeFilter}
                  onChange={(value) => setActiveFilter(value)}
                  options={statusOptions}
                  placeholder={cx('all_statuses')}
                  clearable={false}
                />
                <AppSelect
                  value={yearFilter}
                  onChange={(value) => setYearFilter(value)}
                  options={yearOptions}
                  placeholder={cx('all_years')}
                  clearable={false}
                />
                <AppSelect
                  value={itemsPerPage}
                  onChange={(value) => setItemsPerPage(value)}
                  options={limitOptions}
                  placeholder={cx('page_limit')}
                  clearable={false}
                />
              </div>
            </div>

            <div className="cyc-table-actions">
              <span>{cx('records', { count: total })}</span>
              <div>
                {(searchQuery || activeFilter !== '' || yearFilter) && (
                  <button type="button" className="cyc-link-btn" onClick={() => { setSearchInput(''); clearFilters(); }}>{cx('clear_filters')}</button>
                )}
                {selectedItems.length > 0 && canManage && (
                  <button type="button" className="cyc-danger-btn" onClick={() => setConfirmDelete('bulk')}>
                    <AppIcon icon="Trash2" />
                    {cx('delete_selected', { count: selectedItems.length })}
                  </button>
                )}
              </div>
            </div>

            <div className="cyc-table-wrap">
              <table className="cyc-table">
                <thead>
                  <tr>
                    {canManage && (
                      <th className="cyc-check-cell">
                        <input className="cyc-checkbox" type="checkbox" checked={allCurrentSelected} onChange={toggleSelectAll} />
                      </th>
                    )}
                    <th onClick={() => setSorting('year')}>{cx('cycle')} <AppIcon icon={sortIcon('year')} /></th>
                    <th>{cx('company')}</th>
                    <th onClick={() => setSorting('start_date')}>{cx('duration')} <AppIcon icon={sortIcon('start_date')} /></th>
                    <th>{cx('status')}</th>
                    <th className="cyc-action-th">{cx('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <TableSkeleton canManage={canManage} />}

                  {!loading && data.map((cycle) => (
                    <tr key={cycle.id}>
                      {canManage && (
                        <td className="cyc-check-cell">
                          <input className="cyc-checkbox" type="checkbox" checked={selectedItems.includes(cycle.id)} onChange={() => toggleItemSelection(cycle.id)} />
                        </td>
                      )}
                      <td>
                        <div className="cyc-title-cell">
                          <span className="cyc-year-badge">{cycle.year}</span>
                          <div>
                            <strong>{cycle.title}</strong>
                            <span>{cx('created_on', { date: fmtDate(cycle.created_at?.slice?.(0, 10), language.language) })}</span>
                          </div>
                        </div>
                      </td>
                      <td>{cycle.company_name || '—'}<small>{cycle.company_code || ''}</small></td>
                      <td>{fmtDate(cycle.start_date, language.language)} <span className="cyc-muted">{cx('date_to')}</span> {fmtDate(cycle.end_date, language.language)}</td>
                      <td>{getStatusBadge(cycle.is_active)}</td>
                      <td>
                        <div className="cyc-row-actions">
                          <button type="button" onClick={() => navigate(`/cycles/view/${cycle.id}`)} title={cx('view')} aria-label={cx('view')}><AppIcon icon="Eye" /></button>
                          {canManage && <button type="button" onClick={() => navigate(`/cycles/edit/${cycle.id}`)} title={cx('edit')} aria-label={cx('edit')}><AppIcon icon="PenLine" /></button>}
                          {canManage && <button type="button" className="cyc-row-danger" onClick={() => setConfirmDelete(cycle.id)} title={cx('delete')} aria-label={cx('delete')}><AppIcon icon="Trash2" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && !error && !data.length && (
                <div className="cyc-empty-state cyc-empty-state--table">
                  <div className="cyc-empty-icon"><AppIcon icon="CalendarX" /></div>
                  <h3>{cx('no_cycles')}</h3>
                  <p>{cx('no_cycles_hint')}</p>
                </div>
              )}
            </div>

            {error && <div className="cyc-inline-error"><AppIcon icon="AlertCircle" /> {error}</div>}

            <div className="cyc-pagination" aria-label={cx('pagination_label')}>
              <button
                type="button"
                className="cyc-page-btn cyc-page-btn--edge"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <AppIcon icon="ChevronLeft" /> {cx('previous')}
              </button>

              <div className="cyc-page-list">
                {paginationPages.map((page) => (
                  typeof page === 'string' ? (
                    <span key={page} className="cyc-page-ellipsis">…</span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      className={`cyc-page-btn cyc-page-btn--number ${page === currentPage ? 'cyc-page-btn--active' : ''}`}
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
                className="cyc-page-btn cyc-page-btn--edge"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                {cx('next')} <AppIcon icon="ChevronRight" />
              </button>
            </div>
          </section>
        </main>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <DeleteDialog
            count={confirmDelete === 'bulk' ? selectedItems.length : 1}
            deleting={deleting}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={runDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const getStatusBadge = (status) => Number(status) === 1
  ? <span className="cyc-status cyc-status--active">{cx('active')}</span>
  : <span className="cyc-status cyc-status--inactive">{cx('inactive')}</span>;

const TableSkeleton = ({ canManage }) => (
  Array.from({ length: 5 }).map((_, index) => (
    <tr key={`sk-${index}`}>
      <td colSpan={canManage ? 6 : 5}><div className="cyc-row-skeleton" /></td>
    </tr>
  ))
);

const DeleteDialog = ({ count, deleting, onCancel, onConfirm }) => {
  useTranslation('cycles');
  return (
  <motion.div
    className="cyc-modal-backdrop"
    initial={false}
    animate={{ opacity: 1 }}
    exit={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !deleting) onCancel?.();
    }}
  >
    <motion.div className="cyc-modal cyc-delete-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
      <div className="cyc-modal-head">
        <div>
          <p className="cyc-eyebrow">{cx('confirmation')}</p>
          <h3>{cx('delete_title', { count })}</h3>
        </div>
        <button type="button" className="cyc-icon-btn" onClick={onCancel} disabled={deleting} aria-label={cx('close_delete')}><AppIcon icon="X" /></button>
      </div>
      <div className="cyc-modal-body cyc-confirm-body">
        <div className="cyc-modal-icon"><AppIcon icon="TriangleAlert" /></div>
        <p>{cx('delete_warning')}</p>
      </div>
      <div className="cyc-modal-actions">
        <button type="button" className="cyc-btn cyc-btn--ghost" onClick={onCancel} disabled={deleting}>{cx('cancel')}</button>
        <button type="button" className="cyc-btn cyc-btn--danger" onClick={onConfirm} disabled={deleting}>
          {deleting ? <><span className="cyc-btn-spinner" /> {cx('deleting')}</> : cx('delete')}
        </button>
      </div>
    </motion.div>
  </motion.div>
  );
};

export default CyclesOverview;
