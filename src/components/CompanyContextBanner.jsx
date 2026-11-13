import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Eye, ShieldCheck } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import { selectedCompanyAccess } from '../services/companyAccess';
import './CompanyContextBanner.css';

const CompanyContextBanner = () => {
  const { t } = useTranslation('company');
  const user = useAuthStore((state) => state.user);
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const companies = usePortalContextStore((state) => state.accessibleCompanies);
  const clearContext = usePortalContextStore((state) => state.clearContext);
  const access = selectedCompanyAccess(user?.role, user?.company_id, viewCompanyId, companies);
  const company = access.company;
  const visible = user?.role === 'admin' && !!viewCompanyId && access.isGranted;
  const homeCompany = companies.find((row) => row.is_home)?.name || user?.company_name || t('banner_home');

  useEffect(() => {
    document.body.classList.toggle('ap-granted-context', visible);
    return () => document.body.classList.remove('ap-granted-context');
  }, [visible]);

  if (!visible) return null;
  const level = t(access.isViewOnly ? 'banner_view_only' : 'banner_manage');
  const scope = t(company?.staff_scope === 'Local' ? 'banner_local'
    : company?.staff_scope === 'Expatriate' ? 'banner_expat'
      : company?.staff_scope === 'All' ? 'banner_all' : 'banner_checking');

  return (
    <aside className="ap-company-banner" role="status" aria-live="polite">
      <div className="ap-company-banner__details">
        <Building2 size={15} aria-hidden="true" />
        <span>{t('banner_viewing', { company: company?.name || t('banner_another') })}</span>
        <span className="ap-company-banner__pill" title={t(access.isViewOnly ? 'banner_view_tip' : 'banner_manage_tip')}>{access.isViewOnly ? <Eye size={13} /> : <ShieldCheck size={13} />}{level}</span>
        <span className="ap-company-banner__scope">{scope}</span>
      </div>
      <button type="button" onClick={() => { clearContext(); window.location.reload(); }}>
        {t('banner_back', { company: homeCompany })}
      </button>
    </aside>
  );
};

export default CompanyContextBanner;
