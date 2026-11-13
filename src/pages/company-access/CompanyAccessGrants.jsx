import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber } from '../../utils/format';
import { Navigate } from 'react-router-dom';
import {
  Bell, BellOff, Check, CircleAlert, Clock3, History, LockKeyhole, Pencil,
  Plus, RefreshCw, ShieldCheck, ShieldOff, Users, X,
} from 'lucide-react';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import useThemeStore from '../../stores/useThemeStore';
import useToastStore from '../../stores/useToastStore';
import {
  createCompanyGrant, listActiveAccessCompanies, listCompanyGrants,
  listEligibleCompanyAdmins, revokeCompanyGrant, updateCompanyGrant,
} from '../../services/adminCompanyAccess';
import {
  DEFAULT_GRANT_FORM, editFormForGrant, grantErrorMessage, grantReasonValid,
  hasGrantChanges, normalizedGrantSettings, validateNewGrant,
} from '../../utils/companyGrantForm';
import '../appraisals/Appraisals.css';
import '../ai/AiAssistant.css';
import '../ai/AiFeatureSettings.css';
import './CompanyAccessGrants.css';

const LIMIT = 25;
const niceDate = (value, locale) => {
  if (!value) return '—';
  const raw = String(value);
  const timestamp = /(?:Z|[+-]\d\d:?\d\d)$/i.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? raw : formatDateTime(date, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }, locale);
};
const scopeName = (scope, t) => t(scope === 'Expatriate' ? 'access_scope_expat' : scope === 'Local' ? 'access_scope_local' : 'access_scope_all');
const profileName = (grant, t) => grant.user_name || grant.user_email || t('access_admin_number', { id: grant.user_id });
const contextLabel = (grant, t) => `${profileName(grant, t)} · ${grant.company_name || t('access_company_number', { id: grant.company_id })}`;
const validationKeys = Object.freeze({
  'Choose an active administrator.': 'access_admin_required',
  'Choose an active company.': 'access_company_required',
  'An admin already has full access to their home company.': 'access_home_restriction',
  'Choose a valid access level and staff scope.': 'access_invalid_level',
  'Change at least one setting before saving.': 'access_change_required',
});

function ListPager({ meta, page, onPageChange }) {
  const { t, i18n } = useTranslation('company');
  const pages = Math.max(1, Number(meta?.total_pages) || 1);
  if (pages <= 1) return null;
  return (
    <div className="acg-pager" aria-label={t('access_pager_aria')}>
      <span>{t('access_page_records', { page: formatNumber(page, {}, i18n.language), pages: formatNumber(pages, {}, i18n.language), records: formatNumber(Number(meta?.total || 0), {}, i18n.language) })}</span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t('access_previous')}</button>
        <button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>{t('access_next')}</button>
      </div>
    </div>
  );
}

