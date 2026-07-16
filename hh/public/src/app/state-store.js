/**
 * state-store.js
 *
 * Minimal pub/sub store for cross-module ephemeral UI state (e.g. current
 * guest session countdown, unread notification count, connection status).
 *
 * This is intentionally NOT a full state-management library. It exists so
 * feature modules (chat, gallery, notifications, session-timer) can share
 * small bits of live state without importing each other directly or
 * reaching into the DOM. Firestore itself remains the source of truth for
 * anything persistent — this store only ever holds derived/ephemeral
 * client state.
 *
 * Usage:
 *   import { store } from '../app/state-store.js';
 *   store.set('unreadChatCount', 3);
 *   const unsubscribe = store.subscribe('unreadChatCount', (value) => { ... });
 */

class StateStore {
  constructor() {
    this._state = new Map();
    this._listeners = new Map(); // key -> Set<callback>
  }

  get(key) {
    return this._state.get(key);
  }

  set(key, value) {
    this._state.set(key, value);
    const callbacks = this._listeners.get(key);
    if (callbacks) {
      for (const cb of callbacks) cb(value);
    }
  }

  /**
   * Subscribe to changes on a given key. Returns an unsubscribe function.
   * Does NOT immediately invoke the callback with the current value —
   * callers should read `.get(key)` first if they need the initial value.
   */
  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    return () => {
      this._listeners.get(key)?.delete(callback);
    };
  }
}

export const store = new StateStore();
