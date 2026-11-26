/**
 * The PR agent's account details (owner, 2026-11-26: "let's bring that
 * back"): bank, 10-digit account number and account name, entered and
 * changed by the agent in Settings. Kept ENCRYPTED on this phone
 * (secureStore); it reaches the branch with the cloud connection. Every
 * change keeps the date it was made.
 */
import { useSyncExternalStore } from 'react';
import { secureGet, secureRemove, secureSet } from './secureStore';

export interface AccountDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  /** When they were last changed. */
  at: string;
}

const KEY = 'payout.account';
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export const accountDetails = () => secureGet<AccountDetails>(KEY);
export function useAccountDetails(): AccountDetails | undefined {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return accountDetails();
}
export function saveAccountDetails(d: Omit<AccountDetails, 'at'>) {
  secureSet(KEY, { ...d, at: new Date().toISOString() });
  bump();
}
export function removeAccountDetails() {
  secureRemove(KEY);
  bump();
}
/** 0123456789 → •••• 6789 */
export const maskAccount = (n: string) => `•••• ${n.slice(-4)}`;
