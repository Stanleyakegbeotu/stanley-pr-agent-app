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
  g.classList.remove('fade-in');
  g.classList.add('fade-out');
  g.querySelectorAll<HTMLElement>('[data-sheet-panel]').forEach((p) => {
    p.classList.remove('sheet-up');
    p.classList.add('sheet-down');
  });
  g.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  document.body.appendChild(g);
  // Keep what was on screen: restore the scroll positions recorded while open.
  g.querySelectorAll<HTMLElement>('[data-st]').forEach((el) => (el.scrollTop = Number(el.dataset.st)));
  window.setTimeout(() => g.remove(), EXIT_MS + 40);
}

export function installSlideAway() {
  const w = window as unknown as { __slideAway?: boolean };
  if (w.__slideAway) return;
  w.__slideAway = true;
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
