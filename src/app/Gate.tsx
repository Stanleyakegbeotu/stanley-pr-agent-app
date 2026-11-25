/**
 * The app's front door (compliance, 2026-11-24).
 * SWITCHED OFF while the app is being built (owner, 2026-11-25): see
 * AUTH_SCREENS_ENABLED in domain/account. When on, in order:
 *  1. No account on this device → sign in / create account (password + OTP).
 *     SWITCHED OFF for now (owner, 2026-11-25): the sample clinician is signed in automatically.
 *  2. Agreement not accepted (or a new version) → agreement screen.
 *  3. No PIN yet → choose a PIN (then optional face / fingerprint).
 *  4. Locked → PIN / biometrics.
 *  5. The app. A Pending or Suspended account can browse the catalogue but
 *     patient screens show "being verified" (see PatientsOnly).
 *
 * Auto-lock: after 5 minutes without a touch, and every time the app comes
 * back from the background. While the app is in the background (app
 * switcher) the screen is covered so nothing shows in the preview.
 * React Native build: also set FLAG_SECURE (Android) / hide the window
 * snapshot (iOS) to block screenshots of patient screens.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Stethoscope } from 'lucide-react';
import { COMPANY } from '@/config/org';
import { AUTH_SCREENS_ENABLED, SIGN_IN_ENABLED, checkRemoteSignOut, forgetAccount, isActive, lockApp, useAccount } from '@/domain/account';
import { VERSIONS, clearConsentCache, hasAccepted, useConsents } from '@/domain/consent';
import { destroyDeviceKey } from '@/domain/vault';
import { secureWipe } from '@/domain/secureStore';
import { wipeChat } from '@/domain/chat';
import { wipeVoice } from '@/domain/referralVoice';
import { Agreement, LockScreen, SetPin, SignIn, VerificationPending } from '@/screens/auth/Auth';

export const IDLE_LOCK_MS = 5 * 60_000;

/** Sign out of this device: the encryption key is destroyed and every local copy of patient data deleted. */
export async function signOutDevice() {
  await destroyDeviceKey();
  secureWipe();
  await Promise.all([wipeChat(), wipeVoice()]).catch(() => undefined);
  ['stanley.pr.photo.v1', 'stanley.pr.chat.read', 'stanley.pr.chat.settings', 'stanley.pr.chat.deleted', 'stanley.pr.updates.dismissed', 'stanley.pr.consents.v1', 'stanley.pr.audit.queue'].forEach((k) => localStorage.removeItem(k));
  clearConsentCache();
  forgetAccount();
  window.location.hash = '#/';
  window.location.reload();
}

export function Gate({ children }: { children: ReactNode }) {
  const { account, unlocked } = useAccount();
  useConsents(); // re-render when the agreement is accepted
  const [covered, setCovered] = useState(false);

  // Auto-lock: idle for 5 minutes, or coming back from the background.
  useEffect(() => {
    if (!AUTH_SCREENS_ENABLED) return; // switched off while the app is being built
    let last = Date.now();
    const touch = () => (last = Date.now());
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const idle = window.setInterval(() => {
      if (Date.now() - last > IDLE_LOCK_MS) lockApp();
    }, 15_000);
    const vis = () => {
      if (document.visibilityState === 'hidden') setCovered(true);
      else {
        lockApp();
        setCovered(false);
        last = Date.now();
        void checkRemoteSignOut().then((out) => out && void signOutDevice());
      }
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', () => setCovered(true));
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(idle);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  // While the app is being built (domain/account AUTH_SCREENS_ENABLED = false): straight to the app.
  if (!AUTH_SCREENS_ENABLED) return <>{children}</>;

  let screen: ReactNode;
  // Sign-in is switched off for now (domain/account SIGN_IN_ENABLED): a lock-out then just asks for a new PIN.
  if (!account || (account.lockedOut && SIGN_IN_ENABLED)) screen = <SignIn />;
  else if (!hasAccepted('agreement', VERSIONS.agreement, account.clinician.id)) screen = <Agreement />;
  else if (!account.pin) screen = <SetPin />;
  else if (!unlocked) screen = <LockScreen onSignOut={() => void signOutDevice()} />;
  else screen = children;

  return (
    <>
      {screen}
      {covered && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#eef4fe]" aria-hidden="true">
          <span className="flex items-center gap-2.5 text-brand-700">
            <Stethoscope size={28} />
            <span className="text-[22px] font-extrabold tracking-[-0.03em]">{COMPANY.appName}</span>
          </span>
        </div>
      )}
    </>
  );
}

/** Patient screens: only for Active accounts. */
export function PatientsOnly({ children }: { children: ReactNode }) {
  const { account } = useAccount();
  return isActive(account) ? <>{children}</> : <VerificationPending />;
}
