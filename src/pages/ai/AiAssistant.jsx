import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { currentFormatLocale, formatNumber } from '../../utils/format';
import { ArrowUp, Bot, Check, Copy, LockKeyhole, MessageCircle, MessageSquareText, PanelLeft, PanelLeftClose, Pencil, Plus, Search, ShieldCheck, SquarePen, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Header from '../Header';
import '../appraisals/Appraisals.css';
import NavBar from '../NavBar';
import useThemeStore from '../../stores/useThemeStore';
import useAuthStore from '../../stores/useAuthStore';
import usePortalContextStore from '../../stores/usePortalContextStore';
import {
  askAiAssistant, getAiAssistantStatus, listAiConversations, createAiConversation,
  getAiConversationMessages, renameAiConversation, deleteAiConversation,
} from '../../services/aiAssistant';
import AiMessageContent from '../../components/ai/AiMessageContent';
import AiRecordList from '../../components/ai/AiRecordList';
import { aiMessageToPlainText } from '../../components/ai/aiMessageFormat';
import './AiAssistant.css';

const suggestedByRole = {
  staff: ['suggest_staff_scores', 'suggest_staff_ack', 'suggest_staff_followup'],
  supervisor: ['suggest_supervisor_team', 'suggest_supervisor_updates', 'suggest_supervisor_objectives'],
  admin: ['suggest_admin_summary', 'suggest_admin_safety', 'suggest_admin_team'],
  super_admin: ['suggest_superadmin_company', 'suggest_superadmin_caps', 'suggest_superadmin_weights'],
};
const getError = (error) => error?.response?.data?.message || error?.message || i18n.t('assistant_error', { ns: 'ai' });
const MAX_QUESTION = 4000;

const copyText = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall back below */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(area);
  return ok;
};

