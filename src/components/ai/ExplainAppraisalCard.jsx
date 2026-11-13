import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate } from '../../utils/format';
import { Sparkles } from 'lucide-react';
import { generateAiExplanation, getAiExplanation, getAiNavigationAvailability } from '../../services/aiAssistant';
import './AiStage3.css';

const errorText = (e) => e?.response?.data?.message || e?.message || i18n.t('explain_error', { ns: 'ai' });
const savedWhen = (value) => {
  const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null;
  return date && !Number.isNaN(date.getTime()) ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }, i18n.language) : i18n.t('explain_earlier', { ns: 'ai' });
};

/**
 * "Explain this appraisal": a plain-language reading of the result.
 * Hidden when the feature is off. A saved explanation for this version opens free of charge.
 */
export default function ExplainAppraisalCard({ appraisalId, isOwn }) {
  const { t, i18n: languageContext } = useTranslation('ai');
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);

  useEffect(() => {
    let active = true;
    const mine = ++epoch.current;
    setState(null);
    setBusy(false);
    setError('');
    getAiNavigationAvailability()
      .then((f) => {
        if (!active || !f?.tools?.explain_appraisal) return;
        setAvailable(true);
        return getAiExplanation(appraisalId).then((data) => { if (active && mine === epoch.current) setState(data); });
      })
      .catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [appraisalId, languageContext.language]);

  if (!available) return null;

  const generate = async (refresh) => {
    const mine = epoch.current;
    setBusy(true);
    setError('');
    try {
      const data = await generateAiExplanation(appraisalId, refresh);
      if (mine === epoch.current) setState((prev) => ({ ...prev, ...data }));
    } catch (e) {
      if (mine === epoch.current) setError(errorText(e));
    } finally {
      if (mine === epoch.current) setBusy(false);
    }
  };
  const x = state?.explanation;

  return (
    <section className="ai3 ai3-explain" aria-labelledby="ai3-explain-title">
      <div className="ai3-explain__head">
        <div>
          <h3 id="ai3-explain-title">{t(isOwn ? 'explain_own_title' : 'explain_other_title')}</h3>
          <p>{t('explain_info')}</p>
        </div>
        {!x && (
          <button type="button" className="ai3-btn ai3-btn--primary" onClick={() => generate(false)} disabled={busy || state?.ai_available === false}>
            <Sparkles size={15} />{t(busy ? 'explain_working' : 'explain_button')}
          </button>
        )}
      </div>
      {!x && state?.ai_available === false && <p className="ai3-empty">{t('explain_unavailable')}</p>}
      {x && (
        <>
          <p className="ai3-explain__summary">{x.summary}</p>
          {x.score_explained && <p className="ai3-explain__summary">{x.score_explained}</p>}
          <div className="ai3-explain__cols">
            <div className="ai3-explain__col" style={{ '--col': '#2f8a47' }}><h4>{t('explain_strengths')}</h4><ul>{(x.strengths || []).map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div className="ai3-explain__col" style={{ '--col': '#d99418' }}><h4>{t('explain_improve')}</h4><ul>{(x.to_improve || []).map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div className="ai3-explain__col" style={{ '--col': '#2f7fbf' }}><h4>{t('explain_next')}</h4><ul>{(x.next_steps || []).map((t) => <li key={t}>{t}</li>)}</ul></div>
          </div>
          <div className="ai3-explain__meta">
            <span>{t('explain_meta', { date: savedWhen(state.generated_at), note: t(isOwn ? 'explain_own_note' : 'explain_other_note') })}</span>
            <button type="button" className="ai3-link" onClick={() => generate(true)} disabled={busy}>{t(busy ? 'explain_refreshing' : 'explain_fresh')}</button>
          </div>
        </>
      )}
      {error && <p className="ai3-error" role="alert">{error}</p>}
    </section>
  );
}
