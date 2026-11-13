import axios from 'axios';
import { makeRequestId } from '../utils/requestId';
import useAuthStore from '../stores/useAuthStore';
import usePortalContextStore from '../stores/usePortalContextStore';
import { isGrantRevocationError } from './companyAccess';
import useLocaleStore from '../stores/useLocaleStore';
import { requestHeaderLocale } from '../utils/localeRules';
import { localizeApiError, localizeApiResponse } from '../utils/apiMessage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost/appraisalsuite-server/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);
const safeRetryMethods = new Set(['get', 'head', 'options']);
// These submissions create side effects. A stable key protects against double-clicks
// and lets the server recognize the same submission after a lost response.
const idempotentSubmissionRoutes = new Set([
  '/appraisals/create',
  '/appraisals/update',
  '/appraisals/restore-updates',
  '/appraisals/submit-feedback',
  '/appraisals/management-review',
  '/appraisals/verify-breach',
  '/appraisals/management-follow-up-response',
  '/mail/send',
]);
const submissionKeys = new Map();
const SUBMISSION_KEY_LIFETIME_MS = 60 * 1000;

const getSubmissionKey = (method, url, config, userId) => {
  const now = Date.now();
  for (const [signature, saved] of submissionKeys) {
    if (saved.expiresAt <= now) submissionKeys.delete(signature);
  }

  const payload = typeof config.data === 'string' ? config.data : JSON.stringify(config.data ?? null);
  const signature = JSON.stringify([userId, method, url, config.params ?? {}, payload]);
  config._submissionSignature = signature;
  const existing = submissionKeys.get(signature);
  if (existing) return existing.key;

  const key = makeRequestId();
  submissionKeys.set(signature, { key, expiresAt: now + SUBMISSION_KEY_LIFETIME_MS });
  return key;
};

/**
 * A refused submission (4xx: validation, permission, expired session…) changed nothing on
 * the server, so the next attempt must be a fresh request, not a replay of the refusal.
 * 409 is kept: it means "already received / still processing".
 */
const releaseSubmissionKey = (config, status) => {
  if (!config?._submissionSignature || !status || status < 400 || status >= 500 || status === 409) return;
  submissionKeys.delete(config._submissionSignature);
};
const retryableStatuses = new Set([408, 425, 429]);
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 3000;
let csrfRefreshPromise = null;
let companyRevalidationPromise = null;
const MUTATION_SESSION_CHECK_MAX_AGE_MS = 90 * 1000;

const wait = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

const parseRetryAfter = (value) => {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, RETRY_MAX_DELAY_MS);
  }

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate)) return null;

  return Math.min(Math.max(retryDate - Date.now(), 0), RETRY_MAX_DELAY_MS);
};

const getRetryDelay = (error, retryCount) => {
  const retryAfter = parseRetryAfter(error.response?.headers?.['retry-after']);
  if (retryAfter !== null) return retryAfter;

  return Math.min(RETRY_BASE_DELAY_MS * (2 ** Math.max(retryCount - 1, 0)), RETRY_MAX_DELAY_MS);
};

const shouldRetryRequest = (error, config) => {
  if (!config || config.skipRetry) return false;
  // Never automatically replay a write. The server may have committed it even
  // when the browser saw a timeout, disconnect or 5xx response.
  if (!safeRetryMethods.has(String(config.method || 'get').toLowerCase())) return false;
  if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return false;

  const retryCount = Number(config._retryCount || 0);
  if (retryCount >= MAX_RETRIES) return false;

  // No HTTP response means a transport-level failure such as a dropped
  // connection, timeout, DNS issue, or temporarily unreachable backend.
  if (!error.response) return true;

  const status = Number(error.response.status);
  return retryableStatuses.has(status) || (status >= 500 && status <= 599);
};

const retryRequest = async (error, config) => {
  config._retryCount = Number(config._retryCount || 0) + 1;
  await wait(getRetryDelay(error, config._retryCount));
  return api.request(config);
};

const refreshSecurityContext = async () => {
  if (!csrfRefreshPromise) {
    const originalUserId = useAuthStore.getState().user?.id;
    const pending = api.get('/auth/session', {
      skipAuthRedirect: true,
      skipPortalContext: true,
      skipCsrf: true,
      skipRetry: true,
      _csrfRefreshRequest: true,
    }).then((response) => {
      const authState = useAuthStore.getState();
      // A late response must never log in a user who signed out while the
      // session check was in flight.
      if (!authState.authenticated || authState.user?.id !== originalUserId) return '';
      return authState.restoreSession(response.data?.data || {});
    }).finally(() => {
      if (csrfRefreshPromise === pending) csrfRefreshPromise = null;
    });
    csrfRefreshPromise = pending;
  }
  return csrfRefreshPromise;
};

