import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardCheck,
  Search,
  Sparkles,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import api from '../services/api';
import { getAiNavigationAvailability, interpretSmartSearch } from '../services/aiAssistant';
import useAuthStore from '../stores/useAuthStore';
import useThemeStore from '../stores/useThemeStore';
import AppIcon from './ui/AppIcon';
import './GlobalSearch.css';

const typeIcon = {
  user: User,
  supervisor: UserCheck,
  staff: Users,
  appraisal: ClipboardCheck,
  cycle: CalendarCheck,
  department: Building2,
  question: CircleHelp,
  smart: Sparkles,
};

const GlobalSearch = () => {
  const { t, i18n: languageContext } = useTranslation('nav');
  const { theme } = useThemeStore();
  const role = useAuthStore((state) => state.user?.role);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [resultsQuery, setResultsQuery] = useState('');
  const [smartEnabled, setSmartEnabled] = useState(false);
  const [smartState, setSmartState] = useState({ query: '', result: null });
  const [smartLoading, setSmartLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const searchText = query.trim();
  const canSearch = searchText.length >= 2;
  const canInterpret = smartEnabled && searchText.length >= 3 && searchText.length <= 200;

  useEffect(() => {
    let active = true;
    const refresh = () => getAiNavigationAvailability()
      .then((features) => { if (active) setSmartEnabled(!!features?.tools?.smart_search); })
      .catch(() => { if (active) setSmartEnabled(false); });
    refresh();
    window.addEventListener('appraisalsuite:ai-settings-updated', refresh);
    return () => { active = false; window.removeEventListener('appraisalsuite:ai-settings-updated', refresh); };
  }, [role]);

  const openSearch = () => {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  };

  const closeSearch = () => setOpen(false);

  useEffect(() => {
    const handler = (event) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
      if (event.key === 'Escape') closeSearch();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    // Do not offer a result for the previous query while the new one loads.
    setResultsQuery('');
    setResults([]);
    if (!canSearch) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/search/global?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(response.data?.data || []);
          setResultsQuery(query.trim());
          setActiveIndex(0);
        }
      } catch (error) {
        if (!controller.signal.aborted && error.name !== 'CanceledError') setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, canSearch, languageContext.language]);

  useEffect(() => {
    if (!canInterpret) {
      setSmartState({ query: '', result: null });
      setSmartLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setSmartState({ query: '', result: null });
    setSmartLoading(false);
    const timer = setTimeout(async () => {
      setSmartLoading(true);
      try {
        const result = await interpretSmartSearch(searchText, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setSmartState({ query: searchText, result });
          setActiveIndex(0);
        }
      } catch (error) {
        // On unrecognized requests or disabled service, retain ordinary keyword search.
        if (!controller.signal.aborted) setSmartState({ query: searchText, result: null });
      } finally {
        if (!controller.signal.aborted) setSmartLoading(false);
      }
    }, 260);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchText, canInterpret, languageContext.language]);

  const suggested = canInterpret && smartState.query === searchText ? smartState.result : null;
  const visibleResults = resultsQuery === searchText ? results : [];
  const searchResults = useMemo(() => suggested?.url ? [{
    ...suggested, key: `smart:${suggested.url}`, type: 'smart', group: t('suggested_action'),
  }, ...visibleResults] : visibleResults, [suggested, visibleResults]);

  const grouped = useMemo(() => searchResults.reduce((acc, item) => {
    const group = item.group || item.type || 'Results';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {}), [searchResults]);

  const flatResults = useMemo(() => Object.values(grouped).flat(), [grouped]);

  useEffect(() => {
    setActiveIndex((prev) => Math.max(0, Math.min(prev, flatResults.length - 1)));
  }, [flatResults.length]);

  const goTo = (item) => {
    if (!item?.url) return;
    closeSearch();
    setQuery('');
    navigate(item.url);
  };

  const handleKeyDown = (event) => {
    if (!flatResults.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      goTo(flatResults[activeIndex]);
    }
  };

  const searchModal = (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`global-search__overlay theme-${theme}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          <motion.section
            className="global-search__panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('global_search')}
            initial={{ opacity: 0, y: 14, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="global-search__input-wrap">
              <span className="global-search__search-mark">
                <AppIcon icon={Search} size={18} />
              </span>
              <input
                ref={inputRef}
                name="global_search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={smartEnabled ? t('search_smart_placeholder') : t('search_placeholder')}
              />
              {query && (
                <button type="button" className="global-search__clear" onClick={() => setQuery('')} aria-label={t('clear_search')}>
                  <AppIcon icon={X} size={16} />
                </button>
              )}
              <kbd className="global-search__esc">Esc</kbd>
            </div>

            <div className="global-search__body">
              {!canSearch && (
                <div className="global-search__empty">
                  <span className="global-search__empty-icon"><AppIcon icon={Search} size={22} /></span>
                  <strong>{t('search_workspace')}</strong>
                  <small>{t('search_tip')}</small>
                </div>
              )}

              {canSearch && loading && !flatResults.length && (
                <div className="global-search__empty global-search__empty--inline">
                  <span className="global-search__spinner" />
                  <strong>{t('searching')}</strong>
                </div>
              )}

              {canSearch && !loading && !smartLoading && !flatResults.length && (
                <div className="global-search__empty">
                  <span className="global-search__empty-icon"><AppIcon icon={Search} size={22} /></span>
                  <strong>{t('no_matching_results')}</strong>
                  <small>{t('search_suggestion')}</small>
                </div>
              )}

              {!loading && Object.entries(grouped).map(([group, items]) => (
                <div className="global-search__group" key={group}>
                  <span>{group}</span>
                  {items.map((item) => {
                    const itemIndex = flatResults.findIndex((row) => row.key === item.key);
                    const ResultIcon = typeIcon[item.type] || Search;
                    return (
                      <button
                        type="button"
                        className={`global-search__item ${itemIndex === activeIndex ? 'global-search__item--active' : ''}`}
                        key={item.key}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => goTo(item)}
                      >
                        <span className="global-search__item-icon"><AppIcon icon={ResultIcon} size={17} /></span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.subtitle}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="global-search__footer" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> {t('navigate')}</span>
              <span><kbd>Enter</kbd> {t('open')}</span>
              <span><kbd>Esc</kbd> {t('close')}</span>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className={`global-search theme-${theme}`}>
        <button type="button" className="global-search__trigger" onClick={openSearch}>
          <AppIcon icon={Search} size={16} />
          <span>{t('search_trigger')}</span>
          <kbd>Ctrl K</kbd>
        </button>

        <button type="button" className="global-search__mobile" onClick={openSearch} aria-label={t('open_search')}>
          <AppIcon icon={Search} size={17} />
        </button>
      </div>

      {typeof document !== 'undefined' && createPortal(searchModal, document.body)}
    </>
  );
};

export default GlobalSearch;
