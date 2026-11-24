/** My Referrals (owner's reference) and one referral's details. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ClipboardList, Copy, Filter, Hash, Phone, Plus } from 'lucide-react';
import { BRANCH } from '@/config/org';
import { displayPhone, naira, shortDate } from '@/domain/format';
import { billOf, commissionOf, isEstimate, serviceSummary, servicesOf, type ReferralStatus } from '@/domain/referrals';
import { useApp } from '@/app/store';
import { Button, Card, Chip, ChipRow, EmptyState, FilterButton, InitialsAvatar, ScreenHeader, SearchField, StatusBadge, Subtitle, WhatsAppButton } from '@/ui/kit';
import { shareOnWhatsApp } from '@/domain/whatsapp';
import { priceText } from '@/screens/Services';

type FilterKey = 'All' | ReferralStatus;
const FILTERS: FilterKey[] = ['All', 'Pending', 'Arrived', 'Completed', 'Cancelled'];

/** Local calendar day of a date ("2026-11-23"). */
const dayKey = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const dayDate = (k: string) => new Date(`${k}T12:00:00`);
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayLabel(k: string) {
  const today = dayKey(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const d = dayDate(k);
  const date = `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
  return k === today ? `Today · ${date}` : k === dayKey(y) ? `Yesterday · ${date}` : `${date} ${d.getFullYear()}`;
}

/**
 * My Referrals (owner, 2026-11-23): a DAILY report — opens on today's
 * referrals; the day strip and calendar show any other day's work.
 * Searching looks across every day.
 */
export function MyReferrals() {
  const { referrals, navigate, route } = useApp();
  const today = dayKey(new Date());
  const [day, setDay] = useState<string>(route.query.get('day') ?? today);
  const [q, setQ] = useState('');
  const [f, setF] = useState<FilterKey>('All');
  const [newestFirst, setNewestFirst] = useState(true);
  const picker = useRef<HTMLInputElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  // Referrals per day (for the strip's counts).
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of referrals) m.set(dayKey(r.createdAt), (m.get(dayKey(r.createdAt)) ?? 0) + 1);
    return m;
  }, [referrals]);
  // The last 14 days, today on the right (like a calendar strip).
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(dayKey(d));
    }
    if (!out.includes(day)) out.unshift(day);
    return out;
  }, [day]);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [day]);

  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, '');
  const searching = t.length > 0;
  const ofDay = useMemo(() => referrals.filter((r) => searching || dayKey(r.createdAt) === day), [referrals, day, searching]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: ofDay.length };
    for (const r of ofDay) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [ofDay]);
  const list = ofDay
    .filter((r) => f === 'All' || r.status === f)
    .filter((r) => !t || r.patient.name.toLowerCase().includes(t) || r.id.toLowerCase().includes(t) || (digits.length >= 3 && (r.patient.phone.includes(digits) || r.id.includes(digits))) || serviceSummary(r).toLowerCase().includes(t))
    .sort((a, b) => (newestFirst ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
  const live = ofDay.filter((r) => r.status !== 'Cancelled');
  const summary = {
    referred: live.length,
    arrived: live.filter((r) => r.status === 'Arrived' || r.status === 'Completed').length,
    completed: live.filter((r) => r.status === 'Completed').length,
    commission: live.reduce((s, r) => s + commissionOf(r), 0),
  };
  const pick = (k: string) => {
    setDay(k);
    setF('All');
  };

  return (
    <>
      <ScreenHeader
        title="My Referrals"
        back={false}
        right={
          <button type="button" onClick={() => picker.current?.showPicker?.() ?? picker.current?.click()} aria-label="Pick a day" className="press grid h-11 w-11 place-items-center rounded-full bg-white text-brand-600 shadow-[0_4px_12px_rgba(30,74,160,0.1)] ring-1 ring-line">
            <CalendarDays size={20} />
          </button>
        }
      />
      <input ref={picker} type="date" max={today} value={day} onChange={(e) => e.target.value && pick(e.target.value)} className="sr-only" aria-label="Pick a day" tabIndex={-1} />
      <Subtitle>Your daily referral report. Pick a day to see that day’s work.</Subtitle>

      {/* Day strip */}
      <div ref={strip} className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
        {days.map((k) => {
          const d = dayDate(k);
          const on = k === day && !searching;
          const n = perDay.get(k) ?? 0;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => pick(k)} className={`press flex w-[58px] shrink-0 flex-col items-center rounded-[18px] py-2.5 ${on ? 'bg-brand-600 text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)]' : 'bg-white text-ink ring-1 ring-line'}`}>
              <span className={`text-[11.5px] font-medium ${on ? 'text-white/85' : 'text-muted'}`}>{k === today ? 'Today' : WEEKDAY[d.getDay()]}</span>
              <span className="text-[19px] font-bold leading-tight">{d.getDate()}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${n ? (on ? 'bg-white' : 'bg-brand-500') : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>

      {/* Day summary */}
      <section className="mb-4 rounded-[22px] bg-linear-to-br from-brand-600 to-brand-800 p-4 text-white shadow-[0_14px_30px_rgba(31,111,232,0.28)]">
        <p className="text-[13px] font-medium text-white/80">{searching ? `Search results across all days` : dayLabel(day)}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            ['Referred', String(summary.referred)],
            ['Arrived', String(summary.arrived)],
            ['Completed', String(summary.completed)],
            ['Est. comm.', naira(summary.commission)],
          ].map(([l, v]) => (
            <div key={l} className="min-w-0">
              <p className={`truncate font-bold leading-tight ${v!.length > 6 ? 'text-[15px]' : 'text-[22px]'}`}>{v}</p>
              <p className="text-[11.5px] text-white/75">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4 flex gap-3">
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all days by name, phone or ID..." aria-label="Search referrals" />
        <FilterButton onClick={() => setNewestFirst((v) => !v)} label={newestFirst ? 'Showing newest first, tap for oldest first' : 'Showing oldest first, tap for newest first'} icon={<Filter size={21} />} />
      </div>
      <ChipRow>
        {FILTERS.filter((x) => x === 'All' || counts[x]).map((x) => (
          <Chip key={x} active={f === x} onClick={() => setF(x)}>
            {x} ({counts[x] ?? 0})
          </Chip>
        ))}
      </ChipRow>

      {list.length === 0 ? (
        <EmptyState
          sticker="clipboard"
          title={searching ? 'No matching referrals' : `No referrals ${day === today ? 'yet today' : 'on this day'}`}
          text={searching ? 'Try another name, phone number or referral ID.' : day === today ? 'Patients you refer today will appear here with their status.' : `You didn’t send any referrals on ${dayLabel(day)}. Pick another day above.`}
          action={
            day === today && !searching ? (
              <Button onClick={() => navigate('/refer')}>
                <Plus size={19} /> Refer a Patient
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => navigate(`/referrals/${r.id}`)} className="card press flex w-full items-start gap-3.5 p-4 text-left">
                <InitialsAvatar name={r.patient.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16.5px] font-bold text-ink">{r.patient.name}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted">
                    <Hash size={14} /> {r.id}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13.5px] text-muted">
                    <ClipboardList size={14} className="shrink-0" /> {serviceSummary(r)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={r.status} />
                  <span className="text-[13px] text-muted">{searching ? shortDate(r.createdAt) : new Date(r.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`text-[16px] font-bold ${r.status === 'Cancelled' ? 'text-faint line-through' : r.status === 'Pending' ? 'text-orange' : 'text-good'}`}>
                    {isEstimate(r) && r.status === 'Pending' ? 'Est. ' : ''}
                    {naira(commissionOf(r))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const STAGES: ReferralStatus[] = ['Pending', 'Arrived', 'Completed'];
const STAGE_TEXT: Record<string, string> = {
  Pending: 'Referral sent, waiting for the patient to visit',
  Arrived: 'Patient arrived at the branch',
  Completed: 'Tests completed and paid, commission confirmed',
};

export function ReferralDetails({ id }: { id: string }) {
  const { referrals, showToast } = useApp();
  const r = referrals.find((x) => x.id === id);
  if (!r)
    return (
      <>
        <ScreenHeader title="Referral" />
        <EmptyState sticker="clipboard" title="Referral not found" text="Check the referral ID and try again." />
      </>
    );
  const at = STAGES.indexOf(r.status);
  return (
    <>
      <ScreenHeader title="Referral Details" />
      <Card className="mb-3.5 p-5">
        <div className="flex items-center gap-3.5">
          <InitialsAvatar name={r.patient.name} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-bold text-ink">{r.patient.name}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(r.id);
                  showToast('Referral ID copied');
                } catch {
                  showToast(r.id);
                }
              }}
              className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold text-brand-600"
            >
              {r.id} <Copy size={14} />
            </button>
          </div>
          <StatusBadge status={r.status} />
        </div>
        <div className="mt-4 space-y-1.5 text-[15px] text-ink-2">
          <p className="flex items-center gap-2.5">
            <Phone size={17} className="text-muted" /> {displayPhone(r.patient.phone)}
          </p>
          <p className="flex items-center gap-2.5">
            <CalendarDays size={17} className="text-muted" /> Referred {shortDate(r.createdAt)} · {BRANCH.name} branch
          </p>
        </div>
      </Card>

      {r.status !== 'Cancelled' && (
        <Card className="mb-3.5 p-5">
          <h2 className="mb-4 text-[17px] font-bold text-ink">Progress</h2>
          <ol className="space-y-4">
            {STAGES.map((s, i) => {
              const done = i <= at;
              return (
                <li key={s} className="flex items-start gap-3.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? 'bg-brand-600 text-white' : 'border-2 border-[#d7dfeb] text-faint'}`}>{done ? <Check size={17} strokeWidth={3} /> : i + 1}</span>
                  <span>
                    <span className={`block text-[15.5px] font-semibold ${done ? 'text-ink' : 'text-faint'}`}>{s}</span>
                    <span className="block text-[13.5px] text-muted">{STAGE_TEXT[s]}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Card className="mb-3.5 p-5">
        <h2 className="mb-3 text-[17px] font-bold text-ink">Services ({servicesOf(r).length})</h2>
        <ul className="space-y-2.5">
          {servicesOf(r).map((s) => (
            <li key={s.id} className="flex justify-between gap-3 text-[15.5px]">
              <span className="text-ink">{s.name}</span>
              <span className="font-semibold text-ink">{priceText(s.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3.5 flex justify-between border-t border-line pt-3.5 text-[16px]">
          <span className="text-ink">Patient bill</span>
          <span className="font-bold text-ink">{naira(billOf(r))}</span>
        </div>
      </Card>

      <div className={`flex items-center justify-between rounded-[20px] border p-4 ${r.status === 'Completed' ? 'border-[#c8ecd7] bg-tint-green' : 'border-[#ffe2c6] bg-tint-orange'}`}>
        <span className={`text-[15px] font-medium ${r.status === 'Completed' ? 'text-good-ink' : 'text-warn-ink'}`}>{r.status === 'Completed' ? (r.paidAt ? 'Commission paid' : 'Commission confirmed') : r.status === 'Cancelled' ? 'No commission' : 'Estimated commission'}</span>
        <span className={`text-[22px] font-bold ${r.status === 'Completed' ? 'text-good-ink' : 'text-warn-ink'}`}>{naira(r.status === 'Cancelled' ? 0 : commissionOf(r))}</span>
      </div>
      {r.queued && <p className="mt-3 text-[12.5px] text-muted">Saved on this phone, sent to the branch automatically when the cloud connection is available.</p>}
      {r.status === 'Pending' && (
        <div className="mt-4">
          <WhatsAppButton onClick={() => shareOnWhatsApp(r)}>Send referral to patient on WhatsApp</WhatsAppButton>
        </div>
      )}
    </>
  );
}
