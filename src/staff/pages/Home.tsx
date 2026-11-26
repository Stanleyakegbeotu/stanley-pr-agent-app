/**
 * Branch dashboard (mobile staff workspace, owner 2026-11-25): the desktop
 * BranchHome for the Branch Manager and the Front Desk, in the mobile card
 * language. Same sequence and the same figures:
 *   welcome with the day's figures · quick actions (only the pages this role
 *   can open, from Roles & Permissions) · money received by Cash, POS and
 *   Transfer · patient payment status (paid, part paid, not paid, every
 *   balance owed) · manager only: branch figures, tests, PR agents and
 *   hospitals · what needs attention · the latest visits.
 * Front Desk gets the day-to-day dashboard without the manager's monitoring
 * sections (desktop rule), so no commission figures.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, FilePlus2 } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import type { PaymentMethod } from '@company/data/types';
import { CATALOGUE_CATEGORIES, CATALOGUE_INVENTORY } from '@company/data/catalogueRules';
import { financeTotals } from '@company/services/finance';
import { rateSummary } from '@company/services/commission';
import { openBalances, patientVisits, type PatientVisit } from '@company/data/demo/dailyLines';
import { agentRanking, hospitalRanking, paymentMix, priorRange, resolveRange, serviceRanking, summarize } from '@company/services/analytics';
import { PAGE_PERMISSION, can, usePermissions } from '@company/services/permissions';
import { useBilling } from '@company/services/billing';
import { formatCount, formatMoney } from '@company/shared/format';
import type { StickerKey } from '@/assets';
import { Sticker } from '@/ui/kit';
import { ScopeBar, Sheet } from '@/admin/ui';
import { DetailSheet, FocusSheet, Rows, useRowCtx, visitRow, type DetailKind, type Focus } from '@/admin/details';
import { ActivityTiles, AdminTopBar, PageGlow, PaymentsCard, SectionTitle } from '@/admin/kit';
import { Hospitals, TopAgents, TopServices } from '@/admin/sections';
import { periodWord } from '@/admin/insights';
import { photoOf, useTeam } from '@/admin/people';
import { AgentAvatar } from '@/admin/agentPhotos';
import { meta } from '@/admin/pages/Inventory';
import { useStaffChrome } from '../chrome';
import { IncomingEntry } from '../incoming';
import { ReceivingCard } from '../availabilityControls';
import { LiveAnnouncements } from '@/admin/announcementsPage';

export const canOpenPage = (role: string, page: string) => {
  const perm = PAGE_PERMISSION[page.split('?')[0] || 'dashboard'];
  return perm === null || perm === undefined ? true : can(role, perm);
};
const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const ACTIONS: { page: string; title: string; sticker: StickerKey; tint: string }[] = [
  { page: 'drafts', title: 'Saved drafts', sticker: 'clipboard', tint: 'bg-tint-orange border-[#ffe2c6]' },
  { page: 'records', title: 'Patient records', sticker: 'books', tint: 'bg-tint-blue border-[#d6e7ff]' },
  { page: 'expenses', title: 'Expenses', sticker: 'coin', tint: 'bg-tint-green border-[#cdeedb]' },
  { page: 'analysis', title: 'Reports and analysis', sticker: 'chart', tint: 'bg-tint-purple border-[#e2d8ff]' },
  { page: 'pr', title: 'PR management', sticker: 'stethoscope', tint: 'bg-[#eef1ff] border-[#dfe3ff]' },
  { page: 'staff', title: 'Staff', sticker: 'womanHealthWorker', tint: 'bg-tint-blue border-[#d6e7ff]' },
  { page: 'inventory', title: 'Price list', sticker: 'testTube', tint: 'bg-tint-green border-[#cdeedb]' },
];

type Status = 'paid' | 'part' | 'unpaid';
const STATUS: Record<Status, { label: string; tint: string; ink: string; sticker: StickerKey; note: string }> = {
  paid: { label: 'Paid in full', tint: 'from-[#e6f8ee] to-[#cfeedd]', ink: 'text-good-ink', sticker: 'check', note: 'Paid the whole bill at the visit' },
  part: { label: 'Part payment', tint: 'from-[#fff6ec] to-[#ffe7cc]', ink: 'text-warn-ink', sticker: 'coin', note: 'Paid some of the bill at the visit' },
  unpaid: { label: 'Not paid', tint: 'from-[#fff1f1] to-[#ffdede]', ink: 'text-[#b42318]', sticker: 'bell', note: 'Paid nothing at the visit' },
};

export function StaffHome() {
  usePermissions();
  const { branchId, go } = useStaffChrome();
  const { user, period, inventory } = useCompany();
  const team = useTeam();
  const billing = useBilling();
  const branch = getBranch(branchId)!;
  const c = branch.currency;
  const m = (n: number, compact = true) => formatMoney(n, c, compact);
  const ids = useMemo(() => [branchId], [branchId]);
  const range = resolveRange(period);
  const when = periodWord(period);
  const staffView = user.kind === 'staff';
  const canOpen = (p: string) => canOpenPage(user.role, p);
  const [detail, setDetail] = useState<{ kind: DetailKind; method?: PaymentMethod } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const ctx = useRowCtx(setFocus);
  const data = useMemo(() => {
    const s = summarize(ids, range);
    const pr = priorRange(range);
    const visits = patientVisits(ids, range).sort((a, b) => b.at.getTime() - a.at.getTime());
    const open = openBalances(branchId, range.to);
    return {
      s,
      prior: pr ? summarize(ids, pr) : null,
      mix: paymentMix(ids, range, c),
      visits,
      open,
      byStatus: { paid: visits.filter((v) => v.payment === 'Paid'), part: visits.filter((v) => v.payment === 'Part-paid'), unpaid: visits.filter((v) => v.payment === 'Unpaid') } as Record<Status, PatientVisit[]>,
      services: serviceRanking(ids, range).filter((x) => x.count > 0),
      agents: agentRanking(ids, range),
      hospitals: hospitalRanking(ids, range),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range.from.getTime(), range.to.getTime(), c]);
  const { s } = data;
  const onSeat = team.onDuty(branchId);
  const meOnSeat = onSeat?.name === user.name;
  const me = team.staff.find((x) => x.name === user.name);
  const photo = me ? photoOf(me) : undefined;
  const drafts = billing.drafts.filter((d) => d.branchId === branchId).length;
  const noPrice = CATALOGUE_INVENTORY.filter((i) => {
    const e = inventory.edits[i.id];
    return (e && 'price' in e && e.price !== undefined ? e.price : i.price) === null;
  }).length;
  const queue = [
    { title: 'Bills with a balance', text: `${m(data.open.reduce((x, o) => x + o.remaining, 0))} still owed by patients`, count: data.open.length, onClick: () => setDetail({ kind: 'outstanding' }), page: 'records' },
    { title: 'Overdue balances', text: 'Unpaid for more than 14 days: follow up', count: data.open.filter((o) => o.ageDays > 14).length, onClick: () => setDetail({ kind: 'outstanding' }), page: 'records' },
    { title: 'Unpaid visits', text: `Nothing paid at the visit ${when}`, count: data.byStatus.unpaid.length, onClick: () => setStatus('unpaid'), page: 'billing' },
    { title: 'Saved billing drafts', text: 'Continue unfinished billing work', count: drafts, onClick: () => go('drafts'), page: 'drafts' },
    ...(!staffView ? [{ title: 'Services without a price', text: 'Cannot be billed until a price is set', count: noPrice, onClick: () => go('inventory'), page: 'inventory' }] : []),
  ].filter((q) => canOpen(q.page));

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        {/* Welcome */}
        <div className="relative mb-3 overflow-hidden rounded-[28px] bg-linear-to-br from-[#123e9c] via-[#1f6fe8] to-[#5ea6f7] p-5 text-white shadow-[0_18px_40px_rgba(31,99,214,0.3)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="rounded-full ring-[3px] ring-white/70">{photo ? <img src={photo} alt="" className="h-14 w-14 rounded-full object-cover" /> : <Sticker name={staffView ? 'womanHealthWorker' : 'manHealthWorker'} size={56} />}</span>
            <span className="min-w-0">
              <span className="block text-[13px] text-white/85">
                {user.role} · {branch.name} branch
              </span>
              <span className="block truncate text-[21px] font-bold leading-tight">
                {greet()}, {user.firstName}
              </span>
            </span>
          </div>
          {staffView && (
            <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-semibold ring-1 ring-white/25">
              <span className={`h-2 w-2 rounded-full ${meOnSeat ? 'bg-[#34d07f]' : 'bg-white/60'}`} />
              {meOnSeat ? 'You are on seat today' : onSeat ? `${onSeat.name} is on seat today` : 'No one on the rota today'}
            </p>
          )}
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { l: `Patients ${when}`, v: formatCount(s.patients) },
              { l: 'Money in', v: m(s.payments[c] ?? 0) },
              { l: 'Still owed', v: m(s.outstanding[c] ?? 0) },
            ].map((x) => (
              <span key={x.l} className="min-w-0 rounded-2xl bg-white/15 px-2.5 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <span className="block truncate text-[11px] text-white/80">{x.l}</span>
                <b className="block truncate text-[15.5px]">{x.v}</b>
              </span>
            ))}
          </div>
        </div>
        <ScopeBar periodOnly />

        {/* Incoming referrals from PR agents (owner, 2026-11-25): always first, with the waiting count. */}
        {/* Is the branch receiving patients now (PR agents see it before sending anyone). */}
        <LiveAnnouncements onManage={() => go('announcements')} />
        <ReceivingCard branchId={branchId} />
        {canOpen('billing') && <IncomingEntry branchId={branchId} />}

        {/* Quick actions */}
        {canOpen('billing') && (
          <button type="button" onClick={() => go('billing')} className="press relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] bg-white p-4 text-left shadow-[0_8px_24px_rgba(30,74,160,0.08)] ring-1 ring-line/70">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-[0_6px_16px_rgba(31,111,232,0.3)]">
              <FilePlus2 size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[16px] text-ink">New patient bill</b>
              <span className="block text-[12.5px] text-muted">Register a patient, add tests, take payment</span>
            </span>
            <ChevronRight size={20} className="text-brand-600" />
          </button>
        )}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {ACTIONS.filter((a) => canOpen(a.page)).map((a) => (
            <button key={a.page} type="button" onClick={() => go(a.page)} className={`press flex min-h-[94px] flex-col items-center justify-center gap-1.5 rounded-[18px] border px-1 ${a.tint}`}>
              <Sticker name={a.sticker} size={34} />
              <span className="text-center text-[12.5px] font-medium leading-tight text-ink">{a.title}</span>
            </button>
          ))}
        </div>

        <PaymentsCard title={`Money received ${when}`} paid={s.payments[c] ?? 0} billed={s.revenue[c] ?? 0} c={c} mix={data.mix} open={(k, method) => setDetail({ kind: k, method })} />

        <SectionTitle title="Patient payment status" />
        <div className="grid grid-cols-2 gap-2.5">
          {(Object.keys(STATUS) as Status[]).map((k) => {
            const list = data.byStatus[k];
            const S = STATUS[k];
            return (
              <button key={k} type="button" onClick={() => setStatus(k)} className={`press relative min-h-[112px] overflow-hidden rounded-[20px] bg-linear-to-br p-3 text-left ${S.tint}`}>
                <Sticker name={S.sticker} size={30} className="absolute right-2 top-2" />
                <span className="block text-[12.5px] font-semibold text-ink-2">{S.label}</span>
                <b className={`mt-1 block text-[24px] leading-none ${S.ink}`}>{formatCount(list.length)}</b>
                <span className="mt-1 block text-[11.5px] text-muted">
                  {m(list.reduce((x, v) => x + v.billed, 0))} billed · {when}
                </span>
              </button>
            );
          })}
          <button type="button" onClick={() => setDetail({ kind: 'outstanding' })} className="press relative min-h-[112px] overflow-hidden rounded-[20px] bg-linear-to-br from-[#eef1ff] to-[#dfe3ff] p-3 text-left">
            <Sticker name="calendar" size={30} className="absolute right-2 top-2" />
            <span className="block text-[12.5px] font-semibold text-ink-2">Every balance owed</span>
            <b className="mt-1 block text-[24px] leading-none text-[#3730a3]">{formatCount(data.open.length)}</b>
            <span className="mt-1 block text-[11.5px] text-muted">{m(data.open.reduce((x, o) => x + o.remaining, 0))} to recover, any date</span>
          </button>
        </div>

        {/* Desktop BranchHome sections, for the manager and the front desk alike (owner, 2026-11-25). */}
        <QuickStats branchId={branchId} open={(k) => setDetail({ kind: k })} />
        <CategorySummary branchId={branchId} onService={setFocus} />
        <ReferralSummary branchId={branchId} onPick={setFocus} open={(k) => setDetail({ kind: k })} />

        {queue.length > 0 && (
          <>
            <SectionTitle title="What needs attention" />
            <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70">
              {queue.map((q) => (
                <button key={q.title} type="button" onClick={q.onClick} className="press flex w-full items-center gap-3 px-3.5 py-3 text-left">
                  <span className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-2 text-[14px] font-bold ${q.count ? 'bg-[#fff1e0] text-[#b45309]' : 'bg-tint-green text-good-ink'}`}>{formatCount(q.count)}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14px] text-ink">{q.title}</b>
                    <span className="block truncate text-[12px] text-muted">{q.text}</span>
                  </span>
                  <ChevronRight size={16} className="text-faint" />
                </button>
              ))}
            </div>
          </>
        )}

        <SectionTitle title="Latest visits" action={canOpen('records') ? 'All records' : undefined} onAction={() => go('records')} />
        <Rows rows={data.visits.slice(0, 5).map((v) => visitRow(v, ctx))} oneDay={range.days <= 1} multi={false} empty="No visits recorded in this period." />
      </div>

      {detail && <DetailSheet kind={detail.kind} method={detail.method} branchIds={ids} period={period} scopeText={`${branch.name} branch`} onClose={() => setDetail(null)} />}
      {status && (
        <Sheet title={STATUS[status].label} subtitle={`${STATUS[status].note} · ${when}`} onClose={() => setStatus(null)} tall>
          <div className="px-1 pb-2">
            <Rows rows={data.byStatus[status].map((v) => visitRow(v, ctx))} oneDay={range.days <= 1} multi={false} empty="No patients here in this period." />
          </div>
        </Sheet>
      )}
      {focus && <FocusSheet focus={focus} branchIds={ids} period={period} onClose={() => setFocus(null)} />}
    </div>
  );
}

/* ─────────────── Quick Stats (desktop QuickStats) ─────────────── */

function QuickStats({ branchId, open }: { branchId: string; open: (k: DetailKind) => void }) {
  const { period } = useCompany();
  const billing = useBilling();
  const branch = getBranch(branchId)!;
  const m = (n: number) => formatMoney(n, branch.currency, true);
  const range = resolveRange(period);
  const when = periodWord(period);
  const d = useMemo(() => {
    const t = financeTotals(branchId, range);
    const mo = financeTotals(branchId, resolveRange({ key: 'month' }));
    const visits = patientVisits([branchId], range);
    const from = range.from.getTime();
    const to = range.to.getTime() + 86_400_000;
    const discounts = billing.orders.filter((o) => o.branchId === branchId && new Date(o.createdAt).getTime() >= from && new Date(o.createdAt).getTime() < to).reduce((s, o) => s + o.discount, 0);
    return { t, mo, visits: visits.length, fully: visits.filter((v) => v.payment === 'Paid').length, discounts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range.from.getTime(), range.to.getTime(), billing.orders]);
  const monthName = resolveRange({ key: 'month' }).from.toLocaleDateString('en-GB', { month: 'long' });
  const tiles: { label: string; value: string; sub: string; tint: string; ink: string; sticker: StickerKey; onClick?: () => void }[] = [
    { label: 'Revenue generated', value: m(d.t.billed), sub: 'Tests billed, not cash collected', tint: 'from-[#eef5ff] to-[#dcebff]', ink: 'text-brand-800', sticker: 'chart', onClick: () => open('revenue') },
    { label: 'Patients served', value: formatCount(d.t.patients), sub: `With a visit ${when}`, tint: 'from-[#f5f0ff] to-[#e9e0ff]', ink: 'text-violet', sticker: 'stethoscope', onClick: () => open('patients') },
    { label: 'Discounts granted', value: m(d.discounts), sub: 'On bills made in STANLEY', tint: 'from-[#fff4f8] to-[#ffe0ea]', ink: 'text-[#be185d]', sticker: 'gift' },
    { label: 'Fully paid visits', value: formatCount(d.fully), sub: `Of ${formatCount(d.visits)} visits, no balance left`, tint: 'from-[#e6f8ee] to-[#cfeedd]', ink: 'text-good-ink', sticker: 'check', onClick: () => open('payments') },
    { label: 'Patients owing', value: formatCount(d.t.openBills), sub: `${m(d.t.outstanding)} outstanding`, tint: 'from-[#fff1f1] to-[#ffdede]', ink: 'text-[#b42318]', sticker: 'bell', onClick: () => open('outstanding') },
    { label: 'Expenses incurred', value: m(d.t.expenses), sub: 'Approved expenses', tint: 'from-[#fff6ec] to-[#ffe7cc]', ink: 'text-warn-ink', sticker: 'clipboard', onClick: () => open('expenses') },
    { label: 'Money in', value: m(d.t.income), sub: 'Paid at visits and recovered', tint: 'from-[#e6f8ee] to-[#cfeedd]', ink: 'text-good-ink', sticker: 'moneyBag', onClick: () => open('payments') },
    { label: 'Monthly expenses', value: m(d.mo.expenses), sub: `${monthName} to date`, tint: 'from-[#fff6ec] to-[#ffe7cc]', ink: 'text-warn-ink', sticker: 'calendar' },
    { label: 'Monthly money in', value: m(d.mo.income), sub: `${monthName} to date`, tint: 'from-[#eafafa] to-[#d3f1f1]', ink: 'text-[#0c6b71]', sticker: 'coin' },
  ];
  return (
    <>
      <SectionTitle title="Quick stats" />
      <p className="-mt-2 mb-2.5 text-[12.5px] text-muted">The branch position {when}. Monthly figures run to today.</p>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((x) => (
          <button key={x.label} type="button" disabled={!x.onClick} onClick={x.onClick} className={`press relative min-h-[118px] min-w-0 overflow-hidden rounded-[18px] bg-linear-to-br p-2.5 text-left disabled:cursor-default ${x.tint}`}>
            <Sticker name={x.sticker} size={26} />
            <span className="mt-1.5 block text-[11.5px] font-semibold leading-tight text-ink-2">{x.label}</span>
            <b className={`mt-0.5 block truncate text-[17px] leading-tight ${x.ink}`}>{x.value}</b>
            <span className="mt-0.5 line-clamp-2 block text-[10.5px] leading-snug text-muted">{x.sub}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-muted">Money in is cash actually received. Net profit is shown to the Company Admin only.</p>
    </>
  );
}

/* ─────────────── Daily Test Category Summary (desktop CategorySummary) ─────────────── */

const CATEGORY_OF = new Map(CATALOGUE_INVENTORY.map((i) => [i.id, i.catalogueCategory]));

function CategorySummary({ branchId, onService }: { branchId: string; onService: (f: Focus) => void }) {
  const { period, inventory } = useCompany();
  const branch = getBranch(branchId)!;
  const m = (n: number) => formatMoney(n, branch.currency, true);
  const range = resolveRange(period);
  const when = periodWord(period);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const acc = new Map<string, { tests: number; patients: Set<string>; revenue: number; paid: number }>();
    for (const c of CATALOGUE_CATEGORIES) acc.set(c.key, { tests: 0, patients: new Set(), revenue: 0, paid: 0 });
    for (const v of patientVisits([branchId], range)) {
      const sum = v.services.reduce((s, x) => s + x.price, 0) || 1;
      for (const s of v.services) {
        const key = CATEGORY_OF.get(s.id) ?? 'Other';
        const r = acc.get(key) ?? { tests: 0, patients: new Set<string>(), revenue: 0, paid: 0 };
        r.tests += 1;
        r.patients.add(v.patientRef);
        r.revenue += s.price;
        r.paid += (v.paid * s.price) / sum;
        acc.set(key, r);
      }
    }
    return [...acc.entries()].map(([key, r]) => ({ key, label: inventory.categoryNames[key] || key, tests: r.tests, patients: r.patients.size, revenue: r.revenue, paid: Math.round(r.paid) })).sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range.from.getTime(), range.to.getTime(), inventory.categoryNames]);
  const used = rows.filter((r) => r.tests);
  const total = rows.reduce((s, r) => ({ tests: s.tests + r.tests, revenue: s.revenue + r.revenue, paid: s.paid + r.paid }), { tests: 0, revenue: 0, paid: 0 });
  const top = Math.max(1, ...rows.map((r) => r.revenue));
  const cur = rows.find((r) => r.key === open);
  const services = useMemo(() => (open ? serviceRanking([branchId], range).filter((x) => CATEGORY_OF.get(x.id) === open && x.count > 0) : []), [open, branchId, range]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <SectionTitle title="Daily test category summary" />
      <div className="relative mb-2.5 overflow-hidden rounded-[22px] bg-linear-to-br from-[#0c7f86] via-[#139aa0] to-[#4cc5bd] p-4 text-white">
        <Sticker name="microscope" size={64} className="absolute right-3 top-2" />
        <p className="text-[12.5px] text-white/85">Tests done {when}</p>
        <p className="text-[28px] font-bold leading-none">{formatCount(total.tests)}</p>
        <p className="mt-1.5 max-w-[75%] text-[12.5px] text-white/90">
          {used.length} of {rows.length} categories used · {m(total.revenue)} revenue · {m(total.paid)} paid
        </p>
      </div>
      <ul className="space-y-2">
        {(used.length ? used : rows.slice(0, 4)).map((r, i) => {
          const mm = meta(r.key);
          return (
            <li key={r.key}>
              <button type="button" disabled={!r.tests} onClick={() => setOpen(r.key)} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70 disabled:opacity-60">
                <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br ${mm.tint}`}>
                  <Sticker name={mm.sticker} size={30} />
                  <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-ink-2 shadow ring-1 ring-line">{i + 1}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate text-[14.5px] text-ink">{r.label}</b>
                    <b className="shrink-0 text-[14px] text-ink">{m(r.revenue)}</b>
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {formatCount(r.tests)} test{r.tests === 1 ? '' : 's'} · {formatCount(r.patients)} patient{r.patients === 1 ? '' : 's'} · {m(r.paid)} paid
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#eef2f8]">
                    <span className="block h-full rounded-full bg-[#139aa0]" style={{ width: `${Math.max(2, (r.revenue / top) * 100)}%` }} />
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </button>
            </li>
          );
        })}
      </ul>
      {cur && (
        <Sheet title={cur.label} subtitle={`${formatCount(cur.tests)} tests · ${formatCount(cur.patients)} patients · ${when}`} onClose={() => setOpen(null)} tall>
          <div className="px-1 pb-2">
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { l: 'Revenue', v: m(cur.revenue) },
                { l: 'Paid', v: m(cur.paid) },
                { l: 'Tests', v: formatCount(cur.tests) },
              ].map((x) => (
                <span key={x.l} className="rounded-2xl bg-page px-3 py-2">
                  <span className="block text-[11px] text-muted">{x.l}</span>
                  <b className="block text-[15px] text-ink">{x.v}</b>
                </span>
              ))}
            </div>
            <p className="mb-2 text-[12.5px] text-muted">Tap a test for the patients who did it.</p>
            <ul className="space-y-1.5">
              {services.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => onService({ kind: 'service', id: x.id, name: x.name })} className="press flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70">
                    <span className="min-w-0">
                      <b className="block truncate text-[14px] text-ink">{x.name}</b>
                      <span className="text-[12px] text-muted">×{formatCount(x.count)} · #{x.id}</span>
                    </span>
                    <b className="shrink-0 text-[14px] text-ink">{m(x.revenue[branch.currency] ?? 0)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
      )}
    </>
  );
}

