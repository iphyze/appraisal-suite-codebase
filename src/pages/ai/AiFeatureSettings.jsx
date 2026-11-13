import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatNumber } from '../../utils/format';
import { featureName, featureDescription } from '../../utils/aiLabels';
import { Navigate } from 'react-router-dom';
import { Activity, Bell, Bot, BrainCircuit, ChartNoAxesCombined, Check, CircleAlert, ClipboardCheck, ClipboardList, FilePenLine, Gauge, LockKeyhole, Mail, MessageSquareText, PanelRight, Power, Scale, Search, ShieldCheck, SlidersHorizontal, Sparkles, Target, Trophy, X } from 'lucide-react';
import Header from '../Header';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import '../appraisals/Appraisals.css';
import NavBar from '../NavBar';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import { getAiBudget, getAiFeatureSettings, updateAiBudget, updateAiFeatureSetting } from '../../services/aiAssistant';
import './AiAssistant.css';
import './AiFeatureSettings.css';

const featureIcons = {
  master: Power, assistant: BrainCircuit, ask_panel: PanelRight, management_insights: ChartNoAxesCombined,
  writing_assistant: FilePenLine, development_plan: ClipboardList, setup_assistant: SlidersHorizontal,
  rankings: Trophy, calibration: Scale, alerts: Bell, smart_search: Search, fairness_check: ClipboardCheck,
  cycle_briefing: Gauge, progress: Activity, feedback_summary: MessageSquareText, explain_appraisal: Sparkles, reminder_drafts: Mail, kpi_suggestions: Target,
};
const fmtTokens = (value) => formatNumber(value || 0, {}, i18n.language);
const shortTokens = (value) => {
  const n = Number(value || 0);
  if (n >= 1000000) return `${formatNumber(n / 1000000, { maximumFractionDigits: 1 }, i18n.language)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
};
const LIMIT_PRESETS = [500000, 1000000, 2000000, 5000000];
const friendlyError = (error) => error?.response?.data?.message || error?.message || i18n.t('error_save', { ns: 'ai' });

export default function AiFeatureSettings() {
  const { t } = useTranslation('ai');
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [nav, setNav] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState('0');
  const [budgetWarn, setBudgetWarn] = useState(80);
  const [budgetReason, setBudgetReason] = useState('');

  useEffect(() => { document.title = `AppraisalSuite | ${t('settings_title')}`; }, [t]);
  useEffect(() => {
    if (user?.role !== 'super_admin') return undefined;
    let active = true;
    getAiBudget().then((data) => { if (active) setUsage(data); }).catch(() => {});
    getAiFeatureSettings()
      .then((data) => { if (active) setSettings(data); })
      .catch((err) => { if (active) setError(friendlyError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role]);

  // Display restriction is convenience only; the route itself is Super Admin protected.
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  const openBudget = () => {
    const current = settings?.budget || usage?.budget || {};
    setBudgetLimit(String(current.limit || 0));
    setBudgetWarn(current.warn_percent || 80);
    setBudgetReason('');
    setError('');
    setNotice('');
    setBudgetOpen(true);
  };
  const saveBudget = async (event) => {
    event.preventDefault();
    const limit = Number.parseInt(String(budgetLimit).replace(/[^0-9]/g, ''), 10) || 0;
    if (saving || budgetReason.trim().length < 5) return;
    setSaving(true);
    setError('');
    try {
      await updateAiBudget(limit, Number(budgetWarn), budgetReason.trim());
      const [refreshedSettings, refreshedUsage] = await Promise.all([getAiFeatureSettings(), getAiBudget()]);
      setSettings(refreshedSettings);
      setUsage(refreshedUsage);
      window.dispatchEvent(new Event('appraisalsuite:ai-settings-updated'));
      setNotice(limit > 0 ? { key: 'budget_set_success', tokens: limit } : { key: 'budget_removed_success' });
      setBudgetOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirm = async (event) => {
    event.preventDefault();
    if (!pending || saving || reason.trim().length < 5) return;
    setSaving(true);
    setError('');
    try {
      await updateAiFeatureSetting(pending.key, !pending.enabled, reason.trim());
      const [refreshed, refreshedUsage] = await Promise.all([getAiFeatureSettings(), getAiBudget().catch(() => null)]);
      setSettings(refreshed);
      if (refreshedUsage) setUsage(refreshedUsage);
      window.dispatchEvent(new Event('appraisalsuite:ai-settings-updated'));
      setNotice({ key: pending.enabled ? 'feature_disabled_success' : 'feature_enabled_success', featureKey: pending.key, fallbackLabel: pending.label });
      setPending(null);
      setReason('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page ap-ai ap-ai-settings theme-${theme}`}>
          <PageNav pageTitle={t('settings_title')} links={[{ label: t('dashboard'), to: '/dashboard' }, { label: t('settings_title') }]} />
          <section className="apr-hero ap-ai__hero ap-ai-settings__hero">
            <div className="ap-ai__intro">
              <span className="ap-ai__eyebrow"><Sparkles size={14} /> {t('settings_super_admin_control')}</span>
              <h1>{t('settings_heading')}</h1>
              <p>{t('settings_intro')}</p>
            </div>
            <div className="ap-ai-settings__hero-mark"><ShieldCheck size={19} /> {t('settings_permissions')}</div>
          </section>
          {!settings?.server_ready && settings && <div className="ap-ai__alert" role="status"><CircleAlert size={16} /> {t('settings_inactive')}</div>}
          {!!notice && <div className="ap-ai-settings__notice" role="status"><Check size={16} /> {t(notice.key, { tokens: notice.tokens != null ? fmtTokens(notice.tokens) : undefined, feature: notice.featureKey ? featureName(t, { key: notice.featureKey, label: notice.fallbackLabel }) : undefined })}</div>}
          {!!error && <div className="ap-ai__alert" role="alert">{error}</div>}
          {loading && <div className="ap-ai-settings__loading">{t('settings_loading')}</div>}
          {settings && <div className="ap-ai-settings__overview"><div className="ap-ai-settings__overview-icon"><ShieldCheck size={20} /></div>
            <div><strong>{t('settings_service_status')}</strong><p>{settings.server_ready ? t('settings_server_available') : t('settings_server_incomplete')}</p></div>
            <span className={`ap-ai-settings__status ${settings.server_ready ? 'ap-ai-settings__status--ready' : ''}`}>{settings.server_ready ? t('settings_server_ready') : t('settings_not_configured')}</span>
          </div>}
          {settings && (() => {
            const budget = usage?.budget || settings.budget || {};
            const limited = Number(budget.limit) > 0;
            const tone = budget.reached ? 'is-over' : budget.warning ? 'is-warn' : '';
            const byFeature = usage?.by_feature || [];
            const maxTokens = Math.max(1, ...byFeature.map((row) => row.tokens));
            return (
              <section className="ap-ai-budget" aria-labelledby="ap-ai-budget-title">
                <div className="ap-ai-budget__main">
                  <div className="ap-ai-budget__head">
                    <div>
                      <h2 id="ap-ai-budget-title">{t('budget_title')}</h2>
                      <p>{limited ? t('budget_resets', { date: formatDate(budget.resets_on, { day: 'numeric', month: 'long' }, i18n.language) }) : t('budget_unlimited_hint')}</p>
                    </div>
                    <button type="button" className="ap-ai-budget__edit" onClick={openBudget} disabled={budget.configured === false}>{t(limited ? 'budget_change' : 'budget_set')}</button>
                  </div>
                  <div className="ap-ai-budget__figures">
                    <strong>{fmtTokens(budget.used)}</strong>
                    <span>{limited ? t('budget_used_of', { tokens: fmtTokens(budget.limit) }) : t('budget_used_simple')}</span>
                  </div>
                  {limited && (
                    <div className={`ap-ai-budget__meter ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budget.percent} aria-label={t('budget_used_aria')}>
                      <span style={{ width: `${Math.min(100, budget.percent)}%` }} />
                      <i style={{ left: `${budget.warn_percent}%` }} aria-hidden="true" />
                    </div>
                  )}
                  <div className="ap-ai-budget__facts">
                    {limited && <span>{budget.reached ? t('budget_exhausted') : t('budget_remaining', { tokens: fmtTokens(budget.remaining) })}</span>}
                    <span>{t('budget_requests', { count: Number(budget.requests || 0), countFormatted: fmtTokens(budget.requests) })}</span>
                    {usage?.estimated_cost != null && <span>{t('budget_cost', { amount: formatNumber(usage.estimated_cost, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, i18n.language) })}</span>}
                  </div>
                  {budget.configured === false && <p className="ap-ai-budget__hint">{t('budget_migration')}</p>}
                </div>
                <div className="ap-ai-budget__usage">
                  <h3>{t('budget_usage_title')}</h3>
                  {byFeature.length === 0 && <p className="ap-ai-budget__hint">{t('budget_no_requests')}</p>}
                  <ul>
                    {byFeature.map((row) => (
                      <li key={row.feature}>
                        <span className="ap-ai-budget__feature">{featureName(t, { key: row.feature, label: row.label })}</span>
                        <span className="ap-ai-budget__bar"><span style={{ width: `${(row.tokens / maxTokens) * 100}%` }} /></span>
                        <span className="ap-ai-budget__num">{shortTokens(row.tokens)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })()}

          {settings && ['platform', 'available', 'planned'].map((group) => {
            const items = settings.features.filter((feature) => (feature.group || 'available') === group);
            if (!items.length) return null;
            const titles = {
              platform: [t('feature_group_platform_title'), t('feature_group_platform_info')],
              available: [t('feature_group_available_title'), t('feature_group_available_info')],
              planned: [t('feature_group_planned_title'), t('feature_group_planned_info')],
            };
            return (
              <section key={group} className={`ap-ai-settings__group ap-ai-settings__group--${group}`}>
                <div className="ap-ai-settings__group-head"><h2>{titles[group][0]}</h2><p>{titles[group][1]}</p></div>
                <div className="ap-ai-settings__grid">
                  {items.map((feature) => {
                    const FeatureIcon = featureIcons[feature.key] || Bot;
                    const blockedBy = feature.requires && settings.features.find((f) => f.key === feature.requires && !f.enabled);
                    return <section key={feature.key} className={`ap-ai-settings__card ${feature.key === 'master' ? 'ap-ai-settings__card--master' : ''} ${!feature.released ? 'is-planned' : ''}`}>
                      <div className="ap-ai-settings__icon"><FeatureIcon size={20} /></div>
                      <div className="ap-ai-settings__detail">
                        <h2>{featureName(t, feature)}</h2>
                        <p>{featureDescription(t, feature)}</p>
                        <div className="ap-ai-settings__badges">
                          {feature.released
                            ? <span className={`ap-ai-settings__state ${feature.enabled ? 'ap-ai-settings__state--on' : ''}`}>{t(feature.enabled ? 'feature_on' : 'feature_off')}</span>
                            : <span className="ap-ai-settings__soon">{t('feature_planned')}</span>}
                          {feature.key !== 'master' && (
                            <span className={`ap-ai-settings__tokens ${feature.token_mode === 'never' || (!feature.token_mode && !feature.uses_tokens) ? 'is-free' : ''}`}>
                              {t(feature.token_mode === 'optional' ? 'feature_optional' : feature.uses_tokens ? 'feature_uses_tokens' : 'feature_no_tokens')}
                            </span>
                          )}
                          {blockedBy && feature.enabled && <span className="ap-ai-settings__needs">{t('feature_requires', { feature: featureName(t, blockedBy) })}</span>}
                        </div>
                      </div>
                      <button type="button" className="ap-ai-settings__switch" role="switch" aria-checked={feature.enabled}
                        aria-label={t('feature_state', { feature: featureName(t, feature), state: t(feature.enabled ? 'feature_on' : 'feature_off') })}
                        disabled={(!feature.released && !feature.enabled) || !!pending}
                        onClick={() => { setPending(feature); setReason(''); setError(''); setNotice(''); }}>
                        <span className="ap-ai-settings__knob" />
                      </button>
                    </section>;
                  })}
                </div>
              </section>
            );
          })}
          <p className="ap-ai-settings__footnote"><ShieldCheck size={16} /> {t('settings_footnote')}</p>
        </div>
      </main>
      {pending && <div className={`ap-ai-settings__overlay theme-${theme}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPending(null); }}>
        <form className="ap-ai-settings__modal" role="dialog" aria-modal="true" aria-labelledby="ap-ai-confirm-title" onSubmit={confirm}>
          <div className="ap-ai-settings__modal-head"><span><LockKeyhole size={16} /> {t('approval_title')}</span><button type="button" disabled={saving} aria-label={t('approval_cancel_change')} onClick={() => setPending(null)}><X size={18} /></button></div>
          <h2 id="ap-ai-confirm-title">{t(pending.enabled ? 'approval_question_disable' : 'approval_question_enable', { feature: featureName(t, pending) })}</h2>
          <p>{t('approval_explain')}</p>
          <label htmlFor="ap-ai-change-reason">{t('approval_reason')} <span>*</span></label>
          <textarea id="ap-ai-change-reason" rows={3} maxLength={500} minLength={5} required value={reason} autoFocus
            onChange={(event) => setReason(event.target.value)} placeholder={t('approval_reason_placeholder')} />
          <div className="ap-ai-settings__modal-actions"><button type="button" onClick={() => setPending(null)} disabled={saving}>{t('action_cancel')}</button><button type="submit" disabled={saving || reason.trim().length < 5}>{t(saving ? 'action_saving' : 'approval_confirm')}</button></div>
        </form>
      </div>}
      {budgetOpen && <div className={`ap-ai-settings__overlay theme-${theme}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setBudgetOpen(false); }}>
        <form className="ap-ai-settings__modal ap-ai-budget__modal" role="dialog" aria-modal="true" aria-labelledby="ap-ai-budget-modal-title" onSubmit={saveBudget}>
          <div className="ap-ai-settings__modal-head"><span><LockKeyhole size={16} /> {t('approval_title')}</span><button type="button" disabled={saving} aria-label={t('action_cancel')} onClick={() => setBudgetOpen(false)}><X size={18} /></button></div>
          <h2 id="ap-ai-budget-modal-title">{t('budget_title')}</h2>
          <p>{t('budget_modal_info')}</p>
          <label htmlFor="ap-ai-budget-limit">{t('budget_tokens_label')}</label>
          <input id="ap-ai-budget-limit" inputMode="numeric" value={fmtTokens(String(budgetLimit).replace(/[^0-9]/g, '') || 0)}
            onChange={(event) => setBudgetLimit(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))} />
          <div className="ap-ai-budget__presets">
            {LIMIT_PRESETS.map((value) => <button type="button" key={value} className={Number(budgetLimit) === value ? 'is-on' : ''} onClick={() => setBudgetLimit(String(value))}>{shortTokens(value)}</button>)}
            <button type="button" className={Number(budgetLimit) === 0 ? 'is-on' : ''} onClick={() => setBudgetLimit('0')}>{t('budget_no_limit')}</button>
          </div>
          <AppSelect name="ap-ai-budget-warn" label={t('budget_warn_at')} value={budgetWarn}
            onChange={(value) => setBudgetWarn(Number(value))} clearable={false} disabled={saving}
            options={[60, 70, 80, 90].map((value) => ({ value, label: t('budget_warning_percent', { percent: formatNumber(value, {}, i18n.language) }) }))} />
          <label htmlFor="ap-ai-budget-reason">{t('approval_reason')} <span>*</span></label>
          <textarea id="ap-ai-budget-reason" rows={3} maxLength={500} required value={budgetReason}
            onChange={(event) => setBudgetReason(event.target.value)} placeholder={t('budget_reason_example')} />
          <div className="ap-ai-settings__modal-actions"><button type="button" onClick={() => setBudgetOpen(false)} disabled={saving}>{t('action_cancel')}</button><button type="submit" disabled={saving || budgetReason.trim().length < 5}>{t(saving ? 'action_saving' : 'budget_save')}</button></div>
        </form>
      </div>}
    </div>
  );
}
