/**
 * access-codes.js
 *
 * Orchestrates the guest checkout flow end-to-end:
 *   1. Fetch active accessPlans for display.
 *   2. On plan selection, call getCheckoutDetails (server-authoritative
 *      price + a fresh Paystack reference).
 *   3. Open Paystack Inline checkout with that exact amount/reference.
 *   4. Two independent paths race to fulfill the checkout once payment
 *      succeeds:
 *        a. FAST: the moment Paystack's popup reports success, this
 *           module calls verifyPayment directly — a callable that
 *           re-verifies with Paystack server-side and issues the code
 *           immediately. This is the primary path in normal operation.
 *        b. BACKUP: a realtime Firestore listener on
 *           checkoutSessions/{reference} also stays active the whole
 *           time, catching the result if the webhook (server-to-server,
 *           fully independent of the browser) completes first — e.g. if
 *           the tab closed right as checkout finished, before (a) could
 *           run.
 *      Whichever settles first wins; the code below guards against
 *      double-settling.
 *   5. Once the code arrives, hand it off to the caller (guest-login.js)
 *      to auto-fill the redemption form.
 *
 * This module does NOT redeem the code itself — redemption is a
 * separate, explicit step in guest-login.js, since the same access-code
 * entry field also needs to accept a code a guest received some other
 * way (e.g. purchased for them by someone else, read off a physical
 * card at a venue).
 */

import { doc, onSnapshot, collection, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../shared/firebase-config.js';
import { COLLECTIONS, FUNCTION_NAMES } from '../shared/constants.js';
import { callFunction } from '../shared/http-client.js';
import { openPaystackCheckout } from './paystack.js';

const CHECKOUT_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

/** How long to keep waiting for either fulfillment path before giving up client-side. */
const CHECKOUT_TIMEOUT_MS = 90_000;

/**
 * @param {{ planId: string, email: string, referralCode?: string }} params
 * @returns {Promise<string>} resolves with the plaintext access code once issued
 */
export function purchaseAccessPlan({ planId, email, referralCode }) {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let timeoutId = null;
    let settled = false;

    function cleanup() {
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    }

    function settleResolve(code) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(code);
    }

    function settleReject(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    callFunction(FUNCTION_NAMES.getCheckoutDetails, { planId, referralCode })
      .then(({ data }) => {
        const { reference, amountKobo } = data;

        const checkoutRef = doc(db, COLLECTIONS.CHECKOUT_SESSIONS, reference);
        unsubscribe = onSnapshot(checkoutRef, (snapshot) => {
          if (!snapshot.exists()) return;
          const checkout = snapshot.data();

          if (checkout.status === CHECKOUT_STATUS.COMPLETE && checkout.plaintextCodeForPickup) {
            settleResolve(checkout.plaintextCodeForPickup);
          } else if (checkout.status === CHECKOUT_STATUS.FAILED) {
            settleReject(new Error('Payment could not be verified. If you were charged, contact support with your reference.'));
          }
        });

        timeoutId = setTimeout(() => {
          settleReject(new Error('This is taking longer than expected. If you were charged, your code will still arrive \u2014 check back shortly.'));
        }, CHECKOUT_TIMEOUT_MS);

        openPaystackCheckout({
          email,
          amountKobo,
          reference,
          onSuccess: async () => {
            // Fast path: verify directly with the server the moment
            // Paystack's popup reports success, rather than waiting on
            // the webhook alone, which can lag by up to an hour in
            // Paystack's test mode. The realtime listener above stays
            // active as a backup in case this call itself fails (e.g. a
            // network hiccup right as the popup closes) — whichever
            // settles the promise first wins, via the settled guard.
            try {
              const { data } = await callFunction(FUNCTION_NAMES.verifyPayment, { reference });
              if (data.code) {
                settleResolve(data.code);
              }
            } catch {
              // Swallow — the listener/timeout above still governs the
              // outcome; this is a best-effort speed-up, not the only path.
            }
          },
          onClose: () => {
            // Guest closed the popup, whether before or after completing
            // payment. Don't reject immediately — let the verify call,
            // listener, or timeout above decide the actual outcome.
          },
        });
      })
      .catch((error) => {
        settleReject(error);
      });
  });
}

/**
 * Fetch active access plans for display on the checkout screen. Reads
 * accessPlans directly via the Firestore client SDK (public read, per
 * the Security Rules plan) rather than a callable — this is a simple,
 * unauthenticated, cacheable read with no business logic attached.
 */
export async function fetchActivePlans() {
  const plansQuery = query(
    collection(db, COLLECTIONS.ACCESS_PLANS),
    where('active', '==', true),
    orderBy('sortOrder', 'asc')
  );
  const snapshot = await getDocs(plansQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}
