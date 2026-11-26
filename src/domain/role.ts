/**
 * Which workspace this phone shows (owner, 2026-11-25). One app, several users:
 *  • Company Admin: the mobile version of the desktop admin dashboard (same
 *    logic, rules and figures, including PR commission and payouts).
 *  • Branch Manager and Front Desk: the branch workspace they share on the
 *    desktop (dashboard, billing, drafts, records, expenses...). What each one
 *    sees follows Roles & Permissions, exactly as on the desktop.
 *  • Referring clinician: the compliant e-request portal. It NEVER shows any
 *    money for the clinician (commission, payouts...): keep the two apart.
 *
 * Until login exists this is a developer switch in the menu; the app opens as
 * Company Admin. TODO(backend): the signed-in account decides the role and
 * this switch is removed.
 */
import { useSyncExternalStore } from 'react';

export type Role = 'admin' | 'manager' | 'frontdesk' | 'marketer' | 'clinician';
export const ROLES: { id: Role; label: string; note: string }[] = [
  { id: 'admin', label: 'Company Admin', note: 'All branches, finance, staff, PR, reports' },
  { id: 'manager', label: 'Branch Manager', note: 'Runs one branch: billing, staff, expenses' },
  { id: 'frontdesk', label: 'Front Desk', note: 'Patients, billing and payments' },
  { id: 'marketer', label: 'Marketer', note: 'Their hospitals, PR agents and target' },
  { id: 'clinician', label: 'Referring clinician', note: 'Requests, patients and results' },
];

const KEY = 'stanley.dev.role';
/** Which staff member a Front Desk phone is signed in as ("" = whoever is on seat today). */
const STAFF_KEY = 'stanley.dev.staff';
/** Which branch the staff workspace opens on. */
const BRANCH_KEY = 'stanley.dev.branch';
const listeners = new Set<() => void>();
const read = (): Role => {
  const r = localStorage.getItem(KEY);
  return r === 'clinician' || r === 'manager' || r === 'frontdesk' || r === 'marketer' ? r : 'admin';
};
let role = read();

export const staffBranch = () => localStorage.getItem(BRANCH_KEY) || 'br001-abuja';
export const actingStaff = () => localStorage.getItem(STAFF_KEY) || '';
export function setActingStaff(id: string) {
  localStorage.setItem(STAFF_KEY, id);
  listeners.forEach((l) => l());
}

export function setRole(r: Role) {
  role = r;
  localStorage.setItem(KEY, r);
  if (r !== 'frontdesk' && r !== 'marketer') localStorage.removeItem(STAFF_KEY);
  // Each workspace has its own pages: start on its home screen.
  window.location.hash = r === 'admin' ? '#/admin/dashboard' : r === 'clinician' ? '#/' : `#/admin/branch/${staffBranch()}/dashboard`;
  listeners.forEach((l) => l());
}
export const getRole = () => role;
export const useRole = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => role,
    () => role,
  );
export const useActingStaff = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    actingStaff,
    actingStaff,
  );
