/**
 * access-codes.js
 *
 * Orchestrates the guest checkout flow end-to-end:
 *   1. Fetch active accessPlans for display.
 *   2. On plan selection, call getCheckoutDetails (server-authoritative
 *      price + a fresh Paystack reference).
 *   3. Open Paystack Inline checkout with that exact amount/reference.
 *   4. On Paystack success callback, start a realtime Firestore listener
 *      on checkoutSessions/{reference} — the webhook (running
 *      server-side, asynchronously) will flip its status to "complete"
 *      and attach the plaintext code once processing finishes. This is
 *      the "polling via listener" mechanism described in the approved
 *      architecture: the client never talks to the webhook directly.
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

/** How long to keep listening for the webhook to finish before giving up client-side. */
const CHECKOUT_TIMEOUT_MS = 90_000;

/**
 * @param {{ planId: string, email: string, referralCode?: string }} params
 * @returns {Promise<string>} resolves with the plaintext access code once issued
 */
export function purchaseAccessPlan({ planId, email, referralCode }) {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let timeoutId = null;

    function cleanup() {
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    }

    callFunction(FUNCTION_NAMES.getCheckoutDetails, { planId, referralCode })
      .then(({ data }) => {
        const { reference, amountKobo } = data;

        const checkoutRef = doc(db, COLLECTIONS.CHECKOUT_SESSIONS, reference);
        unsubscribe = onSnapshot(checkoutRef, (snapshot) => {
          if (!snapshot.exists()) return;
          const checkout = snapshot.data();

          if (checkout.status === CHECKOUT_STATUS.COMPLETE && checkout.plaintextCodeForPickup) {
            cleanup();
            resolve(checkout.plaintextCodeForPickup);
          } else if (checkout.status === CHECKOUT_STATUS.FAILED) {
            cleanup();
            reject(new Error('Payment could not be verified. If you were charged, contact support with your reference.'));
          }
        });

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('This is taking longer than expected. If you were charged, your code will still arrive — check back shortly.'));
        }, CHECKOUT_TIMEOUT_MS);

        openPaystackCheckout({
          email,
          amountKobo,
          reference,
          onSuccess: () => {
            // Intentionally a no-op beyond this point — the realtime
            // listener above is what actually resolves the promise,
            // since Paystack's client-side callback fires on payment
            // completion, not on OUR webhook having finished processing.
          },
          onClose: () => {
            // Guest closed the popup without completing payment. Don't
            // reject immediately — they may have completed it and just
            // closed the confirmation screen; let the listener/timeout
            // decide the outcome rather than assuming failure here.
          },
        });
      })
      .catch((error) => {
        cleanup();
        reject(error);
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
