/**
 * PR Management (mobile, owner 2026-11-25): same content and rules as the
 * desktop PRPage + PRCatalog, in the admin's mobile card language.
 * Branch first (each branch has its own hospitals and PR agents), then:
 *   hero (referrals, commission) with "Tell agents something" · quick tiles
 *   (all agents, hospitals, no hospital, edited, commission rate) · top PR
 *   agents · partner hospitals as cards (search hospitals or agents, sort by
 *   agents, referrals or code) · the agents without a hospital.
 * A hospital opens its agents (slide-up, "Add PR agent" to it); an agent
 * opens the profile slide-up (figures, patients, account details, chat,
 * announcements, Edit profile with hospital transfer and own rate, restore,
 * move to trash). The commission rate is changed here, as on the desktop.
 * Under the tiles: the PR agent monitor and monthly payouts (admin/prMonitor).
 * Never shown on the Referrer Portal (money stays on the company side).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Megaphone, Percent, Plus, Search, UserX, Users, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID, buildHospitalDirectory, hospitalKey, type HospitalEntry } from '@company/data/legacy';
import { agentRanking, resolveRange } from '@company/services/analytics';
import { pct, rateSummary, useCommission } from '@company/services/commission';
import { formatCount, formatMoney } from '@company/shared/format';
import { Sticker } from '@/ui/kit';
import { ScopeBar } from '../ui';
import { FocusSheet, norm, type Focus } from '../details';
import { AdminTopBar, EmptyCard, PageGlow, SectionTitle } from '../kit';
import { TopAgents } from '../sections';
import { AgentsSheet, ComposeSheet } from '../agents';
import { AgentAvatar } from '../agentPhotos';
import { periodWord } from '../insights';
import { AddAgentSheet, RateSheet } from '../prManage';
import { PICK_THEME, BranchCrumb, BranchPick, Chips, PageTitle, useBranchFirst } from '../branchFirst';
import { StickyTools } from '@/admin/kit';
import { useRight } from '../access';
import { PayoutsCard } from '../prMonitor';

type Sort = 'agents' | 'referrals' | 'name';
const PAGE = 12;

export function PRPage({ sub }: { sub?: string }) {
  const { branch, fromScope } = useBranchFirst(sub);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar title={branch ? 'PR Management' : undefined} />
      <div className="relative">{branch ? <Workspace branchId={branch.id} crumb={!fromScope} /> : <Choose />}</div>
    </div>
  );
}

function Choose() {
  const { agents, period } = useCompany();
  const range = resolveRange(period);
  return (
    <>
      <PageTitle title="PR Management" sub="Referral network · all branches" />
      <ScopeBar periodOnly />
      <BranchPick
        page="pr"
        sticker="stethoscope"
        go="Open"
        theme={PICK_THEME.pr}
        note="Each branch has its own hospitals and PR agents. Choose a branch."
        stats={(b) => {
          const network = b.id === LEGACY_BRANCH_ID ? agents : [];
          const ranked = agentRanking([b.id], range);
          return [
            { label: 'PR agents', value: formatCount(network.length) },
            { label: 'Hospitals', value: formatCount(buildHospitalDirectory(network).length) },
            { label: 'Referrals', value: formatCount(ranked.reduce((s, a) => s + a.referrals, 0)) },
            { label: 'Revenue', value: formatMoney(ranked.reduce((s, a) => s + (a.revenue[b.currency] ?? 0), 0), b.currency, true) },
          ];
        }}
        foot={(b) => {
          const network = b.id === LEGACY_BRANCH_ID ? agents : [];
          return `${formatCount(network.filter((a) => !a.hospital.trim()).length)} agents without a hospital`;
        }}
      />
    </>
  );
}

function Workspace({ branchId, crumb }: { branchId: string; crumb: boolean }) {
  const { agents: all, agentEdits, period } = useCompany();
  const commission = useCommission();
  const b = getBranch(branchId)!;
  const c = b.currency;
  const range = resolveRange(period);
  const when = periodWord(period);
  const inScope = branchId === LEGACY_BRANCH_ID;
  const agents = useMemo(() => (inScope ? all : []), [inScope, all]);
  const directory = useMemo(() => buildHospitalDirectory(agents), [agents]);
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ranked = useMemo(() => agentRanking([branchId], range), [branchId, range.from.getTime(), range.to.getTime(), commission.version]);
  const act = useMemo(() => new Map(ranked.map((a) => [a.id, a])), [ranked]);
  const unassigned = agents.filter((a) => !hospitalKey(a.hospital));
  const edited = agents.filter((a) => agentEdits[a.id]).length;
  const added = agents.filter((a) => a.source === 'user').length;
  const totals = ranked.reduce((s, a) => ({ referrals: s.referrals + a.referrals, revenue: s.revenue + (a.revenue[c] ?? 0), commission: s.commission + (a.commission[c] ?? 0) }), { referrals: 0, revenue: 0, commission: 0 });

  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('agents');
  const [shown, setShown] = useState(PAGE);
  const [list, setList] = useState<{ hospital?: string | null; show?: 'all' | 'edited' } | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [rate, setRate] = useState(false);
  const [adding, setAdding] = useState(false);
  const [announce, setAnnounce] = useState(false);
  // Roles and Permissions (owner, 2026-11-25): add and edit agents; see commission.
  const right = useRight();
  const canManage = right('referral.manage');
  const seeMoney = right('referral.commission');

  const stat = (h: HospitalEntry) => {
    let referrals = 0;
    let revenue = 0;
    let active = 0;
    for (const id of h.agentIds) {
      const a = act.get(id);
      if (a) {
        referrals += a.referrals;
        revenue += a.revenue[c] ?? 0;
        active += 1;
      }
    }
    return { referrals, revenue, active };
  };
  const rank = new Map([...directory].sort((x, y) => y.agentCount - x.agentCount || x.key.localeCompare(y.key)).map((h, i) => [h.key, i + 1]));
  const maxAgents = Math.max(1, ...directory.map((h) => h.agentCount));
  const t = norm(q);
  const agentHits = (h: HospitalEntry) => (t ? h.agentIds.filter((id) => norm(byId.get(id)?.name ?? '').includes(t)).length : 0);
  const hospitals = directory
    .filter((h) => !t || norm(h.key).includes(t) || h.rawVariants.some((r) => norm(r).includes(t)) || agentHits(h) > 0)
    .sort((x, y) => (sort === 'name' ? x.key.localeCompare(y.key) : sort === 'referrals' ? stat(y).referrals - stat(x).referrals || y.agentCount - x.agentCount : y.agentCount - x.agentCount || x.key.localeCompare(y.key)));
  const matchingAgents = t ? agents.filter((a) => norm(`${a.name} ${a.phone} ${a.id}`).includes(t)).slice(0, 8) : [];

  return (
    <>
      {crumb && <BranchCrumb page="pr" label="PR Management" branch={b} />}
      <PageTitle
        title="PR Management"
        sub={`${b.name} branch · referral network`}
        action={
          inScope && canManage && (
            <button type="button" onClick={() => setAdding(true)} aria-label="Add PR agent" className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand-600 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
              <Plus size={18} /> Add
            </button>
          )
        }
      />
      <ScopeBar periodOnly />

      {!inScope ? (
        <EmptyCard sticker="stethoscope" text="No PR agents for this branch yet. The PR network currently belongs to BR001 (Abuja)." />
      ) : (
        <>
          {/* Hero */}
          <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7] p-5 text-white shadow-[0_14px_34px_rgba(75,47,196,0.28)]">
            <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
            <div className="relative max-w-[64%]">
              <p className="text-[13px] font-medium text-white/90">Patients referred {when}</p>
              <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.02em]">{formatCount(totals.referrals)}</p>
              <p className="mt-2 text-[12.5px] leading-snug text-white/90">
                {formatCount(ranked.length)} of {formatCount(agents.length)} agents referred · {formatMoney(totals.revenue, c, true)} billed{seeMoney ? ` · ${formatMoney(totals.commission, c, true)} commission` : ''}
              </p>
              <span className="mt-3.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setAnnounce(true)} className="press relative z-10 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-semibold text-violet shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                  <Megaphone size={15} /> Tell agents
                </button>
                <button type="button" onClick={() => setList({})} className="press relative z-10 inline-flex min-h-9 items-center gap-1 rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white ring-1 ring-white/40">
                  All agents <ChevronRight size={15} />
                </button>
              </span>
            </div>
            <Sticker name="stethoscope" size={110} className="absolute right-1 top-3" />
          </div>

          {/* Quick tiles */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Quick tint="bg-tint-purple border-[#e2d8ff]" sticker="womanHealthWorker" label="PR agents" value={formatCount(agents.length)} sub={`${formatCount(agents.length - unassigned.length)} with a hospital${added ? ` · ${added} added` : ''}`} onClick={() => setList({})} />
            <Quick tint="bg-tint-blue border-[#d6e7ff]" sticker="hospital" label="Partner hospitals" value={formatCount(directory.length)} sub={directory.some((h) => h.notes.length) ? `${directory.filter((h) => h.notes.length).length} codes need review` : 'From agent assignments'} onClick={() => document.getElementById('pr-hospitals')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
            <Quick tint="bg-[#fdecec] border-[#f9d4d4]" icon={<UserX size={26} className="text-[#d93036]" />} label="No hospital" value={formatCount(unassigned.length)} sub="Assign them from their profile" onClick={() => setList({ hospital: null })} />
            {seeMoney && <Quick tint="bg-[#eef1ff] border-[#dfe3ff]" icon={<Percent size={26} className="text-[#4f46e5]" strokeWidth={2.4} />} label="Commission rate" value={pct(commission.rate)} sub={rateSummary().replace(/^Company rate [\d.]+%;?\s*/, '') || 'Tap to change'} onClick={() => setRate(true)} />}
          </div>
          {edited > 0 && (
            <button type="button" onClick={() => setList({ show: 'edited' })} className="press mt-2.5 flex w-full items-center gap-3 rounded-[18px] bg-[#fff7ec] p-3 text-left ring-1 ring-[#ffe0b8]">
              <Sticker name="clipboard" size={32} />
              <span className="min-w-0 flex-1 text-[13.5px] text-[#9a4a07]">
                <b>{formatCount(edited)} edited agent{edited === 1 ? '' : 's'}</b> · recorded details kept and can be restored
              </span>
              <ChevronRight size={17} className="shrink-0 text-[#b45309]" />
            </button>
          )}

          {/* PR agent monitor and monthly payouts (owner, 2026-11-26). */}

          {ranked.length > 0 && <TopAgents money={seeMoney} title={`Top PR agents ${when}`} agents={ranked} onPick={setFocus} onAll={() => setList({})} action="View all" />}

          {/* Hospitals */}
          <div id="pr-hospitals" className="scroll-mt-20">
            <SectionTitle title="Partner hospitals" />
          </div>
          <StickyTools>
          <div className="relative mb-2.5">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => (setQ(e.target.value), setShown(PAGE))} placeholder="Search hospitals or PR agents" aria-label="Search hospitals or PR agents" className="min-h-12 w-full rounded-full bg-white pl-11 pr-11 text-[15px] text-ink shadow-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500" />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted">
                <X size={18} />
              </button>
            )}
          </div>
          <Chips
            label="Sort hospitals"
            value={sort}
            onChange={(v) => (setSort(v), setShown(PAGE))}
            options={[
              { value: 'agents', label: 'Most PR agents' },
              { value: 'referrals', label: 'Most referrals' },
              { value: 'name', label: 'Code A to Z' },
            ]}
          />
          </StickyTools>

          {matchingAgents.length > 0 && (
            <div className="mb-3 rounded-[20px] bg-white p-2 ring-1 ring-line/70">
              <p className="px-2 pb-1 pt-1 text-[12.5px] font-semibold text-muted">Matching PR agents</p>
              {matchingAgents.map((a) => (
                <button key={a.id} type="button" onClick={() => setFocus({ kind: 'agent', id: a.id })} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left">
                  <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{a.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {hospitalKey(a.hospital) || 'No hospital assigned'} · #{a.id}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-faint" />
                </button>
              ))}
            </div>
          )}

          <p className="mb-2 text-[12.5px] text-muted">
            {formatCount(hospitals.length)} hospital{hospitals.length === 1 ? '' : 's'}
            {t ? ` matching “${q}”` : ''} · ranked by PR agents
          </p>
          {hospitals.length === 0 ? (
            <EmptyCard sticker="hospital" text={`No hospitals or agents match “${q}”.`} />
          ) : (
            <>
            <div>
              {/* The three leading hospitals as swipeable cards (owner, 2026-11-25: mobile cards, not desktop tiles). */}
              {!t && hospitals.length > 3 && (
                <div className="-mx-5 mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8" data-no-swipe>
                  {hospitals.slice(0, 3).map((h, i) => {
                    const st = stat(h);
                    const people = h.agentIds.map((id) => byId.get(id)).filter((a): a is NonNullable<typeof a> => !!a);
                    const lead = [...people].sort((x, y) => (act.get(y.id)?.referrals ?? 0) - (act.get(x.id)?.referrals ?? 0) || x.order - y.order);
                    const top = lead[0] && act.get(lead[0].id) ? lead[0] : null;
                    return (
                      <button
                        key={h.key}
                        type="button"
                        onClick={() => setList({ hospital: h.key })}
                        className={`press relative w-[84%] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-[26px] bg-linear-to-br p-4 text-left text-white shadow-[0_14px_30px_rgba(40,30,120,0.25)] ${['from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]', 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]', 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]'][i]}`}
                        style={{ animation: `pick-in 520ms cubic-bezier(0.22,0.8,0.24,1) ${i * 100}ms both` }}
                      >
                        <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
                        <Sticker name={i === 0 ? 'trophy' : 'hospital'} size={70} className="absolute right-2 top-2 drop-shadow-[0_8px_14px_rgba(0,0,0,0.2)]" />
                        <span className="relative flex items-center gap-2">
                          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white px-1.5 text-[12.5px] font-extrabold text-ink">#{i + 1}</span>
                          <span className="truncate text-[12.5px] font-medium text-white/85">{sort === 'referrals' ? `Most referrals ${when}` : sort === 'name' ? 'Partner hospital' : 'Most PR agents'}</span>
                        </span>
                        <span className="relative mt-3 block max-w-[70%] truncate text-[22px] font-bold leading-tight">{h.key}</span>
                        <span className="relative mt-0.5 block text-[12.5px] text-white/85">
                          {formatCount(h.agentCount)} PR agents · {formatCount(st.active)} referred {when}
                        </span>
                        <span className="relative mt-3 flex items-center gap-2">
                          <span className="flex -space-x-2">
                            {lead.slice(0, 4).map((a) => (
                              <span key={a.id} className="rounded-full ring-2 ring-white/80">
                                <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={30} />
                              </span>
                            ))}
                          </span>
                          {people.length > 4 && <span className="text-[12px] font-semibold text-white/85">+{formatCount(people.length - 4)}</span>}
                        </span>
                        <span className="relative mt-3 grid grid-cols-2 gap-2">
                          <span className="rounded-2xl bg-white/15 px-2.5 py-2 ring-1 ring-white/20">
                            <span className="block text-[11px] text-white/80">Referrals</span>
                            <b className="block text-[16px]">{formatCount(st.referrals)}</b>
                          </span>
                          <span className="rounded-2xl bg-white/15 px-2.5 py-2 ring-1 ring-white/20">
                            <span className="block text-[11px] text-white/80">Billed</span>
                            <b className="block truncate text-[16px]">{formatMoney(st.revenue, c, true)}</b>
                          </span>
                        </span>
                        <span className="relative mt-2.5 block truncate text-[12px] text-white/85">{top ? `Top agent: ${top.name}` : `No referrals ${when}`}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
                {hospitals.slice(!t && hospitals.length > 3 ? 3 : 0, shown).map((h) => {
                  const st = stat(h);
                  const people = h.agentIds.map((id) => byId.get(id)).filter((a): a is NonNullable<typeof a> => !!a);
                  const lead = [...people].sort((x, y) => (act.get(y.id)?.referrals ?? 0) - (act.get(x.id)?.referrals ?? 0) || x.order - y.order);
                  const r = rank.get(h.key) ?? 0;
                  const hits = agentHits(h);
                  return (
                    <button key={h.key} type="button" onClick={() => setList({ hospital: h.key })} className="press flex w-full items-center gap-3 border-b border-line px-3.5 py-3 text-left last:border-0">
                      <span className="relative shrink-0">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-linear-to-br from-[#f3eeff] to-[#e0d6ff] text-[13px] font-extrabold tracking-[-0.02em] text-violet">{monogram(h.key)}</span>
                        <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-ink-2 shadow ring-1 ring-line">{r}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{h.key}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {formatCount(h.agentCount)} agents · {formatCount(st.active)} active
                          {st.revenue > 0 ? ` · ${formatMoney(st.revenue, c, true)}` : ''}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <span className="flex -space-x-1.5">
                            {lead.slice(0, 3).map((a) => (
                              <span key={a.id} className="rounded-full ring-2 ring-white">
                                <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={24} />
                              </span>
                            ))}
                          </span>
                          {hits > 0 && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-700">{`${hits} match${hits === 1 ? '' : 'es'}`}</span>}
                          {h.notes.length > 0 && <span className="rounded-full bg-[#fff1e0] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b45309]">Review code</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <b className={`block text-[18px] leading-none ${st.referrals ? 'text-violet' : 'text-faint'}`}>{formatCount(st.referrals)}</b>
                        <span className="text-[11px] text-muted">referrals</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-faint" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {shown < hospitals.length && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="press mx-auto block rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-brand-600 ring-1 ring-line">
                  Show more hospitals ({formatCount(hospitals.length - shown)} more)
                </button>
              )}
              {!t && unassigned.length > 0 && (
                <button type="button" onClick={() => setList({ hospital: null })} className="press flex w-full items-center gap-3 rounded-[22px] border-[1.5px] border-dashed border-[#f3b4b4] bg-[#fff6f6] p-4 text-left">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
                    <UserX size={24} className="text-[#d93036]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-ink">No hospital assigned · {formatCount(unassigned.length)}</span>
                    <span className="block text-[12.5px] text-muted">Kept separate, never guessed into a hospital. Assign one from the agent's profile.</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-faint" />
                </button>
              )}
            </div>
            </>
          )}
          {/* Monthly payouts: the last section (owner, 2026-11-27). The monitor and marketers are on the Marketing page. */}
          <PayoutsCard branchId={branchId} />
          <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
            <Users size={15} className="mt-0.5 shrink-0" />
            Commission and account details stay on the company side. The Referrer Portal never shows money.
          </p>
        </>
      )}

      {list && <AgentsSheet branchId={branchId} period={period} hospital={list.hospital} initialShow={list.show} canAdd onClose={() => setList(null)} />}
      {focus && <FocusSheet focus={focus} branchIds={[branchId]} period={period} onClose={() => setFocus(null)} />}
      {rate && <RateSheet onClose={() => setRate(false)} />}
      {adding && <AddAgentSheet onClose={() => setAdding(false)} onAdded={(id) => setFocus({ kind: 'agent', id })} />}
      {announce && <ComposeSheet audience={{ kind: 'branch', branchId: b.id, branchName: b.name }} branchId={b.id} preset="notice" onClose={() => setAnnounce(false)} />}
    </>
  );
}

function Quick({ tint, sticker, icon, label, value, sub, onClick }: { tint: string; sticker?: 'womanHealthWorker' | 'hospital'; icon?: ReactNode; label: string; value: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press relative flex min-h-[116px] min-w-0 flex-col items-start overflow-hidden rounded-[18px] border p-3 text-left ${tint}`}>
      {sticker ? <Sticker name={sticker} size={34} /> : icon}
      <span className="mt-1.5 text-[13px] leading-tight text-ink-2">{label}</span>
      <span className="mt-0.5 text-[22px] font-bold leading-none tracking-[-0.02em] text-ink">{value}</span>
      <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted">{sub}</span>
    </button>
  );
}

/** Up to three letters from a hospital code ("LUTH", "NHA" → "NHA"). */
function monogram(key: string) {
  const words = key.split(/[\s/&-]+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join('');
  return key.slice(0, 3);
}
