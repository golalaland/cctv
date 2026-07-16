/**
 * animations.js
 *
 * Small set of reusable motion helpers built on the Web Animations API,
 * plus scroll-triggered reveal wiring via IntersectionObserver. Feature
 * modules use these instead of writing bespoke rAF loops or duplicating
 * IntersectionObserver setup in every file that wants a reveal-on-scroll
 * effect (gallery cards, host profile stats, etc.).
 *
 * CSS keyframes for pure-CSS effects (shimmer, pulse) live in animations.css
 * alongside this file — this module only covers JS-driven, parameterized
 * animation.
 */

import { prefersReducedMotion } from './utilities.js';

/**
 * Fade + rise an element into view. Returns the Animation instance so
 * callers can `.finished` await it if needed.
 */
export function fadeInUp(el, { duration = 480, delay = 0, distance = 16 } = {}) {
  if (prefersReducedMotion()) {
    el.style.opacity = '1';
    el.style.transform = 'none';
    return null;
  }
  return el.animate(
    [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration, delay, easing: 'cubic-bezier(0, 0, 0.2, 1)', fill: 'forwards' }
  );
}

export function fadeOut(el, { duration = 280 } = {}) {
  if (prefersReducedMotion()) {
    el.style.opacity = '0';
    return null;
  }
  return el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration,
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
    fill: 'forwards',
  });
}

/**
 * Observe a set of elements and add `.in-view` (triggering their CSS
 * transition/animation) the first time each scrolls into the viewport.
 * Elements are unobserved after triggering once — reveals don't replay.
 */
export function observeReveal(elements, { threshold = 0.15, rootMargin = '0px 0px -8% 0px' } = {}) {
  if (prefersReducedMotion()) {
    for (const el of elements) el.classList.add('in-view');
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold, rootMargin }
  );

  for (const el of elements) observer.observe(el);

  return () => observer.disconnect();
}

/**
 * Brief scale-pulse feedback for an interactive element (like button
 * taps, reaction sends) without relying on a CSS class toggle race.
 */
export function pulse(el, { scale = 1.15, duration = 220 } = {}) {
  if (prefersReducedMotion()) return null;
  return el.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
  );
}
