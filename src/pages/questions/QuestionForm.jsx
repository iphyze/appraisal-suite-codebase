import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatNumber, parseLocalizedNumber, compareLocalized } from '../../utils/format';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import AppSelect from '../../components/ui/AppSelect';
import AppDatePicker from '../../components/ui/AppDatePicker';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import useToastStore from '../../stores/useToastStore';
import useGeneralQuestionsStore from '../../stores/useGeneralQuestionsStore';
import useKpiQuestionsStore from '../../stores/useKpiQuestionsStore';
import { basePath, isKpiType, sectionType } from './helpers';
import './Questions.css';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import AppIcon from '../../components/ui/AppIcon';
import { Sparkles } from 'lucide-react';
import AiSetupGuide from '../../components/ai/AiSetupGuide';

const qf = (key, options) => i18n.t(key, { ns: 'questions', ...options });
// Translate display metadata only; values are stable backend API codes.
const activeOptions = () => [
  { value: 1, label: qf('active'), description: qf('form_active_description') },
  { value: 0, label: qf('inactive'), description: qf('form_inactive_description') },
];
const objectiveReviewOptions = () => [
  { value: 'ready', label: qf('ready'), description: qf('form_ready_description') },
  { value: 'needs_review', label: qf('needs_review'), description: qf('form_needs_review_description') },
];
const scopeOptionsFor = (isSupervisor) => [
  ...(isSupervisor ? [] : [{ value: 'department', label: qf('scope_department'), description: qf('form_scope_department_description') }]),
  { value: 'supervisor', label: qf(isSupervisor ? 'form_my_team' : 'scope_supervisor'), description: qf(isSupervisor ? 'form_my_team_description' : 'form_scope_supervisor_description') },
  { value: 'individual', label: qf('scope_individual'), description: qf('form_scope_individual_description') },
];

const text = (value) => (value ?? '').toString().trim();
// When Batch 6 provides localized read values alongside *_source, editors still
// update the original English source. Older API responses remain compatible.
const sourceContent = (record, field) => record?.[`${field}_source`] ?? record?.[field] ?? '';
const currentYear = new Date().getFullYear();

const emptyForm = {
  company_id: '',
  cycle_id: '',
  section_id: '',
  department: '',
  is_active: 1,
  scope: 'department',
  supervisor_id: '',
  staff_user_id: '',
};

const emptyQuestionRow = () => ({
  rowKey: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  id: '',
  question_text: '',
  objective_code: '',
  measure_target: '',
  evidence_source: '',
  review_status: 'ready',
  review_note: '',
  question_code: '',
  question_label: '',
  anchor_low_value: 1,
  anchor_low_text: '',
  anchor_mid_value: 3,
  anchor_mid_text: '',
  anchor_high_value: 5,
  anchor_high_text: '',
  profile_ids: [],
  sort_order: 1,
  weight_percent: '',
  is_active: 1,
});

const emptyCycleForm = {
  title: `Annual Appraisal ${currentYear}`,
  year: currentYear,
  start_date: '',
  end_date: '',
  is_active: 1,
};

const emptySectionForm = {
  cycle_id: '',
  code: '',
  label: '',
  weight: '',
  sort_order: 0,
  is_active: 1,
};

const emptyDepartmentForm = {
  name: '',
  code: '',
  description: '',
  is_active: 1,
};

const makeCode = (value) => {
  const words = text(value).split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.map((word) => word[0]).join('').slice(0, 10).toUpperCase();
};

const getCompanyId = (user, form) => (
  form.company_id ||
  user?.company_id ||
  user?.companyId ||
  user?.company?.id ||
  ''
);

const extractPayloadData = (response) => {
  const data = response?.data?.data;
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === 'object') return data;
  if (response?.data?.department) return response.data.department;
  if (response?.data?.cycle) return response.data.cycle;
  if (response?.data?.section) return response.data.section;
  return null;
};

const ModalFieldError = ({ message }) => {
  if (!message) return null;
  return <p className="qst-error"><AppIcon icon="AlertCircle" /> {message}</p>;
};

