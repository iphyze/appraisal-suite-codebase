import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarCheck, SlidersHorizontal } from 'lucide-react';
import AppIcon from './ui/AppIcon';
import AppSelect from './ui/AppSelect';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import useToastStore from '../stores/useToastStore';
import './PortalContextSwitcher.css';

const PortalContextSwitcher = () => {
  const { t } = useTranslation('nav');
  const { t: tc } = useTranslation('company');
  const user = useAuthStore((state) => state.user);
  const { showToast } = useToastStore();
  const {
    viewCompanyId, cycleId, setViewCompanyId, setCycleId, clearContext,
    accessibleCompanies, accessStatus,
  } = usePortalContextStore();
  const [superAdminCompanies, setSuperAdminCompanies] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;
    api.get('/companies/list?limit=500&page=1&sortBy=name&sortOrder=ASC&is_active=1', { skipPortalContext: true })
      .then((response) => { if (active) setSuperAdminCompanies(response.data?.data || []); })
      .catch(() => { if (active) showToast(t('company_load_failed'), 'error'); });
    return () => { active = false; };
  }, [isSuperAdmin, showToast]);

  const canSwitch = isSuperAdmin || (isAdmin && accessStatus === 'ready' && accessibleCompanies.some((row) => !row.is_home));

  useEffect(() => {
    if (!canSwitch) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: '500', page: '1', sortBy: 'year', sortOrder: 'DESC' });
    if (viewCompanyId) params.append('view_company_id', viewCompanyId);
    api.get(`/cycles/list?${params.toString()}`, { skipPortalContext: true })
      .then((response) => { if (active) setCycles(response.data?.data || []); })
      .catch(() => { if (active) setCycles([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Cycle titles are translated by the server: reload them when the language changes.
  }, [canSwitch, viewCompanyId, i18n.resolvedLanguage]);

  const companyOptions = useMemo(() => isSuperAdmin ? [
    { value: '', label: t('all_companies'), description: t('combined_portal_view') },
    ...superAdminCompanies.map((company) => ({
      value: String(company.id), label: company.name, description: company.code || t('company'),
    })),
  ] : [
    ...accessibleCompanies.map((company) => ({
      value: company.is_home ? '' : String(company.company_id),
      label: company.name,
      description: company.is_home ? t('home_company_full')
        : tc('switch_granted_description', {
          level: company.access_level === 'manage' ? tc('banner_manage') : tc('banner_view_only'),
          scope: tc(company.staff_scope === 'Local' ? 'switch_scope_local'
            : company.staff_scope === 'Expatriate' ? 'switch_scope_expat' : 'switch_scope_all'),
        }),
    })),
  ], [isSuperAdmin, superAdminCompanies, accessibleCompanies, t, tc]);

  const cycleOptions = useMemo(() => [
    { value: '', label: t('all_active_cycle'), description: t('use_page_default') },
    ...cycles.map((cycle) => ({
      value: String(cycle.id), label: `${cycle.title} (${cycle.year})`,
      description: cycle.company_name || cycle.company_code || (Number(cycle.is_active) === 1 ? t('active_cycle') : t('cycle')),
    })),
  ], [cycles, t]);

  if (!canSwitch) return null;

  const handleCompanyChange = (value) => {
    if (isAdmin && value && !accessibleCompanies.some((row) => !row.is_home && String(row.company_id) === String(value))) {
      showToast(t('no_company_access'), 'error');
      return;
    }
    setViewCompanyId(value || '');
    // A full reload resets every in-memory list, form and AI cache. Saved
    // appraisal drafts are not deleted; they remain keyed by user/appraisal.
    window.location.reload();
  };

  return (
    <section className="portal-context" aria-label={t('company_view_context')}>
      <div className="portal-context__head">
        <span><AppIcon icon={SlidersHorizontal} size={14} className="portal-context__head-icon" /> {t('view_context')}</span>
        {(viewCompanyId || cycleId) && (
          <button type="button" onClick={() => { clearContext(); window.location.reload(); }}>{t('reset')}</button>
        )}
      </div>
      <AppSelect
        value={viewCompanyId}
        onChange={handleCompanyChange}
        options={companyOptions}
        searchable clearable={false}
        placeholder={isSuperAdmin ? t('all_companies') : t('home_company')}
        icon={Building2}
      />
      <AppSelect
        value={cycleId}
        onChange={(value) => { setCycleId(value || ''); window.location.reload(); }}
        options={cycleOptions}
        searchable clearable={false}
        placeholder={loading ? t('loading_cycles') : t('all_active_cycle')}
        icon={CalendarCheck}
      />
    </section>
  );
};

export default PortalContextSwitcher;
