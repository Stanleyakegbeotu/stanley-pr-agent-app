/**
 * Safe areas in device previews (owner, 2026-11-24).
 *
 * On a real iPhone the system reports how much room the notch / Dynamic
 * Island and the home bar take (env(safe-area-inset-*)), and every header and
 * bottom bar uses that through --safe-top / --safe-bottom (index.css).
 *
 * Desktop device previews (Chrome/Edge DevTools "iPhone 14 Pro Max" etc.) draw
 * the island on the frame but report 0, so headers slide under it. When we can
 * tell we're in such a preview — an iPhone screen with no browser bars and the
 * system reporting 0 — we fill in that model's real values. A real iPhone is
 * never affected: in Safari the page sits below the status bar (it is shorter
 * than the screen), and as an installed app the system reports real values.
 */

/** Portrait CSS size → [top, bottom] safe area of iPhones with a notch or Dynamic Island. */
const IPHONES: Record<string, [number, number]> = {
  '375x812': [50, 34], // X, XS, 11 Pro, 12/13 mini
  '414x896': [48, 34], // XR, 11, XS Max, 11 Pro Max
  '390x844': [47, 34], // 12, 13, 14
  '428x926': [47, 34], // 12/13 Pro Max, 14 Plus
  '393x852': [59, 34], // 14 Pro, 15, 15 Pro, 16  (Dynamic Island)
  '430x932': [59, 34], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  '402x874': [62, 34], // 16 Pro
  '440x956': [62, 34], // 16 Pro Max
};

function reported(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(probe);
  const v = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return v;
}

function apply() {
  const root = document.documentElement.style;
  root.removeProperty('--safe-top');
  root.removeProperty('--safe-bottom');
  if (!/iPhone/.test(navigator.userAgent) || reported() > 0) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fullScreen = Math.abs(h - screen.height) <= 1 && Math.abs(w - screen.width) <= 1;
  const model = IPHONES[`${w}x${h}`];
  if (!fullScreen || !model) return; // real Safari (has its own bars) or landscape / unknown size
  root.setProperty('--safe-top', `${model[0]}px`);
  root.setProperty('--safe-bottom', `${model[1]}px`);
}

export function watchSafeArea() {
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
