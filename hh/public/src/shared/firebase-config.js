/**
 * firebase-config.js
 *
 * Single source of truth for Firebase client SDK initialization. Every
 * other module imports `db`, `auth`, and `functions` from here rather
 * than calling initializeApp()/getFirestore() themselves.
 *
 * Firestore targets the named "cctv-members" database (see
 * FIRESTORE_DATABASE_ID in env.js) within the shared "dettyverse"
 * Firebase project — deliberately not "cctv", which belongs to a
 * different, unrelated product already running in this project — using
 * persistent local cache with multi-tab synchronization so multiple
 * CCTV tabs open in the same browser share one offline cache instead of
 * each maintaining its own.
 *
 * Firebase Storage and Realtime Database are deliberately NOT
 * initialized here — the approved CCTV architecture serves all media via
 * externally-hosted MP4/image URLs pasted by hosts/admins, never via
 * Firebase Storage, so importing that SDK would be dead weight.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getFunctions,
  connectFunctionsEmulator,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

import {
  FIREBASE_CONFIG,
  FIRESTORE_DATABASE_ID,
  FUNCTIONS_REGION,
  CURRENT_ENV,
  CURRENT_FLAGS,
  EMULATOR_PORTS,
} from './env.js';

export const app = initializeApp(FIREBASE_CONFIG);

if (CURRENT_FLAGS.verboseLogging) {
  // eslint-disable-next-line no-console
  console.info(`[CCTV] Firebase initialized \u2014 environment: ${CURRENT_ENV}, database: ${FIRESTORE_DATABASE_ID}`);
}

/** Firestore, targeting the named "cctv" database with persistent multi-tab cache. */
let db;
try {
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    FIRESTORE_DATABASE_ID
  );
} catch (err) {
  // initializeFirestore throws if called more than once for the same app
  // (e.g. hot-reload during development) or if persistent cache isn't
  // supported in the current browser context (e.g. private browsing in
  // some browsers) — fall back to a plain, non-persistent client rather
  // than failing to boot entirely.
  console.warn('[CCTV] Persistent Firestore cache unavailable, falling back:', err);
  db = getFirestore(app, FIRESTORE_DATABASE_ID);
}

export { db };

export const functions = getFunctions(app, FUNCTIONS_REGION);

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[CCTV] Auth persistence could not be set:', err);
});

if (CURRENT_FLAGS.useEmulators) {
  connectFirestoreEmulator(db, 'localhost', EMULATOR_PORTS.firestore);
  connectFunctionsEmulator(functions, 'localhost', EMULATOR_PORTS.functions);
  connectAuthEmulator(auth, `http://localhost:${EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  });
}
