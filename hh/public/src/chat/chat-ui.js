/**
 * chat-ui.js
 *
 * Renders the chat panel: message list (with reactions, reply previews,
 * host/admin badges), the composer, and per-message action affordances
 * (react, reply, report, delete-own). All state mutation goes through
 * chat-service.js / chat-moderation.js — this file only builds DOM and
 * wires event listeners.
 */

import { createEl, timeAgo } from '../shared/utilities.js';
import { showErrorToast } from '../shared/toast.js';
import { getSessionId } from '../guest/session-store.js';
import {
  startChatSubscription,
  stopChatSubscription,
  loadOlderMessages,
  sendChatMessage,
  toggleMessageReaction,
  deleteMyMessage,
} from './chat-service.js';
import { reportChatMessage, REPORT_REASONS } from './chat-moderation.js';

const REACTION_EMOJI = ['🔥', '❤️', '😂', '😮', '👏', '💯'];
const MESSAGE_MAX_LENGTH = 500;

/**
 * Mounts the chat panel into `root` and starts the realtime subscription.
 * Returns a teardown function the caller should invoke when navigating
 * away from chat (e.g. switching bottom-nav tabs), to stop the listener.
 */
export function mountChat(root) {
  const state = {
    replyingToMessage: null,
    allMessages: [],
    renderedMessageIds: new Set(),
  };

  const panel = createEl('div', { classNames: ['chat-panel'] });

  const messageList = createEl('div', {
    classNames: ['chat-message-list'],
    attrs: { role: 'log', 'aria-live': 'polite' },
  });

  const loadMoreBtn = createEl('button', {
    classNames: ['chat-load-more'],
    attrs: { type: 'button' },
    text: 'Load earlier messages',
  });

  const composer = buildComposer(state);

  panel.appendChild(loadMoreBtn);
  panel.appendChild(messageList);
  panel.appendChild(composer.el);
  root.appendChild(panel);

  function handleReplyRequest(message) {
    composer.setReplyTarget(message);
  }

  loadMoreBtn.addEventListener('click', async () => {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading\u2026';
    const older = await loadOlderMessages();
    prependMessages(messageList, older, state, handleReplyRequest);
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = older.length === 0 ? 'No more messages' : 'Load earlier messages';
  });

  startChatSubscription((messages) => {
    const isFirstLoad = state.allMessages.length === 0;
    state.allMessages = messages;
    renderMessageList(messageList, messages, state, handleReplyRequest);
    if (isFirstLoad) {
      scrollToBottom(messageList);
    }
  });

  return function teardown() {
    stopChatSubscription();
    state.renderedMessageIds = new Set();
    state.allMessages = [];
    state.replyingToMessage = null;
  };
}

