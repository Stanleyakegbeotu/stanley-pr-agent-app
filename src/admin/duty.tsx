/**
 * Front desk duty rota per branch (owner, 2026-11-25). Front desk staff work
 * in shifts: ONE person is on seat each day, and it never changes for a day
 * once set, so for any day's report the admin or manager knows who was on
 * seat and who to ask. The same rota decides who the shared Front Desk inbox
 * reaches and who "processed" a visit (admin/people.ts).
 *
 * The desktop doesn't record shifts yet, so the rota is one person per day in
 * Staff Management order; when front desk sign-in exists, the person signed in
 * at the front desk that day replaces it.
 */
import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronRight, MessageCircle } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { addDays, DATA_START, TODAY } from '@company/data/demo/generator';
import { expenseLines, patientVisits } from '@company/data/demo/dailyLines';
import type { DateRange } from '@company/data/types';
import { formatCount, formatMoney } from '@company/shared/format';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { Sheet } from './ui';
import { FocusSheet, Rows, useRowCtx, visitRow, type Focus } from './details';
import { SectionTitle } from './kit';
import { frontDeskId } from './chat';
import { useTeam, type Who } from './people';
import { StaffSheetByName } from './pages/Staff';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => iso(a) === iso(b);
const dayRange = (d: Date): DateRange => ({ from: d, to: d, days: 1 });

function Face({ who, size }: { who: Who; size: number }) {
  return who.photo ? <img src={who.photo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} /> : <InitialsAvatar name={who.name} size={size} />;
}

