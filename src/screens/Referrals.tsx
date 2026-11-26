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
import { CalendarDays, Check, ChevronRight, Eye, FileText, Hash, Phone, Plus, Siren, Stethoscope } from 'lucide-react';
import { BRANCH } from '@/config/org';
import { displayPhone, naira, shortDate } from '@/domain/format';
import { NOT_ATTENDED_DAYS, RETENTION_DAYS, STAGES, STATUS_LABEL, STATUS_NOTE, countsFor, inMonth, isToday, partialNote, quoteOf, serviceSummary, servicesOf, statusOf, type Referral, type ReferralStatus } from '@/domain/referrals';
import { useApp } from '@/app/store';
import { Button, Card, Chip, ChipRow, EmptyState, InitialsAvatar, ScreenHeader, SearchField, Segmented, StatusBadge, Sticker, Subtitle } from '@/ui/kit';
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
  const { referrals, navigate } = useApp();
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
  return (
    <>
      <ScreenHeader title="Request Details" />
      <Card className="mb-3.5 p-5">
        <div className="flex items-center gap-3.5">
          <InitialsAvatar name={r.patient.name} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold text-ink">{r.patient.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold text-brand-600">
              <Hash size={14} /> {r.id}
            </p>
          </div>
          <StatusBadge status={s} />
        </div>
        <div className="mt-4 space-y-1.5 text-[15px] text-ink-2">
          <p className="flex items-center gap-2.5">
            <Phone size={17} className="text-muted" /> {displayPhone(r.patient.phone)}
          </p>
          <p className="flex items-center gap-2.5">
            <CalendarDays size={17} className="text-muted" /> Requested {shortDate(r.createdAt)}, {BRANCH.name} branch
          </p>
        </div>
      </Card>

      {/* The branch's update on this patient (owner, 2026-11-25): coming later, did not come, or cancelled. */}
      {update && (
        <div className="mb-3.5 rounded-[20px] border border-[#e4dbff] bg-[#f6f2ff] p-4">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-violet">Update from the branch · {BRANCH_UPDATE_LABEL[update.status]}</p>
          <p className="mt-1 text-[15px] text-ink">{branchUpdateText(update)}</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {update.by.role} · {shortDate(update.at)}
          </p>
        </div>
      )}

      {s === 'ResultsReady' && (
        <Button block className="mb-3.5" onClick={() => detail.open({ kind: 'result', id: r.id })}>
          <FileText size={19} /> View results
        </Button>
      )}

      {s === 'NotAttended' ? (
        <div className="mb-3.5 rounded-[20px] border border-[#ffe2c6] bg-tint-orange p-4">
          <p className="text-[15.5px] font-bold text-warn-ink">Not attended</p>
          <p className="mt-0.5 text-[14px] text-warn-ink">The patient didn’t come to the branch within {NOT_ATTENDED_DAYS} days of the request.</p>
        </div>
      ) : (
        <Card className="mb-3.5 p-5">
          <h2 className="mb-4 text-[17px] font-bold text-ink">Progress</h2>
          <ol className="space-y-4">
            {STAGES.map((st, i) => {
              const done = i <= at;
              const time = STAGE_TIME[st]!(r);
              return (
                <li key={st} className="flex items-start gap-3.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? 'bg-brand-600 text-white' : 'border-2 border-[#d7dfeb] text-faint'}`}>{done ? <Check size={17} strokeWidth={3} /> : i + 1}</span>
                  <span>
                    <span className={`block text-[15.5px] font-semibold ${done ? 'text-ink' : 'text-faint'}`}>{STATUS_LABEL[st]}</span>
                    <span className="block text-[13.5px] text-muted">{done && time ? new Date(time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : STATUS_NOTE[st]}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Card className="mb-3.5 p-5">
        <h2 className="mb-3 text-[17px] font-bold text-ink">Tests requested ({tests.length})</h2>
        <ul className="space-y-2.5">
          {tests.map((x) => (
            <li key={x.id} className="flex justify-between gap-3 text-[15.5px]">
              <span>
                <span className="text-ink">{x.name}</span>
                {notDone.has(x.id) && <span className="ml-2 rounded-md bg-[#fff1e0] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#b45309]">Not done</span>}
              </span>
              <span className="font-semibold text-ink">{priceText(x.price)}</span>
            </li>
          ))}
        </ul>
        {partial && <p className="mt-3 rounded-xl bg-[#fff6e5] px-3 py-2 text-[13.5px] text-[#8a5a12]">{partial}.</p>}
        <div className="mt-3.5 flex justify-between border-t border-line pt-3.5 text-[16px]">
          <span className="text-ink">Quoted price</span>
          <span className="font-bold text-ink">{naira(quoteOf(r))}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted">What the patient was told to expect. The final price is confirmed at the branch.</p>
      </Card>

      <Card className="mb-3.5 p-5">
        <h2 className="mb-2 flex items-center gap-2.5 text-[17px] font-bold text-ink">
          <Stethoscope size={19} className="text-brand-600" /> Clinical details
        </h2>
        <p className="flex items-center gap-2 text-[14.5px] text-ink-2">
          {r.urgency === 'Urgent' && <Siren size={16} className="text-[#d93036]" />} Urgency: <b className="text-ink">{r.urgency}</b>
        </p>
        {r.indication && (
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">
            Reason for tests: <span className="text-ink">{r.indication}</span>
          </p>
        )}
      </Card>

      <ReferralNoteView id={r.id} note={r.note} voiceNote={r.voiceNote} />

      {r.queued && <p className="mb-3 text-[12.5px] text-muted">Saved on this phone (encrypted). It’s sent to the branch when the server is connected.</p>}
      {(s === 'Requested' || s === 'Arrived') && <PatientMessageButton r={r} />}
    </>
  );
}
