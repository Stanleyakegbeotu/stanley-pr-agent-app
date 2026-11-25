/**
 * Clinician account, verification and app lock (compliance, 2026-11-24).
 *
 *  • Only verified, licensed professionals can send requests or see patients:
 *    Pending verification → Active → Suspended. The company verifies the
 *    licence with the regulator (MDCN, NMCN, RRBN, MLSCN, PCN).
 *  • First sign-in: password + one-time code (OTP). Then a 6-digit PIN, and
 *    optionally face/fingerprint, to open the app.
 *  • The app locks after 5 minutes idle and every time it comes back from the
 *    background (app/Gate.tsx). 5 wrong PINs = locked out: sign in again with
 *    password + code.
 *  • Licence number and profession can only be changed by the company.
 *
 * The clinician's own account details are not patient data, so they are kept
 * in normal storage; the PIN is stored only as a salted hash.
 */
import { useSyncExternalStore } from 'react';
import { logAudit } from './audit';
import { canEncrypt } from './vault';

export type AccountStatus = 'pending' | 'active' | 'suspended';
export const PROFESSIONS = ['Doctor', 'Nurse / Midwife', 'Radiographer', 'Medical Lab Scientist', 'Pharmacist', 'Other licensed professional'] as const;
export const REGULATORS: Record<string, string> = {
  MDCN: 'Medical and Dental Council of Nigeria',
  NMCN: 'Nursing and Midwifery Council of Nigeria',
  RRBN: 'Radiographers Registration Board of Nigeria',
  MLSCN: 'Medical Laboratory Science Council of Nigeria',
  PCN: 'Pharmacists Council of Nigeria',
};
/** The usual regulator for each profession (the clinician can pick another). */
export const REGULATOR_FOR: Record<string, string> = { Doctor: 'MDCN', 'Nurse / Midwife': 'NMCN', Radiographer: 'RRBN', 'Medical Lab Scientist': 'MLSCN', Pharmacist: 'PCN' };

export interface Clinician {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  profession: string;
  regulator: string;
  licence: string;
  facility: string;
  phone: string;
  email: string;
  memberSince: string;
}

export interface Account {
  clinician: Clinician;
  status: AccountStatus;
  pin?: { salt: string; hash: string };
  /** WebAuthn credential for face / fingerprint unlock. */
  biometricId?: string;
  failedPins: number;
  /** 5 wrong PINs: must sign in again with password + code. */
  lockedOut?: boolean;
}

const KEY = 'stanley.pr.account.v1';
const listeners = new Set<() => void>();
let account: Account | null | undefined;
let unlocked = false;
let snapshot = { account: null as Account | null, unlocked: false };

function load(): Account | null {
  if (account === undefined)
    try {
      account = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Account | null;
    } catch {
      account = null;
    }
  return account;
}
function emit() {
  snapshot = { account: load(), unlocked };
  listeners.forEach((l) => l());
}
function save(a: Account | null) {
  account = a;
  if (a) localStorage.setItem(KEY, JSON.stringify(a));
  else localStorage.removeItem(KEY);
  emit();
}
snapshot = { account: load(), unlocked };

export const getAccount = () => load();
export const isUnlocked = () => unlocked;
export function useAccount() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => snapshot,
    () => snapshot,
  );
}
/** Can this clinician send requests and see patients? */
export const isActive = (a: Account | null) => a?.status === 'active';

/* ─────────────── sign-in (stubbed until the server exists) ─────────────── */

/** The sample clinician the sign-in stub returns (verified). */
const SAMPLE: Clinician = {
  id: 'RC-00842',
  title: 'Dr.',
  firstName: 'Stanley',
  lastName: 'Okafor',
  profession: 'Doctor',
  regulator: 'MDCN',
  licence: 'MDCN/R/45821 (sample)',
  facility: 'Sample clinic, Abuja',
  phone: '+234 803 456 7890',
  email: 'stanley.okafor@example.com',
  memberSince: '2025-01-12',
};
/** Demo one-time code until SMS is connected. */
export const DEMO_OTP = '123456';

/**
 * Owner (2026-11-25): the sign-in and sign-up screens are switched OFF for now.
 * The app opens straight into the sample clinician's (verified) account; the
 * agreement, PIN and app lock still apply. Set to true to bring back
 * password + one-time code sign-in (screens/auth/Auth.tsx SignIn).
 */
export const SIGN_IN_ENABLED = false;

/**
 * Owner (2026-11-25): while the app is still being built, ALL the security
 * screens are switched off: no sign-in, agreement, PIN, face/fingerprint or
 * auto-lock. Opening the app goes straight to the Dashboard as the sample
 * clinician. Encryption of patient data on the phone stays ON.
 * Set to true to bring the whole flow back (app/Gate.tsx).
 */
export const AUTH_SCREENS_ENABLED = false;
if (!SIGN_IN_ENABLED && !load()) save({ clinician: SAMPLE, status: 'active', failedPins: 0 });

type Pending = { kind: 'signin'; who: string } | { kind: 'register'; clinician: Omit<Clinician, 'id' | 'memberSince'> };
let pendingAuth: Pending | null = null;

