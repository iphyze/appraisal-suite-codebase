import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import AppSelect from '../../components/ui/AppSelect';
import AppDatePicker from '../../components/ui/AppDatePicker';
import api from '../../services/api';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useThemeStore from '../../stores/useThemeStore';
import useCompanyWritePermission from '../../hooks/useCompanyWritePermission';
import useToastStore from '../../stores/useToastStore';
import useUsersStore from '../../stores/useUsersStore';
import './Users.css';
import { notifyAndFocusFormErrors } from '../../utils/formValidation';
import AppIcon from '../../components/ui/AppIcon';
import AdminAppraisalVisibilityPanel from './AdminAppraisalVisibilityPanel';

const ux = (key, options) => i18n.t(key, { ns: 'users', ...options });

const STAFF_TYPE_OPTIONS = [
  { value: 'Local', label: 'Local' },
  { value: 'Expatriate', label: 'Expatriate' },
];

const STAFF_SCOPE_OPTIONS = [
  { value: 'All', label: 'All Staff' },
  { value: 'Local', label: 'Local Staff Only' },
  { value: 'Expatriate', label: 'Expatriate Staff Only' },
];

const emptyForm = {
  company_id: '',
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  confirm_password: '',
  role: '',
  staff_scope: '',
  staff_id: '',
  unique_ref: '',
  department: '',
  job_title: '',
  staff_type: '',
  location: '',
  date_of_joining: '',
  is_supervisor: 0,
  is_active: 1,
};

const text = (value) => (value ?? '').toString().trim();