const QuickCreateModal = ({
  open,
  title,
  subtitle,
  icon = 'Plus',
  children,
  saving = false,
  submitLabel,
  onClose,
  onSubmit,
}) => {
  useTranslation('questions');
  const [themeClass, setThemeClass] = useState('theme-light');

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('qst-modal-open');

    const pageEl = document.querySelector('.qst-page');
    const isDark = pageEl?.classList.contains('theme-dark') || false;
    setThemeClass(isDark ? 'theme-dark' : 'theme-light');

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('qst-modal-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, saving, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`qst-quick-modal-backdrop ${themeClass}`}
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            className={`qst-quick-modal ${themeClass}`}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="qst-quick-modal__head">
              <div className="qst-quick-modal__title-wrap">
                <span className="qst-quick-modal__icon">
                  <AppIcon icon={icon} />
                </span>
                <div>
                  <span className="qst-eyebrow">{qf('form_quick_create')}</span>
                  <h3>{title}</h3>
                  {subtitle && <p>{subtitle}</p>}
                </div>
              </div>

              <button
                type="button"
                className="qst-quick-modal__close"
                onClick={onClose}
                disabled={saving}
                aria-label={qf('form_close_modal')}
              >
                <AppIcon icon="X" />
              </button>
            </div>

            <div className="qst-quick-modal__body">
              {children}
            </div>

            <div className="qst-quick-modal__actions">
              <button type="button" className="qst-secondary-btn" onClick={onClose} disabled={saving}>
                {qf('form_cancel')}
              </button>

              <button type="button" className="qst-primary-btn" onClick={onSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <span className="qst-spinner" />
                    {qf('form_saving')}
                  </>
                ) : (
                  <>
                    {submitLabel || qf('form_create')}
                    <AppIcon icon="ArrowRight" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const DeleteQuestionRowModal = ({ target, questionType = 'KPI', onCancel, onConfirm }) => (
  <AnimatePresence>
    {target && (
      <motion.div
        className="qst-modal-backdrop"
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onCancel?.();
        }}
      >
        <motion.div
          className="qst-modal"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="qst-modal-head">
            <div className="qst-modal-heading">
              <span className="qst-modal-icon"><AppIcon icon="Trash2" /></span>
              <div><span>{qf('form_confirmation')}</span><h3>{qf('form_delete_question_title', { questionType: qf(questionType === 'KPI' ? 'form_question_type_kpi' : 'form_question_type_general') })}</h3></div>
            </div>
            <button type="button" className="qst-modal-close" onClick={onCancel} aria-label={qf('form_close_delete_confirmation')}><AppIcon icon="X" /></button>
          </div>
          <div className="qst-modal-body">
            <p>
              {qf(questionType === 'KPI' ? 'form_kpi_safe_remove_explanation' : 'form_delete_question_explanation')}
            </p>
            <div className="qst-modal-preview">
              <strong>{target.row?.question_text || qf('form_selected_question', { questionType: qf(questionType === 'KPI' ? 'form_question_type_kpi' : 'form_question_type_general') })}</strong>
              <small>{qf('form_question_id', { id: target.row?.id })}</small>
            </div>
          </div>
          <div className="qst-modal-actions">
            <button type="button" className="qst-secondary-btn" onClick={onCancel}>{qf('form_cancel')}</button>
            <button type="button" className="qst-danger-btn" onClick={onConfirm}>
              <AppIcon icon="Trash2" /> {qf('form_delete_on_save')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const QuestionRowsEditor = ({
  rows,
  errors,
  onChange,
  onAdd,
  onRemove,
  onToggleStatus,
  isEdit,
  showWeights = false,
  showStatus = false,
  showObjectiveMetadata = false,
  showAnchors = false,
  profileOptions = [],
  canDeleteExisting = true,
  weightTotal = 0,
  weightTotalError = '',
}) => {
  const { i18n: { language: locale } } = useTranslation('questions');
  const rowClass = [
    'qst-question-row',
    showWeights ? 'qst-question-row--weighted' : '',
    showStatus ? 'qst-question-row--with-status' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="qst-question-rows">
      <div className="qst-question-rows__head">
        <div>
          <span className="qst-eyebrow">{qf('form_question_rows')}</span>
          <h3>{qf(isEdit ? 'form_update_or_add' : 'form_add_multiple')}</h3>
          <p>
            {qf(showStatus ? 'form_grouped_rows_hint' : 'form_rows_hint')}
          </p>
        </div>
      </div>

      <div className="qst-question-rows__table">
        <div className={`${rowClass} qst-question-row--header`}>
          <span>{qf('form_question_text')}</span>
          {showWeights && <span>{qf('form_weight_percent')}</span>}
          {showStatus && <span>{qf('status')}</span>}
          <span>{qf('form_sort_order')}</span>
          <span />
        </div>

        {rows.map((row, index) => {
          const savedDeleteBlocked = Boolean(row.id && !canDeleteExisting);
          const deleteDisabled = rows.length === 1 || savedDeleteBlocked;
          const deleteTitle = rows.length === 1
            ? qf('form_at_least_one_row')
            : savedDeleteBlocked
              ? qf('form_only_admin_delete')
              : row.id
                ? qf('form_delete_saved_on_save')
                : qf('form_remove_row');

          return (
            <motion.div
              className={rowClass}
              key={row.rowKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="qst-question-row__question" data-invalid={errors?.[index]?.question_text ? 'true' : undefined}>
                {row.id && <span className="qst-row-id">{qf('form_question_number', { id: row.id })}</span>}
                <textarea
                  name={`question_text_${index}`}
                  autoComplete="on"
                  value={row.question_text}
                  onChange={(event) => onChange(index, 'question_text', event.target.value)}
                  rows={2}
                  placeholder={qf('form_enter_question', { number: formatNumber(index + 1, {}, locale) })}
                  className={errors?.[index]?.question_text ? 'qst-textarea qst-textarea--error' : 'qst-textarea'}
                  aria-invalid={Boolean(errors?.[index]?.question_text)}
                />
                <ModalFieldError message={errors?.[index]?.question_text} />
              </div>

              {showWeights && (
                <div className="qst-question-row__weight">
                  <div className={errors?.[index]?.weight_percent ? 'qst-input qst-input--error' : 'qst-input'} data-invalid={errors?.[index]?.weight_percent ? 'true' : undefined}>
                    <AppIcon icon="Percent" />
                    <input
                      type="text"
                      inputMode="decimal"
                      name={`question_weight_${index}`}
                      aria-label={qf('form_weight_for_question', { number: formatNumber(index + 1, {}, locale) })}
                      autoComplete="off"
                      value={row.weight_percent}
                      onChange={(event) => onChange(index, 'weight_percent', event.target.value)}
                      placeholder={Number(row.is_active ?? 1) === 1 ? '0' : '—'}
                      disabled={showStatus && Number(row.is_active ?? 1) !== 1}
                    />
                  </div>
                  <ModalFieldError message={errors?.[index]?.weight_percent} />
                </div>
              )}

              {showStatus && (
                <button
                  type="button"
                  className={`qst-row-status qst-row-status--${Number(row.is_active ?? 1) === 1 ? 'active' : 'inactive'}`}
                  onClick={() => onToggleStatus(index)}
                  title={qf(Number(row.is_active ?? 1) === 1 ? 'form_set_inactive' : 'form_set_active')}
                >
                  <AppIcon icon={Number(row.is_active ?? 1) === 1 ? 'Eye' : 'EyeOff'} />
                  {qf(Number(row.is_active ?? 1) === 1 ? 'active' : 'inactive')}
                </button>
              )}

              <div className="qst-question-row__order">
                <div className={errors?.[index]?.sort_order ? 'qst-input qst-input--error' : 'qst-input'} data-invalid={errors?.[index]?.sort_order ? 'true' : undefined}>
                  <AppIcon icon="ArrowDownWideNarrow" />
                  <input
                    type="number"
                    name={`question_sort_order_${index}`}
                    aria-label={qf('form_order_for_question', { number: formatNumber(index + 1, {}, locale) })}
                    autoComplete="on"
                    min="0"
                    value={row.sort_order}
                    onChange={(event) => onChange(index, 'sort_order', event.target.value)}
                  />
                </div>
                <ModalFieldError message={errors?.[index]?.sort_order} />
              </div>

              <button
                type="button"
                className="qst-remove-row-btn"
                aria-label={deleteTitle}
                onClick={() => onRemove(index)}
                disabled={deleteDisabled}
                title={deleteTitle}
              >
                <AppIcon icon="Trash2" />
              </button>

              {showObjectiveMetadata && (
                <div className="qst-objective-meta">
                  <div className="qst-objective-meta__head">
                    <span><AppIcon icon="Target" /> {qf('form_objective_details')}</span>
                    <small>{qf('form_objective_optional')}</small>
                  </div>

                  <div className="qst-objective-meta__grid">
                    <div className="qst-field">
                      <label htmlFor={`objective_code_${index}`}>{qf('form_reference_code')}</label>
                      <div className="qst-input">
                        <AppIcon icon="Hash" />
                        <input
                          id={`objective_code_${index}`}
                          name={`objective_code_${index}`}
                          autoComplete="off"
                          value={row.objective_code || ''}
                          onChange={(event) => onChange(index, 'objective_code', event.target.value)}
                          placeholder={qf('form_objective_code_example')}
                        />
                      </div>
                    </div>

                    <div className="qst-field">
                      <AppSelect
                        label={qf('form_review_status')}
                        value={row.review_status || 'ready'}
                        onChange={(value) => onChange(index, 'review_status', value)}
                        options={objectiveReviewOptions()}
                        searchable={false}
                        clearable={false}
                      />
                    </div>

                    <div className="qst-field qst-objective-meta__wide">
                      <label htmlFor={`measure_target_${index}`}>{qf('measure_target')}</label>
                      <textarea
                        id={`measure_target_${index}`}
                        name={`measure_target_${index}`}
                        value={row.measure_target || ''}
                        onChange={(event) => onChange(index, 'measure_target', event.target.value)}
                        rows={2}
                        className="qst-textarea"
                        placeholder={qf('form_target_placeholder')}
                      />
                    </div>

                    <div className="qst-field qst-objective-meta__wide">
                      <label htmlFor={`evidence_source_${index}`}>{qf('evidence_data_source')}</label>
                      <textarea
                        id={`evidence_source_${index}`}
                        name={`evidence_source_${index}`}
                        value={row.evidence_source || ''}
                        onChange={(event) => onChange(index, 'evidence_source', event.target.value)}
                        rows={2}
                        className="qst-textarea"
                        placeholder={qf('form_evidence_placeholder')}
                      />
                    </div>

                    <div className="qst-field qst-objective-meta__wide qst-objective-meta__note">
                      <label htmlFor={`review_note_${index}`}>{qf('review_note')}</label>
                      <textarea
                        id={`review_note_${index}`}
                        name={`review_note_${index}`}
                        value={row.review_note || ''}
                        onChange={(event) => onChange(index, 'review_note', event.target.value)}
                        rows={2}
                        className="qst-textarea"
                        placeholder={qf('form_review_note_placeholder')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showAnchors && (
                <div className="qst-objective-meta qst-anchor-meta">
                  <div className="qst-objective-meta__head">
                    <span><AppIcon icon="Gauge" /> {qf('form_anchors_heading')}</span>
                    <small>{qf('form_anchors_hint')}</small>
                  </div>
                  <div className="qst-objective-meta__grid">
                    <div className="qst-field">
                      <label htmlFor={`question_code_${index}`}>{qf('form_reference_code')}</label>
                      <div className="qst-input"><AppIcon icon="Hash" /><input id={`question_code_${index}`} value={row.question_code || ''} onChange={(event) => onChange(index, 'question_code', event.target.value)} placeholder={qf('form_question_code_example')} /></div>
                    </div>
                    <div className="qst-field">
                      <label htmlFor={`question_label_${index}`}>{qf('form_short_label')}</label>
                      <div className="qst-input"><AppIcon icon="Tag" /><input id={`question_label_${index}`} value={row.question_label || ''} onChange={(event) => onChange(index, 'question_label', event.target.value)} placeholder={qf('form_question_label_example')} /></div>
                    </div>
                    {[
                      ['low', 'form_low_anchor'],
                      ['mid', 'form_mid_anchor'],
                      ['high', 'form_high_anchor'],
                    ].map(([key, label]) => (
                      <div className="qst-anchor-row qst-objective-meta__wide" key={key}>
                        <label>{qf(label)}</label>
                        <div className="qst-anchor-row__inputs">
                          <div className="qst-input qst-anchor-value"><AppIcon icon="Star" /><input type="text" inputMode="decimal" aria-label={qf('form_anchor_value_label', { anchor: qf(label) })} value={row[`anchor_${key}_value`] ?? ''} onChange={(event) => onChange(index, `anchor_${key}_value`, event.target.value)} placeholder={key === 'low' ? '1' : key === 'mid' ? '3' : '5'} /></div>
                          <textarea className="qst-textarea" rows={2} aria-label={qf('form_anchor_description_label', { anchor: qf(label) })} value={row[`anchor_${key}_text`] || ''} onChange={(event) => onChange(index, `anchor_${key}_text`, event.target.value)} placeholder={qf(key === 'low' ? 'form_low_anchor_placeholder' : key === 'mid' ? 'form_mid_anchor_placeholder' : 'form_high_anchor_placeholder')} />
                        </div>
                      </div>
                    ))}
                    {profileOptions.length > 0 && (
                      <div className="qst-field qst-objective-meta__wide">
                        <label>{qf('form_applies_to_profiles')}</label>
                        <p className="qst-anchor-help">{qf('form_profiles_hint')}</p>
                        <div className="qst-profile-checks">
                          {profileOptions.map((profile) => {
                            const selected = (row.profile_ids || []).map(String).includes(String(profile.value));
                            return (
                              <button
                                type="button"
                                key={profile.value}
                                className={`qst-profile-check ${selected ? 'is-selected' : ''}`}
                                onClick={() => {
                                  const current = (row.profile_ids || []).map(String);
                                  const next = selected ? current.filter((id) => id !== String(profile.value)) : [...current, String(profile.value)];
                                  onChange(index, 'profile_ids', next);
                                }}
                              >
                                <AppIcon icon={selected ? 'CheckCircle2' : 'Circle'} /> {profile.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {showWeights && (
        <div className={`qst-weight-total ${weightTotalError ? 'qst-weight-total--error' : weightTotal === 100 ? 'qst-weight-total--complete' : ''}`}>
          <span>{qf(showStatus ? 'form_active_weight_total' : 'form_weight_total')}</span>
          <strong>{qf('form_weight_total_of', { total: formatNumber(weightTotal, { maximumFractionDigits: 2 }, locale) })}</strong>
          <small>{weightTotalError || qf(weightTotal === 100 ? 'form_ready_for_weights' : weightTotal < 100 ? 'form_weight_remaining' : 'form_weight_over', { amount: formatNumber(Math.abs(100 - weightTotal), { maximumFractionDigits: 2 }, locale) })}</small>
        </div>
      )}

      <div className="qst-question-rows__footer">
        <button type="button" className="qst-add-row-btn" onClick={onAdd}>
          <AppIcon icon="Plus" /> {qf('form_add_row')}
        </button>
      </div>
    </div>
  );
};

const QuestionForm = ({ type = 'kpi', mode = 'create', initialQuestion = null }) => {
  const { i18n: { language: locale } } = useTranslation('questions');
  const isKpi = isKpiType(type);
  const isEdit = mode === 'edit';
  const isGroupedEdit = isEdit && Array.isArray(initialQuestion?.questions);
  const isGroupedKpiEdit = isKpi && isGroupedEdit;

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const formRef = useRef(null);

  const generalStore = useGeneralQuestionsStore();
  const kpiStore = useKpiQuestionsStore();

  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([emptyQuestionRow()]);
  const [aiGuideOpen, setAiGuideOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [weightingEnabled, setWeightingEnabled] = useState(false);
  const [weightingDirty, setWeightingDirty] = useState(false);
  const [removedRows, setRemovedRows] = useState([]);
  const [deleteRowTarget, setDeleteRowTarget] = useState(null);

  const [cycles, setCycles] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [scoringProfiles, setScoringProfiles] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [quickModal, setQuickModal] = useState(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickErrors, setQuickErrors] = useState({});

  const [quickCycle, setQuickCycle] = useState(emptyCycleForm);
  const [quickSection, setQuickSection] = useState(emptySectionForm);
  const [quickDepartment, setQuickDepartment] = useState(emptyDepartmentForm);

  const isSupervisor = user?.role === 'supervisor';
  const isAdminLike = ['super_admin', 'admin'].includes(user?.role);
  const saving = generalStore.saving || kpiStore.saving;

  const fetchCycles = async () => {
    try {
      const response = await api.get('/cycles/list?limit=100&page=1&sortBy=year&sortOrder=DESC');
      const data = response.data?.data || [];
      setCycles(data);
      return data;
    } catch {
      setCycles([]);
      return [];
    }
  };

  const fetchSections = async (cycleId = form.cycle_id) => {
    if (!cycleId) {
      setSections([]);
      return [];
    }

    try {
      const params = new URLSearchParams({
        limit: '100',
        page: '1',
        type: sectionType(type),
        is_active: '1',
        sortBy: 'sort_order',
        sortOrder: 'ASC',
      });

      params.append('cycle_id', cycleId);

      const response = await api.get(`/sections/list?${params.toString()}`);
      const data = response.data?.data || [];
      setSections(data);
      return data;
    } catch {
      setSections([]);
      return [];
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments/list?limit=500&page=1&is_active=1&sortBy=name&sortOrder=ASC');
      const data = response.data?.data || [];
      setDepartments(data);
      return data;
    } catch {
      setDepartments([]);
      return [];
    }
  };

  useEffect(() => {
    if (!initialQuestion) return;

    const nextScope = initialQuestion.scope || (initialQuestion.staff_user_id
      ? 'individual'
      : initialQuestion.supervisor_id
        ? 'supervisor'
        : 'department');

    const groupedRows = isGroupedEdit
      ? initialQuestion.questions.map((question) => ({
        rowKey: `existing-${question.id}`,
        id: question.id || '',
        question_text: sourceContent(question, 'question_text'),
        objective_code: question.objective_code || '',
        measure_target: sourceContent(question, 'measure_target'),
        evidence_source: sourceContent(question, 'evidence_source'),
        review_status: question.review_status || 'ready',
        review_note: question.review_note || '',
        question_code: question.question_code || '',
        question_label: sourceContent(question, 'question_label'),
        anchor_low_value: question.anchor_low_value ?? 1,
        anchor_low_text: sourceContent(question, 'anchor_low_text'),
        anchor_mid_value: question.anchor_mid_value ?? 3,
        anchor_mid_text: sourceContent(question, 'anchor_mid_text'),
        anchor_high_value: question.anchor_high_value ?? 5,
        anchor_high_text: sourceContent(question, 'anchor_high_text'),
        profile_ids: question.profile_ids || [],
        sort_order: Number(question.sort_order || 0),
        weight_percent: question.weight_percent ?? '',
        is_active: Number(question.is_active ?? 1),
      }))
      : [{
        rowKey: `existing-${initialQuestion.id}`,
        id: initialQuestion.id || '',
        question_text: sourceContent(initialQuestion, 'question_text'),
        objective_code: initialQuestion.objective_code || '',
        measure_target: sourceContent(initialQuestion, 'measure_target'),
        evidence_source: sourceContent(initialQuestion, 'evidence_source'),
        review_status: initialQuestion.review_status || 'ready',
        review_note: initialQuestion.review_note || '',
        question_code: initialQuestion.question_code || '',
        question_label: sourceContent(initialQuestion, 'question_label'),
        anchor_low_value: initialQuestion.anchor_low_value ?? 1,
        anchor_low_text: sourceContent(initialQuestion, 'anchor_low_text'),
        anchor_mid_value: initialQuestion.anchor_mid_value ?? 3,
        anchor_mid_text: sourceContent(initialQuestion, 'anchor_mid_text'),
        anchor_high_value: initialQuestion.anchor_high_value ?? 5,
        anchor_high_text: sourceContent(initialQuestion, 'anchor_high_text'),
        profile_ids: initialQuestion.profile_ids || [],
        sort_order: Number(initialQuestion.sort_order || 0),
        weight_percent: initialQuestion.weight_percent ?? '',
        is_active: Number(initialQuestion.is_active ?? 1),
      }];

    const firstStatus = groupedRows[0]?.is_active ?? 1;

    setForm({
      company_id: initialQuestion.company_id || '',
      cycle_id: initialQuestion.cycle_id || '',
      section_id: initialQuestion.section_id || '',
      department: initialQuestion.department || '',
      is_active: Number(firstStatus),
      scope: isKpi ? nextScope : 'department',
      supervisor_id: initialQuestion.supervisor_id || '',
      staff_user_id: initialQuestion.staff_user_id || '',
    });

    setRows(groupedRows.length ? groupedRows : [emptyQuestionRow()]);
    setRemovedRows([]);
    setDeleteRowTarget(null);
    setSubmitted(false);
    setWeightingDirty(false);

    const hasConfiguredWeights = isGroupedKpiEdit
      ? ['custom', 'mixed'].includes(initialQuestion.weight_mode) || groupedRows.some((row) => row.weight_percent !== null && row.weight_percent !== undefined && row.weight_percent !== '')
      : initialQuestion.weight_percent !== null && initialQuestion.weight_percent !== undefined && initialQuestion.weight_percent !== '';

    setWeightingEnabled(Boolean(hasConfiguredWeights));
  }, [initialQuestion, isKpi, isGroupedEdit, isGroupedKpiEdit]);

  useEffect(() => {
    if (isSupervisor && isKpi && !isEdit) {
      setForm((prev) => ({
        ...prev,
        scope: 'supervisor',
        supervisor_id: user?.id || '',
      }));
    }
  }, [isSupervisor, isKpi, isEdit, user?.id]);

  useEffect(() => {
    setLoadingLookups(true);

    Promise.allSettled([
      fetchCycles(),
      fetchDepartments(),
      isAdminLike
        ? api.get('/supervisors/list?limit=500&page=1&is_active=1&sortBy=first_name&sortOrder=ASC')
        : Promise.resolve({ data: { data: [] } }),
      isAdminLike
        ? api.get('/users/list?limit=500&page=1&role=staff&sortBy=first_name&sortOrder=ASC')
        : api.get('/supervisors/subordinates?limit=500&page=1'),
    ])
      .then(([, , supervisorRes, staffRes]) => {
        setSupervisors(supervisorRes.status === 'fulfilled' ? supervisorRes.value.data?.data || [] : []);
        setStaff(staffRes.status === 'fulfilled' ? staffRes.value.data?.data || [] : []);
      })
      .finally(() => setLoadingLookups(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLike]);

  useEffect(() => {
    fetchSections(form.cycle_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cycle_id, type]);

  useEffect(() => {
    if (isKpi || !form.cycle_id || !isAdminLike) {
      setScoringProfiles([]);
      return;
    }
    let mounted = true;
    api.get(`/cycles/scoring-config?cycle_id=${form.cycle_id}`)
      .then((response) => {
        if (!mounted) return;
        setScoringProfiles((response.data?.data?.profiles || []).filter((profile) => Number(profile.is_active ?? 1) === 1));
      })
      .catch(() => mounted && setScoringProfiles([]));
    return () => { mounted = false; };
  }, [form.cycle_id, isAdminLike, isKpi]);

  useEffect(() => {
    const selectedSection = sections.find((section) => String(section.id) === String(form.section_id));
    if (!selectedSection) return;

    setForm((prev) => ({
      ...prev,
      company_id: selectedSection.company_id || prev.company_id,
    }));
  }, [sections, form.section_id]);

  const cycleOptions = useMemo(() => cycles.map((cycle) => ({
    value: cycle.id,
    label: `${cycle.title} (${cycle.year})`,
    description: cycle.company_name || cycle.company_code,
  })), [cycles]);

  const sectionOptions = useMemo(() => {
    if (!form.cycle_id) return [];
    return sections.map((section) => ({
      value: section.id,
      label: `${section.code} — ${section.label}`,
      description: qf('form_section_option_description', { weight: formatNumber(section.weight, { maximumFractionDigits: 2 }, locale), year: section.cycle_year }),
    }));
  }, [sections, form.cycle_id, locale]);

  const scoringProfileOptions = useMemo(() => scoringProfiles.map((profile) => ({
    value: String(profile.id),
    label: profile.label,
    description: profile.description || profile.code,
  })), [scoringProfiles]);

  const departmentOptions = useMemo(() => {
    const fromDepartments = departments.map((department) => ({
      value: department.name || department.department || department.title,
      label: department.name_display || department.department_display || department.name || department.department || department.title,
      description: department.code || department.company_code || '',
    })).filter((option) => option.value);

    const fallbackValues = new Set();

    staff.forEach((member) => {
      if (member.department) fallbackValues.add(member.department);
    });

    if (initialQuestion?.department) fallbackValues.add(initialQuestion.department);

    const fallbackOptions = [...fallbackValues].map((department) => ({
      value: department,
      label: department,
    }));

    const merged = [...fromDepartments, ...fallbackOptions];
    const map = new Map();

    merged.forEach((option) => {
      if (!map.has(option.value)) map.set(option.value, option);
    });

    return [...map.values()].sort((a, b) => compareLocalized(a.label, b.label, locale));
  }, [departments, staff, initialQuestion?.department, locale]);

  const supervisorOptions = useMemo(() => supervisors.map((supervisor) => ({
    value: supervisor.id,
    label: `${supervisor.first_name || ''} ${supervisor.last_name || ''}`.trim() || supervisor.email,
    description: supervisor.department || supervisor.email,
  })), [supervisors]);

  const staffOptions = useMemo(() => staff.map((member) => ({
    value: member.id,
    label: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email,
    description: `${member.department || qf('form_no_department')} • ${member.job_title_display || member.job_title || qf('staff')}`,
    meta: member.email,
    department: member.department,
  })), [staff, locale]);

  const selectedStaff = useMemo(
    () => staff.find((member) => String(member.id) === String(form.staff_user_id)),
    [staff, form.staff_user_id]
  );

  const weightTotal = useMemo(() => rows
    .filter((row) => text(row.question_text) && (!isGroupedKpiEdit || Number(row.is_active ?? 1) === 1))
    .reduce((total, row) => total + (parseLocalizedNumber(row.weight_percent) ?? 0), 0), [rows, isGroupedKpiEdit]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateRow = (index, field, value) => {
    if (field === 'weight_percent' && isGroupedKpiEdit) setWeightingDirty(true);

    setRows((prev) => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
  };

  const addRow = () => {
    setRows((prev) => {
      const nextOrder = prev.length
        ? Math.max(...prev.map((row) => Number(row.sort_order || 0))) + 1
        : 1;
      return [...prev, {
        ...emptyQuestionRow(),
        sort_order: nextOrder,
        is_active: isGroupedEdit ? 1 : Number(form.is_active ?? 1),
      }];
    });

    if (isGroupedKpiEdit && weightingEnabled) setWeightingDirty(true);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;

    const row = rows[index];
    if (isGroupedEdit && row?.id) {
      if (!isAdminLike) {
        showToast(qf('form_only_admin_delete_period'), 'error');
        return;
      }

      setDeleteRowTarget({ row, index });
      return;
    }

    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    if (isGroupedKpiEdit && weightingEnabled) setWeightingDirty(true);
  };

  const confirmRemoveRow = () => {
    if (!deleteRowTarget?.row?.id) return;

    const target = deleteRowTarget;
    setRows((prev) => prev.filter((row) => row.rowKey !== target.row.rowKey));
    setRemovedRows((prev) => (
      prev.some((item) => Number(item.row.id) === Number(target.row.id))
        ? prev
        : [...prev, target]
    ));
    setDeleteRowTarget(null);
    if (weightingEnabled) setWeightingDirty(true);
  };

  const restoreRemovedRows = () => {
    if (!removedRows.length) return;

    setRows((prev) => [...prev, ...removedRows.map((item) => item.row)]
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0)));
    setRemovedRows([]);
    if (weightingEnabled) setWeightingDirty(true);
  };

  const toggleRowStatus = (index) => {
    setRows((prev) => prev.map((row, rowIndex) => (
      rowIndex === index
        ? { ...row, is_active: Number(row.is_active ?? 1) === 1 ? 0 : 1 }
        : row
    )));

    if (weightingEnabled) setWeightingDirty(true);
  };

  const toggleWeighting = () => {
    setWeightingEnabled((current) => !current);
    if (isGroupedKpiEdit) setWeightingDirty(true);
  };

  const validate = () => {
    const nextErrors = { rows: [] };

    if (!form.cycle_id) nextErrors.cycle_id = qf('form_select_cycle_error');
    if (!form.section_id) nextErrors.section_id = qf(isKpi ? 'form_select_kpi_section_error' : 'form_select_general_section_error');

    if (isKpi) {
      if (!text(form.department)) nextErrors.department = qf('form_department_required');
      if (!form.scope) nextErrors.scope = qf('form_scope_required');

      if (form.scope === 'supervisor' && !isSupervisor && !form.supervisor_id) {
        nextErrors.supervisor_id = qf('form_supervisor_required');
      }

      if (form.scope === 'individual' && !form.staff_user_id) {
        nextErrors.staff_user_id = qf('form_staff_required');
      }
    }

    const validRows = rows.filter((row) => text(row.question_text));
    const shouldValidateWeights = isKpi && isAdminLike && weightingEnabled && (!isEdit || weightingDirty);

    if (!validRows.length) {
      nextErrors.rows[0] = {
        ...(nextErrors.rows[0] || {}),
        question_text: qf('form_question_required_one'),
      };
    }

    rows.forEach((row, index) => {
      const rowErrors = {};
      const rowIsActive = !isGroupedEdit || Number(row.is_active ?? 1) === 1;

      if (!text(row.question_text)) rowErrors.question_text = qf('form_question_text_required');
      if (shouldValidateWeights && rowIsActive && text(row.question_text)) {
        if (row.weight_percent === '' || row.weight_percent === null || row.weight_percent === undefined) {
          rowErrors.weight_percent = qf('form_weight_required');
        } else if (parseLocalizedNumber(row.weight_percent) === null || parseLocalizedNumber(row.weight_percent) <= 0 || parseLocalizedNumber(row.weight_percent) > 100) {
          rowErrors.weight_percent = qf('form_weight_invalid');
        }
      }
      if (row.sort_order !== '' && Number(row.sort_order) < 0) rowErrors.sort_order = qf('form_sort_order_negative');

      if (Object.keys(rowErrors).length) nextErrors.rows[index] = rowErrors;
    });

    if (!nextErrors.rows.some(Boolean)) delete nextErrors.rows;

    const activeWeightedRows = validRows.filter((row) => !isGroupedKpiEdit || Number(row.is_active ?? 1) === 1);
    if (shouldValidateWeights && activeWeightedRows.length && Math.abs(weightTotal - 100) > 0.01) {
      nextErrors.weight_total = qf('form_weight_must_total', { total: formatNumber(weightTotal, { maximumFractionDigits: 2 }, locale) });
    }

    return nextErrors;
  };

  const errors = submitted ? validate() : {};
  const rowErrors = errors.rows || [];

  const buildSharedPayload = () => {
    const payload = {
      section_id: Number(form.section_id),
      is_active: Number(form.is_active),
      questions: rows
        .filter((row) => text(row.question_text))
        .map((row) => {
          let weightPercent = null;

          if (isKpi) {
            if (isAdminLike) {
              if (isGroupedKpiEdit && weightingDirty) {
                weightPercent = weightingEnabled && Number(row.is_active ?? 1) === 1
                  ? parseLocalizedNumber(row.weight_percent)
                  : null;
              } else if (isEdit) {
                weightPercent = row.weight_percent === '' || row.weight_percent === null || row.weight_percent === undefined
                  ? null
                  : parseLocalizedNumber(row.weight_percent);
              } else {
                weightPercent = weightingEnabled ? parseLocalizedNumber(row.weight_percent) : null;
              }
            } else {
              weightPercent = row.weight_percent === '' || row.weight_percent === null || row.weight_percent === undefined
                ? null
                : parseLocalizedNumber(row.weight_percent);
            }
          }

          return {
            ...(row.id ? { id: Number(row.id) } : {}),
            question_text: text(row.question_text),
            ...(isKpi ? {
              objective_code: text(row.objective_code) || null,
              measure_target: text(row.measure_target) || null,
              evidence_source: text(row.evidence_source) || null,
              review_status: row.review_status || 'ready',
              review_note: text(row.review_note) || null,
              weight_percent: weightPercent,
            } : {
              question_code: text(row.question_code) || null,
              question_label: text(row.question_label) || null,
              anchor_low_value: row.anchor_low_value === '' ? null : parseLocalizedNumber(row.anchor_low_value),
              anchor_low_text: text(row.anchor_low_text) || null,
              anchor_mid_value: row.anchor_mid_value === '' ? null : parseLocalizedNumber(row.anchor_mid_value),
              anchor_mid_text: text(row.anchor_mid_text) || null,
              anchor_high_value: row.anchor_high_value === '' ? null : parseLocalizedNumber(row.anchor_high_value),
              anchor_high_text: text(row.anchor_high_text) || null,
              profile_ids: (row.profile_ids || []).map(Number).filter(Boolean),
            }),
            ...(isGroupedEdit ? { is_active: Number(row.is_active ?? 1) } : {}),
            sort_order: Number(row.sort_order || 0),
          };
        }),
    };

    if (form.company_id) payload.company_id = Number(form.company_id);

    if (isKpi) {
      payload.department = text(form.department);
      payload.supervisor_id = null;
      payload.staff_user_id = null;

      if (form.scope === 'supervisor') {
        payload.supervisor_id = isSupervisor ? Number(user.id) : Number(form.supervisor_id);
      }

      if (form.scope === 'individual') {
        payload.staff_user_id = Number(form.staff_user_id);
      }

      if (isGroupedKpiEdit) {
        payload.group_anchor_id = Number(initialQuestion.group_id || initialQuestion.id);
        payload.delete_ids = removedRows.map((item) => Number(item.row.id)).filter(Boolean);

        if (isAdminLike && weightingDirty) {
          payload.weight_mode = weightingEnabled ? 'custom' : 'equal';
        }
      }
    } else if (isGroupedEdit) {
      payload.group_anchor_id = Number(initialQuestion.group_id || initialQuestion.id);
      payload.delete_ids = removedRows.map((item) => Number(item.row.id)).filter(Boolean);
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitted(true);
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, qf('form_correct_fields'));
      return;
    }

    const payload = buildSharedPayload();

    const result = isKpi
      ? isEdit
        ? await kpiStore.bulkUpdateKpiQuestions(payload)
        : await kpiStore.bulkCreateKpiQuestions(payload)
      : isEdit
        ? await generalStore.bulkUpdateGeneralQuestions(payload)
        : await generalStore.bulkCreateGeneralQuestions(payload);

    if (result.success) navigate(basePath(type));
  };

  const openCycleModal = () => {
    setQuickErrors({});
    setQuickCycle(emptyCycleForm);
    setQuickModal('cycle');
  };

  const openSectionModal = () => {
    setQuickErrors({});
    setQuickSection({
      ...emptySectionForm,
      cycle_id: form.cycle_id || '',
    });
    setQuickModal('section');
  };

  const openDepartmentModal = () => {
    setQuickErrors({});
    setQuickDepartment({
      ...emptyDepartmentForm,
      name: form.department || '',
      code: makeCode(form.department || ''),
    });
    setQuickModal('department');
  };

  const closeQuickModal = () => {
    if (quickSaving) return;
    setQuickModal(null);
    setQuickErrors({});
  };

  const validateQuickCycle = () => {
    const nextErrors = {};
    if (!text(quickCycle.title)) nextErrors.title = qf('form_cycle_title_required');
    if (!quickCycle.year) nextErrors.year = qf('form_cycle_year_required');

    if (quickCycle.start_date && quickCycle.end_date && quickCycle.end_date < quickCycle.start_date) {
      nextErrors.end_date = qf('form_end_before_start');
    }

    return nextErrors;
  };

  const validateQuickSection = () => {
    const nextErrors = {};
    if (!quickSection.cycle_id) nextErrors.cycle_id = qf('form_select_cycle_error');
    if (!text(quickSection.code)) nextErrors.code = qf('form_section_code_required');
    if (!text(quickSection.label)) nextErrors.label = qf('form_section_label_required');
    if (quickSection.weight === '' || parseLocalizedNumber(quickSection.weight) === null || parseLocalizedNumber(quickSection.weight) <= 0) {
      nextErrors.weight = qf('form_section_weight_required');
    }
    return nextErrors;
  };

  const validateQuickDepartment = () => {
    const nextErrors = {};
    if (!text(quickDepartment.name)) nextErrors.name = qf('form_department_name_required');
    return nextErrors;
  };

  const handleCreateCycle = async () => {
    const nextErrors = validateQuickCycle();
    setQuickErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setQuickSaving(true);

    try {
      const payload = {
        title: text(quickCycle.title),
        year: Number(quickCycle.year),
        start_date: quickCycle.start_date || null,
        end_date: quickCycle.end_date || null,
        is_active: Number(quickCycle.is_active),
      };

      const companyId = getCompanyId(user, form);
      if (companyId) payload.company_id = Number(companyId);

      const response = await api.post('/cycles/create', payload);
      const created = extractPayloadData(response);
      const nextCycles = await fetchCycles();

      const selectedCycle = created?.id
        ? nextCycles.find((cycle) => String(cycle.id) === String(created.id)) || created
        : nextCycles.find((cycle) =>
          String(cycle.year) === String(payload.year) &&
          String(cycle.title).toLowerCase() === String(payload.title).toLowerCase());

      if (selectedCycle?.id) {
        setForm((prev) => ({
          ...prev,
          cycle_id: selectedCycle.id,
          section_id: '',
          company_id: selectedCycle.company_id || prev.company_id,
        }));
      }

      showToast(i18n.language === 'fr' ? qf('form_cycle_created') : (response.data?.message || qf('form_cycle_created')), 'success');
      setQuickModal(null);
      setQuickErrors({});
    } catch (error) {
      const message = error.response?.data?.message || error.message || qf('form_cycle_create_failed');
      showToast(message, 'error');
    } finally {
      setQuickSaving(false);
    }
  };

  const handleCreateSection = async () => {
    const nextErrors = validateQuickSection();
    setQuickErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setQuickSaving(true);

    try {
      const payload = {
        cycle_id: Number(quickSection.cycle_id),
        code: text(quickSection.code).toUpperCase(),
        label: text(quickSection.label),
        type: sectionType(type),
        weight: parseLocalizedNumber(quickSection.weight),
        sort_order: Number(quickSection.sort_order || 0),
        is_active: Number(quickSection.is_active),
      };

      const response = await api.post('/sections/create', payload);
      const created = extractPayloadData(response);
      const nextSections = await fetchSections(payload.cycle_id);

      const selectedSection = created?.id
        ? nextSections.find((section) => String(section.id) === String(created.id)) || created
        : nextSections.find((section) =>
          String(section.code).toLowerCase() === String(payload.code).toLowerCase() &&
          String(section.label).toLowerCase() === String(payload.label).toLowerCase());

      setForm((prev) => ({
        ...prev,
        cycle_id: payload.cycle_id,
        section_id: selectedSection?.id || prev.section_id,
        company_id: selectedSection?.company_id || prev.company_id,
      }));

      showToast(i18n.language === 'fr' ? qf('form_section_created') : (response.data?.message || qf('form_section_created')), 'success');
      setQuickModal(null);
      setQuickErrors({});
    } catch (error) {
      const message = error.response?.data?.message || error.message || qf('form_section_create_failed');
      showToast(message, 'error');
    } finally {
      setQuickSaving(false);
    }
  };

  const handleCreateDepartment = async () => {
    const nextErrors = validateQuickDepartment();
    setQuickErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setQuickSaving(true);

    try {
      const payload = {
        name: text(quickDepartment.name),
        code: text(quickDepartment.code) || makeCode(quickDepartment.name),
        description: text(quickDepartment.description),
        is_active: Number(quickDepartment.is_active),
      };

      const companyId = getCompanyId(user, form);
      if (companyId) payload.company_id = Number(companyId);

      const response = await api.post('/departments/create', payload);
      const created = extractPayloadData(response);
      await fetchDepartments();

      setForm((prev) => ({
        ...prev,
        department: created?.name || payload.name,
      }));

      showToast(i18n.language === 'fr' ? qf('form_department_created') : (response.data?.message || qf('form_department_created')), 'success');
      setQuickModal(null);
      setQuickErrors({});
    } catch (error) {
      const message = error.response?.data?.message || error.message || qf('form_department_create_failed');
      showToast(message, 'error');
    } finally {
      setQuickSaving(false);
    }
  };

  const scopeOptions = scopeOptionsFor(isSupervisor);
  const pageTitle = qf(isGroupedEdit ? (isKpi ? 'form_edit_kpi_set' : 'form_edit_general_set') : isEdit ? (isKpi ? 'form_edit_kpi' : 'form_edit_general') : (isKpi ? 'form_create_kpi' : 'form_create_general'));

  return (
    <>
      <motion.form
        ref={formRef}
        className="qst-form-card"
        onSubmit={handleSubmit}
        noValidate
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="qst-form-head">
          <div>
            <span className="qst-eyebrow">{qf(isEdit ? 'form_update_question_bank' : 'form_new_questions')}</span>
            <h2>{pageTitle}</h2>
            <p>
              {qf(isEdit ? 'form_edit_intro' : 'form_create_intro')}
            </p>
          </div>
          <div className="asg-head-actions">
            {(isKpi || isAdminLike) && <button type="button" className="asg-launch" onClick={() => setAiGuideOpen(true)}><Sparkles size={15}/> {qf('form_ai_question_guide')}</button>}
            <div className="qst-form-pill"><AppIcon icon={isKpi ? 'TrendingUp' : 'ClipboardList'} />
              <span>{qf(isGroupedEdit ? (isKpi ? 'kpi_question_set' : 'general_question_set') : (isKpi ? 'form_kpi_question' : 'form_general_question'))}</span></div>
          </div>
        </div>

        <div className="qst-form-section">
          <div className="qst-section-title">
            <AppIcon icon="CalendarCheck" />
            <span>{qf('form_appraisal_assignment')}</span>
          </div>

          <div className="qst-form-grid">
            <div className="qst-field-with-action">
              <div className="qst-field-with-action__control">
                <AppSelect
                  label={qf('form_appraisal_cycle')}
                  value={form.cycle_id}
                  onChange={(value) => setForm((prev) => ({
                    ...prev,
                    cycle_id: value,
                    section_id: '',
                  }))}
                  options={cycleOptions}
                  placeholder={qf(loadingLookups ? 'form_loading_cycles' : 'form_select_cycle')}
                  searchable
                  clearable={false}
                  error={errors.cycle_id}
                />
              </div>

              <button type="button" className="qst-add-mini-btn" onClick={openCycleModal} title={qf('form_create_cycle')}>
                <AppIcon icon="Plus" />
              </button>
            </div>

            <div className="qst-field-with-action">
              <div className="qst-field-with-action__control">
                <AppSelect
                  label={qf('section')}
                  value={form.section_id}
                  onChange={(value) => updateField('section_id', value)}
                  options={sectionOptions}
                  placeholder={qf(form.cycle_id ? 'form_select_section' : 'form_select_cycle_first')}
                  searchable
                  clearable={false}
                  error={errors.section_id}
                  disabled={!form.cycle_id}
                />
              </div>

              <button type="button" className="qst-add-mini-btn" onClick={openSectionModal} title={qf('form_create_section')}>
                <AppIcon icon="Plus" />
              </button>
            </div>

            {isKpi && (
              <AppSelect
                label={qf('form_kpi_scope')}
                value={form.scope}
                onChange={(value) => setForm((prev) => ({
                  ...prev,
                  scope: value,
                  supervisor_id: value === 'supervisor' && isSupervisor ? user.id : '',
                  staff_user_id: '',
                }))}
                options={scopeOptions}
                searchable={false}
                clearable={false}
                error={errors.scope}
              />
            )}

            {isKpi && form.scope === 'supervisor' && !isSupervisor && (
              <AppSelect
                label={qf('supervisor')}
                value={form.supervisor_id}
                onChange={(value) => updateField('supervisor_id', value)}
                options={supervisorOptions}
                placeholder={qf('form_select_supervisor')}
                searchable
                clearable={false}
                error={errors.supervisor_id}
              />
            )}

            {isKpi && form.scope === 'individual' && (
              <AppSelect
                label={qf('form_staff_member')}
                value={form.staff_user_id}
                onChange={(value, option) => setForm((prev) => ({
                  ...prev,
                  staff_user_id: value,
                  department: option?.department || prev.department,
                }))}
                options={staffOptions}
                placeholder={qf('form_select_staff')}
                searchable
                clearable={false}
                error={errors.staff_user_id}
              />
            )}

            {isKpi && (
              <div className="qst-field-with-action">
                <div className="qst-field-with-action__control">
                  <AppSelect
                    label={qf('department')}
                    value={form.department}
                    onChange={(value) => updateField('department', value)}
                    options={departmentOptions}
                    placeholder={selectedStaff?.department || qf('form_select_department')}
                    searchable
                    clearable={false}
                    error={errors.department}
                  />
                </div>

                <button type="button" className="qst-add-mini-btn" onClick={openDepartmentModal} title={qf('form_create_department')}>
                  <AppIcon icon="Plus" />
                </button>
              </div>
            )}

            {!isGroupedEdit && (
              <AppSelect
                label={qf('status')}
                value={form.is_active}
                onChange={(value) => updateField('is_active', Number(value))}
                options={activeOptions()}
                searchable={false}
                clearable={false}
              />
            )}
          </div>
        </div>

        <div className="qst-form-section">
          <div className="qst-section-title">
            <AppIcon icon="ListChecks" />
            <span>{qf('form_questions')}</span>
          </div>

          {isKpi && isAdminLike && (!isEdit || isGroupedKpiEdit) && (
            <div className={`qst-weighting-panel ${weightingEnabled ? 'qst-weighting-panel--active' : ''}`}>
              <div className="qst-weighting-panel__copy">
                <span className="qst-weighting-panel__icon"><AppIcon icon="Scale" /></span>
                <div>
                  <strong>{qf('form_suggested_weights')}</strong>
                  <p>{qf('form_weights_hint')}</p>
                </div>
              </div>
              <button
                type="button"
                className={`qst-weight-toggle ${weightingEnabled ? 'qst-weight-toggle--active' : ''}`}
                onClick={toggleWeighting}
                aria-pressed={weightingEnabled}
              >
                <span />
                {qf(weightingEnabled ? 'form_custom_weights_on' : 'form_use_equal_defaults')}
              </button>
            </div>
          )}

          <QuestionRowsEditor
            rows={rows}
            errors={rowErrors}
            onChange={updateRow}
            onAdd={addRow}
            onRemove={removeRow}
            onToggleStatus={toggleRowStatus}
            isEdit={isEdit}
            showWeights={isKpi && isAdminLike && weightingEnabled}
            showStatus={isGroupedEdit}
            showObjectiveMetadata={isKpi}
            showAnchors={!isKpi}
            profileOptions={scoringProfileOptions}
            canDeleteExisting={isAdminLike}
            weightTotal={weightTotal}
            weightTotalError={errors.weight_total}
          />

          {isGroupedEdit && removedRows.length > 0 && (
            <div className="qst-pending-delete">
              <div>
                <AppIcon icon="Trash2" />
                <span>
                  {qf(isKpi ? 'form_kpi_pending_removals' : 'form_pending_deletions', { count: removedRows.length, formattedCount: formatNumber(removedRows.length, {}, locale) })}
                </span>
              </div>
              <button type="button" onClick={restoreRemovedRows}>
                <AppIcon icon="RotateCcw" /> {qf('form_undo_removals')}
              </button>
            </div>
          )}
        </div>

        <div className="qst-form-note">
          <AppIcon icon="Info" />
          {qf(isKpi ? 'form_kpi_note' : 'form_general_note')}
        </div>

        <div className="qst-form-actions">
          <Link className="qst-secondary-btn" to={basePath(type)}>
            {qf('form_cancel')}
          </Link>

          <button type="submit" className="qst-primary-btn" disabled={saving}>
            {saving ? (
              <>
                <span className="qst-spinner" /> {qf('form_saving')}
              </>
            ) : (
              <>
                {isEdit ? qf('form_save_changes') : qf('form_create_questions', { count: rows.filter((row) => text(row.question_text)).length || rows.length })}
                <AppIcon icon="ArrowRight" />
              </>
            )}
          </button>
        </div>
      </motion.form>

      <DeleteQuestionRowModal
        target={deleteRowTarget}
        questionType={isKpi ? 'KPI' : 'general'}
        onCancel={() => setDeleteRowTarget(null)}
        onConfirm={confirmRemoveRow}
      />

      <QuickCreateModal
        open={quickModal === 'cycle'}
        title={qf('form_create_appraisal_cycle')}
        subtitle={qf('form_quick_cycle_subtitle')}
        icon="CalendarCheck"
        saving={quickSaving}
        submitLabel={qf('form_create_cycle_button')}
        onClose={closeQuickModal}
        onSubmit={handleCreateCycle}
      >
        <div className="qst-quick-grid">
          <div className="qst-field">
            <label className={quickErrors.title ? 'qst-label--error' : ''}>{qf('form_title')}</label>
            <div className={quickErrors.title ? 'qst-input qst-input--error' : 'qst-input'}>
              <AppIcon icon="Heading" />
              <input
                type="text"
                name="quick_cycle_title"
                autoComplete="on"
                value={quickCycle.title}
                onChange={(event) => setQuickCycle((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={qf('form_annual_appraisal_example')}
              />
            </div>
            <ModalFieldError message={quickErrors.title} />
          </div>

          <div className="qst-field">
            <label className={quickErrors.year ? 'qst-label--error' : ''}>{qf('form_year')}</label>
            <div className={quickErrors.year ? 'qst-input qst-input--error' : 'qst-input'}>
              <AppIcon icon="CalendarDays" />
              <input
                type="number"
                name="quick_cycle_year"
                autoComplete="on"
                value={quickCycle.year}
                onChange={(event) => setQuickCycle((prev) => ({ ...prev, year: event.target.value }))}
                placeholder="2026"
              />
            </div>
            <ModalFieldError message={quickErrors.year} />
          </div>

          <AppDatePicker
            label={qf('form_start_date')}
            value={quickCycle.start_date}
            onChange={(value) => setQuickCycle((prev) => ({ ...prev, start_date: value }))}
            placeholder={qf('form_select_start_date')}
            error={quickErrors.start_date}
          />

          <AppDatePicker
            label={qf('form_end_date')}
            value={quickCycle.end_date}
            onChange={(value) => setQuickCycle((prev) => ({ ...prev, end_date: value }))}
            placeholder={qf('form_select_end_date')}
            minDate={quickCycle.start_date || undefined}
            error={quickErrors.end_date}
          />

          <AppSelect
            label={qf('status')}
            value={quickCycle.is_active}
            onChange={(value) => setQuickCycle((prev) => ({ ...prev, is_active: Number(value) }))}
            options={activeOptions()}
            searchable={false}
            clearable={false}
          />
        </div>
      </QuickCreateModal>

      <QuickCreateModal
        open={quickModal === 'section'}
        title={qf('form_create_section_heading')}
        subtitle={qf(isKpi ? 'form_quick_kpi_section_subtitle' : 'form_quick_general_section_subtitle')}
        icon="Layers"
        saving={quickSaving}
        submitLabel={qf('form_create_section_heading')}
        onClose={closeQuickModal}
        onSubmit={handleCreateSection}
      >
        <div className="qst-quick-grid">
          <AppSelect
            label={qf('form_appraisal_cycle')}
            value={quickSection.cycle_id}
            onChange={(value) => setQuickSection((prev) => ({ ...prev, cycle_id: value }))}
            options={cycleOptions}
            placeholder={qf('form_select_cycle')}
            searchable
            clearable={false}
            error={quickErrors.cycle_id}
          />

          <div className="qst-field">
            <label className={quickErrors.code ? 'qst-label--error' : ''}>{qf('form_section_code')}</label>
            <div className={quickErrors.code ? 'qst-input qst-input--error' : 'qst-input'}>
              <AppIcon icon="Code2" />
              <input
                type="text"
                name="quick_section_code"
                autoComplete="on"
                value={quickSection.code}
                onChange={(event) => setQuickSection((prev) => ({ ...prev, code: event.target.value }))}
                placeholder={isKpi ? 'A' : 'B'}
              />
            </div>
            <ModalFieldError message={quickErrors.code} />
          </div>

          <div className="qst-field">
            <label className={quickErrors.label ? 'qst-label--error' : ''}>{qf('form_section_label')}</label>
            <div className={quickErrors.label ? 'qst-input qst-input--error' : 'qst-input'}>
              <AppIcon icon="Tag" />
              <input
                type="text"
                name="quick_section_label"
                autoComplete="on"
                value={quickSection.label}
                onChange={(event) => setQuickSection((prev) => ({ ...prev, label: event.target.value }))}
                placeholder={qf(isKpi ? 'form_section_kpi_example' : 'form_section_general_example')}
              />
            </div>
            <ModalFieldError message={quickErrors.label} />
          </div>

          <div className="qst-field">
            <label className={quickErrors.weight ? 'qst-label--error' : ''}>{qf('form_weight_percent')}</label>
            <div className={quickErrors.weight ? 'qst-input qst-input--error' : 'qst-input'}>
              <AppIcon icon="Percent" />
              <input
                type="text"
                inputMode="decimal"
                name="quick_section_weight"
                autoComplete="on"
                value={quickSection.weight}
                onChange={(event) => setQuickSection((prev) => ({ ...prev, weight: event.target.value }))}
                placeholder="30"
              />
            </div>
            <ModalFieldError message={quickErrors.weight} />
          </div>

          <div className="qst-field">
            <label>{qf('form_sort_order')}</label>
            <div className="qst-input">
              <AppIcon icon="ArrowDownWideNarrow" />
              <input
                type="number"
                name="quick_section_sort_order"
                autoComplete="on"
                value={quickSection.sort_order}
                onChange={(event) => setQuickSection((prev) => ({ ...prev, sort_order: event.target.value }))}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <AppSelect
            label={qf('status')}
            value={quickSection.is_active}
            onChange={(value) => setQuickSection((prev) => ({ ...prev, is_active: Number(value) }))}
            options={activeOptions()}
            searchable={false}
            clearable={false}
          />
        </div>
      </QuickCreateModal>

      <QuickCreateModal
        open={quickModal === 'department'}
        title={qf('form_create_department_heading')}
        subtitle={qf('form_quick_department_subtitle')}
        icon="Building2"
        saving={quickSaving}
        submitLabel={qf('form_create_department_heading')}
        onClose={closeQuickModal}
        onSubmit={handleCreateDepartment}
      >
        <div className="qst-quick-grid">
          <div className="qst-field">
            <label className={quickErrors.name ? 'qst-label--error' : ''}>{qf('form_department_name')}</label>
            <div className={quickErrors.name ? 'qst-input qst-input--error' : 'qst-input'}>
              <AppIcon icon="Building2" />
              <input
                type="text"
                name="quick_department_name"
                autoComplete="on"
                value={quickDepartment.name}
                onChange={(event) => setQuickDepartment((prev) => ({
                  ...prev,
                  name: event.target.value,
                  code: prev.code || makeCode(event.target.value),
                }))}
                placeholder={qf('form_electrical_example')}
              />
            </div>
            <ModalFieldError message={quickErrors.name} />
          </div>

          <div className="qst-field">
            <label>{qf('form_department_code')}</label>
            <div className="qst-input">
              <AppIcon icon="Code2" />
              <input
                type="text"
                name="quick_department_code"
                autoComplete="on"
                value={quickDepartment.code}
                onChange={(event) => setQuickDepartment((prev) => ({ ...prev, code: event.target.value }))}
                placeholder={qf('form_department_code_example')}
              />
            </div>
          </div>

          <AppSelect
            label={qf('status')}
            value={quickDepartment.is_active}
            onChange={(value) => setQuickDepartment((prev) => ({ ...prev, is_active: Number(value) }))}
            options={activeOptions()}
            searchable={false}
            clearable={false}
          />
        </div>

        <div className="qst-field qst-quick-description">
          <label>{qf('form_description')}</label>
          <textarea
            className="qst-textarea"
            name="quick_department_description"
            autoComplete="on"
            value={quickDepartment.description}
            onChange={(event) => setQuickDepartment((prev) => ({ ...prev, description: event.target.value }))}
            placeholder={qf('form_department_description_placeholder')}
            rows={4}
          />
        </div>
      </QuickCreateModal>
      {aiGuideOpen && <AiSetupGuide context={isKpi ? 'kpi' : 'general'} onClose={() => setAiGuideOpen(false)}/>}
    </>
  );
};

export default QuestionForm;