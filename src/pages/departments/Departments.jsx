import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatNumber } from '../../utils/format';
import { AnimatePresence, motion } from 'framer-motion';
import PageNav from '../../components/PageNav';
import AppSelect from '../../components/ui/AppSelect';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useToastStore from '../../stores/useToastStore';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import ModuleShell from '../common/ModuleShell';
import './Departments.css';
import AppIcon from '../../components/ui/AppIcon';

const dt = (key, options) => i18n.t(key, { ns: 'company', ...options });
const statusOptions = () => [
  { value: '', label: dt('dept_all_statuses') },
  { value: 1, label: dt('dept_active') },
  { value: 0, label: dt('dept_inactive') },
];
const formStatusOptions = () => [
  { value: 1, label: dt('dept_active'), description: dt('dept_active_description') },
  { value: 0, label: dt('dept_inactive'), description: dt('dept_inactive_description') },
];
const limitOptions = () => [10, 20, 50, 100].map((count) => ({
  value: count,
  label: dt('dept_rows', { count }),
}));

const initialForm = {
  company_id: '',
  name: '',
  is_active: 1,
};

const getPages = (current, total) => {
  const safeCurrent = Math.max(Number(current || 1), 1);
  const safeTotal = Math.max(Number(total || 1), 1);
  if (safeTotal <= 7) return Array.from({ length: safeTotal }, (_, index) => index + 1);

  const pages = [1];
  if (safeCurrent > 4) pages.push('left-ellipsis');
  for (let page = Math.max(2, safeCurrent - 1); page <= Math.min(safeTotal - 1, safeCurrent + 1); page += 1) {
    pages.push(page);
  }
  if (safeCurrent < safeTotal - 3) pages.push('right-ellipsis');
  pages.push(safeTotal);
  return pages;
};

