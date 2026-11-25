/**
 * Which workspace this phone shows (owner, 2026-11-25). One app, several users:
 *  • Company Admin: the mobile version of the desktop admin dashboard (same
 *    logic, rules and figures, including PR commission and payouts).
 *  • Referring clinician: the compliant e-request portal. It NEVER shows any
 *    money for the clinician (commission, payouts...): keep the two apart.
 *  • Branch Manager and Front Desk: coming next (desktop branch workspace).
 *
 * Until login exists this is a developer switch in the menu; the app opens as
 * Company Admin. TODO(backend): the signed-in account decides the role and
 * this switch is removed.
 */
import { useSyncExternalStore } from 'react';

export type Role = 'admin' | 'clinician';
export const ROLES: { id: Role; label: string; note: string }[] = [
  { id: 'admin', label: 'Company Admin', note: 'All branches, finance, staff, PR, reports' },
  { id: 'clinician', label: 'Referring clinician', note: 'Requests, patients and results' },
];

const KEY = 'stanley.dev.role';
const listeners = new Set<() => void>();
const read = (): Role => (localStorage.getItem(KEY) === 'clinician' ? 'clinician' : 'admin');
let role = read();

export function setRole(r: Role) {
  role = r;
  localStorage.setItem(KEY, r);
  // Each workspace has its own pages: start on its home screen.
  window.location.hash = r === 'admin' ? '#/admin/dashboard' : '#/';
  listeners.forEach((l) => l());
}
export const getRole = () => role;
export const useRole = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => role,
    () => role,
  );
