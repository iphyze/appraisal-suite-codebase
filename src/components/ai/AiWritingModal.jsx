import { Trans, useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, Check, Sparkles, X } from 'lucide-react';
import { generateAiWritingDraft } from '../../services/aiAssistant';
import useThemeStore from '../../stores/useThemeStore';
import AppSelect from '../ui/AppSelect';
import './AiWritingModal.css';


/** AI never saves: applying only updates the owning React form field. */
export default function AiWritingModal({ purpose, currentText = '', onApply, onClose }) {
  const { t, i18n: languageContext } = useTranslation('appraisals');
  const labels = { rating_comment: t('writing.purposeRating'), section_comment: t('writing.purposeSection'), staff_feedback: t('writing.purposeStaff') };
  const errorText = (error) => error?.response?.data?.message || error?.message || t('writing.errorFallback');
  const theme = useThemeStore((state) => state.theme);
  const [thoughts, setThoughts] = useState('');
  const [evidence, setEvidence] = useState('');
  const [tone, setTone] = useState('professional');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const requestEpoch = useRef(0);

  useEffect(() => {
    requestEpoch.current += 1;
    setBusy(false);
    setError('');
    // Preserve every field and any user-edited draft on language switches.
  }, [languageContext.language]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { requestEpoch.current += 1; document.removeEventListener('keydown', onKeyDown); };
  }, [onClose]);

  const generate = async () => {
    if (busy || thoughts.trim().length < 15) return;
    const epoch = ++requestEpoch.current;
    setBusy(true);
    setError('');
    setDraft('');
    try {
      const result = await generateAiWritingDraft({ purpose, thoughts, evidence, tone, draft: currentText });
      if (epoch === requestEpoch.current) setDraft(result?.suggestion || '');
    } catch (err) {
      if (epoch === requestEpoch.current) setError(errorText(err));
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  };

  return createPortal(
    <div className="aw-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`aw-dialog ${theme === 'dark' ? 'aw-dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="aw-title">
        <header className="aw-heading">
          <span className="aw-icon"><Sparkles size={20} /></span>
          <div><span className="aw-kicker">{t('writing.kicker')}</span><h2 id="aw-title">{t('writing.improveTitle')}</h2><p>{labels[purpose] || t('writing.purposeDefault')}</p></div>
          <button type="button" className="aw-dismiss" onClick={onClose} aria-label={t('writing.closeAria')}><X size={18} /></button>
        </header>
        <div className="aw-body">
          <div className="aw-intro"><Trans ns="appraisals" i18nKey="writing.intro" components={{ strong: <strong /> }} /></div>
          <label className="aw-field"><span>{t('writing.question')} <em>{t('writing.required')}</em></span>
            <textarea ref={inputRef} rows={3} maxLength={2000} value={thoughts} onChange={(event) => setThoughts(event.target.value)} placeholder={purpose === 'staff_feedback' ? t('writing.staffFeedbackPlaceholder') : t('writing.thoughtsPlaceholder')} />
          </label>
          <label className="aw-field"><span>{t('writing.examples')} <small>{t('writing.optional')}</small></span>
            <textarea rows={2} maxLength={1500} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder={t('writing.evidencePlaceholder')} />
          </label>
          <div className="aw-field"><span>{t('writing.writingStyle')}</span>
            <AppSelect value={tone} onChange={setTone} clearable={false} options={[
              { value: 'professional', label: t('writing.professional') },
              { value: 'constructive', label: t('writing.constructive') },
              { value: 'empathetic', label: t('writing.empathetic') },
              { value: 'concise', label: t('writing.concise') },
            ]} />
          </div>
          {error && <p className="aw-error" role="alert"><CircleAlert size={15} />{error}</p>}
          {draft && <label className="aw-field aw-draft"><span>{t('writing.draftLabel')}</span>
            <textarea rows={5} maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <small>{t('writing.draftHelp')}</small>
          </label>}
        </div>
        <footer className="aw-footer">
          <button type="button" className="aw-btn aw-btn--ghost" onClick={onClose}>{t('writing.cancel')}</button>
          <button type="button" className="aw-btn aw-btn--secondary" disabled={busy || thoughts.trim().length < 15} onClick={generate}><Sparkles size={15} />{busy ? t('writing.writing') : draft ? t('writing.regenerate') : t('writing.generate')}</button>
          {draft && <button type="button" className="aw-btn aw-btn--primary" onClick={() => { onApply(draft); onClose(); }}><Check size={16} />{t('writing.useDraft')}</button>}
        </footer>
      </section>
    </div>, document.body,
  );
}
