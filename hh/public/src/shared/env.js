/**
 * env.js
 *
 * Environment detection and per-environment Firebase config for the CCTV
 * client. Supports three tiers: development (local emulators), staging
 * (a real but non-production Firebase project, for pre-release QA), and
 * production.
 *
 * IMPORTANT: Firebase client config (apiKey, projectId, etc.) is NOT a
 * secret — it's safe to ship in client code and is scoped by Firebase
 * Security Rules, not by hiding the config. Server secrets (Paystack
 * secret key, access-code/session hashing secrets) NEVER live here —
 * those are Cloud Functions-only, defined in /functions/shared/env.js.
 *
 * DettyVerse ecosystem note: all products (CUBE, BidBanta, CCTV, etc.)
 * share a single Firebase project ("dettyverse") but use separate named
 * Firestore databases per product. CCTV's database is "cctv" — see
 * FIRESTORE_DATABASE_ID below, consumed by firebase-config.js.
 *
 * Environment resolution order:
 *   1. `window.__CCTV_ENV__` — an optional global set by a small inline
 *      script in index.html, useful for Firebase Hosting multi-site/
 *      channel deploys where you want to pin the tier explicitly rather
 *      than infer it from hostname.
 *   2. Hostname pattern matching (see ENV_HOSTNAME_RULES below).
 *   3. Falls back to "production" — fail-safe default, since an
 *      unrecognized hostname should never silently behave like dev
 *      (which relaxes assumptions like emulator usage).
 */

export const ENVIRONMENTS = Object.freeze({
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
});

const ENV_HOSTNAME_RULES = [
  { env: ENVIRONMENTS.DEVELOPMENT, test: (h) => h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local') },
  { env: ENVIRONMENTS.STAGING, test: (h) => h.includes('staging') || h.endsWith('.web.app') && h.startsWith('cctv-staging') },
];

function resolveEnvironment() {
  if (typeof window !== 'undefined' && window.__CCTV_ENV__) {
    return window.__CCTV_ENV__;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  for (const rule of ENV_HOSTNAME_RULES) {
    if (rule.test(hostname)) return rule.env;
  }
  return ENVIRONMENTS.PRODUCTION;
}

export const CURRENT_ENV = resolveEnvironment();

export const IS_LOCAL = CURRENT_ENV === ENVIRONMENTS.DEVELOPMENT;
export const IS_STAGING = CURRENT_ENV === ENVIRONMENTS.STAGING;
export const IS_PRODUCTION = CURRENT_ENV === ENVIRONMENTS.PRODUCTION;

/**
 * Named Firestore database for this product, within the shared
 * "dettyverse" Firebase project. Deliberately distinct from "cctv" —
 * that name is already claimed and in production use by a different,
 * unrelated product (Cassava Couch, internally also called CCTV), which
 * has its own "cctv-functions" codebase and "firestore.cctv.rules"
 * already deployed against the "cctv" named database. Applied uniformly
 * across every environment tier.
 */
export const FIRESTORE_DATABASE_ID = 'cctv-members';

/**
 * Cloud Functions region, matching where CCTV's functions are deployed.
 * Must stay in sync with FUNCTIONS_REGION in /functions/shared/env.js —
 * a client requesting the wrong region gets a 404, not a redirect.
 */
export const FUNCTIONS_REGION = 'europe-west1';

/**
 * Per-environment Firebase project configuration. Production points at
 * the real "dettyverse" Firebase project shared across the DettyVerse
 * ecosystem. Staging is not yet provisioned — fill in when a staging
 * project/site exists. Development uses local emulators with a throwaway
 * demo project id, so it never accidentally touches real data.
 */
const FIREBASE_CONFIG_BY_ENV = Object.freeze({
  [ENVIRONMENTS.DEVELOPMENT]: {
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId: 'cctv-dev',
    storageBucket: 'cctv-dev.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
  [ENVIRONMENTS.STAGING]: {
    apiKey: 'REPLACE_WITH_STAGING_API_KEY',
    authDomain: 'REPLACE_WITH_STAGING_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_STAGING_PROJECT_ID',
    storageBucket: 'REPLACE_WITH_STAGING_STORAGE_BUCKET',
    messagingSenderId: 'REPLACE_WITH_STAGING_SENDER_ID',
    appId: 'REPLACE_WITH_STAGING_APP_ID',
  },
  [ENVIRONMENTS.PRODUCTION]: {
    apiKey: 'AIzaSyD_GjkTox5tum9o4AupO0LeWzjTocJg8RI',
    authDomain: 'dettyverse.firebaseapp.com',
    projectId: 'dettyverse',
    storageBucket: 'cubeology',
    messagingSenderId: '1036459652488',
    appId: '1:1036459652488:web:f4284cbc49c8074bc9b63d',
    measurementId: 'G-KPSCEYNZWX',
  },
});

export const FIREBASE_CONFIG = FIREBASE_CONFIG_BY_ENV[CURRENT_ENV];

export const EMULATOR_PORTS = Object.freeze({
  auth: 9099,
  functions: 5001,
  firestore: 8080,
});

/**
 * Per-environment feature flags / behavioral switches that later modules
 * can read instead of re-deriving IS_LOCAL/IS_STAGING checks inline.
 */
export const ENV_FLAGS = Object.freeze({
  [ENVIRONMENTS.DEVELOPMENT]: {
    useEmulators: true,
    verboseLogging: true,
    paystackTestMode: true,
  },
  [ENVIRONMENTS.STAGING]: {
    useEmulators: false,
    verboseLogging: true,
    paystackTestMode: true,
  },
  [ENVIRONMENTS.PRODUCTION]: {
    useEmulators: false,
    verboseLogging: false,
    paystackTestMode: false,
  },
});

export const CURRENT_FLAGS = ENV_FLAGS[CURRENT_ENV];
