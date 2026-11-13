import { Trans, useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert, ClipboardList, Sparkles, X } from 'lucide-react';
import { generateAiDevelopmentPlan } from '../../services/aiAssistant';
import useThemeStore from '../../stores/useThemeStore';
import AppSelect from '../ui/AppSelect';
import './AiWritingModal.css';
import './AiDevelopmentModal.css';


/** Draft-only assistant: the caller owns all changes and must still save the appraisal. */
export default function AiDevelopmentModal({ currentText = '', onApply, onClose }) {
  const { t, i18n: languageContext } = useTranslation('appraisals');
  const errorText = (error) => error?.response?.data?.message || error?.message || t('development.errorFallback');
  const theme = useThemeStore((state) => state.theme);
  const [observations, setObservations] = useState('');
  const [improvementAreas, setImprovementAreas] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [supportAvailable, setSupportAvailable] = useState('');
  const [timeframe, setTimeframe] = useState('90_days');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firstFieldRef = useRef(null);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setBusy(false);
    setError('');
    // Preserve every field and any user-edited draft on language switches.
  }, [languageContext.language]);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { generation.current += 1; document.removeEventListener('keydown', escape); };
  }, [onClose]);

  const generate = async (event) => {
    event.preventDefault();
    if (busy || observations.trim().length < 25 || desiredOutcome.trim().length < 12) return;
    const epoch = ++generation.current;
    setBusy(true);
    setError('');
    setDraft('');
    try {
      const result = await generateAiDevelopmentPlan({
        observations,
        improvement_areas: improvementAreas,
        desired_outcome: desiredOutcome,
        support_available: supportAvailable,
        timeframe,
        existing_draft: currentText,
      });
      if (epoch === generation.current) setDraft(result?.suggestion || '');
    } catch (err) {
      if (epoch === generation.current) setError(errorText(err));
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  };

  return createPortal(
    <div className="aw-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`aw-dialog adp-dialog ${theme === 'dark' ? 'aw-dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="adp-title">
        <header className="aw-heading">
          <span className="aw-icon"><ClipboardList size={20} /></span>
          <div>
            <span className="aw-kicker">{t('development.kicker')}</span>
            <h2 id="adp-title">{t('development.title')}</h2>
            <p>{t('development.introHeading')}</p>
          </div>
          <button type="button" className="aw-dismiss" aria-label={t('development.closeAria')} onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={generate} className="adp-form">
          <div className="aw-body adp-body">
            <div className="aw-intro"><Trans ns="appraisals" i18nKey="development.intro" components={{ strong: <strong /> }} /></div>
            <label className="aw-field">
              <span>{t('development.observations')} <em>{t('development.required')}</em></span>
              <textarea ref={firstFieldRef} rows={3} maxLength={2000} required minLength={25} value={observations} onChange={(event) => setObservations(event.target.value)} placeholder={t('development.observationsPlaceholder')} />
            </label>
            <div className="adp-grid">
              <label className="aw-field">
                <span>{t('development.areas')} <small>{t('development.optional')}</small></span>
                <textarea rows={3} maxLength={1400} value={improvementAreas} onChange={(event) => setImprovementAreas(event.target.value)} placeholder={t('development.areasPlaceholder')} />
              </label>
              <label className="aw-field">
                <span>{t('development.outcome')} <em>{t('development.required')}</em></span>
                <textarea rows={3} maxLength={1200} minLength={12} required value={desiredOutcome} onChange={(event) => setDesiredOutcome(event.target.value)} placeholder={t('development.outcomePlaceholder')} />
              </label>
            </div>
            <div className="adp-grid">
              <label className="aw-field">
                <span>{t('development.support')} <small>{t('development.optional')}</small></span>
                <textarea rows={2} maxLength={1200} value={supportAvailable} onChange={(event) => setSupportAvailable(event.target.value)} placeholder={t('development.supportPlaceholder')} />
              </label>
              <div className="aw-field">
                <span>{t('development.period')}</span>
                <AppSelect value={timeframe} onChange={setTimeframe} clearable={false} options={[
                  { value: '30_days', label: t('development.thirty') },
                  { value: '60_days', label: t('development.sixty') },
                  { value: '90_days', label: t('development.ninety') },
                  { value: '6_months', label: t('development.sixMonths') },
                ]} />
                <small>{t('development.datesHelp')}</small>
              </div>
            </div>
            {!!currentText.trim() && <div className="adp-existing"><span>{t('development.existing')}</span><p>{currentText}</p></div>}
            {error && <p className="aw-error" role="alert"><CircleAlert size={15} />{error}</p>}
            {draft && <label className="aw-field aw-draft"><span>{t('development.proposed')}</span>
              <textarea rows={8} maxLength={3500} value={draft} onChange={(event) => setDraft(event.target.value)} />
              <small>{t('development.applyHelp')}</small>
            </label>}
          </div>
          <footer className="aw-footer">
            <button type="button" className="aw-btn aw-btn--ghost" onClick={onClose}>{t('development.cancel')}</button>
            <button type="submit" className="aw-btn aw-btn--secondary" disabled={busy || observations.trim().length < 25 || desiredOutcome.trim().length < 12}><Sparkles size={15} />{busy ? t('development.generating') : draft ? t('development.regenerate') : t('development.generatePlan')}</button>
            {draft.trim() && <button type="button" className="aw-btn aw-btn--primary" onClick={() => { onApply(draft); onClose(); }}><Check size={16} />{t('development.usePlan')}</button>}
          </footer>
        </form>
      </section>
    </div>, document.body,
  );
}
