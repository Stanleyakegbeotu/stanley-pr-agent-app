/**
 * Branches (mobile, owner 2026-11-25): the admin design standard (clinician-
 * app cards, 3D stickers, slide-ups). Same content and rules as the desktop
 * BranchesPage and BranchWorkspace (src/company): one card per branch, Add
 * branch (unique 3-letter Patient ID code, starts "Pending setup"), and a
 * branch's own page:
 *   hero with the team on duty · the branch's announcement bar (top PR agent
 *   to thank, what changed, notices) · activity tiles · what changed ·
 *   payments · needs attention · PR agent management (every agent as a
 *   slide-up profile: contact, account, chat, announcements) · team ·
 *   hospitals · services · expenses · trend · details.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Info, MapPin, Megaphone, MessageCircle, Plus, ShieldAlert, Users } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, BRANCHES, NOT_ON_RECORD, getBranch } from '@company/data/company';
import type { PaymentMethod } from '@company/data/types';
import { statusHistory, useBranches } from '@company/services/org';
import { agentRanking, expenseMix, hospitalRanking, paymentMix, periodLabel, priorRange, resolveBranchIds, resolveRange, serviceRanking, summarize, trend } from '@company/services/analytics';
import { attentionItems, type AttentionItem, type Severity } from '@company/services/insights';
import { formatCount, formatMoney } from '@company/shared/format';
import { useAnnouncements } from '@/domain/announcements';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { ScopeBar, Sheet, TrendChart } from '../ui';
import { DetailSheet, FocusSheet, type DetailKind, type Focus } from '../details';
import { ActivityTiles, AdminTopBar, PageGlow, PaymentsCard, SectionTitle, SlideCarousel, THEMES, Tag, type Slide } from '../kit';
import { ExpensesCard, Hospitals, TopAgents, TopServices } from '../sections';
import { WhatChangedSheet, periodWord, useInsightSlides } from '../insights';
import { AgentsSheet, ComposeSheet, agentBranchId } from '../agents';
import { frontDeskId, managerId } from '../chat';
import { photoOf, useTeam, type Who } from '../people';
import { DutyRota } from '../duty';
import { AddBranchSheet } from '../addBranch';

export function BranchesPage({ sub }: { sub?: string }) {
  useBranches(); // re-render when a branch is added or changes status
  return sub ? <BranchView branchId={sub} /> : <BranchList />;
}

/* ─────────────── every branch ─────────────── */

function BranchList() {
  const { period } = useCompany();
  const [adding, setAdding] = useState(false);
  const [changed, setChanged] = useState(false);
  const ids = useMemo(() => resolveBranchIds('all'), []);
  const range = resolveRange(period);
  const all = useMemo(() => summarize(ids, range), [ids, range]);
  const c = all.currencies[0] ?? 'NGN';
  const when = periodWord(period);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <section className="mb-4 flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink">Branches</h1>
            <p className="mt-0.5 text-[14.5px] text-ink-2">
              {formatCount(ACTIVE_BRANCHES.length)} active · {formatCount(BRANCHES.length - ACTIVE_BRANCHES.length)} in setup
            </p>
          </div>
          <button type="button" onClick={() => setAdding(true)} aria-label="Add branch" className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand-600 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
            <Plus size={18} /> Add
          </button>
        </section>
        <ScopeBar periodOnly />

        {/* Company hero */}
        <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7] p-5 text-white shadow-[0_14px_34px_rgba(31,99,214,0.25)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative max-w-[66%]">
            <p className="text-[13px] font-medium text-white/90">All branches made {when}</p>
            <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.02em]">{formatMoney(all.revenue[c] ?? 0, c, true)}</p>
            <p className="mt-2 text-[12.5px] leading-snug text-white/90">
              {formatMoney(all.payments[c] ?? 0, c, true)} received · {formatMoney(all.expenses[c] ?? 0, c, true)} spent · {formatCount(all.patients)} patients
            </p>
            <button type="button" onClick={() => setChanged(true)} className="press mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13.5px] font-semibold text-brand-700 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
              See what changed <ChevronRight size={16} />
            </button>
          </div>
          <Sticker name="hospital" size={124} className="absolute -bottom-2 right-0" />
        </div>

        <SectionTitle title="Your branches" />
        <div className="space-y-3">
          {BRANCHES.map((b) => (
            <BranchCard key={b.id} branchId={b.id} />
          ))}
          <button type="button" onClick={() => setAdding(true)} className="press flex w-full items-center gap-3 rounded-[22px] border-[1.5px] border-dashed border-brand-300 bg-brand-50/50 p-4 text-left">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
              <Sticker name="rocket" size={32} />
            </span>
            <span>
              <span className="block text-[15px] font-bold text-ink">Add another branch</span>
              <span className="block text-[12.5px] text-muted">A new location with its own Patient ID prefix and currency.</span>
            </span>
          </button>
        </div>
      </div>
      {adding && <AddBranchSheet onClose={() => setAdding(false)} />}
      {changed && <WhatChangedSheet branchIds={ids} period={period} title="All branches" onClose={() => setChanged(false)} />}
    </div>
  );
}

