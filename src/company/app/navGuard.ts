// GENERATED from the STANLEY desktop app (src/app/navGuard.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Navigation guard — lets a page with unsaved work (e.g. an unfinished bill)
 * intercept in-app navigation and ask first (Save draft / Discard / Stay).
 */
type Guard = (to: string) => boolean;
let guard: Guard | null = null;

/** Install a guard; returns a function that removes it. The guard returns false to stop the navigation. */
export function setNavigationGuard(g: Guard): () => void {
  guard = g;
  return () => {
    if (guard === g) guard = null;
  };
}

export function passesNavigationGuard(to: string): boolean {
  return !guard || guard(to);
}
