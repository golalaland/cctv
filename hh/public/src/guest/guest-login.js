/**
 * guest-login.js
 *
 * The guest entry screen: redeem an existing access code, or purchase
 * one via the plans list (which then auto-fills the code once issued).
 * On successful redemption, persists the session (session-store.js),
 * starts the countdown (session-timer.js), and hands off to the caller
 * via `onEnter`.
 */

import { createEl } from '../shared/utilities.js';
import { callFunction } from '../shared/http-client.js';
import { showErrorToast, showSuccessToast } from '../shared/toast.js';
import { FUNCTION_NAMES } from '../shared/constants.js';
import { buildUsernameField, validateUsernameClientSide } from './temporary-username.js';
import { setSession } from './session-store.js';
import { startSessionTimer } from './session-timer.js';
import { fetchActivePlans, purchaseAccessPlan } from '../payments/access-codes.js';

/**
 * Mounts the guest login screen into `root`. Calls `onEnter()` once a
 * session has been successfully established and the countdown started.
 */
export function mountGuestLogin(root, onEnter) {
  const container = createEl('div', { classNames: ['guest-login'] });

  const heading = createEl('h2', { classNames: ['guest-login-heading'], text: 'Your access code' });
  const subheading = createEl('p', {
    classNames: ['guest-login-subheading'],
    text: 'Enter the code from your purchase, or claim access below.',
  });

  const codeField = buildCodeField();
  const usernameField = buildUsernameField();

  const submitBtn = createEl('button', {
    classNames: ['btn', 'btn-primary', 'guest-login-submit'],
    attrs: { type: 'submit' },
    text: 'Enter',
  });

  const spinner = createEl('span', { classNames: ['spinner', 'guest-login-spinner'] });
  spinner.hidden = true;

  const form = createEl(
    'form',
    { classNames: ['guest-login-form'] },
    [codeField.el, usernameField.el, submitBtn, spinner]
  );

  const divider = createEl('div', { classNames: ['guest-login-divider'] }, [
    createEl('span', { text: 'or claim access' }),
  ]);

  const plansContainer = createEl('div', { classNames: ['plans-grid'] });

  container.appendChild(heading);
  container.appendChild(subheading);
  container.appendChild(form);
  container.appendChild(divider);
  container.appendChild(plansContainer);
  root.appendChild(container);

  loadPlans(plansContainer, (code) => {
    codeField.setValue(code);
    showSuccessToast('Your code is ready \u2014 review it below and enter.');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit({ codeField, usernameField, submitBtn, spinner, onEnter });
  });
}

function buildCodeField() {
  const label = createEl('label', {
    classNames: ['field-label'],
    attrs: { for: 'guest-code-input' },
    text: 'Access code',
  });

  const input = createEl('input', {
    classNames: ['field-input', 'field-input-code'],
    attrs: {
      id: 'guest-code-input',
      type: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      maxlength: '9', // allows for a stray separator character while typing
      placeholder: 'K3MX7',
    },
  });

  const error = createEl('p', { classNames: ['field-error'], attrs: { role: 'alert' } });

  const wrapper = createEl('div', { classNames: ['field-group'] }, [label, input, error]);

  input.addEventListener('input', () => {
    error.textContent = '';
    input.classList.remove('field-input-invalid');
  });

  return {
    el: wrapper,
    input,
    getValue: () => input.value.trim(),
    setValue: (value) => {
      input.value = value;
    },
    showError(message) {
      error.textContent = message;
      input.classList.add('field-input-invalid');
    },
  };
}

async function loadPlans(container, onCodeReady) {
  container.innerHTML = '';
  for (let i = 0; i < 3; i += 1) {
    container.appendChild(createEl('div', { classNames: ['plan-card', 'skeleton'] }));
  }

  let plans;
  try {
    plans = await fetchActivePlans();
  } catch {
    container.innerHTML = '';
    container.appendChild(
      createEl('p', { classNames: ['plans-error'], text: 'Couldn\u2019t load plans right now. You can still enter a code above.' })
    );
    return;
  }

  container.innerHTML = '';

  if (plans.length === 0) {
    container.appendChild(createEl('p', { classNames: ['plans-error'], text: 'No plans are available right now.' }));
    return;
  }

  for (const plan of plans) {
    container.appendChild(buildPlanCard(plan, onCodeReady));
  }
}

function buildPlanCard(plan, onCodeReady) {
  const label = createEl('h3', { classNames: ['plan-label'], text: plan.label });
  const price = createEl('p', {
    classNames: ['plan-price'],
    text: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
      plan.priceKobo / 100
    ),
  });

  const buyBtn = createEl('button', {
    classNames: ['btn', 'btn-ghost', 'plan-buy-btn'],
    attrs: { type: 'button' },
    text: 'Purchase',
  });

  const card = createEl('div', { classNames: ['plan-card'] }, [label, price, buyBtn]);

  buyBtn.addEventListener('click', async () => {
    const email = window.prompt('Enter an email for your payment receipt:');
    if (!email) return;

    buyBtn.disabled = true;
    buyBtn.textContent = 'Processing\u2026';

    const referralCode = new URLSearchParams(window.location.search).get('ref') || undefined;

    try {
      const code = await purchaseAccessPlan({ planId: plan.id, email, referralCode });
      onCodeReady(code);
    } catch (error) {
      showErrorToast(error.message);
    } finally {
      buyBtn.disabled = false;
      buyBtn.textContent = 'Purchase';
    }
  });

  return card;
}

async function handleSubmit({ codeField, usernameField, submitBtn, spinner, onEnter }) {
  const code = codeField.getValue();
  const usernameCheck = validateUsernameClientSide(usernameField.getValue());

  let hasError = false;
  if (!code) {
    codeField.showError('Enter your access code.');
    hasError = true;
  }
  if (!usernameCheck.valid) {
    usernameField.showError(usernameCheck.reason);
    hasError = true;
  }
  if (hasError) return;

  submitBtn.disabled = true;
  spinner.hidden = false;

  try {
    const { data } = await callFunction(FUNCTION_NAMES.redeemAccessCode, {
      code,
      username: usernameCheck.normalized,
    });

    setSession({
      sessionToken: data.sessionToken,
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      username: data.username,
    });

    startSessionTimer({
      onExpire: () => {
        showErrorToast('Your session has expired.');
        window.location.reload();
      },
    });

    onEnter();
  } catch (error) {
    codeField.showError(error.message);
  } finally {
    submitBtn.disabled = false;
    spinner.hidden = true;
  }
}