function BranchCard({ branchId }: { branchId: string }) {
  const { period, navigate } = useCompany();
  const team = useTeam();
  const b = getBranch(branchId)!;
  const active = b.status === 'Active';
  const range = resolveRange(period);
  const s = active ? summarize([b.id], range) : null;
  const c = b.currency;
  const billed = s?.revenue[c] ?? 0;
  const paid = s?.payments[c] ?? 0;
  const collected = billed > 0 ? Math.min(100, (paid / billed) * 100) : 0;
  const alerts = active ? attentionItems([b.id], range, false).length : 0;
  const mgr = team.manager(b.id);
  const duty = team.onDuty(b.id);
  const hasAddress = b.address && b.address !== NOT_ON_RECORD;
  return (
    <button type="button" onClick={() => navigate(`/branches/${b.id}`)} className="press block w-full rounded-[22px] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
      <span className="flex items-start gap-3">
        <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[16px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff]">
          <Sticker name="hospital" size={44} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate text-[17px] font-bold text-ink">{b.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${active ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{b.status}</span>
          </span>
          <span className="flex items-center gap-1 text-[12.5px] text-muted">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{hasAddress ? `${b.address}, ${b.city}` : `${b.code} · ${b.city}, ${b.country}`}</span>
          </span>
          {s && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag tone="bg-brand-50 text-brand-700">{formatCount(s.patients)} patients</Tag>
              <Tag tone="bg-tint-purple text-violet">{formatCount(s.referrals)} referred</Tag>
              {alerts > 0 && <Tag tone="bg-[#fdecec] text-[#b42318]">{alerts} need attention</Tag>}
            </span>
          )}
        </span>
      </span>

      {s ? (
        <>
          <span className="mt-3 grid grid-cols-3 gap-2">
            <Mini label="Made" value={formatMoney(billed, c, true)} tone="bg-tint-blue text-brand-800" />
            <Mini label="Received" value={formatMoney(paid, c, true)} tone="bg-tint-green text-[#14633a]" />
            <Mini label="Spent" value={formatMoney(s.expenses[c] ?? 0, c, true)} tone="bg-tint-orange text-warn-ink" />
          </span>
          <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-page">
            <span className="block h-full rounded-full bg-good" style={{ width: `${Math.max(billed > 0 ? 2 : 0, collected)}%` }} />
          </span>
          <span className="mt-1 block text-[11.5px] text-muted">{billed > 0 ? `${Math.round(collected)}% of billed collected · ${formatMoney(s.outstanding[c] ?? 0, c, true)} still owed` : 'Nothing billed in this period'}</span>
        </>
      ) : (
        <span className="mt-3 block rounded-2xl bg-page p-3 text-[13px] text-muted">Setup in progress. Figures start once the branch is active.</span>
      )}

      <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex -space-x-2">
            {[mgr, duty].filter(Boolean).map((p) => (
              <Face key={p!.name} who={p!} size={30} ring />
            ))}
          </span>
          <span className="min-w-0 text-[12px] leading-tight text-muted">
            <span className="block truncate">Manager: {mgr?.name ?? (b.manager || 'Not assigned yet')}</span>
            {duty && <span className="block truncate">On duty: {duty.name}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center text-[13px] font-semibold text-brand-600">
          Open <ChevronRight size={16} />
        </span>
      </span>
    </button>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className={`min-w-0 rounded-xl px-2.5 py-2 ${tone}`}>
      <span className="block truncate text-[15px] font-bold">{value}</span>
      <span className="block text-[11px] opacity-80">{label}</span>
    </span>
  );
}

