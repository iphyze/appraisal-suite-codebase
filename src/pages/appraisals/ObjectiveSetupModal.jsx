import { useTranslation } from 'react-i18next';
import { parseLocalizedNumber, formatNumber } from '../../utils/format';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  FileCheck2,
  FileText,
  LockKeyhole,
  Plus,
  Save,
  Scale,
  Sparkles,
  Target,
  Trash2,
  UnlockKeyhole,
  X,
} from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import AppSelect from '../../components/ui/AppSelect';
import useObjectivePlansStore from '../../stores/useObjectivePlansStore';
import useToastStore from '../../stores/useToastStore';
import AppraisalHelpTip from './AppraisalHelpTip';
import { distributeObjectiveWeights } from './objectiveWeightUtils';
import { generateAiKpiSuggestions, getAiKpiSuggestionsStatus } from '../../services/aiAssistant';

const aiErrorText = (error, t) => error?.response?.data?.message || error?.message || t('setup.suggestionsError');

const makeLocalId = () => `objective-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const clean = (value) => String(value ?? '').trim();
const numeric = (value) => {
  const parsed = parseLocalizedNumber(value);
  return parsed === null ? 0 : parsed;
};

const normalizeSelected = (rows = []) => rows.map((row) => ({
  local_id: `saved-${row.id}`,
  question_id: Number(row.id),
  objective_code: row.objective_code || '',
  question_text: row.question_text || '',
  target: row.target || '',
  evidence_source: row.evidence_source || '',
  weight_percent: row.weight_percent ?? '',
  scope: row.scope || 'department',
  review_status: row.review_status || 'ready',
  review_note: row.review_note || '',
  is_new: false,
}));

const normalizeDefaults = (rows = []) => rows.map((row) => ({
  local_id: `default-${row.id}`,
  question_id: Number(row.id),
  objective_code: row.objective_code || '',
  question_text: row.question_text || '',
  target: row.measure_target || '',
  evidence_source: row.evidence_source || '',
  weight_percent: row.weight_percent ?? '',
  scope: row.scope || 'department',
  review_status: row.review_status || 'ready',
  review_note: row.review_note || '',
  is_new: false,
  is_default_seed: true,
}));

const ObjectiveSetupModal = ({ staff, sectionId, cycle, onClose, onChanged, autoUnlock = false }) => {
  const { t } = useTranslation('objectives');
  const { showToast } = useToastStore();
  const { data, loading, saving, fetchObjectivePlan, saveObjectivePlan, unlockObjectivePlan, clearObjectivePlan } = useObjectivePlansStore();
  const [rows, setRows] = useState([]);
  const [addObjectiveId, setAddObjectiveId] = useState('');
  const [scoringProfileId, setScoringProfileId] = useState('');
  const hydratedRef = useRef('');
  const autoUnlockRef = useRef(false);
  const objectiveBodyRef = useRef(null);
  const pendingObjectiveFocusRef = useRef(null);
  // Stay in equal-weight mode after distributing until a weight is edited manually.
  const keepWeightsEqualRef = useRef(false);
  const suggestionRequestRef = useRef(0);
  const [kpiAiAvailable, setKpiAiAvailable] = useState(false);
  const [kpiAi, setKpiAi] = useState({ rowId: null, loading: false, suggestion: '', error: '', copied: false });

  useEffect(() => () => { suggestionRequestRef.current += 1; }, []);

  useEffect(() => {
    fetchObjectivePlan({ staffUserId: staff.staff_user_id, sectionId });
    return () => clearObjectivePlan();
  }, [clearObjectivePlan, fetchObjectivePlan, sectionId, staff.staff_user_id]);

  useEffect(() => {
    if (!data) return;
    const selected = data.selected || [];
    const defaults = !data.plan && selected.length === 0 ? (data.defaults || []) : [];
    const key = `${data.plan?.id || 'none'}-${data.plan?.updated_at || ''}-${selected.length}-${defaults.length}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;
    keepWeightsEqualRef.current = false;
    setRows(selected.length > 0 ? normalizeSelected(selected) : normalizeDefaults(defaults));
    setScoringProfileId(data.scoring_profile?.id ? String(data.scoring_profile.id) : '');
  }, [data]);

  const config = data?.config || {};
  const locked = data?.plan?.status === 'locked';
  const hasAppraisal = !!data?.has_appraisal;
  const canPrepare = Number(data?.permissions?.can_prepare) === 1;
  const canLock = Number(data?.permissions?.can_lock) === 1;
  const canUnlock = Number(data?.permissions?.can_unlock) === 1;
  useEffect(() => {
    let active = true;
    if (!data || locked || hasAppraisal || !canPrepare) {
      setKpiAiAvailable(false);
      return () => { active = false; };
    }
    getAiKpiSuggestionsStatus()
      .then((result) => { if (active) setKpiAiAvailable(!!result?.enabled); })
      .catch(() => { if (active) setKpiAiAvailable(false); });
    return () => { active = false; };
  }, [data, locked, hasAppraisal, canPrepare]);

  const requestKpiSuggestions = async (row) => {
    if (!kpiAiAvailable || locked || hasAppraisal || !canPrepare || clean(row.question_text).length < 12) return;
    const epoch = ++suggestionRequestRef.current;
    setKpiAi({ rowId: row.local_id, loading: true, suggestion: '', error: '', copied: false });
    try {
      const result = await generateAiKpiSuggestions({
        department: clean(data?.staff?.department || staff.staff_department || staff.department || 'General'),
        role_title: clean(data?.staff?.job_title || staff.staff_job_title || staff.job_title || 'Staff'),
        objective: clean(row.question_text),
        existing_measure: '',
        existing_target: clean(row.target),
        existing_evidence: clean(row.evidence_source),
        timeframe: clean(cycle?.year || data?.section?.cycle_year || ''),
      });
      if (epoch === suggestionRequestRef.current) {
        setKpiAi({ rowId: row.local_id, loading: false, suggestion: result?.suggestion || '', error: '', copied: false });
      }
    } catch (error) {
      if (epoch === suggestionRequestRef.current) {
        setKpiAi({ rowId: row.local_id, loading: false, suggestion: '', error: aiErrorText(error, t), copied: false });
      }
    }
  };

  const copyKpiSuggestions = async () => {
    try {
      await navigator.clipboard.writeText(kpiAi.suggestion);
      setKpiAi((previous) => ({ ...previous, copied: true, error: '' }));
    } catch {
      setKpiAi((previous) => ({ ...previous, error: t('setup.clipboardError') }));
    }
  };

  const usingDepartmentDefaults = !data?.plan && (data?.selected || []).length === 0 && (data?.defaults || []).length > 0;
  const selectedIds = useMemo(() => new Set(rows.map((row) => Number(row.question_id)).filter(Boolean)), [rows]);
  const availableOptions = useMemo(() => (data?.available || [])
    .filter((item) => !selectedIds.has(Number(item.id)))
    .map((item) => ({
      value: item.id,
      label: item.objective_code ? `${item.objective_code} — ${item.question_text}` : item.question_text,
      description: `${t(item.scope === 'individual' ? 'setup.individualObjective' : 'setup.departmentKpi')}${item.review_status === 'needs_review' ? ` • ${t('setup.needsReview')}` : ''}`,
    })), [data?.available, selectedIds, t]);

  const scoringProfileOptions = useMemo(() => (data?.scoring_profiles || []).map((profile) => ({
    value: String(profile.id),
    label: profile.label,
    description: profile.description || profile.code,
  })), [data?.scoring_profiles]);

  const weightTotal = useMemo(() => rows.reduce((sum, row) => sum + numeric(row.weight_percent), 0), [rows]);
  const requiredWeight = numeric(config.required_weight_total || 100);

  const addLibraryObjective = (id) => {
    const objective = (data?.available || []).find((item) => String(item.id) === String(id));
    if (!objective) return;
    setRows((current) => {
      const updated = [...current, {
        local_id: makeLocalId(),
        question_id: Number(objective.id),
        objective_code: objective.objective_code || '',
        question_text: objective.question_text || '',
        target: objective.measure_target || '',
        evidence_source: objective.evidence_source || '',
        weight_percent: objective.weight_percent ?? '',
        scope: objective.scope || 'department',
        review_status: objective.review_status || 'ready',
        review_note: objective.review_note || '',
        is_new: false,
      }];
      return keepWeightsEqualRef.current ? distributeObjectiveWeights(updated, requiredWeight) : updated;
    });
    setAddObjectiveId('');
  };

  const addIndividualObjective = () => {
    const localId = makeLocalId();
    pendingObjectiveFocusRef.current = localId;
    setRows((current) => {
      const updated = [...current, {
        local_id: localId,
        question_id: 0,
        objective_code: '',
        question_text: '',
        target: '',
        evidence_source: '',
        weight_percent: '',
        scope: 'individual',
        review_status: 'ready',
        review_note: '',
        is_new: true,
      }];
      return keepWeightsEqualRef.current ? distributeObjectiveWeights(updated, requiredWeight) : updated;
    });
  };

  // Both Add Individual Objective buttons scroll to, and focus, the new field.
  // Wait until React has rendered the new row in the modal's scrolling body.
  useEffect(() => {
    const localId = pendingObjectiveFocusRef.current;
    if (!localId) return;
    const row = Array.from(objectiveBodyRef.current?.querySelectorAll('[data-objective-id]') || [])
      .find((element) => element.dataset.objectiveId === localId);
    if (!row) return;
    pendingObjectiveFocusRef.current = null;
    row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    row.querySelector('textarea')?.focus({ preventScroll: true });
  }, [rows]);

  const updateRow = (localId, field, value) => {
    if (field === 'weight_percent') keepWeightsEqualRef.current = false;
    // Suggestions use these three fields as context. Discard the draft (and any
    // in-flight response) when that context changes, so it cannot go stale.
    if (['question_text', 'target', 'evidence_source'].includes(field) && kpiAi.rowId === localId) {
      suggestionRequestRef.current += 1;
      setKpiAi({ rowId: null, loading: false, suggestion: '', error: '', copied: false });
    }
    setRows((current) => current.map((row) => row.local_id === localId ? { ...row, [field]: value } : row));
  };

  const removeRow = (localId) => {
    if (kpiAi.rowId === localId) {
      suggestionRequestRef.current += 1;
      setKpiAi({ rowId: null, loading: false, suggestion: '', error: '', copied: false });
    }
    setRows((current) => {
      const updated = current.filter((row) => row.local_id !== localId);
      return keepWeightsEqualRef.current ? distributeObjectiveWeights(updated, requiredWeight) : updated;
    });
  };

  const distributeEqually = () => {
    keepWeightsEqualRef.current = true;
    // The calculation belongs inside the state updater, where the latest
    // number of objectives is guaranteed (even after rapid add/remove clicks).
    setRows((current) => distributeObjectiveWeights(current, requiredWeight));
  };

  const validateForLock = () => {
    const errors = [];
    if (Number(data?.require_explicit_profile) === 1 && !scoringProfileId) errors.push(t('setup.requireProfile'));
    const min = Number(config.min_objectives || 0);
    const max = config.max_objectives === null || config.max_objectives === undefined || config.max_objectives === '' ? null : Number(config.max_objectives);
    if (rows.length < min) errors.push(t('setup.minObjectives', { count: min }));
    if (max !== null && rows.length > max) errors.push(t('setup.maxObjectives', { count: max }));
    rows.forEach((row, index) => {
      if (!clean(row.question_text)) errors.push(t('setup.needsDescription', { number: index + 1 }));
      if (Number(config.require_target) === 1 && !clean(row.target)) errors.push(t('setup.needsTarget', { number: index + 1 }));
      if (Number(config.require_evidence) === 1 && !clean(row.evidence_source)) errors.push(t('setup.needsEvidence', { number: index + 1 }));
      if (Number(config.require_weights) === 1 && !(numeric(row.weight_percent) > 0 && numeric(row.weight_percent) <= 100)) errors.push(t('setup.needsWeight', { number: index + 1 }));
    });
    if (Number(config.require_weights) === 1 && Math.abs(weightTotal - requiredWeight) > 0.01) errors.push(t('setup.weightsTotal', { value: formatNumber(requiredWeight) }));
    return errors;
  };

  const submit = async (lock) => {
    if (lock) {
      const errors = validateForLock();
      if (errors.length) {
        showToast(errors[0], 'error');
        return;
      }
    }

    const result = await saveObjectivePlan({
      staff_user_id: Number(staff.staff_user_id),
      section_id: Number(sectionId),
      scoring_profile_id: scoringProfileId ? Number(scoringProfileId) : null,
      lock,
      objectives: rows.map((row) => ({
        question_id: Number(row.question_id || 0),
        objective_text: row.is_new ? clean(row.question_text) : undefined,
        target: clean(row.target) || null,
        evidence_source: clean(row.evidence_source) || null,
        weight_percent: row.weight_percent === '' ? null : numeric(row.weight_percent),
      })),
    });
    if (result.success) {
      hydratedRef.current = '';
      suggestionRequestRef.current += 1;
      setKpiAi({ rowId: null, loading: false, suggestion: '', error: '', copied: false });
      setRows(normalizeSelected(result.data?.selected || []));
      setScoringProfileId(result.data?.scoring_profile?.id ? String(result.data.scoring_profile.id) : '');
      onChanged?.(result.data);
      // Both Save Draft and Lock Objectives close on successful completion.
      onClose?.();
    }
  };

  const unlock = async () => {
    const result = await unlockObjectivePlan({ staffUserId: staff.staff_user_id, sectionId });
    if (result.success) {
      hydratedRef.current = '';
      suggestionRequestRef.current += 1;
      setKpiAi({ rowId: null, loading: false, suggestion: '', error: '', copied: false });
      setRows(normalizeSelected(result.data?.selected || []));
      setScoringProfileId(result.data?.scoring_profile?.id ? String(result.data.scoring_profile.id) : '');
      onChanged?.(result.data);
    }
  };

  useEffect(() => {
    if (!autoUnlock || autoUnlockRef.current || loading || !data) return;
    if (locked && canUnlock && !hasAppraisal) {
      autoUnlockRef.current = true;
      unlock();
    }
  }, [autoUnlock, canUnlock, data, hasAppraisal, loading, locked]);

  return (
    <motion.div
      className="apr-objective-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <motion.div className="apr-objective-modal apr-objective-modal--setup" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }}>
        <div className="apr-objective-modal__head">
          <div>
            <span className="apr-eyebrow">{t('setup.eyebrow')}</span>
            <h3>{staff.staff_fullname || `${staff.first_name || ''} ${staff.last_name || ''}`.trim()}</h3>
            <p>{cycle?.title || data?.section?.cycle_title} ({cycle?.year || data?.section?.cycle_year}) • {data?.section?.label || t('setup.sectionFallback')}</p>
          </div>
          <button type="button" className="apr-objective-close" onClick={onClose} aria-label={t('setup.close')}><AppIcon icon={X} /></button>
        </div>

        <div className="apr-objective-modal__body" ref={objectiveBodyRef}>
        {loading ? (
          <div className="apr-objective-loading"><span className="apr-spinner" /> {t('setup.loading')}</div>
        ) : !data ? (
          <div className="apr-empty apr-empty--compact"><AppIcon icon={AlertCircle} /><h3>{t('setup.loadingError')}</h3></div>
        ) : (
          <>
            <section className="apr-objective-setup-overview" aria-label={t('setup.overviewAria')}>
              <div className="apr-objective-section-heading">
                <div><span className="apr-objective-kicker">{t('setup.overviewKicker')}</span><h4>{t('setup.overviewTitle')}</h4><p>{t('setup.overviewDetail')}</p></div>
                <span className={`apr-objective-phase ${locked ? 'is-locked' : ''}`}><AppIcon icon={locked ? LockKeyhole : FileText} />{t(locked ? 'setup.lockedPlan' : data.plan ? 'setup.draftPlan' : 'setup.newPlan')}</span>
              </div>
              <div className="apr-objective-summary">
                <div><span className="apr-objective-stat-icon"><AppIcon icon={Target} /></span><span>{t('setup.required')}</span><strong>{t('setup.objectiveCount', { range: `${config.min_objectives || 0}${config.max_objectives ? `–${config.max_objectives}` : '+'}` })}</strong></div>
                <div><span className="apr-objective-stat-icon"><AppIcon icon={FileCheck2} /></span><span>{t('setup.employeeLevel')}</span><strong>{data.scoring_profile?.label || t('setup.notSelected')}</strong></div>
                <div><span className="apr-objective-stat-icon"><AppIcon icon={Scale} /></span><span>{t('setup.weightTarget')}</span><strong>{Number(config.require_weights) === 1 ? t('setup.totalWeight', { value: formatNumber(requiredWeight) }) : t('setup.optional')}</strong></div>
                <div><span className="apr-objective-stat-icon"><AppIcon icon={locked ? LockKeyhole : FileText} /></span><span>{t('setup.planStatus')}</span><strong>{t(locked ? 'setup.lockedStatus' : data.plan ? 'setup.draftStatus' : 'setup.notStarted')}</strong></div>
                <div><span className="apr-objective-stat-icon"><AppIcon icon={FileCheck2} /></span><span>{t('setup.selected')}</span><strong>{t('setup.objectivesCount', { count: rows.length })}</strong></div>
              </div>
            </section>

            {scoringProfileOptions.length > 0 && (
              <section className="apr-objective-setup-panel apr-objective-setup-panel--profile">
                <div className="apr-objective-section-heading apr-objective-section-heading--small">
                  <div><span className="apr-objective-kicker">{t('setup.profileKicker')}</span><h4>{t('setup.profileTitle')}</h4></div>
                </div>
                <div className="apr-objective-profile">
                <AppSelect
                  label={`${t('setup.profileLabel')}${Number(data.require_explicit_profile) === 1 ? ' *' : ''}`}
                  value={scoringProfileId}
                  onChange={(value) => setScoringProfileId(value ? String(value) : '')}
                  options={scoringProfileOptions}
                  searchable={false}
                  clearable={Number(data.require_explicit_profile) !== 1}
                  disabled={locked || hasAppraisal || !canPrepare}
                  placeholder={t('setup.profilePlaceholder')}
                />
                </div>
              </section>
            )}

            {usingDepartmentDefaults && (
              <div className="apr-callout">
                <AppIcon icon={Target} />
                <div>
                  <strong>{t('setup.defaultsTitle')} <AppraisalHelpTip text={t('setup.defaultsHelp')} /></strong>
                  <p>{t('setup.defaultsDetail', { count: rows.length, department: data?.staff?.department || t('setup.departmentFallback') })}</p>
                </div>
              </div>
            )}

            {locked && (
              <div className="apr-callout apr-callout--success">
                <AppIcon icon={CheckCircle2} />
                <div><strong>{t('setup.lockedTitle')}</strong><p>{t('setup.lockedDetail')}</p></div>
              </div>
            )}

            {!locked && canPrepare && (
              <section className="apr-objective-setup-panel apr-objective-setup-panel--library">
                <div className="apr-objective-section-heading apr-objective-section-heading--small">
                  <div><span className="apr-objective-kicker">{t('setup.buildKicker')}</span><h4>{t('setup.buildTitle')}</h4><p>{t('setup.buildDetail')}</p></div>
                </div>
                <div className="apr-objective-picker">
                <AppSelect
                  label={t('setup.libraryLabel')}
                  value={addObjectiveId}
                  onChange={(value) => { setAddObjectiveId(value); addLibraryObjective(value); }}
                  options={availableOptions}
                  searchable
                  clearable
                  placeholder={t('setup.libraryPlaceholder')}
                  icon={Target}
                />
                {Number(config.allow_individual_objectives) === 1 && (
                  <button type="button" className="apr-btn apr-objective-add-btn" onClick={addIndividualObjective}><AppIcon icon={Plus} /> {t('setup.addIndividual')}</button>
                )}
                </div>
              </section>
            )}

            <section className="apr-objective-plan-items" aria-label={t('setup.selectedAria')}>
              <div className="apr-objective-section-heading apr-objective-section-heading--small">
                <div><span className="apr-objective-kicker">{t('setup.detailsKicker')}</span><h4>{t('setup.selectedTitle')} <span className="apr-objective-count">{rows.length}</span></h4><p>{t('setup.detailsDetail')}</p></div>
              </div>
              <div className="apr-objective-list">
              {rows.length === 0 ? (
                <div className="apr-empty apr-empty--compact"><AppIcon icon={Target} /><h3>{t('setup.noObjectives')}</h3><p>{t('setup.noObjectivesDetail')}</p></div>
              ) : rows.map((row, index) => (
                <div className="apr-objective-row" key={row.local_id} data-objective-id={row.local_id}>
                  <div className="apr-objective-row__number">{index + 1}</div>
                  <div className="apr-objective-row__body">
                    <div className="apr-objective-row__title">
                      {row.is_new && !locked && canPrepare ? (
                        <textarea value={row.question_text} onChange={(event) => updateRow(row.local_id, 'question_text', event.target.value)} rows="2" placeholder={t('setup.individualPlaceholder')} />
                      ) : <strong>{row.objective_code ? `${row.objective_code} — ` : ''}{row.question_text}</strong>}
                      <div className="apr-objective-row__actions">
                        <span className={`apr-objective-scope apr-objective-scope--${row.scope}`}>{t(row.scope === 'department' ? 'setup.departmentKpi' : 'setup.individualObjective')}</span>
                        {row.review_status === 'needs_review' && <span className="apr-objective-review">{t('setup.needsReview')}</span>}
                        {!locked && canPrepare && (
                          <button type="button" className="apr-objective-remove" onClick={() => removeRow(row.local_id)} title={t('setup.removeTitle')} aria-label={t('setup.removeObjectiveNumber', { number: index + 1 })}>
                            <AppIcon icon={Trash2} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="apr-objective-fields">
                      <label className="apr-objective-field apr-objective-field--target">
                        <span>{t('setup.targetLabel')} {Number(config.require_target) === 1 ? '*' : ''}</span>
                        <textarea disabled={locked || !canPrepare} value={row.target} onChange={(event) => updateRow(row.local_id, 'target', event.target.value)} rows="2" placeholder={t('setup.targetPlaceholder')} />
                      </label>
                      <label className="apr-objective-field apr-objective-field--evidence">
                        <span>{t('setup.evidenceLabel')} {Number(config.require_evidence) === 1 ? '*' : ''}</span>
                        <input disabled={locked || !canPrepare} value={row.evidence_source} onChange={(event) => updateRow(row.local_id, 'evidence_source', event.target.value)} placeholder={t('setup.evidencePlaceholder')} />
                      </label>
                      {Number(config.require_weights) === 1 && (
                        <label className="apr-objective-field apr-objective-weight">
                          <span>{t('setup.weightLabel')}</span>
                          <span className="apr-objective-weight__control">
                            <input disabled={locked || !canPrepare} type="text" inputMode="decimal" value={row.weight_percent} onChange={(event) => updateRow(row.local_id, 'weight_percent', event.target.value)} placeholder="0" />
                            <span className="apr-objective-weight__suffix">%</span>
                          </span>
                        </label>
                      )}
                    </div>

                    {kpiAiAvailable && !locked && !hasAppraisal && canPrepare && (
                      <div className="apr-objective-kpi-ai">
                        <button
                          type="button"
                          className="apr-mini-btn apr-objective-kpi-ai__trigger"
                          onClick={() => requestKpiSuggestions(row)}
                          disabled={clean(row.question_text).length < 12 || kpiAi.loading}
                          aria-expanded={kpiAi.rowId === row.local_id && (!!kpiAi.suggestion || !!kpiAi.error)}
                        >
                          <AppIcon icon={Sparkles} />
                          {t(kpiAi.loading && kpiAi.rowId === row.local_id ? 'setup.generating' : 'setup.suggestAction')}
                        </button>
                        {kpiAi.rowId === row.local_id && (kpiAi.loading || kpiAi.suggestion || kpiAi.error) && (
                          <div className="apr-objective-kpi-ai__result" aria-live="polite">
                            {kpiAi.loading && <p><span className="apr-spinner" /> {t('setup.preparingAi')}</p>}
                            {kpiAi.error && <p className="apr-objective-kpi-ai__error" role="alert"><AppIcon icon={AlertCircle} /> {kpiAi.error}</p>}
                            {kpiAi.suggestion && (
                              <>
                                <span className="apr-objective-kicker">{t('setup.draftLabel')}</span>
                                <p>{t('setup.draftDetail')}</p>
                                <pre>{kpiAi.suggestion}</pre>
                                <button type="button" className="apr-mini-btn" onClick={copyKpiSuggestions}>
                                  <AppIcon icon={kpiAi.copied ? Check : ClipboardCopy} /> {t(kpiAi.copied ? 'setup.copied' : 'setup.copy')}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {row.review_status === 'needs_review' && row.review_note && <p className="apr-objective-review-note"><AppIcon icon={AlertCircle} /> {row.review_note}</p>}
                  </div>
                </div>
              ))}
              {!locked && canPrepare && Number(config.allow_individual_objectives) === 1 && rows.length > 0 && (
                <div className="apr-objective-add-more">
                  <button type="button" className="apr-btn apr-objective-add-btn" onClick={addIndividualObjective}>
                    <AppIcon icon={Plus} /> {t('setup.addIndividual')}
                  </button>
                </div>
              )}
              </div>
            </section>

            {Number(config.require_weights) === 1 && rows.length > 0 && (
              <div className={`apr-objective-weight-summary ${Math.abs(weightTotal - requiredWeight) <= 0.01 ? 'is-valid' : ''}`}>
                <div className="apr-objective-weight-summary__main">
                  <span className="apr-objective-weight-summary__icon"><AppIcon icon={Scale} /></span>
                  <div className="apr-objective-weight-summary__copy">
                    <span>{t('setup.weightSummary')} <AppraisalHelpTip text={t('setup.weightHelp')} /></span>
                    <strong>{t('setup.percent', { value: formatNumber(weightTotal, { maximumFractionDigits: 2 }) })} <small>{t('setup.ofWeight', { value: formatNumber(requiredWeight) })}</small></strong>
                  </div>
                  <span className="apr-objective-weight-summary__state">
                    {Math.abs(weightTotal - requiredWeight) <= 0.01
                      ? t('setup.weightComplete')
                      : weightTotal < requiredWeight
                        ? t('setup.remaining', { value: formatNumber(requiredWeight - weightTotal, { maximumFractionDigits: 2 }) })
                        : t('setup.over', { value: formatNumber(weightTotal - requiredWeight, { maximumFractionDigits: 2 }) })}
                  </span>
                </div>
                <div className="apr-objective-weight-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, requiredWeight > 0 ? (weightTotal / requiredWeight) * 100 : 0)}%` }} /></div>
                {!locked && canPrepare && <button type="button" className="apr-mini-btn apr-objective-distribute-btn" onClick={distributeEqually} title={t('setup.distributeTitle')}><AppIcon icon={Scale} /> {t('setup.distribute')}</button>}
              </div>
            )}

          </>
        )}
        </div>

        <div className="apr-objective-modal__actions">
          <button type="button" className="apr-btn apr-btn--ghost" onClick={onClose} disabled={saving}>{t('setup.close')}</button>
          {!loading && data && (locked ? (
            !hasAppraisal && canUnlock ? <button type="button" className="apr-btn apr-btn--ghost" disabled={saving} onClick={unlock}><AppIcon icon={UnlockKeyhole} /> {t('setup.unlock')}</button> : null
          ) : (
            <>
              {canPrepare && <button type="button" className="apr-btn apr-btn--ghost" disabled={saving} onClick={() => submit(false)}><AppIcon icon={Save} /> {t('setup.saveDraft')}</button>}
              {canLock && <button type="button" className="apr-btn apr-btn--primary" disabled={saving} onClick={() => submit(true)}><AppIcon icon={LockKeyhole} /> {t('setup.lock')}</button>}
            </>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ObjectiveSetupModal;
