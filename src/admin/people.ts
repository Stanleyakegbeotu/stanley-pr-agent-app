/**
 * Who did what (owner, 2026-11-25): wherever the admin sees that someone
 * processed a bill or recorded/approved an expense, show the PERSON's name and
 * their role (e.g. "Amina Bello, Front Desk"), never just a job title.
 *
 * The team is the company's staff list (Staff Management, shared with the
 * desktop through src/company). Front desk staff work in shifts, so a visit
 * processed at the front desk is credited to whoever was on duty that day,
 * using the same daily rota the Inbox uses for "on duty now".
 *
 * The demo activity (dailyLines) carries roles but no names, because no staff
 * records were in the legacy export. Until real staff accounts exist, names
 * here come from that rota and the branch manager: SAMPLE attribution, clearly
 * replaced by the real person once bills and expenses are recorded in STANLEY.
 */
import { useMemo } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import type { StaffRecord } from '@company/data/userRecords';
import { managerOf } from '@company/data/userRecords';
import type { ExpenseLine, PatientVisit } from '@company/data/demo/dailyLines';
import { profileOf, useSettings } from '@company/services/settingsStore';

export interface Who {
  name: string;
  role: string;
  photo?: string;
}

const PHOTOS = import.meta.glob('../assets/team/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
const slug = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '-');
/** The person's own upload (data URL) first, then the bundled sample photo for their name. */
const basePhoto = (s: Pick<StaffRecord, 'name' | 'photo'>) => (s.photo?.startsWith('data:') ? s.photo : PHOTOS[`../assets/team/${slug(s.name)}.jpg`]);
/** Desktop rule (settingsStore.resolvePhoto): the photo they or the admin uploaded, else their default photo; an empty upload means initials. */
export const photoOf = (s: Pick<StaffRecord, 'name' | 'photo'> & { id?: string }) => {
  const p = s.id ? profileOf(s.id).photo : undefined;
  return p === undefined ? basePhoto(s) : p || undefined;
};
const who = (s: StaffRecord): Who => ({ name: s.name, role: s.role, photo: photoOf(s) });
export const whoText = (w: Who | null | undefined, fallbackRole: string) => (w ? `${w.name}, ${w.role}` : `${fallbackRole} (name not on record)`);

const ROTA_START = Date.UTC(2026, 10, 23);
const dayNo = (at: Date) => Math.floor((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - ROTA_START) / 86_400_000);
const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

export function useTeam() {
  const { staff, user } = useCompany();
  const { profiles } = useSettings();
  return useMemo(() => {
    const frontDesk = (branchId: string) => staff.filter((s) => s.branchId === branchId && s.role === 'Front Desk' && s.status === 'Active');
    /** Who is on front desk duty at the branch on that day (one person per day, Staff Management order). */
    const onDuty = (branchId: string, at = new Date()): Who | null => {
      const rota = frontDesk(branchId);
      if (!rota.length) return null;
      const d = dayNo(at);
      return who(rota[((d % rota.length) + rota.length) % rota.length]!);
    };
    const manager = (branchId: string): Who | null => {
      const m = managerOf(staff, branchId);
      return m ? who(m) : null;
    };
    const admin: Who = { name: user.name, role: 'Company Admin' };
    /** The person who processed a visit at the branch. */
    const processedBy = (v: PatientVisit): Who | null => {
      if (v.processedBy.name) {
        const s = staff.find((x) => x.name === v.processedBy.name);
        return s ? who(s) : { name: v.processedBy.name, role: v.processedBy.role === 'Receptionist' ? 'Front Desk' : v.processedBy.role };
      }
      return v.processedBy.role === 'Branch Manager' ? manager(v.branchId) : onDuty(v.branchId, v.at);
    };
    /**
     * Who recorded and who approved an expense. Expenses are usually approved by
     * the Branch Manager; payroll and reagent purchases by the Company Admin.
     */
    const expensePeople = (e: ExpenseLine) => {
      const big = e.category === 'Salaries' || /reagent/i.test(e.category);
      const recordedBy = big ? manager(e.branchId) : (onDuty(e.branchId, e.at) ?? manager(e.branchId));
      const approvedBy = big ? admin : (manager(e.branchId) ?? admin);
      const approvedAt = new Date(e.at.getTime() + (5 + (hash(e.id) % 55)) * 60_000);
      return { recordedBy, approvedBy, approvedAt };
    };
    return { staff, onDuty, manager, admin, processedBy, expensePeople, frontDesk };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, user.name, profiles]);
}
