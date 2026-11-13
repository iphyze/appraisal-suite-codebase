export const focusFirstInvalidField = (rootElement, selector = '[data-invalid="true"], [aria-invalid="true"], .apr-field--error, .apr-rating-control--error, .apr-rating-cards--error, .apr-kpi-weight-input--error, .apr-kpi-weighting-panel--error, .apr-overall-rating--error, .app-select--error input, .app-select--error button, .app-date--error input, .app-date--error button') => {
  const root = rootElement || document;
  const element = root.querySelector(selector);
  if (!element) return false;

  const focusable = element.matches('input, textarea, button, select')
    ? element
    : element.querySelector('input, textarea, button, select');

  element.classList.add('form-error-focus');
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  window.setTimeout(() => focusable?.focus?.({ preventScroll: true }), 260);
  window.setTimeout(() => element.classList.remove('form-error-focus'), 1900);
  return true;
};

export const notifyAndFocusFormErrors = (rootElement, showToast, message = 'Please correct the highlighted fields before continuing.') => {
  showToast?.(message, 'error');
  window.setTimeout(() => focusFirstInvalidField(rootElement), 20);
};
