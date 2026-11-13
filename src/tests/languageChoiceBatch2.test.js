import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ANONYMOUS_LOCALE_KEY, LEGACY_ANONYMOUS_LOCALE_KEY,
  initialLocaleAfterSignOut,
  needsLanguageChoice,
  pendingLoginChoice,
  resolveAccountLocale,
} from '../utils/localeRules.js';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('a NULL preference prompts once; saved preferences never prompt again on any device', () => {
  const user = { id: 51, preferred_locale: null, default_locale: 'fr', effective_locale: 'fr' };
  assert.equal(resolveAccountLocale(user), 'fr'); // LEM CIV company default
  assert.equal(needsLanguageChoice(user), true);
  assert.equal(needsLanguageChoice({ ...user, preferred_locale: 'en' }), false);
  assert.equal(needsLanguageChoice({ ...user, preferred_locale: 'fr' }), false);
  assert.equal(needsLanguageChoice({ ...user, preferred_locale: 'fr' }), false); // new session
  assert.equal(needsLanguageChoice({ id: 31, preferred_locale: null, default_locale: 'en' }), true);
  assert.equal(needsLanguageChoice(null), false);
});

test('an explicit sign-in choice transfers once, then sign-out resets for another user', () => {
  assert.equal(pendingLoginChoice(true, 'fr'), 'fr');
  assert.equal(pendingLoginChoice(true, 'en'), 'en');
  assert.equal(pendingLoginChoice(false, 'fr'), null);
  assert.equal(pendingLoginChoice(true, 'en-XA'), null);
  assert.equal(initialLocaleAfterSignOut(), 'en');
  assert.notEqual(ANONYMOUS_LOCALE_KEY, LEGACY_ANONYMOUS_LOCALE_KEY);
  assert.equal(LEGACY_ANONYMOUS_LOCALE_KEY, 'appraisalsuite:prelogin-locale');
  const store = source('../stores/useLocaleStore.js');
  assert.match(store, /localStorage\.removeItem\(ANONYMOUS_LOCALE_KEY\)/);
  assert.match(store, /localStorage\.removeItem\(LEGACY_ANONYMOUS_LOCALE_KEY\)/);
  assert.match(store, /transferringLoginChoice: Boolean\(choice\)/);
  assert.match(store, /setLocale\(choice, \{ forceSave: true \}\)/);
  assert.match(store, /get\(\)\.activeUserId === userId/);
  assert.match(store, /preserveAnonymousChoice && get\(\)\.activeUserId === null/);
  assert.match(store, /initialLocaleAfterSignOut\(\)/);
  const authStore = source('../stores/useAuthStore.js');
  assert.match(authStore, /onSignedOut\(\{ preserveAnonymousChoice: true \}\)/);
  assert.match(authStore, /onAuthenticated\(userData\)/);
});

test('the protected route saves first, skips the modal for a forced password change', () => {
  const route = source('../components/ProtectedRoute.jsx');
  assert.ok(route.indexOf('needsPasswordUpdate(user)') < route.indexOf('needsLanguageChoice(user)'));
  assert.match(route, /location\.pathname !== '\/change-password' && needsLanguageChoice\(user\)/);
  assert.match(route, /if \(transferringLoginChoice\)/);
  assert.match(route, /<LanguageChoiceModal \/>/);
  const passwordPage = source('../pages/auth/ChangePassword.jsx');
  assert.match(passwordPage, /<LanguageSwitcher placement="password" \/>/);
  assert.match(passwordPage, /await changePassword\(form\)/);
  const phpRouter = source('../../../backend/index.php');
  const gate = phpRouter.split('$passwordGateExempt = [')[1].split('];')[0];
  const csrf = phpRouter.split('$csrfExemptRoutes = [')[1].split('];')[0];
  assert.match(gate, /'\/users\/preferred-locale'/);
  assert.doesNotMatch(csrf, /'\/users\/preferred-locale'/); // still protected by CSRF
  const phpPassword = source('../../../backend/routes/auth/ChangePassword.php');
  for (const col of ['u.preferred_locale', 'c.default_locale', "'effective_locale'"]) {
    assert.ok(phpPassword.includes(col), col);
  }
});

