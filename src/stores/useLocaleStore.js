import { create } from 'zustand';
import { applyAppLanguage, ensureFrenchCatalogues } from '../i18n';
// These two also import this store. That circular import is safe: every use on
// either side happens inside functions at run time, never while modules load.
import useAuthStore from './useAuthStore';
import api from '../services/api';
import {
  ANONYMOUS_LOCALE_KEY, LEGACY_ANONYMOUS_LOCALE_KEY, initialAnonymousLocale, PSEUDO_LOCALE_ENABLED,
  normalizeLocale, resolveAccountLocale, requestHeaderLocale,
  pendingLoginChoice, initialLocaleAfterSignOut,
} from '../utils/localeRules';

// The developer test language is only honoured when explicitly enabled.
const development = PSEUDO_LOCALE_ENABLED;
const savedAnonymousChoice = () => (
  typeof window === 'undefined' ? null : window.localStorage.getItem(ANONYMOUS_LOCALE_KEY)
);
const readAnonymous = () => initialAnonymousLocale(savedAnonymousChoice(), development);

// Serialized writes ensure rapid EN / FR / EN changes are persisted in order.
let saveQueue = Promise.resolve();
let changeCounter = 0;

const useLocaleStore = create((set, get) => ({
  locale: readAnonymous(),
  activeUserId: null,
  anonymousSelectionPending: Boolean(normalizeLocale(savedAnonymousChoice())),
  transferringLoginChoice: false,
  changing: false,
  error: null,

  init: () => applyAppLanguage(get().locale),

  onAuthenticated: (user) => {
    if (!user?.id) return;
    const userId = String(user.id);
    if (get().activeUserId === userId) return;

    const choice = pendingLoginChoice(get().anonymousSelectionPending, get().locale);
    // Consume the pre-login choice exactly once. Never retain it in browser storage
    // once a session exists: this prevents it from applying to the next account.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ANONYMOUS_LOCALE_KEY);
      window.localStorage.removeItem(LEGACY_ANONYMOUS_LOCALE_KEY);
    }
    set({ activeUserId: userId, anonymousSelectionPending: false,
      transferringLoginChoice: Boolean(choice), error: null });
    if (choice) {
      // Saving can finish after route navigation; the protected route waits for
      // it before deciding whether the one-time dialog is needed.
      void get().setLocale(choice, { forceSave: true }).finally(() => {
        if (get().activeUserId === userId) set({ transferringLoginChoice: false });
      });
      return;
    }

    const accountLocale = resolveAccountLocale(user);
    changeCounter += 1;
    set({ locale: accountLocale, changing: false, error: null });
    void applyAppLanguage(accountLocale).catch((error) => {
      console.error('Could not load language resources:', error);
    });
  },

  onSignedOut: ({ preserveAnonymousChoice = false } = {}) => {
    // An initial /auth/session 401 does not constitute a sign-out: a language
    // selected on the login screen should survive a refresh until sign-in.
    if (preserveAnonymousChoice && get().activeUserId === null) return;
    changeCounter += 1;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ANONYMOUS_LOCALE_KEY);
      window.localStorage.removeItem(LEGACY_ANONYMOUS_LOCALE_KEY);
    }
    const locale = initialLocaleAfterSignOut();
    set({ locale, activeUserId: null, anonymousSelectionPending: false,
      transferringLoginChoice: false, changing: false, error: null });
    void applyAppLanguage(locale).catch((error) => {
      console.error('Could not reset language resources:', error);
    });
  },

  setLocale: async (requested, { forceSave = false } = {}) => {
    const next = normalizeLocale(requested, development);
    if (!next) return false;
    const previous = get().locale;
    const auth = useAuthStore.getState();
    const signedIn = Boolean(auth.authenticated && auth.user?.id);
    // Clicking the already-displayed company default is still an explicit
    // choice when preferred_locale is NULL. Likewise EN on the login page must
    // count as a choice even if EN was the initial anonymous display.
    const choiceNotRecorded = signedIn
      ? !normalizeLocale(auth.user?.preferred_locale)
      : !get().anonymousSelectionPending;
    if (previous === next && !forceSave && !choiceNotRecorded) return true;

    const revision = ++changeCounter;
    const targetUserId = signedIn ? String(auth.user.id) : null;
    set({ locale: next, changing: true, error: null,
      anonymousSelectionPending: !signedIn && next !== 'en-XA' });

    if (!signedIn && typeof window !== 'undefined') {
      if (next === 'en-XA') {
        // The development pseudo-language is never an account preference.
        window.localStorage.removeItem(ANONYMOUS_LOCALE_KEY);
      } else {
        window.localStorage.setItem(ANONYMOUS_LOCALE_KEY, requestHeaderLocale(next));
      }
    }

    try {
      if (next === 'fr') {
        // Load first; an intervening switch can supersede this one.
        await ensureFrenchCatalogues();
      }
      if (revision === changeCounter) await applyAppLanguage(next);
      if (signedIn && next !== 'en-XA') {
        // Do not bypass the existing cookie, CSRF, or retry rules.
        const work = saveQueue.catch(() => {}).then(async () => {
          if (useAuthStore.getState().user?.id?.toString() !== targetUserId) return;
          await api.put('/users/preferred-locale', { locale: next });
        });
        saveQueue = work;
        await work;
        if (useAuthStore.getState().user?.id?.toString() === targetUserId) {
          useAuthStore.getState().updateUser({ preferred_locale: next, effective_locale: next });
        }
      }
      if (revision === changeCounter) set({ changing: false, error: null });
      return true;
    } catch (error) {
      if (revision === changeCounter) {
        set({ locale: previous, changing: false, error: 'common:languageSaveFailed' });
        await applyAppLanguage(previous).catch(() => {});
      }
      console.error('Language change failed:', error);
      return false;
    }
  },
}));

export default useLocaleStore;
