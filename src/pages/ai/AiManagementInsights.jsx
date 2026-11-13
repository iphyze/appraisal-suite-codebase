import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDateTime, formatNumber, formatScore } from '../../utils/format';
import { translatedRatingBand } from '../../utils/analyticsLabels';
import { Navigate } from 'react-router-dom';
import { Activity, ArrowRight, ChartColumnIncreasing, CircleAlert, ClipboardCheck, FileSpreadsheet, MessageSquareWarning, RefreshCw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Header from '../Header';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import '../appraisals/Appraisals.css';
import NavBar from '../NavBar';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import { downloadAiManagementInsightsExcel, generateAiManagementNarrative, getAiManagementInsights } from '../../services/aiAssistant';
import AiMessageContent from '../../components/ai/AiMessageContent';

const savedWhen = (value, t) => {
  const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null;
  return date && !Number.isNaN(date.getTime())
    ? formatDateTime(date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }, i18n.language)
    : t('saved_earlier');
};
import './AiAssistant.css';
import './AiManagementInsights.css';

const options = [
  { value: 'overview', labelKey: 'insights_option_overview' },
  { value: 'departments', labelKey: 'insights_option_departments' },
  { value: 'follow_ups', labelKey: 'insights_option_followups' },
];
const errorMessage = (err) => err?.response?.data?.message || err?.message || 'insights_load_error';
const fmt = (n) => formatScore(n, i18n.language);
const fmtCount = (n) => formatNumber(n, {}, i18n.language);

