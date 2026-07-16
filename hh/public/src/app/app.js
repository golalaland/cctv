/**
 * app.js
 *
 * Application boot sequence. Responsibilities at this stage (Module 1):
 *   1. Mount the lounge entry gate.
 *   2. Once passed, mount a bare app shell container.
 *
 * Later modules extend this file's `mountAppShell()` to route between
 * guest login, host login, and the main chatroom shell — none of that
 * exists yet, so this intentionally stops at a clean handoff point
 * rather than stubbing routes that would just be dead code today.
 */

import { mountLoungeGate } from './lounge-gate.js';
import { createEl } from '../shared/utilities.js';
import { mountGuestLogin } from '../guest/guest-login.js';
import { startSessionTimer } from '../guest/session-timer.js';
import { hasActiveSession } from '../guest/session-store.js';
import { showErrorToast } from '../shared/toast.js';

// Importing firebase-config.js triggers Firebase app initialization and
// (in development) emulator connection as a side effect.
import '../shared/firebase-config.js';

function mountAppShell(root) {
  const shell = createEl('main', {
    classNames: ['app-shell'],
    attrs: { id: 'app-shell' },
  });
  root.appendChild(shell);

  if (hasActiveSession()) {
    // Resume: a session already exists in sessionStorage (e.g. page
    // refresh mid-session) — skip straight past the login form and just
    // restart the countdown against it.
    startSessionTimer({
      onExpire: () => {
        showErrorToast('Your session has expired.');
        window.location.reload();
      },
    });
    mountAuthenticatedPlaceholder(shell);
    return;
  }

  mountGuestLogin(shell, () => {
    shell.innerHTML = '';
    mountAuthenticatedPlaceholder(shell);
  });
}

function mountAuthenticatedPlaceholder(shell) {
  // The main chatroom shell (top bar, Now Playing, chat, bottom nav)
  // doesn't exist yet — that's the Chat System / Now Playing modules.
  // This is an intentional, honest stopping point rather than a stub
  // route pretending to be a real screen.
  shell.appendChild(
    createEl('div', {
      classNames: ['authenticated-placeholder'],
      text: 'You\u2019re in. The main room is being built next.',
    })
  );
}

function boot() {
  const root = document.getElementById('app-root');
  mountLoungeGate(root, () => mountAppShell(root));
}

document.addEventListener('DOMContentLoaded', boot);
