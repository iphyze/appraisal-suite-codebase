import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import useToastStore from '../stores/useToastStore';

/**
 * Grant metadata is loaded for EVERY admin workspace, including direct links
 * to edit forms that do not render the navigation until permission is known.
 * This is only UI metadata; the API rechecks the live grant on each request.
 */
const CompanyAccessBootstrap = () => {
  const { t } = useTranslation('company');
  const user = useAuthStore((state) => state.user);
  const authenticated = useAuthStore((state) => state.authenticated);
  const ensureOwner = usePortalContextStore((state) => state.ensureOwner);
  const setAccessibleCompanies = usePortalContextStore((state) => state.setAccessibleCompanies);
  const setAccessStatus = usePortalContextStore((state) => state.setAccessStatus);
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    if (!authenticated || !user?.id) return;
    ensureOwner(user.id, user.role);
  }, [authenticated, user?.id, user?.role, ensureOwner]);

  useEffect(() => {
    if (!authenticated || !user?.id || user.role !== 'admin') return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await api.get('/users/my-accessible-companies', {
          skipPortalContext: true, skipRetry: true,
        });
        if (!active) return;
        const stillAllowed = setAccessibleCompanies(response.data?.data, user);
        if (!stillAllowed) {
          window.sessionStorage.setItem('appraisal-company-access-notice', 'company:access_lost');
          window.location.assign('/dashboard');
        }
      } catch (error) {
        if (!active) return;
        setAccessStatus('error');
        showToast(error.response?.data?.message || t('bootstrap_verify_error'), 'error');
      }
    };
    setAccessStatus('loading');
    void refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.removeEventListener('focus', onFocus); };
  }, [authenticated, user?.id, user?.role, user?.company_id, ensureOwner, setAccessibleCompanies, setAccessStatus, showToast, t]);
  return null;
};

export default CompanyAccessBootstrap;
