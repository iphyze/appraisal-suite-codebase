import i18n from '../i18n';
import englishApi from '../locales/en/api.json';

const VALID_KEY = /^[a-z][A-Za-z0-9_.]{1,99}$/;

/**
 * Server messages stay English for backwards-compatible clients and logs.
 * If a known key is included, display it in the reader's current language.
 * This is applied at the API boundary so all existing toasts/forms benefit.
 */
export const localizeApiMessage = (data, locale = i18n.language) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  // Keep the English interface and existing form messages byte-for-byte unchanged.
  if (locale === 'en') return data;
  const key = data.message_key;
  if (typeof key !== 'string' || !VALID_KEY.test(key) || typeof data.message !== 'string') return data;

  const raw = data.message_params;
  const params = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [name, value] of Object.entries(raw)) {
      if (!/^[a-z][a-z0-9_]{0,49}$/.test(name)) continue;
      if (typeof value === 'string' && value.length <= 256) params[name] = value;
      else if (typeof value === 'number' && Number.isFinite(value)) {
        // Leave `count` numeric for i18next's language-specific plurals.
        params[name] = name === 'count' || locale !== 'fr'
          ? value : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
      }
    }
  }
  // Plural keys (e.g. objective.min_one / _other) resolve from the base key.
  if (!Object.hasOwn(englishApi, key)
    && !(typeof params.count === 'number' && (Object.hasOwn(englishApi, `${key}_one`)
      || Object.hasOwn(englishApi, `${key}_other`)))) return data;
  const translated = i18n.t(key, {
    ns: 'api', keySeparator: false, lng: locale, ...params,
    defaultValue: data.message,
  });
  if (!translated || translated === key) return data;
  return { ...data, message_source: data.message, message: translated };
};

export const localizeApiResponse = (response) => {
  if (response?.data) {
    response.data = localizeApiMessage(response.data);
    if (response.data?.data?.message_key) {
      response.data.data = localizeApiMessage(response.data.data);
    }
  }
  return response;
};

export const localizeApiError = (error) => {
  if (error?.response?.data) error.response.data = localizeApiMessage(error.response.data);
  return error;
};
