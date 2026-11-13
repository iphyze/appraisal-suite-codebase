import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import useCompanyWritePermission from '../hooks/useCompanyWritePermission';
import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import AppLoadingScreen from './AppLoadingScreen';

/**
 * Protects administrative create/edit pages from being presented as editable.
 * `companyWide`: the page edits company-wide settings, which need Manage access for all staff.
 */
const CompanyManageRoute = ({ children, companyWide = false }) => {
  const { t } = useTranslation('common');
  const { isViewOnly, settingsLocked } = useCompanyWritePermission();
  const user = useAuthStore((state) => state.user);
  const selection = usePortalContextStore((state) => state.viewCompanyId);
  const status = usePortalContextStore((state) => state.accessStatus);
  if (user?.role === 'admin' && selection && ['idle', 'loading'].includes(status)) {
    return <AppLoadingScreen label="Verifying company access" />;
  }
  if (!isViewOnly && !(companyWide && settingsLocked)) return children;
  if (!isViewOnly) {
    return (
      <main className="ap-manage-route-block" role="alert">
        <Eye size={24} aria-hidden="true" />
        <h2>{t('company_settings_locked')}</h2>
        <p>{t('company_settings_locked_detail')}</p>
        <Link to="/dashboard">{t('return_dashboard')}</Link>
      </main>
    );
  }
  return (
    <main className="ap-manage-route-block" role="alert">
      <Eye size={24} aria-hidden="true" />
      <h2>{t('view_only_company')}</h2>
      <p>{t('view_only_company_detail')}</p>
      <Link to="/dashboard">{t('return_dashboard')}</Link>
    </main>
  );
};
export default CompanyManageRoute;
