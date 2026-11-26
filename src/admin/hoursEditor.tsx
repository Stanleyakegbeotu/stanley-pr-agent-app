/**
 * Opening hours and Google Maps link fields (owner, 2026-11-26), for the
 * Company Admin and the Branch Manager in the branch settings (same data as
 * the desktop: company settings, openingHours). PR agents' messages to
 * patients carry both.
 */
import { MapPin } from 'lucide-react';
import { DAY_NAMES, WEEK_ORDER, weekText, type DayHours, type WeekHours } from '@company/services/openingHours';
import { FieldErr, FieldLabel, inputCls } from './prManage';

type Mode = 'hours' | 'allDay' | 'closed';
const modeOf = (d: DayHours): Mode => (!d.open ? 'closed' : d.allDay ? 'allDay' : 'hours');
const MODES: [Mode, string][] = [
  ['hours', 'Open'],
  ['allDay', '24 hours'],
  ['closed', 'Closed'],
];

export function WeekHoursEditor({ value, onChange, error }: { value: WeekHours; onChange: (w: WeekHours) => void; error?: string | null }) {
  const setDay = (i: number, patch: Partial<DayHours>) => onChange({ ...value, days: value.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  return (
    <div>
      <button type="button" role="switch" aria-checked={value.always} onClick={() => onChange({ ...value, always: !value.always })} className="press flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70">
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] text-ink">Open 24 hours, 7 days a week</b>
          <span className="block text-[12.5px] text-muted">Turn off to set each day</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${value.always ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value.always ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>
      {!value.always && (
        <ul className="mt-2 divide-y divide-line/60 rounded-2xl bg-white px-3 ring-1 ring-line/70">
          {WEEK_ORDER.map((i) => {
            const d = value.days[i]!;
            const mode = modeOf(d);
            return (
              <li key={i} className="py-2.5">
                <div className="flex items-center gap-2">
                  <b className={`w-[92px] shrink-0 text-[14px] ${mode === 'closed' ? 'text-muted' : 'text-ink'}`}>{DAY_NAMES[i]}</b>
                  <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-page p-0.5" role="radiogroup" aria-label={DAY_NAMES[i]}>
                    {MODES.map(([m, l]) => (
                      <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setDay(i, { open: m !== 'closed', allDay: m === 'allDay' })} className={`press min-h-8 rounded-[10px] text-[12px] font-semibold ${mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-2'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {mode === 'hours' && (
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input type="time" aria-label={`${DAY_NAMES[i]} opens`} value={d.from} onChange={(e) => setDay(i, { from: e.target.value })} className={`${inputCls()} !min-h-10 !px-3 !py-1.5 !text-[14px]`} />
                    <span className="text-[12.5px] text-muted">to</span>
                    <input type="time" aria-label={`${DAY_NAMES[i]} closes`} value={d.to} onChange={(e) => setDay(i, { to: e.target.value })} className={`${inputCls()} !min-h-10 !px-3 !py-1.5 !text-[14px]`} />
                  </div>
                )}
                {i === 1 && (
                  <button type="button" onClick={() => onChange({ ...value, days: value.days.map((x, j) => (j >= 2 && j <= 6 ? { ...value.days[1]! } : x)) })} className="mt-1.5 text-[12.5px] font-semibold text-brand-600">
                    Same for Tuesday to Saturday
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 rounded-xl bg-[#f6f9ff] px-3 py-2 text-[12.5px] text-ink-2">
        Patients see: <b className="text-ink">{weekText(value)}</b>
      </p>
      <FieldErr msg={error ?? null} />
    </div>
  );
}

export function MapLinkInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <label className="block">
      <FieldLabel label="Google Maps link" required />
      <span className="relative block">
        <MapPin size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input type="url" inputMode="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://maps.app.goo.gl/..." className={`${inputCls(error)} pl-10`} />
      </span>
      {error ? <FieldErr msg={error} /> : <span className="mt-1 block text-[12px] text-muted">In Google Maps, open the branch, tap Share, then Copy link. PR agents send it to patients so they find the branch.</span>}
    </label>
  );
}
