/**
 * app.js
 *
 * Application boot sequence:
 *   1. Mount the lounge entry gate.
 *   2. Once passed, mount the app shell — either the guest login screen,
 *      or (if a session already exists in sessionStorage, e.g. page
 *      refresh mid-session) straight into the main room.
 *   3. The main room = top bar (username, session countdown, leave) +
 *      a two-tab switcher between Chat and Gallery. This is a
 *      deliberately simple tab bar, not the full bottom navigation
 *      (Chat/Gallery/TV/Hosts/Profile) described in the original spec —
 *      that belongs to a later polish pass once Now Playing and Hosts
 *      exist too and there's enough to actually navigate between.
 *
 * Tab switching tears down whichever module is currently mounted
 * (stopping its Firestore listener / IntersectionObserver) before
 * mounting the other — neither Chat nor Gallery run in the background
 * while the other tab is active.
 */

import { mountLoungeGate } from './lounge-gate.js';
import { createEl } from '../shared/utilities.js';
import { mountGuestLogin } from '../guest/guest-login.js';
import { startSessionTimer, stopSessionTimer, getFormattedTimeRemaining } from '../guest/session-timer.js';
import { hasActiveSession, getUsername, clearSession } from '../guest/session-store.js';
import { showErrorToast } from '../shared/toast.js';
import { mountChat } from '../chat/chat-ui.js';
import { mountGallery } from '../gallery/gallery-ui.js';
import { openMediaViewer } from '../gallery/gallery-viewer.js';

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
  const tabBar = buildTabBar();
  const content = createEl('div', { classNames: ['main-room-content'] });

  shell.appendChild(topBar.el);
  shell.appendChild(tabBar.el);
  shell.appendChild(content);

  let activeTeardown = null;

  function mountTab(tab) {
    if (activeTeardown) activeTeardown();
    content.innerHTML = '';

    if (tab === 'gallery') {
      activeTeardown = mountGallery(content, {
        onMediaOpen: (item, items, index) => openMediaViewer(item, items, index),
      });
    } else {
      activeTeardown = mountChat(content);
    }

    tabBar.setActive(tab);
  }

  tabBar.onSelect(mountTab);
  mountTab('chat');

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
    if (activeTeardown) activeTeardown();
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

function buildTabBar() {
  const chatBtn = createEl('button', {
    classNames: ['main-tab-btn'],
    attrs: { type: 'button' },
    text: 'Chat',
  });
  const galleryBtn = createEl('button', {
    classNames: ['main-tab-btn'],
    attrs: { type: 'button' },
    text: 'Gallery',
  });

  const el = createEl('nav', { classNames: ['main-tab-bar'] }, [chatBtn, galleryBtn]);

  let selectHandler = null;
  chatBtn.addEventListener('click', () => selectHandler?.('chat'));
  galleryBtn.addEventListener('click', () => selectHandler?.('gallery'));

  return {
    el,
    onSelect(handler) {
      selectHandler = handler;
    },
    setActive(tab) {
      chatBtn.classList.toggle('main-tab-btn-active', tab === 'chat');
      galleryBtn.classList.toggle('main-tab-btn-active', tab === 'gallery');
    },
  };
}

function boot() {
  const root = document.getElementById('app-root');
  mountLoungeGate(root, () => mountAppShell(root));
}

document.addEventListener('DOMContentLoaded', boot);
