/**
 * app.js
 *
 * Application boot sequence:
 *   1. Mount the lounge entry gate.
 *   2. Once passed, mount the app shell — either the guest login screen,
 *      or (if a session already exists in sessionStorage, e.g. page
 *      refresh mid-session) straight into the main room.
 *   3. The main room = a small top bar (username, session countdown,
 *      leave button) + the realtime chat panel from the Chat System
 *      module. Gallery / Now Playing / bottom nav don't exist yet — this
 *      is an honest reflection of what's actually built so far, not a
 *      stub pretending to be more.
 */

import { mountLoungeGate } from './lounge-gate.js';
import { createEl } from '../shared/utilities.js';
import { mountGuestLogin } from '../guest/guest-login.js';
import { startSessionTimer, stopSessionTimer, getFormattedTimeRemaining } from '../guest/session-timer.js';
import { hasActiveSession, getUsername, clearSession } from '../guest/session-store.js';
import { showErrorToast } from '../shared/toast.js';
import { mountChat } from '../chat/chat-ui.js';

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
    mountMainRoom(shell);
    return;
  }

  mountGuestLogin(shell, () => {
    shell.innerHTML = '';
    mountMainRoom(shell);
  });
}

function mountMainRoom(shell) {
  const topBar = buildTopBar();
  const chatContainer = createEl('div', { classNames: ['main-room-chat'] });

  shell.appendChild(topBar.el);
  shell.appendChild(chatContainer);

  const teardownChat = mountChat(chatContainer);

  // Keep the top bar's countdown display in sync with the running timer.
  // startSessionTimer() is already running (either from mountAppShell's
  // resume path, or from guest-login.js's own call after redemption) —
  // this just polls the already-ticking countdown to update the badge
  // text, rather than starting a second timer.
  const badgeIntervalId = setInterval(() => {
    const formatted = getFormattedTimeRemaining();
    if (formatted) {
      topBar.setCountdown(formatted);
    } else {
      clearInterval(badgeIntervalId);
    }
  }, 1000);

  topBar.onLeave(() => {
    clearInterval(badgeIntervalId);
    teardownChat();
    stopSessionTimer();
    clearSession();
    window.location.reload();
  });
}

function buildTopBar() {
  const usernameEl = createEl('span', {
    classNames: ['main-room-username'],
    text: getUsername() || '',
  });

  const badge = createEl('span', {
    classNames: ['session-badge'],
  });
  const badgeDot = createEl('span', { classNames: ['session-badge-dot'] });
  const badgeText = createEl('span', { text: '--:--' });
  badge.appendChild(badgeDot);
  badge.appendChild(badgeText);

  const leaveBtn = createEl('button', {
    classNames: ['btn', 'btn-ghost', 'main-room-leave-btn'],
    attrs: { type: 'button' },
    text: 'Leave',
  });

  const el = createEl('header', { classNames: ['main-room-top-bar'] }, [usernameEl, badge, leaveBtn]);

  return {
    el,
    setCountdown(formatted) {
      badgeText.textContent = formatted;
    },
    onLeave(handler) {
      leaveBtn.addEventListener('click', handler);
    },
  };
}

function boot() {
  const root = document.getElementById('app-root');
  mountLoungeGate(root, () => mountAppShell(root));
}

document.addEventListener('DOMContentLoaded', boot);
