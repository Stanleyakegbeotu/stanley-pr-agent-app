/**
 * Home sections.
 *  • Updates from your branch: a folder under Quick Actions (owner,
 *    2026-11-26) whose front paper cycles through the latest updates: a
 *    patient arrived, tests done, results ready, not attended, or what the
 *    branch said; which tests were not done. No amounts and no reasons. These show
 *    patient names because they are inside the unlocked app; phone
 *    notifications never do (data/content NOTIFICATIONS).
 *  • Today's patients: every request sent today, with the same rules as
 *    My Patients; "No referrals sent today" when there are none.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, CheckCircle2, ChevronRight, DoorOpen, FlaskConical, Plus, Send, UserX, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { STATUS_LABEL, isToday, partialNote, statusOf, type Referral, type ReferralStatus } from '@/domain/referrals';
import { Button, SectionTitle, Sticker } from '@/ui/kit';
import { Sheet } from '@/admin/ui';
import { branchUpdateText, useBranchUpdates, type BranchUpdateKind } from '@/domain/referralStatus';
import { PatientCard } from '@/screens/Referrals';
import { useDetail } from '@/ui/detailSheet';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** When the branch last changed this request. */
const changedAt = (r: Referral): string | undefined => {
  const s = statusOf(r);
  if (s === 'ResultsReady') return r.resultsAt;
  if (s === 'TestsDone') return r.testsDoneAt;
  if (s === 'Arrived') return r.arrivedAt;
  if (s === 'NotAttended') return new Date(new Date(r.createdAt).getTime() + 14 * 86_400_000).toISOString();
  return undefined;
};

/* ─────────────── Updates from your branch (folder) ─────────────── */

/*
 * Owner, 2026-11-26: like the referrals folder on the branch and admin
 * dashboards. One calm manila folder (no rainbow), papers peeking out: the
 * front paper cycles through the latest updates (a carousel), the count
 * pulses while there is something new. Tap: every update in a slide-up
 * (New / All, search); an update opens the referral, or the result.
 * Updates: arrived, tests done, results ready, not attended, and what the
 * branch said (coming later, did not come, cancelled). The last 7 days.
 */
const SEEN_KEY = 'stanley.pr.updates.seen';
const CYCLE_MS = 3800;
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

type UpdateKind = ReferralStatus | BranchUpdateKind;
interface HomeUpdate {
  key: string;
  r: Referral;
  kind: UpdateKind;
  at: string;
}
const KIND: Partial<Record<UpdateKind, { icon: ReactNode; ink: string; title: (n: string) => string; text: (u: HomeUpdate) => string }>> = {
  Arrived: { icon: <DoorOpen size={17} />, ink: 'text-brand-700', title: (n) => `${n} arrived at the branch`, text: () => 'The patient is with the front desk.' },
  TestsDone: { icon: <FlaskConical size={17} />, ink: 'text-violet', title: (n) => `${n} has done the tests`, text: () => 'Results come after the specialist signs them off.' },
  ResultsReady: { icon: <CheckCircle2 size={17} />, ink: 'text-good-ink', title: (n) => `Results ready for ${n}`, text: () => 'Tap to view the signed off result.' },
  NotAttended: { icon: <UserX size={17} />, ink: 'text-ink-2', title: (n) => `${n} did not attend`, text: () => 'No visit within 14 days of the request.' },
  coming: { icon: <CalendarClock size={17} />, ink: 'text-[#9a5b00]', title: (n) => `${n} is coming later`, text: (u) => branchText(u) },
  no_show: { icon: <UserX size={17} />, ink: 'text-ink-2', title: (n) => `${n} did not come`, text: (u) => branchText(u) },
  cancelled: { icon: <X size={17} />, ink: 'text-[#b42318]', title: (n) => `${n}: referral cancelled`, text: (u) => branchText(u) },
};
let branchTextOf: (u: HomeUpdate) => string = () => '';
const branchText = (u: HomeUpdate) => branchTextOf(u);

const whenText = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (isToday(iso)) return `today ${timeOf(iso)}`;
  const d = Math.floor(m / 1440);
  return d <= 1 ? `yesterday ${timeOf(iso)}` : `${d} days ago`;
};

function useHomeUpdates(): HomeUpdate[] {
  const { referrals } = useApp();
  const branch = useBranchUpdates();
  return useMemo(() => {
    const since = Date.now() - 7 * 86_400_000;
    const out: HomeUpdate[] = [];
    for (const r of referrals) {
      const st = statusOf(r);
      const at = changedAt(r);
      if (at && new Date(at).getTime() >= since && KIND[st]) out.push({ key: `${r.id}:${st}`, r, kind: st, at });
      const u = branch[r.id.toUpperCase()];
      if (u && new Date(u.at).getTime() >= since) out.push({ key: `${r.id}:${u.status}:${u.at}`, r, kind: u.status, at: u.at });
    }
    branchTextOf = (x) => {
      const u = branch[x.r.id.toUpperCase()];
      return u ? branchUpdateText(u) : '';
    };
    return out.sort((x, y) => y.at.localeCompare(x.at));
  }, [referrals, branch]);
}

