import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime, formatNumber } from '../../utils/format';
import { Navigate } from 'react-router-dom';
import { Check, CircleAlert, Cloud, History, KeyRound, LockKeyhole, Repeat2, Send, Server, ShieldCheck, X } from 'lucide-react';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import { getMailDelivery, sendMailDeliveryTest, updateMailDelivery } from '../../services/mailDelivery';
import '../appraisals/Appraisals.css';
import '../ai/AiAssistant.css';
import '../ai/AiFeatureSettings.css';
import './EmailDeliverySettings.css';

const PROVIDERS = {
  graph: {
    label: 'Microsoft 365', icon: Cloud,
  },
  smtp: {
    label: 'SMTP', icon: Server,
  },
};
const other = (provider) => (provider === 'graph' ? 'smtp' : 'graph');
const friendlyError = (error, t) => error?.response?.data?.message || error?.message || t('delivery_error_save');

/** Server times are UTC ("YYYY-MM-DD HH:MM:SS"). */
const when = (value, locale) => {
  if (!value) return null;
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : formatDateTime(date, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }, locale);
};
const longDate = (value, locale) => (value ? formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' }, locale) : '');

/** Working, needs attention or no traffic yet, from the latest send and failure times. */
const health = (stats) => {
  if (!stats?.last_sent_at && !stats?.last_failed_at) return { tone: '', key: 'delivery_health_none' };
  if (stats.last_failed_at && (!stats.last_sent_at || stats.last_failed_at > stats.last_sent_at)) return { tone: 'is-error', key: 'delivery_health_failed' };
  return { tone: 'is-ok', key: 'delivery_health_working' };
};

export default function EmailDeliverySettings() {
  const { t, i18n } = useTranslation('mail');
  const locale = i18n.language;
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [nav, setNav] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [tests, setTests] = useState({});
  const [testFor, setTestFor] = useState('');
  const [testTo, setTestTo] = useState('');
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim());

  useEffect(() => { document.title = t('delivery_document_title'); }, [t, locale]);
  useEffect(() => {
    if (user?.role !== 'super_admin') return undefined;
    let active = true;
    getMailDelivery()
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(friendlyError(err, t)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role]);

  // Display restriction is convenience only; the routes themselves are Super Admin protected.
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  const activeKey = data?.active_provider;
  const backupKey = activeKey ? other(activeKey) : null;

  const openChange = (change) => { setPending(change); setReason(''); setError(''); setNotice(''); };
  const confirm = async (event) => {
    event.preventDefault();
    if (!pending || saving || reason.trim().length < 5) return;
    setSaving(true);
    setError('');
    try {
      const result = await updateMailDelivery(pending.provider, pending.fallback, reason.trim());
      setData(result);
      setNotice(pending.kind === 'provider'
        ? { key: 'delivery_notice_provider', values: { provider: PROVIDERS[pending.provider].label } }
        : { key: 'delivery_notice_backup', fallback: pending.fallback });
      setPending(null);
    } catch (err) {
      setError(friendlyError(err, t));
    } finally {
      setSaving(false);
    }
  };

  const openTest = (provider) => {
    setTestFor(provider);
    setTestTo((current) => current || data?.test_default_to || '');
    setTests((prev) => ({ ...prev, [provider]: null }));
  };
  const runTest = async (event, provider) => {
    event.preventDefault();
    if (testing || !emailLooksValid) return;
    setTesting(provider);
    setTests((prev) => ({ ...prev, [provider]: null }));
    try {
      const result = await sendMailDeliveryTest(provider, testTo.trim());
      if (result?.sent) setTestFor('');
      setTests((prev) => ({ ...prev, [provider]: { ok: !!result?.sent, text: result?.message } }));
      setData(await getMailDelivery());
    } catch (err) {
      setTests((prev) => ({ ...prev, [provider]: { ok: false, text: friendlyError(err, t) } }));
    } finally {
      setTesting('');
    }
  };

  const graph = data?.providers?.graph;
  const secret = graph?.configured ? graph.secret : null;
  const activeHealth = data ? health(data.providers[activeKey]?.stats) : null;

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page ap-ai ap-ai-settings em-delivery theme-${theme}`}>
          <PageNav pageTitle={t('delivery_title')} links={[{ label: t('delivery_dashboard'), to: '/dashboard' }, { label: t('delivery_title') }]} />
          <section className="apr-hero ap-ai__hero ap-ai-settings__hero">
            <div className="ap-ai__intro">
              <span className="ap-ai__eyebrow"><Send size={14} /> {t('delivery_super_admin_control')}</span>
              <h1>{t('delivery_heading')}</h1>
              <p>{t('delivery_description')}</p>
            </div>
            <div className="ap-ai-settings__hero-mark"><ShieldCheck size={19} /> {t('delivery_permission_controlled')}</div>
          </section>

          {!!notice && <div className="ap-ai-settings__notice" role="status"><Check size={16} /> {notice.key === 'delivery_notice_backup' ? t(notice.key, { state: t(notice.fallback ? 'delivery_on' : 'delivery_off') }) : t(notice.key, notice.values)}</div>}
          {!!error && <div className="ap-ai__alert" role="alert">{error}</div>}
          {loading && <div className="ap-ai-settings__loading">{t('delivery_loading')}</div>}
          {data && !data.stored && <div className="ap-ai__alert" role="status"><CircleAlert size={16} /> {t('delivery_migration_notice', { provider: PROVIDERS[activeKey].label })}</div>}
          {secret?.state === 'expired' && <div className="ap-ai__alert" role="alert"><KeyRound size={16} /> {t('delivery_expired_secret', { date: longDate(secret.date, locale) })}</div>}
          {secret?.state === 'soon' && <div className="em-delivery__warn" role="status"><KeyRound size={16} /> {t('delivery_secret_soon', { count: Number(secret.days_left), date: longDate(secret.date, locale) })}</div>}

          {data && (
            <div className="ap-ai-settings__overview">
              <div className="ap-ai-settings__overview-icon">{React.createElement(PROVIDERS[activeKey].icon, { size: 20 })}</div>
              <div>
                <strong>{t('delivery_current_provider', { provider: PROVIDERS[activeKey].label })}</strong>
                <p>
                  {t('delivery_backup_summary', { provider: PROVIDERS[backupKey].label, state: t(data.fallback_enabled ? 'delivery_on' : 'delivery_off') })}
                  {data.updated_by && when(data.updated_at, locale) ? t('delivery_last_change', { by: data.updated_by, date: when(data.updated_at, locale) }) : ''}
                </p>
              </div>
              <span className={`ap-ai-settings__status ${activeHealth.tone === 'is-ok' ? 'ap-ai-settings__status--ready' : ''} ${activeHealth.tone === 'is-error' ? 'em-delivery__status--error' : ''}`}>{t(activeHealth.key)}</span>
            </div>
          )}

          {data && (
            <section className="ap-ai-settings__group">
              <div className="ap-ai-settings__group-head"><h2>{t('delivery_methods')}</h2><p>{t('delivery_methods_description')}</p></div>
              <div className="em-delivery__grid">
                {['graph', 'smtp'].map((key) => {
                  const provider = data.providers[key];
                  const meta = PROVIDERS[key];
                  const Icon = meta.icon;
                  const isActive = key === activeKey;
                  const stats = provider.stats || {};
                  const state = health(stats);
                  const test = tests[key];
                  const usedPercent = provider.daily ? Math.min(100, Math.round((provider.daily.used / provider.daily.limit) * 100)) : 0;
                  return (
                    <section key={key} className={`em-delivery__card ${isActive ? 'is-active' : ''}`} aria-labelledby={`em-${key}-title`}>
                      <div className="em-delivery__card-head">
                        <div className="ap-ai-settings__icon"><Icon size={20} /></div>
                        <div className="em-delivery__card-title">
                          <h3 id={`em-${key}-title`}>{meta.label}</h3>
                          <p>{t(`delivery_${key}_description`)}</p>
                        </div>
                        <span className={`em-delivery__badge ${isActive ? 'is-active' : ''}`}>{t(isActive ? 'delivery_in_use' : 'delivery_standby')}</span>
                      </div>

                      {provider.configured ? (
                        <dl className="em-delivery__facts">
                          <div><dt>{t('delivery_sends_from')}</dt><dd>{provider.sender || '—'}</dd></div>
                          {key === 'smtp' && <div><dt>{t('delivery_mail_server')}</dt><dd>{provider.host || '—'}</dd></div>}
                          {key === 'graph' && (
                            <div><dt>{t('delivery_client_secret')}</dt><dd className={secret?.state === 'soon' || secret?.state === 'expired' ? 'is-warn' : ''}>
                              {secret?.date ? t(secret.state === 'expired' ? 'delivery_expired' : 'delivery_expires', { date: longDate(secret.date, locale) }) : t('delivery_expiry_unknown')}
                            </dd></div>
                          )}
                          <div><dt>{t('delivery_status')}</dt><dd><span className={`em-delivery__dot ${state.tone}`} aria-hidden="true" />{t(state.key)}</dd></div>
                          <div><dt>{t('delivery_last_successful')}</dt><dd>{when(stats.last_sent_at, locale) || t('delivery_not_yet')}</dd></div>
                          <div><dt>{t('delivery_last_24h')}</dt><dd>{t('delivery_stats_sent', { count: formatNumber(stats.sent_24h, {}, locale) })}{stats.failed_24h ? t('delivery_stats_failed', { count: formatNumber(stats.failed_24h, {}, locale) }) : ''}</dd></div>
                        </dl>
                      ) : (
                        <div className="em-delivery__setup">
                          <LockKeyhole size={15} aria-hidden="true" />
                          <div>
                            <strong>{t('delivery_not_configured')}</strong>
                            <p>{t('delivery_missing_settings', { settings: provider.missing.join(', ') })}</p>
                          </div>
                        </div>
                      )}

                      {key === 'graph' && provider.configured && provider.daily && (
                        <div className="em-delivery__meter-wrap">
                          <div className="em-delivery__meter-label"><span>{t('delivery_daily_limit')}</span><span>{t('delivery_daily_usage', { used: formatNumber(provider.daily.used, {}, locale), limit: formatNumber(provider.daily.limit, {}, locale) })}</span></div>
                          <div className={`ap-ai-budget__meter ${usedPercent >= 90 ? 'is-over' : usedPercent >= 75 ? 'is-warn' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPercent} aria-label={t('delivery_daily_meter_label')}>
                            <span style={{ width: `${usedPercent}%` }} />
                          </div>
                          <p className="em-delivery__hint">{t('delivery_rate', { count: formatNumber(provider.per_minute, {}, locale) })}</p>
                        </div>
                      )}

                      {stats.last_error && state.tone === 'is-error' && !test && (
                        <p className="em-delivery__error"><CircleAlert size={14} aria-hidden="true" /> {stats.last_error}</p>
                      )}

                      {testFor === key && (
                        <form className="em-delivery__test-form" onSubmit={(event) => runTest(event, key)}>
                          <label htmlFor={`em-test-to-${key}`}>{t('delivery_test_recipient')}</label>
                          <div className="em-delivery__test-row">
                            <input id={`em-test-to-${key}`} type="email" inputMode="email" autoComplete="email" autoFocus maxLength={254}
                              value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="name@example.com"
                              aria-invalid={testTo.trim() !== '' && !emailLooksValid} disabled={!!testing} />
                            <button type="submit" className="em-delivery__btn em-delivery__btn--primary" disabled={!emailLooksValid || !!testing}>
                              <Send size={14} /> {t(testing === key ? 'delivery_sending' : 'delivery_send')}
                            </button>
                            <button type="button" className="em-delivery__btn" onClick={() => setTestFor('')} disabled={!!testing}>{t('delivery_cancel')}</button>
                          </div>
                          <p className="em-delivery__hint">{t('delivery_test_note')}</p>
                        </form>
                      )}

                      <div className="em-delivery__actions">
                        {testFor !== key && (
                          <button type="button" className="em-delivery__btn" onClick={() => openTest(key)} disabled={!provider.configured || !!testing}>
                            <Send size={14} /> {t('delivery_send_test')}
                          </button>
                        )}
                        {isActive ? (
                          <span className="em-delivery__current"><Check size={14} /> {t('delivery_current_method')}</span>
                        ) : (
                          <button type="button" className="em-delivery__btn em-delivery__btn--primary" disabled={!provider.configured || !data.stored || !!pending}
                            onClick={() => openChange({ kind: 'provider', provider: key, fallback: data.fallback_enabled })}>
                            {t('delivery_use', { provider: meta.label })}
                          </button>
                        )}
                      </div>
                      {test && (
                        <p className={`em-delivery__test ${test.ok ? 'is-ok' : 'is-error'}`} role="status">
                          {test.ok ? <Check size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />} {test.text}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
          )}

          {data && (
            <section className="ap-ai-settings__group">
              <div className="ap-ai-settings__group-head"><h2>{t('delivery_automatic_backup')}</h2><p>{t('delivery_backup_note')}</p></div>
              <div className="ap-ai-settings__grid">
                <section className="ap-ai-settings__card ap-ai-settings__card--master">
                  <div className="ap-ai-settings__icon"><Repeat2 size={20} /></div>
                  <div className="ap-ai-settings__detail">
                    <h2>{t('delivery_retry', { backup: PROVIDERS[backupKey].label, active: PROVIDERS[activeKey].label })}</h2>
                    <p>{t('delivery_retry_description')}</p>
                    <div className="ap-ai-settings__badges">
                      <span className={`ap-ai-settings__state ${data.fallback_enabled ? 'ap-ai-settings__state--on' : ''}`}>{t(data.fallback_enabled ? 'delivery_on' : 'delivery_off')}</span>
                      {!data.providers[backupKey].configured && <span className="ap-ai-settings__needs">{t('delivery_backup_unavailable', { provider: PROVIDERS[backupKey].label })}</span>}
                    </div>
                  </div>
                  <button type="button" className="ap-ai-settings__switch" role="switch" aria-checked={data.fallback_enabled}
                    aria-label={t('delivery_backup_aria', { state: t(data.fallback_enabled ? 'delivery_on' : 'delivery_off') })} disabled={!data.stored || !!pending}
                    onClick={() => openChange({ kind: 'fallback', provider: activeKey, fallback: !data.fallback_enabled })}>
                    <span className="ap-ai-settings__knob" />
                  </button>
                </section>
              </div>
            </section>
          )}

          {data && (
            <section className="ap-ai-settings__group">
              <div className="ap-ai-settings__group-head"><h2>{t('delivery_recent_changes')}</h2><p>{t('delivery_changes_audit')}</p></div>
              <div className="em-delivery__history">
                {data.history.length === 0 ? (
                  <p className="em-delivery__empty"><History size={15} aria-hidden="true" /> {t('delivery_no_changes', { provider: PROVIDERS[activeKey].label })}</p>
                ) : (
                  <ul>
                    {data.history.map((item, index) => (
                      <li key={`${item.at}-${index}`}>
                        <div className="em-delivery__history-main">
                          <strong>{item.from === item.to ? t('delivery_history_backup', { state: t(item.backup_to ? 'delivery_on' : 'delivery_off') }) : t('delivery_history_switch', { from: PROVIDERS[item.from]?.label || item.from, to: PROVIDERS[item.to]?.label || item.to })}</strong>
                          <span>{item.reason}</span>
                        </div>
                        <div className="em-delivery__history-meta"><span>{item.by}</span><span>{when(item.at, locale)}</span></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          <p className="ap-ai-settings__footnote"><ShieldCheck size={14} /> {t('delivery_footer')}</p>
        </div>
      </main>

      {pending && (
        <div className={`ap-ai-settings__overlay theme-${theme}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPending(null); }}>
          <form className="ap-ai-settings__modal" role="dialog" aria-modal="true" aria-labelledby="em-delivery-modal-title" onSubmit={confirm}>
            <div className="ap-ai-settings__modal-head"><span><LockKeyhole size={16} /> {t('delivery_approval')}</span><button type="button" disabled={saving} aria-label={t('delivery_cancel')} onClick={() => setPending(null)}><X size={18} /></button></div>
            {pending.kind === 'provider' ? (
              <>
                <h2 id="em-delivery-modal-title">{t('delivery_dialog_provider', { provider: PROVIDERS[pending.provider].label })}</h2>
                <p>{t('delivery_dialog_provider_details', { provider: PROVIDERS[pending.provider].label })}
                  {t(tests[pending.provider]?.ok ? 'delivery_dialog_test_succeeded' : 'delivery_dialog_test_first')}</p>
              </>
            ) : (
              <>
                <h2 id="em-delivery-modal-title">{t('delivery_dialog_backup', { state: t(pending.fallback ? 'delivery_enable' : 'delivery_disable') })}</h2>
                <p>{pending.fallback
                  ? t('delivery_dialog_backup_on', { active: PROVIDERS[activeKey].label, backup: PROVIDERS[backupKey].label })
                  : t('delivery_dialog_backup_off', { active: PROVIDERS[activeKey].label })}</p>
              </>
            )}
            <label htmlFor="em-delivery-reason">{t('delivery_reason')} <span>*</span></label>
            <textarea id="em-delivery-reason" rows={4} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)}
              placeholder={pending.kind === 'provider'
                ? t(pending.provider === 'graph' ? 'delivery_reason_provider_graph' : 'delivery_reason_provider_smtp', { provider: PROVIDERS[pending.provider].label })
                : t('delivery_reason_backup')} />
            <div className="ap-ai-settings__modal-actions">
              <button type="button" onClick={() => setPending(null)} disabled={saving}>{t('delivery_cancel')}</button>
              <button type="submit" disabled={saving || reason.trim().length < 5}>{t(saving ? 'delivery_saving' : 'delivery_confirm')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
