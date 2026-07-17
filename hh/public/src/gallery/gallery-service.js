/**
 * gallery-service.js
 *
 * Client data-access layer for the gallery: paginated media fetching
 * (cursor-based, for infinite scroll), category fetching, and the two
 * guest-privileged actions (record view, toggle like). UI code
 * (gallery-ui.js, gallery-viewer.js, built in later batches) only ever
 * imports from here — never touches Firestore or Cloud Functions
 * directly, same separation already used for chat-service.js / chat-api.js.
 *
 * Deliberately a one-shot paginated fetch, not a realtime onSnapshot
 * listener — a gallery feed can grow large, and there's no product
 * reason for it to update live the way chat does. Each page is fetched
 * once; the UI re-fetches when the guest changes a filter or scrolls
 * to the next page.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocsFromServer,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../shared/firebase-config.js';
import { COLLECTIONS, CONFIG, FUNCTION_NAMES, MEDIA_STATUS } from '../shared/constants.js';
import { callFunction } from '../shared/http-client.js';
import { getSessionToken } from '../guest/session-store.js';
import { showErrorToast } from '../shared/toast.js';

/**
 * In-memory guard against redundant recordView calls for the same media
 * within one page session — the server is the REAL idempotency guard
 * (a deterministic views/{mediaId_actorId} doc), this just avoids firing
 * the network call repeatedly if an IntersectionObserver re-triggers as
 * a card scrolls in and out of view multiple times.
 */
const recordedViewsThisSession = new Set();

/**
 * Fetch one page of active media, newest first. Pass the previous page's
 * `nextCursor` to get the next page; omit it for the first page.
 *
 * @param {{ categoryId?: string, type?: 'photo'|'video', cursor?: object }} params
 * @returns {Promise<{ items: Array<object & { id: string }>, nextCursor: object|null }>}
 */
export async function fetchMediaPage({ categoryId, type, cursor } = {}) {
  const constraints = [where('status', '==', MEDIA_STATUS.ACTIVE)];

  if (categoryId) constraints.push(where('categoryId', '==', categoryId));
  if (type) constraints.push(where('type', '==', type));

  constraints.push(orderBy('createdAt', 'desc'));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(CONFIG.GALLERY_PAGE_SIZE));

  const mediaQuery = query(collection(db, COLLECTIONS.MEDIA), ...constraints);
  // getDocsFromServer, not getDocs — the app's persistent local cache
  // (enabled for offline support in firebase-config.js) can otherwise
  // satisfy a read from an old cached snapshot of a document without a
  // real server round-trip, which caused a real bug: newly-added fields
  // on an edited document (e.g. adding `url` after the doc already
  // existed) silently rendering as `undefined` client-side even though
  // the server copy was correct. Gallery reads are infrequent enough
  // (paginated, not a hot loop) that always hitting the server here is
  // the right tradeoff over cache-first reads.
  const snapshot = await getDocsFromServer(mediaQuery);

  const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const nextCursor =
    snapshot.docs.length === CONFIG.GALLERY_PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { items, nextCursor };
}

/**
 * Fetch active categories for the filter row, in display order.
 */
export async function fetchCategories() {
  const categoriesQuery = query(
    collection(db, COLLECTIONS.CATEGORIES),
    where('active', '==', true),
    orderBy('sortOrder', 'asc')
  );
  const snapshot = await getDocsFromServer(categoriesQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

/**
 * Record a view for a media item. Safe to call more than once for the
 * same item within one page session — both this in-memory guard and the
 * server's idempotency guard prevent inflating the count. Failures are
 * swallowed (a missed view count isn't worth surfacing to the guest),
 * and the in-memory guard is released on failure so a later retry in
 * the same session is still possible.
 */
export async function recordView(mediaId) {
  if (recordedViewsThisSession.has(mediaId)) return;
  recordedViewsThisSession.add(mediaId);

  try {
    await callFunction(FUNCTION_NAMES.recordMediaView, {
      sessionToken: getSessionToken(),
      mediaId,
    });
  } catch {
    recordedViewsThisSession.delete(mediaId);
  }
}

/**
 * Toggle the current guest's like on a media item.
 * @returns {Promise<boolean|null>} new liked state, or null on failure
 */
export async function toggleLike(mediaId) {
  try {
    const { data } = await callFunction(FUNCTION_NAMES.toggleMediaLike, {
      sessionToken: getSessionToken(),
      mediaId,
    });
    return data.liked;
  } catch (error) {
    showErrorToast(error.message);
    return null;
  }
}
