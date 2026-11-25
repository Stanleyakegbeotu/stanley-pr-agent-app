/**
 * View only on the phone (owner, 2026-11-25, security and patient privacy).
 *
 * In the mobile app, the PR agent (referring clinician) portal and the Branch
 * Manager and Front Desk workspace can VIEW patient receipts, visits and
 * referrals but cannot take them away: no screenshots, no copying text, no
 * downloading, printing or saving receipts or referrals. Reports are the one
 * exception: they still download as PDF. The Company Admin is not limited,
 * and neither is the desktop (Electron) app, which stays on the branch desk.
 *
 * What this does in the app:
 *  • Text cannot be selected, copied or cut (typing and pasting into fields
 *    still works); the long press menu, image saving and dragging are off.
 *  • Ctrl or Cmd with C, X, S or P is blocked outside fields; Print Screen
 *    clears the clipboard and covers the screen.
 *  • Printing the app prints a notice instead of the screen.
 *  • When the app goes to the background or loses focus (app switcher,
 *    screen recorders and snipping tools on a computer), the screen is
 *    covered, so the preview shows nothing.
 *  • Native build: the same flag turns on the platform's secure screen
 *    (Android FLAG_SECURE blocks screenshots and screen recording; iOS hides
 *    the screen in recordings and the app switcher). A web page on its own
 *    cannot stop the phone's screenshot buttons; the native shell does.
 */
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useRole } from '@/domain/role';

/** Whether this person's mobile workspace is view only (everyone except the Company Admin). */
export const useViewOnly = () => useRole() !== 'admin';
const isOn = () => document.documentElement.classList.contains('view-only');

export const PRIVACY_NOTE = 'Copying, screenshots and downloads are turned off on the mobile app to protect patient privacy.';

/** Copy text, unless the workspace is view only (then explain why). */
export async function copyText(text: string, what: string, toast: (t: string) => void) {
  if (isOn()) return toast(`${what} cannot be copied on the mobile app, to protect patient privacy.`);
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast(`${what}: ${text}`);
  }
}

const editable = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, [contenteditable="true"]');

/** Ask the native shell (when there is one) for a secure screen. */
function nativeSecure(on: boolean) {
  const w = window as unknown as {
    Capacitor?: { Plugins?: { PrivacyScreen?: { enable?: () => unknown; disable?: () => unknown } } };
    ReactNativeWebView?: { postMessage: (s: string) => void };
  };
  try {
    const ps = w.Capacitor?.Plugins?.PrivacyScreen;
    if (ps) void (on ? ps.enable?.() : ps.disable?.());
    w.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'secure-screen', on }));
  } catch {
    /* no native shell */
  }
}

/** Installs the view only rules while `on`, and covers the screen when the app is not in front. */
export function PrivacyGuard({ on }: { on: boolean }) {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('view-only', on);
    nativeSecure(on);
    if (!on) return;
    const block = (e: Event) => {
      if (!editable(e.target)) e.preventDefault();
    };
    const onCopy = (e: ClipboardEvent) => {
      if (editable(e.target)) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === 'PrintScreen') {
        setCovered(true);
        void navigator.clipboard?.writeText('').catch(() => undefined);
        window.setTimeout(() => setCovered(false), 1500);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'p' || ((k === 'c' || k === 'x' || k === 'a') && !editable(e.target)))) e.preventDefault();
    };
    const hide = () => setCovered(true);
    const show = () => setCovered(false);
    const vis = () => (document.visibilityState === 'hidden' ? hide() : show());
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('selectstart', block);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    window.addEventListener('pagehide', hide);
    return () => {
      root.classList.remove('view-only');
      nativeSecure(false);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('selectstart', block);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      window.removeEventListener('pagehide', hide);
    };
  }, [on]);
  if (!on || !covered) return null;
  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-linear-to-b from-[#0b1f4d] to-[#123a8a] text-center text-white" aria-hidden="true">
      <div className="px-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15">
          <ShieldCheck size={34} />
        </span>
        <p className="mt-4 text-[18px] font-bold">Patient details hidden</p>
        <p className="mt-1 text-[13.5px] text-white/80">{PRIVACY_NOTE}</p>
      </div>
    </div>
  );
}
