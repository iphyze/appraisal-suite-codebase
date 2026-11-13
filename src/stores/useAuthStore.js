import { create } from 'zustand';
import { clearAllAppraisalDrafts } from '../utils/appraisalDraft';
import api from '../services/api';
import useLocaleStore from './useLocaleStore';
import usePortalContextStore from './usePortalContextStore';

/**
 * Authentication is session-cookie based.
 * The signed session token is issued by the API in an HttpOnly cookie and is
 * never persisted in, or exposed to, browser JavaScript/localStorage.
 */
const useAuthStore = create((set, get) => ({
  user: null,
  csrfToken: '',
  authenticated: false,
  checkingSession: false,
  sessionChecked: false,
  lastSessionCheckAt: 0,

  /**
   * Default sign in only needs email and password.
   * companyId is sent only after the API confirms that the email/password pair
   * belongs to more than one active workspace.
   */
  login: async (email, password, companyId = null) => {
    try {
      const payload = { email, password };

      if (companyId !== null && companyId !== undefined && companyId !== '') {
        payload.company_id = Number(companyId);
      }

      const response = await api.post('/auth/login', payload, {
        skipAuthRedirect: true,
        skipCsrf: true,
      });

      if (
        response.data?.status === 'SelectionRequired'
        && response.data?.code === 'COMPANY_SELECTION_REQUIRED'
      ) {
        return {
          success: false,
          requiresCompanySelection: true,
          companies: response.data?.data?.companies || [],
          preferredCompanyId: Number(response.data?.data?.preferred_company_id || 0),
          message: response.data?.message || 'Select a workspace to continue.',
        };
      }

      if (response.data?.status === 'Success') {
        const data = response.data?.data || {};
        const { csrf_token: csrfToken = '', ...userData } = data;

        set({
          user: userData,
          csrfToken,
          authenticated: true,
          sessionChecked: true,
          lastSessionCheckAt: Date.now(),
        });
        useLocaleStore.getState().onAuthenticated(userData);

        return { success: true, data: response.data };
      }

      return {
        success: false,
        error: response.data?.message || 'Invalid credentials.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  },

  init: async () => {
    if (get().checkingSession) return get().authenticated;

    set({ checkingSession: true });

    try {
      const response = await api.get('/auth/session', {
        skipAuthRedirect: true,
      });

      const data = response.data?.data || {};
      const { csrf_token: csrfToken = '', ...userData } = data;

      set({
        user: userData,
        csrfToken,
        authenticated: true,
        checkingSession: false,
        sessionChecked: true,
        lastSessionCheckAt: Date.now(),
      });
      useLocaleStore.getState().onAuthenticated(userData);

      return true;
    } catch (error) {
      const status = error.response?.status;

      set({
        user: null,
        csrfToken: '',
        authenticated: false,
        checkingSession: false,
        sessionChecked: true,
        lastSessionCheckAt: 0,
      });
      useLocaleStore.getState().onSignedOut({ preserveAnonymousChoice: true });

      if (status === 404) {
        console.error('The backend route /auth/session is missing or not registered.');
      }

      return false;
    }
  },

  logout: async () => {
    // Signing out on purpose removes this user's saved appraisal progress (shared computers).
    clearAllAppraisalDrafts(get().user?.id);
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      // Always clear browser state even if the server has already expired the cookie.
    } finally {
      set({ user: null, csrfToken: '', authenticated: false, sessionChecked: true, lastSessionCheckAt: 0 });
      useLocaleStore.getState().onSignedOut();
    }
  },

  clearSession: () => {
    set({ user: null, csrfToken: '', authenticated: false, sessionChecked: true, lastSessionCheckAt: 0 });
    useLocaleStore.getState().onSignedOut();
  },

  restoreSession: (sessionData = {}) => {
    const { csrf_token: csrfToken = '', ...userData } = sessionData || {};

    set({
      user: userData,
      csrfToken,
      authenticated: true,
      checkingSession: false,
      sessionChecked: true,
      lastSessionCheckAt: Date.now(),
    });
    useLocaleStore.getState().onAuthenticated(userData);

    return csrfToken;
  },

  /** A membership switch rotates both JWT and CSRF on the server. */
  switchWorkspace: async (targetUserId) => {
    const previous = get().user;
    const userId = Number(targetUserId);
    if (!previous?.identity_id || !Number.isSafeInteger(userId)
        || userId <= 0 || userId === Number(previous.id)) {
      return { success: false };
    }

    const adoptWorkspace = (data) => {
      if (Number(get().user?.id) !== Number(previous.id)
          || Number(data?.id) !== userId
          || Number(data?.identity_id) !== Number(previous.identity_id)
          || !data?.csrf_token) return false;
      // Do NOT clear appraisal drafts: they are keyed by membership id.
      // This is distinct from Company Access's temporary View Context.
      usePortalContextStore.getState().resetForWorkspace(userId);
      get().restoreSession(data);
      return true;
    };

    try {
      const response = await api.post('/auth/switch-workspace', { user_id: userId }, {
        skipPortalContext: true,
        skipRetry: true,
      });
      if (response.data?.status !== 'Success') return { success: false };
      return { success: adoptWorkspace(response.data?.data) };
    } catch (error) {
      // The server may have set the new HttpOnly cookie, but the response was
      // lost in transit. Probe the REAL server session before keeping an old
      // member's context visible with a new member's cookie.
      if (!error.response || Number(error.response.status) >= 500) {
        try {
          const probe = await api.get('/auth/session', {
            skipAuthRedirect: true, skipPortalContext: true, skipRetry: true,
          });
          if (probe.data?.status === 'Success' && adoptWorkspace(probe.data?.data)) {
            return { success: true };
          }
        } catch (_) { /* Keep the original switch failure. */ }
      }
      return { success: false, error: error.response?.data?.message };
    }
  },

  changePassword: async ({ current_password, new_password, confirm_password }) => {
    try {
      const response = await api.put('/auth/change-password', {
        current_password,
        new_password,
        confirm_password,
      });

      if (response.data?.status === 'Success') {
        const data = response.data?.data || {};
        const { csrf_token: csrfToken = get().csrfToken, ...updatedUser } = data;

        set((state) => ({
          csrfToken,
          authenticated: true,
          user: { ...state.user, ...updatedUser, must_change_password: 0 },
        }));

        return { success: true, data: response.data };
      }

      return {
        success: false,
        error: response.data?.message || 'Password update failed.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Password update failed. Please try again.',
      };
    }
  },

  isAuthenticated: () => get().authenticated === true,

  hasRole: (roles) => {
    const role = get().user?.role;
    const allowed = Array.isArray(roles) ? roles : [roles];
    return Boolean(role) && allowed.includes(role);
  },

  updateUser: (updatedFields) => set((state) => ({
    user: { ...state.user, ...updatedFields },
  })),
}));

export default useAuthStore;
