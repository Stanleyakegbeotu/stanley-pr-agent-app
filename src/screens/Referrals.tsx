/**
 * Referrals (compliance rebuild, 2026-11-24): the clinician's OWN requests
 * only, for 90 days after results / non-attendance. Each request shows its
 * quoted price. Totals (owner, 2026-11-26): the value of the tests for the
 * referrals that went through (the patient came), for today, this month and
 * the chosen period, hidden until "See" is tapped; a total opens the list
 * behind it. No searching all history by
 * phone number. Details: status timeline, tests and quoted price, which tests
 * were not done (no reasons), clinical details, note, results link.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, ChevronRight, Copy, DoorOpen, Eye, FileText, FlaskConical, Hash, MessageSquareText, Plus, Send, ShieldCheck, Siren, Stethoscope, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StickerKey } from '@/assets';
import { copyText } from '@/ui/privacy';
import { BRANCH } from '@/config/org';
import { displayPhone, naira, shortDate } from '@/domain/format';
import { NOT_ATTENDED_DAYS, RETENTION_DAYS, STAGES, STATUS_LABEL, STATUS_NOTE, countsFor, inMonth, isToday, partialNote, quoteOf, serviceSummary, servicesOf, statusOf, type Referral, type ReferralStatus } from '@/domain/referrals';
import { useApp } from '@/app/store';
import { Button, Card, Chip, ChipRow, EmptyState, InitialsAvatar, ScreenHeader, SearchField, Segmented, ServiceThumb, StatusBadge, Sticker, Subtitle } from '@/ui/kit';
import { Sheet } from '@/admin/ui';
import { ReferralNoteView } from '@/screens/refer/ReferralNote';
import { PatientMessageButton } from '@/screens/refer/PatientMessage';
import { priceText } from '@/screens/Services';
import { BRANCH_UPDATE_LABEL, branchUpdateText, useBranchUpdates } from '@/domain/referralStatus';
import { useDetail } from '@/ui/detailSheet';

type Period = 'today' | 'month' | 'all';
type FilterKey = 'All' | ReferralStatus;
const FILTERS: FilterKey[] = ['All', 'Requested', 'Arrived', 'TestsDone', 'ResultsReady', 'NotAttended'];

export function MyReferrals() {
  const detail = useDetail();
  const { referrals, navigate, route } = useApp();
  const qs = route.query.get('status') as ReferralStatus | null;
  const [period, setPeriod] = useState<Period>(qs ? 'all' : 'month');
  const [f, setF] = useState<FilterKey>(qs && FILTERS.includes(qs) ? qs : 'All');
  const [q, setQ] = useState('');

  const inPeriod = useMemo(() => referrals.filter((r) => (period === 'today' ? isToday(r.createdAt) : period === 'month' ? inMonth(r.createdAt) : true)), [referrals, period]);
  // What went through (the patient came) and the value of the tests done; hidden until See is tapped.
  const pc = countsFor(inPeriod);
  const went = inPeriod.filter(wentThrough);
  const todayWent = referrals.filter((r) => isToday(r.createdAt) && wentThrough(r));
  const monthWent = referrals.filter((r) => inMonth(r.createdAt) && wentThrough(r));
  const [show, setShow] = useState({ period: false, today: false, month: false });
  const reveal = (k: keyof typeof show) => setShow((x) => ({ ...x, [k]: true }));
  const [total, setTotal] = useState<{ title: string; list: Referral[] } | null>(null);
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: inPeriod.length };
    for (const r of inPeriod) c[statusOf(r)] = (c[statusOf(r)] ?? 0) + 1;
    return c;
  }, [inPeriod]);
  const t = q.trim().toLowerCase();
  // Search by name or request ID, only within what's listed (no phone-number search of history).
  const list = inPeriod.filter((r) => f === 'All' || statusOf(r) === f).filter((r) => !t || r.patient.name.toLowerCase().includes(t) || r.id.toLowerCase().includes(t));

  return (
    <>
      <ScreenHeader title="Referrals" back={false} />
      <Subtitle>Your referrals: the patients you requested tests for. Each stays here for {RETENTION_DAYS} days after results or non-attendance.</Subtitle>

      {/* Hero: this period's referrals, what went through, and the value (hidden until See) */}
      <section className="relative mb-3 overflow-hidden rounded-[28px] bg-linear-to-br from-[#123e9c] via-[#1f6fe8] to-[#5ea6f7] p-5 text-white shadow-[0_18px_40px_rgba(31,99,214,0.32)]">
        <span aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-black/10" />
        <Sticker name="clipboard" size={74} className="absolute right-4 top-4 drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
        <p className="relative text-[13px] font-semibold text-white/85">Referrals · {PERIOD_TEXT[period]}</p>
        <p className="relative mt-1 text-[38px] font-extrabold leading-none tracking-[-0.02em]">{inPeriod.length}</p>
        <p className="relative mt-1.5 max-w-[70%] text-[12.5px] text-white/85">
          {went.length} went through · {pc.resultsReady} results ready{pc.notAttended ? ` · ${pc.notAttended} not attended` : ''}
        </p>
        <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 backdrop-blur-sm">
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-semibold text-white/80">Value of tests that went through</span>
            <span className="block truncate text-[22px] font-extrabold tracking-[-0.01em]">{show.period ? naira(sumOf(went)) : '₦ • • • • •'}</span>
          </span>
          <button type="button" onClick={() => (show.period ? setTotal({ title: `${PERIOD_TEXT[period]}`, list: went }) : reveal('period'))} className="press flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[13.5px] font-bold text-brand-700 shadow-[0_6px_16px_rgba(0,0,0,0.15)]">
            {show.period ? <>Details <ChevronRight size={15} /></> : <><Eye size={16} /> See</>}
          </button>
        </div>
      </section>

      {/* Today and this month, side by side */}
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {(
          [
            ['today', 'Today', todayWent, 'bg-linear-to-br from-[#e9f9ef] to-[#d3f3e1] ring-[#bfe9d0]', 'text-good-ink', 'calendar'],
            ['month', 'This month', monthWent, 'bg-linear-to-br from-[#f3eeff] to-[#e4dbff] ring-[#d9ccff]', 'text-violet', 'coin'],
          ] as const
        ).map(([k, label, list, tone, ink, sticker]) => (
          <button key={k} type="button" onClick={() => (show[k] ? setTotal({ title: label, list }) : reveal(k))} className={`press relative overflow-hidden rounded-[22px] p-3.5 text-left ring-1 ${tone}`}>
            <Sticker name={sticker} size={34} className="absolute right-2.5 top-2.5" />
            <span className={`block text-[12.5px] font-bold ${ink}`}>{label}</span>
            <span className="mt-2 block truncate text-[19px] font-extrabold tracking-[-0.01em] text-ink">{show[k] ? naira(sumOf(list)) : '₦ • • • •'}</span>
            <span className="block text-[11.5px] text-ink-2">
              {list.length} referral{list.length === 1 ? '' : 's'} went through
            </span>
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-bold ${ink}`}>
              {show[k] ? <>See the list <ChevronRight size={13} /></> : <><Eye size={13} /> {k === 'today' ? 'See today’s total' : 'See the monthly total'}</>}
            </span>
          </button>
        ))}
      </div>

      <Segmented<Period>
        value={period}
        onChange={(p) => (setPeriod(p), setF('All'))}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'month', label: 'This month' },
          { value: 'all', label: `Last ${RETENTION_DAYS} days` },
        ]}
      />
      <div className="mb-4">
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or request ID..." aria-label="Search patients" />
      </div>
      <ChipRow>
        {FILTERS.filter((x) => x === 'All' || counts[x]).map((x) => (
          <Chip key={x} active={f === x} onClick={() => setF(x)}>
            {x === 'All' ? 'All' : STATUS_LABEL[x]} ({counts[x] ?? 0})
          </Chip>
        ))}
      </ChipRow>

      {list.length === 0 ? (
        <EmptyState
          sticker="clipboard"
          title={t ? 'No matching patients' : period === 'today' ? 'No requests today' : 'No patients here'}
          text={t ? 'Try another name or request ID.' : 'Patients you request tests for will appear here with their status.'}
          action={
            !t ? (
              <Button onClick={() => navigate('/refer')}>
                <Plus size={19} /> New request
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => (
            <li key={r.id}>
              <PatientCard r={r} onOpen={() => detail.open({ kind: 'referral', id: r.id })} />
            </li>
          ))}
        </ul>
      )}
      {total && <TotalSheet title={total.title} list={total.list} onClose={() => setTotal(null)} onOpen={(id) => detail.open({ kind: 'referral', id })} />}
    </>
  );
}

/** Calm look per status (light hero, one accent). */
const LOOK: Record<ReferralStatus, { hero: string; ink: string; bar: string; dot: string; sticker: StickerKey; icon: ReactNode }> = {
  Requested: { hero: 'from-[#f2f7ff] to-[#dfeaff] ring-[#d6e4fb]', ink: 'text-brand-700', bar: 'bg-brand-500', dot: 'bg-brand-600', sticker: 'clipboard', icon: <Send size={13} /> },
  Arrived: { hero: 'from-[#eef6ff] to-[#d9e9ff] ring-[#cfe0fb]', ink: 'text-brand-700', bar: 'bg-brand-500', dot: 'bg-brand-600', sticker: 'hospital', icon: <DoorOpen size={13} /> },
  TestsDone: { hero: 'from-[#f6f2ff] to-[#e6dcff] ring-[#e0d4ff]', ink: 'text-violet', bar: 'bg-violet', dot: 'bg-violet', sticker: 'testTube', icon: <FlaskConical size={13} /> },
  ResultsReady: { hero: 'from-[#ecfbf2] to-[#d3f3e1] ring-[#c8ecd7]', ink: 'text-good-ink', bar: 'bg-good', dot: 'bg-good', sticker: 'check', icon: <CheckCircle2 size={13} /> },
  NotAttended: { hero: 'from-[#f6f7fa] to-[#e8ebf1] ring-line', ink: 'text-ink-2', bar: 'bg-[#a7b0bf]', dot: 'bg-[#a7b0bf]', sticker: 'calendar', icon: <UserX size={13} /> },
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const PERIOD_TEXT: Record<Period, string> = { today: 'Today', month: 'This month', all: `Last ${RETENTION_DAYS} days` };

/** The patient came: arrived, tests done or results ready. */
const wentThrough = (r: Referral) => {
  const st = statusOf(r);
  return st === 'Arrived' || st === 'TestsDone' || st === 'ResultsReady';
};
/** Value of a referral that went through: the tests actually done (all requested ones when not told otherwise). */
const valueOf = (r: Referral) => {
  const tests = servicesOf(r);
  const done = r.doneServiceIds ? tests.filter((x) => r.doneServiceIds!.includes(x.id)) : tests;
  return done.reduce((n, x) => n + (x.price ?? 0), 0);
};
const sumOf = (list: Referral[]) => list.reduce((n, r) => n + valueOf(r), 0);

/** The list behind a total: each referral that went through and the value of its tests. */
function TotalSheet({ title, list, onClose, onOpen }: { title: string; list: Referral[]; onClose: () => void; onOpen: (id: string) => void }) {
  const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Sheet title={`${title}: ${naira(sumOf(list))}`} subtitle={`${list.length} referral${list.length === 1 ? '' : 's'} went through · value of the tests done`} onClose={onClose} tall>
      <div className="px-1 pb-4">
        <div className="mb-3 rounded-[22px] bg-linear-to-br from-[#eaf2ff] to-[#d6e5ff] p-4">
          <p className="text-[12.5px] font-semibold text-brand-700">Total</p>
          <p className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{naira(sumOf(list))}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-2">Prices of the tests done for your referred patients. The branch confirms the final bill.</p>
        </div>
        {sorted.length ? (
          <ul className="space-y-2">
            {sorted.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
                  <InitialsAvatar name={r.patient.name} size={42} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px] text-ink">{r.patient.name}</b>
                    <span className="block truncate text-[12px] text-muted">
                      {r.id} · {shortDate(r.createdAt)} · {STATUS_LABEL[statusOf(r)]}
                    </span>
                  </span>
                  <b className="shrink-0 text-[14.5px] text-ink">{naira(valueOf(r))}</b>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-[14px] text-muted">No referral went through yet.</p>
        )}
      </div>
    </Sheet>
  );
}

/** One patient, laid out like the service cards (status tile, name, quote, tags). */
export function PatientCard({ r, onOpen }: { r: Referral; onOpen: () => void }) {
  const s = statusOf(r);
  const partial = partialNote(r);
  return (
    <button type="button" onClick={onOpen} className="press flex w-full items-start gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
      <InitialsAvatar name={r.patient.name} size={52} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[15px] font-semibold leading-snug text-ink">{r.patient.name}</span>
          <span className="shrink-0 whitespace-nowrap text-[14px] font-bold text-brand-600">{naira(quoteOf(r))}</span>
        </span>
        <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">
          {r.id}, {isToday(r.createdAt) ? new Date(r.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : shortDate(r.createdAt)}, {serviceSummary(r)}
        </span>
        {partial && <span className="mt-0.5 block text-[12.5px] font-medium text-[#b45309]">{partial}</span>}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={s} />
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand-700">
            {r.serviceIds.length} test{r.serviceIds.length === 1 ? '' : 's'}
          </span>
          {r.urgency === 'Urgent' && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[11.5px] font-semibold text-[#b42318]">Urgent</span>}
          {r.queued && <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[11.5px] font-medium text-ink-2">Waiting to send</span>}
        </span>
      </span>
    </button>
  );
}

const STAGE_TIME: Record<string, (r: Referral) => string | undefined> = { Requested: (r) => r.createdAt, Arrived: (r) => r.arrivedAt, TestsDone: (r) => r.testsDoneAt, ResultsReady: (r) => r.resultsAt };

export function ReferralDetails({ id }: { id: string }) {
  const detail = useDetail();
  const { referrals, showToast } = useApp();
  const updates = useBranchUpdates();
  const r = referrals.find((x) => x.id === id);
  if (!r)
    return (
      <>
        <ScreenHeader title="Request" />
        <EmptyState sticker="clipboard" title="Request not found" text={`You can only see your own patients, for ${RETENTION_DAYS} days after results.`} />
      </>
    );
  const s = statusOf(r);
  const update = updates[r.id.toUpperCase()];
  const at = STAGES.indexOf(s);
  const partial = partialNote(r);
  const tests = servicesOf(r);
  const notDone = new Set(r.doneServiceIds ? tests.filter((x) => !r.doneServiceIds!.includes(x.id)).map((x) => x.id) : []);
  const look = LOOK[s];
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <>
      <ScreenHeader title="Request Details" />

      {/* Hero: status, patient, referral ID and the four steps at a glance */}
      <section className={`relative mb-3.5 overflow-hidden rounded-[26px] bg-linear-to-br p-4 ring-1 ${look.hero}`}>
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/40" />
        <Sticker name={look.sticker} size={70} className="absolute right-3 top-3" />
        <span className={`relative inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold shadow-sm ${look.ink}`}>
          {look.icon} {STATUS_LABEL[s]}
        </span>
        <p className="relative mt-2.5 max-w-[72%] text-[23px] font-extrabold leading-tight tracking-[-0.01em] text-ink">{r.patient.name}</p>
        <p className="relative mt-0.5 text-[13px] text-ink-2">
          {[r.patient.gender, r.patient.age ? `${r.patient.age} years` : ''].filter(Boolean).join(', ') || 'Patient'} · {displayPhone(r.patient.phone)}
        </p>
        <div className="relative mt-3 flex items-center gap-2">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-2xl bg-white/85 px-3 py-2">
            <Hash size={15} className="shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-muted">Referral ID</span>
              <span className="block truncate text-[15.5px] font-bold tracking-wide text-brand-700">{r.id}</span>
            </span>
          </span>
          <button type="button" onClick={() => void copyText(r.id, 'Referral ID', showToast, { allow: true })} className="press flex min-h-11 items-center gap-1.5 rounded-2xl bg-white px-3 text-[13px] font-semibold text-brand-600 shadow-sm">
            <Copy size={15} /> Copy
          </button>
        </div>
        {s !== 'NotAttended' && (
          <div className="relative mt-3.5 grid grid-cols-4 gap-1.5" aria-hidden="true">
            {STAGES.map((st, i) => (
              <span key={st}>
                <span className={`block h-1.5 rounded-full ${i <= at ? look.bar : 'bg-white/70'}`} />
                <span className={`mt-1 block truncate text-[10.5px] font-semibold ${i <= at ? 'text-ink' : 'text-ink-2/60'}`}>{STATUS_LABEL[st]}</span>
              </span>
            ))}
          </div>
        )}
        <p className="relative mt-2.5 flex items-center gap-1.5 text-[12px] text-ink-2">
          <CalendarDays size={13} /> Requested {shortDate(r.createdAt)}, {timeOf(r.createdAt)} · {BRANCH.name} branch
        </p>
      </section>

      {s === 'ResultsReady' && (
        <button type="button" onClick={() => detail.open({ kind: 'result', id: r.id })} className="press mb-3.5 flex w-full items-center gap-3 rounded-[22px] bg-linear-to-br from-[#16a35a] to-[#0f7a43] p-4 text-left text-white shadow-[0_12px_26px_rgba(22,163,90,0.3)]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20">
            <FileText size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px]">Results are ready</b>
            <span className="block text-[12.5px] text-white/85">Signed off {when(r.resultsAt)}. For this patient’s care only.</span>
          </span>
          <ChevronRight size={20} />
        </button>
      )}

      {/* The branch's update on this patient: coming later, did not come, or cancelled. */}
      {update && (
        <div className="mb-3.5 flex items-start gap-3 rounded-[22px] bg-[#f6f2ff] p-4 ring-1 ring-[#e4dbff]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-violet shadow-sm">
            <MessageSquareText size={19} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-bold uppercase tracking-wide text-violet">Update from the branch · {BRANCH_UPDATE_LABEL[update.status]}</span>
            <span className="mt-0.5 block text-[14.5px] text-ink">{branchUpdateText(update)}</span>
            <span className="mt-0.5 block text-[12px] text-muted">
              {update.by.role} · {shortDate(update.at)}
            </span>
          </span>
        </div>
      )}

      {s === 'NotAttended' ? (
        <div className="mb-3.5 flex items-start gap-3 rounded-[22px] bg-page p-4 ring-1 ring-line/70">
          <UserX size={20} className="mt-0.5 shrink-0 text-ink-2" />
          <span>
            <b className="block text-[15px] text-ink">Not attended</b>
            <span className="text-[13.5px] text-ink-2">The patient didn’t come to the branch within {NOT_ATTENDED_DAYS} days of the request.</span>
          </span>
        </div>
      ) : (
        <section className="mb-3.5 rounded-[22px] bg-white p-4 shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
          <h2 className="mb-3 text-[16px] font-bold text-ink">Progress</h2>
          <ol className="relative ml-1">
            {STAGES.map((st, i) => {
              const done = i <= at;
              const now = i === at;
              const time = STAGE_TIME[st]!(r);
              return (
                <li key={st} className="relative flex gap-3.5 pb-4 last:pb-0">
                  {i < STAGES.length - 1 && <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-24px)] w-[2px] rounded-full ${i < at ? look.bar : 'bg-line'}`} />}
                  <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? `${look.dot} text-white` : 'bg-white text-faint ring-2 ring-line'} ${now ? 'ring-4 ring-white shadow-[0_0_0_6px_rgba(31,111,232,0.12)]' : ''}`}>{done ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                  <span className="min-w-0 pt-0.5">
                    <span className={`block text-[15px] font-semibold ${done ? 'text-ink' : 'text-faint'}`}>{STATUS_LABEL[st]}</span>
                    <span className="block text-[12.5px] text-muted">{done && time ? when(time) : STATUS_NOTE[st]}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Tests, like a receipt */}
      <section className="mb-3.5 overflow-hidden rounded-[22px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
        <h2 className="px-4 pt-4 text-[16px] font-bold text-ink">Tests requested · {tests.length}</h2>
        <ul className="mt-2 divide-y divide-dashed divide-line px-4">
          {tests.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2.5">
              <ServiceThumb service={x} className="h-10 w-10 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold leading-snug text-ink">{x.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  {x.category}
                  {notDone.has(x.id) && <span className="rounded-md bg-[#fff1e0] px-1.5 py-0.5 text-[11px] font-semibold text-[#b45309]">Not done</span>}
                </span>
              </span>
              <b className="shrink-0 text-[14.5px] text-ink">{priceText(x.price)}</b>
            </li>
          ))}
        </ul>
        {partial && <p className="mx-4 mb-1 rounded-xl bg-[#fff6e5] px-3 py-2 text-[13px] text-[#8a5a12]">{partial}.</p>}
        <div className="mt-2 flex items-center justify-between bg-page px-4 py-3">
          <span className="text-[14px] font-semibold text-ink-2">Quoted price</span>
          <b className="text-[18px] text-ink">{naira(quoteOf(r))}</b>
        </div>
        {r.priceAsk && (
          <p className="mx-4 mt-3 rounded-xl bg-[#faf7ff] px-3 py-2 text-[13px] text-violet ring-1 ring-[#e4dbff]">
            You asked for <b>{naira(r.priceAsk.amount)} off</b>: {r.priceAsk.reason}. The branch manager decides at billing.
          </p>
        )}
        <p className="px-4 pb-4 pt-2 text-[12px] text-muted">What the patient was told to expect. The final price is confirmed at the branch.</p>
      </section>

      <section className="mb-3.5 rounded-[22px] bg-white p-4 shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
        <h2 className="mb-2.5 flex items-center gap-2 text-[16px] font-bold text-ink">
          <Stethoscope size={18} className="text-brand-600" /> Clinical details
        </h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold ${r.urgency === 'Urgent' ? 'bg-[#ffe9e9] text-[#b42318]' : 'bg-page text-ink-2'}`}>
          {r.urgency === 'Urgent' && <Siren size={13} />} {r.urgency}
        </span>
        {r.indication ? (
          <p className="mt-2.5 rounded-2xl border-l-4 border-brand-400 bg-page px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">
            <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-muted">Reason for the tests</span>
            {r.indication}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-muted">No clinical reason was added.</p>
        )}
      </section>

      <ReferralNoteView id={r.id} note={r.note} voiceNote={r.voiceNote} />

      {r.queued && <p className="mb-3 flex items-center gap-1.5 text-[12.5px] text-muted"><ShieldCheck size={14} /> Saved on this phone (encrypted). It’s sent to the branch when the server is connected.</p>}
      {(s === 'Requested' || s === 'Arrived') && <PatientMessageButton r={r} />}
    </>
  );
}
