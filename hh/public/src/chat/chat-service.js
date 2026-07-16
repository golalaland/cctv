/**
 * chat-service.js
 *
 * Business logic glue between chat-api.js (raw Firestore/Functions calls)
 * and chat-ui.js (rendering). Owns:
 *   - the current realtime subscription lifecycle
 *   - reaction toggle debouncing (prevents double-fire from rapid taps)
 *   - pagination state for "load older messages"
 *
 * chat-ui.js should only ever call functions exported from this module,
 * never chat-api.js directly — this is what lets the eventual host/admin
 * auth path (Firebase Auth uid instead of a guest session token) be added
 * later without touching rendering code.
 */

import { getSessionToken } from '../guest/session-store.js';
import { showErrorToast } from '../shared/toast.js';
import {
  subscribeToRecentMessages,
  fetchOlderMessages,
  sendMessageRequest,
  toggleReactionRequest,
  deleteOwnMessageRequest,
} from './chat-api.js';

/** Tracks messageIds currently mid-toggle so a rapid double-tap is a no-op, not a double-send. */
const pendingReactionToggles = new Set();

let currentUnsubscribe = null;
let oldestLoadedMessage = null;
let noMoreOlderMessages = false;

/**
 * Start the realtime chat subscription. Calling this again (e.g. on
 * reconnect) tears down any prior subscription first.
 *
 * @param {(messages: Array<object>) => void} onMessagesChange
 */
export function startChatSubscription(onMessagesChange) {
  stopChatSubscription();

  currentUnsubscribe = subscribeToRecentMessages((messages) => {
    if (messages.length > 0) {
      oldestLoadedMessage = messages[0];
    }
    onMessagesChange(messages);
  });
}

export function stopChatSubscription() {
  if (currentUnsubscribe) {
    currentUnsubscribe();
    currentUnsubscribe = null;
  }
  oldestLoadedMessage = null;
  noMoreOlderMessages = false;
}

/**
 * Load the next page of older messages for scroll-back pagination.
 * @returns {Promise<Array<object>>} older messages, oldest-first, or []
 *   if there are no more to load.
 */
export async function loadOlderMessages() {
  if (noMoreOlderMessages || !oldestLoadedMessage) return [];

  try {
    const older = await fetchOlderMessages(oldestLoadedMessage);
    if (older.length === 0) {
      noMoreOlderMessages = true;
      return [];
    }
    oldestLoadedMessage = older[0];
    return older;
  } catch {
    showErrorToast('Couldn\u2019t load older messages. Try again in a moment.');
    return [];
  }
}

/**
 * Send a message. Returns the server-assigned messageId on success. The
 * realtime subscription will surface the new message on its own once
 * Firestore propagates it — this function does not synthesize an
 * optimistic local copy, since the round-trip is fast enough (single
 * region, small payload) that the perceived latency of waiting for the
 * real listener update is preferred over reconciling an optimistic
 * placeholder against the eventual real document.
 *
 * @param {{ text: string, replyToId?: string }} params
 */
export async function sendChatMessage({ text, replyToId }) {
  const sessionToken = getSessionToken();

  try {
    const { data } = await sendMessageRequest({ sessionToken, text, replyToId });
    return data.messageId;
  } catch (error) {
    showErrorToast(error.message);
    throw error;
  }
}

/**
 * Toggle the current guest's reaction on a message. Guards against
 * duplicate concurrent toggles on the same message via
 * pendingReactionToggles — a second call for a messageId already mid-
 * flight is silently ignored rather than queued, since the UI already
 * reflects the pending state optimistically (see chat-ui.js).
 *
 * @param {{ messageId: string, emoji: string }} params
 * @returns {Promise<boolean|null>} the new reacted state, or null if the
 *   call was ignored due to an in-flight toggle on the same message.
 */
export async function toggleMessageReaction({ messageId, emoji }) {
  const toggleKey = `${messageId}:${emoji}`;
  if (pendingReactionToggles.has(toggleKey)) return null;

  pendingReactionToggles.add(toggleKey);
  const sessionToken = getSessionToken();

  try {
    const { data } = await toggleReactionRequest({ sessionToken, messageId, emoji });
    return data.reacted;
  } catch (error) {
    showErrorToast(error.message);
    return null;
  } finally {
    pendingReactionToggles.delete(toggleKey);
  }
}

/**
 * Delete a message the current guest authored, within the server-
 * enforced time window.
 * @param {string} messageId
 */
export async function deleteMyMessage(messageId) {
  const sessionToken = getSessionToken();

  try {
    await deleteOwnMessageRequest({ sessionToken, messageId });
    return true;
  } catch (error) {
    showErrorToast(error.message);
    return false;
  }
}
