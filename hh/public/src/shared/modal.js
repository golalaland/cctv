/**
 * modal.js
 *
 * Reusable glass modal primitive. Feature modules (host profile card,
 * media viewer, admin dialogs, etc.) call `openModal()` with their own
 * content rather than building bespoke overlay/focus-trap/escape-key
 * logic each time.
 */

import { createEl, qsa } from './utilities.js';
import { prefersReducedMotion } from './utilities.js';

let activeModal = null;
let lastFocusedEl = null;

/**
 * @param {{
 *   content: HTMLElement,
 *   labelledBy?: string,
 *   size?: 'sm'|'md'|'lg'|'full',
 *   dismissible?: boolean,
 *   onClose?: () => void,
 * }} options
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function openModal({ content, size = 'md', dismissible = true, onClose } = {}) {
  closeModal(); // enforce single active modal at a time

  lastFocusedEl = document.activeElement;

  const overlay = createEl('div', {
    classNames: ['modal-overlay'],
    attrs: { role: 'presentation' },
  });

  const dialog = createEl('div', {
    classNames: ['modal-dialog', `modal-${size}`],
    attrs: { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' },
  });

  if (dismissible) {
    const closeBtn = createEl('button', {
      classNames: ['modal-close', 'btn-icon'],
      attrs: { type: 'button', 'aria-label': 'Close' },
      text: '×',
    });
    closeBtn.addEventListener('click', () => closeModal());
    dialog.appendChild(closeBtn);
  }

  dialog.appendChild(content);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  if (dismissible) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && dismissible) {
      closeModal();
    } else if (e.key === 'Tab') {
      trapFocus(e, dialog);
    }
  }
  document.addEventListener('keydown', handleKeydown);

  requestAnimationFrame(() => {
    overlay.classList.add('modal-visible');
    dialog.focus();
  });

  activeModal = {
    overlay,
    dialog,
    onClose,
    handleKeydown,
  };

  return {
    close: closeModal,
    el: dialog,
  };
}

export function closeModal() {
  if (!activeModal) return;
  const { overlay, onClose, handleKeydown } = activeModal;

  document.removeEventListener('keydown', handleKeydown);
  overlay.classList.remove('modal-visible');
  document.body.classList.remove('modal-open');

  const finish = () => {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
    if (lastFocusedEl instanceof HTMLElement) lastFocusedEl.focus();
    lastFocusedEl = null;
  };

  if (prefersReducedMotion()) {
    finish();
  } else {
    overlay.addEventListener('transitionend', finish, { once: true });
  }

  activeModal = null;
}

function trapFocus(e, dialog) {
  const focusable = qsa(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    dialog
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
