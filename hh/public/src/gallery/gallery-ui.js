/**
 * gallery-ui.js
 *
 * Renders the gallery grid: category/type filter chips, masonry media
 * cards (skeleton-loading, hover-autoplay video thumbnails), and
 * infinite scroll pagination. Talks only to gallery-service.js — never
 * touches Firestore or Cloud Functions directly.
 *
 * Opening a media item in the fullscreen viewer is delegated to the
 * caller via the `onMediaOpen` callback rather than importing
 * gallery-viewer.js directly — keeps this module usable on its own
 * regardless of whether a viewer exists yet, matching the separation
 * already used elsewhere in the codebase (chat-ui.js doesn't reach into
 * chat-moderation.js's UI concerns, etc.). The Media Viewer batch and
 * the integration batch after it wire this callback to the real viewer.
 */

import { createEl, prefersReducedMotion, isTouchDevice } from '../shared/utilities.js';
import { fetchMediaPage, fetchCategories, recordView } from './gallery-service.js';

const SKELETON_COUNT = 8;
const SKELETON_REFILL_COUNT = 4;

/** Format a raw view count as "1.2K" / "3.4M", matching the reels reference style. */
function formatViewCount(count) {
  const n = Number(count) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Mounts the gallery into `root`. Returns a teardown function.
 * @param {HTMLElement} root
 * @param {{ onMediaOpen?: (item: object, items: Array<object>, index: number) => void }} [options]
 */
export function mountGallery(root, { onMediaOpen } = {}) {
  const state = {
    categoryId: null,
    type: null,
    items: [],
    cursor: null,
    noMore: false,
    loading: false,
  };

  const panel = createEl('div', { classNames: ['gallery-panel'] });
  const filterBar = createEl('div', { classNames: ['gallery-filter-bar'] });
  const grid = createEl('div', { classNames: ['gallery-grid'] });
  const sentinel = createEl('div', { classNames: ['gallery-sentinel'] });

  panel.appendChild(filterBar);
  panel.appendChild(grid);
  panel.appendChild(sentinel);
  root.appendChild(panel);

  function handleOpen(item, index) {
    if (typeof onMediaOpen === 'function') {
      onMediaOpen(item, state.items, index);
    }
  }

  function handleFilterChange() {
    reloadGrid(grid, state, handleOpen);
  }

  mountFilterBar(filterBar, state, handleFilterChange);
  showSkeletons(grid, SKELETON_COUNT);
  loadNextPage(grid, state, handleOpen, { replace: true });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadNextPage(grid, state, handleOpen);
      }
    },
    { rootMargin: '400px' }
  );
  observer.observe(sentinel);

  return function teardown() {
    observer.disconnect();
  };
}

/**
 * Category/type filter chips. Re-renders its own small DOM on every
 * change rather than manually toggling active classes — the filter bar
 * is small enough that a full re-render is cheap and this avoids an
 * entire class of "forgot to clear the old active chip" bugs.
 */
async function mountFilterBar(filterBar, state, onChange) {
  let categories = [];
  try {
    categories = await fetchCategories();
  } catch (error) {
    // Non-critical — the bar still shows Photos/Videos toggles even if
    // categories fail to load. Still logged for debugging visibility.
    console.error('[gallery] Failed to load categories:', error);
  }

  function render() {
    filterBar.innerHTML = '';

    const categoryRow = createEl('div', { classNames: ['gallery-chip-row'] });
    categoryRow.appendChild(
      buildChip('All', state.categoryId === null, () => {
        state.categoryId = null;
        render();
        onChange();
      })
    );
    for (const category of categories) {
      categoryRow.appendChild(
        buildChip(category.name, state.categoryId === category.id, () => {
          state.categoryId = category.id;
          render();
          onChange();
        })
      );
    }
    filterBar.appendChild(categoryRow);

    const typeRow = createEl('div', { classNames: ['gallery-chip-row'] });
    typeRow.appendChild(
      buildChip('Photos', state.type === 'photo', () => {
        state.type = state.type === 'photo' ? null : 'photo';
        render();
        onChange();
      })
    );
    typeRow.appendChild(
      buildChip('Videos', state.type === 'video', () => {
        state.type = state.type === 'video' ? null : 'video';
        render();
        onChange();
      })
    );
    filterBar.appendChild(typeRow);
  }

  render();
}

function buildChip(label, active, onClick) {
  const el = createEl('button', {
    classNames: ['gallery-chip', active ? 'gallery-chip-active' : ''].filter(Boolean),
    attrs: { type: 'button' },
    text: label,
  });
  el.addEventListener('click', onClick);
  return el;
}

function reloadGrid(grid, state, handleOpen) {
  state.items = [];
  state.cursor = null;
  state.noMore = false;
  grid.innerHTML = '';
  showSkeletons(grid, SKELETON_COUNT);
  loadNextPage(grid, state, handleOpen, { replace: true });
}