const parseStamp = (value) => {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const historyGroup = (value) => {
  const date = parseStamp(value);
  if (!date) return 'Earlier';
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Previous 7 days';
  if (days < 30) return 'Previous 30 days';
  return 'Earlier';
};
const historyTime = (value) => {
  const date = parseStamp(value);
  if (!date) return '';
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (days <= 1) return new Intl.DateTimeFormat(currentFormatLocale(i18n.language), { hour: 'numeric', minute: '2-digit' }).format(date);
  if (days < 7) return new Intl.DateTimeFormat(currentFormatLocale(i18n.language), { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat(currentFormatLocale(i18n.language), { day: 'numeric', month: 'short' }).format(date);
};
const GROUP_ORDER = [
  { name: 'Today', labelKey: 'history_today' },
  { name: 'Yesterday', labelKey: 'history_yesterday' },
  { name: 'Previous 7 days', labelKey: 'history_last7' },
  { name: 'Previous 30 days', labelKey: 'history_last30' },
  { name: 'Earlier', labelKey: 'history_earlier' },
];

const nextId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function AiAssistant() {
  const { t } = useTranslation('ai');
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const viewCompanyId = usePortalContextStore((state) => state.viewCompanyId);
  const [nav, setNav] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 760);
  const [historySearch, setHistorySearch] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const pendingRef = useRef(false);
  const contextRef = useRef('');
  const operationEpoch = useRef(0);
  const historyEpoch = useRef(0);
  const activeRef = useRef(null);
  const role = user?.role || 'staff';
  const suggestions = suggestedByRole[role] || suggestedByRole.staff;
  const contextId = `${user?.id || ''}:${role}:${user?.company_id || ''}:${viewCompanyId || ''}`;
  const contextMatches = contextRef.current === contextId;
  const visibleMessages = contextMatches ? messages : [];
  const visibleChats = contextMatches ? chats : [];
  const visibleActiveId = contextMatches ? activeId : null;
  const groupedChats = GROUP_ORDER
    .map((group) => ({ ...group, items: visibleChats.filter((chat) => historyGroup(chat.updated_at || chat.created_at) === group.name) }))
    .filter((group) => group.items.length);

  // One request owns the loading state for each search/context. Always release it,
  // including when the request fails; superseded requests cannot overwrite newer data.
  const refreshChats = async (search = '', epoch = ++historyEpoch.current) => {
    const scope = contextRef.current;
    setLoadingChats(true);
    try {
      const rows = await listAiConversations(search);
      if (epoch === historyEpoch.current && scope === contextRef.current) {
        setChats(rows);
        setHistoryError('');
      }
      return rows;
    } catch (error) {
      if (epoch === historyEpoch.current && scope === contextRef.current) {
        setHistoryError(getError(error));
      }
      throw error;
    } finally {
      if (epoch === historyEpoch.current && scope === contextRef.current) {
        setLoadingChats(false);
      }
    }
  };

  useEffect(() => {
    document.title = `AppraisalSuite | ${t('assistant_title')}`;
  }, [t]);
  useEffect(() => {
    // Scope change, sign-out, or a different signed-in user must clear all prior content.
    contextRef.current = contextId;
    operationEpoch.current += 1;
    historyEpoch.current += 1;
    pendingRef.current = false;
    activeRef.current = null;
    setBusy(false);
    setLoadingMessages(false);
    setMessages([]);
    setActiveId(null);
    setDraft('');
    setChats([]);
    setLoadingChats(false);
    setHistorySearch('');
    setHistoryError('');
    setEditingId(null);
    setDeletingId(null);
    // Search effect below owns history loading, including the initial fetch.
    // Do not start a second request here or its completion can be invalidated,
    // leaving "Loading conversations…" visible indefinitely.
    return () => { operationEpoch.current += 1; historyEpoch.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId]);
  useEffect(() => {
    let current = true;
    let lastCheckedAt = 0;
    let checkEpoch = 0;
    const refreshStatus = () => {
      if (!current) return;
      lastCheckedAt = Date.now();
      const epoch = ++checkEpoch;
      getAiAssistantStatus().then((data) => {
        if (!current || epoch !== checkEpoch) return;
        setStatus(data);
        setStatusError('');
        if (!data?.enabled) {
          // Hide cached answers promptly when the Assistant is switched off.
          // Stale in-flight responses must not restore the previous chat.
          operationEpoch.current += 1;
          historyEpoch.current += 1;
          pendingRef.current = false;
          activeRef.current = null;
          setBusy(false);
          setLoadingMessages(false);
          setLoadingChats(false);
          setHistoryError('');
          setChats([]);
          setActiveId(null);
          setMessages([]);
          setDraft('');
        }
      }).catch((error) => {
        if (!current || epoch !== checkEpoch) return;
        // A failed availability check must never leave the composer enabled.
        setStatus(null);
        setStatusError(getError(error));
      });
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckedAt >= 10000) refreshStatus();
    };
    refreshStatus();
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    window.addEventListener('appraisalsuite:ai-settings-updated', refreshStatus);
    const timer = window.setInterval(refreshWhenActive, 60000);
    return () => {
      current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
      window.removeEventListener('appraisalsuite:ai-settings-updated', refreshStatus);
    };
  }, []);
  useEffect(() => {
    // Initial load, search and re-enablement share one lifecycle. The request
    // sequence is invalidated on cleanup so slow, stale responses are ignored.
    const epoch = ++historyEpoch.current;
    if (!user?.id || (role === 'super_admin' && !viewCompanyId) || !status?.enabled) {
      setLoadingChats(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      refreshChats(historySearch.trim(), epoch).catch(() => {}); // Error is shown beside history.
    }, historySearch.trim() ? 220 : 0);
    return () => {
      clearTimeout(timer);
      historyEpoch.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, historySearch, status?.enabled]);
  // Composer grows with the question, up to a limit, then scrolls.
  useLayoutEffect(() => {
    const area = inputRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 168)}px`;
  }, [draft]);
  const copyAnswer = async (msg) => {
    if (await copyText(aiMessageToPlainText(msg.content))) {
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId((current) => (current === msg.id ? null : current)), 1800);
    }
  };
  useEffect(() => {
    const pane = messagesRef.current;
    if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const startNew = () => {
    if (busy) return;
    operationEpoch.current += 1;
    activeRef.current = null;
    setActiveId(null);
    setMessages([]);
    setDraft('');
    setHistoryError('');
    setLoadingMessages(false);
    if (window.innerWidth < 900) setHistoryOpen(false);
  };
  const openChat = async (id) => {
    if (busy || loadingMessages || activeRef.current === id) return;
    const epoch = ++operationEpoch.current;
    const scoped = contextRef.current;
    activeRef.current = id;
    setActiveId(id);
    setMessages([]);
    setLoadingMessages(true);
    setHistoryError('');
    try {
      const rows = await getAiConversationMessages(id);
      if (epoch !== operationEpoch.current || scoped !== contextRef.current) return;
      setMessages(rows);
      if (window.innerWidth < 900) setHistoryOpen(false);
    } catch (error) {
      if (epoch === operationEpoch.current) {
        activeRef.current = null;
        setActiveId(null);
        setHistoryError(getError(error));
      }
    } finally {
      if (epoch === operationEpoch.current) setLoadingMessages(false);
    }
  };
  // Arriving from the Ask AI panel: open that conversation (?c=<id>) once.
  const requestedChat = Number(searchParams.get('c')) || null;
  useEffect(() => {
    if (!requestedChat || !status?.enabled || contextRef.current !== contextId) return;
    setSearchParams({}, { replace: true });
    openChat(requestedChat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedChat, status?.enabled, contextId]);

  const ask = async (value) => {
    const question = String(value || '').trim();
    if (!question || contextRef.current !== contextId || pendingRef.current || !status?.enabled || question.length > MAX_QUESTION || loadingMessages) return;
    pendingRef.current = true;
    const epoch = ++operationEpoch.current;
    const scoped = contextRef.current;
    const requestedLanguage = i18n.language;
    setBusy(true);
    setDraft('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: question }]);
    try {
      let id = activeRef.current;
      if (!id) {
        const created = await createAiConversation();
        if (epoch !== operationEpoch.current || scoped !== contextRef.current) return;
        id = created.id;
        activeRef.current = id;
        setActiveId(id);
      }
      const reply = await askAiAssistant(question, [], id);
      if (epoch !== operationEpoch.current || scoped !== contextRef.current || requestedLanguage !== i18n.language) return;
      setMessages((prev) => [...prev, {
        id: nextId(), role: 'assistant', content: reply?.answer || t('assistant_no_response'),
        references: reply?.references || [], live: !!reply?.live_data_used,
      }]);
      try { await refreshChats(historySearch, ++historyEpoch.current); } catch { /* chat still works */ }
    } catch (error) {
      if (epoch !== operationEpoch.current || scoped !== contextRef.current || requestedLanguage !== i18n.language) return;
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', error: true, content: getError(error) }]);
    } finally {
      if (epoch === operationEpoch.current) { pendingRef.current = false; setBusy(false); }
    }
  };
  const saveTitle = async (id) => {
    if (!editingTitle.trim()) return;
    setHistoryError('');
    try {
      const updated = await renameAiConversation(id, editingTitle.trim());
      setChats((prev) => prev.map((chat) => chat.id === id ? { ...chat, title: updated.title } : chat));
      setEditingId(null);
    } catch (error) { setHistoryError(getError(error)); }
  };
  const removeChat = async (id) => {
    if (busy) return;
    setHistoryError('');
    try {
      await deleteAiConversation(id);
      setChats((prev) => prev.filter((chat) => chat.id !== id));
      if (activeRef.current === id) startNew();
      setDeletingId(null);
    } catch (error) { setHistoryError(getError(error)); }
  };

  return (
    <div className={`main-container theme-${theme}`}>
      <Header nav={nav} setNav={setNav} />
      <NavBar nav={nav} setNav={setNav} />
      <main className={`content-container theme-${theme}`}>
        <div className={`apr-page theme-${theme} ap-ai ap-ai--chat`}>
          {/* No visible page header: the chat uses the full height. The heading stays for screen readers. */}
          <h1 className="ap-ai__sr-only">{t('assistant_title')}</h1>
          <section className="ap-ai__shell" aria-label={t('assistant_conversation_aria')}>
            <div className="ap-ai__workspace">
              {historyOpen && (
                <aside className="ap-ai__history" aria-label={t('assistant_history_aria')}>
                  <div className="ap-ai__history-head">
                    <div>
                      <span className="ap-ai__history-heading">{t('assistant_history_title')}</span>
                      {visibleChats.length > 0 && <span className="ap-ai__history-count">{formatNumber(visibleChats.length, {}, i18n.language)}</span>}
                    </div>
                    <button type="button" onClick={() => setHistoryOpen(false)} aria-label={t('assistant_history_hide')} title={t('assistant_history_hide')}><PanelLeftClose size={17} /></button>
                  </div>
                  <button type="button" className="ap-ai__history-new" onClick={startNew} disabled={busy}>
                    <Plus size={16} /> {t('assistant_new_chat')}
                  </button>
                  <label className="ap-ai__history-search">
                    <Search size={15} aria-hidden="true" />
                    <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder={t('assistant_search_history')} aria-label={t('assistant_search_history')} />
                    {historySearch && <button type="button" onClick={() => setHistorySearch('')} aria-label={t('assistant_clear_search')}><X size={13} /></button>}
                  </label>
                  {historyError && <p className="ap-ai__history-error" role="alert">{historyError}</p>}
                  {!loadingChats && historyError && status?.enabled && <button type="button" className="ap-ai__history-retry" onClick={() => { refreshChats(historySearch.trim()).catch(() => {}); }}>{t('assistant_retry')}</button>}
                  <div className="ap-ai__history-list">
                    {loadingChats && (
                      <div className="ap-ai__history-skeleton" role="status" aria-label={t('assistant_loading_history')}><i /><i /><i /></div>
                    )}
                    {!loadingChats && !historyError && visibleChats.length === 0 && (
                      <p className="ap-ai__history-empty">{t(historySearch ? 'assistant_no_search_results' : 'assistant_history_empty')}</p>
                    )}
                    {!loadingChats && groupedChats.map((group) => (
                      <div className="ap-ai__history-group" key={group.name}>
                        <p className="ap-ai__history-group-label">{t(group.labelKey)}</p>
                        {group.items.map((chat) => (
                          <div className={`ap-ai__history-item ${visibleActiveId === chat.id ? 'is-active' : ''}`} key={chat.id}>
                            {editingId === chat.id ? (
                              <div className="ap-ai__history-edit">
                                <input autoFocus value={editingTitle} maxLength={120} onChange={(e) => setEditingTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(chat.id); if (e.key === 'Escape') setEditingId(null); }} aria-label={t('assistant_title_edit')} />
                                <button type="button" onClick={() => saveTitle(chat.id)} aria-label={t('assistant_title_save')}><Check size={14} /></button>
                                <button type="button" onClick={() => setEditingId(null)} aria-label={t('assistant_rename_cancel')}><X size={14} /></button>
                              </div>
                            ) : (
                              <>
                                <button type="button" className="ap-ai__history-title" onClick={() => openChat(chat.id)} disabled={busy} title={chat.title}>
                                  <MessageSquareText className="ap-ai__history-chat-icon" size={16} aria-hidden="true" />
                                  <span className="ap-ai__history-title-content">
                                    <span className="ap-ai__history-chat-name">{chat.title}</span>
                                    <small>{historyTime(chat.updated_at || chat.created_at)}</small>
                                  </span>
                                </button>
                                <div className="ap-ai__history-actions">
                                  <button type="button" title={t('assistant_rename')} aria-label={t('assistant_rename_item', { title: chat.title })} onClick={() => { setEditingId(chat.id); setEditingTitle(chat.title); setDeletingId(null); }}><Pencil size={13} /></button>
                                  <button type="button" title={t('assistant_delete')} aria-label={t('assistant_delete_item', { title: chat.title })} onClick={() => { setDeletingId(chat.id); setEditingId(null); }}><Trash2 size={13} /></button>
                                </div>
                              </>
                            )}
                            {deletingId === chat.id && (
                              <div className="ap-ai__history-confirm">
                                <span>{t('assistant_delete_confirm')}</span>
                                <div><button type="button" className="is-danger" onClick={() => removeChat(chat.id)}>{t('assistant_delete')}</button><button type="button" onClick={() => setDeletingId(null)}>{t('assistant_keep')}</button></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="ap-ai__history-note"><LockKeyhole size={12} /> {t('assistant_history_privacy')}</p>
                </aside>
              )}
              <div className="ap-ai__conversation">
                <div className="ap-ai__toolbar">
                  <div className="ap-ai__toolbar-name">
                    {!historyOpen && (
                      <button type="button" className="ap-ai__history-toggle" onClick={() => setHistoryOpen(true)} title={t('assistant_history_show')} aria-label={t('assistant_history_show')}><PanelLeft size={18} /></button>
                    )}
                    <span className="ap-ai__avatar" aria-hidden="true"><Bot size={19} /></span>
                    <div>
                      <strong>{visibleActiveId ? (visibleChats.find((chat) => chat.id === visibleActiveId)?.title || 'AppraisalSuite AI') : 'AppraisalSuite AI'}</strong>
                      <small><ShieldCheck size={12} /> {t('assistant_readonly')}</small>
                    </div>
                  </div>
                  {!historyOpen && (
                    <button type="button" onClick={startNew} className="ap-ai__reset" disabled={busy || (!visibleActiveId && visibleMessages.length === 0)} title={t('assistant_start_new')}><SquarePen size={15} /> {t('assistant_new_chat')}</button>
                  )}
                </div>
                <div className="ap-ai__messages" ref={messagesRef} aria-live="polite">
                  {statusError && <div className="ap-ai__alert" role="alert">{statusError}</div>}
                  {status && !status.enabled && <div className="ap-ai__alert" role="status">{t('assistant_disabled')}</div>}
                  {role === 'super_admin' && !viewCompanyId && <div className="ap-ai__alert">{t('assistant_choose_company')}</div>}
                  {loadingMessages && <div className="ap-ai__typing">{t('assistant_loading_chat')}</div>}
                  {!loadingMessages && visibleMessages.length === 0 && <div className="ap-ai__welcome">
                    <span className="ap-ai__welcome-icon"><MessageCircle size={25} /></span>
                    <h2>{t('assistant_welcome')}</h2><p>{t('assistant_welcome_detail')}</p>
                    <div className="ap-ai__suggestions">{suggestions.map((item) => <button type="button" key={item} disabled={!status?.enabled || (role === 'super_admin' && !viewCompanyId)} onClick={() => ask(t(item))}>{t(item)}<ArrowUp size={15} /></button>)}</div>
                  </div>}
                  {visibleMessages.map((msg) => (
                    <div className={`ap-ai__message ap-ai__message--${msg.role} ${msg.error ? 'ap-ai__message--error' : ''}`} key={msg.id}>
                      {msg.role === 'assistant' && <span className="ap-ai__mini-avatar" aria-hidden="true"><Bot size={16} /></span>}
                      <div className="ap-ai__bubble">
                        <div className="ap-ai__bubble-text">
                          <AiMessageContent content={msg.content} plain={msg.role === 'user' || msg.error} />
                        </div>
                        {msg.role === 'assistant' && !msg.error && <AiRecordList references={msg.references} />}
                        {msg.role === 'assistant' && !msg.error && (
                          <div className="ap-ai__meta">
                            {msg.live && <span className="ap-ai__data-indicator"><LockKeyhole size={12} /> {t('assistant_from_records')}</span>}
                            <button type="button" className="ap-ai__copy" onClick={() => copyAnswer(msg)} aria-label={t('assistant_copy_answer')}>
                              {copiedId === msg.id ? <><Check size={13} /> {t('assistant_copied')}</> : <><Copy size={13} /> {t('assistant_copy')}</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="ap-ai__message ap-ai__message--assistant" role="status">
                      <span className="ap-ai__mini-avatar" aria-hidden="true"><Bot size={16} /></span>
                      <div className="ap-ai__typing"><span>{t('assistant_thinking')}</span><span className="ap-ai__dots" aria-hidden="true"><i /><i /><i /></span></div>
                    </div>
                  )}
                </div>
                <form className="ap-ai__composer" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
                  <div className="ap-ai__composer-box">
                    <label htmlFor="ap-ai-question" className="ap-ai__sr-only">{t('assistant_ask_label')}</label>
                    <textarea
                      id="ap-ai-question"
                      ref={inputRef}
                      rows={1}
                      value={draft}
                      disabled={!contextMatches || !status?.enabled || busy || loadingMessages || (role === 'super_admin' && !viewCompanyId)}
                      placeholder={t(status?.enabled ? 'assistant_ask_placeholder' : 'assistant_unavailable_short')}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={MAX_QUESTION}
                      onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(draft); } }}
                    />
                    <div className="ap-ai__composer-foot">
                      <span className="ap-ai__composer-hint">
                        {draft.length > MAX_QUESTION - 500
                          ? t('assistant_characters_left', { count: MAX_QUESTION - draft.length })
                          : t('assistant_keyhint')}
                      </span>
                      <button type="submit" aria-label={t('assistant_send_aria')} disabled={!contextMatches || !status?.enabled || busy || loadingMessages || !draft.trim() || (role === 'super_admin' && !viewCompanyId)}><ArrowUp size={18} /></button>
                    </div>
                  </div>
                </form>
                <div className="ap-ai__disclaimer"><LockKeyhole size={12} /> {t('assistant_disclaimer')}</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