test('Continue, closing and Escape all persist the preselected choice; focus is trapped', () => {
  const dialog = source('../components/onboarding/LanguageChoiceModal.jsx');
  assert.match(dialog, /useState\(\(\) => resolveAccountLocale\(user\)\)/);
  assert.match(dialog, /saveLocale\(selected, \{ forceSave: true \}\)/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /event\.key === 'Tab'/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /type="radio"/);
  assert.match(dialog, /onClick=\{\(\) => \{ void saveSelection\(\); \}\}/);
  assert.match(dialog, /\!saved/); // failures keep dialog open for retry
});

test('login copy exists and English/French namespaces have identical keys', () => {
  const login = source('../pages/auth/Login.jsx');
  // The hint is passed to the switcher (tooltip + screen-reader description) instead of a separate line.
  assert.match(login, /<LanguageSwitcher placement="login" hint=\{t\('login_language_hint'\)\} \/>/);
  assert.match(login, /t\('login_language_hint'\)/);
  const enAuth = JSON.parse(source('../locales/en/auth.json'));
  const frAuth = JSON.parse(source('../locales/fr/auth.json'));
  for (const key of ['login_language_hint', 'choose_language_title', 'choose_language_description', 'saving_language']) {
    assert.ok(enAuth[key] && frAuth[key], key);
  }
  assert.deepEqual(Object.keys(enAuth).sort(), Object.keys(frAuth).sort());
});

// Exercise the real store's transitions without a browser or a backend; only
// replace its external imports (Zustand, i18n and HTTP), not its implementation.
async function loadLocaleStore({ selectedBeforeReload = null, loginUser = null, rejectSave = false } = {}) {
  const { runInNewContext } = await import('node:vm');
  const rules = await import('../utils/localeRules.js');
  const storage = new Map();
  if (selectedBeforeReload) storage.set(rules.ANONYMOUS_LOCALE_KEY, selectedBeforeReload);
  const calls = [];
  const applied = [];
  const auth = {
    authenticated: Boolean(loginUser),
    user: loginUser ? { ...loginUser } : null,
    updateUser(fields) { this.user = { ...this.user, ...fields }; },
  };
  const create = (init) => {
    let state;
    const set = (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
    state = init(set, () => state);
    return { getState: () => state };
  };
  const code = source('../stores/useLocaleStore.js')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export default useLocaleStore;', 'globalThis.loadedStore = useLocaleStore;');
  const context = {
    create, ...rules,
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key),
      },
    },
    applyAppLanguage: async (locale) => { applied.push(locale); },
    ensureFrenchCatalogues: async () => {},
    useAuthStore: { getState: () => auth },
    api: { put: async (path, payload) => {
      calls.push({ path, payload });
      if (rejectSave) throw new Error('Network failure');
    } },
    console: { error: () => {} },
  };
  runInNewContext(code, context, { filename: 'useLocaleStore.js' });
  return { store: context.loadedStore, auth, storage, calls, applied, rules };
}

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

