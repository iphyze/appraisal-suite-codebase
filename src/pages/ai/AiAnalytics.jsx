import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDateTime, formatNumber, formatPercentage, formatScore } from '../../utils/format';
import { translatedRatingBand } from '../../utils/analyticsLabels';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ChevronRight, FileDown, FileSpreadsheet, Mail, Search, Sparkles } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import CycleBriefingPdfDocument from '../../components/pdf/CycleBriefingPdfDocument';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import { downloadAiAnalyticsExcel, generateAiBriefing, generateAiFeedbackSummary, getAiAnalytics, getAiBriefing, getAiFeedbackSummary, getAiNavigationAvailability } from '../../services/aiAssistant';
import ReminderDraftModal from '../../components/ai/ReminderDraftModal';
import '../../components/ai/AiStage3.css';
import '../appraisals/Appraisals.css';
import './AiAnalytics.css';

const VIEWS = [
  { key: 'rankings', feature: 'rankings', labelKey: 'tab_rankings' },
  { key: 'calibration', feature: 'calibration', labelKey: 'tab_calibration' },
  { key: 'alerts', feature: 'alerts', labelKey: 'tab_alerts' },
  { key: 'progress', feature: 'progress', labelKey: 'tab_progress' },
  { key: 'briefing', feature: 'cycle_briefing', labelKey: 'tab_briefing', tokens: true },
  { key: 'feedback', feature: 'feedback_summary', labelKey: 'tab_feedback', tokens: true },
];
const savedWhen = (value, t) => {
  const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null;
  return date && !Number.isNaN(date.getTime())
    ? formatDateTime(date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }, i18n.language)
    : t('saved_earlier');
};
const GROUPS = [
  { key: 'department', labelKey: 'group_department' },
  { key: 'supervisor', labelKey: 'group_supervisor' },
  { key: 'level', labelKey: 'group_level' },
  { key: 'band', labelKey: 'group_band' },
];
const STAGES = [
  { key: 'level_needed', labelKey: 'stage_level_needed' },
  { key: 'objectives_needed', labelKey: 'stage_objectives_needed' },
  { key: 'ready', labelKey: 'stage_ready' },
  { key: 'awaiting_ack', labelKey: 'stage_awaiting_ack' },
  { key: 'complete', labelKey: 'stage_complete' },
];
const fmt = (n) => formatScore(n, i18n.language);
const fmtCount = (n) => formatNumber(n, {}, i18n.language);
const fmtOne = (n) => formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, i18n.language);
const fmtPercent = (n) => formatPercentage(Number(n || 0) / 100, Number(n || 0) % 1 ? 1 : 0, i18n.language);
const errorText = (e) => e?.response?.data?.message || e?.message || 'error_load';
const signed = (n) => `${n > 0 ? '+' : ''}${fmt(n)}`;

function Distribution({ distribution }) {
  const { t } = useTranslation('analytics');
  if (!distribution?.total) return <p className="an-empty">{t('no_scored')}</p>;
  const label = { above: t('position_above'), below: t('position_below'), within: t('position_within'), none: '' };
  return (
    <div className="an-dist">
      {distribution.bands.map((band) => (
        <div className="an-dist__row" key={band.key}>
          <span className="an-dist__name">{translatedRatingBand(t, band)}</span>
          <div className="an-dist__track" aria-hidden="true">
            <span className="an-dist__guide" style={{ left: `${band.guide_low}%`, width: `${Math.max(1, band.guide_high - band.guide_low)}%` }} />
            <span className={`an-dist__fill is-${band.position}`} style={{ width: `${Math.min(100, band.share)}%` }} />
          </div>
          <span className="an-dist__value">{fmtPercent(band.share)}</span>
          <span className={`an-chip is-${band.position}`}>{label[band.position]}</span>
          <span className="an-dist__guide-text">{t('guide_range', { low: fmtCount(band.guide_low), high: fmtPercent(band.guide_high) })}</span>
        </div>
      ))}
      <p className="an-note">{t('distribution_note', { count: fmtCount(distribution.total) })}</p>
    </div>
  );
}

