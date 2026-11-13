import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Copy, Mail, Sparkles, X } from 'lucide-react';
import useThemeStore from '../../stores/useThemeStore';
import { draftAiReminder } from '../../services/aiAssistant';
import './AiStage3.css';

const AUDIENCES = {
  staff_acknowledgement: 'reminder_audience_staff',
  supervisors_pending: 'reminder_audience_pending',
  supervisors_setup: 'reminder_audience_setup',
};
const errorText = (e) => e?.response?.data?.message || e?.message || 'reminder_error';

/** Drafts a reminder with AI (tokens); the admin edits it and sends it from Send Email. */
export default function ReminderDraftModal({ audience, cycleId, cycleTitle, onClose }) {
  const { t, i18n } = useTranslation('analytics');
  const theme = useThemeStore((state) => state.theme);
  const navigate = useNavigate();
  const [tone, setTone] = useState('friendly');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      setDraft(await draftAiReminder({ audience, cycle_id: cycleId, tone, deadline: deadline || undefined, note: note || undefined }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.message}`); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* clipboard unavailable */ }
  };
  const openInEmail = () => navigate('/mail', { state: { reminderDraft: { mode: draft.email_mode, subject: draft.subject, message: draft.message, cycle_id: draft.cycle_id } } });

  return createPortal(
    <div className={`ai3 ai3-overlay ${theme === 'dark' ? 'is-dark' : ''}`} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="ai3-dialog" role="dialog" aria-modal="true" aria-labelledby="ai3-rem-title">
        <header className="ai3-head">
          <span className="ai3-head__icon is-ok" aria-hidden="true"><Mail size={19} /></span>
          <div>
            <h2 id="ai3-rem-title">{t('reminder_title')}</h2>
            <p>{t('reminder_intro', { audience: t(AUDIENCES[audience] || 'reminder_audience_staff'), cycle: cycleTitle })}</p>
          </div>
          <button ref={closeRef} type="button" className="ai3-close" onClick={onClose} aria-label={t('reminder_close')}><X size={18} /></button>
        </header>
        <div className="ai3-body">
          {!draft ? (
            <>
              <div className="ai3-row">
                <label className="ai3-field"><span>{t('reminder_tone')}</span>
                  <select value={tone} onChange={(e) => setTone(e.target.value)}>
                    <option value="friendly">{t('reminder_tone_friendly')}</option><option value="firm">{t('reminder_tone_firm')}</option><option value="urgent">{t('reminder_tone_urgent')}</option>
                  </select>
                </label>
                <label className="ai3-field"><span>{t('reminder_deadline')}</span>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </label>
              </div>
              <label className="ai3-field"><span>{t('reminder_extra')}</span>
                <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t('reminder_example')} />
              </label>
              <p className="ai3-empty">{t('reminder_privacy')} <span className="ai3-tag">{t('uses_tokens')}</span></p>
            </>
          ) : (
            <>
              <label className="ai3-field"><span>{t('reminder_subject')}</span>
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </label>
              <label className="ai3-field"><span>{t('reminder_message')}</span>
                <textarea rows={8} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
              </label>
              <p className="ai3-empty">{t('reminder_recipients', { count: draft.recipients, number: formatNumber(draft.recipients, {}, i18n.language) })}</p>
            </>
          )}
          {error && <p className="ai3-error" role="alert">{error === 'reminder_error' ? t(error) : error}</p>}
        </div>
        <footer className="ai3-foot">
          {!draft ? (
            <>
              <button type="button" className="ai3-btn" onClick={onClose}>{t('reminder_cancel')}</button>
              <button type="button" className="ai3-btn ai3-btn--primary" onClick={generate} disabled={busy}><Sparkles size={15} />{busy ? t('reminder_drafting') : t('reminder_generate')}</button>
            </>
          ) : (
            <>
              <button type="button" className="ai3-btn" onClick={() => setDraft(null)}>{t('reminder_restart')}</button>
              <button type="button" className="ai3-btn" onClick={copy}><Copy size={14} />{copied ? t('reminder_copied') : t('reminder_copy')}</button>
              <button type="button" className="ai3-btn ai3-btn--primary" onClick={openInEmail} disabled={!draft.subject.trim() || !draft.message.trim()}><Mail size={15} />{t('reminder_open_email')}</button>
            </>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
