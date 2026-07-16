/**
 * toast.js
 *
 * Lightweight, dependency-free toast notification system. Any module can
 * call `showToast(...)` without managing its own DOM container — this
 * module owns a single toast stack mounted once into the document.
 */

import { createEl } from './utilities.js';
import { CONFIG } from './constants.js';

const TOAST_VARIANTS = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
});

let containerEl = null;

function ensureContainer() {
  if (containerEl) return containerEl;
  containerEl = createEl('div', {
    classNames: ['toast-stack'],
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  document.body.appendChild(containerEl);
  return containerEl;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {{ variant?: 'info'|'success'|'warning'|'danger', duration?: number }} [options]
 * @returns {() => void} dismiss function, callable early if needed
 */
export function showToast(message, options = {}) {
  const { variant = TOAST_VARIANTS.INFO, duration = CONFIG.TOAST_DEFAULT_DURATION_MS } = options;

  const container = ensureContainer();

  const toastEl = createEl('div', {
    classNames: ['toast', `toast-${variant}`],
    attrs: { role: 'status' },
  });

  const messageEl = createEl('span', { classNames: ['toast-message'], text: message });
  const closeBtn = createEl('button', {
    classNames: ['toast-close'],
    attrs: { type: 'button', 'aria-label': 'Dismiss notification' },
    text: '×',
  });

  toastEl.appendChild(messageEl);
  toastEl.appendChild(closeBtn);
  container.appendChild(toastEl);

  requestAnimationFrame(() => {
    toastEl.classList.add('toast-visible');
  });

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    toastEl.classList.remove('toast-visible');
    toastEl.addEventListener(
      'transitionend',
      () => {
        toastEl.remove();
      },
      { once: true }
    );
  }

  closeBtn.addEventListener('click', dismiss);
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return dismiss;
}

export function showSuccessToast(message, options = {}) {
  return showToast(message, { ...options, variant: TOAST_VARIANTS.SUCCESS });
}

export function showErrorToast(message, options = {}) {
  return showToast(message, { ...options, variant: TOAST_VARIANTS.DANGER });
}

export function showWarningToast(message, options = {}) {
  return showToast(message, { ...options, variant: TOAST_VARIANTS.WARNING });
}

export { TOAST_VARIANTS };