test('live store: NULL preference is persisted from the company default and not requested next time', async () => {
  const user = { id: 1, preferred_locale: null, default_locale: 'fr' };
  const { store, auth, calls } = await loadLocaleStore({ loginUser: user });
  store.getState().onAuthenticated(user);
  assert.equal(store.getState().locale, 'fr');
  assert.equal(needsLanguageChoice(auth.user), true);
  assert.equal(await store.getState().setLocale('fr', { forceSave: true }), true);
  assert.equal(auth.user.preferred_locale, 'fr');
  assert.equal(needsLanguageChoice(auth.user), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/users/preferred-locale');
  assert.equal(calls[0].payload.locale, 'fr');
  auth.authenticated = false;
  auth.user = null;
  store.getState().onSignedOut();
  auth.user = { ...user, preferred_locale: 'fr' };
  auth.authenticated = true;
  store.getState().onAuthenticated(auth.user);
  assert.equal(needsLanguageChoice(auth.user), false);
  assert.equal(calls.length, 1); // already saved, no repeated PUT on next sign-in
});

test('live store: sign-in choice is consumed once; next user cannot inherit it', async () => {
  const { store, auth, storage, calls, rules } = await loadLocaleStore();
  await store.getState().setLocale('fr'); // login screen, before authentication
  assert.equal(store.getState().anonymousSelectionPending, true);
  assert.equal(storage.get(rules.ANONYMOUS_LOCALE_KEY), 'fr');
  const first = { id: 2, preferred_locale: null, default_locale: 'en' };
  auth.user = first;
  auth.authenticated = true;
  store.getState().onAuthenticated(first);
  assert.equal(store.getState().transferringLoginChoice, true);
  await settle();
  assert.equal(store.getState().transferringLoginChoice, false);
  assert.equal(auth.user.preferred_locale, 'fr');
  assert.equal(needsLanguageChoice(auth.user), false);
  assert.equal(storage.has(rules.ANONYMOUS_LOCALE_KEY), false);
  assert.equal(calls.length, 1);
  auth.authenticated = false;
  auth.user = null;
  store.getState().onSignedOut();
  assert.equal(store.getState().locale, 'en');
  assert.equal(store.getState().anonymousSelectionPending, false);
  const second = { id: 3, preferred_locale: 'en', default_locale: 'fr' };
  auth.authenticated = true;
  auth.user = second;
  store.getState().onAuthenticated(second);
  assert.equal(store.getState().locale, 'en');
  assert.equal(calls.length, 1);
});

test('live store: failed preference save leaves account NULL so the dialog can retry', async () => {
  const user = { id: 4, preferred_locale: null, default_locale: 'fr' };
  const { store, auth } = await loadLocaleStore({ loginUser: user, rejectSave: true });
  store.getState().onAuthenticated(user);
  assert.equal(await store.getState().setLocale('fr', { forceSave: true }), false);
  assert.equal(auth.user.preferred_locale, null);
  assert.equal(needsLanguageChoice(auth.user), true);
  assert.equal(store.getState().error, 'common:languageSaveFailed');
});

test('live store: a chosen login locale survives an initial unauthenticated session check', async () => {
  const { store, storage, rules } = await loadLocaleStore({ selectedBeforeReload: 'fr' });
  assert.equal(store.getState().locale, 'fr');
  assert.equal(store.getState().anonymousSelectionPending, true);
  store.getState().onSignedOut({ preserveAnonymousChoice: true }); // /auth/session 401
  assert.equal(store.getState().locale, 'fr');
  assert.equal(storage.get(rules.ANONYMOUS_LOCALE_KEY), 'fr');
});

test('live store: clicking already displayed English on login still counts as an explicit choice', async () => {
  const { store, storage, calls, auth, rules } = await loadLocaleStore();
  assert.equal(store.getState().locale, 'en');
  await store.getState().setLocale('en');
  assert.equal(store.getState().anonymousSelectionPending, true);
  assert.equal(storage.get(rules.ANONYMOUS_LOCALE_KEY), 'en');
  const user = { id: 11, preferred_locale: null, default_locale: 'fr' };
  auth.user = user;
  auth.authenticated = true;
  store.getState().onAuthenticated(user);
  await settle();
  assert.equal(auth.user.preferred_locale, 'en');
  assert.equal(calls.length, 1);
});

test('live store: clicking the current company default on the password form saves it explicitly', async () => {
  const user = { id: 12, preferred_locale: null, default_locale: 'fr', must_change_password: 1 };
  const { store, auth, calls } = await loadLocaleStore({ loginUser: user });
  store.getState().onAuthenticated(user);
  assert.equal(store.getState().locale, 'fr');
  assert.equal(await store.getState().setLocale('fr'), true); // normal LanguageSwitcher click
  assert.equal(auth.user.preferred_locale, 'fr');
  assert.equal(needsLanguageChoice(auth.user), false);
  assert.equal(calls.length, 1);
});

test('existing first-login appraisal guide waits until language selection is complete', () => {
  const guide = source('../components/onboarding/SupervisorAppraisalGuide.jsx');
  assert.match(guide, /if \(transferringLoginChoice \|\| needsLanguageChoice\(user\)\) return undefined/);
  assert.match(guide, /const timer = window\.setTimeout\(openGuide, 900\)/);
});
