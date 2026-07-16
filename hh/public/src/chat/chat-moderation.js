/**
 * chat-moderation.js
 *
 * Client-side moderation logic for chat: reporting a message (any
 * authenticated participant) and admin moderation actions (delete/
 * unflag any message). Kept separate from chat-service.js since these
 * are a distinct concern with different authorization levels — reporting
 * is available to every guest/host, while moderation actions require
 * the admin role and will be consumed by the Admin Dashboard module's
 * moderation queue UI, not the main chat UI.
 */

import { getSessionToken } from '../guest/session-store.js';
import { showSuccessToast, showErrorToast } from '../shared/toast.js';
import { reportMessageRequest, moderateMessageRequest } from './chat-api.js';

export const REPORT_REASONS = Object.freeze([
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'spam', label: 'Spam' },
  { value: 'explicit_content', label: 'Explicit content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
]);

/**
 * Report a message for moderator review.
 * @param {{ messageId: string, reason: string }} params
 * @returns {Promise<boolean>} true on success
 */
export async function reportChatMessage({ messageId, reason }) {
  const sessionToken = getSessionToken();

  try {
    await reportMessageRequest({ sessionToken, messageId, reason });
    showSuccessToast('Thanks \u2014 our team will take a look.');
    return true;
  } catch (error) {
    showErrorToast(error.message);
    return false;
  }
}

/**
 * Admin-only: permanently remove a message from the room.
 * @param {string} messageId
 */
export async function moderateDeleteMessage(messageId) {
  try {
    await moderateMessageRequest({ messageId, action: 'delete' });
    showSuccessToast('Message removed.');
    return true;
  } catch (error) {
    showErrorToast(error.message);
    return false;
  }
}

/**
 * Admin-only: clear a message's auto-flagged status without deleting it
 * (i.e. the reports were reviewed and dismissed as unfounded).
 * @param {string} messageId
 */
export async function moderateUnflagMessage(messageId) {
  try {
    await moderateMessageRequest({ messageId, action: 'unflag' });
    showSuccessToast('Message unflagged.');
    return true;
  } catch (error) {
    showErrorToast(error.message);
    return false;
  }
}
