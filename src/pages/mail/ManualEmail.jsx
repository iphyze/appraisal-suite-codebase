import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarCheck,
  CircleCheck,
  ChevronDown,
  Layers,
  ShieldCheck,
  History,
  Mail,
  PenLine,
  Search,
  Send,
  UserX,
  Users,
  X,
} from 'lucide-react';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import api from '../../services/api';
import useToastStore from '../../stores/useToastStore';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import ModuleShell from '../common/ModuleShell';
import './ManualEmail.css';

// Keep audience IDs and API payloads stable. Presentation and presets live in mail.json.
const MODE_CONFIG = {
  pending_acknowledgements: { requiresCycle: true, icon: History },
  pending_supervisors: { requiresCycle: true, icon: ArrowRightLeft },
  cycle_supervisors: { requiresCycle: true, icon: CalendarCheck },
  specific_users: { requiresCycle: false, icon: Users },
  custom_emails: { requiresCycle: false, icon: Mail },
};

const initialForm = {
  mode: 'pending_acknowledgements',
  cycle_id: '',
  subject: '',
  custom_message: '',
  emails: '',
  cc_emails: '',
  user_search: '',
};

const SCOPE_ORDER = ['Local', 'Expatriate', 'Other'];
const scopeOf = (row) => ['Local', 'Expatriate'].find((scope) => scope.toLowerCase() === String(row.staff_type || '').trim().toLowerCase()) || 'Other';
const categoryOf = (row) => {
  const role = String(row.role || '').toLowerCase();
  if (role === 'supervisor' || Number(row.is_supervisor) === 1) return 'Supervisors';
  if (role === 'staff') return 'Staff';
  return 'Other portal users';
};

const initials = (row) => `${row?.first_name?.[0] || ''}${row?.last_name?.[0] || ''}`.toUpperCase() || 'LM';

