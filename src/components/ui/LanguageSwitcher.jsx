import React, { useId } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleStore from '../../stores/useLocaleStore';
import { PSEUDO_LOCALE_ENABLED } from '../../utils/localeRules';
import './LanguageSwitcher.css';

/** Accessible, shared language selector. No navigation/reload and no form reset. */
const LanguageSwitcher = ({ placement = 'menu', hint = '' }) => {
  const hintId = useId();
  const { t } = useTranslation('common');
  const locale = useLocaleStore((state) => state.locale);
  const changing = useLocaleStore((state) => state.changing);
  const error = useLocaleStore((state) => state.error);
  const change = useLocaleStore((state) => state.setLocale);
  const options = [
    { value: 'en', label: t('english') },
    { value: 'fr', label: t('french') },
  ];
  if (PSEUDO_LOCALE_ENABLED) options.push({ value: 'en-XA', label: t('pseudo') });

  return (
    <div className={`ap-language ap-language--${placement}`} title={hint || undefined}>
      <div className="ap-language__caption"><Languages size={15} aria-hidden="true" /><span>{t('language')}</span></div>
      <div className="ap-language__choices" role="group" aria-label={t('changeLanguage')} aria-describedby={hint ? hintId : undefined}>
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`ap-language__option ${locale === item.value ? 'ap-language__option--current' : ''}`}
            onClick={() => { void change(item.value); }}
            aria-pressed={locale === item.value}
            aria-busy={changing}
          >{item.label}</button>
        ))}
      </div>
      <span className="ap-language__sr-only" role="status">{changing ? t('languageLoading') : ''}</span>
      {hint && <span id={hintId} className="ap-language__sr-only">{hint}</span>}
      {error && <small className="ap-language__error" role="alert">{t('languageSaveFailed')}</small>}
    </div>
  );
};

export default LanguageSwitcher;
