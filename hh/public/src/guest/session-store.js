/**
 * session-store.js
 *
 * The single owner of guest session state on the client. Per the
 * approved architecture: guests are never Firebase Auth users, so this
 * module — not firebase-config.js's `auth` export — is the guest's
 * actual identity layer.
 *
 * Storage strategy (as specified): sessionStorage is the persistence
 * layer (survives page refresh, dies with tab close), backed by an
 * in-memory cache so repeated reads within a page's lifetime don't hit
 * sessionStorage's (synchronous but still non-trivial) API repeatedly,
 * and so a `get()` immediately after a `set()` never has to round-trip
 * through serialization.
 *
 * Every other guest-facing module (chat, gallery, premium purchases,
 * session-timer) reads the current session through this module's
 * exports rather than touching sessionStorage or holding its own copy —
 * this is the client-side mirror of requireGuestSession() being the one
 * place server-side session logic lives.
 */

import { STORAGE_KEYS } from '../shared/constants.js';
import { store } from '../app/state-store.js';

/** In-memory cache, hydrated from sessionStorage on module load. */
let cache = {
  sessionToken: null,
  sessionId: null,
  expiresAt: null, // ms epoch
  username: null,
};

function hydrateFromStorage() {
  cache = {
    sessionToken: sessionStorage.getItem(STORAGE_KEYS.GUEST_SESSION_TOKEN),
    sessionId: sessionStorage.getItem(STORAGE_KEYS.GUEST_SESSION_ID),
    expiresAt: Number(sessionStorage.getItem(STORAGE_KEYS.GUEST_SESSION_EXPIRES_AT)) || null,
    username: sessionStorage.getItem(STORAGE_KEYS.GUEST_USERNAME),
  };
}

hydrateFromStorage();

/**
 * Persist a newly redeemed session. Called exactly once per redemption,
 * immediately after redeemAccessCode's callable response.
 */
export function setSession({ sessionToken, sessionId, expiresAt, username }) {
  cache = { sessionToken, sessionId, expiresAt, username };

  sessionStorage.setItem(STORAGE_KEYS.GUEST_SESSION_TOKEN, sessionToken);
  sessionStorage.setItem(STORAGE_KEYS.GUEST_SESSION_ID, sessionId);
  sessionStorage.setItem(STORAGE_KEYS.GUEST_SESSION_EXPIRES_AT, String(expiresAt));
  sessionStorage.setItem(STORAGE_KEYS.GUEST_USERNAME, username);

  store.set('guestSession', { ...cache });
}

/** Update just the expiresAt (used after syncServerTime re-syncs). */
export function updateExpiresAt(expiresAt) {
  cache.expiresAt = expiresAt;
  sessionStorage.setItem(STORAGE_KEYS.GUEST_SESSION_EXPIRES_AT, String(expiresAt));
  store.set('guestSession', { ...cache });
}

/** Clear the session entirely (logout, expiry, revocation). */
export function clearSession() {
  cache = { sessionToken: null, sessionId: null, expiresAt: null, username: null };

  sessionStorage.removeItem(STORAGE_KEYS.GUEST_SESSION_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.GUEST_SESSION_ID);
  sessionStorage.removeItem(STORAGE_KEYS.GUEST_SESSION_EXPIRES_AT);
  sessionStorage.removeItem(STORAGE_KEYS.GUEST_USERNAME);

  store.set('guestSession', null);
}

export function getSessionToken() {
  return cache.sessionToken;
}

export function getSessionId() {
  return cache.sessionId;
}

export function getExpiresAt() {
  return cache.expiresAt;
}

export function getUsername() {
  return cache.username;
}

/** True if a session is present in storage AND its cached expiry hasn't passed. */
export function hasActiveSession() {
  return Boolean(cache.sessionToken) && Boolean(cache.expiresAt) && cache.expiresAt > Date.now();
}

/**
 * Returns the full current session snapshot. Prefer the specific getters
 * above for a single field — this is for callers (like session-timer.js)
 * that need everything at once.
 */
export function getSessionSnapshot() {
  return { ...cache };
}