/** Step 1: password. TODO(backend): POST /auth/signin → sends an OTP by SMS. */
export async function startSignIn(who: string, password: string) {
  if (password.length < 8) throw new Error('Check your password. It has at least 8 characters.');
  pendingAuth = { kind: 'signin', who };
}
/** Step 1 (new account). TODO(backend): POST /auth/register → sends an OTP by SMS. */
export async function startRegister(c: Omit<Clinician, 'id' | 'memberSince'>, password: string) {
  if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
  pendingAuth = { kind: 'register', clinician: c };
}
/** Step 2: the one-time code. TODO(backend): POST /auth/verify-otp → session token. */
export async function verifyOtp(code: string) {
  if (!pendingAuth) throw new Error('Start again: enter your password first.');
  if (code !== DEMO_OTP) throw new Error('That code isn’t right. Check the SMS and try again.');
  const prev = load();
  if (pendingAuth.kind === 'signin') {
    // A lock-out keeps the account but needs a new PIN.
    const base = prev && !prev.lockedOut ? prev : null;
    save({ clinician: base?.clinician ?? SAMPLE, status: base?.status ?? 'active', failedPins: 0, biometricId: base?.biometricId });
  } else {
    save({ clinician: { ...pendingAuth.clinician, id: `RC-${String(Date.now()).slice(-5)}`, memberSince: new Date().toISOString().slice(0, 10) }, status: 'pending', failedPins: 0 });
  }
  pendingAuth = null;
  unlocked = true;
  logAudit({ type: 'auth.signin' });
  emit();
}

/** TODO(backend): the company approves the licence; the app reads the new status. Demo only. */
export function demoApprove() {
  const a = load();
  if (a) save({ ...a, status: 'active' });
}
/** TODO(backend): poll /me/status so a suspended or approved account updates without signing in again. */
export async function refreshStatus() {}

export function updateClinician(patch: Partial<Pick<Clinician, 'title' | 'firstName' | 'lastName' | 'phone' | 'email'>>) {
  const a = load();
  if (a) save({ ...a, clinician: { ...a.clinician, ...patch } });
}

/* ─────────────── PIN and lock ─────────────── */

async function hashPin(pin: string, salt: string) {
  if (canEncrypt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150_000 }, base, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  }
  // No WebCrypto (plain-HTTP development only). The native build uses the platform keystore.
  let h = 2166136261;
  for (let i = 0; i < 20_000; i++) for (const ch of salt + pin + i) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `dev-${h.toString(36)}`;
}

export async function setPin(pin: string) {
  const a = load();
  if (!a) return;
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  save({ ...a, pin: { salt, hash: await hashPin(pin, salt) }, failedPins: 0, lockedOut: false });
  unlocked = true;
  emit();
}

export const MAX_PIN_TRIES = 5;
/** True = unlocked. After 5 wrong PINs the account is locked out (sign in again). */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const a = load();
  if (!a?.pin) return false;
  if ((await hashPin(pin, a.pin.salt)) === a.pin.hash) {
    unlocked = true;
    save({ ...a, failedPins: 0 });
    return true;
  }
  const failed = a.failedPins + 1;
  if (failed >= MAX_PIN_TRIES) {
    logAudit({ type: 'auth.lockout' });
    save({ ...a, failedPins: failed, lockedOut: true, pin: undefined });
  } else save({ ...a, failedPins: failed });
  return false;
}

export function lockApp() {
  if (!unlocked) return;
  unlocked = false;
  emit();
}

/* ─────────────── face / fingerprint (WebAuthn) ─────────────── */

const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * Is a built-in face / fingerprint sensor available? On the web this is
 * WebAuthn with a platform authenticator. React Native build: use the
 * platform biometric API (expo-local-authentication / LocalAuthentication).
 */
export async function biometricsAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}
export async function enableBiometrics() {
  const a = load();
  if (!a) return false;
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'STANLEY Referrer Portal' },
      user: { id: new TextEncoder().encode(a.clinician.id), name: a.clinician.email, displayName: `${a.clinician.firstName} ${a.clinician.lastName}` },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  save({ ...a, biometricId: toB64(cred.rawId) });
  return true;
}
export function disableBiometrics() {
  const a = load();
  if (a) save({ ...a, biometricId: undefined });
}
/** The OS checks the face / fingerprint. TODO(backend): verify the signed assertion on the server. */
export async function unlockWithBiometrics(): Promise<boolean> {
  const a = load();
  if (!a?.biometricId) return false;
  try {
    const ok = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: fromB64(a.biometricId) }], userVerification: 'required', timeout: 60_000 },
    });
    if (!ok) return false;
    unlocked = true;
    save({ ...a, failedPins: 0 });
    return true;
  } catch {
    return false;
  }
}

/* ─────────────── sign out of this device ─────────────── */

/** Clears the session; signOutDevice (app/Gate) also wipes all patient data. */
export function forgetAccount() {
  logAudit({ type: 'auth.signout' });
  unlocked = false;
  save(null);
}
/** TODO(backend): the company can sign a device out remotely; poll /device/status and call signOutDevice(). */
export async function checkRemoteSignOut(): Promise<boolean> {
  return false;
}

/** Change PIN: the old one is cleared and the app asks for a new one (after the current unlock). */
export function resetPin() {
  const a = load();
  if (a) save({ ...a, pin: undefined, failedPins: 0 });
}