function Face({ who, size, ring }: { who: Who; size: number; ring?: boolean }) {
  return who.photo ? <img src={who.photo} alt="" className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-white' : ''}`} style={{ width: size, height: size }} /> : <InitialsAvatar name={who.name} size={size} />;
}

/* ─────────────── one branch ─────────────── */

/** Desktop wording uses dashes; the mobile app reads them as commas. */
const tidy = (t: string) => t.replace(/s[—–-]s/g, ', ');

const SEVERITY: Record<Severity, { label: string; tone: string; icon: React.ReactNode }> = {
  urgent: { label: 'Urgent', tone: 'bg-[#fdecec] text-[#b42318]', icon: <ShieldAlert size={18} /> },
  attention: { label: 'Needs attention', tone: 'bg-[#fff1e0] text-[#b45309]', icon: <AlertTriangle size={18} /> },
  info: { label: 'For information', tone: 'bg-brand-50 text-brand-700', icon: <Info size={18} /> },
};

function BranchView({ branchId }: { branchId: string }) {
  const { period, navigate, agents } = useCompany();
  const team = useTeam();
  const sent = useAnnouncements();
  const b = getBranch(branchId);
  const ids = useMemo(() => [branchId], [branchId]);
  const range = resolveRange(period);
  const c = b?.currency ?? 'NGN';
  const [detail, setDetail] = useState<{ kind: DetailKind; method?: PaymentMethod } | null>(null);
  const [pick, setPick] = useState<Focus | null>(null);
  const [sheet, setSheet] = useState<'agents' | 'announce' | 'changed' | null>(null);
  const [alert, setAlert] = useState<AttentionItem | null>(null);
  const insights = useInsightSlides(ids, period);
  const data = useMemo(() => {
    if (!b || b.status !== 'Active') return null;
    const pr = priorRange(range);
    return {
      s: summarize(ids, range),
      prior: pr ? summarize(ids, pr) : null,
      alerts: attentionItems(ids, range, false),
      pay: paymentMix(ids, range, c),
      services: serviceRanking(ids, range).filter((x) => x.count > 0),
      agents: agentRanking(ids, range),
      hospitals: hospitalRanking(ids, range),
      expenses: expenseMix(ids, range, c).filter((x) => x.value > 0),
      tr: trend(ids, range, c),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range.from.getTime(), range.to.getTime()]);

  if (!b)
    return (
      <div className="relative">
        <AdminTopBar back title="Branch" />
        <div className="mt-10 flex flex-col items-center text-center">
          <Sticker name="hospital" size={90} />
          <p className="mt-3 text-[17px] font-bold text-ink">Branch not found</p>
        </div>
      </div>
    );

  const mgr = team.manager(b.id);
  const duty = team.onDuty(b.id);
  const desk = team.frontDesk(b.id);
  const allStaff = team.staff.filter((x) => x.branchId === b.id && x.status !== 'Left');
  const branchAgents = b.id === agentBranchId() ? agents : [];
  const activeAgents = data?.agents.length ?? 0;
  const lastNotice = sent.find((a) => a.audience.kind === 'branch' && a.audience.branchId === b.id);
  const open = (kind: DetailKind, method?: PaymentMethod) => setDetail({ kind, method });
  const history = statusHistory(b.id);
  const when = periodWord(period);

  // The branch's own announcement bar: insights + announcing to its PR agents.
  const slides: Slide[] = [
    ...insights.slides,
    lastNotice
      ? { id: `sent-${lastNotice.id}`, theme: THEMES.teal, sticker: 'megaphone', label: 'Your announcement is live', title: lastNotice.title, text: `Showing to every ${b.name} PR agent since ${new Date(lastNotice.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`, actions: [{ label: 'New announcement', onClick: () => setSheet('announce') }] }
      : { id: 'announce', theme: THEMES.teal, sticker: 'megaphone', label: `${b.name} PR agents`, title: `Tell all ${formatCount(branchAgents.length)} PR agents something`, text: 'New hours, a new test, or a thank you. It shows in their announcement bar.', actions: [{ label: 'Write announcement', onClick: () => setSheet('announce') }] },
  ];

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar back title={`${b.name} branch`} />
      <div className="relative">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7] p-5 text-white shadow-[0_14px_34px_rgba(31,99,214,0.25)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative max-w-[64%]">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${b.status === 'Active' ? 'bg-white/20 text-white' : 'bg-[#fff1e0] text-[#b45309]'}`}>{b.status}</span>
            <p className="mt-1.5 text-[24px] font-bold leading-tight tracking-[-0.02em]">{b.name}</p>
            <p className="text-[12.5px] text-white/90">
              {b.code} · {b.city}, {b.country} · {b.currency}
            </p>
            {data && (
              <p className="mt-2 text-[13px] leading-snug text-white/95">
                Made <b>{formatMoney(data.s.revenue[c] ?? 0, c, true)}</b> {when}, spent <b>{formatMoney(data.s.expenses[c] ?? 0, c, true)}</b>.
              </p>
            )}
          </div>
          <Sticker name="hospital" size={96} className="absolute right-2 top-5" />
          <div className="relative z-10 mt-3.5 grid grid-cols-2 gap-2">
            <TeamButton who={duty} title="On seat" sub={duty ? duty.name.split(' ')[0] : 'No one on duty'} onClick={() => navigate(`/messages/${frontDeskId(b.id)}`)} />
            <TeamButton who={mgr} title="Manager" sub={mgr ? mgr.name.split(' ')[0] : 'Not assigned'} onClick={() => navigate(`/messages/${managerId(b.id)}`)} />
          </div>
        </div>

        <div className="mt-3">
          <ScopeBar periodOnly />
        </div>

        {/* The branch's announcement bar */}
        <SlideCarousel slides={slides} label={`${b.name} announcements`} />

        {data ? (
          <>
            <SectionTitle title={period.key === 'today' ? 'Today’s Activity' : `Activity · ${periodLabel(period)}`} />
            <ActivityTiles summary={data.s} prior={data.prior} c={c} open={open} />

            {/* What changed */}
            <button type="button" onClick={() => setSheet('changed')} className="press relative mt-5 flex w-full items-center gap-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#eef1ff] to-[#dfe4ff] p-4 text-left ring-1 ring-[#dfe3ff]">
              <Sticker name="brain" size={54} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-ink">What changed {when}?</span>
                <span className="block text-[12.5px] leading-snug text-ink-2">Why revenue, patients and spending moved against the period before.</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-brand-600" />
            </button>

            <PaymentsCard title={`Payments received · ${periodLabel(period)}`} paid={data.s.payments[c] ?? 0} billed={data.s.revenue[c] ?? 0} c={c} mix={data.pay} open={open} />

            {/* Needs attention */}
            <SectionTitle title="Needs attention" />
            {data.alerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
                <Sticker name="check" size={40} />
                <p className="text-[14px] text-muted">Nothing needs your attention at {b.name}.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.alerts.map((a) => (
                  <button key={a.id} type="button" onClick={() => setAlert(a)} className="press flex w-full items-start gap-3 rounded-[20px] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${SEVERITY[a.severity].tone}`}>{SEVERITY[a.severity].icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold leading-snug text-ink">{a.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted">{tidy(a.detail)}</span>
                    </span>
                    <ChevronRight size={18} className="mt-2.5 shrink-0 text-faint" />
                  </button>
                ))}
              </div>
            )}

            {/* PR agent management */}
            <SectionTitle title="PR Agent Management" action="View all" onAction={() => setSheet('agents')} />
            <div className="relative overflow-hidden rounded-[22px] bg-linear-to-br from-[#f3eeff] to-[#e2d8ff] p-4 ring-1 ring-[#e2d8ff]">
              <div className="max-w-[68%]">
                <p className="text-[12.5px] font-medium text-ink-2">PR agents at {b.name}</p>
                <p className="mt-0.5 text-[26px] font-bold leading-tight text-ink">{formatCount(branchAgents.length)}</p>
                <p className="text-[12.5px] text-ink-2">
                  {formatCount(activeAgents)} referred patients {when} · {formatMoney(data.s.prCommission[c] ?? 0, c, true)} commission
                </p>
              </div>
              <Sticker name="stethoscope" size={78} className="absolute right-2 top-3" />
              <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSheet('agents')} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-semibold text-violet shadow-sm">
                  <Users size={17} /> View all agents
                </button>
                <button type="button" onClick={() => setSheet('announce')} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-violet text-[13.5px] font-semibold text-white shadow-sm">
                  <Megaphone size={17} /> Announce
                </button>
              </div>
            </div>
            <TopAgents title={`Top PR agents ${when}`} agents={data.agents} onPick={setPick} onAll={() => setSheet('agents')} action="View all" />
          </>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
            <Sticker name="rocket" size={44} />
            <p className="text-[14px] text-muted">This branch is {b.status.toLowerCase()}. Figures start once it is active.</p>
          </div>
        )}

        <DutyRota branchId={b.id} />

        {/* Team */}
        <SectionTitle title="Team" action="Staff Management" onAction={() => navigate('/staff')} />
        <div className="space-y-2">
          {allStaff.length === 0 && <p className="rounded-[20px] bg-white p-4 text-[14px] text-muted ring-1 ring-line/70">No staff assigned yet.</p>}
          {allStaff.map((p) => {
            const isDuty = duty?.name === p.name;
            const isMgr = mgr?.name === p.name;
            const conv = isMgr ? managerId(b.id) : desk.some((d) => d.id === p.id) ? frontDeskId(b.id) : null;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-line/70">
                <span className="relative">
                  <Face who={{ name: p.name, role: p.role, photo: photoOf(p) }} size={46} />
                  {isDuty && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#22c55e] ring-2 ring-white" aria-label="On duty" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {p.role} · {p.employment}
                  </span>
                  {isDuty && <span className="mt-1 inline-flex rounded-full bg-tint-green px-2 py-0.5 text-[11.5px] font-semibold text-good-ink">On seat today</span>}
                </span>
                {conv && (
                  <button type="button" onClick={() => navigate(`/messages/${conv}`)} aria-label={`Message ${p.name}`} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <MessageCircle size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {data && (
          <>
            <Hospitals list={data.hospitals} onPick={setPick} onAll={() => open('hospitals')} />
            <TopServices list={data.services} c={c} onPick={setPick} onAll={() => open('services')} />
            <ExpensesCard label={`Approved expenses · ${periodLabel(period)}`} total={data.s.expenses[c] ?? 0} mix={data.expenses} c={c} onClick={() => open('expenses')} />
            <SectionTitle title="Trend" />
            <div className="rounded-[22px] bg-white p-4 ring-1 ring-line/70">
              <p className="mb-2 text-[12.5px] text-muted">{data.tr.note}</p>
              <TrendChart
                labels={data.tr.labels}
                series={[
                  { name: 'Revenue', color: '#2f7df6', values: data.tr.revenue },
                  { name: 'Payments', color: '#16a34a', values: data.tr.payments },
                  { name: 'Expenses', color: '#f27a1a', values: data.tr.expenses },
                ]}
              />
            </div>
          </>
        )}

        {/* Details */}
        <SectionTitle title="Branch details" />
        <div className="divide-y divide-line rounded-[22px] bg-white ring-1 ring-line/70">
          {(
            [
              ['Branch code', b.code],
              ['Patient ID prefix', b.idCode ? `${b.idCode}-R / ${b.idCode}-W` : 'Not set'],
              ['Currency', b.currency],
              ['Address', b.address || NOT_ON_RECORD],
              ['Phone', b.phone || NOT_ON_RECORD],
              ['Manager', mgr?.name ?? (b.manager || 'Not assigned yet')],
              ['Opened', b.openedOn || NOT_ON_RECORD],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className="flex items-start justify-between gap-4 px-4 py-3 text-[14px]">
              <span className="shrink-0 text-muted">{l}</span>
              <span className="text-right font-medium text-ink">{v}</span>
            </div>
          ))}
        </div>
        {history.length > 0 && (
          <>
            <SectionTitle title="Status history" />
            <div className="divide-y divide-line rounded-[22px] bg-white ring-1 ring-line/70">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="px-4 py-3 text-[13.5px]">
                  <p className="font-semibold text-ink">
                    {h.from} to {h.to}
                  </p>
                  <p className="text-muted">
                    {h.reason} · {h.by} · {new Date(h.at).toLocaleDateString('en-GB')}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {detail && <DetailSheet kind={detail.kind} method={detail.method} branchIds={ids} period={period} scopeText={`${b.name} branch`} onClose={() => setDetail(null)} />}
      {pick && <FocusSheet focus={pick} branchIds={ids} period={period} onClose={() => setPick(null)} />}
      {sheet === 'agents' && <AgentsSheet branchId={b.id} period={period} onClose={() => setSheet(null)} />}
      {sheet === 'announce' && <ComposeSheet audience={{ kind: 'branch', branchId: b.id, branchName: b.name }} branchId={b.id} preset="notice" onClose={() => setSheet(null)} />}
      {sheet === 'changed' && <WhatChangedSheet branchIds={ids} period={period} title={`${b.name} branch`} onClose={() => setSheet(null)} />}
      {alert && (
        <Sheet
          title={alert.title}
          subtitle={`${SEVERITY[alert.severity].label} · ${b.name} branch`}
          onClose={() => setAlert(null)}
          footer={
            <button type="button" onClick={() => (setAlert(null), navigate(alert.route))} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              {alert.action} <ChevronRight size={18} />
            </button>
          }
        >
          <div className="flex items-start gap-3 px-2 pb-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${SEVERITY[alert.severity].tone}`}>{SEVERITY[alert.severity].icon}</span>
            <p className="text-[14.5px] leading-relaxed text-ink-2">{tidy(alert.detail)}</p>
          </div>
        </Sheet>
      )}
      {insights.sheets}
    </div>
  );
}

function TeamButton({ who, title, sub, onClick }: { who: Who | null; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex min-w-0 items-center gap-2 rounded-2xl bg-white/15 p-2 text-left ring-1 ring-white/30 backdrop-blur-sm">
      <span className="relative shrink-0">
        {who ? <Face who={who} size={34} /> : <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/25"><Users size={16} /></span>}
        {who && title === 'On seat' && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#22c55e] ring-2 ring-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{title}</span>
        <span className="block truncate text-[11px] text-white/85">{sub}</span>
      </span>
      <MessageCircle size={16} className="shrink-0 text-white/90" />
    </button>
  );
}
