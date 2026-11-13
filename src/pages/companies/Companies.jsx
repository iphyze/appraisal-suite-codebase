import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '../../utils/format';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import api from '../../services/api';
import useToastStore from '../../stores/useToastStore';
import ModuleShell from '../common/ModuleShell';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import AppIcon from '../../components/ui/AppIcon';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import CompanySetupCopy from './CompanySetupCopy';
import { listSetupSourceCycles } from '../../services/companySetupCopy';
import { companyCodeValid } from '../../utils/companySetupCopy';
import './Companies.css';

const initialForm = { code: '', name: '', logo_url: '', is_active: 1 };


const Companies = () => {
  const { t, i18n } = useTranslation('company');
  const statusOptions = [{ value: 1, label: t('co_active') }, { value: 0, label: t('co_inactive') }];
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const { showToast } = useToastStore();
  const { user } = useAuthStore();
  const [sourceCycles, setSourceCycles] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cyclesError, setCyclesError] = useState('');
  const [createdCompanyId, setCreatedCompanyId] = useState('');
  const formRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);

  const fetchCompanies = async () => {
    setListLoading(true);
    try {
      const res = await api.get('/companies/list?include_inactive=1');
      setCompanies(res.data?.data || []);
    } catch (error) {
      setCompanies([]);
      showToast(error.response?.data?.message || t('co_load_error'), 'error');
    } finally {
      setListLoading(false);
    }
  };
  const fetchCycles = async () => {
    setCyclesLoading(true);
    setCyclesError('');
    try { setSourceCycles(await listSetupSourceCycles()); }
    catch (error) { setSourceCycles([]); setCyclesError(error.response?.data?.message || error.message || t('co_cycles_error')); }
    finally { setCyclesLoading(false); }
  };
  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    document.title = t('co_document_title');
    fetchCompanies();
    fetchCycles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, t]);

  const activeCount = useMemo(() => companies.filter((company) => Number(company.is_active) === 1).length, [companies]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    const errors = {};
    if (!companyCodeValid(form.code)) errors.code = t('co_code_invalid');
    if (!form.name.trim()) errors.name = t('co_name_required');
    if (Object.keys(errors).length) {
      notifyAndFocusFormErrors(formRef.current, showToast, t('co_form_required'));
      return;
    }
    setLoading(true);
    try {
      if (editing) await api.put('/companies/update', { ...form, id: editing });
      else {
        const response = await api.post('/companies/create', form);
        setCreatedCompanyId(String(response.data?.data?.id || ''));
      }
      showToast(t(editing ? 'co_updated' : 'co_created_success'), 'success');
      setForm(initialForm);
      setSubmitted(false);
      setEditing(null);
      await fetchCompanies();
    } catch (error) {
      showToast(error.response?.data?.message || t('co_save_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const edit = (company) => {
    setEditing(company.id);
    setForm({
      code: company.code || '',
      name: company.name || '',
      logo_url: company.logo_url || '',
      is_active: Number(company.is_active ?? 1),
    });
  };

  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  return (
    <ModuleShell className="companies-page">
      <PageNav pageTitle={t('co_companies')} links={[{ label: t('co_dashboard'), to: '/dashboard', active: true }, { label: t('co_companies') }]} />

      <section className="mod-hero">
        <div>
          <p className="mod-eyebrow">{t('co_setup')}</p>
          <h2>{t('co_heading')}</h2>
          <p>{t('co_description')}</p>
        </div>
        <div className="mod-hero-stat">
          <strong>{formatNumber(activeCount, {}, i18n.language)}</strong>
          <span>{t('co_active_companies')}</span>
        </div>
      </section>

      <section className="mod-card mod-card--form companies-form-card">
        <form ref={formRef} className="mod-form" onSubmit={submit} noValidate>
          <div className="mod-form-grid">
            <label className={submitted && !companyCodeValid(form.code) ? 'mod-field--error' : ''} data-invalid={submitted && !companyCodeValid(form.code) ? 'true' : undefined}>{t('co_code')}<input name="company_code" autoComplete="off" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('co_code_placeholder')} maxLength={20} aria-invalid={submitted && !companyCodeValid(form.code)} />{submitted && !companyCodeValid(form.code) && <small className="mod-field-error">{t('co_code_error')}</small>}</label>
            <label className={submitted && !form.name.trim() ? 'mod-field--error' : ''} data-invalid={submitted && !form.name.trim() ? 'true' : undefined}>{t('co_name')}<input name="organization" autoComplete="organization" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lambert Electromec Ltd" aria-invalid={submitted && !form.name.trim()} />{submitted && !form.name.trim() && <small className="mod-field-error">{t('co_name_required')}</small>}</label>
            <label>{t('co_logo_url')}<input name="logo_url" type="url" autoComplete="url" inputMode="url" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></label>
            <AppSelect label={t('co_status')} value={form.is_active} onChange={(value) => setForm({ ...form, is_active: Number(value) })} options={statusOptions} searchable={false} clearable={false} icon="ToggleRight" />
          </div>
          <div className="mod-actions">
            <button className="mod-btn mod-btn--primary" disabled={loading}>{loading ? t('co_saving') : editing ? t('co_update') : t('co_create')}</button>
            {editing && <button type="button" className="mod-btn mod-btn--ghost" onClick={() => { setEditing(null); setForm(initialForm); }}>{t('co_cancel_edit')}</button>}
          </div>
        </form>
      </section>

      <CompanySetupCopy companies={companies} cycles={sourceCycles} cyclesLoading={cyclesLoading} reloadCycles={fetchCycles} initialTargetId={createdCompanyId} />
      {!!cyclesError && <div className="csc__error" role="alert">{t('co_source_cycles_error', { message: cyclesError })}</div>}

      <section className="mod-card">
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead><tr><th>{t('co_code')}</th><th>{t('co_name')}</th><th>{t('co_status')}</th><th>{t('co_created')}</th><th>{t('co_action')}</th></tr></thead>
            <tbody>{companies.map((company) => <tr key={company.id}><td><strong>{company.code}</strong></td><td>{company.name}<small>{company.logo_url || ''}</small></td><td><span className={`mod-pill ${Number(company.is_active) === 1 ? '' : 'mod-pill--danger'}`}>{Number(company.is_active) === 1 ? t('co_active') : t('co_inactive')}</span></td><td>{company.created_at ? formatDate(company.created_at, {}, i18n.language) : '—'}</td><td><div className="mod-row-actions"><button onClick={() => edit(company)} title={t('co_edit')} aria-label={t('co_edit')}><AppIcon icon="PenLine" /></button></div></td></tr>)}</tbody>
          </table>
        </div>
        {listLoading && <div className="mod-empty"><AppIcon icon="LoaderCircle" className="mod-icon-spin" /><h3>{t('co_loading')}</h3></div>}
        {!listLoading && !companies.length && <div className="mod-empty"><AppIcon icon="Building2" /><h3>{t('co_empty')}</h3><p>{t('co_empty_hint')}</p></div>}
      </section>
    </ModuleShell>
  );
};

export default Companies;
