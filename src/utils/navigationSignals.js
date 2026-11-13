/**
 * Announces every page change the moment it starts, however it was triggered:
 * links, buttons calling navigate(), redirects, or the browser's Back/Forward.
 *
 * React Router updates the address bar immediately but keeps the old page on screen
 * while the next page's code downloads (a "transition"). Without a signal, clicks on
 * buttons look ignored. RouteTransitionLoader listens for this event.
 */
export const NAVIGATION_START = 'appraisalsuite:navigation-start';

let installed = false;

const announce = (pathname) => {
  window.dispatchEvent(new CustomEvent(NAVIGATION_START, { detail: { pathname } }));
};

export const installNavigationSignals = () => {
  if (installed || typeof window === 'undefined' || !window.history) return;
  installed = true;
  ['pushState', 'replaceState'].forEach((method) => {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(...args) {
      const before = window.location.pathname;
      const result = original.apply(this, args);
      const after = window.location.pathname;
      // Query-only changes (filters, tabs) stay instant and silent.
      if (after !== before) announce(after);
      return result;
    };
  });
  window.addEventListener('popstate', () => announce(window.location.pathname));
};
