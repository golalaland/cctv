/**
 * gallery-viewer.js
 *
 * Fullscreen custom media viewer, opened from a gallery card click (see
 * gallery-ui.js's onMediaOpen callback). Deliberately does NOT reuse
 * modal.js — that component is built for centered dialogs (confirmations,
 * host profile cards later), while this needs true edge-to-edge
 * fullscreen with swipe/keyboard navigation between items, which is a
 * different enough interaction model to warrant its own bespoke overlay
 * (same reasoning that gave lounge-gate.js its own overlay rather than
 * using modal.js).
 *
 * Premium items: the approved architecture describes tapping a locked
 * item opening Paystack payment directly — but Premium Purchases
 * (Module 10) doesn't exist yet. This viewer shows the locked state
 * honestly (price, unlock button) rather than either hiding premium
 * items entirely or faking a payment flow — tapping unlock explains
 * that purchasing isn't available yet rather than silently failing.
 */

import { createEl, formatNaira, prefersReducedMotion } from '../shared/utilities.js';
import { showWarningToast } from '../shared/toast.js';
import { recordView, toggleLike } from './gallery-service.js';

const SWIPE_THRESHOLD_PX = 60;

let activeViewer = null;

/**
 * @param {object} item - the media item that was clicked
 * @param {Array<object>} items - the full currently-loaded list, for prev/next navigation
 * @param {number} startIndex - index of `item` within `items`
 */
export function openMediaViewer(item, items, startIndex) {
  closeMediaViewer();

  const state = {
    items,
    index: startIndex,
    liked: false, // optimistic only — initial like status isn't fetched, see note below
  };

  const overlay = createEl('div', {
    classNames: ['viewer-overlay'],
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Media viewer' },
  });

  const stage = createEl('div', { classNames: ['viewer-stage'] });
  const controls = buildControls(state);
  const infoBar = buildInfoBar();

  overlay.appendChild(controls.el);
  overlay.appendChild(stage);
  overlay.appendChild(infoBar.el);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  function render() {
    const current = state.items[state.index];
    stage.innerHTML = '';
    state.liked = false;

    if (current.premium) {
      stage.appendChild(buildLockedState(current));
    } else {
      stage.appendChild(buildMediaElement(current));
      recordView(current.id);
    }

    infoBar.update(current, state.liked);
    controls.updateNavVisibility(state.index, state.items.length);
  }

  function goTo(newIndex) {
    if (newIndex < 0 || newIndex >= state.items.length) return;
    state.index = newIndex;
    render();
  }

  controls.onClose(closeMediaViewer);
  controls.onPrev(() => goTo(state.index - 1));
  controls.onNext(() => goTo(state.index + 1));
  controls.onFullscreen(() => toggleNativeFullscreen(overlay));

  infoBar.onLikeToggle(async () => {
    const current = state.items[state.index];
    const liked = await toggleLike(current.id);
    if (liked !== null) {
      state.liked = liked;
      infoBar.update(current, state.liked);
    }
  });

  const handleKeydown = (e) => {
    if (e.key === 'Escape') closeMediaViewer();
    else if (e.key === 'ArrowLeft') goTo(state.index - 1);
    else if (e.key === 'ArrowRight') goTo(state.index + 1);
  };
  document.addEventListener('keydown', handleKeydown);

  const swipeHandlers = attachSwipeHandlers(stage, {
    onSwipeLeft: () => goTo(state.index + 1),
    onSwipeRight: () => goTo(state.index - 1),
  });

  activeViewer = { overlay, handleKeydown, swipeHandlers };

  render();

  requestAnimationFrame(() => {
    overlay.classList.add('viewer-visible');
  });
}

export function closeMediaViewer() {
  if (!activeViewer) return;
  const { overlay, handleKeydown, swipeHandlers } = activeViewer;

  document.removeEventListener('keydown', handleKeydown);
  swipeHandlers.detach();
  document.body.classList.remove('modal-open');

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  overlay.classList.remove('viewer-visible');

  const finish = () => overlay.remove();
  if (prefersReducedMotion()) {
    finish();
  } else {
    overlay.addEventListener('transitionend', finish, { once: true });
  }

  activeViewer = null;
}