export function BranchUpdates() {
  const all = useHomeUpdates();
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const fresh = all.filter((u) => !seen.includes(u.key));
  const front = all.slice(0, 5);
  const n = fresh.length;
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || front.length < 2 || open) return;
    const t = window.setInterval(() => !document.hidden && setI((x) => (x + 1) % front.length), CYCLE_MS);
    return () => window.clearInterval(t);
  }, [front.length, open]);
  if (!all.length) return null;
  const cur = front[i % front.length]!;
  const k = KIND[cur.kind]!;
  const behind = [1, 2].map((d) => front[(i + d) % front.length]).filter((x): x is HomeUpdate => !!x && front.length > 1);
  const counts = (['ResultsReady', 'TestsDone', 'Arrived'] as const).map((kk) => [kk, fresh.filter((u) => u.kind === kk).length] as const).filter(([, c]) => c > 0);
  const markSeen = () => {
    const next = [...new Set([...seen, ...all.map((u) => u.key)])].slice(-400);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* this session only */
    }
  };
  return (
    <section className="mt-6" aria-label="Updates from your branch">
      <button type="button" onClick={() => setOpen(true)} aria-label={`Updates from your branch, ${n} new`} className="press group relative block w-full pt-7 text-left">
        {/* back of the folder and its tab */}
        <span aria-hidden="true" className="absolute inset-x-0 top-3 h-[72%] rounded-[26px] bg-linear-to-br from-[#f3dfb0] to-[#e6c27c] shadow-[0_10px_24px_rgba(120,84,20,0.18)]" />
        <span aria-hidden="true" className="absolute left-5 top-0 flex h-9 items-start rounded-t-[16px] bg-[#f3dfb0] px-4 pt-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#6b4a12]">
          From your branch
        </span>
        {/* papers: the front one cycles through the latest updates */}
        <span aria-hidden="true" className="absolute left-5 right-16 top-8 h-28">
          {behind.reverse().map((u, d) => (
            <span key={`${u.key}-b`} className="absolute inset-x-0 rounded-[14px] bg-[#fffdf8] px-3.5 py-2 shadow-[0_4px_10px_rgba(120,84,20,0.12)] ring-1 ring-[#eadcbf]" style={{ top: d * 8, transform: `rotate(${d ? 1.6 : -2.2}deg)`, zIndex: d }}>
              <span className="block truncate text-[11.5px] font-semibold text-[#8a7350]">{KIND[u.kind]!.title(u.r.patient.name)}</span>
            </span>
          ))}
          <span key={cur.key} className="pick-in absolute inset-x-0 top-[18px] z-10 flex items-center gap-2.5 rounded-[16px] bg-white px-3 py-2.5 shadow-[0_8px_18px_rgba(120,84,20,0.18)] ring-1 ring-[#eadcbf]">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f7f1e4] ${k.ink}`}>{k.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink">{k.title(cur.r.patient.name)}</span>
              <span className="block truncate text-[11.5px] text-muted">
                {cur.r.id} · {whenText(cur.at)}
              </span>
            </span>
          </span>
        </span>
        {/* front pocket */}
        <span className="relative z-20 mt-[92px] block overflow-hidden rounded-[24px] bg-linear-to-br from-[#f6e3b6] via-[#eccf8c] to-[#ddb465] p-4 shadow-[0_14px_30px_rgba(120,84,20,0.25)] ring-1 ring-white/50">
          <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/25" />
          <span className="relative flex items-center gap-3">
            <Sticker name="envelope" size={50} className="-my-1 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[17.5px] font-extrabold leading-tight text-[#4a3208]">Updates from your branch</span>
              <span className="block truncate text-[13px] font-medium text-[#6b4a12]">{n ? `${n} new · latest ${whenText(all[0]!.at)}` : `All caught up · ${all.length} this week`}</span>
              {counts.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {counts.map(([kk, c]) => (
                    <span key={kk} className="rounded-full bg-white/60 px-2 py-0.5 text-[11.5px] font-semibold text-[#5a3d0c]">
                      {c} {kk === 'ResultsReady' ? 'results ready' : kk === 'TestsDone' ? 'with tests done' : 'arrived'}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-[#6b4a12]">
              <ChevronRight size={20} />
            </span>
          </span>
          {front.length > 1 && (
            <span className="relative mt-3 flex justify-center gap-1.5" aria-hidden="true">
              {front.map((u, d) => (
                <span key={u.key} className={`block h-1.5 rounded-full transition-all duration-300 ${d === i % front.length ? 'w-5 bg-[#6b4a12]' : 'w-1.5 bg-[#6b4a12]/30'}`} />
              ))}
            </span>
          )}
        </span>
        {/* the count: pulses while something is new */}
        <span className="absolute right-3 top-0 z-30 grid place-items-center">
          {n > 0 && <span className="absolute h-11 w-11 animate-ping rounded-full bg-[#ef4444]/40" />}
          <span className={`relative grid h-11 min-w-11 place-items-center rounded-full px-2 text-[17px] font-extrabold text-white ring-4 ring-white ${n ? 'bg-linear-to-b from-[#ff5a5f] to-[#e11d2a] shadow-[0_8px_18px_rgba(225,29,42,0.4)]' : 'bg-good'}`}>{n ? (n > 99 ? '99+' : n) : <CheckCircle2 size={20} />}</span>
        </span>
      </button>
      {open && (
        <UpdatesSheet
          all={all}
          seen={seen}
          onClose={() => {
            markSeen();
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function UpdatesSheet({ all, seen, onClose }: { all: HomeUpdate[]; seen: string[]; onClose: () => void }) {
  const detail = useDetail();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'new' | 'all'>(all.some((u) => !seen.includes(u.key)) ? 'new' : 'all');
  const t = q.trim().toLowerCase();
  const fresh = all.filter((u) => !seen.includes(u.key));
  const list = (t ? all : tab === 'new' ? fresh : all).filter((u) => !t || `${u.r.patient.name} ${u.r.id}`.toLowerCase().includes(t));
  return (
    <Sheet title="Updates from your branch" subtitle={`${fresh.length} new · last 7 days`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Patient name or request ID' }}>
      <div className="px-1 pb-4">
        {!t && (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-page p-1" role="tablist">
            {(
              [
                ['new', `New ${fresh.length}`],
                ['all', `All ${all.length}`],
              ] as const
            ).map(([kk, l]) => (
              <button key={kk} type="button" role="tab" aria-selected={tab === kk} onClick={() => setTab(kk)} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${tab === kk ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        {list.length ? (
          <ul className="space-y-2">
            {list.map((u) => {
              const k = KIND[u.kind]!;
              const isNew = !seen.includes(u.key);
              const partial = u.kind === 'TestsDone' || u.kind === 'ResultsReady' ? partialNote(u.r) : null;
              return (
                <li key={u.key}>
                  <button type="button" onClick={() => detail.open({ kind: u.kind === 'ResultsReady' ? 'result' : 'referral', id: u.r.id })} className="press relative flex w-full items-start gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7f1e4] ${k.ink}`}>{k.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <b className="min-w-0 text-[14.5px] leading-snug text-ink">{k.title(u.r.patient.name)}</b>
                        {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" aria-label="New" />}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{k.text(u)}</span>
                      {partial && <span className="mt-1.5 block rounded-xl bg-[#fbf6ea] px-2.5 py-1.5 text-[12px] text-[#7a5a1c]">{partial}</span>}
                      <span className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted">
                        <span>
                          {u.r.id} · {whenText(u.at)}
                        </span>
                        <span className="flex items-center gap-0.5 font-semibold text-brand-600">
                          {u.kind === 'ResultsReady' ? 'View result' : 'View'} <ChevronRight size={14} />
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center rounded-[22px] bg-page px-5 py-8 text-center">
            <Sticker name="check" size={60} />
            <p className="mt-2 text-[15px] font-semibold text-ink">{t ? `No update for “${q}”` : 'You are all caught up'}</p>
            <p className="text-[13px] text-muted">New updates appear when your patients arrive, finish tests or have results.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ─────────────── Today's patients ─────────────── */

export function TodayPatients() {
  const detail = useDetail();
  const { referrals, navigate } = useApp();
  const today = referrals.filter((r) => isToday(r.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="mt-6">
      <SectionTitle title="Today’s Referrals" action={today.length ? 'See all' : undefined} onAction={() => navigate('/referrals')} />
      {today.length === 0 ? (
        <div className="card flex flex-col items-center px-5 py-7 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-tint-blue text-brand-600">
            <Send size={24} />
          </span>
          <p className="mt-3 text-[16px] font-bold text-ink">No patients requested today</p>
          <p className="mt-1 text-[13.5px] text-muted">Referrals you send today will show here with their status.</p>
          <div className="mt-4 w-full max-w-[240px]">
            <Button block onClick={() => navigate('/refer')}>
              <Plus size={18} /> New request
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {today.map((r) => (
            <li key={r.id}>
              <PatientCard r={r} onOpen={() => detail.open({ kind: 'referral', id: r.id })} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { STATUS_LABEL };