/* ─────────────── PR Agent & Hospital Summary (desktop ReferralSummary) ─────────────── */

function ReferralSummary({ branchId, onPick, open }: { branchId: string; onPick: (f: Focus) => void; open: (k: DetailKind) => void }) {
  const { period, user } = useCompany();
  const branch = getBranch(branchId)!;
  const c = branch.currency;
  const m = (n: number) => formatMoney(n, c, true);
  const range = resolveRange(period);
  const when = periodWord(period);
  const { go } = useStaffChrome();
  const seeCommission = can(user.role, 'referral.commission');
  const [tab, setTab] = useState<'agents' | 'hospitals'>('agents');
  const agents = useMemo(() => agentRanking([branchId], range), [branchId, range.from.getTime(), range.to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const hospitals = useMemo(() => hospitalRanking([branchId], range), [branchId, range.from.getTime(), range.to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const referred = agents.reduce((s, a) => s + a.referrals, 0);
  const revenue = agents.reduce((s, a) => s + (a.revenue[c] ?? 0), 0);
  const commission = agents.reduce((s, a) => s + (a.commission[c] ?? 0), 0);
  const figs = [
    { l: 'Active PR agents', v: formatCount(agents.length), s: `Referred patients ${when}`, onClick: () => open('referrals') },
    { l: 'Referred patients', v: formatCount(referred), s: 'Sent by a PR agent', onClick: () => open('referrals') },
    { l: 'Referral revenue', v: m(revenue), s: 'Full bills of referred patients', onClick: () => open('referrals') },
    ...(seeCommission ? [{ l: 'PR commission', v: m(commission), s: rateSummary(), onClick: () => open('commission') }] : []),
  ];
  return (
    <>
      <SectionTitle title="PR agent and hospital summary" action={canOpenPage(user.role, 'pr') ? 'PR Management' : undefined} onAction={() => go('pr')} />
      <div className="relative overflow-hidden rounded-[22px] bg-linear-to-br from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7] p-4 text-white">
        <Sticker name="stethoscope" size={60} className="absolute right-3 top-2" />
        <div className="grid max-w-[85%] grid-cols-2 gap-2">
          {figs.map((x) => (
            <button key={x.l} type="button" onClick={x.onClick} className="press min-w-0 rounded-2xl bg-white/15 px-3 py-2 text-left ring-1 ring-white/20">
              <span className="block truncate text-[11px] text-white/85">{x.l}</span>
              <b className="block truncate text-[17px]">{x.v}</b>
              <span className="block truncate text-[10.5px] text-white/75">{x.s}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-line">
        {(
          [
            ['agents', `PR agents · ${agents.length}`],
            ['hospitals', `Hospitals · ${hospitals.length}`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`press min-h-9 rounded-full text-[13px] font-semibold ${tab === k ? 'bg-violet text-white' : 'text-ink-2'}`}>
            {l}
          </button>
        ))}
      </div>
      <ul className="mt-2 space-y-1.5">
        {tab === 'agents'
          ? agents.slice(0, 6).map((a, i) => (
              <li key={a.id}>
                <button type="button" onClick={() => onPick({ kind: 'agent', id: a.id })} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-2.5 text-left ring-1 ring-line/70">
                  <span className="relative">
                    <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={42} />
                    <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-ink-2 shadow ring-1 ring-line">{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14px] text-ink">{a.name}</b>
                    <span className="block truncate text-[12px] text-muted">
                      {a.hospitalKey || 'No hospital'} · {m(a.revenue[c] ?? 0)} billed{seeCommission ? ` · ${m(a.commission[c] ?? 0)} commission` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="block text-[16px] leading-none text-violet">{formatCount(a.referrals)}</b>
                    <span className="text-[10.5px] text-muted">patients</span>
                  </span>
                </button>
              </li>
            ))
          : hospitals.slice(0, 6).map((h, i) => (
              <li key={h.key}>
                <button type="button" onClick={() => onPick({ kind: 'hospital', key: h.key, name: h.name })} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-2.5 text-left ring-1 ring-line/70">
                  <span className="relative grid h-[42px] w-[42px] place-items-center rounded-full bg-tint-blue">
                    <Sticker name="hospital" size={26} />
                    <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-ink-2 shadow ring-1 ring-line">{i + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14px] text-ink">{h.name}</b>
                    <span className="block truncate text-[12px] text-muted">
                      {h.activeAgents} of {h.agentCount} agents referred · {m(h.revenue[c] ?? 0)} billed
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="block text-[16px] leading-none text-violet">{formatCount(h.referrals)}</b>
                    <span className="text-[10.5px] text-muted">referrals</span>
                  </span>
                </button>
              </li>
            ))}
        {(tab === 'agents' ? agents : hospitals).length === 0 && <li className="rounded-[18px] bg-white p-4 text-center text-[13px] text-muted ring-1 ring-line/70">No referrals {when}.</li>}
      </ul>
      {(tab === 'agents' ? agents : hospitals).length > 6 && (
        <button type="button" onClick={() => open(tab === 'agents' ? 'referrals' : 'hospitals')} className="press mx-auto mt-2 block rounded-full bg-white px-5 py-2 text-[13.5px] font-semibold text-brand-600 ring-1 ring-line">
          See all {tab === 'agents' ? `${agents.length} agents` : `${hospitals.length} hospitals`}
        </button>
      )}
    </>
  );
}