async function loadNextPage(grid, state, handleOpen, { replace = false } = {}) {
  if (state.loading || state.noMore) return;
  state.loading = true;

  try {
    const { items, nextCursor } = await fetchMediaPage({
      categoryId: state.categoryId,
      type: state.type,
      cursor: state.cursor,
    });

    if (replace) {
      grid.innerHTML = '';
    } else {
      removeSkeletons(grid);
    }

    const startIndex = state.items.length;
    state.items = state.items.concat(items);
    state.cursor = nextCursor;
    state.noMore = nextCursor === null;

    items.forEach((item, i) => {
      grid.appendChild(buildMediaCard(item, startIndex + i, handleOpen));
    });

    if (items.length === 0 && startIndex === 0) {
      grid.appendChild(createEl('p', { classNames: ['gallery-empty'], text: 'Nothing here yet.' }));
    }

    if (!state.noMore) {
      showSkeletons(grid, SKELETON_REFILL_COUNT);
    }
  } catch (error) {
    console.error('[gallery] Failed to load media page:', error);
    removeSkeletons(grid);
    grid.appendChild(
      createEl('p', { classNames: ['gallery-error'], text: 'Couldn\u2019t load the gallery. Try again shortly.' })
    );
    state.noMore = true;
  } finally {
    state.loading = false;
  }
}

function showSkeletons(grid, count) {
  for (let i = 0; i < count; i += 1) {
    grid.appendChild(createEl('div', { classNames: ['gallery-card', 'skeleton', 'gallery-skeleton'] }));
  }
}

function removeSkeletons(grid) {
  grid.querySelectorAll('.gallery-skeleton').forEach((el) => el.remove());
}

function buildMediaCard(item, index, handleOpen) {
  const card = createEl('div', {
    classNames: ['gallery-card'],
    attrs: { 'data-media-id': item.id },
  });

  const mediaEl = item.type === 'video' ? buildVideoThumb(item) : buildPhotoThumb(item);
  card.appendChild(mediaEl);

  if (item.type === 'video') {
    const playIcon = createEl('div', { classNames: ['gallery-play-icon'], text: '\u25b6' });
    card.appendChild(playIcon);
    // Native play/pause/ended events cover both the desktop hover-preview
    // and the touch-scroll-into-view autoplay paths uniformly, rather than
    // wiring the icon separately to each interaction method.
    mediaEl.addEventListener('play', () => playIcon.classList.add('gallery-play-icon-hidden'));
    mediaEl.addEventListener('pause', () => playIcon.classList.remove('gallery-play-icon-hidden'));
    mediaEl.addEventListener('ended', () => playIcon.classList.remove('gallery-play-icon-hidden'));
  }

  if (item.premium) {
    card.appendChild(createEl('div', { classNames: ['gallery-lock-badge'], text: '\ud83d\udd12' }));
  }

  const overlay = createEl('div', { classNames: ['gallery-card-overlay'] });
  const viewsRow = createEl('div', {
    classNames: ['gallery-card-views'],
    text: `\ud83d\udc41\ufe0f ${formatViewCount(item.views)} views`,
  });
  const titleEl = createEl('div', { classNames: ['gallery-card-title'], text: item.title || item.hostName || '' });
  overlay.appendChild(viewsRow);
  overlay.appendChild(titleEl);
  if (item.description) {
    overlay.appendChild(createEl('div', { classNames: ['gallery-card-description'], text: item.description }));
  }
  card.appendChild(overlay);

  card.addEventListener('click', () => {
    recordView(item.id);
    handleOpen(item, index);
  });

  observeTouchAutoplay(card, item);

  return card;
}

function buildPhotoThumb(item) {
  return createEl('img', {
    classNames: ['gallery-card-media'],
    attrs: {
      src: item.thumbnailUrl || item.url,
      alt: item.title || '',
      loading: 'lazy',
    },
  });
}

function buildVideoThumb(item) {
  const video = createEl('video', {
    classNames: ['gallery-card-media'],
    attrs: {
      muted: '',
      loop: '',
      playsinline: '',
      preload: 'metadata',
      poster: item.thumbnailUrl || '',
    },
  });
  // setAttribute('muted', '') alone is not always sufficient for browser
  // autoplay-without-gesture policies — set the DOM property directly too.
  video.muted = true;

  const source = createEl('source', { attrs: { src: item.url, type: 'video/mp4' } });
  video.appendChild(source);

  if (!isTouchDevice() && !prefersReducedMotion()) {
    video.addEventListener('mouseenter', () => video.play().catch(() => {}));
    video.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  }

  return video;
}

/**
 * On touch devices (no hover), autoplay video thumbnails only while
 * scrolled into view, pausing again once scrolled past — the closest
 * touch equivalent to the desktop hover-play behavior.
 */
function observeTouchAutoplay(card, item) {
  if (item.type !== 'video' || !isTouchDevice() || prefersReducedMotion()) return;

  const video = card.querySelector('video');
  if (!video) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    },
    { threshold: 0.6 }
  );
  observer.observe(card);
}