/** Coalesced, non-destructive check: network errors do not log users out. */
export const syncAuthenticatedSession = async ({ maxAgeMs = 0 } = {}) => {
  const state = useAuthStore.getState();
  if (!state.authenticated) return false;
  if (!csrfRefreshPromise && state.lastSessionCheckAt && Date.now() - state.lastSessionCheckAt < maxAgeMs) {
    return true;
  }
  try {
    await refreshSecurityContext();
    return useAuthStore.getState().authenticated;
  } catch (error) {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    throw error;
  }
};

api.interceptors.request.use(
  async (config) => {
    const method = String(config.method || 'get').toLowerCase();
    const url = String(config.url || '');

    // After a long idle period, refresh the cookie and CSRF token BEFORE a
    // write. This is safe (it does not replay the user's submission).
    if (mutationMethods.has(method) && !url.startsWith('/auth/') && useAuthStore.getState().authenticated) {
      try {
        await syncAuthenticatedSession({ maxAgeMs: MUTATION_SESSION_CHECK_MAX_AGE_MS });
      } catch (error) {
        if (error.response?.status === 401) return Promise.reject(error);
        // On a temporary network failure, let the requested operation reach
        // its normal error handler rather than destroying the user's session.
      }
    }

    const authState = useAuthStore.getState();
    config.headers['X-App-Locale'] = requestHeaderLocale(useLocaleStore.getState().locale);
    const csrfToken = authState.csrfToken;

    // The current user's context is never inherited by a different signed-in user.
    // The browser proposes the selected company; PHP verifies it on every request.
    if (authState.user?.id) usePortalContextStore.getState().ensureOwner(authState.user.id, authState.user.role);
    if (
      ['super_admin', 'admin'].includes(authState.user?.role)
      && !config.skipPortalContext
      && !url.startsWith('/auth/')
      && !url.startsWith('/companies/list')
      && !url.startsWith('/users/my-accessible-companies')
    ) {
      const viewCompanyId = usePortalContextStore.getState().viewCompanyId;
      if (viewCompanyId) {
        config.params = { ...(config.params || {}), view_company_id: viewCompanyId };
        config._requestedViewCompanyId = String(viewCompanyId);
      }
    }

    if (mutationMethods.has(method) && csrfToken && !config.skipCsrf) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    if (mutationMethods.has(method) && idempotentSubmissionRoutes.has(url.split('?')[0])) {
      config.headers['X-Idempotency-Key'] ||= getSubmissionKey(method, url, config, authState.user?.id);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  localizeApiResponse,
  async (error) => {
    const status = error.response?.status;
    const config = error.config || {};
    const method = String(config.method || 'get').toLowerCase();
    releaseSubmissionKey(config, status);

    // An out-of-scope record can also return 403. Check current grants before
    // resetting View Context, so a normal permission refusal does not switch
    // the administrator away from an otherwise authorized company.
    if (isGrantRevocationError(error) && config._requestedViewCompanyId
        && !config.skipCompanyRecovery && useAuthStore.getState().user?.role === 'admin') {
      const selectedId = String(config._requestedViewCompanyId);
      if (!companyRevalidationPromise) {
        companyRevalidationPromise = api.get('/users/my-accessible-companies', {
          skipPortalContext: true, skipCompanyRecovery: true, skipRetry: true,
        }).then((response) => {
          const user = useAuthStore.getState().user;
          if (user?.role !== 'admin') return;
          const current = usePortalContextStore.getState();
          if (current.viewCompanyId !== selectedId) return;
          const stillAllowed = current.setAccessibleCompanies(response.data?.data, user);
          if (!stillAllowed) {
            window.sessionStorage.setItem('appraisal-company-access-notice', 'company:access_lost');
            window.location.assign('/dashboard');
          }
        }).catch(() => {
          // Network failures must not be mistaken for a revoked grant.
        }).finally(() => { companyRevalidationPromise = null; });
      }
      await companyRevalidationPromise;
    }

    if (
      status === 419
      && mutationMethods.has(method)
      && !config._csrfRetry
      && !config._csrfRefreshRequest
    ) {
      config._csrfRetry = true;

      try {
        const csrfToken = await refreshSecurityContext();
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
        return api.request(config);
      } catch (refreshError) {
        if (refreshError.response?.status === 401) {
          useAuthStore.getState().clearSession();
        }

        return Promise.reject(refreshError);
      }
    }

    // Authentication/authorization and validation-style responses are deliberate
    // application responses, so retrying them would only delay useful feedback.
    if (status === 401 && !config.skipAuthRedirect) {
      useAuthStore.getState().clearSession();
    }

    if (status === 428 && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      const { user, updateUser } = useAuthStore.getState();
      if (user) updateUser({ must_change_password: 1 });
      if (window.location.pathname !== '/change-password') {
        window.location.assign('/change-password');
      }
    }

    if (shouldRetryRequest(error, config)) {
      return retryRequest(error, config);
    }

    return Promise.reject(localizeApiError(error));
  }
);

export default api;
