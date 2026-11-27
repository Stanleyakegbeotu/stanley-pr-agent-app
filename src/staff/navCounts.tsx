/**
 * Counts on menu items, like the Inbox's unread count (owner, 2026-11-26):
 * Billing shows referrals waiting to be billed, Drafts the saved drafts, and
 * Reports the reports this person hasn't opened yet. Same rules as the
 * desktop sidebar (src/shell/navCounts.ts there).
 */
import { useMemo } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import { useBilling } from '@company/services/billing';
import { isNewFor, readerId, useIssueReports, visibleReports } from '@company/services/issueReports';
import { useIncomingMany } from './incoming';
import { LEGACY_BRANCH_ID } from '@company/data/legacy';
import { can } from '@company/services/permissions';
import { staffKey, useAccountAccess } from '@company/services/accountAccess';
import { hospitalStatuses, hospitalsOf, marketersOf, needsAction, setupStatus, useMarketing } from '@company/services/marketing';

export type NavCounts = Partial<Record<string, { n: number; label: string }>>;

export function useNavCounts(branchId: string | null): NavCounts {
  const { user, context, staff, agents } = useCompany();
  const mk = useMarketing();
  const access = useAccountAccess();
  const mkBranch = branchId ?? (context === 'all' ? LEGACY_BRANCH_ID : context);
  // Marketing: setup not finished, transfers to approve, dormant hospitals needing action (owner, 2026-11-27).
  const marketing = useMemo(() => {
    if (!can(user.role, 'referral.manage')) return 0;
    const ms = marketersOf(staff, mkBranch, (id) => !!access[staffKey(id)]?.off);
    if (!ms.length) return 0;
    const hs = hospitalsOf(mk, mkBranch, mkBranch === LEGACY_BRANCH_ID ? agents : [], new Set(ms.map((x) => x.id)));
    return setupStatus(mk, mkBranch, hs.filter((h) => !h.owner).length).filter((x) => !x.done).length + mk.transfers.filter((t) => t.branchId === mkBranch && t.stage === 'manager').length + [...hospitalStatuses(mk, mkBranch, hs, agents).values()].filter(needsAction).length;
  }, [user.role, staff, mkBranch, access, mk, agents]);
  const billing = useBilling();
  const reports = useIssueReports();
  const incoming = useIncomingMany(useMemo(() => (branchId ? [branchId] : []), [branchId]));
  return useMemo(() => {
    const me = readerId(user);
    const kind: 'admin' | 'manager' | 'staff' = !branchId ? 'admin' : user.role === 'Branch Manager' ? 'manager' : 'staff';
    const scope = branchId ? [branchId] : context === 'all' ? null : [context];
    const fresh = visibleReports(reports, { kind, branchId }, scope).filter((r) => isNewFor(r, me)).length;
    const out: NavCounts = { reports: { n: fresh, label: `${fresh} new report${fresh === 1 ? '' : 's'}` }, marketing: { n: marketing, label: `${marketing} marketing item${marketing === 1 ? '' : 's'} need you` } };
    if (branchId) {
      const waiting = incoming.filter((r) => r.status === 'waiting' && !r.closed).length;
      const drafts = billing.drafts.filter((d) => d.branchId === branchId).length;
      out.billing = { n: waiting, label: `${waiting} referral${waiting === 1 ? '' : 's'} waiting to be billed` };
      out.drafts = { n: drafts, label: `${drafts} saved draft${drafts === 1 ? '' : 's'}` };
    }
    return out;
  }, [user, context, branchId, reports, incoming, billing.drafts, marketing]);
}

const TONE: Record<string, string> = { billing: 'bg-[#f2a93b] text-[#3a2200]', drafts: 'bg-page text-ink-2 ring-1 ring-line', reports: 'bg-[#ef4444] text-white' };

/** The count pill for a menu item or tab (nothing when zero). */
export function NavCount({ id, counts, dot }: { id: string; counts: NavCounts; dot?: boolean }) {
  const c = counts[id];
  if (!c || c.n <= 0) return null;
  const n = c.n > 99 ? '99+' : c.n;
  if (dot)
    return (
      <span aria-label={c.label} className={`absolute right-[calc(50%-22px)] top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-extrabold ring-2 ring-white ${TONE[id] ?? TONE.reports}`}>
        {n}
      </span>
    );
  return (
    <span aria-label={c.label} title={c.label} className={`grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-[11.5px] font-extrabold ${TONE[id] ?? TONE.reports}`}>
      {n}
    </span>
  );
}