const UserForm = ({ mode = 'create', initialUser = null }) => {
  useTranslation('users');
  const isEdit = mode === 'edit';
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { showToast } = useToastStore();
  const { createUser, updateUser } = useUsersStore();
  const formRef = useRef(null);
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const accessibleCompanies = usePortalContextStore((state) => state.accessibleCompanies);
  const theme = useThemeStore((state) => state.theme);
  const { settingsLocked, settingsReason } = useCompanyWritePermission();

  const [form, setForm] = useState(emptyForm);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [departmentRefreshKey, setDepartmentRefreshKey] = useState(0);
  const [quickDepartmentOpen, setQuickDepartmentOpen] = useState(false);
  const [quickDepartmentName, setQuickDepartmentName] = useState('');
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [identityLookup, setIdentityLookup] = useState({ status: 'idle' });
  const [confirmIdentityLink, setConfirmIdentityLink] = useState(false);
  const linkModalRef = useRef(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const currentUserRole = currentUser?.role || '';

  const roleOptions = useMemo(() => {
    const roles = currentUserRole === 'super_admin'
      ? ['super_admin', 'admin', 'supervisor', 'staff']
      : ['supervisor', 'staff'];

    return roles.map((role) => ({
      value: role,
      label: ux(role),
      description: ux(`role_${role}_desc`),
    }));
  }, [currentUserRole, i18n.language]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    setLoadingCompanies(true);
    api.get('/companies/list')
      .then((response) => setCompanies(response.data?.data || []))
      .catch(() => showToast(ux('loading_failed_companies'), 'error'))
      .finally(() => setLoadingCompanies(false));
  }, [isSuperAdmin, showToast]);

  useEffect(() => {
    if (!initialUser) return;

    setForm({
      company_id: initialUser.company_id ? String(initialUser.company_id) : '',
      first_name: initialUser.first_name || '',
      last_name: initialUser.last_name || '',
      username: initialUser.username || '',
      email: initialUser.email || '',
      password: '',
      confirm_password: '',
      role: initialUser.role || '',
      staff_scope: initialUser.staff_scope || '',
      staff_id: initialUser.staff_id || '',
      unique_ref: initialUser.unique_ref || '',
      department: initialUser.department || '',
      job_title: initialUser.job_title || '',
      staff_type: initialUser.staff_type || '',
      location: initialUser.location || '',
      date_of_joining: initialUser.date_of_joining || '',
      is_supervisor: Number(initialUser.is_supervisor ?? 0),
      is_active: Number(initialUser.is_active ?? 1),
    });
  }, [initialUser]);

  // Only display companies the viewer is authorized to see; PHP rechecks
  // everything when actually creating or linking an account.
  useEffect(() => {
    const email = text(form.email).toLowerCase();
    const unchangedEditEmail = isEdit && email === text(initialUser?.email).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || unchangedEditEmail ||
        (isSuperAdmin && !form.company_id)) {
      setIdentityLookup({ status: 'idle' });
      return undefined;
    }
    let alive = true;
    setIdentityLookup({ status: 'loading' });
    const handle = window.setTimeout(async () => {
      try {
        const response = await api.get('/users/identity-lookup', {
          params: { email, ...(isSuperAdmin ? { company_id: Number(form.company_id) } : {}) },
          skipPortalContext: isSuperAdmin,
        });
        if (alive) setIdentityLookup({ status: 'ready', ...(response.data?.data || {}) });
      } catch {
        if (alive) setIdentityLookup({ status: 'error' });
      }
    }, 300);
    return () => { alive = false; window.clearTimeout(handle); };
  }, [form.email, form.company_id, isEdit, isSuperAdmin, initialUser?.email]);

  useEffect(() => {
    if (!confirmIdentityLink) return undefined;
    const previous = document.activeElement;
    const first = linkModalRef.current?.querySelector('button');
    first?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) setConfirmIdentityLink(false);
      if (event.key === 'Tab') {
        const buttons = Array.from(linkModalRef.current?.querySelectorAll('button:not([disabled])') || []);
        if (!buttons.length) return;
        const firstButton = buttons[0];
        const lastButton = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === firstButton) { event.preventDefault(); lastButton.focus(); }
        if (!event.shiftKey && document.activeElement === lastButton) { event.preventDefault(); firstButton.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus?.(); };
  }, [confirmIdentityLink, saving]);

  const companyOptions = useMemo(() => companies.map((company) => ({
    value: String(company.id),
    label: company.name,
    description: company.code,
  })), [companies]);

  const targetCompanyName = isSuperAdmin
    ? companies.find((company) => String(company.id) === String(form.company_id))?.name || ux('company')
    : (accessibleCompanies.find((company) => String(company.company_id) === String(viewCompanyId))?.name
      || currentUser?.company_name || ux('selected_company'));

  const departmentCompanyId = isSuperAdmin
    ? form.company_id
    : (viewCompanyId ? String(viewCompanyId) : currentUser?.company_id ? String(currentUser.company_id) : '');

  useEffect(() => {
    if (!departmentCompanyId) {
      setDepartments([]);
      return;
    }

    let active = true;
    setLoadingDepartments(true);

    const params = new URLSearchParams({
      page: '1',
      limit: '500',
      is_active: '1',
      sortBy: 'name',
      sortOrder: 'ASC',
      company_id: String(departmentCompanyId),
    });

    api.get(`/departments/list?${params.toString()}`, {
      skipPortalContext: isSuperAdmin,
    })
      .then((response) => {
        if (active) setDepartments(response.data?.data || []);
      })
      .catch(() => {
        if (active) {
          setDepartments([]);
          showToast(ux('loading_failed_departments'), 'error');
        }
      })
      .finally(() => {
        if (active) setLoadingDepartments(false);
      });

    return () => {
      active = false;
    };
  }, [departmentCompanyId, isSuperAdmin, showToast, departmentRefreshKey]);

  useEffect(() => {
    if (!quickDepartmentOpen) return undefined;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event) => {
      if (event.key === 'Escape' && !creatingDepartment) setQuickDepartmentOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', escape);
    };
  }, [quickDepartmentOpen, creatingDepartment]);

  const createDepartmentInline = async (event) => {
    event.preventDefault();
    const name = quickDepartmentName.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 150 || !departmentCompanyId) {
      showToast(ux('department_invalid'), 'error');
      return;
    }
    setCreatingDepartment(true);
    try {
      const response = await api.post('/departments/create', {
        name,
        is_active: 1,
        ...(isSuperAdmin ? { company_id: Number(departmentCompanyId) } : {}),
      }, { skipPortalContext: isSuperAdmin });
      const createdName = response.data?.data?.name || name;
      updateField('department', createdName);
      setDepartments((items) => [...items, { ...(response.data?.data || {}), name: createdName }]);
      setDepartmentRefreshKey((value) => value + 1);
      setQuickDepartmentOpen(false);
      setQuickDepartmentName('');
      showToast(ux('department_created', { name: createdName }), 'success');
    } catch (error) {
      showToast(error.response?.data?.message || ux('department_create_failed'), 'error');
    } finally {
      setCreatingDepartment(false);
    }
  };

  const departmentOptions = useMemo(() => {
    const options = departments.map((department) => ({
      value: department.name,
      label: department.name,
      description: department.company_code || '',
    }));

    if (form.department && !options.some((option) => option.value === form.department)) {
      options.unshift({
        value: form.department,
        label: form.department,
        description: ux('current_department'),
      });
    }

    return options;
  }, [departments, form.department, i18n.language]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === 'company_id' && String(value) !== String(prev.company_id)) {
        next.department = '';
      }

      if (field === 'role') {
        if (value !== 'admin') next.staff_scope = '';
        if (value === 'admin') next.staff_scope = next.staff_scope || 'All';
        if (value !== 'admin') next.is_supervisor = 0;
      }

      return next;
    });
  };

  const validate = () => {
    const errors = {};

    if (isSuperAdmin && !form.company_id) errors.company_id = ux('company_required');
    if (!text(form.first_name)) errors.first_name = ux('first_required');
    if (!text(form.last_name)) errors.last_name = ux('last_required');
    // Email is optional: historical employees without a real address must remain blank.
    if (text(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(form.email))) {
      errors.email = ux('valid_email');
    }
    if (!form.role) errors.role = ux('role_required');

    if (form.role === 'admin' && !form.staff_scope) {
      errors.staff_scope = ux('scope_required');
    }

    if (form.role && form.role !== 'super_admin' && !form.staff_type) {
      errors.staff_type = ux('staff_type_required');
    }

    if (!isEdit && text(form.email) && !(identityLookup.status === 'ready' && identityLookup.exists)) {
      if (text(form.email) && identityLookup.status !== 'ready') errors.email = ux('identity_lookup_wait');
      if (identityLookup.manual_review) errors.email = ux('identity_manual_review');
      if (!form.password) errors.password = ux('password_required');
      else if (form.password.length < 6) errors.password = ux('password_minimum');
      if (!form.confirm_password) errors.confirm_password = ux('confirm_required');
      else if (form.password !== form.confirm_password) errors.confirm_password = ux('password_mismatch');
    }

    if (identityLookup.status === 'ready' && (identityLookup.manual_review || (!isEdit && identityLookup.already_in_company))) {
      errors.email = ux(identityLookup.manual_review ? 'identity_manual_review' : 'identity_already_company');
    }
    if (identityLookup.status === 'loading' || identityLookup.status === 'error') {
      errors.email = ux('identity_lookup_wait');
    }
    return errors;
  };

  const errors = submitted ? validate() : {};

  const cleanPayload = () => {
    const payload = {
      first_name: text(form.first_name),
      last_name: text(form.last_name),
      email: text(form.email).toLowerCase(),
      username: text(form.username) || undefined,
      role: form.role,
      staff_scope: form.role === 'admin' ? form.staff_scope : undefined,
      is_supervisor: form.role === 'admin' ? Number(form.is_supervisor) : undefined,
      staff_id: text(form.staff_id) || undefined,
      unique_ref: text(form.unique_ref) || undefined,
      department: text(form.department) || undefined,
      job_title: text(form.job_title) || undefined,
      staff_type: form.staff_type || undefined,
      location: text(form.location) || undefined,
      date_of_joining: form.date_of_joining || undefined,
    };

    if (isSuperAdmin && form.company_id) payload.company_id = Number(form.company_id);

    if (isEdit) {
      // Do not submit staff_type when it was not changed. Apart from keeping
      // update requests smaller, this prevents an unchanged sensitive field
      // from being mistaken for a staff-type change by older API deployments.
      if (form.staff_type === (initialUser?.staff_type || '')) {
        delete payload.staff_type;
      }

      payload.id = Number(initialUser.id);
      payload.is_active = Number(form.is_active);
    } else {
      if (!(identityLookup.status === 'ready' && identityLookup.exists)) {
        if (form.password) payload.password = form.password;
      }
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    const formErrors = validate();
    if (Object.keys(formErrors).length > 0) {
      notifyAndFocusFormErrors(formRef.current, showToast, ux('form_invalid'));
      return;
    }

    setSaving(true);
    const result = isEdit ? await updateUser(cleanPayload()) : await createUser(cleanPayload());
    setSaving(false);
    if (result.code === 'IDENTITY_LINK_CONFIRM_REQUIRED') {
      setConfirmIdentityLink(true);
      return;
    }
    if (result.success) {
      navigate('/users/home');
    }
  };

  const confirmLink = async () => {
    if (saving) return;
    setSaving(true);
    const result = await updateUser({ ...cleanPayload(), confirm_identity_link: true });
    setSaving(false);
    if (result.success) {
      setConfirmIdentityLink(false);
      navigate('/users/home');
    }
  };

  const roleLabel = form.role ? (['super_admin', 'admin', 'supervisor', 'staff'].includes(form.role) ? ux(form.role) : form.role) : ux('user_singular');
  const translatedStaffTypes = STAFF_TYPE_OPTIONS.map((item) => ({ ...item, label: ux(item.value.toLowerCase()) }));
  const translatedStaffScopes = STAFF_SCOPE_OPTIONS.map((item) => ({ ...item, label: ux(item.value === 'All' ? 'all_staff' : `${item.value.toLowerCase()}_staff_only`) }));
  const initialRoleKey = text(initialUser?.role).toLowerCase().replace(/\s+/g, '_');
  const initialCanConductAppraisals = isEdit && (
    initialRoleKey === 'supervisor'
    || (initialRoleKey === 'admin' && Number(initialUser?.is_supervisor || 0) === 1)
  );
  const finalCanConductAppraisals = form.role === 'supervisor'
    || (form.role === 'admin' && Number(form.is_supervisor) === 1);
  const removingSupervisorCapability = initialCanConductAppraisals && !finalCanConductAppraisals;

  return (
    <>
    <motion.form
      ref={formRef}
      className="usr-form-card"
      onSubmit={handleSubmit}
      noValidate
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="usr-form-head">
        <div>
          <p className="usr-eyebrow">{ux(isEdit ? 'edit_account' : 'new_account')}</p>
          <h2>{isEdit ? ux('update_named', { name: initialUser?.first_name || ux('user_singular') }) : ux('create_user_account')}</h2>
          <p>
            {ux(isEdit ? 'update_summary' : 'create_summary')}
          </p>
        </div>
        <div className="usr-form-pill">
          <AppIcon icon="ShieldCheck" />
          <span>{roleLabel || ux('no_role')}</span>
        </div>
      </div>

      <div className="usr-form-section">
        <div className="usr-section-title">
          <AppIcon icon="IdCard" />
          <span>{ux('account_details')}</span>
        </div>

        <div className="usr-form-grid">
          {isSuperAdmin && (
            <AppSelect
              label={ux('company')}
              value={form.company_id}
              onChange={(value) => updateField('company_id', value)}
              options={companyOptions}
              placeholder={ux(loadingCompanies ? 'loading_companies' : 'select_company')}
              searchable
              error={errors.company_id}
              disabled={loadingCompanies}
            />
          )}

          <AppSelect
            label={ux('role')}
            value={form.role}
            onChange={(value) => updateField('role', value)}
            options={roleOptions}
            placeholder={ux('select_role')}
            error={errors.role}
          />

          {form.role === 'admin' && (
            <AppSelect
              label={ux('staff_scope')}
              value={form.staff_scope}
              onChange={(value) => updateField('staff_scope', value)}
              options={translatedStaffScopes}
              placeholder={ux('select_admin_scope')}
              error={errors.staff_scope}
            />
          )}

          {form.role === 'admin' && (
            <div className="usr-supervisor-capability">
              <div className="usr-supervisor-capability__copy">
                <span className="usr-supervisor-capability__icon"><AppIcon icon="UserCheck" /></span>
                <div>
                  <span className="usr-supervisor-capability__title">{ux('also_supervisor')}</span>
                  <span className="usr-supervisor-capability__description">
                    {ux('also_supervisor_desc')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`usr-switch ${form.is_supervisor ? 'usr-switch--active' : ''}`}
                role="switch"
                aria-checked={Boolean(form.is_supervisor)}
                aria-label={ux('also_supervisor')}
                onClick={() => updateField('is_supervisor', form.is_supervisor ? 0 : 1)}
              >
                <span className="usr-switch__thumb" />
              </button>
            </div>
          )}

          {removingSupervisorCapability && (
            <div className="usr-supervisor-capability-warning" role="note">
              <span className="usr-supervisor-capability-warning__icon">
                <AppIcon icon="TriangleAlert" />
              </span>
              <span>
                {ux('remove_supervisor_warn')}
              </span>
            </div>
          )}

          {isEdit && (
            <AppSelect
              label={ux('account_status')}
              value={String(form.is_active)}
              onChange={(value) => updateField('is_active', Number(value))}
              options={[
                { value: '1', label: ux('active'), description: ux('can_sign_in') },
                { value: '0', label: ux('inactive'), description: ux('cannot_sign_in') },
              ]}
              clearable={false}
              placeholder={ux('select_status')}
            />
          )}
        </div>
      </div>

      {isSuperAdmin && isEdit && initialRoleKey === 'admin' && form.role === 'admin' && (
        <AdminAppraisalVisibilityPanel
          adminId={initialUser?.id}
          adminName={text(initialUser?.fullname) || text(`${initialUser?.first_name || ''} ${initialUser?.last_name || ''}`) || ux('this_admin')}
        />
      )}

      {isSuperAdmin && isEdit && initialRoleKey !== 'admin' && form.role === 'admin' && (
        <div className="usr-form-section">
          <div className="usr-admin-appraisal-access__pending" role="note">
            <AppIcon icon="Info" />
            <span>
              {ux('visibility_pending')}
            </span>
          </div>
        </div>
      )}

      <div className="usr-form-section">
        <div className="usr-section-title">
          <AppIcon icon="User" />
          <span>{ux('personal_information')}</span>
        </div>

        <div className="usr-form-grid">
          <Field label={ux('first_name')} error={errors.first_name}>
            <input name="first_name" autoComplete="given-name" value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} placeholder={ux('example_first')} />
          </Field>
          <Field label={ux('last_name')} error={errors.last_name}>
            <input name="last_name" autoComplete="family-name" value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} placeholder={ux('example_last')} />
          </Field>
          <Field label={ux('username')}>
            <input name="username" autoComplete="username" value={form.username} onChange={(e) => updateField('username', e.target.value)} placeholder={ux('optional_username')} />
          </Field>
          <div className="usr-identity-email">
            <Field label={ux('email_address')} error={errors.email}>
              <input type="email" name="email" autoComplete="email" inputMode="email" spellCheck={false} value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder={ux('email_example')} />
            </Field>
            {identityLookup.status === 'loading' && <p className="usr-identity-note">{ux('identity_checking')}</p>}
            {identityLookup.status === 'ready' && identityLookup.exists && !identityLookup.manual_review && (
              <div className="usr-identity-note usr-identity-note--linked" role="status">
                <AppIcon icon="Info" />
                <span>{ux(isEdit ? 'identity_link_edit_notice' : 'identity_existing_notice', {
                  companies: identityLookup.company_names?.join(', ') || ux('identity_other_company'),
                  company: targetCompanyName,
                })}</span>
              </div>
            )}
            {isEdit && !text(initialUser?.email) && text(form.email) && identityLookup.status === 'ready' && !identityLookup.exists && !identityLookup.manual_review && (
              <div className="usr-identity-note usr-identity-note--linked" role="status"><AppIcon icon="Info" /> {ux('identity_reset_after_email')}</div>
            )}
            {identityLookup.status === 'ready' && identityLookup.manual_review && (
              <div className="usr-identity-note usr-identity-note--warning" role="alert">{ux('identity_manual_review')}</div>
            )}
          </div>
        </div>
      </div>

      {!isEdit && text(form.email) && !(identityLookup.status === 'ready' && identityLookup.exists) && (
        <div className="usr-form-section">
          <div className="usr-section-title">
            <AppIcon icon="LockKeyhole" />
            <span>{ux('password')}</span>
          </div>

          <div className="usr-form-grid">
            <Field label={ux('password')} error={errors.password}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder={ux('minimum_password')}
              />
              <button
                type="button"
                className="usr-eye-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={ux(showPassword ? 'hide_password' : 'show_password')}
              >
                <AppIcon icon={showPassword ? 'EyeOff' : 'Eye'} />
              </button>
            </Field>
            <Field label={ux('confirm_password')} error={errors.confirm_password}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirm_password"
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={(e) => updateField('confirm_password', e.target.value)}
                placeholder={ux('repeat_password')}
              />
              <button
                type="button"
                className="usr-eye-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={ux(showConfirmPassword ? 'hide_password' : 'show_password')}
              >
                <AppIcon icon={showConfirmPassword ? 'EyeOff' : 'Eye'} />
              </button>
            </Field>
          </div>
        </div>
      )}

      <div className="usr-form-section">
        <div className="usr-section-title">
          <AppIcon icon="Briefcase" />
          <span>{ux('staff_details')}</span>
        </div>

        <div className="usr-form-grid">
          <Field label={ux('staff_id')}>
            <input name="staff_id" autoComplete="on" value={form.staff_id} onChange={(e) => updateField('staff_id', e.target.value)} placeholder={ux('example_staff_id')} />
          </Field>
          <Field label={ux('unique_reference')}>
            <input name="unique_ref" autoComplete="on" value={form.unique_ref} onChange={(e) => updateField('unique_ref', e.target.value)} placeholder={ux('example_ref')} />
          </Field>
          <div className="usr-field-with-action">
          <div className="usr-field-with-action__control"><AppSelect
            label={ux('department')}
            value={form.department}
            onChange={(value) => updateField('department', value)}
            options={departmentOptions}
            placeholder={ux(loadingDepartments ? 'loading_departments' : departmentCompanyId ? 'select_department' : 'select_company_first')}
            searchable
            disabled={loadingDepartments || !departmentCompanyId}
          /></div>
          <button type="button" className="usr-dept-add-btn" title={settingsLocked ? settingsReason || ux('settings_locked') : ux('create_department')}
            aria-label={ux('quick_add_department')} disabled={loadingDepartments || !departmentCompanyId || settingsLocked}
            onClick={() => setQuickDepartmentOpen(true)}><AppIcon icon="Plus" /></button>
          </div>
          <Field label={ux('job_title')}>
            <input name="job_title" autoComplete="organization-title" value={form.job_title} onChange={(e) => updateField('job_title', e.target.value)} placeholder={ux('example_job')} />
          </Field>
          <AppSelect
            label={ux('staff_type')}
            value={form.staff_type}
            onChange={(value) => updateField('staff_type', value)}
            options={translatedStaffTypes}
            placeholder={ux('select_staff_type')}
            error={errors.staff_type}
          />
          <Field label={ux('location_project')}>
            <input name="location" autoComplete="on" value={form.location} onChange={(e) => updateField('location', e.target.value)} placeholder={ux('example_location')} />
          </Field>
          <AppDatePicker
            label={ux('date_joining')}
            value={form.date_of_joining}
            onChange={(value) => updateField('date_of_joining', value)}
          />
        </div>
      </div>

      <div className="usr-form-actions">
        <Link to="/users/home" className="usr-btn usr-btn--ghost">{ux('cancel')}</Link>
        <button type="submit" className="usr-btn usr-btn--primary" disabled={saving || identityLookup.status === 'loading' || identityLookup.status === 'error' || (identityLookup.status === 'ready' && (identityLookup.manual_review || (!isEdit && identityLookup.already_in_company)))}>
          {saving ? <><span className="usr-spinner" /> {ux('saving')}</> : <>{ux(isEdit ? 'update_user' : 'create_user')} <AppIcon icon="ArrowRight" /></>}
        </button>
      </div>
    </motion.form>
    {confirmIdentityLink && createPortal(
      <div className={`usr-modal-backdrop usr-bulk-backdrop theme-${theme}`}>
        <section className="usr-modal usr-bulk-modal" role="alertdialog" aria-modal="true" aria-labelledby="usr-identity-confirm-title" aria-describedby="usr-identity-confirm-message" ref={linkModalRef}>
          <div className="usr-modal-head">
            <div className="usr-modal-heading"><span className="usr-modal-icon"><AppIcon icon="Link2" /></span>
              <div><h3 id="usr-identity-confirm-title">{ux('identity_confirm_link_title')}</h3></div>
            </div>
            <button type="button" className="usr-modal-close" disabled={saving} onClick={() => setConfirmIdentityLink(false)} aria-label={ux('cancel')}><AppIcon icon="X" /></button>
          </div>
          <div className="usr-modal-body"><p id="usr-identity-confirm-message">{ux('identity_confirm_link_message', { email: form.email })}</p></div>
          <div className="usr-modal-actions">
            <button type="button" className="usr-btn usr-btn--ghost" onClick={() => setConfirmIdentityLink(false)} disabled={saving}>{ux('cancel')}</button>
            <button type="button" className="usr-btn usr-btn--primary" onClick={confirmLink} disabled={saving}>{ux('identity_confirm_link_action')}</button>
          </div>
        </section>
      </div>, document.body
    )}
    {quickDepartmentOpen && createPortal(
      <div className={`usr-modal-backdrop usr-bulk-backdrop theme-${theme}`} onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creatingDepartment) setQuickDepartmentOpen(false);
      }}>
        <form className="usr-modal usr-bulk-modal" role="dialog" aria-modal="true" aria-labelledby="usr-quick-dept-title" onSubmit={createDepartmentInline}>
          <div className="usr-modal-head">
            <div className="usr-modal-heading"><span className="usr-modal-icon"><AppIcon icon="Building2" /></span>
              <div><span>{ux('quick_setup')}</span><h3 id="usr-quick-dept-title">{ux('create_department')}</h3></div>
            </div>
            <button className="usr-modal-close" type="button" disabled={creatingDepartment} onClick={() => setQuickDepartmentOpen(false)} aria-label={ux('close_department')}><AppIcon icon="X" /></button>
          </div>
          <div className="usr-modal-body">
            <p>{ux('quick_department_summary')}</p>
            <Field label={ux('department_name')}>
              <input autoFocus required maxLength={150} placeholder={ux('example_department')} value={quickDepartmentName}
                onChange={(event) => setQuickDepartmentName(event.target.value)} />
            </Field>
          </div>
          <div className="usr-modal-actions">
            <button type="button" className="usr-btn usr-btn--ghost" disabled={creatingDepartment} onClick={() => setQuickDepartmentOpen(false)}>{ux('cancel')}</button>
            <button type="submit" className="usr-btn usr-btn--primary" disabled={creatingDepartment || !quickDepartmentName.trim()}>
              {ux(creatingDepartment ? 'creating' : 'create_select')}
            </button>
          </div>
        </form>
      </div>, document.body
    )}
    </>
  );
};

const Field = ({ label, error, children }) => (
  <div className={`usr-field ${error ? 'usr-field--error' : ''}`} data-invalid={error ? 'true' : undefined}>
    <label>{label}</label>
    <div className="usr-input-wrap">{children}</div>
    {error && <p><AppIcon icon="AlertCircle" /> {error}</p>}
  </div>
);

export default UserForm;