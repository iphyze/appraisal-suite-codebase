const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Keep Vite development free from service-worker caching. The PWA is
  // registered in built/production deployments (including `vite preview`).
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then((registration) => {
        // Ask the browser to check for a newer worker when the app is opened.
        registration.update().catch(() => {});
      })
      .catch((error) => {
        // A failed registration must never prevent the appraisal app from loading.
        console.warn('AppraisalSuite PWA service worker registration failed.', error);
      });
  }, { once: true });
};

export default registerServiceWorker;
