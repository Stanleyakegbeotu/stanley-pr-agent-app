/**
 * Smooth closing for every slide-up card (owner, 2026-11-25): cards slide up
 * when they open and must slide back DOWN when they close, never just vanish,
 * however they are closed (close button, back, tapping outside, Escape,
 * choosing an option, or the page changing underneath).
 *
 * React removes a closed card at once, so a single watcher notices when an
 * element marked data-slide-layer leaves the page, puts a non-interactive copy
 * in its place (with the same scroll position) and plays the closing
 * animation on the copy: the dim backdrop fades out and the card
 * (data-sheet-panel) slides down. Respects "reduce motion".
 *
 * Mark a card:  <div data-slide-layer className="fade-in fixed inset-0 ...">
 *                 <div data-sheet-panel className="sheet-up ..."> ... </div>
 */
const EXIT_MS = 300;

function ghost(layer: HTMLElement) {
  const g = layer.cloneNode(true) as HTMLElement;
  g.removeAttribute('data-slide-layer');
  g.dataset.ghost = '1';
  g.setAttribute('aria-hidden', 'true');
  g.inert = true;
  g.style.pointerEvents = 'none';
  g.style.animation = '';
  g.classList.remove('fade-in');
  g.classList.add('fade-out');
  g.querySelectorAll<HTMLElement>('[data-sheet-panel]').forEach((p) => {
    p.style.animation = '';
    p.classList.remove('sheet-up');
    p.classList.add('sheet-down');
  });
  g.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  document.body.appendChild(g);
  // Keep what was on screen: restore the scroll positions recorded while open.
  g.querySelectorAll<HTMLElement>('[data-st]').forEach((el) => (el.scrollTop = Number(el.dataset.st)));
  window.setTimeout(() => g.remove(), EXIT_MS + 40);
}

/**
 * Swipe down to close (owner, 2026-11-25): on every slide-up card the finger
 * can pull the card down instead of pressing back or close. The card follows
 * the finger (the backdrop lightens with it); let go past about a quarter of
 * its height, or flick down, and it closes; otherwise it springs back.
 * Pulling down on the content only starts when that content is scrolled to
 * the top, so normal scrolling is never hijacked. Text fields, sliders and
 * anything marked data-no-swipe (e.g. a carousel) are left alone.
 * Closing taps the card's own backdrop, so each card closes its usual way.
 */
function installSwipeDown() {
  let s: { panel: HTMLElement; layer: HTMLElement; scroller: HTMLElement | null; y0: number; x0: number; t0: number; dy: number; on: boolean; alpha: number; base: string; h: number } | null = null;
  const scrollerOf = (el: Element | null, stop: HTMLElement): HTMLElement | null => {
    for (let n = el as HTMLElement | null; n && n !== stop; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  };
  const reset = (panel: HTMLElement, layer: HTMLElement) => {
    panel.style.transition = 'transform 260ms cubic-bezier(0.22, 0.8, 0.24, 1)';
    panel.style.transform = '';
    layer.style.backgroundColor = '';
    window.setTimeout(() => (panel.style.transition = ''), 280);
  };
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return (s = null);
      const t = e.target as Element;
      const panel = t.closest<HTMLElement>('[data-sheet-panel]');
      const layer = panel?.closest<HTMLElement>('[data-slide-layer]');
      if (!panel || !layer || t.closest('input, textarea, select, [contenteditable], [data-no-swipe]')) return (s = null);
      // Only the top card moves.
      const layers = document.querySelectorAll('[data-slide-layer]');
      if (layers[layers.length - 1] !== layer) return (s = null);
      const p = e.touches[0]!;
      const bg = getComputedStyle(layer).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const parts = m ? m[1]!.split(',').map((x) => x.trim()) : [];
      s = { panel, layer, scroller: scrollerOf(t, panel), y0: p.clientY, x0: p.clientX, t0: Date.now(), dy: 0, on: false, alpha: parts[3] ? Number(parts[3]) : 0.4, base: parts.slice(0, 3).join(','), h: panel.getBoundingClientRect().height };
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!s) return;
      const p = e.touches[0]!;
      const dy = p.clientY - s.y0;
      const dx = p.clientX - s.x0;
      if (!s.on) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return (s = null); // sideways: not ours
        if (dy < -6 || (s.scroller && s.scroller.scrollTop > 0)) return (s = null); // scrolling content
        if (dy < 8) return;
        s.on = true;
        s.y0 = p.clientY - 1;
        s.panel.style.transition = 'none';
        // The opening animations hold their end state and would override the drag.
        s.panel.style.animation = 'none';
        s.layer.style.animation = 'none';
      }
      e.preventDefault();
      s.dy = Math.max(0, p.clientY - s.y0);
      // A little resistance so the card feels attached to the finger.
      const y = s.dy < 40 ? s.dy : 40 + (s.dy - 40) * 0.92;
      s.panel.style.transform = `translateY(${y}px)`;
      if (s.base) s.layer.style.backgroundColor = `rgba(${s.base},${(s.alpha * (1 - Math.min(1, y / s.h))).toFixed(3)})`;
    },
    { passive: false },
  );
  const end = () => {
    if (!s) return;
    const { panel, layer, on, dy, t0, h } = s;
    s = null;
    if (!on) return;
    const speed = dy / Math.max(1, Date.now() - t0);
    if (dy > Math.min(160, h * 0.25) || (speed > 0.55 && dy > 40)) {
      // Close from where the finger left it: the leaving copy slides on from here.
      panel.style.setProperty('--drag-y', panel.style.transform.replace(/[^\d.]/g, '') + 'px');
      layer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      // If the card stayed (e.g. it asks before closing), put it back.
      window.setTimeout(() => panel.isConnected && reset(panel, layer), 60);
    } else reset(panel, layer);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}

export function installSlideAway() {
  const w = window as unknown as { __slideAway?: boolean };
  if (w.__slideAway) return;
  w.__slideAway = true;
  installSwipeDown();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Remember scroll positions inside cards (a removed element can't be measured).
  document.addEventListener(
    'scroll',
    (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('[data-slide-layer]')) t.dataset.st = String(t.scrollTop);
    },
    { capture: true, passive: true },
  );
  new MutationObserver((muts) => {
    if (reduce.matches) return;
    for (const m of muts)
      m.removedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement) || n.dataset.ghost) return;
        const layers = n.matches('[data-slide-layer]') ? [n] : Array.from(n.querySelectorAll<HTMLElement>('[data-slide-layer]'));
        layers.forEach(ghost);
      });
  }).observe(document.body, { childList: true, subtree: true });
}
