/**
 * lounge-gate.js
 *
 * The entry experience for CCTV — a members-lounge threshold, not a
 * date-of-birth age-verification form. Framed entirely as prestige/
 * exclusivity copy with a single "Enter CCTV" action. Persists the
 * choice in sessionStorage so it only shows once per browser session,
 * consistent with the guest-session model (nothing here is treated as
 * a legal age attestation record — see architecture notes below).
 *
 * This gate is intentionally decoupled from the guest access-code flow
 * (Module: Session Management) — it's an atmosphere/threshold moment
 * that plays before *any* entry path (guest or host login), not part of
 * the access-code redemption logic itself.
 */

import { createEl } from './utilities.js';
import { STORAGE_KEYS, BRAND } from './constants.js';
import { prefersReducedMotion } from './utilities.js';

/**
 * Mounts the lounge gate into the given root if it hasn't already been
 * passed this session. Calls `onEnter` once the seam-open animation
 * completes and the gate is dismissed.
 *
 * @param {HTMLElement} root
 * @param {() => void} onEnter
 */
export function mountLoungeGate(root, onEnter) {
  const alreadyEntered = sessionStorage.getItem(STORAGE_KEYS.LOUNGE_ENTERED) === 'true';

  if (alreadyEntered) {
    onEnter();
    return;
  }

  const gate = buildGateMarkup();
  root.appendChild(gate.el);

  requestAnimationFrame(() => {
    gate.el.classList.add('lounge-gate-visible');
  });

  gate.enterBtn.addEventListener('click', () => {
    sessionStorage.setItem(STORAGE_KEYS.LOUNGE_ENTERED, 'true');
    playSeamOpen(gate.el, () => {
      gate.el.remove();
      onEnter();
    });
  });
}

function buildGateMarkup() {
  const wordmark = createEl('h1', {
    classNames: ['lounge-wordmark'],
    text: BRAND.NAME,
  });

  const eyebrow = createEl('p', {
    classNames: ['lounge-eyebrow'],
    text: 'A members-only address',
  });

  const tagline = createEl('p', {
    classNames: ['lounge-tagline'],
    text: 'What happens inside, stays between us.',
  });

  const enterBtn = createEl('button', {
    classNames: ['lounge-enter-btn', 'btn', 'btn-primary'],
    attrs: { type: 'button' },
    text: 'Enter CCTV',
  });

  const finePrint = createEl('p', {
    classNames: ['lounge-fine-print'],
    text: 'By entering, you confirm you\u2019re 21 or older and here by invitation or admission.',
  });

  const panelLeft = createEl('div', { classNames: ['lounge-seam', 'lounge-seam-left'] });
  const panelRight = createEl('div', { classNames: ['lounge-seam', 'lounge-seam-right'] });

  const content = createEl(
    'div',
    { classNames: ['lounge-content'] },
    [eyebrow, wordmark, tagline, enterBtn, finePrint]
  );

  const el = createEl(
    'div',
    {
      classNames: ['lounge-gate'],
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'CCTV entry' },
    },
    [panelLeft, panelRight, content]
  );

  return { el, enterBtn };
}

function playSeamOpen(gateEl, onComplete) {
  gateEl.classList.add('lounge-gate-opening');

  if (prefersReducedMotion()) {
    onComplete();
    return;
  }

  gateEl.addEventListener(
    'transitionend',
    (e) => {
      if (e.propertyName === 'transform') onComplete();
    },
    { once: true }
  );
}
