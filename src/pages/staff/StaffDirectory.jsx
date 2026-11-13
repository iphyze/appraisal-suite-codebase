import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import '../../styles/app-i18n-users.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import api from '../../services/api';
import ModuleShell from '../common/ModuleShell';
import AppIcon from '../../components/ui/AppIcon';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const LIMITS = [10, 20, 50, 100, 200].map((value) => ({ value }));
const TYPE_OPTIONS = ['', 'Local', 'Expatriate'].map((value) => ({ value }));

const StaffDirectory = () => {
  useTranslation('users');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, total: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        appraisee_only: '1',
        sortBy: 'first_name',
        sortOrder: 'ASC',
      });
      if (searchQuery) params.append('search', searchQuery);
      if (type) params.append('staff_type', type);
      const response = await api.get(`/users/list?${params.toString()}`);
      setRows(response.data?.data || []);
      setMeta(response.data?.meta || { page: 1, total_pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, type]);

  useEffect(() => { document.title = `Appraisal Portal | ${ux('employee_directory')}`; }, [i18n.language]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const limitsOptions = LIMITS.map((item) => ({ ...item, label: ux('rows', { count: item.value }) }));
  const typeOptions = TYPE_OPTIONS.map((item) => ({ ...item, label: item.value ? ux(item.value.toLowerCase()) : ux('all_employee_types') }));
  const stats = useMemo(() => ({
    total: meta.total || 0,
    local: rows.filter((row) => row.staff_type === 'Local').length,
    expatriate: rows.filter((row) => row.staff_type === 'Expatriate').length,
  }), [rows, meta]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const handleSearchInputChange = (event) => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    if (nextValue === '' && searchQuery) {
      clearSearch();
    }
  };

  return (
    <ModuleShell className="mod-page--people-i18n">
      <PageNav pageTitle={ux('employee_directory')} links={[{ label: ux('dashboard'), to: '/dashboard', active: true }, { label: ux('employee_directory') }]} />
      <section className="mod-hero">
        <div>
          <p className="mod-eyebrow">{ux('people')}</p>
          <h2>{ux('directory_heading')}</h2>
          <p>{ux('directory_description')}</p>
        </div>
        <Link className="mod-btn mod-btn--primary" to="/users/create-user"><AppIcon icon="UserPlus" /> {ux('create_user')}</Link>
      </section>
      <section className="mod-stats">
        <div className="mod-stat"><span><AppIcon icon="Users" /></span><div><strong>{new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(stats.total)}</strong><small>{ux('eligible_employees')}</small></div></div>
        <div className="mod-stat"><span><AppIcon icon="MapPin" /></span><div><strong>{new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(stats.local)}</strong><small>{ux('visible_local')}</small></div></div>
        <div className="mod-stat"><span><AppIcon icon="Globe" /></span><div><strong>{new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(stats.expatriate)}</strong><small>{ux('visible_expat')}</small></div></div>
        <div className="mod-stat"><span><AppIcon icon="List" /></span><div><strong>{new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(rows.length)}</strong><small>{ux('current_page')}</small></div></div>
      </section>
      <section className="mod-card">
        <div className="mod-toolbar">
          <form className="mod-search" onSubmit={submitSearch}>
            <AppIcon icon="Search" />
            <input name="staff_directory_search" autoComplete="on" value={searchInput} onChange={handleSearchInputChange} placeholder={ux('directory_search')} />
            {searchInput && <button type="button" className="mod-search__clear" onClick={clearSearch} aria-label={ux('clear_search')}><AppIcon icon="X" /></button>}
            <button type="submit">{ux('search')}</button>
          </form>
          <AppSelect value={limit} onChange={(value) => { setLimit(Number(value)); setPage(1); }} options={limitsOptions} clearable={false} icon="List" />
        </div>
        <div className="mod-filter-grid">
          <AppSelect label={ux('employee_type')} value={type} onChange={(value) => { setType(value); setPage(1); }} options={typeOptions} clearable icon="IdCard" />
        </div>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr><th>{ux('employee')}</th><th>{ux('role')}</th><th>{ux('department')}</th><th>{ux('job_title')}</th><th>{ux('type')}</th><th>{ux('company')}</th><th>{ux('action')}</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.first_name} {row.last_name}</strong><small>{row.email || row.staff_id || ux('no_email')}</small></td>
                  <td><span className="mod-pill">{['super_admin','admin','supervisor','staff'].includes(row.role) ? ux(row.role) : (String(row.role || '').replaceAll('_', ' ') || '—')}</span></td>
                  <td>{row.department || '—'}</td>
                  <td>{row.job_title_display || row.job_title || '—'}</td>
                  <td>{['Local', 'Expatriate'].includes(row.staff_type) ? ux(row.staff_type.toLowerCase()) : (row.staff_type || '—')}</td>
                  <td>{row.company_name || '—'}</td>
                  <td><div className="mod-row-actions"><Link to={`/users/view/${row.id}`} aria-label={ux('view_employee')}><AppIcon icon="Eye" /></Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="mod-empty"><AppIcon icon="LoaderCircle" className="mod-icon-spin" /><h3>{ux('loading')}</h3></div>}
        {!loading && rows.length === 0 && <div className="mod-empty"><AppIcon icon="UserX" /><h3>{ux('no_employees')}</h3><p>{ux('no_employees_help')}</p></div>}
        <div className="mod-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{ux('previous')}</button>
          <button type="button" className="active">{new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-GB').format(page)}</button>
          <button type="button" disabled={page >= Number(meta.total_pages || 1)} onClick={() => setPage((value) => value + 1)}>{ux('next')}</button>
        </div>
      </section>
    </ModuleShell>
  );
};

export default StaffDirectory;
