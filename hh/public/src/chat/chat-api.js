/**
 * chat-api.js
 *
 * Low-level chat data access layer. Owns every direct Firestore query and
 * every raw Cloud Function call related to chat. chat-service.js is the
 * only module that should import from here — UI code (chat-ui.js) talks
 * to chat-service.js, never to this file directly, so Firestore query
 * shapes can change without touching rendering code.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../shared/firebase-config.js';
import { COLLECTIONS, CONFIG, FUNCTION_NAMES } from '../shared/constants.js';
import { callFunction } from '../shared/http-client.js';

const ROOM_ID = 'main';

/**
 * Subscribe to the most recent page of messages in realtime, ordered
 * oldest-first for rendering (the query itself runs newest-first so
 * `limit()` keeps the most recent N, then the results are reversed
 * before handing them to the callback).
 *
 * @param {(messages: Array<object & { id: string }>) => void} onChange
 * @returns {() => void} unsubscribe function
 */
export function subscribeToRecentMessages(onChange) {
  const messagesQuery = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('roomId', '==', ROOM_ID),
    orderBy('createdAt', 'desc'),
    limit(CONFIG.CHAT_MESSAGE_PAGE_SIZE)
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).reverse();
    onChange(messages);
  });
}

/**
 * One-time fetch of a page of messages older than the given message,
 * for "load more" / scroll-back pagination. Returns oldest-first, same
 * as the realtime subscription, so callers can prepend directly.
 *
 * @param {object} oldestLoadedMessage - the current oldest message's raw
 *   Firestore data (must include createdAt) to page backward from.
 */
export async function fetchOlderMessages(oldestLoadedMessage) {
  const messagesQuery = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('roomId', '==', ROOM_ID),
    orderBy('createdAt', 'desc'),
    startAfter(oldestLoadedMessage.createdAt),
    limit(CONFIG.CHAT_MESSAGE_PAGE_SIZE)
  );

  const snapshot = await getDocs(messagesQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).reverse();
}

/** @returns {Promise<{ data: { messageId: string } }>} */
export function sendMessageRequest({ sessionToken, text, replyToId }) {
  return callFunction(FUNCTION_NAMES.sendMessage, { sessionToken, text, replyToId: replyToId ?? null });
}

/** @returns {Promise<{ data: { reacted: boolean } }>} */
export function toggleReactionRequest({ sessionToken, messageId, emoji }) {
  return callFunction(FUNCTION_NAMES.toggleReaction, { sessionToken, messageId, emoji });
}

/** @returns {Promise<{ data: { success: true } }>} */
export function deleteOwnMessageRequest({ sessionToken, messageId }) {
  return callFunction(FUNCTION_NAMES.deleteOwnMessage, { sessionToken, messageId });
}

/** @returns {Promise<{ data: { success: true } }>} */
export function reportMessageRequest({ sessionToken, messageId, reason }) {
  return callFunction(FUNCTION_NAMES.reportMessage, { sessionToken, messageId, reason });
}

/** @returns {Promise<{ data: { success: true } }>} */
export function moderateMessageRequest({ messageId, action }) {
  return callFunction(FUNCTION_NAMES.moderateMessage, { messageId, action });
}
