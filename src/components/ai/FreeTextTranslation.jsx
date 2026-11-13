import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { translateAppraisalFreeText } from '../../services/aiAssistant';
import './FreeTextTranslation.css';

/**
 * Renders the original, unmodified author text by default. Translation is
 * strictly opt-in. No HTML insertion; stale requests cannot replace text
 * after an appraisal or language change.
 */
export default function FreeTextTranslation({ text, appraisalId, field, recordId = 0, enabled = false }) {
  const { t, i18n } = useTranslation('appraisals');
  const locale = i18n.resolvedLanguage === 'fr' ? 'fr' : 'en';
  const [translation, setTranslation] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setTranslation('');
    setShowTranslation(false);
    setBusy(false);
    setError('');
    return () => { generation.current += 1; };
  }, [text, appraisalId, field, recordId, locale]);

  if (typeof text !== 'string' || !text.trim()) return null;
  const canTranslate = enabled && Number(appraisalId) > 0 && Boolean(field)
    && (recordId === 0 || Number(recordId) > 0);

  const toggle = async () => {
    if (translation) {
      setShowTranslation((previous) => !previous);
      return;
    }
    const mine = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = await translateAppraisalFreeText({
        appraisalId, field, recordId, locale,
      });
      if (generation.current !== mine) return;
      if (!result?.translated_text || result.target_locale !== locale) throw new Error(t('view.translation.failed'));
      setTranslation(result.translated_text);
      setShowTranslation(true);
    } catch (errorResponse) {
      if (generation.current === mine) {
        const status = errorResponse?.response?.status;
        setError(t(status === 403 ? 'view.translation.notAllowed'
          : status === 429 ? 'view.translation.limited'
            : status === 503 ? 'view.translation.unavailable' : 'view.translation.failed'));
      }
    } finally {
      if (generation.current === mine) setBusy(false);
    }
  };

  return (
    <span className="apr-free-text-translation">
      <span className="apr-free-text-translation__content">{showTranslation ? translation : text}</span>
      {canTranslate && (
        <span className="apr-free-text-translation__controls">
          <button type="button" className="apr-free-text-translation__toggle" onClick={toggle} disabled={busy}
            aria-label={t(showTranslation ? 'view.translation.showOriginal' : 'view.translation.translateTo', {
              language: t(locale === 'fr' ? 'view.translation.french' : 'view.translation.english'),
            })}>
            <Languages size={13} aria-hidden="true" />
            {t(busy ? 'view.translation.working' : showTranslation ? 'view.translation.showOriginal' :
              'view.translation.translateTo', {
              language: t(locale === 'fr' ? 'view.translation.french' : 'view.translation.english'),
            })}
          </button>
          {showTranslation && <span className="apr-free-text-translation__machine">{t('view.translation.machine')}</span>}
          {error && <span className="apr-free-text-translation__error" role="alert">{error}</span>}
        </span>
      )}
    </span>
  );
}
