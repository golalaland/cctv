/**
 * utilities.js
 *
 * Generic, dependency-free helper functions shared across every feature
 * module. Nothing in this file should know about Firestore, Functions,
 * or any specific feature's business logic — keep it purely generic.
 */

/**
 * Debounce a function: delays invocation until `wait` ms have passed
 * since the last call.
 */
export function debounce(fn, wait = 250) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Throttle a function: guarantees at most one invocation per `limit` ms.
 */
export function throttle(fn, limit = 250) {
  let inFlight = false;
  return function throttled(...args) {
    if (inFlight) return;
    inFlight = true;
    fn.apply(this, args);
    setTimeout(() => {
      inFlight = false;
    }, limit);
  };
}

/** Shorthand for document.querySelector, scoped optionally to a root. */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/** Shorthand for document.querySelectorAll, returned as a real array. */
export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Create a DOM element with optional attributes, classes, and children. */
export function createEl(tag, { classNames = [], attrs = {}, text } = {}, children = []) {
  const el = document.createElement(tag);
  if (classNames.length) el.classList.add(...classNames);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  if (text !== undefined) el.textContent = text;
  for (const child of children) {
    if (child) el.appendChild(child);
  }
  return el;
}

/** Format milliseconds remaining as "MM:SS" for countdown timers. */
export function formatCountdown(msRemaining) {
  const clamped = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format a Firestore Timestamp-like value or Date into a relative "time ago" string. */
export function timeAgo(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/** Format a kobo integer amount as Naira currency string. */
export function formatNaira(amountKobo) {
  const naira = amountKobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: naira % 1 === 0 ? 0 : 2,
  }).format(naira);
}

/** Clamp a number between min and max. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Generate a RFC4122-ish random ID using the Web Crypto API. */
export function randomId() {
  return crypto.randomUUID();
}

/** Basic sleep/delay helper, primarily for orchestrating animation sequencing. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lowercase + tokenize a string into a search-terms array (whole words
 * plus progressive prefixes) for Firestore prefix-match search fields.
 * Kept deliberately simple; this is the same tokenizer contract used
 * server-side when denormalizing `searchTerms` on media/profiles docs.
 */
export function tokenizeForSearch(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const tokens = new Set();
  for (const word of words) {
    tokens.add(word);
    for (let i = 1; i < word.length; i += 1) {
      tokens.add(word.slice(0, i));
    }
  }
  return Array.from(tokens);
}

/** Returns true if running in a touch-primary environment (rough heuristic). */
export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Returns true if the user has requested reduced motion at the OS level. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
