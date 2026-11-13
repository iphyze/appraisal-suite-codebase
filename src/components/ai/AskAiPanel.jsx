import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Bot, Maximize2, ShieldCheck, Sparkles, SquarePen, X } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import useThemeStore from '../../stores/useThemeStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import useAskAiStore from '../../stores/useAskAiStore';
import { askAiAssistant, createAiConversation, getAiAssistantStatus, getAiNavigationAvailability } from '../../services/aiAssistant';
import { makeRequestId } from '../../utils/requestId';
import AiMessageContent from './AiMessageContent';
import AiRecordList from './AiRecordList';
import '../../pages/ai/AiAssistant.css';
import './AskAiPanel.css';

const MAX_QUESTION = 4000;
const errorText = (error) => error?.response?.data?.message || error?.message || i18n.t('assistant_error', { ns: 'ai' });

/** Suggestions that fit the page the person is on. */
const suggestionsFor = (path, role, t) => {
  const viewing = path.match(/^\/appraisals\/view\/(\d+)/);
  if (viewing) {
    const id = viewing[1];
    return [t('panel_suggest_view_summary', { id }), t('panel_suggest_view_score', { id }), t('panel_suggest_view_ack')];
  }
  if (path.startsWith('/my-appraisals')) {
    return [t('panel_suggest_mine_years'), t('suggest_staff_ack'), t('panel_suggest_rating')];
  }
  if (path.startsWith('/my-team') || role === 'supervisor') {
    return [t('panel_suggest_team_year'), t('panel_suggest_team_ack'), t('suggest_supervisor_objectives')];
  }
  if (path.startsWith('/appraisals') || path.startsWith('/dashboard')) {
    return [t('panel_suggest_ack_count'), t('panel_suggest_year_access'), t('panel_suggest_management')];
  }
  if (role === 'staff') {
    return [t('suggest_staff_scores'), t('suggest_staff_ack'), t('panel_suggest_staff_update')];
  }
  return [t('panel_suggest_year_access'), t('suggest_superadmin_weights'), t('panel_suggest_integrity')];
};

/**
 * "Ask AI" in the top bar: opens the Appraisal Assistant beside any page.
 * Hidden entirely when the Super Admin has switched the panel or Assistant off.
 */