const DepartmentModal = ({ open, editing, form, setForm, companies, requiresCompany, saving, submitted, onClose, onSubmit }) => {
  useTranslation('company');
  const formRef = useRef(null);
  const companyOptions = useMemo(() => companies.map((company) => ({
    value: String(company.id),
    label: company.name,
    description: company.code,
  })), [companies]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.body.classList.add('dept-modal-open');
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('dept-modal-open');
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose, saving]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dept-modal-backdrop"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) onClose();
          }}
        >
          <motion.form
            ref={formRef}
            className="dept-modal"
            onSubmit={(event) => onSubmit(event, formRef.current)}
            noValidate
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dept-modal__head">
              <div className="dept-modal__title">
                <span><AppIcon icon={editing ? 'PenLine' : 'Building2'} /></span>
                <div>
                  <p>{dt('dept_setup')}</p>
                  <h3>{dt(editing ? 'dept_edit' : 'dept_create')}</h3>
                  <small>{dt(editing ? 'dept_edit_hint' : 'dept_create_hint')}</small>
                </div>
              </div>
              <button type="button" onClick={onClose} disabled={saving} aria-label={dt('dept_close_form')}><AppIcon icon="X" /></button>
            </div>

            <div className="dept-modal__body">
              {!editing && requiresCompany && (
                <div data-invalid={submitted && !form.company_id ? 'true' : undefined}>
                  <AppSelect
                    label={dt('dept_company')}
                    value={form.company_id}
                    onChange={(value) => setForm((prev) => ({ ...prev, company_id: value }))}
                    options={companyOptions}
                    placeholder={dt('dept_select_company')}
                    searchable
                    clearable={false}
                    icon="Building2"
                    error={submitted && !form.company_id ? dt('dept_select_company_error') : ''}
                  />
                </div>
              )}

              <label className={`dept-field ${submitted && !form.name.trim() ? 'dept-field--error' : ''}`} data-invalid={submitted && !form.name.trim() ? 'true' : undefined}>
                <span>{dt('dept_name')}</span>
                <div><AppIcon icon="Building2" /><input name="department_name" autoComplete="on" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={dt('dept_name_placeholder')} autoFocus /></div>
                {submitted && !form.name.trim() && <small>{dt('dept_name_required')}</small>}
              </label>

              <AppSelect
                label={dt('dept_status')}
                value={form.is_active}
                onChange={(value) => setForm((prev) => ({ ...prev, is_active: Number(value) }))}
                options={formStatusOptions()}
                searchable={false}
                clearable={false}
                icon="ToggleRight"
              />
            </div>

            <div className="dept-modal__actions">
              <button type="button" className="dept-btn dept-btn--ghost" onClick={onClose} disabled={saving}>{dt('dept_cancel')}</button>
              <button type="submit" className="dept-btn dept-btn--primary" disabled={saving}>
                {saving ? <><span className="dept-spinner" /> {dt('dept_saving')}</> : <><AppIcon icon={editing ? 'Save' : 'PlusCircle'} /> {dt(editing ? 'dept_save_changes' : 'dept_create')}</>}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const DeleteModal = ({ department, deleting, onClose, onConfirm }) => (
  <AnimatePresence>
    {department && (
      <motion.div
        className="dept-modal-backdrop"
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deleting) onClose?.();
        }}
      >
        <motion.div className="dept-confirm" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }}>
          <div className="dept-modal__head">
            <div className="dept-modal__title">
              <span className="dept-confirm__icon"><AppIcon icon="Trash2" /></span>
              <div><p>{dt('dept_confirmation')}</p><h3>{dt('dept_delete_title')}</h3></div>
            </div>
            <button type="button" onClick={onClose} disabled={deleting} aria-label={dt('dept_close_delete')}><AppIcon icon="X" /></button>
          </div>
          <div className="dept-modal__body dept-confirm__body">
            <p>{dt('dept_delete_warning', { name: department.name_display || department.name })}</p>
          </div>
          <div className="dept-modal__actions">
            <button type="button" className="dept-btn dept-btn--ghost" onClick={onClose} disabled={deleting}>{dt('dept_cancel')}</button>
            <button type="button" className="dept-btn dept-btn--danger" onClick={onConfirm} disabled={deleting}>{deleting ? dt('dept_deleting') : <><AppIcon icon="Trash2" /> {dt('dept_delete')}</>}</button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const Departments = () => {
  const { i18n: language } = useTranslation('company');
  const locale = language.language;
  const { user } = useAuthStore();
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const { showToast } = useToastStore();
  const isSuperAdmin = user?.role === 'super_admin';
  // Departments are company-wide settings: a staff-scoped grant cannot change them.
  const { settingsLocked: isViewOnly } = useCompanyWritePermission();

  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [companyId, setCompanyId] = useState(() => viewCompanyId || '');
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = dt('dept_document_title');
  }, [locale]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/companies/list?include_inactive=0', { skipPortalContext: true })
      .then((response) => setCompanies(response.data?.data || []))
      .catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (viewCompanyId && String(viewCompanyId) !== String(companyId)) {
      setCompanyId(String(viewCompanyId));
      setPage(1);
    }
  }, [viewCompanyId, companyId]);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      if (search) params.set('search', search);
      if (status !== '') params.set('is_active', String(status));
      if (companyId) params.set('company_id', String(companyId));

      const response = await api.get(`/departments/list?${params.toString()}`);
      setDepartments(response.data?.data || []);
      setMeta(response.data?.meta || { total: 0, page: 1, total_pages: 1 });
    } catch (error) {
      setDepartments([]);
      setMeta({ total: 0, page: 1, total_pages: 1 });
      showToast(error.response?.data?.message || dt('dept_load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, limit, page, search, showToast, status, locale]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const companyOptions = useMemo(() => [
    { value: '', label: dt('dept_all_companies') },
    ...companies.map((company) => ({ value: String(company.id), label: company.name, description: company.code })),
  ], [companies, locale]);

  const stats = useMemo(() => ({
    total: Number(meta.total || 0),
    active: departments.filter((item) => Number(item.is_active) === 1).length,
    staff: departments.reduce((sum, item) => sum + Number(item.staff_count || 0), 0),
    questions: departments.reduce((sum, item) => sum + Number(item.question_count || 0), 0),
  }), [departments, meta.total]);

  const openCreate = () => {
    const defaultCompanyId = String(companyId || viewCompanyId || user?.company_id || '');
    setEditing(null);
    setForm({ ...initialForm, company_id: defaultCompanyId });
    setSubmitted(false);
    setModalOpen(true);
  };

  const openEdit = (department) => {
    setEditing(department);
    setForm({
      company_id: String(department.company_id || ''),
      name: department.name_source ?? department.name ?? '',
      is_active: Number(department.is_active ?? 1),
    });
    setSubmitted(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setSubmitted(false);
    setForm(initialForm);
  };

  const submitDepartment = async (event, formElement) => {
    event.preventDefault();
    setSubmitted(true);

    const needsCompany = isSuperAdmin && !editing;
    if (!form.name.trim() || (needsCompany && !form.company_id)) {
      notifyAndFocusFormErrors(formElement, showToast, dt('dept_complete_fields'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        is_active: Number(form.is_active),
      };
      if (isSuperAdmin && !editing) payload.company_id = Number(form.company_id);

      if (editing) {
        await api.put('/departments/update', { ...payload, id: Number(editing.id) });
      } else {
        await api.post('/departments/create', payload);
      }

      showToast(dt(editing ? 'dept_updated' : 'dept_created'), 'success');
      closeModal();
      await fetchDepartments();
    } catch (error) {
      showToast(error.response?.data?.message || dt('dept_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete('/departments/delete', { data: { ids: [Number(deleteTarget.id)] } });
      showToast(dt('dept_deleted'), 'success');
      setDeleteTarget(null);
      if (departments.length === 1 && page > 1) setPage((current) => current - 1);
      else await fetchDepartments();
    } catch (error) {
      showToast(error.response?.data?.message || dt('dept_delete_error'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const pages = getPages(page, meta.total_pages);

  return (
    <ModuleShell className="dept-page">
      <PageNav pageTitle={dt('dept_departments')} links={[{ label: dt('dept_dashboard'), to: '/dashboard', active: true }, { label: dt('dept_departments') }]} />

      <section className="dept-hero">
        <div>
          <p className="dept-eyebrow">{dt('dept_organisation_setup')}</p>
          <h2>{dt('dept_hero_title')}</h2>
          <p>{dt('dept_hero_description')}</p>
        </div>
        {!isViewOnly && <button type="button" className="dept-btn dept-btn--primary" onClick={openCreate}><AppIcon icon="PlusCircle" /> {dt('dept_create')}</button>}
      </section>

      <section className="dept-stats">
        <div><span><AppIcon icon="Building2" /></span><strong>{formatNumber(stats.total, {}, locale)}</strong><small>{dt('dept_total_departments')}</small></div>
        <div><span><AppIcon icon="CircleCheck" /></span><strong>{formatNumber(stats.active, {}, locale)}</strong><small>{dt('dept_active_on_page')}</small></div>
        <div><span><AppIcon icon="Users" /></span><strong>{formatNumber(stats.staff, {}, locale)}</strong><small>{dt('dept_staff_on_page')}</small></div>
        <div><span><AppIcon icon="Target" /></span><strong>{formatNumber(stats.questions, {}, locale)}</strong><small>{dt('dept_linked_kpis')}</small></div>
      </section>

      <section className="dept-card">
        <div className="dept-toolbar">
          <form className="dept-search" onSubmit={submitSearch}>
            <AppIcon icon="Search" />
            <input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value && search) clearSearch(); }} name="department_search" placeholder={dt('dept_search_placeholder')} autoComplete="on" />
            {searchInput && <button type="button" className="dept-search__clear" onClick={clearSearch} aria-label={dt('dept_clear_search')}><AppIcon icon="X" /></button>}
            <button type="submit" className="dept-search__submit">{dt('dept_search')}</button>
          </form>

          <div className="dept-toolbar__filters">
            {isSuperAdmin && <AppSelect value={companyId} onChange={(value) => { setCompanyId(value); setPage(1); }} options={companyOptions} clearable={false} searchable icon="Building2" />}
            <AppSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={statusOptions()} clearable={false} icon="ToggleRight" />
            <AppSelect value={limit} onChange={(value) => { setLimit(Number(value)); setPage(1); }} options={limitOptions()} clearable={false} icon="List" />
          </div>
        </div>

        <div className="dept-result-line"><span>{dt('dept_results', { count: Number(meta.total || 0), formattedCount: formatNumber(meta.total || 0, {}, locale) })}</span></div>

        <div className="dept-table-wrap">
          <table className="dept-table">
            <thead><tr><th>{dt('dept_departments_singular')}</th><th>{dt('dept_company')}</th><th>{dt('dept_linked_staff')}</th><th>{dt('dept_kpi_questions')}</th><th>{dt('dept_status')}</th><th>{dt('dept_updated_label')}</th><th className="dept-actions-th">{dt('dept_actions')}</th></tr></thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, index) => <tr key={`loading-${index}`}><td colSpan="7"><span className="dept-row-skeleton" /></td></tr>)}
              {!loading && departments.map((department) => (
                <tr key={department.id}>
                  <td><div className="dept-name-cell"><span>{String(department.name || 'D').slice(0, 2).toUpperCase()}</span><div><strong>{department.name_display || department.name}</strong><small>{dt('dept_id', { id: department.id })}</small></div></div></td>
                  <td><strong>{department.company_name || '—'}</strong><small>{department.company_code || ''}</small></td>
                  <td><strong>{formatNumber(department.staff_count || 0, {}, locale)}</strong><small>{dt('dept_user_records')}</small></td>
                  <td><strong>{formatNumber(department.question_count || 0, {}, locale)}</strong><small>{dt('dept_question_records')}</small></td>
                  <td><span className={`dept-status ${Number(department.is_active) === 1 ? 'dept-status--active' : 'dept-status--inactive'}`}>{dt(Number(department.is_active) === 1 ? 'dept_active' : 'dept_inactive')}</span></td>
                  <td>{department.updated_at ? formatDate(department.updated_at, {}, locale) : '—'}</td>
                  <td><div className="dept-row-actions">{!isViewOnly && <><button type="button" title={dt('dept_edit')} onClick={() => openEdit(department)}><AppIcon icon="PenLine" /></button><button type="button" className="dept-row-actions__delete" title={dt('dept_delete')} onClick={() => setDeleteTarget(department)}><AppIcon icon="Trash2" /></button></>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && departments.length === 0 && <div className="dept-empty"><span><AppIcon icon="Building2" /></span><h3>{dt('dept_empty_title')}</h3><p>{dt('dept_empty_description')}</p></div>}
        </div>

        <div className="dept-pagination">
          <span>{dt('dept_page_of', { page: formatNumber(page, {}, locale), total: formatNumber(Math.max(Number(meta.total_pages || 1), 1), {}, locale) })}</span>
          <div>
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><AppIcon icon="ChevronLeft" /> {dt('dept_prev')}</button>
            {pages.map((item) => typeof item === 'number' ? <button type="button" key={item} className={item === page ? 'active' : ''} disabled={item === page || loading} onClick={() => setPage(item)}>{item}</button> : <span key={item}>…</span>)}
            <button type="button" disabled={page >= Number(meta.total_pages || 1) || loading} onClick={() => setPage((current) => current + 1)}>{dt('dept_next')} <AppIcon icon="ChevronRight" /></button>
          </div>
        </div>
      </section>

      <DepartmentModal open={modalOpen} editing={editing} form={form} setForm={setForm} companies={isSuperAdmin ? companies : []} requiresCompany={isSuperAdmin} saving={saving} submitted={submitted} onClose={closeModal} onSubmit={submitDepartment} />
      <DeleteModal department={deleteTarget} deleting={deleting} onClose={() => !deleting && setDeleteTarget(null)} onConfirm={confirmDelete} />
    </ModuleShell>
  );
};

export default Departments;