function buildComposer(state) {
  const replyPreview = createEl('div', { classNames: ['chat-reply-preview'] });
  replyPreview.hidden = true;

  const input = createEl('textarea', {
    classNames: ['chat-composer-input'],
    attrs: {
      placeholder: 'Say something\u2026',
      maxlength: String(MESSAGE_MAX_LENGTH),
      rows: '1',
    },
  });

  const sendBtn = createEl('button', {
    classNames: ['btn', 'btn-primary', 'chat-send-btn'],
    attrs: { type: 'button' },
    text: 'Send',
  });

  const row = createEl('div', { classNames: ['chat-composer-row'] }, [input, sendBtn]);
  const el = createEl('div', { classNames: ['chat-composer'] }, [replyPreview, row]);

  function clearReply() {
    state.replyingToMessage = null;
    replyPreview.hidden = true;
    replyPreview.innerHTML = '';
  }

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    try {
      await sendChatMessage({ text, replyToId: state.replyingToMessage?.id ?? null });
      input.value = '';
      autoResize(input);
      clearReply();
    } catch {
      // sendChatMessage already surfaces a toast on failure.
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  input.addEventListener('input', () => autoResize(input));

  return {
    el,
    setReplyTarget(message) {
      state.replyingToMessage = message;
      replyPreview.hidden = false;
      replyPreview.innerHTML = '';
      replyPreview.appendChild(
        createEl('span', { classNames: ['chat-reply-preview-label'], text: `Replying to ${message.authorDisplay}` })
      );
      const cancelBtn = createEl('button', {
        classNames: ['chat-reply-cancel'],
        attrs: { type: 'button', 'aria-label': 'Cancel reply' },
        text: '\u00d7',
      });
      cancelBtn.addEventListener('click', clearReply);
      replyPreview.appendChild(cancelBtn);
      input.focus();
    },
  };
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function renderMessageList(container, messages, state, onReply) {
  const scrolledToBottom = isScrolledNearBottom(container);

  container.innerHTML = '';
  state.renderedMessageIds = new Set();

  for (const message of messages) {
    container.appendChild(buildMessageEl(message, messages, onReply));
    state.renderedMessageIds.add(message.id);
  }

  if (scrolledToBottom) {
    scrollToBottom(container);
  }
}

function prependMessages(container, olderMessages, state, onReply) {
  const previousScrollHeight = container.scrollHeight;

  const fragment = document.createDocumentFragment();
  for (const message of olderMessages) {
    if (state.renderedMessageIds.has(message.id)) continue;
    fragment.appendChild(buildMessageEl(message, state.allMessages, onReply));
    state.renderedMessageIds.add(message.id);
  }
  container.prepend(fragment);

  // Preserve scroll position relative to content rather than jumping to
  // top after older messages are inserted above the current view.
  container.scrollTop = container.scrollHeight - previousScrollHeight;
}

function buildMessageEl(message, allMessagesForReplyLookup, onReply) {
  const isMine = message.authorId === getSessionId();
  const isHostOrAdmin = message.authorType === 'host' || message.authorType === 'admin';

  const wrapper = createEl('div', {
    classNames: ['chat-message', isMine ? 'chat-message-own' : '', message.deleted ? 'chat-message-deleted' : ''].filter(Boolean),
    attrs: { 'data-message-id': message.id },
  });

  if (message.replyToId) {
    const repliedTo = allMessagesForReplyLookup.find((m) => m.id === message.replyToId);
    if (repliedTo) {
      wrapper.appendChild(
        createEl('div', {
          classNames: ['chat-message-reply-context'],
          text: `\u21b3 ${repliedTo.authorDisplay}: ${truncate(repliedTo.text, 60)}`,
        })
      );
    }
  }

  const header = createEl('div', { classNames: ['chat-message-header'] });
  header.appendChild(
    createEl('span', {
      classNames: ['chat-message-author', isHostOrAdmin ? 'chat-message-author-host' : ''].filter(Boolean),
      text: message.authorDisplay,
    })
  );
  if (isHostOrAdmin) {
    header.appendChild(createEl('span', { classNames: ['chat-host-badge'], text: 'HOST' }));
  }
  header.appendChild(
    createEl('span', {
      classNames: ['chat-message-time'],
      text: message.createdAt ? timeAgo(message.createdAt.toDate ? message.createdAt.toDate() : message.createdAt) : '',
    })
  );

  const body = createEl('p', {
    classNames: ['chat-message-text'],
    text: message.deleted ? 'Message deleted' : message.text,
  });

  wrapper.appendChild(header);
  wrapper.appendChild(body);

  if (!message.deleted) {
    wrapper.appendChild(buildReactionsRow(message));
    wrapper.appendChild(buildActionsRow(message, isMine, onReply));
  }

  return wrapper;
}

function buildReactionsRow(message) {
  const row = createEl('div', { classNames: ['chat-reactions-row'] });
  const mySessionId = getSessionId();

  for (const emoji of REACTION_EMOJI) {
    const actors = message.reactions?.[emoji] || [];
    const count = actors.length;
    const iReacted = actors.includes(mySessionId);

    const pill = createEl('button', {
      classNames: ['chat-reaction-pill', iReacted ? 'chat-reaction-pill-active' : ''].filter(Boolean),
      attrs: { type: 'button', 'aria-label': `React with ${emoji}` },
    });
    pill.appendChild(createEl('span', { text: emoji }));
    if (count > 0) {
      pill.appendChild(createEl('span', { classNames: ['chat-reaction-count'], text: String(count) }));
    }

    pill.addEventListener('click', async () => {
      pill.disabled = true;
      await toggleMessageReaction({ messageId: message.id, emoji });
      pill.disabled = false;
    });

    row.appendChild(pill);
  }

  return row;
}

function buildActionsRow(message, isMine, onReply) {
  const row = createEl('div', { classNames: ['chat-actions-row'] });

  const replyBtn = createEl('button', {
    classNames: ['chat-action-btn'],
    attrs: { type: 'button' },
    text: 'Reply',
  });
  replyBtn.addEventListener('click', () => onReply(message));
  row.appendChild(replyBtn);

  if (isMine) {
    const deleteBtn = createEl('button', {
      classNames: ['chat-action-btn'],
      attrs: { type: 'button' },
      text: 'Delete',
    });
    deleteBtn.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      await deleteMyMessage(message.id);
    });
    row.appendChild(deleteBtn);
  } else {
    const reportBtn = createEl('button', {
      classNames: ['chat-action-btn'],
      attrs: { type: 'button' },
      text: 'Report',
    });
    reportBtn.addEventListener('click', () => openReportPicker(message.id));
    row.appendChild(reportBtn);
  }

  return row;
}

function openReportPicker(messageId) {
  const reason = window.prompt(
    `Why are you reporting this message?\n${REPORT_REASONS.map((r, i) => `${i + 1}. ${r.label}`).join('\n')}\n\nEnter a number:`
  );
  const index = Number(reason) - 1;
  const selected = REPORT_REASONS[index];
  if (!selected) {
    if (reason !== null) showErrorToast('Report cancelled \u2014 no valid reason selected.');
    return;
  }
  reportChatMessage({ messageId, reason: selected.value });
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text || '';
  return `${text.slice(0, maxLength)}\u2026`;
}

function isScrolledNearBottom(container) {
  const threshold = 80;
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}
