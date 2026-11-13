import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatPercentage, parseLocalizedNumber } from '../../utils/format';
import { motion } from 'framer-motion';
import AppSelect from '../../components/ui/AppSelect';
import useAuthStore from '../../stores/useAuthStore';
import useToastStore from '../../stores/useToastStore';
import useSectionsStore from '../../stores/useSectionsStore';
import './Cycles.css';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import AppIcon from '../../components/ui/AppIcon';
import { Sparkles } from 'lucide-react';
import AiSetupGuide from '../../components/ai/AiSetupGuide';

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const TYPE_OPTIONS = [
  { value: 'kpi', labelKey: 'section_kpi', descriptionKey: 'section_kpi_description' },
  { value: 'general', labelKey: 'section_general', descriptionKey: 'section_general_description' },
];

const STATUS_OPTIONS = [
  { value: 1, labelKey: 'active' },
  { value: 0, labelKey: 'inactive' },
];

const RATING_MODE_OPTIONS = [
  { value: 'per_question', labelKey: 'section_per_question', descriptionKey: 'section_per_question_description' },
  { value: 'overall', labelKey: 'section_overall', descriptionKey: 'section_overall_description' },
];

const YES_NO_OPTIONS = [
  { value: 1, labelKey: 'section_yes' },
  { value: 0, labelKey: 'section_no' },
];

const emptySection = {
  code: '',
  label: '',
  description: '',
  type: 'general',
  weight: '',
  default_rating_mode: 'overall',
  lock_rating_mode: 0,
  sort_order: '',
  is_active: 1,
  objective_setup_enabled: 0,
  objective_min_objectives: 1,
  objective_max_objectives: '',
  objective_require_weights: 0,
  objective_required_weight_total: 100,
  objective_require_target: 0,
  objective_require_evidence: 0,
  objective_require_actual_result: 0,
  objective_allow_individual_objectives: 1,
  objective_require_locked_plan: 1,
  objective_lock_questions_during_appraisal: 1,
  objective_force_per_question_ratings: 1,
};

const text = (value) => (value ?? '').toString().trim();