export default function CompanyAccessGrants() {
  const { t, i18n } = useTranslation('company');
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const { showToast } = useToastStore();
  const [nav, setNav] = useState(false);
  const [active, setActive] = useState({ grants: [], meta: { total: 0, total_pages: 1 } });
  const [history, setHistory] = useState({ grants: [], meta: { total: 0, total_pages: 1 } });
  const [admins, setAdmins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [tab, setTab] = useState('active');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null); // { action: 'create'|'edit', grant?: object }
  const [form, setForm] = useState({ ...DEFAULT_GRANT_FORM });
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(null); // Immutable request snapshot awaiting approval.
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = t('access_document_title'); }, [t]);

  useEffect(() => {
    if (user?.role !== 'super_admin') return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      listCompanyGrants({ status: 'active', page: activePage, limit: LIMIT }),
      listCompanyGrants({ status: 'revoked', page: historyPage, limit: LIMIT }),
      listEligibleCompanyAdmins(),
      listActiveAccessCompanies(),
    ]).then(([activeGrants, revokedGrants, eligibleAdmins, availableCompanies]) => {
      if (cancelled) return;
      setActive(activeGrants);
      setHistory(revokedGrants);
      setAdmins(eligibleAdmins);
      setCompanies(availableCompanies);
    }).catch((err) => {
      if (cancelled) return;
      // A failed refresh must not leave an obsolete grant list looking current.
      setActive({ grants: [], meta: { total: 0, total_pages: 1 } });
      setHistory({ grants: [], meta: { total: 0, total_pages: 1 } });
      setAdmins([]);
      setCompanies([]);
      setError(grantErrorMessage(err) === 'Unable to complete this request. Please try again.' ? 'access_request_error' : grantErrorMessage(err));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.role, activePage, historyPage, refreshKey]);

  const chosenAdmin = useMemo(() => admins.find((item) => String(item.id) === String(form.user_id)), [admins, form.user_id]);
  const eligibleCompanies = useMemo(() => companies.filter((company) =>
    !chosenAdmin || String(company.id) !== String(chosenAdmin.home_company_id)
  ), [companies, chosenAdmin]);

  const currentRows = tab === 'active' ? active.grants : history.grants;
  const visibleRows = useMemo(() => {
    const query = search.toLocaleLowerCase().trim();
    if (!query) return currentRows;
    return currentRows.filter((grant) => [
      grant.user_name, grant.user_email, grant.home_company_name,
      grant.company_name, grant.company_code,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  }, [currentRows, search]);

  const closeEditor = () => { if (!saving) { setEditor(null); setFormError(''); } };
  const openAdd = () => {
    setEditor({ action: 'create' });
    setForm({ ...DEFAULT_GRANT_FORM });
    setFormError('');
    setError('');
    setNotice('');
  };
  const openEdit = (grant) => {
    setEditor({ action: 'edit', grant });
    setForm(editFormForGrant(grant));
    setFormError('');
    setError('');
    setNotice('');
  };
  const reviewEditor = (event) => {
    event.preventDefault();
    if (!editor || saving) return;
    const isCreate = editor.action === 'create';
    const validation = isCreate ? validateNewGrant(form, admins, companies) :
      !hasGrantChanges(editor.grant, form) ? 'Change at least one setting before saving.' : '';
    if (validation) { setFormError(validationKeys[validation] || validation); return; }
    const payload = normalizedGrantSettings(form);
    if (isCreate) {
      payload.user_id = Number(form.user_id);
      payload.company_id = Number(form.company_id);
    }
    setFormError('');
    setPending({ action: editor.action, grant: editor.grant || null, data: payload });
    setReason('');
  };
  const reviewRevoke = (grant) => {
    setEditor(null);
    setError('');
    setNotice('');
    setPending({ action: 'revoke', grant, data: null });
    setReason('');
  };
  const closeApproval = () => { if (!saving) { setPending(null); setReason(''); } };

  useEffect(() => {
    if (!pending) return undefined;
    const keyHandler = (event) => { if (event.key === 'Escape' && !saving) closeApproval(); };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, saving]);

  const submitApproval = async (event) => {
    event.preventDefault();
    if (!pending || saving || !grantReasonValid(reason)) return;
    setSaving(true);
    setError('');
    const action = pending.action;
    try {
      if (action === 'create') await createCompanyGrant(pending.data, reason.trim());
      else if (action === 'edit') await updateCompanyGrant(pending.grant.id, pending.data, reason.trim());
      else await revokeCompanyGrant(pending.grant.id, reason.trim());
      const message = action === 'create' ? 'access_created_success' :
        action === 'edit' ? 'access_updated_success' : 'access_revoked_success';
      setPending(null);
      setReason('');
      setEditor(null);
      setFormError('');
      setNotice(message);
      showToast(t(message), 'success');
      setActivePage(1);
      setHistoryPage(1);
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setError(grantErrorMessage(err) === 'Unable to complete this request. Please try again.' ? 'access_request_error' : grantErrorMessage(err));
      // Preserve the approval form and reason for correction or retry.
    } finally { setSaving(false); }
  };

  // Client-side routing is display-only. All three grant mutations and list endpoints
  // enforce requireRoles(['super_admin']) in the backend independently.
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  const pendingSubject = pending?.action === 'create'
    ? `${admins.find((item) => String(item.id) === String(pending.data.user_id))?.name || t('access_administrator')} · ${companies.find((item) => String(item.id) === String(pending.data.company_id))?.name || t('access_company')}`
    : pending?.grant ? contextLabel(pending.grant, t) : '';

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page ap-ai ap-ai-settings acg-page theme-${theme}`}>
          <PageNav pageTitle={t('access_title')} links={[{ label: t('access_dashboard'), to: '/dashboard' }, { label: t('access_users_access'), to: '/users/home' }, { label: t('access_title') }]} />
          <section className="apr-hero ap-ai__hero ap-ai-settings__hero acg-hero">
            <div className="ap-ai__intro">
              <span className="ap-ai__eyebrow"><ShieldCheck size={14} /> {t('access_admin_control')}</span>
              <h1>{t('access_heading')}</h1>
              <p>{t('access_description')}</p>
            </div>
            <div className="ap-ai-settings__hero-mark"><LockKeyhole size={17} /> {t('access_central')}</div>
          </section>

          {!!notice && <div className="ap-ai-settings__notice" role="status"><Check size={16} /> {t(notice)}</div>}
          {!!error && <div className="ap-ai__alert acg-alert" role="alert"><CircleAlert size={16} /> <span>{error === 'access_request_error' ? t(error) : error}</span><button type="button" onClick={() => { setError(''); setRefreshKey((key) => key + 1); }}>{t('access_retry')}</button></div>}

          <section className="acg-summary" aria-label={t('access_overview')}>
            <div className="acg-stat"><div className="acg-stat__icon"><ShieldCheck size={19} /></div><div><strong>{formatNumber(active.meta.total || 0, {}, i18n.language)}</strong><span>{t('access_active_grants')}</span></div></div>
            <div className="acg-stat"><div className="acg-stat__icon"><Users size={19} /></div><div><strong>{formatNumber(admins.length, {}, i18n.language)}</strong><span>{t('access_eligible_admins')}</span></div></div>
            <div className="acg-stat"><div className="acg-stat__icon"><History size={19} /></div><div><strong>{formatNumber(history.meta.total || 0, {}, i18n.language)}</strong><span>{t('access_revoked_history_count')}</span></div></div>
          </section>

          <div className="acg-toolbar">
            <div className="acg-tabs" role="tablist" aria-label={t('access_grant_status')}>
              <button type="button" role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'is-selected' : ''} onClick={() => { setTab('active'); setSearch(''); }}>{t('access_active_grants')} <span>{formatNumber(active.meta.total || 0, {}, i18n.language)}</span></button>
              <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-selected' : ''} onClick={() => { setTab('history'); setSearch(''); }}>{t('access_history')} <span>{formatNumber(history.meta.total || 0, {}, i18n.language)}</span></button>
            </div>
            <div className="acg-toolbar__right">
              <button type="button" className="acg-btn acg-btn--quiet" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading || saving} title={t('access_reload_title')}><RefreshCw size={15} /> {t('access_refresh')}</button>
              <button type="button" className="acg-btn acg-btn--primary" onClick={openAdd} disabled={loading || saving}><Plus size={16} /> {t('access_add')}</button>
            </div>
          </div>

          {editor && (
            <section className="acg-editor" aria-label={t(editor.action === 'create' ? 'access_add_company_access' : 'access_edit_company_access')}>
              <div className="acg-editor__top"><div><h2>{t(editor.action === 'create' ? 'access_add_company_access' : 'access_edit_company_access')}</h2><p>{editor.action === 'create' ? t('access_create_hint') : t('access_editing', { subject: contextLabel(editor.grant, t) })}</p></div><button type="button" className="acg-close" aria-label={t('access_close_editor')} onClick={closeEditor}><X size={18} /></button></div>
              <form onSubmit={reviewEditor}>
                <div className="acg-fields">
                  {editor.action === 'create' ? (
                    <>
                      <AppSelect name="acg-admin" label={t('access_administrator')} value={form.user_id} searchable clearable={false} placeholder={t('access_admin_placeholder')} options={admins.map((admin) => ({ value: String(admin.id), label: admin.name, description: `${admin.email} · ${admin.home_company_name}` }))} onChange={(value) => setForm((previous) => ({ ...previous, user_id: String(value), company_id: '' }))} />
                      <AppSelect name="acg-company" label={t('access_grant_company')} value={form.company_id} searchable clearable={false} placeholder={t('access_company_placeholder')} disabled={!form.user_id} options={eligibleCompanies.map((company) => ({ value: String(company.id), label: company.name, description: company.code }))} onChange={(value) => setForm((previous) => ({ ...previous, company_id: String(value) }))} />
                    </>
                  ) : (
                    <div className="acg-fields__context"><strong>{contextLabel(editor.grant)}</strong><span>{t('access_home_company', { name: editor.grant.home_company_name || '—' })}</span></div>
                  )}
                  <AppSelect name="acg-level" label={t('access_level')} value={form.access_level} clearable={false} options={[{ value: 'view', label: t('access_view_only'), description: t('access_view_description') }, { value: 'manage', label: t('access_manage'), description: t('access_manage_description') }]} onChange={(value) => setForm((previous) => ({ ...previous, access_level: value }))} />
                  <AppSelect name="acg-scope" label={t('access_staff_scope')} value={form.staff_scope} clearable={false} options={[{ value: 'All', label: t('access_scope_all') }, { value: 'Local', label: t('access_scope_local') }, { value: 'Expatriate', label: t('access_scope_expat') }]} onChange={(value) => setForm((previous) => ({ ...previous, staff_scope: value }))} />
                </div>
                <label className="acg-notify" htmlFor="acg-notify-check"><input id="acg-notify-check" type="checkbox" checked={form.receive_notifications} onChange={(event) => setForm((previous) => ({ ...previous, receive_notifications: event.target.checked }))} /><span><strong>{t('access_receive_notifications')}</strong><small>{t('access_notifications_help')}</small></span></label>
                {!!formError && <div className="acg-form-error" role="alert"><CircleAlert size={15} /> {t(formError, { defaultValue: formError })}</div>}
                <div className="acg-editor__actions"><button type="button" className="acg-btn" onClick={closeEditor}>{t('access_cancel')}</button><button type="submit" className="acg-btn acg-btn--primary" disabled={saving || (editor.action === 'edit' && !hasGrantChanges(editor.grant, form))}>{t(editor.action === 'create' ? 'access_review_grant' : 'access_review_changes')}</button></div>
              </form>
            </section>
          )}

          <section className="acg-list" aria-label={t(tab === 'active' ? 'access_active_grants' : 'access_history_title')}>
            <div className="acg-list__head">
              <div><h2>{t(tab === 'active' ? 'access_active_grants' : 'access_history_title')}</h2><p>{t(tab === 'active' ? 'access_active_desc' : 'access_history_desc')}</p></div>
              <label className="acg-search"><span className="acg-sr">{t('access_filter_visible')}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('access_filter_placeholder')} /></label>
            </div>
            {loading ? <div className="acg-empty" role="status"><RefreshCw size={19} className="acg-spin" /> {t('access_loading')}</div> : error && !currentRows.length ? <div className="acg-empty">{t('access_load_failed')}</div> : !visibleRows.length ? (
              <div className="acg-empty"><ShieldOff size={23} /><strong>{t(search ? 'access_no_match' : tab === 'active' ? 'access_no_active' : 'access_no_revoked')}</strong><p>{t(search ? 'access_no_match_hint' : tab === 'active' ? 'access_no_active_hint' : 'access_no_revoked_hint')}</p></div>
            ) : (
              <div className="acg-rows">{visibleRows.map((grant) => (
                <article key={grant.id} className="acg-row">
                  <div className="acg-row__head"><div className="acg-row__avatar" aria-hidden="true">{String(profileName(grant, t)).slice(0, 1).toUpperCase()}</div><div className="acg-row__identity"><h3>{profileName(grant, t)}</h3><span>{grant.user_email || t('access_no_email')} · {t('access_home', { company: grant.home_company_name || '—' })}</span></div><div className="acg-row__chips"><span className={`acg-chip ${grant.access_level === 'manage' ? 'acg-chip--manage' : ''}`}>{t(grant.access_level === 'manage' ? 'access_manage' : 'access_view_only')}</span><span className="acg-chip">{scopeName(grant.staff_scope, t)}</span>{grant.user_is_active === false && <span className="acg-chip acg-chip--suspended">{t('access_admin_inactive')}</span>}{grant.company_is_active === false && <span className="acg-chip acg-chip--suspended">{t('access_company_inactive')}</span>}</div></div>
                  <div className="acg-row__body"><div><span className="acg-row__label">{t('access_company')}</span><strong>{grant.company_name || t('access_company_number', { id: grant.company_id })}</strong><small>{grant.company_code || '—'}</small></div><div><span className="acg-row__label">{t('access_notifications')}</span><span className="acg-row__with-icon">{grant.receive_notifications ? <Bell size={14} /> : <BellOff size={14} />}{t(grant.receive_notifications ? 'access_on' : 'access_off')}</span></div><div><span className="acg-row__label">{t(tab === 'active' ? 'access_granted' : 'access_revoked')}</span><strong>{niceDate(tab === 'active' ? grant.created_at : grant.revoked_at, i18n.language)}</strong><small>{t('access_by', { name: tab === 'active' ? (grant.granted_by_name || '—') : (grant.revoked_by_name || t('access_system')) })}</small></div></div>
                  {tab === 'history' ? (
                    <div className="acg-row__history"><Clock3 size={14} /><div><strong>{t('access_revocation_reason')}</strong><p>{grant.revoke_reason || t('access_system_revocation')}</p><small>{t('access_originally_granted', { date: niceDate(grant.created_at, i18n.language) })} · {grant.reason || '—'}</small></div></div>
                  ) : (
                    <div className="acg-row__foot"><p title={grant.reason || ''}>{t('access_grant_reason', { reason: grant.reason || '—' })}</p><div className="acg-row__actions"><button type="button" className="acg-btn" onClick={() => openEdit(grant)} disabled={saving}><Pencil size={14} /> {t('access_edit')}</button><button type="button" className="acg-btn acg-btn--danger" onClick={() => reviewRevoke(grant)} disabled={saving}><ShieldOff size={14} /> {t('access_revoke')}</button></div></div>
                  )}
                </article>
              ))}</div>
            )}
            {!loading && <ListPager meta={tab === 'active' ? active.meta : history.meta} page={tab === 'active' ? activePage : historyPage} onPageChange={tab === 'active' ? setActivePage : setHistoryPage} />}
          </section>
          <p className="ap-ai-settings__footnote"><ShieldCheck size={16} /> {t('access_footnote')}</p>
        </div>
      </main>
      {pending && (
        <div className={`ap-ai-settings__overlay theme-${theme}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeApproval(); }}>
          <form className="ap-ai-settings__modal acg-approval" role="dialog" aria-modal="true" aria-labelledby="acg-approval-title" onSubmit={submitApproval}>
            <div className="ap-ai-settings__modal-head"><span><LockKeyhole size={16} /> {t('access_admin_control')}</span><button type="button" disabled={saving} aria-label={t('access_cancel_approval')} onClick={closeApproval}><X size={18} /></button></div>
            <h2 id="acg-approval-title">{t(pending.action === 'create' ? 'access_approve_create' : pending.action === 'edit' ? 'access_approve_edit' : 'access_approve_revoke')}</h2>
            <p><strong>{pendingSubject}</strong></p>
            <p>{pending.action === 'revoke' ? t('access_revoke_warning') : t('access_approval_summary', { level: t(pending.data.access_level === 'manage' ? 'access_manage' : 'access_view_only'), scope: scopeName(pending.data.staff_scope, t), notifications: t(pending.data.receive_notifications ? 'access_on' : 'access_off').toLocaleLowerCase(i18n.language === 'fr' ? 'fr' : 'en') })}</p>
            {!!error && <div className="acg-form-error" role="alert">{error === 'access_request_error' ? t(error) : error}</div>}
            <label htmlFor="acg-reason">{t(pending.action === 'revoke' ? 'access_reason_revocation' : 'access_reason_change')} <span>*</span></label>
            <textarea id="acg-reason" rows={4} maxLength={500} minLength={5} required autoFocus disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('access_reason_placeholder')} />
            <div className="acg-reason-count">{t('access_reason_count', { count: Array.from(reason.trim()).length })}</div>
            <div className="ap-ai-settings__modal-actions"><button type="button" disabled={saving} onClick={closeApproval}>{t('access_cancel')}</button><button type="submit" disabled={saving || !grantReasonValid(reason)}>{saving ? t('access_saving') : t(pending.action === 'revoke' ? 'access_confirm_revocation' : 'access_confirm_change')}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
