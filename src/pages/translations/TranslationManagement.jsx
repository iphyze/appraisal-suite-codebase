import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { Check, CircleAlert, ClipboardCheck, FileDown, FileText, FileUp, Globe2, Languages, PencilLine, RefreshCw, Save, Search, ShieldCheck, X } from 'lucide-react';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import useThemeStore from '../../stores/useThemeStore';
import { formatDateTime, formatNumber } from '../../utils/format';
import { getTranslationInventory, saveTranslationReview, exportTranslationWorkbook, previewBulkTranslations, commitBulkTranslations } from '../../services/translations';
import { parseTranslationMatrix, containsWorkbookFormulas } from '../../utils/translationWorkbook';
import '../appraisals/Appraisals.css';
import '../ai/AiAssistant.css';
import '../ai/AiFeatureSettings.css';
import './TranslationManagement.css';

const STATUS_OPTIONS = ['all', 'missing', 'draft', 'approved'];
const CONTEXT_OPTIONS = ['all', 'question', 'anchor', 'section', 'rating_label', 'rating_band', 'scoring_profile', 'department', 'job_title', 'cycle_title', 'evaluation_statement'];
const readableError = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

export default function TranslationManagement() {
  const { t, i18n } = useTranslation('settings');
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [nav, setNav] = useState(false);
  const [status, setStatus] = useState('all');
  const [context, setContext] = useState('all');
  const [companyId, setCompanyId] = useState('0');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState({ counts: { missing: 0, draft: 0, approved: 0 }, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [french, setFrench] = useState('');
  const [approval, setApproval] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [exportScope, setExportScope] = useState('missing');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [skippedRows, setSkippedRows] = useState(0);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkNotice, setBulkNotice] = useState('');
  const locale = i18n.language;

  useEffect(() => { document.title = `AppraisalSuite | ${t('translation_title')}`; }, [t]);
  useEffect(() => {
    if (user?.role !== 'super_admin') return undefined;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    getTranslationInventory({ page, limit: 20, status, context, company_id: companyId, search }, controller.signal)
      .then((response) => {
        if (!active) return;
        setRows(response?.data || []);
        setMeta(response?.meta || { counts: { missing: 0, draft: 0, approved: 0 }, total: 0, total_pages: 1 });
        setCompanies(response?.companies || []);
      })
      .catch((err) => { if (active) setError(readableError(err, t('translation_load_error'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [user?.role, status, context, companyId, search, page, refresh, t]);

  const contextOptions = useMemo(() => CONTEXT_OPTIONS.map((key) => ({ value: key, label: t(`translation_context_${key}`) })), [t]);
  const statusOptions = useMemo(() => STATUS_OPTIONS.map((key) => ({ value: key, label: t(`translation_status_${key}`) })), [t]);
  const companyOptions = useMemo(() => [{ value: '0', label: t('translation_all_companies') }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))], [companies, t]);
  const setFilter = (setter) => (value) => { setter(value); setPage(1); setNotice(''); };
  const openEditor = (row) => { setEditing(row); setFrench(row.translated_text || ''); setError(''); setNotice(''); };
  const closeEditor = () => { if (saving) return; setEditing(null); setApproval(null); setReason(''); };
  const requestReview = (action) => {
    if (!editing || !french.trim() || saving) return;
    setReason('');
    setApproval(action);
    setError('');
  };
  const submitReview = async (event) => {
    event.preventDefault();
    if (!editing || !approval || saving || reason.trim().length < 5 || !french.trim()) return;
    setSaving(true);
    setError('');
    try {
      await saveTranslationReview({
        source_hash: editing.source_hash,
        source_text: editing.source_text,
        context: editing.context,
        translated_text: french.trim(),
        expected_status: editing.translation_status,
        expected_text: editing.translated_text || '',
        action: approval,
        reason: reason.trim(),
      });
      setNotice(approval === 'approve' ? t('translation_approved_success') : t('translation_draft_success'));
      setEditing(null);
      setApproval(null);
      setReason('');
      setPreview(null); // Any earlier import preview may now be stale.
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(readableError(err, t('translation_save_error')));
      if (err?.response?.status === 409) {
        // Conflict responses never silently overwrite another admin's changes.
        setApproval(null);
        setRefresh((n) => n + 1);
      }
    } finally { setSaving(false); }
  };


  const downloadWorkbook = async () => {
    if (exporting) return;
    setExporting(true); setBulkError(''); setBulkNotice('');
    try {
      const blob = await exportTranslationWorkbook({
        scope: exportScope, context, company_id: companyId, search,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AppraisalSuite_French_Translations_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) { setBulkError(readableError(err, t('translation_bulk_export_error'))); }
    finally { setExporting(false); }
  };
  const importWorkbook = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || importing) return;
    setPreview(null); setSelectedRows(new Set());
    setImportFileName(file.name); setBulkError(''); setBulkNotice('');
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024) {
      setBulkError(t('translation_bulk_file_invalid')); return;
    }
    setImporting(true);
    try {
      const XLSX = await import('xlsx'); // Already installed; only loaded for imports.
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', dense: true });
      const sheet = workbook.Sheets.Translations;
      if (!sheet || containsWorkbookFormulas(sheet)) throw new Error('invalid_header');
      const parsed = parseTranslationMatrix(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }));
      setSkippedRows(parsed.blank);
      if (parsed.rows.length === 0) { setBulkNotice(t('translation_bulk_empty')); return; }
      const data = await previewBulkTranslations(parsed.rows);
      setPreview(data);
      setSelectedRows(new Set(data.rows.filter((row) => row.kind === 'new' || row.kind === 'changed').map((row) => row.row_number)));
    } catch (err) {
      const key = err?.message === 'too_many_rows' ? 'translation_bulk_limit_error'
        : err?.message === 'invalid_header' ? 'translation_bulk_header_error' : 'translation_bulk_preview_error';
      setBulkError(['too_many_rows', 'invalid_header'].includes(err?.message) ? t(key)
        : err?.config ? readableError(err, t('translation_bulk_preview_error')) : t('translation_bulk_header_error'));
    } finally { setImporting(false); }
  };
  const toggleImportRow = (rowNumber) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber); else next.add(rowNumber);
      return next;
    });
  };
  const selectedForAction = (action) => (preview?.rows || []).filter((row) =>
    selectedRows.has(row.row_number) && (row.kind === 'new' || row.kind === 'changed'
      || (action === 'approve' && row.kind === 'review')));
  const beginBulkReview = (action) => {
    if (bulkSaving || selectedForAction(action).length === 0) return;
    setBulkReason(''); setBulkError(''); setBulkAction(action);
  };
  const submitBulkReview = async (event) => {
    event.preventDefault();
    const chosen = selectedForAction(bulkAction);
    if (!bulkAction || bulkSaving || bulkReason.trim().length < 5 || chosen.length === 0) return;
    setBulkSaving(true); setBulkError('');
    try {
      const result = await commitBulkTranslations(chosen.map((row) => ({
        row_number: row.row_number, source_hash: row.source_hash, context: row.context,
        source_text: row.source_text, translated_text: row.translated_text,
        expected_status: row.expected_status, expected_text: row.expected_text,
      })), bulkAction, bulkReason.trim());
      setBulkNotice(t(bulkAction === 'approve' ? 'translation_bulk_approved_success'
        : 'translation_bulk_drafts_success', { count: result.saved }));
      setPreview(null); setSelectedRows(new Set()); setImportFileName('');
      setBulkAction(null); setBulkReason(''); setRefresh((number) => number + 1);
    } catch (err) {
      setBulkError(readableError(err, t('translation_bulk_commit_error')));
      if (err?.response?.status === 409) {
        // Do not reuse a preview after an optimistic concurrency conflict.
        setBulkAction(null); setPreview(null); setSelectedRows(new Set());
      }
    } finally { setBulkSaving(false); }
  };
  const openConflictingRow = (row) => {
    openEditor({
      context: row.context, source_hash: row.source_hash, source_text: row.source_text,
      translation_status: row.live_status, translated_text: row.live_text,
    });
    setFrench(row.translated_text);
  };
  const selectAllEligible = () => setSelectedRows(new Set((preview?.rows || [])
    .filter((row) => ['new', 'changed', 'review'].includes(row.kind)).map((row) => row.row_number)));
  const selectNone = () => setSelectedRows(new Set());

  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  const counts = meta.counts || {};
  const totalPages = Math.max(1, Number(meta.total_pages || 1));
  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page ap-ai ap-ai-settings tm-page theme-${theme}`}>
          <PageNav pageTitle={t('translation_title')} links={[{ label: t('translation_dashboard'), to: '/dashboard' }, { label: t('translation_title') }]} />
          <section className="apr-hero ap-ai__hero tm-hero">
            <div className="ap-ai__intro">
              <span className="ap-ai__eyebrow"><Languages size={15} aria-hidden="true" /> {t('translation_super_admin')}</span>
              <h1>{t('translation_heading')}</h1>
              <p>{t('translation_description')}</p>
            </div>
            <div className="ap-ai-settings__hero-mark"><Globe2 size={18} aria-hidden="true" /> {t('translation_shared_memory')}</div>
          </section>

          <div className="tm-stats" aria-label={t('translation_summary')}>
            {['missing', 'draft', 'approved'].map((key) => (
              <div className="tm-stat" key={key}>
                <div className="tm-stat__icon">{key === 'missing' ? <CircleAlert size={19} /> : key === 'draft' ? <FileText size={19} /> : <Check size={19} />}</div>
                <span>{t(`translation_status_${key}`)}</span>
                <strong>{formatNumber(counts[key] || 0, {}, locale)}</strong>
              </div>
            ))}
          </div>

          <section className="tm-card" aria-labelledby="tm-filters-title">
            <div className="tm-card__heading">
              <div><h2 id="tm-filters-title">{t('translation_review_queue')}</h2><p>{t('translation_review_hint')}</p></div>
              <button type="button" className="tm-button" onClick={() => setRefresh((n) => n + 1)} disabled={loading}>
                <RefreshCw size={15} aria-hidden="true" /> {t('translation_refresh')}
              </button>
            </div>
            <div className="tm-filters">
              <div><AppSelect label={t('translation_type')} name="translation_type" value={context} onChange={setFilter(setContext)} options={contextOptions} clearable={false} /></div>
              <div><AppSelect label={t('translation_status')} name="translation_status" value={status} onChange={setFilter(setStatus)} options={statusOptions} clearable={false} /></div>
              <div><AppSelect label={t('translation_company')} name="translation_company" value={companyId} onChange={setFilter(setCompanyId)} options={companyOptions} clearable={false} searchable /></div>
            </div>
            <form className="tm-search" role="search" onSubmit={(event) => { event.preventDefault(); setFilter(setSearch)(searchInput.trim()); }}>
              <Search size={16} aria-hidden="true" />
              <input aria-label={t('translation_search')} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('translation_search')} />
              {searchInput && <button className="tm-search__clear" type="button" onClick={() => { setSearchInput(''); setFilter(setSearch)(''); }} aria-label={t('translation_clear')}><X size={15} /></button>}
              <button className="tm-button tm-button--primary" type="submit">{t('translation_search_button')}</button>
            </form>
          </section>


          <section className="tm-card tm-bulk" aria-labelledby="tm-bulk-title">
            <div className="tm-card__heading">
              <div><h2 id="tm-bulk-title">{t('translation_bulk_title')}</h2><p>{t('translation_bulk_description')}</p></div>
            </div>
            <div className="tm-bulk__tools">
              <div className="tm-bulk__tool">
                <span className="tm-bulk__mark"><FileDown size={20} aria-hidden="true" /></span>
                <div className="tm-bulk__copy"><h3>{t('translation_bulk_export_title')}</h3><p>{t('translation_bulk_export_hint')}</p></div>
                <div className="tm-bulk__control">
                  <AppSelect name="translation_bulk_scope" label={t('translation_bulk_scope_label')} value={exportScope} clearable={false}
                    onChange={setExportScope} options={[
                      { value: 'missing', label: t('translation_bulk_missing') },
                      { value: 'all', label: t('translation_bulk_all') },
                    ]} />
                  <button type="button" className="tm-button tm-button--primary" onClick={downloadWorkbook} disabled={exporting || loading}>
                    <FileDown size={16} aria-hidden="true" />{exporting ? t('translation_bulk_exporting') : t('translation_bulk_download')}
                  </button>
                </div>
              </div>
              <div className="tm-bulk__tool">
                <span className="tm-bulk__mark"><FileUp size={20} aria-hidden="true" /></span>
                <div className="tm-bulk__copy"><h3>{t('translation_bulk_import_title')}</h3><p>{t('translation_bulk_import_hint')}</p></div>
                <div className="tm-bulk__control tm-bulk__upload">
                  <label htmlFor="tm-bulk-upload" className="tm-button tm-bulk__upload-label">
                    <FileUp size={16} aria-hidden="true" />{importing ? t('translation_bulk_importing') : t('translation_bulk_choose_file')}
                  </label>
                  <input id="tm-bulk-upload" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={importing || bulkSaving} onChange={importWorkbook} aria-label={t('translation_bulk_choose_file')} />
                  {importFileName && <span className="tm-bulk__filename" title={importFileName}>{importFileName}</span>}
                </div>
              </div>
            </div>
            {bulkNotice && <p className="tm-message tm-message--success" role="status"><Check size={16} />{bulkNotice}</p>}
            {bulkError && <p className="tm-message tm-message--error" role="alert"><CircleAlert size={16} />{bulkError}</p>}
            {preview && <div className="tm-bulk__preview" aria-label={t('translation_bulk_preview_title')}>
              <div className="tm-card__heading">
                <div><h3>{t('translation_bulk_preview_title')}</h3><p>{t('translation_bulk_preview_hint')}</p></div>
                <div className="tm-bulk__selection">
                  <button className="tm-button" type="button" onClick={selectAllEligible}>{t('translation_bulk_select_eligible')}</button>
                  <button className="tm-button" type="button" onClick={selectNone}>{t('translation_bulk_clear_selection')}</button>
                </div>
              </div>
              <div className="tm-bulk__counts" aria-live="polite">
                {['new', 'changed', 'review', 'unchanged', 'conflict', 'duplicate', 'invalid'].map((kind) => (
                  <span key={kind} className={`tm-chip tm-chip--${kind}`}>
                    {t(`translation_bulk_kind_${kind}`)}: {formatNumber(preview.counts?.[kind] || 0, {}, locale)}
                  </span>
                ))}
                {skippedRows > 0 && <span className="tm-chip">{t('translation_bulk_skipped', { count: skippedRows })}</span>}
              </div>
              <p className="tm-bulk__warning">{t('translation_bulk_conflict_notice')}</p>
              <div className="tm-bulk__table-wrapper" tabIndex={0} role="region" aria-label={t('translation_bulk_preview_title')}>
                <table className="tm-bulk__table">
                  <thead><tr>
                    <th scope="col">{t('translation_bulk_select')}</th>
                    <th scope="col">{t('translation_type')}</th>
                    <th scope="col">{t('translation_english_source')}</th>
                    <th scope="col">{t('translation_french')}</th>
                    <th scope="col">{t('translation_bulk_result')}</th>
                  </tr></thead>
                  <tbody>{preview.rows.map((row) => {
                    const eligible = ['new', 'changed', 'review'].includes(row.kind);
                    return <tr key={`${row.row_number}:${row.source_hash}`}>
                      <td><input type="checkbox" checked={selectedRows.has(row.row_number)} disabled={!eligible}
                        onChange={() => toggleImportRow(row.row_number)} aria-label={t('translation_bulk_row_select', { row: row.row_number })} /></td>
                      <td><span className="tm-bulk__row-number">#{row.row_number}</span>{t(`translation_context_${row.context}`, { defaultValue: row.context })}</td>
                      <td>{row.source_text}</td><td>{row.translated_text}</td>
                      <td><span className={`tm-chip tm-chip--${row.kind}`}>{t(`translation_bulk_kind_${row.kind}`)}</span>
                        {['conflict', 'invalid', 'duplicate'].includes(row.kind) && <small className="tm-bulk__issue">
                          {t(`translation_bulk_reason_${row.reason_code}`, { defaultValue: t('translation_bulk_reason_invalid_row') })}
                        </small>}
                        {row.kind === 'conflict' && ['approved_change', 'revision_changed'].includes(row.reason_code)
                          && ['draft', 'approved'].includes(row.live_status) && (
                            <button type="button" className="tm-bulk__manual" onClick={() => openConflictingRow(row)}>{t('translation_bulk_review_individual')}</button>
                          )}
                      </td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div className="tm-bulk__footer">
                <span>{t('translation_bulk_selected', { count: selectedRows.size })}</span>
                <div className="tm-bulk__selection">
                  <button type="button" className="tm-button" disabled={!selectedForAction('draft').length || bulkSaving}
                    onClick={() => beginBulkReview('draft')}><Save size={15} />{t('translation_bulk_save_drafts', { count: selectedForAction('draft').length })}</button>
                  <button type="button" className="tm-button tm-button--primary" disabled={!selectedForAction('approve').length || bulkSaving}
                    onClick={() => beginBulkReview('approve')}><ClipboardCheck size={15} />{t('translation_bulk_approve_selected', { count: selectedForAction('approve').length })}</button>
                </div>
              </div>
            </div>}
          </section>

          {notice && <p className="tm-message tm-message--success" role="status"><Check size={16} />{notice}</p>}
          {error && <p className="tm-message tm-message--error" role="alert"><CircleAlert size={16} />{error}</p>}

          <section className="tm-card" aria-labelledby="tm-results-title">
            <div className="tm-card__heading"><div>
              <h2 id="tm-results-title">{t('translation_results')}</h2>
              <p>{t('translation_total', { count: meta.total || 0 })}</p>
            </div></div>
            {loading ? <p className="tm-empty" role="status">{t('translation_loading')}</p>
              : rows.length === 0 ? <p className="tm-empty">{t('translation_no_results')}</p> : (
                <div className="tm-list">
                  {rows.map((row) => (
                    <article className="tm-item" key={`${row.context}:${row.source_hash}`}>
                      <div className="tm-item__main">
                        <div className="tm-item__meta">
                          <span className="tm-chip">{t(`translation_context_${row.context}`)}</span>
                          <span className={`tm-chip tm-chip--${row.translation_status}`}>{t(`translation_status_${row.translation_status}`)}</span>
                          <span className="tm-item__companies">{t('translation_used_companies', { count: row.companies?.length || 0 })}</span>
                        </div>
                        <p className="tm-item__source">{row.source_text}</p>
                        <p className="tm-item__translation">{row.translated_text || t('translation_not_yet')}</p>
                        {row.updated_at && <small>{t('translation_last_updated', { date: formatDateTime(row.updated_at, {}, locale) })}</small>}
                      </div>
                      <button type="button" className="tm-button" onClick={() => openEditor(row)} aria-label={t('translation_edit_aria', { context: t(`translation_context_${row.context}`) })}>
                        <PencilLine size={15} aria-hidden="true" /> {t('translation_review')}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            <nav className="tm-pagination" aria-label={t('translation_pages')}>
              <span>{t('translation_page_of', { page, pages: totalPages })}</span>
              <div>
                <button type="button" className="tm-button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>{t('translation_previous')}</button>
                <button type="button" className="tm-button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>{t('translation_next')}</button>
              </div>
            </nav>
          </section>


          {bulkAction && (
            <div className="tm-overlay tm-overlay--approval" role="presentation">
              <form className="tm-approval" role="dialog" aria-modal="true" aria-labelledby="tm-bulk-approval-title" onSubmit={submitBulkReview}>
                <div className="tm-editor__head"><span className="tm-editor__eyebrow"><ShieldCheck size={16} />{t('translation_super_admin_approval')}</span>
                  <button type="button" className="tm-icon-button" aria-label={t('translation_close')} onClick={() => setBulkAction(null)} disabled={bulkSaving}><X size={19} /></button></div>
                <h2 id="tm-bulk-approval-title">{t(bulkAction === 'approve' ? 'translation_bulk_approve_title' : 'translation_bulk_draft_title', { count: selectedForAction(bulkAction).length })}</h2>
                <p>{t('translation_bulk_approval_explanation')}</p>
                {bulkError && <p className="tm-message tm-message--error" role="alert">{bulkError}</p>}
                <label htmlFor="tm-bulk-reason">{t('translation_reason')}</label>
                <textarea id="tm-bulk-reason" value={bulkReason} onChange={(event) => setBulkReason(event.target.value)}
                  required minLength={5} maxLength={500} rows={3} autoFocus placeholder={t('translation_reason_placeholder')} />
                <p className="tm-approval__hint">{t('translation_reason_hint')}</p>
                <div className="tm-editor__actions">
                  <button type="button" className="tm-button" onClick={() => setBulkAction(null)} disabled={bulkSaving}>{t('translation_cancel')}</button>
                  <button type="submit" className="tm-button tm-button--primary" disabled={bulkSaving || bulkReason.trim().length < 5}>
                    {bulkSaving ? t('translation_saving') : t('translation_confirm')}
                  </button>
                </div>
              </form>
            </div>
          )}
          {editing && (
            <div className="tm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
              <section className="tm-editor" role="dialog" aria-modal="true" aria-hidden={approval ? true : undefined} aria-labelledby="tm-editor-title">
                <div className="tm-editor__head"><div><span className="tm-editor__eyebrow"><ShieldCheck size={15} /> {t('translation_super_admin')}</span><h2 id="tm-editor-title">{t('translation_edit_title')}</h2></div>
                  <button type="button" className="tm-icon-button" aria-label={t('translation_close')} onClick={closeEditor} disabled={saving}><X size={19} /></button>
                </div>
                <p className="tm-editor__hint">{t('translation_edit_hint')}</p>
                {error && <p className="tm-message tm-message--error" role="alert">{error}</p>}
                <div className="tm-editor__fields">
                  <label><span>{t('translation_english_source')}</span><textarea value={editing.source_text} readOnly rows={7} /></label>
                  <label><span>{t('translation_french')}</span><textarea value={french} onChange={(event) => setFrench(event.target.value)} rows={7} maxLength={12000} autoFocus aria-required="true" /></label>
                </div>
                <p className="tm-editor__status">{t('translation_current_status')} <strong>{t(`translation_status_${editing.translation_status}`)}</strong></p>
                <div className="tm-editor__actions">
                  <button type="button" className="tm-button" onClick={closeEditor} disabled={saving}>{t('translation_cancel')}</button>
                  <button type="button" className="tm-button" onClick={() => requestReview('draft')} disabled={!french.trim() || saving}><Save size={15} />{t('translation_save_draft')}</button>
                  <button type="button" className="tm-button tm-button--primary" onClick={() => requestReview('approve')} disabled={!french.trim() || saving}><ClipboardCheck size={15} />{t('translation_approve')}</button>
                </div>
              </section>
            </div>
          )}
          {editing && approval && (
            <div className="tm-overlay tm-overlay--approval" role="presentation">
              <form className="tm-approval" role="dialog" aria-modal="true" aria-labelledby="tm-approval-title" onSubmit={submitReview}>
                <div className="tm-editor__head"><span className="tm-editor__eyebrow"><ShieldCheck size={16} />{t('translation_super_admin_approval')}</span>
                  <button type="button" className="tm-icon-button" aria-label={t('translation_close')} onClick={() => setApproval(null)} disabled={saving}><X size={19}/></button></div>
                <h2 id="tm-approval-title">{t(approval === 'approve' ? 'translation_approve_title' : 'translation_draft_title')}</h2>
                <p>{t('translation_approval_explanation')}</p>
                {error && <p className="tm-message tm-message--error" role="alert">{error}</p>}
                <label htmlFor="tm-review-reason">{t('translation_reason')}</label>
                <textarea id="tm-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} required rows={3} autoFocus placeholder={t('translation_reason_placeholder')} />
                <p className="tm-approval__hint">{t('translation_reason_hint')}</p>
                <div className="tm-editor__actions"><button type="button" className="tm-button" onClick={() => setApproval(null)} disabled={saving}>{t('translation_cancel')}</button>
                  <button type="submit" className="tm-button tm-button--primary" disabled={reason.trim().length < 5 || saving}>{saving ? t('translation_saving') : t('translation_confirm')}</button></div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
