/**
 * temporary-username.js
 *
 * Username selection step of guest entry. Client-side validation here is
 * a UX convenience only — redeemAccessCode's server-side validateUsername()
 * (functions/shared/validation.js) is the real gate and uses the exact
 * same rules, kept manually in sync since they can't share a module
 * across the client/Functions runtime boundary (see note in that file).
 */

import { createEl } from '../shared/utilities.js';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function validateUsernameClientSide(rawUsername) {
  const value = (rawUsername || '').trim();
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
    return { valid: false, reason: `${USERNAME_MIN_LENGTH}\u201320 characters.` };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return { valid: false, reason: 'Letters, numbers, and underscores only.' };
  }
  return { valid: true, normalized: value };
}

/**
 * Builds the username input step. Returns the element plus a getValue()
 * accessor so the parent form (guest-login.js) can read the current
 * value without the two modules needing to share mutable state.
 */
export function buildUsernameField() {
  const label = createEl('label', {
    classNames: ['field-label'],
    attrs: { for: 'guest-username-input' },
    text: 'Choose a name for tonight',
  });

  const input = createEl('input', {
    classNames: ['field-input'],
    attrs: {
      id: 'guest-username-input',
      type: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      maxlength: String(USERNAME_MAX_LENGTH),
      placeholder: 'e.g. midnight_wanderer',
    },
  });

  const hint = createEl('p', {
    classNames: ['field-hint'],
    text: 'Visible to others in chat. Not tied to any account \u2014 it disappears when your session ends.',
  });

  const error = createEl('p', {
    classNames: ['field-error'],
    attrs: { role: 'alert' },
  });

  const wrapper = createEl('div', { classNames: ['field-group'] }, [label, input, hint, error]);

  input.addEventListener('input', () => {
    error.textContent = '';
    input.classList.remove('field-input-invalid');
  });

  return {
    el: wrapper,
    input,
    showError(message) {
      error.textContent = message;
      input.classList.add('field-input-invalid');
    },
    getValue() {
      return input.value.trim();
    },
  };
}
