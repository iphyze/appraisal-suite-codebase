import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppSelect from '../../components/ui/AppSelect';
import AppDatePicker from '../../components/ui/AppDatePicker';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import useToastStore from '../../stores/useToastStore';
import useCyclesStore from '../../stores/useCyclesStore';
import './Cycles.css';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import AppIcon from '../../components/ui/AppIcon';
import { Sparkles } from 'lucide-react';
import AiSetupGuide from '../../components/ai/AiSetupGuide';

const currentYear = new Date().getFullYear();

const cx = (key, options) => i18n.t(`cyc_${key}`, { ns: 'cycles', ...options });
const ACTIVE_OPTIONS = [
  { value: 1, key: 'active', descriptionKey: 'active_description' },
  { value: 0, key: 'inactive', descriptionKey: 'inactive_description' },
];

const makeYearOptions = () => {
  const years = [];
  for (let year = currentYear + 5; year >= 2020; year -= 1) {
    years.push({ value: year, label: String(year) });
  }
  return years;
};

const text = (value) => (value ?? '').toString().trim();

const emptyForm = {
  company_id: '',
  year: currentYear,
  title: `Annual Appraisal ${currentYear}`,
  start_date: '',
  end_date: '',
  is_active: 0,
};

const CycleForm = ({ mode = 'create', initialCycle = null }) => {
  useTranslation('cycles');
  const isEdit = mode === 'edit';
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { showToast } = useToastStore();
  const { createCycle, updateCycle } = useCyclesStore();
  const formRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiGuideOpen, setAiGuideOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const yearOptions = useMemo(makeYearOptions, []);

  useEffect(() => {
    if (!isSuperAdmin) return;

    setLoadingCompanies(true);
    api.get('/companies/list')
      .then((response) => setCompanies(response.data?.data || []))
      .catch(() => showToast(cx('failed_companies'), 'error'))
      .finally(() => setLoadingCompanies(false));
  }, [isSuperAdmin, showToast]);

  useEffect(() => {
    if (!initialCycle) return;

    setForm({
      company_id: initialCycle.company_id ? String(initialCycle.company_id) : '',
      year: initialCycle.year ? Number(initialCycle.year) : currentYear,
      title: initialCycle.title_source ?? initialCycle.title ?? '',
      start_date: initialCycle.start_date || '',
      end_date: initialCycle.end_date || '',
      is_active: Number(initialCycle.is_active ?? 0),
    });
  }, [initialCycle]);

  const statusOptions = ACTIVE_OPTIONS.map((entry) => ({ value: entry.value, label: cx(entry.key), description: cx(entry.descriptionKey) }));
  const companyOptions = useMemo(() => companies.map((company) => ({
    value: String(company.id),
    label: company.name,
    description: company.code,
  })), [companies]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'year' && !prev.title) next.title = `Annual Appraisal ${value}`;
      return next;
    });
  };

  const validate = () => {
    const errors = {};
    const year = Number(form.year);

    if (isSuperAdmin && !form.company_id) errors.company_id = cx('required_company');
    if (!year) errors.year = cx('required_year');
    else if (year < 2020 || year > currentYear + 5) errors.year = cx('year_range', { year: currentYear + 5 });
    if (!text(form.title)) errors.title = cx('required_title');
    if (form.start_date && form.end_date && new Date(form.start_date) >= new Date(form.end_date)) {
      errors.end_date = cx('end_after_start');
    }

    return errors;
  };

  const errors = submitted ? validate() : {};

  const cleanPayload = () => {
    const payload = {
      year: Number(form.year),
      title: text(form.title),
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      is_active: Number(form.is_active),
    };

    if (isSuperAdmin && form.company_id) payload.company_id = Number(form.company_id);
    if (isEdit) payload.id = Number(initialCycle.id);

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, cx('correct_fields'));
      return;
    }

    setSaving(true);
    const result = isEdit ? await updateCycle(cleanPayload()) : await createCycle(cleanPayload());
    setSaving(false);

    if (result.success) {
      const cycleId = result.data?.id || initialCycle?.id;
      navigate(cycleId ? `/cycles/view/${cycleId}` : '/cycles/home');
    }
  };

  return (
    <>
    <motion.form
      ref={formRef}
      className="cyc-form-card"
      onSubmit={handleSubmit}
      noValidate
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="cyc-form-head">
        <div>
          <p className="cyc-eyebrow">{isEdit ? cx('edit_cycle') : cx('new_cycle')}</p>
          <h2>{isEdit ? cx('update_heading', { title: initialCycle?.title || cx('cycle').toLowerCase() }) : cx('create_heading')}</h2>
          <p>
            {cx('form_intro')}
          </p>
        </div>
        <div className="asg-head-actions">{['admin', 'super_admin'].includes(currentUser?.role) && <button type="button" className="asg-launch" onClick={() => setAiGuideOpen(true)}><Sparkles size={15}/> {cx('ai_setup')}</button>}
          <Link to="/cycles/home" className="cyc-btn cyc-btn--ghost"><AppIcon icon="ArrowLeft" /> {cx('back_to_cycles')}</Link></div>
      </div>

      <div className="cyc-form-section">
        <h3><AppIcon icon="CalendarDays" /> {cx('cycle_details')}</h3>
        <div className="cyc-form-grid">
          {isSuperAdmin && (
            <AppSelect
              label={cx('company')}
              value={form.company_id}
              onChange={(value) => updateField('company_id', value)}
              options={companyOptions}
              placeholder={loadingCompanies ? cx('loading_companies') : cx('select_company')}
              searchable
              disabled={loadingCompanies || isEdit}
              error={errors.company_id}
            />
          )}

          <AppSelect
            label={cx('appraisal_year')}
            value={form.year}
            onChange={(value) => updateField('year', Number(value))}
            options={yearOptions}
            placeholder={cx('select_year')}
            searchable={false}
            clearable={false}
            error={errors.year}
          />

          <div className="cyc-field cyc-field--wide" data-invalid={errors.title ? 'true' : undefined}>
            <label>{cx('cycle_title')}</label>
            <div className={`cyc-input ${errors.title ? 'cyc-input--error' : ''}`}>
              <AppIcon icon="Heading" />
              <input
                type="text"
                name="cycle_title"
                autoComplete="on"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder={cx('title_example')}
              />
            </div>
            {errors.title && <p className="cyc-field-error"><AppIcon icon="AlertCircle" /> {errors.title}</p>}
          </div>

          <AppDatePicker
            label={cx('start_date')}
            value={form.start_date}
            onChange={(value) => updateField('start_date', value)}
            placeholder="dd/mm/yyyy"
            error={errors.start_date}
          />

          <AppDatePicker
            label={cx('end_date')}
            value={form.end_date}
            onChange={(value) => updateField('end_date', value)}
            placeholder="dd/mm/yyyy"
            minDate={form.start_date}
            error={errors.end_date}
          />

          <AppSelect
            label={cx('cycle_status')}
            value={form.is_active}
            onChange={(value) => updateField('is_active', Number(value))}
            options={statusOptions}
            placeholder={cx('select_status')}
            searchable={false}
            clearable={false}
          />
        </div>
      </div>

      <div className="cyc-active-note">
        <span><AppIcon icon="Info" /></span>
        <p>
          {cx('active_note')}
        </p>
      </div>

      <div className="cyc-form-actions">
        <Link to="/cycles/home" className="cyc-btn cyc-btn--ghost">{cx('cancel')}</Link>
        <button type="submit" className="cyc-btn cyc-btn--primary" disabled={saving}>
          {saving ? <><span className="cyc-spinner" /> {cx('saving')}</> : <>{isEdit ? cx('update_cycle') : cx('create_cycle')} <AppIcon icon="ArrowRight" /></>}
        </button>
      </div>
    </motion.form>
    {aiGuideOpen && <AiSetupGuide context="cycle" onClose={() => setAiGuideOpen(false)}/>}
    </>
  );
};

export default CycleForm;