const ManualEmail = () => {
  const location = useLocation();
  const userEditedRef = useRef({ subject: false, custom_message: false });
  const cameFromReminder = useRef(!!location.state?.reminderDraft);
  const { t, i18n } = useTranslation('mail');
  const locale = i18n.language;
  // A reminder drafted with AI on the Analytics page arrives pre-filled for review.
  const [form, setForm] = useState(() => {
    const draft = location.state?.reminderDraft;
    const localInitial = {
      ...initialForm,
      subject: t('manual_mode_pending_acknowledgements_subject'),
      custom_message: t('manual_mode_pending_acknowledgements_message'),
    };
    if (!draft || !MODE_CONFIG[draft.mode]) return localInitial;
    return { ...localInitial, mode: draft.mode, subject: String(draft.subject || '').slice(0, 200), custom_message: String(draft.message || '').slice(0, 5000), cycle_id: draft.cycle_id || '' };
  });
  const [cycles, setCycles] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [includeOtherScopes, setIncludeOtherScopes] = useState(false);
  const [recipientMeta, setRecipientMeta] = useState({ staff_scope: 'All', can_expand: false, expanded: false });
  const recipientLoadRef = useRef({ key: '', request: 0 });
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  const { showToast } = useToastStore();
  const config = MODE_CONFIG[form.mode] || MODE_CONFIG.custom_emails;
  const RecipientIcon = config.icon;
  const recipientModeOptions = Object.entries(MODE_CONFIG).map(([value]) => ({
    value,
    label: t(`manual_mode_${value}_label`),
    description: t(`manual_mode_${value}_description`),
  }));
  const scopeLabel = (scope) => t(`manual_scope_${scope === 'Expatriate' ? 'expatriate' : scope === 'Local' ? 'local' : scope === 'All' ? 'all' : 'other'}`);
  const categoryLabel = (category) => t(`manual_category_${category === 'Supervisors' ? 'supervisors' : category === 'Staff' ? 'staff' : 'other'}`);

  useEffect(() => {
    api.get('/cycles/list?limit=100&page=1&sortBy=year&sortOrder=DESC')
      .then((res) => {
        const rows = res.data?.data || [];
        setCycles(rows);
        const active = rows.find((cycle) => Number(cycle.is_active) === 1) || rows[0];
        if (active) setForm((prev) => (prev.cycle_id ? prev : { ...prev, cycle_id: active.id }));
      })
      .catch(() => setCycles([]));
    // Cycle titles are translated by the server; the selected cycle is kept.
  }, [i18n.resolvedLanguage]);

  useEffect(() => { document.title = t('manual_document_title'); }, [t, locale]);

  // A locale change only refreshes untouched template presets. Never overwrite
  // manually edited text or a pre-filled reminder supplied by Analytics.
  useEffect(() => {
    if (cameFromReminder.current) return;
    setForm((prev) => ({
      ...prev,
      subject: userEditedRef.current.subject ? prev.subject : t(`manual_mode_${prev.mode}_subject`),
      custom_message: userEditedRef.current.custom_message || ['specific_users', 'custom_emails'].includes(prev.mode)
        ? prev.custom_message : t(`manual_mode_${prev.mode}_message`),
    }));
  }, [locale, t]);

  useEffect(() => {
    const key = `${form.mode}:${form.cycle_id || ''}`;
    const preserveSelection = recipientLoadRef.current.key === key;
    const request = ++recipientLoadRef.current.request;
    recipientLoadRef.current.key = key;
    let cancelled = false;

    if (!preserveSelection) {
      setEligible([]);
      setSelectedIds([]);
      setRecipientMeta({ staff_scope: 'All', can_expand: false, expanded: false });
    }

    if (form.mode === 'custom_emails' || (config.requiresCycle && !form.cycle_id)) {
      setEligible([]);
      setSelectedIds([]);
      setLoadingRecipients(false);
      return () => { cancelled = true; };
    }

    setLoadingRecipients(true);
    const params = new URLSearchParams({ audience: form.mode });
    if (form.cycle_id) params.set('cycle_id', String(form.cycle_id));
    if (includeOtherScopes && ['pending_acknowledgements', 'cycle_supervisors'].includes(form.mode)) {
      params.set('include_other_scopes', '1');
    }

    api.get(`/mail/recipients?${params.toString()}`)
      .then((res) => {
        if (cancelled || request !== recipientLoadRef.current.request) return;
        const rows = res.data?.data || [];
        const idSet = new Set(rows.map((row) => Number(row.recipient_id)));
        setEligible(rows);
        setRecipientMeta(res.data?.meta || { staff_scope: 'All', can_expand: false, expanded: false });
        // Newly expanded scopes are intentionally NOT auto-selected.
        setSelectedIds((prev) => preserveSelection
          ? prev.filter((id) => idSet.has(id))
          : rows.map((row) => Number(row.recipient_id)));
      })
      .catch((error) => {
        if (cancelled || request !== recipientLoadRef.current.request) return;
        setEligible([]);
        setSelectedIds([]);
        showToast(error.response?.data?.message || t('manual_error_recipients_load'), 'error');
      })
      .finally(() => {
        if (!cancelled && request === recipientLoadRef.current.request) setLoadingRecipients(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mode, form.cycle_id, includeOtherScopes]);

  const cycleOptions = useMemo(() => cycles.map((cycle) => ({
    value: cycle.id,
    label: `${cycle.title} (${cycle.year})`,
    description: Number(cycle.is_active) === 1 ? t('manual_active_cycle') : (cycle.company_name || t('manual_appraisal_cycle')),
  })), [cycles, t, locale]);

  const filteredEligible = useMemo(() => {
    const query = form.user_search.trim().toLowerCase();
    if (!query) return eligible;

    return eligible.filter((row) => [
      row.full_name,
      row.first_name,
      row.last_name,
      row.email,
      row.department,
      row.summary,
      row.role_label,
      row.role,
      row.staff_type,
      scopeLabel(scopeOf(row)),
      categoryLabel(categoryOf(row)),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [eligible, form.user_search, locale]);

  const groupedEligible = useMemo(() => {
    const categories = ['Supervisors', 'Staff', 'Other portal users'];
    return categories.map((name) => ({
      name,
      scopes: SCOPE_ORDER.map((scope) => ({
        scope,
        recipients: filteredEligible.filter((row) => categoryOf(row) === name && scopeOf(row) === scope),
      })).filter((group) => group.recipients.length > 0),
    })).filter((group) => group.scopes.length > 0);
  }, [filteredEligible]);

  const allSelected = filteredEligible.length > 0 && filteredEligible.every((row) => selectedIds.includes(Number(row.recipient_id)));
  const toggleAll = () => {
    const ids = filteredEligible.map((row) => Number(row.recipient_id));
    setSelectedIds((prev) => allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };
  const toggleRecipient = (id) => setSelectedIds((prev) => prev.includes(Number(id)) ? prev.filter((item) => item !== Number(id)) : [...prev, Number(id)]);

  const updateMode = (mode) => {
    userEditedRef.current = { subject: false, custom_message: false };
    setErrors({});
    setEligible([]);
    setSelectedIds([]);
    setIncludeOtherScopes(false);
    setCollapsedCategories({});
    setForm((prev) => ({
      ...prev,
      mode,
      subject: t(`manual_mode_${mode}_subject`),
      custom_message: ['specific_users', 'custom_emails'].includes(mode) ? '' : t(`manual_mode_${mode}_message`),
      emails: '',
      cc_emails: '',
      user_search: '',
    }));
  };

  const validate = () => {
    const next = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (config.requiresCycle && !form.cycle_id) next.cycle_id = 'manual_error_cycle';
    if (form.mode === 'custom_emails' && !form.emails.trim()) next.emails = 'manual_error_emails';

    const ccItems = form.cc_emails
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (ccItems.some((email) => !emailPattern.test(email))) {
      next.cc_emails = 'manual_error_cc';
    }
    if (ccItems.length > 20) {
      next.cc_emails = 'manual_error_cc_limit';
    }

    if (!form.subject.trim()) next.subject = 'manual_error_subject';
    if (!form.custom_message.trim()) next.custom_message = 'manual_error_message';
    if (form.mode !== 'custom_emails' && selectedIds.length === 0) next.recipients = 'manual_error_recipient';
    return next;
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, t('manual_error_validation'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        mode: form.mode,
        cycle_id: form.cycle_id || undefined,
        subject: form.subject.trim(),
        custom_message: form.custom_message.trim(),
        recipient_ids: form.mode !== 'custom_emails' ? selectedIds : undefined,
        include_other_scopes: ['pending_acknowledgements', 'cycle_supervisors'].includes(form.mode) && includeOtherScopes,
        emails: form.mode === 'custom_emails'
          ? form.emails.split(',').map((item) => item.trim()).filter(Boolean)
          : undefined,
        cc_emails: form.cc_emails
          ? form.cc_emails.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      };
      const response = await api.post('/mail/send', payload);
      showToast(response.data?.message || t('manual_sent'), 'success');
      if (form.mode === 'custom_emails') setForm((prev) => ({ ...prev, emails: '' }));
    } catch (error) {
      showToast(error.response?.data?.message || t('manual_send_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModuleShell className="mail-page">
      <PageNav pageTitle={t('manual_title')} links={[{ label: t('manual_dashboard'), to: '/dashboard', active: true }, { label: t('manual_title') }]} />

      <section className="mail-hero">
        <div>
          <p className="mail-eyebrow">{t('manual_eyebrow')}</p>
          <h2>{t('manual_heading')}</h2>
          <p>{t('manual_description')}</p>
        </div>
        <div className="mail-hero__badge">
          <strong>{formatNumber(eligible.length, {}, locale)}</strong>
          <span>{t(`manual_mode_${form.mode}_heading`)}</span>
        </div>
      </section>

      <form ref={formRef} className="mail-layout" onSubmit={submit} noValidate>
        <section className="mail-card mail-compose">
          <div className="mail-card__heading">
            <span><PenLine size={19} /></span>
            <div><h3>{t('manual_compose')}</h3><p>{t('manual_template_note')}</p></div>
          </div>

          <div className="mail-fields">
            <AppSelect
              label={t('manual_recipient_selection')}
              value={form.mode}
              onChange={updateMode}
              options={recipientModeOptions}
              clearable={false}
              searchable={false}
              icon={Users}
            />

            {config.requiresCycle && (
              <div data-invalid={errors.cycle_id ? 'true' : undefined}>
                <AppSelect
                  label={t('manual_cycle')}
                  value={form.cycle_id}
                  onChange={(value) => { setIncludeOtherScopes(false); setForm((prev) => ({ ...prev, cycle_id: value, user_search: '' })); }}
                  options={cycleOptions}
                  searchable
                  clearable={false}
                  placeholder={t('manual_select_cycle')}
                  icon={CalendarCheck}
                  error={errors.cycle_id ? t(errors.cycle_id) : ''}
                />
              </div>
            )}

            {form.mode === 'custom_emails' && (
              <label className="mail-field mail-field--wide" data-invalid={errors.emails ? 'true' : undefined}>
                <span>{t('manual_email_addresses')}</span>
                <input
                  name="recipient_emails"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  className={errors.emails ? 'mail-field--error' : ''}
                  aria-invalid={!!errors.emails}
                  value={form.emails}
                  onChange={(event) => setForm((prev) => ({ ...prev, emails: event.target.value }))}
                  placeholder="email1@lambertelectromec.com, email2@lambertelectromec.com"
                />
                {errors.emails && <small className="mail-error">{t(errors.emails)}</small>}
              </label>
            )}

            <label className="mail-field mail-field--wide" data-invalid={errors.subject ? 'true' : undefined}>
              <span>{t('manual_subject')}</span>
              <input name="email_subject" autoComplete="on" className={errors.subject ? 'mail-field--error' : ''} aria-invalid={!!errors.subject} value={form.subject} onChange={(event) => { userEditedRef.current.subject = true; setForm((prev) => ({ ...prev, subject: event.target.value })); }} />
              {errors.subject && <small className="mail-error">{t(errors.subject)}</small>}
            </label>

            <label className="mail-field mail-field--wide" data-invalid={errors.cc_emails ? 'true' : undefined}>
              <span>{t('manual_cc')} <em>{t('manual_optional')}</em></span>
              <input
                name="cc_emails"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                className={errors.cc_emails ? 'mail-field--error' : ''}
                aria-invalid={!!errors.cc_emails}
                value={form.cc_emails}
                onChange={(event) => setForm((prev) => ({ ...prev, cc_emails: event.target.value }))}
                placeholder="manager@company.com, hr@company.com"
              />
              <small className={errors.cc_emails ? 'mail-error' : 'mail-field-note'}>
                {errors.cc_emails ? t(errors.cc_emails) : t('manual_cc_note')}
              </small>
            </label>

            <label className="mail-field mail-field--wide" data-invalid={errors.custom_message ? 'true' : undefined}>
              <span>{t('manual_message')}</span>
              <textarea name="email_message" autoComplete="on" className={errors.custom_message ? 'mail-field--error' : ''} aria-invalid={!!errors.custom_message} value={form.custom_message} onChange={(event) => { userEditedRef.current.custom_message = true; setForm((prev) => ({ ...prev, custom_message: event.target.value })); }} placeholder={t('manual_message_placeholder')} />
              {errors.custom_message && <small className="mail-error">{t(errors.custom_message)}</small>}
            </label>
          </div>

          {errors.recipients && <p className="mail-error mail-error--panel"><AlertCircle size={15} /> {t(errors.recipients)}</p>}

          <div className="mail-actions">
            <button className="mail-btn mail-btn--primary" disabled={loading || loadingRecipients}>
              {loading ? <><span className="mail-spinner" /> {t('manual_sending')}</> : <><Send size={16} /> {t('manual_title')}</>}
            </button>
          </div>
        </section>

        <section className="mail-card mail-recipients" data-invalid={errors.recipients ? 'true' : undefined}>
          <div className="mail-card__heading mail-card__heading--between">
            <div className="mail-card__title"><span><RecipientIcon size={19} /></span><div><h3>{t(`manual_mode_${form.mode}_heading`)}</h3><p>{t(`manual_mode_${form.mode}_note`)}</p></div></div>
            {form.mode !== 'custom_emails' && eligible.length > 0 && (
              <button type="button" className="mail-link-btn" onClick={toggleAll}>{allSelected ? t('manual_clear_shown') : t('manual_select_shown')}</button>
            )}
          </div>

          {recipientMeta.can_expand && form.mode !== 'custom_emails' && (
            <div className="mail-scope-panel">
              <div className="mail-scope-panel__text">
                <ShieldCheck size={17} />
                <div>
                  <strong>{includeOtherScopes ? t('manual_all_scopes') : t('manual_scope_only', { scope: scopeLabel(recipientMeta.staff_scope) })}</strong>
                  <small>{includeOtherScopes
                    ? t('manual_other_scopes_info')
                    : t('manual_scope_info', { scope: scopeLabel(recipientMeta.staff_scope) })}</small>
                </div>
              </div>
              <button type="button" className="mail-scope-panel__toggle" disabled={loadingRecipients} onClick={() => setIncludeOtherScopes((prev) => !prev)}>
                {includeOtherScopes ? t('manual_scope_show_only', { scope: scopeLabel(recipientMeta.staff_scope) }) : t('manual_include_scopes')}
              </button>
            </div>
          )}

          {form.mode !== 'custom_emails' && eligible.length > 0 && (
            <div className="mail-recipient-search">
              <div className="mail-recipient-search__field">
                <Search size={16} />
                <input
                  value={form.user_search}
                  onChange={(event) => setForm((prev) => ({ ...prev, user_search: event.target.value }))}
                  name="recipient_search"
                  placeholder={t('manual_search_placeholder')}
                  aria-label={t('manual_search_accessibility')}
                  autoComplete="on"
                />
                {form.user_search && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, user_search: '' }))}
                    aria-label={t('manual_search_clear')}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <span>{t('manual_selection_summary', { selected: formatNumber(selectedIds.length, {}, locale), shown: formatNumber(filteredEligible.length, {}, locale), total: formatNumber(eligible.length, {}, locale) })}</span>
            </div>
          )}

          {form.mode === 'custom_emails' ? (
            <div className="mail-empty"><Mail size={22} /><h4>{t('manual_manual_enabled')}</h4><p>{t('manual_manual_detail')}</p></div>
          ) : loadingRecipients ? (
            <div className="mail-loading">{Array.from({ length: 4 }).map((_, index) => <span className="mail-skeleton" key={index} />)}</div>
          ) : eligible.length === 0 ? (
            <div className="mail-empty"><CircleCheck size={22} /><h4>{t('manual_no_eligible')}</h4><p>{t('manual_no_eligible_detail')}</p></div>
          ) : filteredEligible.length === 0 ? (
            <div className="mail-empty mail-empty--search"><UserX size={22} /><h4>{t('manual_no_matches')}</h4><p>{t('manual_no_matches_detail')}</p></div>
          ) : (
            <div className="mail-recipient-list">
              {form.mode === 'specific_users' ? groupedEligible.map(({ name, scopes }) => {
                const count = scopes.reduce((total, group) => total + group.recipients.length, 0);
                const collapsed = !!collapsedCategories[name];
                return (
                  <section className="mail-recipient-category" key={name}>
                    <button
                      className="mail-recipient-category__header"
                      type="button"
                      aria-expanded={!collapsed}
                      onClick={() => setCollapsedCategories((prev) => ({ ...prev, [name]: !prev[name] }))}
                    >
                      <Layers size={16} />
                      <strong>{categoryLabel(name)}</strong>
                      <span>{formatNumber(count, {}, locale)}</span>
                      <ChevronDown size={16} className={collapsed ? 'mail-recipient-category__chevron--closed' : ''} />
                    </button>
                    {!collapsed && scopes.map(({ scope, recipients }) => (
                      <div className="mail-recipient-scope" key={scope}>
                        <div className="mail-recipient-scope__heading"><span>{scope === 'Other' ? t('manual_unspecified_scope') : scopeLabel(scope)}</span><span>{formatNumber(recipients.length, {}, locale)}</span></div>
                        {recipients.map((row) => (
                          <label className={`mail-recipient ${selectedIds.includes(Number(row.recipient_id)) ? 'mail-recipient--selected' : ''}`} key={row.recipient_id}>
                            <input type="checkbox" checked={selectedIds.includes(Number(row.recipient_id))} onChange={() => toggleRecipient(row.recipient_id)} />
                            <span className="mail-recipient__avatar">{initials(row)}</span>
                            <span className="mail-recipient__details">
                              <strong>{row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim()}</strong>
                              <small>{row.email}</small>
                              <em>{row.summary || `${row.department || t('manual_no_department')} • ${row.role_label || row.role || t('manual_recipient_fallback')}`}</em>
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </section>
                );
              }) : filteredEligible.map((row) => (
                <label className={`mail-recipient ${selectedIds.includes(Number(row.recipient_id)) ? 'mail-recipient--selected' : ''}`} key={row.recipient_id}>
                  <input type="checkbox" checked={selectedIds.includes(Number(row.recipient_id))} onChange={() => toggleRecipient(row.recipient_id)} />
                  <span className="mail-recipient__avatar">{initials(row)}</span>
                  <span className="mail-recipient__details">
                    <strong>{row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim()}</strong>
                    <small>{row.email}</small>
                    <em>{row.summary || `${row.department || t('manual_no_department')} • ${row.role_label || row.role || t('manual_recipient_fallback')}`}</em>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
      </form>
    </ModuleShell>
  );
};

export default ManualEmail;
