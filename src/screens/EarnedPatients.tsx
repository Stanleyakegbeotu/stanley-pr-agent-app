/**
 * Patients who earned you commission (owner, 2026-11-24), on My Earnings.
 *  • Totals: earned today, this month, and overall.
 *  • Filter by day or by month (step with ‹ › or pick a date), or all time.
 *  • The patients behind the figure, 5 per page, so the page never gets long.
 * "Earned" = billing completed at the branch (status Completed); the date is
 * when the branch completed it. Cancelled and submitted referrals earn nothing yet.
 */
import { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useApp } from '@/app/store';
import { naira } from '@/domain/format';
import { commissionOf, serviceSummary, type Referral } from '@/domain/referrals';
import { InitialsAvatar, Segmented } from '@/ui/kit';

type Mode = 'day' | 'month' | 'all';
const PAGE = 5;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
/** When the commission was earned: when the branch completed billing. */
const earnedAt = (r: Referral) => new Date(r.updatedAt ?? r.createdAt);

function dayTitle(k: string) {
  const today = dayKey(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const d = new Date(`${k}T12:00:00`);
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return k === today ? `Today, ${date}` : k === dayKey(y) ? `Yesterday, ${date}` : date;
}
const monthTitle = (k: string) => `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}${k === monthKey(new Date()) ? ' (this month)' : ''}`;

export function EarnedPatients() {
  const { referrals, navigate } = useApp();
  const now = new Date();
  const [mode, setMode] = useState<Mode>('day');
  const [day, setDay] = useState(dayKey(now));
  const [month, setMonth] = useState(monthKey(now));
  const [page, setPage] = useState(0);
  const picker = useRef<HTMLInputElement>(null);

  const earned = useMemo(() => referrals.filter((r) => r.status === 'Completed').sort((a, b) => earnedAt(b).getTime() - earnedAt(a).getTime()), [referrals]);
  const sum = (list: Referral[]) => list.reduce((s, r) => s + commissionOf(r), 0);
  const todayList = earned.filter((r) => dayKey(earnedAt(r)) === dayKey(now));
  const monthList = earned.filter((r) => monthKey(earnedAt(r)) === monthKey(now));

  const list = mode === 'all' ? earned : mode === 'day' ? earned.filter((r) => dayKey(earnedAt(r)) === day) : earned.filter((r) => monthKey(earnedAt(r)) === month);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * PAGE, at * PAGE + PAGE);

  const step = (by: number) => {
    setPage(0);
    if (mode === 'day') {
      const d = new Date(`${day}T12:00:00`);
      d.setDate(d.getDate() + by);
      setDay(dayKey(d));
    } else {
      const d = new Date(`${month}-15T12:00:00`);
      d.setMonth(d.getMonth() + by);
      setMonth(monthKey(d));
    }
  };
  const atLatest = mode === 'day' ? day >= dayKey(now) : month >= monthKey(now);
  const title = mode === 'all' ? 'All time' : mode === 'day' ? dayTitle(day) : monthTitle(month);

  return (
    <section className="mb-5">
      <h2 className="mb-1 text-[17px] font-bold text-ink">Patients who earned you commission</h2>
      <p className="mb-3 text-[13.5px] leading-snug text-muted">Commission is earned when the branch completes the patient’s billing.</p>

      {/* Totals */}
      <div className="mb-3.5 grid grid-cols-3 gap-2.5">
        <Total label="Earned today" value={sum(todayList)} note={`${todayList.length} patient${todayList.length === 1 ? '' : 's'}`} tone="from-[#eaf3ff] to-[#dceaff] text-brand-700" />
        <Total label="This month" value={sum(monthList)} note={`${monthList.length} patient${monthList.length === 1 ? '' : 's'}`} tone="from-[#ecfbf2] to-[#d9f3e4] text-good-ink" />
        <Total label="Overall" value={sum(earned)} note={`${earned.length} patient${earned.length === 1 ? '' : 's'}`} tone="from-[#f3eeff] to-[#e6dcff] text-violet" />
      </div>

      {/* Filter */}
      <Segmented<Mode>
        value={mode}
        onChange={(m) => (setMode(m), setPage(0))}
        options={[
          { value: 'day', label: 'By day' },
          { value: 'month', label: 'By month' },
          { value: 'all', label: 'All time' },
        ]}
      />
      {mode !== 'all' && (
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label={mode === 'day' ? 'Previous day' : 'Previous month'} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm ring-1 ring-line">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => picker.current?.showPicker?.() ?? picker.current?.click()} className="press flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white px-3 text-[14.5px] font-semibold text-ink shadow-sm ring-1 ring-line">
            <CalendarDays size={17} className="shrink-0 text-brand-600" />
            <span className="truncate">{title}</span>
          </button>
          <button type="button" onClick={() => step(1)} disabled={atLatest} aria-label={mode === 'day' ? 'Next day' : 'Next month'} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm ring-1 ring-line disabled:opacity-35">
            <ChevronRight size={20} />
          </button>
          <input
            ref={picker}
            type={mode === 'day' ? 'date' : 'month'}
            max={mode === 'day' ? dayKey(now) : monthKey(now)}
            value={mode === 'day' ? day : month}
            onChange={(e) => {
              if (!e.target.value) return;
              setPage(0);
              if (mode === 'day') setDay(e.target.value);
              else setMonth(e.target.value);
            }}
            className="sr-only"
            tabIndex={-1}
            aria-label={mode === 'day' ? 'Pick a day' : 'Pick a month'}
          />
        </div>
      )}

      {/* Selection total + patients */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-page/60 px-4 py-3.5">
          <span className="min-w-0">
            <span className="block text-[13px] text-muted">Earned, {mode === 'all' ? 'all time' : title.replace(' (this month)', '')}</span>
            <span className="block text-[22px] font-bold leading-tight text-good-ink">{naira(sum(list))}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-ink-2 ring-1 ring-line">
            {list.length} patient{list.length === 1 ? '' : 's'}
          </span>
        </div>
        {list.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-tint-blue text-brand-600">
              <Wallet size={22} />
            </span>
            <p className="mt-2.5 text-[15px] font-bold text-ink">No commission earned {mode === 'day' ? 'on this day' : mode === 'month' ? 'in this month' : 'yet'}</p>
            <p className="mt-1 text-[13px] text-muted">{mode === 'all' ? 'Completed referrals will appear here.' : `Try another ${mode === 'day' ? 'day' : 'month'}.`}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => navigate(`/referrals/${r.id}`)} className="press flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <InitialsAvatar name={r.patient.name} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{r.patient.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {r.id}, {mode === 'day' ? earnedAt(r).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : earnedAt(r).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted">{serviceSummary(r)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[15.5px] font-bold text-good">{naira(commissionOf(r))}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${r.paidAt ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{r.paidAt ? 'Paid' : 'Payout due'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
            <button type="button" onClick={() => setPage(at - 1)} disabled={at === 0} className="press flex h-10 items-center gap-1 rounded-full px-3 text-[14px] font-semibold text-brand-600 disabled:text-faint">
              <ChevronLeft size={17} /> Previous
            </button>
            <span className="text-[13px] text-muted">
              {at * PAGE + 1} to {Math.min(list.length, at * PAGE + PAGE)} of {list.length}
            </span>
            <button type="button" onClick={() => setPage(at + 1)} disabled={at >= pages - 1} className="press flex h-10 items-center gap-1 rounded-full px-3 text-[14px] font-semibold text-brand-600 disabled:text-faint">
              Next <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Total({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  const v = naira(value);
  return (
    <div className={`min-w-0 rounded-[18px] bg-linear-to-br p-3 ${tone}`}>
      <p className="text-[12px] font-medium text-ink-2">{label}</p>
      <p className={`mt-1 truncate font-bold leading-tight ${v.length > 8 ? 'text-[15px]' : 'text-[18px]'}`}>{v}</p>
      <p className="mt-0.5 text-[11.5px] text-muted">{note}</p>
    </div>
  );
}
