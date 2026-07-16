/**
 * constants.js
 *
 * Central registry of enum-like string unions and app-wide config values
 * used across the client.
 *
 * Collection names and Cloud Function names are NOT defined here — they
 * are loaded from /schema/collections.json and /schema/functionNames.json
 * respectively, the single canonical sources shared with
 * /functions/shared/firestore-helpers.js and /functions/index.js. This
 * guarantees the browser and Node runtimes can never drift apart on a
 * collection name OR a deployed function name. If you need to add or
 * rename either, edit the relevant /schema/*.json file only — never add
 * a literal collection or function name string anywhere else.
 *
 * Function names matter especially here: this product shares the
 * "dettyverse" Firebase project with an unrelated CCTV (Cassava Couch)
 * product that has its own deployed functions. Every callFunction() call
 * site must use FUNCTION_NAMES.<name>, never a literal string, so a
 * rename in the schema is guaranteed to propagate everywhere at once.
 */

import collectionsSchema from '../../schema/collections.json' with { type: 'json' };
import functionNamesSchema from '../../schema/functionNames.json' with { type: 'json' };

function freezeSchema(schema) {
  const { _comment, ...values } = schema;
  return Object.freeze(values);
}

export const COLLECTIONS = freezeSchema(collectionsSchema);
export const FUNCTION_NAMES = freezeSchema(functionNamesSchema);

export const GUEST_SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

export const HOST_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  BANNED: 'banned',
});

export const MEDIA_TYPE = Object.freeze({
  PHOTO: 'photo',
  VIDEO: 'video',
});

export const MEDIA_STATUS = Object.freeze({
  ACTIVE: 'active',
  FLAGGED: 'flagged',
  REMOVED: 'removed',
});

export const NOTIFICATION_TYPE = Object.freeze({
  SYSTEM: 'system',
  CHAT: 'chat',
  SALE: 'sale',
  PREMIUM: 'premium',
  WARNING: 'warning',
  ANNOUNCEMENT: 'announcement',
  PROMOTION: 'promotion',
});

export const USER_ROLE = Object.freeze({
  HOST: 'host',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
});

export const AUTHOR_TYPE = Object.freeze({
  GUEST: 'guest',
  HOST: 'host',
  ADMIN: 'admin',
});

/** Storage keys used on the client (sessionStorage / in-memory only). */
export const STORAGE_KEYS = Object.freeze({
  GUEST_SESSION_TOKEN: 'cctv_session_token',
  GUEST_SESSION_ID: 'cctv_session_id',
  GUEST_SESSION_EXPIRES_AT: 'cctv_session_expires_at',
  GUEST_USERNAME: 'cctv_username',
  LOUNGE_ENTERED: 'cctv_lounge_entered',
});

/** App-wide timing/config constants. */
export const CONFIG = Object.freeze({
  SESSION_WARNING_MINUTES: 5,
  SESSION_SYNC_INTERVAL_MS: 30_000,
  CHAT_MESSAGE_PAGE_SIZE: 100,
  GALLERY_PAGE_SIZE: 24,
  CHAT_RATE_LIMIT_WINDOW_MS: 10_000,
  CHAT_RATE_LIMIT_MAX_MESSAGES: 8,
  TOAST_DEFAULT_DURATION_MS: 4000,
  ACCESS_CODE_LENGTH: 5,
});

/** Prefix applied to every guest session token for readability in logs,
 *  analytics events, and support tooling. See /functions/shared/
 *  session-guard.js for the generation logic — this constant is
 *  display/validation only on the client, never used to generate tokens
 *  client-side. */
export const GUEST_SESSION_TOKEN_PREFIX = 'CCTV_GUEST_';

export const BRAND = Object.freeze({
  NAME: 'CCTV',
});
