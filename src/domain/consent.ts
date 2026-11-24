/**
 * Consent and acceptance records (compliance, NDPA 2023 / GAID 2025): who
 * accepted what, which version, and when. Kept on the phone and queued for
 * the server (TODO in domain/api). No patient names are stored here; a
 * patient-notice record only carries the request ID.
 */
import { useSyncExternalStore } from 'react';

export const VERSIONS = {
  agreement: '2026-11-v1',
  privacy: '2026-11-v1',
  terms: '2026-11-v1',
  patientNotice: '2026-11-v1',
} as const;

export type ConsentKind = 'agreement' | 'privacy' | 'terms' | 'patient-notice';
export interface ConsentRecord {
  kind: ConsentKind;
  version: string;
  at: string;
  /** Who accepted (clinician ID). */
  by: string;
  /** For a patient notice: the request ID. */
  ref?: string;
}

const KEY = 'stanley.pr.consents.v1';
const listeners = new Set<() => void>();
let cache: ConsentRecord[] | null = null;
const read = () => {
  if (!cache)
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as ConsentRecord[];
    } catch {
      cache = [];
    }
  return cache;
};

export function recordConsent(r: Omit<ConsentRecord, 'at'> & { at?: string }) {
  const rec: ConsentRecord = { ...r, at: r.at ?? new Date().toISOString() };
  cache = [...read(), rec];
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
  // TODO(backend): api.pushConsent(rec) so the company keeps the legal record.
  return rec;
}
export const hasAccepted = (kind: ConsentKind, version: string, by: string) => read().some((r) => r.kind === kind && r.version === version && r.by === by);
export const useConsents = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    read,
  );
export function clearConsentCache() {
  cache = null;
}
