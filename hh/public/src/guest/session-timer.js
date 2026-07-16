/**
 * session-timer.js
 *
 * Client-side countdown display and expiry UX. This module is
 * explicitly COSMETIC — real enforcement is server-side, via
 * requireGuestSession()'s lazy expiry check on every call and the
 * expireSessions scheduled sweep (see functions/sessions/). This module
 * exists purely so a guest sees an accurate, live-updating countdown and
 * gets a graceful warning + redirect rather than just having their next
 * action silently fail.
 *
 * Clock trust: rather than trusting the browser's Date.now() against the
 * stored expiresAt indefinitely, this module periodically calls
 * syncServerTime (every CONFIG.SESSION_SYNC_INTERVAL_MS) and computes
 * remaining time as an offset from the server's clock, not the client's.
 */

import { CONFIG, STORAGE_KEYS, FUNCTION_NAMES } from '../shared/constants.js';
import { callFunction } from '../shared/http-client.js';
import { formatCountdown } from '../shared/utilities.js';
import { showWarningToast } from '../shared/toast.js';
import { store } from '../app/state-store.js';
import {
  getSessionToken,
  getExpiresAt,
  updateExpiresAt,
  clearSession,
  hasActiveSession,
} from './session-store.js';

let tickIntervalId = null;
let syncIntervalId = null;
let warningShown = false;
let onExpireCallback = null;

/**
 * Server clock offset: serverNow - clientNow at last sync. Added to the
 * client's own Date.now() to approximate current server time between
 * syncs without a network call on every tick.
 */
let serverOffsetMs = 0;

/**
 * Start the countdown for the current session. Call once after a
 * session is established (fresh redemption, or on page load if a
 * session is already active in sessionStorage).
 *
 * @param {{ onTick?: (msRemaining: number) => void, onExpire: () => void }} handlers
 */
export function startSessionTimer({ onTick, onExpire }) {
  stopSessionTimer();
  onExpireCallback = onExpire;
  warningShown = false;

  syncNow(); // establish an initial offset immediately rather than waiting a full interval

  syncIntervalId = setInterval(syncNow, CONFIG.SESSION_SYNC_INTERVAL_MS);

  tickIntervalId = setInterval(() => {
    tick(onTick);
  }, 1000);

  tick(onTick);
}

export function stopSessionTimer() {
  if (tickIntervalId) clearInterval(tickIntervalId);
  if (syncIntervalId) clearInterval(syncIntervalId);
  tickIntervalId = null;
  syncIntervalId = null;
}

function estimatedServerNow() {
  return Date.now() + serverOffsetMs;
}

function tick(onTick) {
  if (!hasActiveSession()) {
    handleExpiry();
    return;
  }

  const expiresAt = getExpiresAt();
  const msRemaining = expiresAt - estimatedServerNow();

  if (msRemaining <= 0) {
    handleExpiry();
    return;
  }

  const minutesRemaining = msRemaining / 60000;
  if (!warningShown && minutesRemaining <= CONFIG.SESSION_WARNING_MINUTES) {
    warningShown = true;
    showWarningToast(
      `${CONFIG.SESSION_WARNING_MINUTES} minutes remaining on your session.`,
      { duration: 6000 }
    );
  }

  store.set('sessionMsRemaining', msRemaining);
  if (typeof onTick === 'function') {
    onTick(msRemaining);
  }
}

function handleExpiry() {
  stopSessionTimer();
  clearSession();
  sessionStorage.removeItem(STORAGE_KEYS.LOUNGE_ENTERED);
  if (typeof onExpireCallback === 'function') {
    onExpireCallback();
  }
}

async function syncNow() {
  const token = getSessionToken();
  if (!token) return;

  try {
    const { data } = await callFunction(FUNCTION_NAMES.syncServerTime, { sessionToken: token });
    serverOffsetMs = data.serverNow - Date.now();

    if (data.status !== 'active') {
      handleExpiry();
      return;
    }

    if (data.expiresAt !== getExpiresAt()) {
      updateExpiresAt(data.expiresAt);
    }
  } catch {
    // A failed sync (e.g. transient network issue) should not itself log
    // the guest out client-side — the next tick still uses the last
    // known offset, and the server remains the real source of truth
    // regardless of whether this particular sync succeeded.
  }
}

/** Format the currently stored remaining time as "MM:SS", or null if no active session. */
export function getFormattedTimeRemaining() {
  if (!hasActiveSession()) return null;
  const msRemaining = getExpiresAt() - estimatedServerNow();
  return formatCountdown(msRemaining);
}