function Rankings({ data, groupBy, setGroupBy, loading }) {
  const { t } = useTranslation('analytics');
  const result = data?.result;
  return (
    <section className="an-panel">
      <div className="an-panel__head">
        <div><h2>{groupBy === 'band' ? t('rankings_spread_title') : t('rankings_by_group', { group: t(GROUPS.find((g) => g.key === groupBy)?.labelKey || 'group_department').toLocaleLowerCase(i18n.language === 'fr' ? 'fr' : 'en') })}</h2>
          <p>{groupBy === 'band' ? t('rankings_spread_help') : t('rankings_help')}</p></div>
        <div className="an-seg" role="tablist" aria-label={t('group_by')}>
          {GROUPS.map((g) => <button key={g.key} type="button" role="tab" aria-selected={groupBy === g.key} className={groupBy === g.key ? 'is-on' : ''} onClick={() => setGroupBy(g.key)} disabled={loading}>{t(g.labelKey)}</button>)}
        </div>
      </div>
      {result?.distribution && <Distribution distribution={result.distribution} />}
      {result?.rows && (
        <div className="an-table-wrap">
          <table className="an-table">
            <thead><tr><th scope="col">{t('col_rank')}</th><th scope="col">{t('col_name')}</th><th scope="col">{t('col_average')}</th><th scope="col" className="num">{t('col_appraisals')}</th><th scope="col" className="num">{t('band_outstanding')}</th><th scope="col" className="num">{t('col_awaiting_short')}</th></tr></thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.label} className={row.small_group ? 'is-muted' : ''}>
                  <td className="an-rank">{row.rank ?? '—'}</td>
                  <td>{groupBy === 'band' ? translatedRatingBand(t, row) : row.label}</td>
                  <td>{row.small_group ? <span className="an-small">{t('fewer_three')}</span> : (
                    <span className="an-score"><span className="an-score__bar"><span style={{ width: `${Math.max(2, ((row.average - 1) / 4) * 100)}%` }} /></span><strong>{fmt(row.average)}</strong></span>
                  )}</td>
                  <td className="num">{fmtCount(row.appraisals)}</td>
                  <td className="num">{row.outstanding_share == null ? '—' : fmtPercent(row.outstanding_share)}</td>
                  <td className="num">{fmtCount(row.pending)}</td>
                </tr>
              ))}
              {!result.rows.length && <tr><td colSpan={6} className="an-empty">{t('no_appraisals')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Calibration({ data }) {
  const { t } = useTranslation('analytics');
  const r = data?.result;
  if (!r) return null;
  const flagText = { high: t('flag_high'), low: t('flag_low'), typical: t('flag_typical'), too_few: t('flag_too_few') };
  return (
    <>
      <section className="an-stats">
        <div><span>{t('company_average')}</span><strong>{fmt(r.company_average)}</strong><small>{t('appraisals_count', { count: r.appraisals, number: fmtCount(r.appraisals) })}</small></div>
        <div><span>{t('supervisors_review')}</span><strong>{fmtCount(r.flagged)}</strong><small>{t('calibration_gap', { score: fmtOne(r.gap) })}</small></div>
        <div><span>{t('rated_outstanding')}</span><strong>{fmtPercent(r.distribution.bands[0]?.share ?? 0)}</strong><small>{t('guideline_5_10')}</small></div>
      </section>
      <section className="an-panel">
        <div className="an-panel__head"><div><h2>{t('calibration_spread')}</h2><p>{t('calibration_spread_help')}</p></div></div>
        <Distribution distribution={r.distribution} />
      </section>
      <section className="an-panel">
        <div className="an-panel__head"><div><h2>{t('calibration_supervisors')}</h2><p>{t('calibration_supervisors_help')}</p></div></div>
        <div className="an-table-wrap">
          <table className="an-table">
            <thead><tr><th scope="col">{t('group_supervisor')}</th><th scope="col">{t('col_average')}</th><th scope="col">{t('col_difference')}</th><th scope="col" className="num">{t('band_outstanding')}</th><th scope="col" className="num">{t('col_below_meets')}</th><th scope="col" className="num">{t('col_appraisals')}</th><th scope="col">{t('col_review')}</th></tr></thead>
            <tbody>
              {r.supervisors.map((s) => (
                <tr key={s.name} className={s.small_group ? 'is-muted' : ''}>
                  <td>{s.name}</td>
                  <td>{s.small_group ? <span className="an-small">{t('fewer_three')}</span> : <strong>{fmt(s.average)}</strong>}</td>
                  <td>{s.difference == null ? '—' : <span className={`an-diff ${s.difference > 0 ? 'is-up' : s.difference < 0 ? 'is-down' : ''}`}>{signed(s.difference)}</span>}</td>
                  <td className="num">{s.outstanding_share == null ? '—' : fmtPercent(s.outstanding_share)}</td>
                  <td className="num">{s.below_meets_share == null ? '—' : fmtPercent(s.below_meets_share)}</td>
                  <td className="num">{fmtCount(s.appraisals)}</td>
                  <td><span className={`an-chip is-${s.flag}`}>{flagText[s.flag]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PersonList({ items, empty, render }) {
  if (!items.length) return <p className="an-empty">{empty}</p>;
  return (
    <ul className="an-people">
      {items.map((item) => (
        <li key={item.link || item.name}>
          <Link to={item.link} className="an-person">
            <span className="an-person__who"><strong>{item.name}</strong><small>{item.department}</small></span>
            {render(item)}
            <ChevronRight size={16} className="an-person__go" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Alerts({ data }) {
  const { t } = useTranslation('analytics');
  const r = data?.result;
  if (!r) return null;
  return (
    <>
      <div className="an-alerts">
        <section className="an-panel">
          <div className="an-panel__head"><div><h2>{t('drops_title')}</h2><p>{t('drops_help', { score: fmtOne(r.drop_threshold), year: r.year - 1 })}</p></div><span className="an-count">{fmtCount(r.drops.length)}</span></div>
          <PersonList items={r.drops} empty={t('drops_empty', { score: fmtOne(r.drop_threshold) })} render={(p) => (
            <span className="an-change"><span>{fmt(p.previous)}</span><ArrowDownRight size={14} aria-hidden="true" /><strong>{fmt(p.score)}</strong><em>{signed(p.change)}</em></span>
          )} />
        </section>
        <section className="an-panel">
          <div className="an-panel__head"><div><h2>{t('sustained_title')}</h2><p>{t('sustained_help', { score: fmt(4.5) })}</p></div><span className="an-count">{fmtCount(r.sustained.length)}</span></div>
          <PersonList items={r.sustained} empty={t('sustained_empty')} render={(p) => (
            <span className="an-change"><em className="is-good">{t('years_count', { count: p.years, number: fmtCount(p.years) })}</em><strong>{fmt(p.score)}</strong></span>
          )} />
        </section>
        <section className="an-panel">
          <div className="an-panel__head"><div><h2>{t('col_below_meets')}</h2><p>{t('support_help', { year: r.year, score: fmt(2.5) })}</p></div><span className="an-count">{fmtCount(r.support.length)}</span></div>
          <PersonList items={r.support} empty={t('support_empty', { year: r.year, score: fmt(2.5) })} render={(p) => (
            <span className="an-change"><strong>{fmt(p.score)}</strong></span>
          )} />
        </section>
      </div>
      <p className="an-note">{r.note}</p>
    </>
  );
}

function Progress({ data, canRemind, initialStage = '', initialQuery = '', focus = '' }) {
  const { t } = useTranslation('analytics');
  const r = data?.result;
  const [query, setQuery] = useState(initialQuery);
  const [stage, setStage] = useState(initialStage);
  const [reminder, setReminder] = useState(null);
  if (!r) return null;
  const setupLeft = r.supervisors.filter((s) => s.level_needed + s.objectives_needed > 0).length;
  const toAppraise = r.supervisors.filter((s) => s.level_needed + s.objectives_needed + s.ready > 0).length;
  const reminders = canRemind && r.scope === 'company' && !r.department ? [
    r.stages.awaiting_ack > 0 && { audience: 'staff_acknowledgement', label: t('remind_staff', { count: r.stages.awaiting_ack, number: fmtCount(r.stages.awaiting_ack) }) },
    toAppraise > 0 && { audience: 'supervisors_pending', label: t('remind_supervisors', { count: toAppraise, number: fmtCount(toAppraise) }) },
    setupLeft > 0 && { audience: 'supervisors_setup', label: t('remind_setup', { count: setupLeft, number: fmtCount(setupLeft) }) },
  ].filter(Boolean) : [];
  const total = r.assigned || 0;
  const people = r.people.filter((p) => ((!stage && p.stage !== 'complete') || p.stage === stage || (stage === 'incomplete' && ['level_needed', 'objectives_needed', 'ready'].includes(p.stage)))
    && (!query || `${p.name} ${p.department} ${p.supervisor}`.toLowerCase().includes(query.toLowerCase())));
  const stageLabel = { ...Object.fromEntries(STAGES.map((s) => [s.key, t(s.labelKey)])), incomplete: t('still_to_appraise') };
  const pendingSupervisors = focus === 'supervisors_pending';
  const supervisorRows = pendingSupervisors
    ? r.supervisors.filter((s) => s.level_needed + s.objectives_needed + s.ready > 0)
    : r.supervisors;
  const unfinished = r.stages.level_needed + r.stages.objectives_needed + r.stages.ready;
  return (
    <>
      <section className="an-panel">
        <div className="an-panel__head"><div><h2>{r.department ? t('department_progress', { department: r.department }) : r.scope === 'team' ? t('team_progress') : t('cycle_progress')}</h2><p>{t('progress_summary', { count: total, number: fmtCount(total), submitted: fmtPercent(r.percent_submitted), acknowledged: fmtPercent(r.percent_complete) })}</p></div></div>
        {total > 0 ? (
          <>
            <div className="an-stack" aria-hidden="true">
              {STAGES.map((s) => r.stages[s.key] > 0 && <span key={s.key} className={`an-stack__seg is-${s.key}`} style={{ flexGrow: r.stages[s.key] }} />)}
            </div>
            <div className="an-stages">
              <button type="button" className={`an-stage ${stage === 'incomplete' ? 'is-on' : ''}`} onClick={() => setStage(stage === 'incomplete' ? '' : 'incomplete')} aria-pressed={stage === 'incomplete'}>
                <i className="is-ready" aria-hidden="true" /><strong>{fmtCount(unfinished)}</strong><span>{t('still_to_appraise')}</span>
              </button>
              {STAGES.map((s) => (
                <button type="button" key={s.key} className={`an-stage ${stage === s.key ? 'is-on' : ''}`} onClick={() => setStage(stage === s.key ? '' : s.key)} aria-pressed={stage === s.key}>
                  <i className={`is-${s.key}`} aria-hidden="true" /><strong>{fmtCount(r.stages[s.key])}</strong><span>{t(s.labelKey)}</span>
                </button>
              ))}
            </div>
          </>
        ) : <p className="an-empty">{t('nobody_assigned')}</p>}
        {reminders.length > 0 && (
          <div className="an-remind">
            <span>{t('draft_reminder')} <em className="ai3-tag">{t('uses_tokens')}</em></span>
            {reminders.map((item) => <button type="button" key={item.audience} className="an-remind__btn" onClick={() => setReminder(item.audience)}><Mail size={14} />{item.label}</button>)}
          </div>
        )}
      </section>
      {reminder && <ReminderDraftModal audience={reminder} cycleId={data.cycle?.id} cycleTitle={`${data.cycle?.title} ${data.cycle?.year}`} onClose={() => setReminder(null)} />}

      {r.supervisors.length > 0 && (
        <section className="an-panel">
          <div className="an-panel__head"><div><h2>{pendingSupervisors ? t('pending_supervisors') : t('by_supervisor')}</h2><p>{t('least_complete')}</p></div></div>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead><tr><th scope="col">{t('group_supervisor')}</th><th scope="col">{t('tab_progress')}</th><th scope="col" className="num">{t('col_assigned')}</th><th scope="col" className="num">{t('still_to_appraise')}</th><th scope="col" className="num">{t('col_awaiting_short')}</th><th scope="col">{t('col_onboarded')}</th></tr></thead>
              <tbody>
                {supervisorRows.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td><span className="an-mini" aria-label={t('percent_complete', { percent: fmtPercent(s.percent_done) })}>{STAGES.map((st) => s[st.key] > 0 && <span key={st.key} className={`is-${st.key}`} style={{ flexGrow: s[st.key] }} />)}</span></td>
                    <td className="num">{fmtCount(s.assigned)}</td>
                    <td className="num">{fmtCount(s.level_needed + s.objectives_needed + s.ready)}</td>
                    <td className="num">{fmtCount(s.awaiting_ack)}</td>
                    <td>{s.onboarded ? <span className="an-chip is-within">{t('yes')}</span> : <span className="an-chip is-above">{t('not_yet')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {total > 0 && (
        <section className="an-panel">
          <div className="an-panel__head">
            <div><h2>{stage === 'complete' ? t('completed_appraisals') : t('still_to_finish')}</h2><p>{stage ? stageLabel[stage] : t('everyone_pending')} {t('select_stage')}{r.people_limited ? ` ${t('people_limited')}` : ''}{r.assignment_limited ? ` ${t('assignment_limited', { count: fmtCount(1500) })}` : ''}</p></div>
            <label className="an-search"><Search size={14} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')} aria-label={t('search_people')} /></label>
          </div>
          {people.length === 0 ? <p className="an-empty">{t('no_matches')}</p> : (
            <ul className="an-people">
              {people.slice(0, 200).map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  {p.link ? (
                    <Link to={p.link} className="an-person"><span className="an-person__who"><strong>{p.name}</strong><small>{p.department}{r.scope === 'company' ? `, ${p.supervisor}` : ''}</small></span><span className={`an-chip is-${p.stage}`}>{stageLabel[p.stage]}</span><ChevronRight size={16} className="an-person__go" aria-hidden="true" /></Link>
                  ) : (
                    <div className="an-person"><span className="an-person__who"><strong>{p.name}</strong><small>{p.department}{r.scope === 'company' ? `, ${p.supervisor}` : ''}</small></span><span className={`an-chip is-${p.stage}`}>{stageLabel[p.stage]}</span><span className="an-person__go" /></div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function SavedLine({ saved, generatedAt, onRefresh, busy, extra }) {
  const { t } = useTranslation('analytics');
  return (
    <div className="ai3-explain__meta">
      <span>{saved ? t('saved_result', { when: savedWhen(generatedAt, t) }) : t('written_result', { when: savedWhen(generatedAt, t) })} {extra}</span>
      <button type="button" className="ai3-link" onClick={onRefresh} disabled={busy}>{busy ? t('working') : t('fresh_version')}</button>
    </div>
  );
}

function Briefing({ data, onGenerate, busy }) {
  const { t } = useTranslation('analytics');
  const b = data?.briefing;
  const f = data?.facts;
  if (!f) return null;
  const outstanding = f.rating_spread_vs_guideline?.[0];
  return (
    <section className="an-panel an-print">
      <div className="an-panel__head">
        <div><h2>{t('briefing_title', { cycle: f.cycle })}</h2><p>{t('briefing_help')}</p></div>
        {b && <PDFDownloadLink
          key={`briefing-pdf-${i18n.language}-${f.cycle}`}
          className="an-remind__btn an-download-pdf an-noprint"
          document={<CycleBriefingPdfDocument facts={f} briefing={b} locale={i18n.language} />}
          fileName={`AppraisalSuite_${i18n.language === 'fr' ? 'Synthese_Cycle' : 'Cycle_Briefing'}_${String(f.cycle || 'cycle').replace(/[^a-z0-9_-]+/gi, '_')}.pdf`}
        >
          {({ loading, error }) => <><FileDown size={14} />{loading ? t('pdf_preparing') : error ? t('pdf_retry') : t('pdf_download')}</>}
        </PDFDownloadLink>}
      </div>
      <div className="an-facts">
        <div><strong>{fmtCount(f.appraisals?.appraisals ?? 0)}</strong><span>{t('col_appraisals')}</span></div>
        <div><strong>{fmt(f.appraisals?.average_score)}</strong><span>{t('average_score')}</span></div>
        <div><strong>{outstanding ? fmtPercent(outstanding.share_percent) : '—'}</strong><span>{t('outstanding_guide')}</span></div>
        <div><strong>{fmtPercent(f.progress?.percent_acknowledged ?? 0)}</strong><span>{t('acknowledged')}</span></div>
      </div>
      {b ? (
        <div className="an-brief">
          <p className="an-brief__headline">{b.headline}</p>
          <p className="an-brief__summary">{b.summary}</p>
          <div className="ai3-explain__cols">
            <div className="ai3-explain__col" style={{ '--col': '#2f8a47' }}><h4>{t('highlights')}</h4><ul>{(b.highlights || []).map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="ai3-explain__col" style={{ '--col': '#d99418' }}><h4>{t('risks')}</h4><ul>{(b.risks || []).map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="ai3-explain__col" style={{ '--col': '#2f7fbf' }}><h4>{t('recommended_actions')}</h4><ul>{(b.actions || []).map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
          <div className="an-noprint"><SavedLine saved={data.saved} generatedAt={data.generated_at} onRefresh={() => onGenerate(true)} busy={busy} extra={t('ai_review_note')} /></div>
        </div>
      ) : (
        <div className="an-cta">
          <p>{t('no_briefing')}</p>
          <button type="button" className="ai3-btn ai3-btn--primary" onClick={() => onGenerate(false)} disabled={busy || !data.ai_available}><Sparkles size={15} />{busy ? t('writing') : t('write_briefing')}</button>
          {!data.ai_available && <small>{t('ai_unavailable')}</small>}
        </div>
      )}
    </section>
  );
}

function Feedback({ data, onGenerate, busy }) {
  const { t } = useTranslation('analytics');
  const s = data?.summary;
  if (!data) return null;
  const total = s ? Math.max(1, (s.sentiment?.positive || 0) + (s.sentiment?.mixed || 0) + (s.sentiment?.negative || 0)) : 1;
  return (
    <>
      <section className="an-panel">
        <div className="an-panel__head"><div><h2>{t('feedback_title')}</h2><p>{t('feedback_help', { count: data.feedback_count, number: fmtCount(data.feedback_count) })}</p></div></div>
        {s ? (
          <>
            <p className="ai3-explain__summary">{s.overview}</p>
            <div className="an-sent" aria-label={t('sentiment')}>
              <span className="is-pos" style={{ flexGrow: s.sentiment.positive }} /><span className="is-mix" style={{ flexGrow: s.sentiment.mixed }} /><span className="is-neg" style={{ flexGrow: s.sentiment.negative }} />
            </div>
            <div className="an-sent__legend">
              <span><i className="is-pos" />{t('positive')} {fmtPercent((s.sentiment.positive / total) * 100)}</span>
              <span><i className="is-mix" />{t('mixed')} {fmtPercent((s.sentiment.mixed / total) * 100)}</span>
              <span><i className="is-neg" />{t('negative')} {fmtPercent((s.sentiment.negative / total) * 100)}</span>
            </div>
            <div className="an-themes">
              {(s.themes || []).map((theme) => <div key={theme.title} className="an-theme"><strong>{theme.title}</strong><span>{t('comments_count', { count: theme.count, number: fmtCount(theme.count) })}</span><p>{theme.description}</p></div>)}
            </div>
            <SavedLine saved={data.saved} generatedAt={data.generated_at} onRefresh={() => onGenerate(true)} busy={busy} />
          </>
        ) : (
          <div className="an-cta">
            <p>{data.feedback_count < 3 ? t('feedback_need_three') : t('feedback_summarise_help', { count: data.feedback_count, number: fmtCount(data.feedback_count) })}</p>
            <button type="button" className="ai3-btn ai3-btn--primary" onClick={() => onGenerate(false)} disabled={busy || !data.ai_available || data.feedback_count < 3}><Sparkles size={15} />{busy ? t('summarising') : t('summarise_feedback')}</button>
            {!data.ai_available && <small>{t('ai_unavailable')}</small>}
          </div>
        )}
      </section>
      {s && (
        <section className="an-panel">
          <div className="an-panel__head"><div><h2>{t('disagreements_title')}</h2><p>{t('disagreements_help')}</p></div><span className="an-count">{fmtCount(s.disagreements.length)}</span></div>
          {s.disagreements.length === 0 ? <p className="an-empty">{t('no_disagreements')}</p> : (
            <ul className="an-people">
              {s.disagreements.map((d) => (
                <li key={d.link}><Link className="an-person" to={d.link}>
                  <span className="an-person__who"><strong>{d.name}</strong><small>{d.department}: {d.reason}</small></span><span /><ChevronRight size={16} className="an-person__go" aria-hidden="true" />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

export default function AiAnalytics() {
  const { t, i18n: languageContext } = useTranslation('analytics');
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [nav, setNav] = useState(false);
  const [views, setViews] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cycleId, setCycleId] = useState(0);
  const requestedGroup = params.get('group_by');
  const progressDepartment = params.get('search') || '';
  const groupBy = GROUPS.some((g) => g.key === requestedGroup) ? requestedGroup : 'department';
  const setGroupBy = (value) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    next.set('group_by', value);
    return next;
  }, { replace: true });
  const [tools, setTools] = useState({});
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const epoch = useRef(0);
  const role = user?.role || 'staff';

  useEffect(() => { document.title = t('document_title'); }, [t, languageContext.language]);
  useEffect(() => {
    let active = true;
    const load = () => getAiNavigationAvailability()
      .then((f) => { if (active) { setViews(f?.analytics?.views || []); setTools(f?.tools || {}); } })
      .catch(() => { if (active) setViews([]); });
    load();
    window.addEventListener('appraisalsuite:ai-settings-updated', load);
    return () => { active = false; window.removeEventListener('appraisalsuite:ai-settings-updated', load); };
  }, [role]);

  const tabs = useMemo(() => VIEWS.filter((v) => (views || []).includes(v.feature)), [views]);
  const requested = params.get('view');
  const view = tabs.some((t) => t.key === requested) ? requested : tabs[0]?.key;

  useEffect(() => { setCycleId(0); }, [viewCompanyId]);
  useEffect(() => {
    if (!view || (role === 'super_admin' && !viewCompanyId)) return;
    const mine = ++epoch.current;
    setLoading(true);
    setError('');
    setData(null); // Do not show an English saved narrative while loading its French counterpart.
    const load = view === 'briefing' ? getAiBriefing(cycleId)
      : view === 'feedback' ? getAiFeedbackSummary(cycleId)
        : getAiAnalytics(view, cycleId, groupBy, progressDepartment);
    load
      .then((result) => { if (mine === epoch.current) setData(result ? { ...result, view } : result); })
      .catch((e) => { if (mine === epoch.current) { setData(null); setError(errorText(e)); } })
      .finally(() => { if (mine === epoch.current) setLoading(false); });
  }, [view, cycleId, groupBy, progressDepartment, viewCompanyId, role, languageContext.language]);

  const generate = async (refresh) => {
    if (generating || !data?.cycle?.id) return;
    const mine = epoch.current;
    setGenerating(true);
    setError('');
    try {
      if (view === 'briefing') {
        const result = await generateAiBriefing(data.cycle.id, refresh);
        if (mine === epoch.current) setData((prev) => ({ ...prev, briefing: result.briefing, saved: result.saved, generated_at: result.generated_at }));
      } else {
        const result = await generateAiFeedbackSummary(data.cycle.id, refresh);
        if (mine === epoch.current) setData((prev) => ({ ...prev, summary: result.summary, saved: result.saved, generated_at: result.generated_at }));
      }
    } catch (e) {
      if (mine === epoch.current) setError(errorText(e));
    } finally {
      setGenerating(false);
    }
  };

  const exportAnalytics = async () => {
    if (exporting || loading || !data?.cycle?.id) return;
    setExporting(true);
    setError('');
    try {
      const blob = await downloadAiAnalyticsExcel(data.cycle.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${languageContext.language === 'fr' ? 'Analyses_Evaluations' : 'Appraisal_Analytics'}_${data.cycle.year}_${data.cycle.id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Browsers need time to read an object URL after the download starts.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // Axios can return a JSON error body as a Blob for binary download requests.
      let message = errorText(e);
      if (e?.response?.data instanceof Blob && e.response.data.type.includes('json')) {
        try {
          const details = JSON.parse(await e.response.data.text());
          message = details?.message || message;
        } catch { /* retain the normal error message */ }
      }
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  if (role === 'staff') return <Navigate to="/dashboard" replace />;

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page theme-${theme} an-page`}>
          <PageNav pageTitle={t('page_title')} links={[{ label: t('dashboard'), to: '/dashboard' }, { label: t('page_title') }]} />

          <div className="an-bar">
            <div className="an-tabs" role="tablist" aria-label={t('analytics_views')}>
              {tabs.map((tab) => (
                <button key={tab.key} type="button" role="tab" aria-selected={view === tab.key} className={view === tab.key ? 'is-on' : ''}
                  onClick={() => setParams({ view: tab.key }, { replace: true })}>{t(tab.labelKey)}{tab.tokens && <span className="an-tabs__ai" title={t('uses_ai_tokens')}>AI</span>}</button>
              ))}
            </div>
            <div className="an-bar__right">
              {data?.cycle?.id && tabs.some((tab) => ['rankings', 'calibration', 'alerts', 'progress'].includes(tab.key)) && (
                <button type="button" className="an-export" onClick={exportAnalytics}
                  disabled={loading || exporting} aria-label={t('export_analytics_aria')}
                  title={t('export_analytics_title')}>
                  <FileSpreadsheet size={17} aria-hidden="true" />
                  {exporting ? t('preparing_excel') : t('export_excel')}
                </button>
              )}
              {data?.cycles?.length > 0 && (
                <div className="an-cycle">
                  <AppSelect label={t('cycle')} value={data?.cycle?.id || ''} onChange={(value) => setCycleId(Number(value))} clearable={false} disabled={loading}
                    options={data.cycles.map((c) => ({ value: c.id, label: `${c.title} (${c.year})` }))} />
                </div>
              )}
            </div>
          </div>

          {views !== null && tabs.length === 0 && <div className="an-alert">{t('analytics_off')}</div>}
          {role === 'super_admin' && !viewCompanyId && <div className="an-alert">{t('choose_company')}</div>}
          {error && <div className="an-alert" role="alert">{error === 'error_load' ? t(error) : error}</div>}
          {loading && !data && <div className="an-loading" role="status">{t('loading')}</div>}

          <div className={`an-body ${loading ? 'is-loading' : ''}`}>
            {data && view === 'rankings' && data.view === 'rankings' && <Rankings data={data} groupBy={groupBy} setGroupBy={setGroupBy} loading={loading} />}
            {data && view === 'calibration' && data.view === 'calibration' && <Calibration data={data} />}
            {data && view === 'alerts' && data.view === 'alerts' && <Alerts data={data} />}
            {data && view === 'progress' && data.view === 'progress' && <Progress
              key={`${location.key}:${data?.cycle?.id}:${params.get('stage') || ''}:${params.get('search') || ''}:${params.get('focus') || ''}`}
              data={data}
              canRemind={!!tools.reminder_drafts}
              initialStage={['level_needed', 'objectives_needed', 'ready', 'awaiting_ack', 'complete', 'incomplete'].includes(params.get('stage')) ? params.get('stage') : ''}
              initialQuery={data?.result?.department ? '' : (params.get('search') || '')}
              focus={params.get('focus') === 'supervisors_pending' ? 'supervisors_pending' : ''}
            />}
            {data && view === 'briefing' && data.view === 'briefing' && <Briefing data={data} onGenerate={generate} busy={generating} />}
            {data && view === 'feedback' && data.view === 'feedback' && <Feedback data={data} onGenerate={generate} busy={generating} />}
            {data && !data.cycle && <p className="an-empty">{t('no_cycles')}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
