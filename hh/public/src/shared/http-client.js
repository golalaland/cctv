/**
 * http-client.js
 *
 * Thin wrapper around Firebase Callable Functions so every module
 * invokes Functions the same way and gets consistent error surfacing
 * (HttpsError messages are user-safe by design — see /functions/shared/
 * http-errors.js — so they can be shown directly).
 */

import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import { functions } from './firebase-config.js';

const callableCache = new Map();

function getCallable(name) {
  if (!callableCache.has(name)) {
    callableCache.set(name, httpsCallable(functions, name));
  }
  return callableCache.get(name);
}

/**
 * Call a Cloud Function by name with a data payload.
 * @returns {Promise<{ data: any }>} the raw callable result — callers
 *   destructure `.data` themselves so this wrapper stays agnostic to
 *   each function's response shape.
 * @throws {Error} with a `.message` safe to display to the user directly
 *   (HttpsError messages are already user-facing text server-side).
 */
export async function callFunction(name, payload = {}) {
  const callable = getCallable(name);
  try {
    return await callable(payload);
  } catch (error) {
    // Firebase wraps HttpsError as a FunctionsError with a `.message`
    // that is exactly the message the Function threw — safe to surface.
    const message = error?.message || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
}
