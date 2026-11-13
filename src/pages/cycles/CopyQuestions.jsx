import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber } from '../../utils/format';
import { Link, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Header from '../Header';
import NavBar from '../NavBar';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import AppIcon from '../../components/ui/AppIcon';
import useAuthStore from '../../stores/useAuthStore';
import useToastStore from '../../stores/useToastStore';
import useThemeStore from '../../stores/useThemeStore';
import { applyQuestionCopy, listQuestionCopyCatalog, previewQuestionCopy } from '../../services/questionCopy';
import './Cycles.css';
import './CopyQuestions.css';

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const messageFor = (error) => error?.response?.data?.message || error?.message || cx('copy_error_fallback');
const validReason = (value) => value.trim().length >= 5 && value.trim().length <= 500;
// Do not overwrite backend-specific blocker explanations until server-message localisation.
const displayCopyStatus = (question) => {
  if (question.status === 'ready') return cx('copy_ready');
  if (question.status === 'existing' && question.message === 'Already in destination') return cx('copy_existing_status');
  return question.message || cx('copy_unavailable');
};

export default function CopyQuestions() {
  const { i18n: language } = useTranslation('cycles');
  const locale = language.language;
  const [nav, setNav] = useState(false);
  const [params] = useSearchParams();
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const [catalog, setCatalog] = useState({ companies: [], cycles: [] });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [sourceCompanyId, setSourceCompanyId] = useState('');
  const [sourceCycleId, setSourceCycleId] = useState(params.get('source_cycle_id') || '');
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetCycleId, setTargetCycleId] = useState(params.get('target_cycle_id') || '');
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [selected, setSelected] = useState([]);
  const [kind, setKind] = useState('both');
  const [search, setSearch] = useState('');
  const [approval, setApproval] = useState(false);
  const [reason, setReason] = useState('');
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  useEffect(() => {
    let live = true;
    listQuestionCopyCatalog().then((data) => {
      if (!live) return;
      setCatalog(data);
      const source = data.cycles.find((cycle) => String(cycle.id) === String(params.get('source_cycle_id') || ''));
      if (source) setSourceCompanyId(String(source.company_id));
      const target = data.cycles.find((cycle) => String(cycle.id) === String(params.get('target_cycle_id') || ''));
      if (target) setTargetCompanyId(String(target.company_id));
    }).catch((err) => { if (live) setError(messageFor(err)); })
      .finally(() => { if (live) setCatalogLoading(false); });
    return () => { live = false; requestVersion.current += 1; };
  }, []);

  useEffect(() => { document.title = cx('copy_document_title'); }, [locale]);

  useEffect(() => {
    if (!approval) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [approval]);

  const resetPreview = () => {
    requestVersion.current += 1;
    setPreview(null); setSelected([]); setPreviewBusy(false); setApproval(false); setReason(''); setError('');
  };
  const selectSourceCompany = (id) => { resetPreview(); setSourceCompanyId(String(id || '')); setSourceCycleId(''); };
  const selectTargetCompany = (id) => { resetPreview(); setTargetCompanyId(String(id || '')); setTargetCycleId(''); };
  const selectSourceCycle = (id) => { resetPreview(); setSourceCycleId(String(id || '')); };
  const selectTargetCycle = (id) => { resetPreview(); setTargetCycleId(String(id || '')); };

  const activeCompanies = useMemo(() => catalog.companies.filter((c) => Number(c.is_active) === 1), [catalog]);
  const optionsForCompany = (id) => catalog.cycles.filter((cy) => String(cy.company_id) === String(id))
    .map((cy) => ({ value: String(cy.id), label: `${cy.title} (${cy.year})`, description: cy.company_name || '' }));
  const sameCycle = sourceCycleId && sourceCycleId === targetCycleId;
  const ready = !!sourceCycleId && !!targetCycleId && !sameCycle && !catalogLoading;
  const visible = useMemo(() => (preview?.questions || []).filter((q) =>
    (kind === 'both' || q.type === kind) && (!search.trim() ||
      `${q.question_text} ${q.section_code} ${q.section_label} ${q.department || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [preview, kind, search]);
  const readyVisible = visible.filter((q) => q.status === 'ready');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const eligibleSelection = (preview?.questions || []).filter((q) => selectedSet.has(q.key) && q.status === 'ready');
  const hasSelected = eligibleSelection.length > 0;
  const allVisibleSelected = readyVisible.length > 0 && readyVisible.every((q) => selectedSet.has(q.key));

  const requestPreview = async () => {
    if (!ready || previewBusy) return;
    const version = ++requestVersion.current;
    setError(''); setPreview(null); setSelected([]); setPreviewBusy(true);
    try {
      const data = await previewQuestionCopy(sourceCycleId, targetCycleId);
      if (version !== requestVersion.current) return;
      if (String(data?.source_cycle?.id) !== String(sourceCycleId) || String(data?.target_cycle?.id) !== String(targetCycleId)) {
        throw new Error(cx('copy_preview_mismatch'));
      }
      setPreview(data);
      setSelected((data.questions || []).filter((q) => q.status === 'ready').map((q) => q.key));
    } catch (err) { if (version === requestVersion.current) setError(messageFor(err)); }
    finally { if (version === requestVersion.current) setPreviewBusy(false); }
  };

  const toggleOne = (key) => setSelected((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
  const toggleVisible = () => setSelected((prev) => {
    const all = new Set(prev);
    if (allVisibleSelected) readyVisible.forEach((q) => all.delete(q.key));
    else readyVisible.forEach((q) => all.add(q.key));
    return [...all];
  });

  const runCopy = async (event) => {
    event.preventDefault();
    if (!approval || copying || !hasSelected || !validReason(reason)) return;
    setCopying(true); setError('');
    try {
      const result = await applyQuestionCopy({ sourceCycleId, targetCycleId, questionKeys: eligibleSelection.map((q) => q.key), reason });
      setApproval(false); setReason(''); setPreview(null); setSelected([]);
      showToast(cx('copy_success', { general: formatNumber(result?.general_copied || 0, {}, locale), kpi: formatNumber(result?.kpi_copied || 0, {}, locale) }), 'success');
    } catch (err) {
      const text = messageFor(err);
      setError(text);
      if (!err?.response) {
        setApproval(false);
        setPreview(null);
        setError(cx('copy_lost_response'));
      }
    } finally { setCopying(false); }
  };

  if (user?.role !== 'super_admin') return <div className="cyc-page"><p>{cx('copy_super_admin_only')}</p><Link to="/cycles/home">{cx('copy_back')}</Link></div>;

  return <div className={`main-container theme-${theme}`}>
    <Header setNav={setNav} nav={nav} />
    <NavBar setNav={setNav} nav={nav} />
    <div className={`content-container theme-${theme}`}>
      <main className={`cyc-page theme-${theme} cqc-page`}>
        <PageNav pageTitle={cx('copy_title')} links={[{ label: cx('dashboard'), to: '/dashboard', active: true }, { label: cx('cycles'), to: '/cycles/home', active: true }, { label: cx('copy_title') }]} />
        <section className="cyc-hero cqc-hero">
          <div><p className="cyc-eyebrow">{cx('copy_eyebrow')}</p><h2>{cx('copy_heading')}</h2>
            <p>{cx('copy_intro')}</p></div>
          <Link className="cyc-btn cyc-btn--ghost" to="/cycles/home"><AppIcon icon="ArrowLeft" /> {cx('copy_back')}</Link>
        </section>
        <section className="cyc-card cqc-configuration">
          <div className="cyc-sections-head"><div><p className="cyc-eyebrow">{cx('copy_from_to')}</p><h3>{cx('copy_select_cycles')}</h3><p>{cx('copy_select_hint')}</p></div></div>
          <div className="cqc-selector-grid">
            <AppSelect label={cx('copy_source_company')} placeholder={cx('copy_source_company_placeholder')} value={sourceCompanyId} onChange={selectSourceCompany} searchable disabled={catalogLoading || copying} options={activeCompanies.map((c) => ({ value: String(c.id), label: c.name, description: c.code }))} />
            <AppSelect label={cx('copy_source_cycle')} placeholder={cx('copy_source_cycle_placeholder')} value={sourceCycleId} onChange={selectSourceCycle} searchable disabled={!sourceCompanyId || copying} options={optionsForCompany(sourceCompanyId)} />
            <AppSelect label={cx('copy_target_company')} placeholder={cx('copy_target_company_placeholder')} value={targetCompanyId} onChange={selectTargetCompany} searchable disabled={catalogLoading || copying} options={activeCompanies.map((c) => ({ value: String(c.id), label: c.name, description: c.code }))} />
            <AppSelect label={cx('copy_target_cycle')} placeholder={cx('copy_target_cycle_placeholder')} value={targetCycleId} onChange={selectTargetCycle} searchable disabled={!targetCompanyId || copying} options={optionsForCompany(targetCompanyId)} />
          </div>
          <div className="cqc-configuration-actions"><button className="cyc-btn cyc-btn--primary" type="button" disabled={!ready || previewBusy || copying} onClick={requestPreview}><AppIcon icon="ListChecks" /> {previewBusy ? cx('copy_loading_preview') : cx('copy_preview')}</button>
            {sameCycle && <span className="cqc-warning">{cx('copy_same_cycle')}</span>}
          </div>
        </section>
        {!!error && <div className="cyc-inline-error cqc-error" role="alert"><AppIcon icon="AlertTriangle" /> {error}</div>}
        {preview && <section className="cyc-card cqc-preview">
          <div className="cyc-sections-head"><div><p className="cyc-eyebrow">{cx('copy_preview_notice')}</p><h3>{cx('copy_select_questions')}</h3><p>{preview.source_cycle?.company_name} ({preview.source_cycle?.year}) → {preview.target_cycle?.company_name} ({preview.target_cycle?.year})</p></div></div>
          <div className="cqc-metrics">
            <div><strong>{formatNumber(preview.counts?.general || 0, {}, locale)}</strong><span>{cx('view_general')}</span></div>
            <div><strong>{formatNumber(preview.counts?.kpi || 0, {}, locale)}</strong><span>{cx('copy_dept_kpis')}</span></div>
            <div><strong>{formatNumber(preview.counts?.ready || 0, {}, locale)}</strong><span>{cx('copy_ready_count')}</span></div>
            <div><strong>{formatNumber(preview.counts?.existing || 0, {}, locale)}</strong><span>{cx('copy_existing')}</span></div>
            <div><strong>{formatNumber(preview.counts?.blocked || 0, {}, locale)}</strong><span>{cx('copy_needs_setup')}</span></div>
          </div>
          <div className="cqc-warning cqc-note"><AppIcon icon="ShieldCheck" /> {cx('copy_exclusion_note', { count: formatNumber(preview.counts?.excluded_personal_kpis || 0, {}, locale) })}</div>
          <div className="cqc-questions-toolbar">
            <div className="cqc-type-control" role="group" aria-label={cx('copy_question_type')}>
              {[['both','copy_all_questions'],['general','view_general'],['kpi','copy_kpi']].map(([value,label]) => <button key={value} type="button" className={`cyc-btn ${kind === value ? 'cyc-btn--primary' : 'cyc-btn--ghost'}`} onClick={() => setKind(value)}>{cx(label)}</button>)}
            </div>
            <label className="cqc-search"><AppIcon icon="Search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={cx('copy_search_placeholder')} aria-label={cx('copy_search_label')} /></label>
          </div>
          <div className="cqc-select-row"><label><input type="checkbox" checked={allVisibleSelected} disabled={!readyVisible.length} onChange={toggleVisible}/> {cx('copy_select_visible')}</label><strong>{cx('copy_selected', { count: eligibleSelection.length })}</strong></div>
          <div className="cqc-question-list">
            {visible.length === 0 && <p className="cqc-empty">{cx('copy_no_matches')}</p>}
            {visible.map((q) => <label className={`cqc-question ${q.status !== 'ready' ? 'cqc-question--unavailable' : ''}`} key={q.key}>
              <input type="checkbox" checked={selectedSet.has(q.key)} disabled={q.status !== 'ready'} onChange={() => toggleOne(q.key)} />
              <span className="cqc-question__body"><strong>{q.question_text}</strong><small>{q.section_code} · {q.section_label}{q.department ? ` · ${q.department}` : ''}</small></span>
              <span className={`cqc-question__status cqc-question__status--${q.status}`}>{displayCopyStatus(q)}</span>
            </label>)}
          </div>
          <div className="cqc-footer"><span>{cx('copy_existing_note')}</span>
            <button className="cyc-btn cyc-btn--primary" type="button" disabled={!hasSelected || eligibleSelection.length > 2500} onClick={() => { setReason(''); setApproval(true); }}><AppIcon icon="Copy" /> {cx('copy_review_count', { count: eligibleSelection.length })}</button>
          </div>
        </section>}
      </main>
    </div>
    {approval && createPortal(<div className={`cqc-overlay theme-${theme}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !copying) setApproval(false); }}>
      <form className="cqc-dialog" role="dialog" aria-modal="true" aria-labelledby="cqc-approval-title" onSubmit={runCopy}>
        <div className="cqc-dialog__heading"><p className="cyc-eyebrow"><AppIcon icon="LockKeyhole" /> {cx('copy_approval_label')}</p><button type="button" className="cyc-icon-btn" disabled={copying} onClick={() => setApproval(false)} aria-label={cx('view_close')}><AppIcon icon="X"/></button></div>
        <h3 id="cqc-approval-title">{cx('copy_approve_title', { count: eligibleSelection.length })}</h3>
        <p>{cx('copy_approval_description', { source: preview?.source_cycle?.company_name, sourceYear: preview?.source_cycle?.year, target: preview?.target_cycle?.company_name, targetYear: preview?.target_cycle?.year })}</p>
        <label htmlFor="cqc-reason">{cx('copy_reason_label')}</label>
        <textarea id="cqc-reason" autoFocus value={reason} maxLength={500} rows={4} onChange={(event) => setReason(event.target.value)} placeholder={cx('copy_reason_placeholder')} required />
        <small className="cqc-reason-count">{cx('copy_reason_count', { count: reason.trim().length })}</small>
        {!!error && <div className="cqc-dialog__error" role="alert">{error}</div>}
        <div className="cqc-dialog__actions"><button type="button" className="cyc-btn cyc-btn--ghost" disabled={copying} onClick={() => setApproval(false)}>{cx('cancel')}</button><button type="submit" className="cyc-btn cyc-btn--primary" disabled={!validReason(reason) || copying}>{copying ? cx('copy_copying') : cx('copy_confirm')}</button></div>
      </form>
    </div>, document.body)}
  </div>;
}
