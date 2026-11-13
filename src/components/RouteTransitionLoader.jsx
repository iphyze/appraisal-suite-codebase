import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import appraisalSuiteMark from '../assets/images/appraisalsuite/logo/appraisalsuite-mark-128px.png';
import { NAVIGATION_START } from '../utils/navigationSignals';

const PANEL_DELAY_MS = 450; // the centred panel only appears when a page is genuinely slow
const GIVE_UP_MS = 20000; // never leave the loader up if something else goes wrong

/**
 * Feedback while moving between pages:
 * - a slim progress bar at the top appears straight away on any navigation;
 * - if the next page takes longer than PANEL_DELAY_MS, the AppraisalSuite panel appears too;
 * - both disappear once the new page has actually been painted.
 */
const RouteTransitionLoader = () => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [panel, setPanel] = useState(false);
  const renderedPathRef = useRef(location.pathname);
  const targetRef = useRef('');
  const panelTimerRef = useRef(null);
  const giveUpTimerRef = useRef(null);
  const finishTimerRef = useRef(null);

  useEffect(() => {
    const clearTimers = () => {
      window.clearTimeout(panelTimerRef.current);
      window.clearTimeout(giveUpTimerRef.current);
      window.clearTimeout(finishTimerRef.current);
    };
    const reset = () => {
      clearTimers();
      targetRef.current = '';
      setPending(false);
      setFinishing(false);
      setPanel(false);
    };
    const start = (pathname) => {
      if (!pathname || pathname === renderedPathRef.current) return;
      targetRef.current = pathname;
      clearTimers();
      setFinishing(false);
      setPending(true);
      panelTimerRef.current = window.setTimeout(() => setPanel(true), PANEL_DELAY_MS);
      giveUpTimerRef.current = window.setTimeout(reset, GIVE_UP_MS);
    };

    const onNavigationStart = (event) => start(event.detail?.pathname);
    const onLinkClick = (event) => {
      // Gives feedback even before the router has handled the click.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let next;
      try { next = new URL(anchor.href, window.location.href); } catch { return; }
      if (next.origin !== window.location.origin) return;
      start(next.pathname);
    };

    window.addEventListener(NAVIGATION_START, onNavigationStart);
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener(NAVIGATION_START, onNavigationStart);
      document.removeEventListener('click', onLinkClick, true);
      clearTimers();
    };
  }, []);

  // The new page has rendered: wait for it to be painted, then complete and fade out.
  useEffect(() => {
    renderedPathRef.current = location.pathname;
    if (!targetRef.current) return undefined;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        window.clearTimeout(panelTimerRef.current);
        window.clearTimeout(giveUpTimerRef.current);
        targetRef.current = '';
        setPanel(false);
        setFinishing(true);
        finishTimerRef.current = window.setTimeout(() => {
          setPending(false);
          setFinishing(false);
        }, 260);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [location.pathname, location.key]);

  return (
    <>
      <div
        className={`route-progress ${pending ? 'route-progress--active' : ''} ${finishing ? 'route-progress--done' : ''}`}
        role="progressbar"
        aria-label={t('loading_page')}
        aria-hidden={!pending}
      >
        <span className="route-progress__bar" />
      </div>
      <div className={`route-loader ${panel ? 'route-loader--visible' : ''}`} aria-hidden={!panel}>
        <div className="route-loader__panel" role="status" aria-live="polite">
          <span className="route-loader__mark-wrap" aria-hidden="true">
            <img src={appraisalSuiteMark} alt="" className="route-loader__mark" />
            <span className="route-loader__orbit" />
          </span>
          <div className="route-loader__copy">
            <strong>AppraisalSuite</strong>
            <span>{t('opening_page')}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default RouteTransitionLoader;
