// Kept independent of React and i18next for predictable preference tests.
// Versioned because earlier releases also wrote the last signed-in user's
// language to the old key. That legacy value must never count as a new choice.
export const ANONYMOUS_LOCALE_KEY = 'appraisalsuite:pending-login-language';
export const LEGACY_ANONYMOUS_LOCALE_KEY = 'appraisalsuite:prelogin-locale';

/**
 * Developer-only test language ("Pseudo-langue (test)"). Hidden from everyone by default,
 * including on the development server. To use it, add VITE_PSEUDO_LOCALE=true to a local
 * .env.local file and restart `npm run dev`. It can never appear in a production build.
 */
export const PSEUDO_LOCALE_ENABLED = Boolean(import.meta.env?.DEV) && import.meta.env?.VITE_PSEUDO_LOCALE === 'true';
export const SUPPORTED_LOCALES = Object.freeze(['en', 'fr']);

export function normalizeLocale(value, allowPseudo = false) {
  if (typeof value !== 'string') return null;
  const locale = value.trim().toLowerCase();
  if (allowPseudo && locale === 'en-xa') return 'en-XA';
  return SUPPORTED_LOCALES.includes(locale) ? locale : null;
}

export function resolveAccountLocale(user = {}) {
  return normalizeLocale(user.preferred_locale)
    || normalizeLocale(user.default_locale)
    || normalizeLocale(user.effective_locale)
    || 'en';
}

export function initialAnonymousLocale(storageValue, allowPseudo = false) {
  return normalizeLocale(storageValue, allowPseudo) || 'en';
}

export function requestHeaderLocale(locale) {
  return locale === 'fr' ? 'fr' : 'en';
}

/** Only an explicit account preference suppresses the one-time language step. */
export function needsLanguageChoice(user) {
  return Boolean(user?.id) && !normalizeLocale(user.preferred_locale);
}

/** A pending choice is valid only when the person selected EN or FR on sign-in. */
export function pendingLoginChoice(pending, locale) {
  return pending ? normalizeLocale(locale) : null;
}

/** Once an account signs out, its language must not leak to the next user. */
export function initialLocaleAfterSignOut() {
  return 'en';
}