export default function AskAiPanel() {
  const { t } = useTranslation('ai');
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { open, setOpen, toggle, ensureScope, conversationId, setConversationId, messages, addMessage, reset } = useAskAiStore();
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const role = user?.role || 'staff';
  const scope = `${user?.id || ''}:${role}:${user?.company_id || ''}:${viewCompanyId || ''}`;
  const needsCompany = role === 'super_admin' && !viewCompanyId;

  useEffect(() => { ensureScope(scope); }, [scope, ensureScope]);

  // Show the button only when the panel and Assistant are switched on.
  useEffect(() => {
    if (!user?.id) { setAvailable(false); return undefined; }
    let active = true;
    const refresh = () => {
      getAiNavigationAvailability()
        .then((features) => { if (active) setAvailable(!!features?.ask_panel?.available); })
        .catch(() => { if (active) setAvailable(false); });
    };
    refresh();
    window.addEventListener('appraisalsuite:ai-settings-updated', refresh);
    const timer = window.setInterval(refresh, 120000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('appraisalsuite:ai-settings-updated', refresh); };
  }, [user?.id, role]);

  useEffect(() => { if (!available && open) setOpen(false); }, [available, open, setOpen]);

  // Budget and availability are rechecked each time the panel opens.
  useEffect(() => {
    if (!open) return;
    getAiAssistantStatus().then(setStatus).catch(() => setStatus(null));
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Ctrl/Cmd + J toggles the panel; Escape closes it.
  useEffect(() => {
    if (!available) return undefined;
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') { event.preventDefault(); toggle(); }
      if (event.key === 'Escape' && useAskAiStore.getState().open) { setOpen(false); launcherRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [available, toggle, setOpen]);

  useEffect(() => {
    const pane = listRef.current;
    if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [messages, busy, reduced]);

  useLayoutEffect(() => {
    const area = inputRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 140)}px`;
  }, [draft, open]);

  const blocked = needsCompany || status?.enabled === false || status?.budget_reached;

  const ask = useCallback(async (value) => {
    const question = String(value || '').trim();
    if (!question || busy || blocked || question.length > MAX_QUESTION) return;
    const askedScope = scope;
    const requestedLanguage = i18n.language;
    setBusy(true);
    setDraft('');
    addMessage({ id: makeRequestId(), role: 'user', content: question });
    try {
      let id = useAskAiStore.getState().conversationId;
      if (!id) {
        const created = await createAiConversation();
        id = created?.id;
        if (useAskAiStore.getState().scope !== askedScope) return;
        setConversationId(id);
      }
      const reply = await askAiAssistant(question, [], id, { source: 'panel' });
      if (useAskAiStore.getState().scope !== askedScope || requestedLanguage !== i18n.language) return;
      addMessage({ id: makeRequestId(), role: 'assistant', content: reply?.answer || t('assistant_no_response'), references: reply?.references || [], live: !!reply?.live_data_used });
    } catch (error) {
      if (useAskAiStore.getState().scope === askedScope && requestedLanguage === i18n.language) addMessage({ id: makeRequestId(), role: 'assistant', error: true, content: errorText(error) });
    } finally {
      setBusy(false);
    }
  }, [busy, blocked, scope, addMessage, setConversationId, t]);

  if (!available) return null;

  const suggestions = suggestionsFor(location.pathname, role, t);
  const openFullPage = () => {
    setOpen(false);
    navigate(conversationId ? `/ai-assistant?c=${conversationId}` : '/ai-assistant');
  };

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="ask-ai__scrim" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
          <motion.aside
            className={`ap-ai ask-ai ${theme === 'dark' ? 'is-dark' : ''}`}
            role="dialog"
            aria-label={t('panel_title')}
            initial={reduced ? { opacity: 0 } : { x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: 32, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="ask-ai__head">
              <span className="ask-ai__mark" aria-hidden="true"><Sparkles size={17} /></span>
              <div className="ask-ai__title">
                <strong>{t('panel_title')}</strong>
                <small><ShieldCheck size={12} /> {t('panel_readonly')}</small>
              </div>
              <div className="ask-ai__tools">
                <button type="button" onClick={reset} disabled={busy || messages.length === 0} title={t('assistant_new_chat')} aria-label={t('assistant_new_chat')}><SquarePen size={16} /></button>
                <button type="button" onClick={openFullPage} title={t('panel_open_full')} aria-label={t('panel_open_full')}><Maximize2 size={16} /></button>
                <button type="button" onClick={() => setOpen(false)} title={t('panel_close_shortcut')} aria-label={t('panel_close')}><X size={17} /></button>
              </div>
            </header>

            <div className="ask-ai__body" ref={listRef} aria-live="polite">
              {needsCompany && <p className="ask-ai__notice">{t('panel_need_company')}</p>}
              {status?.budget_reached && <p className="ask-ai__notice">{t('panel_budget_reached')}</p>}
              {status && !status.enabled && <p className="ask-ai__notice">{t('panel_disabled')}</p>}

              {messages.length === 0 && (
                <div className="ask-ai__empty">
                  <p className="ask-ai__hello">{t('panel_welcome')}</p>
                  <p className="ask-ai__lead">{t('panel_welcome_detail')}</p>
                  <div className="ask-ai__suggestions">
                    {suggestions.map((item) => (
                      <button type="button" key={item} disabled={blocked || busy} onClick={() => ask(item)}>{item}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div className={`ap-ai__message ap-ai__message--${msg.role} ${msg.error ? 'ap-ai__message--error' : ''}`} key={msg.id}>
                  {msg.role === 'assistant' && <span className="ap-ai__mini-avatar" aria-hidden="true"><Bot size={15} /></span>}
                  <div className="ap-ai__bubble">
                    <div className="ap-ai__bubble-text"><AiMessageContent content={msg.content} plain={msg.role === 'user' || msg.error} /></div>
                    {msg.role === 'assistant' && !msg.error && <AiRecordList references={msg.references} />}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="ap-ai__message ap-ai__message--assistant" role="status">
                  <span className="ap-ai__mini-avatar" aria-hidden="true"><Bot size={15} /></span>
                  <div className="ap-ai__typing"><span>{t('assistant_thinking')}</span><span className="ap-ai__dots" aria-hidden="true"><i /><i /><i /></span></div>
                </div>
              )}
            </div>

            <form className="ask-ai__composer" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
              <div className="ap-ai__composer-box">
                <label htmlFor="ask-ai-question" className="ap-ai__sr-only">{t('assistant_ask_label')}</label>
                <textarea
                  id="ask-ai-question"
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  maxLength={MAX_QUESTION}
                  disabled={busy || blocked}
                  placeholder={t('assistant_ask_label')}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(draft); } }}
                />
                <div className="ap-ai__composer-foot">
                  <span className="ap-ai__composer-hint">{t('panel_keyhint')}</span>
                  <button type="submit" aria-label={t('assistant_send_aria')} disabled={busy || blocked || !draft.trim()}><ArrowUp size={17} /></button>
                </div>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={`ap-header__utility-btn ask-ai__launcher ${open ? 'is-open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('panel_title_shortcut')}
      >
        <Sparkles size={15} aria-hidden="true" />
        <span>{t('panel_title')}</span>
      </button>
      {createPortal(panel, document.body)}
    </>
  );
}
