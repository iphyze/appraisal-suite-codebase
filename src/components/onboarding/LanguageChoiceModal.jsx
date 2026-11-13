import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Languages, X } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useLocaleStore from '../../stores/useLocaleStore';
import useThemeStore from '../../stores/useThemeStore';
import { resolveAccountLocale } from '../../utils/localeRules';
import './LanguageChoiceModal.css';

/** Account-scoped one-time step, presented before protected page content mounts. */
const LanguageChoiceModal = () => {
  const { t } = useTranslation(['auth', 'common']);
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const saveLocale = useLocaleStore((state) => state.setLocale);
  const error = useLocaleStore((state) => state.error);
  const [selected, setSelected] = useState(() => resolveAccountLocale(user));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dialogRef = useRef(null);
  const saveRef = useRef(null);

  const saveSelection = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    // forceSave persists the company default even when already displayed.
    const saved = await saveLocale(selected, { forceSave: true });
    if (!saved) {
      savingRef.current = false;
      setSaving(false);
    }
    // On success, useAuthStore.updateUser sets preferred_locale and this
    // route immediately replaces the dialog with the requested page.
  };
  saveRef.current = saveSelection;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('input:checked')?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        void saveRef.current?.();
      } else if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )].filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className={`ap-locale-gate theme-${theme}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void saveSelection();
      }}
    >
      <section
        className="ap-locale-dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-locale-title"
        aria-describedby="ap-locale-description"
      >
        <header className="ap-locale-dialog__head">
          <span className="ap-locale-dialog__icon"><Languages size={23} aria-hidden="true" /></span>
          <div className="ap-locale-dialog__heading">
            <p className="ap-locale-dialog__eyebrow">{t('auth:choose_language_eyebrow')}</p>
            <h1 id="ap-locale-title">{t('auth:choose_language_title')}</h1>
          </div>
          <button
            type="button"
            className="ap-locale-dialog__close"
            onClick={() => { void saveSelection(); }}
            disabled={saving}
            aria-label={t('auth:close_language_dialog')}
          ><X size={18} /></button>
        </header>

        <div className="ap-locale-dialog__body">
          <p id="ap-locale-description" className="ap-locale-dialog__description">
            {t('auth:choose_language_description')}
          </p>
          <fieldset className="ap-locale-dialog__options" disabled={saving}>
            <legend className="ap-locale-dialog__sr-only">{t('auth:choose_language_options')}</legend>
            {['en', 'fr'].map((locale) => (
              <label
                className={`ap-locale-dialog__option ${selected === locale ? 'ap-locale-dialog__option--selected' : ''}`}
                key={locale}
              >
                <input
                  type="radio"
                  name="preferred_language"
                  value={locale}
                  checked={selected === locale}
                  onChange={() => setSelected(locale)}
                />
                <span className="ap-locale-dialog__language" lang={locale}>
                  {t(locale === 'en' ? 'common:english' : 'common:french')}
                </span>
                <span className="ap-locale-dialog__check" aria-hidden="true">
                  {selected === locale && <Check size={17} />}
                </span>
              </label>
            ))}
          </fieldset>
          {error && <p role="alert" className="ap-locale-dialog__error">{t('common:languageSaveFailed')}</p>}
        </div>

        <footer className="ap-locale-dialog__footer">
          <button type="button" className="ap-locale-dialog__continue" disabled={saving} onClick={() => { void saveSelection(); }}>
            {saving ? <><span className="ap-locale-dialog__spinner" /> {t('auth:saving_language')}</> :
              <>{t('auth:continue')} <ArrowRight size={17} /></>}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default LanguageChoiceModal;
