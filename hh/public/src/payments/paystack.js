/**
 * paystack.js
 *
 * Wrapper around Paystack's Inline JS popup checkout. Loads the
 * PaystackPop script lazily (only when checkout is actually opened) so
 * it never delays the initial page load for guests who haven't reached
 * checkout yet.
 *
 * This module NEVER decides the amount charged — amountKobo and
 * reference always come from the server (getCheckoutDetails callable),
 * per the approved architecture's price-tampering prevention.
 */

const PAYSTACK_SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';
const PAYSTACK_PUBLIC_KEY = 'pk_test_9446fa6b81888ffce77cc94294530d761aac4ccd';

let scriptLoadPromise = null;

function loadPaystackScript() {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve(window.PaystackPop);
      return;
    }
    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject(new Error('Could not load the payment provider. Please check your connection and try again.'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Open the Paystack Inline checkout popup.
 *
 * @param {{
 *   email: string,
 *   amountKobo: number,
 *   reference: string,
 *   onSuccess: (response: { reference: string }) => void,
 *   onClose: () => void,
 * }} options
 */
export async function openPaystackCheckout({ email, amountKobo, reference, onSuccess, onClose }) {
  const PaystackPop = await loadPaystackScript();

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: amountKobo,
    ref: reference,
    currency: 'NGN',
    callback: (response) => onSuccess(response),
    onClose: () => onClose(),
  });

  handler.openIframe();
}