export function DutyRota({ branchId }: { branchId: string }) {
  const team = useTeam();
  const { navigate } = useCompany();
  const [day, setDay] = useState<Date | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const today = TODAY;
  const desk = team.frontDesk(branchId);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i - 9)), [today]);
  const onSeat = team.onDuty(branchId, today);
  if (!desk.length)
    return (
      <>
        {profile && <StaffSheetByName name={profile} onClose={() => setProfile(null)} />}
      <SectionTitle title="Front desk on seat" />
        <div className="flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
          <Sticker name="calendar" size={40} />
          <p className="text-[14px] text-muted">No front desk staff at this branch yet. Add them in Staff Management.</p>
        </div>
      </>
    );
  return (
    <>
      <SectionTitle title="Front desk on seat" />
      <div className="rounded-[22px] bg-white p-3.5 shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
        {onSeat && (
          <button type="button" onClick={() => setDay(today)} className="press flex w-full items-center gap-3 rounded-2xl bg-linear-to-br from-[#e6f8ee] to-[#cfeedd] p-3 text-left">
            <span className="relative">
              <Face who={onSeat} size={54} />
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#22c55e] ring-2 ring-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-good-ink">On seat today</span>
              <span className="block truncate text-[16px] font-bold text-ink">{onSeat.name}</span>
              <span className="block text-[12.5px] text-ink-2">{onSeat.role} · see today’s work</span>
              <span role="button" tabIndex={0} onClick={(e) => (e.stopPropagation(), setProfile(onSeat.name))} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), setProfile(onSeat.name))} className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-semibold text-brand-600 shadow-sm">
                View profile <ChevronRight size={12} />
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => (e.stopPropagation(), navigate(`/messages/${frontDeskId(branchId)}`))}
              onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), navigate(`/messages/${frontDeskId(branchId)}`))}
              aria-label={`Message ${onSeat.name}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-600 shadow-sm"
            >
              <MessageCircle size={18} />
            </span>
          </button>
        )}
        <p className="mb-2 mt-3 flex items-center justify-between px-1 text-[12.5px] font-semibold text-ink-2">
          Who was on seat each day
          <span className="relative">
            <button type="button" onClick={() => (picker.current?.showPicker ? picker.current.showPicker() : picker.current?.focus())} className="press flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 font-semibold text-brand-600">
              <CalendarDays size={15} /> Any date
            </button>
            <input ref={picker} type="date" min={iso(DATA_START)} max={iso(addDays(today, 30))} onChange={(e) => e.target.value && setDay(new Date(`${e.target.value}T00:00:00`))} className="pointer-events-none absolute inset-0 opacity-0" tabIndex={-1} aria-hidden="true" />
          </span>
        </p>
        <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1">
          {days.map((d) => {
            const p = team.onDuty(branchId, d);
            const isToday = sameDay(d, today);
            const future = d > today;
            return (
              <button key={iso(d)} type="button" onClick={() => setDay(d)} className={`press flex w-[74px] shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 ${isToday ? 'bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]' : future ? 'bg-page text-ink-2 ring-1 ring-dashed ring-line' : 'bg-page text-ink'}`}>
                <span className={`text-[11px] font-semibold ${isToday ? 'text-white/90' : 'text-muted'}`}>{isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="text-[13px] font-bold">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                {p ? <Face who={p} size={32} /> : <span className="h-8 w-8 rounded-full bg-white" />}
                <span className="w-full truncate text-center text-[11.5px] font-medium">{p?.name.split(' ')[0] ?? 'No one'}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11.5px] leading-snug text-muted">One front desk person is on seat each day, and the day’s visits and records carry their name. Tap a day to see who was on seat and what they handled.</p>
      </div>
      {day && <DaySheet branchId={branchId} day={day} onClose={() => setDay(null)} />}
    </>
  );
}

/** One day at the branch: who was on seat, and the visits and expenses of that day. */
function DaySheet({ branchId, day, onClose }: { branchId: string; day: Date; onClose: () => void }) {
  const team = useTeam();
  const { navigate } = useCompany();
  const [focus, setFocus] = useState<Focus | null>(null);
  const ctx = useRowCtx(setFocus);
  const branch = getBranch(branchId);
  const c = branch?.currency ?? 'NGN';
  const p = team.onDuty(branchId, day);
  const mgr = team.manager(branchId);
  const future = day > TODAY;
  const before = day < DATA_START;
  const visits = useMemo(() => (future || before ? [] : patientVisits([branchId], dayRange(day))), [branchId, day, future, before]);
  const expenses = useMemo(() => (future || before ? [] : expenseLines([branchId], dayRange(day))), [branchId, day, future, before]);
  const byThem = visits.filter((v) => team.processedBy(v)?.name === p?.name);
  const billed = visits.reduce((s, v) => s + v.billed, 0);
  const paid = visits.reduce((s, v) => s + v.paid, 0);
  const label = day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Sheet
      title={sameDay(day, TODAY) ? 'Today at the front desk' : label}
      subtitle={`${branch?.name ?? ''} branch`}
      onClose={onClose}
      tall={visits.length > 3}
      footer={
        p && !future ? (
          <button type="button" onClick={() => navigate(`/messages/${frontDeskId(branchId)}`)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            <MessageCircle size={18} /> Message the front desk
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 flex items-center gap-3 rounded-[22px] bg-linear-to-br from-[#e6f8ee] to-[#cfeedd] p-4">
        {p ? <Face who={p} size={58} /> : <Sticker name="calendar" size={58} />}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-good-ink">{future ? 'Scheduled on seat' : 'On seat that day'}</p>
          <p className="truncate text-[18px] font-bold text-ink">{p?.name ?? 'No one on the rota'}</p>
          <p className="text-[12.5px] text-ink-2">{p ? `${p.role} · ${branch?.name} branch` : 'Add front desk staff in Staff Management'}</p>
          {mgr && <p className="mt-0.5 text-[12px] text-muted">Branch manager: {mgr.name}</p>}
          {p && (
            <button type="button" onClick={() => setFocus({ kind: 'staff', name: p.name })} className="press mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-brand-600 shadow-sm">
              View {p.name.split(' ')[0]}’s profile <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {future ? (
        <p className="px-3 py-6 text-center text-[13.5px] text-muted">This day hasn’t happened yet. {p ? `${p.name} is on the rota for it.` : ''}</p>
      ) : before ? (
        <p className="px-3 py-6 text-center text-[13.5px] text-muted">Records begin on {DATA_START.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Stat label="Patients" value={formatCount(visits.length)} sub={p ? `${formatCount(byThem.length)} by ${p.name.split(' ')[0]}` : undefined} />
            <Stat label="Billed" value={formatMoney(billed, c, true)} />
            <Stat label="Paid at visit" value={formatMoney(paid, c, true)} />
          </div>
          {expenses.length > 0 && (
            <div className="mb-3 rounded-[20px] bg-white p-3 ring-1 ring-line/70">
              <p className="mb-1.5 px-1 text-[13px] font-semibold text-ink-2">Expenses that day</p>
              {expenses.map((e) => {
                const who = team.expensePeople(e);
                return (
                  <div key={e.id} className="flex items-start justify-between gap-3 px-1 py-1.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{e.description}</span>
                      <span className="block truncate text-[11.5px] text-muted">Recorded by {who.recordedBy ? `${who.recordedBy.name}, ${who.recordedBy.role}` : 'name not on record'}</span>
                    </span>
                    <b className="shrink-0 text-ink">{formatMoney(e.amount, c, true)}</b>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mb-2 flex items-center justify-between px-1 text-[13px] font-semibold text-ink-2">
            Patients that day <ChevronRight size={15} className="text-faint" />
          </p>
          <Rows rows={visits.map((v) => visitRow(v, ctx))} oneDay multi={false} empty="No patient visits that day." />
        </>
      )}
      {focus && <FocusSheet focus={focus} branchIds={[branchId]} period={{ key: 'custom', from: iso(day), to: iso(day) }} onClose={() => setFocus(null)} />}
    </Sheet>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3 ring-1 ring-line/70">
      <p className="truncate text-[11.5px] text-muted">{label}</p>
      <p className="truncate text-[17px] font-bold text-ink">{value}</p>
      {sub && <p className="truncate text-[11px] text-good-ink">{sub}</p>}
    </div>
  );
}
