import api from './api';
import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import { notificationCompanyDecision, safeNotificationPath } from '../utils/notificationNavigation';

/**
 * Validate this specific inbox row on the SERVER before using its link.
 * Then check the admin's current switchable companies (not stored grants).
 * Company switches reload the app to drop stale company-specific page caches.
 * Both the notification dropdown and full inbox use this same operation.
 */
export const openVerifiedNotification = async (item, { navigate, markRead, showToast }) => {
  const actor = useAuthStore.getState().user;
  if (!actor?.id || !item?.id) return false;

  try {
    const verifiedResponse = await api.get('/notifications/open', {
      params: { id: item.id }, skipPortalContext: true, skipRetry: true,
    });
    const verified = verifiedResponse.data?.data;
    if (!verified || String(verified.id) !== String(item.id)) {
      throw new Error('This notification could not be verified.');
    }
    // Do not allow a response to move a different signed-in user's context.
    if (String(useAuthStore.getState().user?.id) !== String(actor.id)) return false;

    let companies = [];
    if (actor.role === 'admin') {
      const access = await api.get('/users/my-accessible-companies', {
        skipPortalContext: true, skipRetry: true,
      });
      if (String(useAuthStore.getState().user?.id) !== String(actor.id)) return false;
      companies = Array.isArray(access.data?.data) ? access.data.data : [];
      // Keep the switcher aligned with current grants. If the selected
      // company was revoked, the store clears it without trusting a snapshot.
      usePortalContextStore.getState().setAccessibleCompanies(companies, actor);
    }
    const decision = notificationCompanyDecision(verified, actor, companies);
    if (!decision.allowed) {
      showToast('Your access to the company for this notification has ended.', 'error');
      return false;
    }
    if (Number(verified.is_read) === 0) {
      const readResult = await markRead(verified.id);
      if (!readResult?.success) {
        showToast('This notification could not be marked as read. Please refresh your inbox.', 'error');
        return false;
      }
    }

    const path = safeNotificationPath(verified.link_url);
    const context = usePortalContextStore.getState();
    if (decision.selection !== null && String(context.viewCompanyId || '') !== decision.selection) {
      context.setViewCompanyId(decision.selection);
      // Use the same full reload as View Context, so no old company lists,
      // analytics, AI results or forms appear under the new company's banner.
      window.location.assign(path);
    } else {
      navigate(path);
    }
    return true;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 403 && actor.role === 'admin') {
      try {
        // This may be a revoked *selected* company rather than a stale
        // notification. Refresh grants without passing that invalid selector.
        const access = await api.get('/users/my-accessible-companies', {
          skipPortalContext: true, skipCompanyRecovery: true, skipRetry: true,
        });
        if (String(useAuthStore.getState().user?.id) !== String(actor.id)) return false;
        const stillAllowed = usePortalContextStore.getState().setAccessibleCompanies(access.data?.data, actor);
        if (!stillAllowed) {
          window.sessionStorage.setItem('appraisal-company-access-notice',
            'company:access_lost');
          window.location.assign('/notifications');
          return false;
        }
      } catch (_) {
        // Do not treat a network error as proof of grant revocation.
      }
    }
    showToast(status === 403 || status === 404
      ? 'This notification is no longer available or you no longer have access to its company.'
      : (error?.response?.data?.message || error?.message || 'Unable to open notification.'), 'error');
    return false;
  }
};
