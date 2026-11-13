import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleAlert, CopyCheck, LockKeyhole, RefreshCw, ShieldCheck, X } from 'lucide-react';
import AppSelect from '../../components/ui/AppSelect';
import useToastStore from '../../stores/useToastStore';
import useThemeStore from '../../stores/useThemeStore';
import { applyCompanySetup, previewCompanySetup } from '../../services/companySetupCopy';
import {
  copyReasonValid, errorMessage, previewMatchesSelection, SETUP_COUNT_LABELS, validateSetupSelection,
} from '../../utils/companySetupCopy';
import './CompanySetupCopy.css';

const selectionKeys = Object.freeze({
  'Select an active source appraisal cycle.': 'setup_select_source',
  'Select the new target company.': 'setup_select_new_target',
  'Select an active target company.': 'setup_select_active_target',
  'Source and target companies must be different.': 'setup_different_companies',
});

/**
 * The company record must be created through the normal Companies form first.
 * The backend rejects non-empty target companies and copies configuration only.
 */
export default function CompanySetupCopy({ companies, cycles, cyclesLoading, reloadCycles, initialTargetId }) {
  const { t, i18n } = useTranslation('company');
  const { showToast } = useToastStore();
  const { theme } = useThemeStore();
  const [targetId, setTargetId] = useState('');
  const [sourceCompanyId, setSourceCompanyId] = useState('');
  const [sourceCycleId, setSourceCycleId] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approval, setApproval] = useState(null);
  const [reason, setReason] = useState('');
  const [copying, setCopying] = useState(false);
  const [completed, setCompleted] = useState(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (initialTargetId) {
      requestVersion.current += 1;
      setPreview(null);
      setCompleted(null);
      setTargetId(String(initialTargetId));
    }
  }, [initialTargetId]);
  useEffect(() => () => { requestVersion.current += 1; }, []);

  // The approval dialog is portaled to <body>, outside any transformed or
  // scrolling application container. Keep page scrolling locked while open.
  useEffect(() => {
    if (!approval || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [approval]);

  const activeCompanies = useMemo(() => companies.filter((item) => Number(item.is_active) === 1), [companies]);
  const sourceCompanies = useMemo(() => activeCompanies.filter((company) =>
    cycles.some((cycle) => Number(cycle.is_active) === 1 && String(cycle.company_id) === String(company.id))
    && String(company.id) !== String(targetId)
  ), [activeCompanies, cycles, targetId]);
  const availableCycles = useMemo(() => cycles.filter((cycle) => Number(cycle.is_active) === 1
    && String(cycle.company_id) === String(sourceCompanyId)), [cycles, sourceCompanyId]);
  const selectionError = validateSetupSelection({ sourceCycleId, targetCompanyId: targetId, cycles, companies });
  const ready = !selectionError;
  const currentPreview = previewMatchesSelection(preview, sourceCycleId, targetId) ? preview : null;
  const previewErrorText = ['setup_preview_mismatch', 'setup_preview_error', 'setup_copy_error', 'setup_response_lost'].includes(previewError)
    ? t(previewError) : previewError;

  const clearPreview = () => {
    requestVersion.current += 1;
    setPreview(null);
    setPreviewError('');
    setPreviewLoading(false);
    setApproval(null);
    setReason('');
    setCompleted(null);
  };

  const changeTarget = (value) => {
    if (copying) return;
    clearPreview();
    setTargetId(String(value || ''));
    if (String(sourceCompanyId) === String(value)) { setSourceCompanyId(''); setSourceCycleId(''); }
  };
  const changeSource = (value) => {
    if (copying) return;
    clearPreview();
    setSourceCompanyId(String(value || ''));
    setSourceCycleId('');
  };
  const changeCycle = (value) => {
    if (copying) return;
    clearPreview();
    setSourceCycleId(String(value || ''));
  };

  const loadPreview = async () => {
    if (!ready || previewLoading || copying) return;
    const token = ++requestVersion.current;
    setPreviewError('');
    setPreview(null);
    setCompleted(null);
    setPreviewLoading(true);
    try {
      const result = await previewCompanySetup(sourceCycleId, targetId);
      if (requestVersion.current === token) {
        if (!previewMatchesSelection(result, sourceCycleId, targetId)) throw new Error('setup_preview_mismatch');
        setPreview(result);
      }
    } catch (error) {
      if (requestVersion.current === token) setPreviewError(errorMessage(error, 'setup_preview_error'));
    } finally {
      if (requestVersion.current === token) setPreviewLoading(false);
    }
  };

  const confirmCopy = async (event) => {
    event.preventDefault();
    if (!approval || !copyReasonValid(reason) || copying) return;
    setCopying(true);
    setPreviewError('');
    try {
      // The PHP server re-checks the empty target and all source data in a transaction.
      const result = await applyCompanySetup({
        sourceCycleId: approval.source_cycle.id,
        targetCompanyId: approval.target_company.id,
        reason,
      });
      setApproval(null);
      setReason('');
      setPreview(null);
      setCompleted({ company: approval.target_company.name, cycleId: result?.cycle_id });
      showToast(t('setup_success'), 'success');
      reloadCycles?.().catch(() => {});
    } catch (error) {
      setPreviewError(errorMessage(error, 'setup_copy_error'));
      // Keep the approval and reason for a clearly failed 4xx response; a network
      // error could mean the server committed, so refresh before retrying.
      if (!error?.response) {
        setApproval(null);
        setPreview(null);
        setPreviewError('setup_response_lost');
      }
    } finally { setCopying(false); }
  };

  return (
    <section className="mod-card csc" aria-labelledby="csc-title">
      <div className="csc__head">
        <div><p className="mod-eyebrow">{t('setup_optional')}</p><h2 id="csc-title">{t('setup_title')}</h2><p>{t('setup_description')}</p></div>
        <button type="button" className="mod-btn mod-btn--ghost" onClick={() => { clearPreview(); reloadCycles?.().catch(() => {}); }} disabled={cyclesLoading || copying}>
          <RefreshCw size={15} /> {t('setup_refresh')}
        </button>
      </div>
      <div className="csc__fields">
        <AppSelect label={t('setup_target_label')} value={targetId} onChange={changeTarget} searchable clearable={false} disabled={copying}
          placeholder={t('setup_target_placeholder')} options={activeCompanies.map((company) => ({ value: String(company.id), label: company.name, description: company.code }))} />
        <AppSelect label={t('setup_source_label')} value={sourceCompanyId} onChange={changeSource} searchable clearable={false} disabled={copying || cyclesLoading}
          placeholder={t('setup_source_placeholder')} options={sourceCompanies.map((company) => ({ value: String(company.id), label: company.name, description: company.code }))} />
        <AppSelect label={t('setup_cycle_label')} value={sourceCycleId} onChange={changeCycle} searchable clearable={false} disabled={copying || !sourceCompanyId || cyclesLoading}
          placeholder={cyclesLoading ? t('setup_loading_cycles') : t('setup_cycle_placeholder')} options={availableCycles.map((cycle) => ({ value: String(cycle.id), label: `${cycle.title} (${cycle.year})`, description: cycle.company_name || '' }))} />
      </div>
      <p className="csc__hint"><ShieldCheck size={16} /> {t('setup_hint')}</p>
      <div className="csc__actions">
        <button type="button" className="mod-btn mod-btn--primary" disabled={!ready || previewLoading || copying} onClick={loadPreview}>{previewLoading ? t('setup_checking') : t('setup_preview_action')}</button>
        {selectionError && <span className="csc__selection-note">{t(selectionKeys[selectionError] || 'setup_select_source')}</span>}
      </div>
      {!!previewError && <div className="csc__error" role="alert"><CircleAlert size={16} /> {previewErrorText}</div>}
      {!!completed && <div className="csc__success" role="status"><CheckCircle2 size={19} /><div><strong>{t('setup_success_title', { company: completed.company })}</strong><p>{t('setup_new_cycle', { id: completed.cycleId || '—' })}</p></div></div>}
      {currentPreview && !completed && <div className="csc__preview" aria-label={t('setup_preview_aria')}>
        <div className="csc__preview-head"><div><h3>{t('setup_preview_title')}</h3><p>{currentPreview.source_company?.name} · {currentPreview.source_cycle?.title} ({currentPreview.source_cycle?.year}) → {currentPreview.target_company?.name}</p></div><span className="csc__preview-label">{t('setup_preview_badge')}</span></div>
        <div className="csc__count-grid">{SETUP_COUNT_LABELS.map(([key]) => <div className="csc__count" key={key}><strong>{formatNumber(Number(currentPreview.counts?.[key] || 0), {}, i18n.language)}</strong><span>{t(`counts_${key}`)}</span></div>)}</div>
        <p className="csc__excluded"><strong>{t('setup_not_copied')}</strong> {(currentPreview.excluded || []).map((item) => t(`excluded_${item}`, { defaultValue: String(item).replaceAll('_', ' ') })).join(', ')}. {t('setup_also_excluded', { count: Number(currentPreview.counts?.excluded_personal_kpis || 0) })}</p>
        <button className="mod-btn mod-btn--primary" type="button" onClick={() => { setApproval(currentPreview); setReason(''); }} disabled={copying}><CopyCheck size={17} /> {t('setup_approve_action')}</button>
      </div>}
      {approval && typeof document !== 'undefined' && createPortal(<div className={`csc__overlay theme-${theme}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !copying) setApproval(null); }}>
        <form className="csc__dialog" role="dialog" aria-modal="true" aria-labelledby="csc-approval-title" onSubmit={confirmCopy}>
          <div className="csc__dialog-eyebrow"><LockKeyhole size={16} /> {t('setup_super_approval')}<button type="button" aria-label={t('setup_close_approval')} disabled={copying} onClick={() => setApproval(null)}><X size={18} /></button></div>
          <h3 id="csc-approval-title">{t('setup_approval_title')}</h3>
          <p>{t('setup_approval_description', { source: approval.source_company.name, target: approval.target_company.name })}</p>
          <label htmlFor="csc-reason">{t('setup_reason_label')} <span aria-hidden="true">*</span></label>
          <textarea id="csc-reason" required autoFocus disabled={copying} minLength={5} maxLength={500} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('setup_reason_placeholder')} />
          <div className="csc__reason-count">{t('setup_reason_count', { count: Array.from(reason.trim()).length })}</div>
          {!!previewError && <p className="csc__error" role="alert">{previewErrorText}</p>}
          <div className="csc__dialog-actions"><button className="mod-btn mod-btn--ghost" type="button" disabled={copying} onClick={() => setApproval(null)}>{t('setup_cancel')}</button><button className="mod-btn mod-btn--primary" type="submit" disabled={copying || !copyReasonValid(reason)}>{copying ? t('setup_copying') : t('setup_confirm')}</button></div>
        </form>
      </div>, document.body)}
    </section>
  );
}
