import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, ShieldAlert, Sparkles, X } from 'lucide-react';
import useThemeStore from '../../stores/useThemeStore';
import { formatNumber } from '../../utils/format';
import './AiStage3.css';


/**
 * "Before you submit" review. Shows the free rule checks, and optionally an AI review of the
 * wording (tokens). Never blocks: the supervisor can always submit anyway.
 */
export default function FairnessCheckModal({ findings, aiAvailable, onRunAi, onGoTo, onSubmit, onClose, saving, submitLabel }) {
  const { t, i18n } = useTranslation('appraisals');
  const locale = i18n.resolvedLanguage || i18n.language;
  const errorText = (e) => e?.response?.data?.message || e?.message || t('fairness.errorFallback');
  const theme = useThemeStore((state) => state.theme);
  const [aiFindings, setAiFindings] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const closeRef = useRef(null);
  const aiEpoch = useRef(0);

  useEffect(() => {
    aiEpoch.current += 1;
    setAiBusy(false);
    setAiFindings(null);
    setAiError('');
  }, [locale]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const runAi = async () => {
    if (aiBusy) return;
    const request = ++aiEpoch.current;
    setAiBusy(true);
    setAiError('');
    try {
      const result = await onRunAi();
      if (request === aiEpoch.current) setAiFindings(result);
    } catch (e) {
      if (request === aiEpoch.current) setAiError(errorText(e));
    } finally {
      if (request === aiEpoch.current) setAiBusy(false);
    }
  };

  const ruleText = (finding, field) => {
    const id = finding.id?.startsWith('breach-') ? 'breach' : finding.id;
    const suffix = field === 'title' ? 'Title' : 'Detail';
    const keys = { extremes: 'extremes', 'same-rating': 'sameRating', 'mostly-top': 'mostlyTop', breach: 'breach', 'rec-status': 'recStatus', 'rec-salary': 'recSalary', 'rec-dev': 'recDev', 'rec-breach': 'recBreach' };
    const key = keys[id];
    if (!key) return finding[field];
    return t(`fairness.rules.${key}${suffix}`, {
      count: finding.questions?.length || 1,
      rating: finding.rating == null ? undefined : formatNumber(finding.rating, { maximumFractionDigits: 2 }, locale),
      percentage: finding.percentage == null ? undefined : formatNumber(finding.percentage, { maximumFractionDigits: 0 }, locale),
      max: finding.maxRating == null ? undefined : formatNumber(finding.maxRating, { maximumFractionDigits: 2 }, locale),
      question: finding.question,
      score: finding.score == null ? undefined : formatNumber(finding.score, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale),
    });
  };

  const total = findings.length + (aiFindings?.length || 0);
  const clean = total === 0;

  return createPortal(
    <div className={`ai3 ai3-overlay ${theme === 'dark' ? 'is-dark' : ''}`} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section className="ai3-dialog" role="dialog" aria-modal="true" aria-labelledby="ai3-fair-title">
        <header className="ai3-head">
          <span className={`ai3-head__icon ${clean ? 'is-ok' : ''}`} aria-hidden="true">{clean ? <CircleCheck size={20} /> : <ShieldAlert size={20} />}</span>
          <div>
            <h2 id="ai3-fair-title">{t('fairness.title')}</h2>
            <p>{clean ? t('fairness.nothing') : t('fairness.checkCount', { count: total })}</p>
          </div>
          <button ref={closeRef} type="button" className="ai3-close" onClick={onClose} disabled={saving} aria-label={t('fairness.close')}><X size={18} /></button>
        </header>

        <div className="ai3-body">
          {findings.length > 0 ? (
            <ul className="ai3-findings">
              {findings.map((f) => (
                <li key={f.id} className="ai3-finding">
                  <strong>{ruleText(f, 'title')}</strong>
                  <p>{ruleText(f, 'detail')}</p>
                  {f.questions && (
                    <ul className="ai3-qs">
                      {f.questions.slice(0, 8).map((q) => (
                        <li key={q.ref}><span>{q.text} ({formatNumber(q.rating, { maximumFractionDigits: 2 }, locale)}, {q.label})</span><button type="button" className="ai3-link" onClick={() => onGoTo(q.ref)}>{t('fairness.addExample')}</button></li>
                      ))}
                      {f.questions.length > 8 && <li><span>{t('fairness.moreQuestions', { count: f.questions.length - 8 })}</span></li>}
                    </ul>
                  )}
                  {(f.ref || f.target) && !f.questions && <button type="button" className="ai3-link" onClick={() => onGoTo(f.ref || f.target)}>{t('fairness.goTo')}</button>}
                </li>
              ))}
            </ul>
          ) : <p className="ai3-empty">{t('fairness.empty')}</p>}

          {aiAvailable && (
            <div className="ai3-ai">
              <h3>{t('fairness.aiTitle')} <span className="ai3-tag">{t('fairness.tokens')}</span></h3>
              <p>{t('fairness.aiHelp')}</p>
              {aiFindings === null ? (
                <button type="button" className="ai3-btn" onClick={runAi} disabled={aiBusy || saving}><Sparkles size={15} />{aiBusy ? t('fairness.checking') : t('fairness.checkWording')}</button>
              ) : aiFindings.length === 0 ? (
                <p className="ai3-empty">{t('fairness.aiClear')}</p>
              ) : (
                <ul className="ai3-findings">
                  {aiFindings.map((f, i) => (
                    <li key={`ai-${i}`} className="ai3-finding is-ai">
                      <strong>{f.issue}</strong>
                      {f.suggestion && <p>{f.suggestion}</p>}
                      {f.ref && <button type="button" className="ai3-link" onClick={() => onGoTo(f.ref)}>{t('fairness.goToQuestion')}</button>}
                    </li>
                  ))}
                </ul>
              )}
              {aiError && <p className="ai3-error" role="alert">{aiError}</p>}
            </div>
          )}
        </div>

        <footer className="ai3-foot">
          <button type="button" className="ai3-btn" onClick={onClose} disabled={saving}>{t('fairness.backEdit')}</button>
          <button type="button" className="ai3-btn ai3-btn--primary" onClick={onSubmit} disabled={saving}>{saving ? t('fairness.saving') : clean ? submitLabel : t('fairness.submitAnyway', { action: submitLabel })}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