function buildControls(state) {
  const closeBtn = createEl('button', {
    classNames: ['viewer-btn', 'viewer-close-btn'],
    attrs: { type: 'button', 'aria-label': 'Close' },
    text: '\u00d7',
  });

  const fullscreenBtn = createEl('button', {
    classNames: ['viewer-btn', 'viewer-fullscreen-btn'],
    attrs: { type: 'button', 'aria-label': 'Toggle fullscreen' },
    text: '\u26f6',
  });

  const prevBtn = createEl('button', {
    classNames: ['viewer-btn', 'viewer-nav-btn', 'viewer-prev-btn'],
    attrs: { type: 'button', 'aria-label': 'Previous' },
    text: '\u2039',
  });

  const nextBtn = createEl('button', {
    classNames: ['viewer-btn', 'viewer-nav-btn', 'viewer-next-btn'],
    attrs: { type: 'button', 'aria-label': 'Next' },
    text: '\u203a',
  });

  const el = createEl('div', { classNames: ['viewer-controls'] }, [
    closeBtn,
    fullscreenBtn,
    prevBtn,
    nextBtn,
  ]);

  return {
    el,
    onClose: (handler) => closeBtn.addEventListener('click', handler),
    onFullscreen: (handler) => fullscreenBtn.addEventListener('click', handler),
    onPrev: (handler) => prevBtn.addEventListener('click', handler),
    onNext: (handler) => nextBtn.addEventListener('click', handler),
    updateNavVisibility(index, total) {
      prevBtn.style.visibility = index > 0 ? 'visible' : 'hidden';
      nextBtn.style.visibility = index < total - 1 ? 'visible' : 'hidden';
    },
  };
}

function buildInfoBar() {
  const hostEl = createEl('span', { classNames: ['viewer-host'] });
  const titleEl = createEl('h3', { classNames: ['viewer-title'] });
  const descriptionEl = createEl('p', { classNames: ['viewer-description'] });

  const likeBtn = createEl('button', {
    classNames: ['viewer-btn', 'viewer-like-btn'],
    attrs: { type: 'button', 'aria-label': 'Like' },
    text: '\u2764\ufe0f',
  });
  const statsEl = createEl('span', { classNames: ['viewer-stats'] });

  const statsRow = createEl('div', { classNames: ['viewer-stats-row'] }, [likeBtn, statsEl]);
  const textCol = createEl('div', { classNames: ['viewer-info-text'] }, [hostEl, titleEl, descriptionEl]);
  const el = createEl('div', { classNames: ['viewer-info-bar'] }, [textCol, statsRow]);

  return {
    el,
    update(item, liked) {
      hostEl.textContent = item.hostName || '';
      titleEl.textContent = item.title || '';
      descriptionEl.textContent = item.description || '';
      statsEl.textContent = `${item.likes || 0} likes \u00b7 ${item.views || 0} views`;
      likeBtn.classList.toggle('viewer-like-btn-active', liked);
    },
    onLikeToggle: (handler) => likeBtn.addEventListener('click', handler),
  };
}

function buildMediaElement(item) {
  if (item.type === 'video') {
    const video = createEl('video', {
      classNames: ['viewer-media'],
      attrs: {
        src: item.url,
        controls: '',
        autoplay: '',
        playsinline: '',
        loop: '',
      },
    });
    // Browsers silently block autoplay-with-sound without a prior user
    // gesture — muted at least lets it start playing immediately, same
    // as we already do for grid thumbnails. The visible native controls
    // let the guest unmute manually if they want sound.
    video.muted = true;
    return video;
  }
  return createEl('img', {
    classNames: ['viewer-media'],
    attrs: { src: item.url, alt: item.title || '' },
  });
}

function buildLockedState(item) {
  const icon = createEl('div', { classNames: ['viewer-lock-icon'], text: '\ud83d\udd12' });
  const priceEl = createEl('p', {
    classNames: ['viewer-lock-price'],
    text: item.unlockPriceKobo ? formatNaira(item.unlockPriceKobo) : '',
  });
  const unlockBtn = createEl('button', {
    classNames: ['btn', 'btn-primary', 'viewer-unlock-btn'],
    attrs: { type: 'button' },
    text: 'Unlock',
  });

  unlockBtn.addEventListener('click', () => {
    showWarningToast('Unlocking premium content isn\u2019t available yet \u2014 check back soon.');
  });

  return createEl('div', { classNames: ['viewer-locked'] }, [icon, priceEl, unlockBtn]);
}

function toggleNativeFullscreen(overlay) {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    overlay.requestFullscreen?.().catch(() => {});
  }
}

function attachSwipeHandlers(el, { onSwipeLeft, onSwipeRight }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  function handleTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  }

  function handleTouchEnd(e) {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Ignore mostly-vertical gestures (scrolling), only treat clearly
    // horizontal drags as swipes.
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX < 0) onSwipeLeft();
    else onSwipeRight();
  }

  el.addEventListener('touchstart', handleTouchStart, { passive: true });
  el.addEventListener('touchend', handleTouchEnd, { passive: true });

  return {
    detach() {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    },
  };
}