const SectionModal = ({ cycle, section, totalWeight = 0, onClose, onSaved }) => {
  const { i18n: language } = useTranslation('cycles');
  const locale = language.language;
  const typeOptions = TYPE_OPTIONS.map(({ value, labelKey, descriptionKey }) => ({ value, label: cx(labelKey), description: cx(descriptionKey) }));
  const statusOptions = STATUS_OPTIONS.map(({ value, labelKey }) => ({ value, label: cx(labelKey) }));
  const ratingModeOptions = RATING_MODE_OPTIONS.map(({ value, labelKey, descriptionKey }) => ({ value, label: cx(labelKey), description: cx(descriptionKey) }));
  const yesNoOptions = YES_NO_OPTIONS.map(({ value, labelKey }) => ({ value, label: cx(labelKey) }));
  const isEdit = !!section;
  const { user: currentUser } = useAuthStore();
  const { showToast } = useToastStore();
  const { createSection, updateSection } = useSectionsStore();
  const formRef = useRef(null);

  const [form, setForm] = useState(emptySection);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiGuideOpen, setAiGuideOpen] = useState(false);

  useEffect(() => {
    if (!section) return;
    setForm({
      code: section.code || '',
      label: section.label_source ?? section.label ?? '',
      description: section.description_source ?? section.description ?? '',
      type: section.type || 'general',
      weight: section.weight ?? '',
      default_rating_mode: section.default_rating_mode || 'overall',
      lock_rating_mode: Number(section.lock_rating_mode ?? 0),
      sort_order: section.sort_order ?? '',
      is_active: Number(section.is_active ?? 1),
      objective_setup_enabled: Number(section.objective_setup_enabled ?? 0),
      objective_min_objectives: Number(section.objective_min_objectives ?? 1),
      objective_max_objectives: section.objective_max_objectives ?? '',
      objective_require_weights: Number(section.objective_require_weights ?? 0),
      objective_required_weight_total: Number(section.objective_required_weight_total ?? 100),
      objective_require_target: Number(section.objective_require_target ?? 0),
      objective_require_evidence: Number(section.objective_require_evidence ?? 0),
      objective_require_actual_result: Number(section.objective_require_actual_result ?? 0),
      objective_allow_individual_objectives: Number(section.objective_allow_individual_objectives ?? 1),
      objective_require_locked_plan: Number(section.objective_require_locked_plan ?? 1),
      objective_lock_questions_during_appraisal: Number(section.objective_lock_questions_during_appraisal ?? 1),
      objective_force_per_question_ratings: Number(section.objective_force_per_question_ratings ?? 1),
    });
  }, [section]);

  const remainingWeight = Math.max(0, 100 - Number(totalWeight || 0));
  const editAdjustedRemaining = isEdit
    ? Math.max(0, 100 - (Number(totalWeight || 0) - Number(section?.weight || 0)))
    : remainingWeight;

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const errors = {};
    const weight = parseLocalizedNumber(form.weight);

    if (!text(form.code)) errors.code = cx('section_code_required');
    if (!text(form.label)) errors.label = cx('section_label_required');
    if (!form.type) errors.type = cx('section_type_required');
    if (form.type === 'kpi' && Number(form.objective_setup_enabled) === 1) {
      const minObjectives = Number(form.objective_min_objectives);
      const maxObjectives = form.objective_max_objectives === '' ? null : Number(form.objective_max_objectives);
      const weightTotal = parseLocalizedNumber(form.objective_required_weight_total);
      if (!Number.isInteger(minObjectives) || minObjectives < 0) errors.objective_min_objectives = cx('section_min_objectives_error');
      if (maxObjectives !== null && (!Number.isInteger(maxObjectives) || maxObjectives < 1)) errors.objective_max_objectives = cx('section_max_objectives_error');
      if (maxObjectives !== null && maxObjectives < minObjectives) errors.objective_max_objectives = cx('section_max_below_min');
      if (Number(form.objective_require_weights) === 1 && (!(weightTotal > 0) || weightTotal > 100)) errors.objective_required_weight_total = cx('section_weight_total_error');
    }
    if (!weight) errors.weight = cx('section_weight_required');
    else if (weight <= 0 || weight > 100) errors.weight = cx('section_weight_range');
    else if (weight > editAdjustedRemaining) errors.weight = cx('section_available_weight', { weight: formatPercentage(editAdjustedRemaining / 100, 2, locale) });

    return errors;
  };

  const errors = submitted ? validate() : {};

  const cleanPayload = () => {
    const payload = {
      cycle_id: Number(cycle.id),
      code: text(form.code).toUpperCase(),
      label: text(form.label),
      description: text(form.description) || undefined,
      weight: parseLocalizedNumber(form.weight),
      default_rating_mode: form.default_rating_mode || 'overall',
      lock_rating_mode: Number(form.lock_rating_mode || 0),
      sort_order: Number(form.sort_order || 0),
      is_active: Number(form.is_active),
    };

    if (currentUser?.role === 'super_admin' && cycle.company_id) payload.company_id = Number(cycle.company_id);

    if (form.type === 'kpi') {
      payload.objective_setup_config = {
        enabled: Number(form.objective_setup_enabled),
        min_objectives: Number(form.objective_min_objectives || 0),
        max_objectives: form.objective_max_objectives === '' ? null : Number(form.objective_max_objectives),
        require_weights: Number(form.objective_require_weights),
        required_weight_total: parseLocalizedNumber(form.objective_required_weight_total) ?? 100,
        require_target: Number(form.objective_require_target),
        require_evidence: Number(form.objective_require_evidence),
        require_actual_result: Number(form.objective_require_actual_result),
        allow_individual_objectives: Number(form.objective_allow_individual_objectives),
        require_locked_plan: Number(form.objective_require_locked_plan),
        lock_questions_during_appraisal: Number(form.objective_lock_questions_during_appraisal),
        force_per_question_ratings: Number(form.objective_force_per_question_ratings),
      };
    }

    if (isEdit) {
      payload.id = Number(section.id);
    } else {
      payload.type = form.type;
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, cx('section_correct_fields'));
      return;
    }

    setSaving(true);
    const result = isEdit ? await updateSection(cleanPayload()) : await createSection(cleanPayload());
    setSaving(false);

    if (result.success) onSaved?.();
  };

  return (
    <>
    <motion.div
      className="cyc-modal-backdrop"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <motion.form
        ref={formRef}
        className="cyc-modal cyc-section-modal"
        onSubmit={handleSubmit}
        noValidate
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
      >
        <div className="cyc-modal-head">
          <div>
            <p className="cyc-eyebrow">{isEdit ? cx('section_edit') : cx('section_new')}</p>
            <h3>{isEdit ? cx('section_update_heading', { code: section.code }) : cx('section_create_heading')}</h3>
            <p>{cycle.title} • {cycle.year}</p>
          </div>
          <div className="asg-head-actions"><button type="button" className="asg-launch" onClick={() => setAiGuideOpen(true)}><Sparkles size={15}/> {cx('ai_setup')}</button>
          <button type="button" className="cyc-icon-btn" onClick={onClose} aria-label={cx('view_close')}><AppIcon icon="X" /></button></div>
        </div>

        <div className="cyc-modal-body">
          <div className="cyc-weight-info">
          <span><AppIcon icon="Scale" /></span>
          <div>
            <strong>{cx('section_used_weight', { weight: formatPercentage(Number(totalWeight || 0) / 100, 2, locale) })}</strong>
            <small>{cx(isEdit ? 'section_available_edit' : 'section_available_new', { weight: formatPercentage(editAdjustedRemaining / 100, 2, locale) })}</small>
          </div>
        </div>

        <div className="cyc-form-grid cyc-form-grid--modal">
          <div className="cyc-field" data-invalid={errors.code ? 'true' : undefined}>
            <label>{cx('section_code')}</label>
            <div className={`cyc-input ${errors.code ? 'cyc-input--error' : ''}`}>
              <AppIcon icon="Hash" />
              <input
                type="text"
                name="section_code"
                autoComplete="on"
                value={form.code}
                onChange={(event) => updateField('code', event.target.value.toUpperCase())}
                placeholder={cx('section_placeholder_code')}
                maxLength="10"
              />
            </div>
            {errors.code && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.code}</p>}
          </div>

          <AppSelect
            label={cx('section_type')}
            value={form.type}
            onChange={(value) => updateField('type', value)}
            options={typeOptions}
            placeholder={cx('section_placeholder_type')}
            searchable={false}
            clearable={false}
            disabled={isEdit}
            error={errors.type}
          />

          <div className="cyc-field cyc-field--wide" data-invalid={errors.label ? 'true' : undefined}>
            <label>{cx('section_label')}</label>
            <div className={`cyc-input ${errors.label ? 'cyc-input--error' : ''}`}>
              <AppIcon icon="Heading" />
              <input
                type="text"
                name="section_label"
                autoComplete="on"
                value={form.label}
                onChange={(event) => updateField('label', event.target.value)}
                placeholder={cx('section_placeholder_label')}
              />
            </div>
            {errors.label && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.label}</p>}
          </div>

          <div className="cyc-field cyc-field--wide">
            <label>{cx('section_description')}</label>
            <div className="cyc-input cyc-input--textarea">
              <AppIcon icon="AlignLeft" />
              <textarea
                name="section_description"
                autoComplete="on"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder={cx('section_placeholder_description')}
                rows="3"
              />
            </div>
          </div>

          <div className="cyc-field" data-invalid={errors.weight ? 'true' : undefined}>
            <label>{cx('section_weight')}</label>
            <div className={`cyc-input ${errors.weight ? 'cyc-input--error' : ''}`}>
              <AppIcon icon="Percent" />
              <input
                type="text"
                inputMode="decimal"
                name="section_weight"
                autoComplete="on"
                min="0.01"
                max="100"
                step="0.01"
                value={form.weight}
                onChange={(event) => updateField('weight', event.target.value)}
                placeholder="30"
              />
            </div>
            {errors.weight && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.weight}</p>}
          </div>

          <div className="cyc-field">
            <label>{cx('section_sort_order')}</label>
            <div className="cyc-input">
              <AppIcon icon="ArrowDownWideNarrow" />
              <input
                type="number"
                name="section_sort_order"
                autoComplete="on"
                min="0"
                value={form.sort_order}
                onChange={(event) => updateField('sort_order', event.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="cyc-rating-mode-config cyc-field--wide">
            <div className="cyc-objective-config__head">
              <div>
                <span className="cyc-eyebrow">{cx('section_scoring_behaviour')}</span>
                <h4>{cx('section_rating_mode')}</h4>
                <p>{cx('section_rating_instructions')}</p>
              </div>
            </div>
            <div className="cyc-form-grid cyc-form-grid--modal cyc-objective-config__grid">
              <AppSelect label={cx('section_default_rating')} value={form.default_rating_mode} onChange={(value) => updateField('default_rating_mode', value)} options={ratingModeOptions} searchable={false} clearable={false} />
              <AppSelect label={cx('section_lock_rating')} value={form.lock_rating_mode} onChange={(value) => updateField('lock_rating_mode', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
            </div>
          </div>

          {form.type === 'kpi' && (
            <div className="cyc-objective-config cyc-field--wide">
              <div className="cyc-objective-config__head">
                <div>
                  <span className="cyc-eyebrow">{cx('section_per_staff')}</span>
                  <h4>{cx('section_objective_rules')}</h4>
                  <p>{cx('section_objective_hint')}</p>
                </div>
                <AppSelect
                  label={cx('section_enable_setup')}
                  value={form.objective_setup_enabled}
                  onChange={(value) => updateField('objective_setup_enabled', Number(value))}
                  options={yesNoOptions}
                  searchable={false}
                  clearable={false}
                />
              </div>

              {Number(form.objective_setup_enabled) === 1 && (
                <div className="cyc-form-grid cyc-form-grid--modal cyc-objective-config__grid">
                  <div className="cyc-field" data-invalid={errors.objective_min_objectives ? 'true' : undefined}>
                    <label>{cx('section_min_objectives')}</label>
                    <div className={`cyc-input ${errors.objective_min_objectives ? 'cyc-input--error' : ''}`}>
                      <AppIcon icon="ListChecks" />
                      <input type="number" min="0" step="1" value={form.objective_min_objectives} onChange={(event) => updateField('objective_min_objectives', event.target.value)} />
                    </div>
                    {errors.objective_min_objectives && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.objective_min_objectives}</p>}
                  </div>

                  <div className="cyc-field" data-invalid={errors.objective_max_objectives ? 'true' : undefined}>
                    <label>{cx('section_max_objectives')}</label>
                    <div className={`cyc-input ${errors.objective_max_objectives ? 'cyc-input--error' : ''}`}>
                      <AppIcon icon="ListOrdered" />
                      <input type="number" min="1" step="1" value={form.objective_max_objectives} onChange={(event) => updateField('objective_max_objectives', event.target.value)} placeholder={cx('section_no_limit')} />
                    </div>
                    {errors.objective_max_objectives && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.objective_max_objectives}</p>}
                  </div>

                  <AppSelect label={cx('section_require_weights')} value={form.objective_require_weights} onChange={(value) => updateField('objective_require_weights', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />

                  {Number(form.objective_require_weights) === 1 && (
                    <div className="cyc-field" data-invalid={errors.objective_required_weight_total ? 'true' : undefined}>
                      <label>{cx('section_required_total')}</label>
                      <div className={`cyc-input ${errors.objective_required_weight_total ? 'cyc-input--error' : ''}`}>
                        <AppIcon icon="Percent" />
                        <input type="text" inputMode="decimal" value={form.objective_required_weight_total} onChange={(event) => updateField('objective_required_weight_total', event.target.value)} />
                      </div>
                      {errors.objective_required_weight_total && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.objective_required_weight_total}</p>}
                    </div>
                  )}

                  <AppSelect label={cx('section_require_target')} value={form.objective_require_target} onChange={(value) => updateField('objective_require_target', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                  <AppSelect label={cx('section_require_evidence')} value={form.objective_require_evidence} onChange={(value) => updateField('objective_require_evidence', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                  <AppSelect label={cx('section_require_actual')} value={form.objective_require_actual_result} onChange={(value) => updateField('objective_require_actual_result', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                  <AppSelect label={cx('section_allow_individual')} value={form.objective_allow_individual_objectives} onChange={(value) => updateField('objective_allow_individual_objectives', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                  <AppSelect label={cx('section_lock_before')} value={form.objective_require_locked_plan} onChange={(value) => updateField('objective_require_locked_plan', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                  <AppSelect label={cx('section_freeze_questions')} value={form.objective_lock_questions_during_appraisal} onChange={(value) => updateField('objective_lock_questions_during_appraisal', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                  <AppSelect label={cx('section_rate_objective')} value={form.objective_force_per_question_ratings} onChange={(value) => updateField('objective_force_per_question_ratings', Number(value))} options={yesNoOptions} searchable={false} clearable={false} />
                </div>
              )}
            </div>
          )}

          <AppSelect
            label={cx('status')}
            value={form.is_active}
            onChange={(value) => updateField('is_active', Number(value))}
            options={statusOptions}
            placeholder={cx('select_status')}
            searchable={false}
            clearable={false}
          />
        </div>

        </div>

        <div className="cyc-modal-actions">
          <button type="button" className="cyc-btn cyc-btn--ghost" onClick={onClose}>{cx('cancel')}</button>
          <button type="submit" className="cyc-btn cyc-btn--primary" disabled={saving}>
            {saving ? <><span className="cyc-spinner" /> {cx('saving')}</> : <>{cx(isEdit ? 'section_update' : 'section_create')} <AppIcon icon="ArrowRight" /></>}
          </button>
        </div>
      </motion.form>
    </motion.div>
    {aiGuideOpen && <AiSetupGuide context="section" onClose={() => setAiGuideOpen(false)}/>}
    </>
  );
};

export default SectionModal;