export default function AiManagementInsights() {
  const { t, i18n: languageContext } = useTranslation('analytics');
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const [nav, setNav] = useState(false);
  // Invalidates any pending request after context/role/cycle changes.
  const requestEpoch = useRef(0);
  const [cycleId, setCycleId] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState('overview');
  const [narrative, setNarrative] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const roleAllowed = ['admin', 'super_admin'].includes(user?.role);
  const contextKey = `${user?.id || ''}:${user?.role || ''}:${user?.company_id || ''}:${viewCompanyId || ''}`;
  const lastLoadedScope = useRef('');

  useEffect(() => { document.title = t('insights_document_title'); }, [t, languageContext.language]);
  useEffect(() => {
    if (!roleAllowed) return undefined;
    const epoch = ++requestEpoch.current;
    const sameScope = lastLoadedScope.current === contextKey;
    lastLoadedScope.current = contextKey;
    const requestedCycle = sameScope ? cycleId : 0;
    setGenerating(false);
    if (!sameScope) setCycleId(0);
    setReport(null);
    setNarrative(null);
    setError('');
    setLoading(true);
    getAiManagementInsights(requestedCycle)
      .then((result) => { if (epoch === requestEpoch.current) { setReport(result); setCycleId(result?.cycle_id || 0); } })
      .catch((err) => { if (epoch === requestEpoch.current) setError(errorMessage(err)); })
      .finally(() => { if (epoch === requestEpoch.current) setLoading(false); });
    return () => { ++requestEpoch.current; };
  }, [contextKey, roleAllowed, languageContext.language]);

  const reload = async (id) => {
    const epoch = ++requestEpoch.current;
    setLoading(true);
    setError('');
    setNarrative(null);
    try {
      const result = await getAiManagementInsights(id);
      if (epoch === requestEpoch.current) { setReport(result); setCycleId(result?.cycle_id || 0); }
    } catch (err) { if (epoch === requestEpoch.current) { setReport(null); setError(errorMessage(err)); } }
    finally { if (epoch === requestEpoch.current) setLoading(false); }
  };

  const generate = async (refresh = false) => {
    if ((Number(report?.summary?.unique_staff) || 0) < 3 || generating) return;
    setGenerating(true);
    setError('');
    setNarrative(null);
    const requestedCycle = report.cycle_id;
    const epoch = requestEpoch.current;
    try {
      const result = await generateAiManagementNarrative(requestedCycle, focus, refresh);
      if (epoch === requestEpoch.current && result?.cycle_id === requestedCycle) setNarrative(result);
    } catch (err) { if (epoch === requestEpoch.current) setError(errorMessage(err)); }
    finally { if (epoch === requestEpoch.current) setGenerating(false); }
  };

  const downloadExcel = async () => {
    if (!report?.cycle_id || loading || exporting) return;
    const expectedCycleId = report.cycle_id;
    const epoch = requestEpoch.current;
    setExporting(true);
    setError('');
    try {
      const file = await downloadAiManagementInsightsExcel(expectedCycleId);
      // A context/cycle change while downloading must never export stale data.
      if (epoch !== requestEpoch.current) return;
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      const selectedCycle = report.cycles?.find((cycle) => Number(cycle.id) === Number(expectedCycleId));
      link.download = `${languageContext.language === 'fr' ? 'Analyses_IA_Direction' : 'AI_Management_Insights'}_${selectedCycle?.year || 'Cycle'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      let message = 'insights_export_error';
      if (err?.response?.data instanceof Blob) {
        try { message = JSON.parse(await err.response.data.text())?.message || message; } catch { /* Non-JSON error. */ }
      } else message = errorMessage(err);
      if (epoch === requestEpoch.current) setError(message);
    } finally {
      setExporting(false);
    }
  };

  if (!roleAllowed) return <Navigate to="/dashboard" replace />;
  const summary = report?.summary || {};
  const total = summary.appraisals || 0;
  const distributionMax = Math.max(1, ...((report?.distribution || []).map((d) => Number(d.count) || 0)));
  const departments = report?.departments || [];

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page theme-${theme} ap-ai ap-mi`}>
          <PageNav pageTitle={t('insights_title')} links={[{ label: t('dashboard'), to: '/dashboard' }, { label: t('insights_title') }]} />
          <section className="apr-hero ap-ai__hero ap-mi__heading">
            <div className="ap-ai__intro">
              <span className="ap-ai__eyebrow"><Sparkles size={14} /> {t('insights_eyebrow')}</span>
              <h1>{t('insights_title')}</h1>
              <p>{t('insights_intro')}</p>
            </div>
            <div className="ap-mi__filters">
              <AppSelect label={t('insights_cycle')} value={cycleId} onChange={(value) => reload(Number(value))} clearable={false} searchable
                placeholder={t('insights_no_cycles')} disabled={loading || generating || !report?.cycles?.length}
                options={(report?.cycles || []).map((cycle) => ({ value: cycle.id, label: `${cycle.title} (${cycle.year})` }))} />
              <button type="button" className="ap-mi__export" onClick={downloadExcel}
                disabled={loading || exporting || !report?.cycle_id}
                aria-label={t('insights_export_aria')} title={t('insights_export_title')}>
                <FileSpreadsheet size={17} /> {exporting ? t('preparing_excel') : t('export_excel')}
              </button>
              <button type="button" className="ap-mi__refresh" onClick={() => reload(cycleId)} disabled={loading || generating || exporting} title={t('insights_refresh')} aria-label={t('insights_refresh')}><RefreshCw size={17} /></button>
            </div>
          </section>

          {error && <div className="ap-ai__alert" role="alert"><CircleAlert size={16} /> {['insights_load_error', 'insights_export_error'].includes(error) ? t(error) : error}</div>}
          {loading && <div className="ap-mi__empty" role="status">{t('insights_loading')}</div>}
          {!loading && report && <>
            <div className="ap-mi__notice"><ShieldCheck size={17} /> {t('insights_notice')}</div>
            <div className="ap-mi__stat-grid">
              {[
                { label: t('insights_appraisals_recorded'), value: fmtCount(total), Icon: Users, hint: t('insights_appraisals_hint') },
                { label: t('insights_average_score'), value: fmt(summary.average_score), Icon: ChartColumnIncreasing, hint: t('insights_average_hint') },
                { label: t('stage_awaiting_ack'), value: fmtCount(summary.pending_acknowledgements ?? 0), Icon: ClipboardCheck, hint: t('insights_pending_hint') },
                { label: t('insights_open_followups'), value: fmtCount(Number(summary.open_follow_ups || 0) + Number(summary.responded_follow_ups || 0)), Icon: MessageSquareWarning, hint: t('insights_followups_hint') },
              ].map(({ label, value, Icon, hint }) => <article className="ap-mi__stat" key={label}>
                <span className="ap-mi__stat-icon"><Icon size={18} /></span>
                <span className="ap-mi__stat-label">{label}</span>
                <span className="ap-mi__stat-value">{value}</span>
                <span className="ap-mi__stat-hint">{hint}</span>
              </article>)}
            </div>

            <div className="ap-mi__columns">
              <section className="ap-mi__panel">
                <div className="ap-mi__panel-head"><div><span className="ap-mi__kicker">{t('insights_kicker_performance')}</span><h2>{t('insights_distribution')}</h2></div><Activity size={20} /></div>
                {total ? <div className="ap-mi__bars">{(report.distribution || []).map((group) => <div className="ap-mi__bar-row" key={group.label}>
                  <div><span>{translatedRatingBand(t, group)}</span><strong>{fmtCount(group.count)}</strong></div>
                  <div className="ap-mi__bar-track"><div className="ap-mi__bar-fill" style={{ width: `${Math.max(0, (group.count / distributionMax) * 100)}%` }} /></div>
                </div>)}</div> : <p className="ap-mi__muted">{t('insights_no_records')}</p>}
              </section>
              <section className="ap-mi__panel">
                <div className="ap-mi__panel-head"><div><span className="ap-mi__kicker">{t('insights_kicker_actions')}</span><h2>{t('insights_review_queue')}</h2></div><ClipboardCheck size={20} /></div>
                <div className="ap-mi__action-list">
                  <div><span>{t('insights_awaiting_staff')}</span><strong>{fmtCount(summary.pending_acknowledgements || 0)}</strong></div>
                  <div><span>{t('insights_open_management')}</span><strong>{fmtCount(summary.open_follow_ups || 0)}</strong></div>
                  <div><span>{t('insights_responses_pending')}</span><strong>{fmtCount(summary.responded_follow_ups || 0)}</strong></div>
                  <div><span>{t('insights_safety_pending')}</span><strong>{fmtCount(summary.pending_breach_reviews || 0)}</strong></div>
                </div>
                <p className="ap-mi__muted">{t('insights_counts_note')}</p>
              </section>
            </div>

            <section className="ap-mi__panel ap-mi__trend">
              <div className="ap-mi__panel-head"><div><span className="ap-mi__kicker">{t('insights_kicker_history')}</span><h2>{t('insights_history_title')}</h2><p>{t('insights_history_help')}</p></div><ChartColumnIncreasing size={20} /></div>
              <div className="ap-mi__trend-grid">
                {(report.trend || []).map((item) => <div className="ap-mi__trend-item" key={item.cycle_id}>
                  <div><span title={item.label}>{item.label}</span><strong>{item.average_score == null ? '—' : fmt(item.average_score)}</strong></div>
                  <div className="ap-mi__trend-track"><div style={{ width: `${item.average_score == null ? 0 : Math.min(100, Number(item.average_score) / 5 * 100)}%` }} /></div>
                  <small>{t('appraisals_count', { count: item.appraisals, number: fmtCount(item.appraisals) })}{item.average_score == null ? ` · ${t('insights_small_cohort')}` : ''}</small>
                </div>)}
              </div>
            </section>

            <section className="ap-mi__panel ap-mi__departments">
              <div className="ap-mi__panel-head"><div><span className="ap-mi__kicker">{t('insights_kicker_comparison')}</span><h2>{t('insights_department_title')}</h2><p>{t('insights_department_help')}</p></div><Users size={20} /></div>
              <div className="ap-mi__table-wrap"><table><thead><tr><th>{t('group_department')}</th><th>{t('col_appraisals')}</th><th>{t('insights_col_average')}</th><th>{t('insights_col_pending')}</th></tr></thead><tbody>
                {departments.map((item) => <tr key={item.department}><td>{item.department}</td><td>{fmtCount(item.appraisals)}</td><td>{item.small_cohort ? t('insights_small_cohort_label') : fmt(item.average_score)}</td><td>{fmtCount(item.pending_acknowledgements)}</td></tr>)}
                {!departments.length && <tr><td colSpan={4}>{t('insights_no_departments')}</td></tr>}
              </tbody></table></div>
            </section>

            <section className="ap-mi__panel ap-mi__generate">
              <div className="ap-mi__panel-head"><div><span className="ap-mi__kicker">{t('insights_kicker_ai')}</span><h2>{t('insights_interpret')}</h2><p>{t('insights_ai_help')}</p></div><Sparkles size={21} /></div>
              <div className="ap-mi__generate-controls">
                <AppSelect label={t('insights_focus')} value={focus} onChange={(value) => { setFocus(value); setNarrative(null); }}
                  options={options.map((option) => ({ ...option, label: t(option.labelKey) }))} clearable={false} disabled={generating} />
                <button type="button" onClick={() => generate(false)} disabled={(Number(summary.unique_staff) || 0) < 3 || loading || generating}><Sparkles size={15} />{generating ? t('insights_generating') : t('insights_generate')}<ArrowRight size={16} /></button>
              </div>
              {total > 0 && (Number(summary.unique_staff) || 0) < 3 && <p className="ap-mi__muted" role="status">{t('insights_need_three')}</p>}
              {narrative && <div className="ap-mi__answer" aria-live="polite">
                <span><Sparkles size={15} /> {t('insights_generated')}</span>
                <div className="ap-mi__answer-text"><AiMessageContent content={narrative.answer} /></div>
                <div className="ap-mi__answer-foot">
                  <small>
                    {narrative.saved
                      ? t('insights_saved_result', { when: savedWhen(narrative.generated_at, t) })
                      : t('insights_new_result')}
                  </small>
                  {narrative.saved && <button type="button" className="ap-mi__regenerate" onClick={() => generate(true)} disabled={generating}>{t('insights_fresh')}</button>}
                </div>
              </div>}
            </section>
            <p className="ap-mi__disclaimer">{report.note}</p>
          </>}
        </div>
      </main>
    </div>
  );
}
