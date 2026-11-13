import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, Search, ShieldCheck, X } from 'lucide-react';
import PageNav from '../../components/PageNav';
import api from '../../services/api';
import { formatDateTime, formatNumber } from '../../utils/format';
import {
  AUDIT_ACTION_KEYS, AUDIT_TARGET_KEYS, displayAuditIdentifier,
} from '../../utils/auditPresentation';
import ModuleShell from '../common/ModuleShell';
import './AuditLog.css';

const AuditLog = () => {
  const { t, i18n } = useTranslation('settings');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (searchQuery) params.append('search', searchQuery);
      const response = await api.get(`/audit-log/list?${params.toString()}`);
      setRows(response.data?.data || []);
      setMeta(response.data?.meta || { page: 1, total_pages: 1, total: 0 });
    } catch {
      // Do not present an API failure as a genuinely empty audit history.
      setError(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => { document.title = t('audit_document_title'); }, [t]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

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
    if (nextValue === '' && searchQuery) clearSearch();
  };

  const locale = i18n.language;
  const actionLabel = (value) => displayAuditIdentifier(value, AUDIT_ACTION_KEYS, t, locale);
  const targetLabel = (value) => displayAuditIdentifier(value, AUDIT_TARGET_KEYS, t, locale);

  return (
    <ModuleShell className="audit-log">
      <PageNav
        pageTitle={t('audit_title')}
        links={[{ label: t('audit_dashboard'), to: '/dashboard', active: true }, { label: t('audit_title') }]}
      />
      <section className="mod-hero">
        <div>
          <p className="mod-eyebrow">{t('audit_security')}</p>
          <h2>{t('audit_heading')}</h2>
          <p>{t('audit_description')}</p>
        </div>
      </section>
      <section className="mod-card">
        <div className="mod-toolbar">
          <form className="mod-search" onSubmit={submitSearch} role="search">
            <Search size={16} aria-hidden="true" />
            <input
              name="audit_log_search" autoComplete="on"
              value={searchInput} onChange={handleSearchInputChange}
              aria-label={t('audit_search_placeholder')}
              placeholder={t('audit_search_placeholder')}
            />
            {searchInput && (
              <button type="button" className="mod-search__clear" onClick={clearSearch} aria-label={t('audit_clear_search')}>
                <X size={15} aria-hidden="true" />
              </button>
            )}
            <button type="submit">{t('audit_search')}</button>
          </form>
        </div>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr>
              <th scope="col">{t('audit_date')}</th>
              <th scope="col">{t('audit_user')}</th>
              <th scope="col">{t('audit_action')}</th>
              <th scope="col">{t('audit_target')}</th>
              <th scope="col">{t('audit_entry_description')}</th>
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.created_at ? formatDateTime(row.created_at, {}, locale) : '—'}</td>
                  <td>{row.user_name || t('audit_system')}<small>{row.user_email || row.company_name || ''}</small></td>
                  <td><span className="mod-pill" title={row.action}>{actionLabel(row.action)}</span></td>
                  <td><span title={row.target_table || undefined}>{targetLabel(row.target_table) || '—'}</span><small>{row.target_id || ''}</small></td>
                  <td>{row.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="mod-empty" role="status">
            <LoaderCircle className="mod-icon-spin" size={22} aria-hidden="true" />
            <h3>{t('audit_loading')}</h3>
          </div>
        )}
        {!loading && error && (
          <div className="mod-empty" role="alert">
            <ShieldCheck size={22} aria-hidden="true" />
            <h3>{t('audit_failed')}</h3>
            <p>{t('audit_failed_description')}</p>
            <button type="button" className="mod-btn mod-btn--ghost" onClick={fetchRows}>{t('audit_retry')}</button>
          </div>
        )}
        {!loading && !error && !rows.length && (
          <div className="mod-empty">
            <ShieldCheck size={22} aria-hidden="true" />
            <h3>{t('audit_no_entries')}</h3>
            <p>{t('audit_empty_hint')}</p>
          </div>
        )}
        <div className="mod-pagination" aria-label={t('audit_pagination')}>
          <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
            {t('audit_prev')}
          </button>
          <button type="button" className="active" disabled aria-current="page" aria-label={t('audit_current_page', { page })}>
            {formatNumber(page, {}, locale)}
          </button>
          <button type="button" disabled={loading || page >= Number(meta.total_pages || 1)} onClick={() => setPage((value) => value + 1)}>
            {t('audit_next')}
          </button>
        </div>
      </section>
    </ModuleShell>
  );
};

export default AuditLog;
