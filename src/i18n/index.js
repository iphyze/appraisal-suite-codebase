import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { ANONYMOUS_LOCALE_KEY, PSEUDO_LOCALE_ENABLED } from '../utils/localeRules';
import { pseudoLocalize } from './pseudo';
import enCommon from '../locales/en/common.json';
import enNav from '../locales/en/nav.json';
import enAuth from '../locales/en/auth.json';
import enAppraisals from '../locales/en/appraisals.json';
import enObjectives from '../locales/en/objectives.json';
import enDashboard from '../locales/en/dashboard.json';
import enUsers from '../locales/en/users.json';
import enCycles from '../locales/en/cycles.json';
import enQuestions from '../locales/en/questions.json';
import enAnalytics from '../locales/en/analytics.json';
import enAi from '../locales/en/ai.json';
import enMail from '../locales/en/mail.json';
import enSettings from '../locales/en/settings.json';
import enCompany from '../locales/en/company.json';
import enApi from '../locales/en/api.json';

const english = {
  common: enCommon, nav: enNav, auth: enAuth, appraisals: enAppraisals,
  objectives: enObjectives, dashboard: enDashboard, users: enUsers,
  cycles: enCycles, questions: enQuestions, analytics: enAnalytics,
  ai: enAi, mail: enMail, settings: enSettings, company: enCompany, api: enApi,
};

export const namespaces = Object.keys(english);
const frenchCatalogues = import.meta.glob('../locales/fr/*.json');
let frenchLoadPromise;

const pseudoProcessor = {
  type: 'postProcessor',
  name: 'appPseudo',
  process(value, key, options) {
    return (options.lng === 'en-XA' || i18next.language === 'en-XA')
      ? pseudoLocalize(value) : value;
  },
};

if (PSEUDO_LOCALE_ENABLED) i18next.use(pseudoProcessor);

i18next.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: english },
  // LanguageDetector reads the anonymous login-page preference; otherwise EN.
  fallbackLng: 'en',
  supportedLngs: PSEUDO_LOCALE_ENABLED ? ['en', 'fr', 'en-XA'] : ['en', 'fr'],
  nonExplicitSupportedLngs: false,
  ns: namespaces,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes interpolated text.
  react: { useSuspense: false },
  detection: { order: ['localStorage'], lookupLocalStorage: ANONYMOUS_LOCALE_KEY, caches: [] },
  initImmediate: false,
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: import.meta.env.DEV
    ? (lngs, ns, key) => console.warn(`[i18n] Missing ${lngs.join(',')}:${ns}:${key}`)
    : undefined,
  postProcess: PSEUDO_LOCALE_ENABLED ? ['appPseudo'] : [],
});

export async function ensureFrenchCatalogues() {
  if (!frenchLoadPromise) {
    frenchLoadPromise = Promise.all(namespaces.map(async (namespace) => {
      const path = `../locales/fr/${namespace}.json`;
      const load = frenchCatalogues[path];
      if (!load) throw new Error(`Missing French catalogue ${path}`);
      const module = await load();
      return [namespace, module.default];
    })).then((bundles) => {
      bundles.forEach(([namespace, resources]) => {
        i18next.addResourceBundle('fr', namespace, resources, true, true);
      });
    }).catch((error) => {
      frenchLoadPromise = null;
      throw error;
    });
  }
  return frenchLoadPromise;
}

export async function applyAppLanguage(locale) {
  if (locale === 'fr') await ensureFrenchCatalogues();
  await i18next.changeLanguage(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'fr' ? 'fr' : 'en';
  }
}

export default i18next;
