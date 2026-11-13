import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { createPortal } from 'react-dom';
import { Check, ClipboardCopy, CircleAlert, Lightbulb, Sparkles, X } from 'lucide-react';
import useThemeStore from '../../stores/useThemeStore';
import { generateAiSetupGuide, getAiSetupGuideStatus } from '../../services/aiAssistant';
import './AiSetupGuide.css';

const TITLES = {
  cycle: 'setup_cycle', section: 'setup_section',
  kpi: 'setup_kpi', general: 'setup_general',
};
const errorText = (error) => error?.response?.data?.message || error?.message || i18n.t('setup_error', { ns: 'ai' });

// No DB mutations: the user manually reviews and enters any suggestions.
export default function AiSetupGuide({ context, onClose }) {
  const { t, i18n: languageContext } = useTranslation('ai');
  const theme = useThemeStore((state) => state.theme);
  const [intent, setIntent] = useState('');
  const [constraints, setConstraints] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const requestEpoch = useRef(0);

  useEffect(() => {
    requestEpoch.current += 1;
    setBusy(false);
    setError('');
    // Preserve every field and any user-edited draft on language switches.
  }, [languageContext.language]);
  const firstField = useRef(null);
  useEffect(() => {
    firstField.current?.focus();
    let active = true;
    getAiSetupGuideStatus().then((data) => {
      if (active) setAvailable(!!data?.availability?.enabled && data?.contexts?.includes(context));
    }).catch((err) => { if (active) { setAvailable(false); setError(errorText(err)); } });
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { active = false; requestEpoch.current += 1; document.removeEventListener('keydown', escape); };
  }, [context, onClose]);

  const generate = async (event) => {
    event.preventDefault();
    if (busy || !available || intent.trim().length < 30) return;
    const epoch = ++requestEpoch.current;
    setBusy(true); setError(''); setSuggestion(''); setCopied(false);
    try {
      const result = await generateAiSetupGuide({ context, intent, constraints });
      if (epoch === requestEpoch.current) setSuggestion(result?.suggestion || '');
    } catch (err) {
      if (epoch === requestEpoch.current) setError(errorText(err));
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(suggestion); setCopied(true); }
    catch { setError(t('setup_clipboard_error')); }
  };
  return createPortal(
    <div className="asg-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className={`asg-modal ${theme === 'dark' ? 'asg-modal--dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="asg-heading">
        <header className="asg-header">
          <span className="asg-logo"><Lightbulb size={22}/></span>
          <div><span className="asg-eyebrow">{t('setup_eyebrow')}</span><h2 id="asg-heading">{t('setup_plan_title', { context: t(TITLES[context] || 'setup_cycle') })}</h2><p>{t('setup_description')}</p></div>
          <button type="button" className="asg-close" aria-label={t('setup_close_aria')} onClick={onClose} disabled={busy}><X size={18}/></button>
        </header>
        <form className="asg-form" onSubmit={generate}>
          <div className="asg-body">
            <div className="asg-advice"><Sparkles size={17}/> {t('setup_advice')}</div>
            {available === false && <div className="asg-error"><CircleAlert size={16}/> {t('setup_unavailable')}</div>}
            <label className="asg-field"><span>{t('setup_intent')} <em>{t('setup_required')}</em></span><textarea ref={firstField} rows={4} minLength={30} maxLength={1500} required value={intent} onChange={(event) => setIntent(event.target.value)} placeholder={t('setup_intent_hint')}/></label>
            <label className="asg-field"><span>{t('setup_constraints')} <small>{t('setup_optional')}</small></span><textarea rows={3} maxLength={1500} value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder={t('setup_constraints_hint')}/></label>
            {error && <div className="asg-error" role="alert"><CircleAlert size={16}/>{error}</div>}
            {suggestion && <div className="asg-result" aria-live="polite"><span className="asg-eyebrow">{t('setup_result')}</span><pre>{suggestion}</pre><button type="button" className="asg-copy" onClick={copy}>{copied ? <Check size={15}/> : <ClipboardCopy size={15}/>} {t(copied ? 'setup_copied' : 'setup_copy')}</button></div>}
          </div>
          <footer className="asg-footer"><button type="button" className="asg-secondary" disabled={busy} onClick={onClose}>{t('setup_close')}</button><button type="submit" className="asg-primary" disabled={busy || available !== true || intent.trim().length < 30}><Sparkles size={16}/>{t(busy ? 'setup_generating' : suggestion ? 'setup_regenerate' : 'setup_generate')}</button></footer>
        </form>
      </section>
    </div>, document.body
  );
}
