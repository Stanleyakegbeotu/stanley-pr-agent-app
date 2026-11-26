/**
 * Branch side of availability (domain/availability): the Manager or Front
 * Desk says whether the branch is receiving patients now, and when each
 * test can be done. PR agents see it at once in their app.
 */
import { useState } from 'react';
import { Check, ChevronRight, Clock3, DoorClosed, DoorOpen } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { branchStatus, daysText, ruleOf, setBranchOverride, setTestSetting, testStatus, useAvailability, windowText, type TestRule, type Window } from '@/domain/availability';
import { updateBranchProfile } from '@company/services/settingsStore';
import { weekProblem, weekText, type WeekHours } from '@company/services/openingHours';
import { WeekHoursEditor } from '@/admin/hoursEditor';
import { useNav } from '@/app/store';
import { Sheet } from '@/admin/ui';
import { LongText } from '@/admin/fields';
import { FieldErr, FieldLabel, inputCls } from '@/admin/prManage';
import { useRight } from '@/admin/access';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const localInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/* ─────────────── dashboard card ─────────────── */

export function ReceivingCard({ branchId }: { branchId: string }) {
  const avail = useAvailability(branchId);
  const st = branchStatus(avail);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`press mb-3 flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left ring-1 ${st.ok ? 'bg-linear-to-br from-[#eafaf0] to-[#d6f5e2] ring-[#bfe9d0]' : 'bg-linear-to-br from-[#fff1f1] to-[#ffdede] ring-[#f9cfcf]'}`}>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ${st.ok ? 'text-good' : 'text-[#d93036]'}`}>{st.ok ? <DoorOpen size={22} /> : <DoorClosed size={22} />}</span>
        <span className="min-w-0 flex-1">
          <b className={`block text-[15px] ${st.ok ? 'text-good-ink' : 'text-[#b42318]'}`}>{st.ok ? 'Receiving patients now' : 'Not receiving patients now'}</b>
          <span className="block truncate text-[12.5px] text-ink-2">{st.detail}</span>
          <span className="block text-[11.5px] text-muted">PR agents see this before sending patients</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-faint" />
      </button>
      {open && <ReceivingSheet branchId={branchId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReceivingSheet({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const right = useRight();
  const avail = useAvailability(branchId);
  const cur = avail.override && (!avail.override.until || new Date(avail.override.until) > new Date()) ? avail.override : undefined;
  const [mode, setMode] = useState<'hours' | 'open' | 'closed'>(cur?.state ?? 'hours');
  const [until, setUntil] = useState(cur?.until ? localInput(new Date(cur.until)) : '');
  const [note, setNote] = useState(cur?.note ?? '');
  const [hours, setHours] = useState<WeekHours>(avail.hours);
  const [tried, setTried] = useState(false);
  const canHours = right('branch.settings');
  const err = mode === 'closed' && note.trim().length < 3 ? 'Say why, for example: public holiday, power outage.' : null;
  const hoursErr = canHours ? weekProblem(hours) : null;
  const save = () => {
    if (err || hoursErr) return setTried(true);
    setBranchOverride(mode === 'hours' ? null : { state: mode, until: until ? new Date(until).toISOString() : undefined, note: note.trim() || undefined, by: user.name, at: new Date().toISOString() });
    if (canHours && JSON.stringify(hours) !== JSON.stringify(avail.hours)) updateBranchProfile(branchId, { week: hours, hours: weekText(hours) });
    logAudit({ category: 'Settings', action: mode === 'hours' ? 'Branch follows its opening hours' : mode === 'open' ? 'Branch marked open now' : 'Branch marked closed now', record: 'Receiving patients', details: [until ? `until ${until.replace('T', ' ')}` : '', note.trim(), canHours ? `hours ${weekText(hours)}` : ''].filter(Boolean).join(' · '), branchId });
    showToast('Saved. PR agents see it now.');
    onClose();
  };
  return (
    <Sheet title="Receiving patients" subtitle="What PR agents see before they send a patient" onClose={onClose} tall footer={<button type="button" onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">Save</button>}>
      <div className="space-y-3 px-1 pb-3">
        {(
          [
            ['hours', 'Follow the opening hours', weekText(hours)],
            ['open', 'Open now', 'Receiving patients now, even outside the usual hours'],
            ['closed', 'Closed now', 'Not receiving patients, for example a public holiday or power outage'],
          ] as const
        ).map(([k, t, d]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`press flex w-full items-center gap-3 rounded-2xl p-3 text-left ${mode === k ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] text-ink">{t}</b>
              <span className="block text-[12.5px] text-muted">{d}</span>
            </span>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${mode === k ? 'bg-brand-600 text-white' : 'ring-2 ring-[#d3dce9]'}`}>{mode === k && <Check size={12} strokeWidth={3} />}</span>
          </button>
        ))}
        {mode !== 'hours' && (
          <>
            <label className="block">
              <FieldLabel label="Until" optional />
              <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls()} />
              <span className="mt-1 block text-[12px] text-muted">Leave empty to keep it until you change it.</span>
            </label>
            <LongText label={mode === 'closed' ? 'Why' : 'Note'} required={mode === 'closed'} optional={mode !== 'closed'} value={note} onChange={setNote} max={160} minRows={2} placeholder={mode === 'closed' ? 'For example: public holiday, we open again tomorrow at 7:30' : 'For example: open late today for emergencies'} />
            {tried && <FieldErr msg={err} />}
          </>
        )}
        <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <p className="text-[14.5px] font-bold text-ink">Opening hours</p>
          {canHours ? (
            <div className="mt-2">
              <WeekHoursEditor value={hours} onChange={setHours} error={tried ? hoursErr : null} />
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-ink-2">{weekText(hours)}. The Branch Manager changes these.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function WindowEditor({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const on = value.days.includes(d);
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => onChange({ ...value, days: on ? value.days.filter((x) => x !== d) : [...value.days, d] })} className={`press min-h-9 min-w-11 rounded-full px-2.5 text-[13px] font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
              {SHORT[d]}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">From</span>
          <input type="time" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className={inputCls()} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-muted">To</span>
          <input type="time" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className={inputCls()} />
        </label>
      </div>
      <p className="mt-1.5 text-[12px] text-muted">{value.days.length ? `${daysText(value.days)}, ${value.from} to ${value.to}` : 'Choose at least one day.'}</p>
    </div>
  );
}

/* ─────────────── a test ─────────────── */

/** Inventory test card: when the test can be done, and Change. */
export function TestAvailabilityBox({ id, name, category, branchId }: { id: number; name: string; category: string; branchId: string | null }) {
  const avail = useAvailability();
  const st = testStatus(id, category, avail);
  const [open, setOpen] = useState(false);
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-[20px] p-3.5 ring-1 ${st.ok ? 'bg-[#f2fbf6] ring-[#cdeedb]' : 'bg-[#fffaf0] ring-[#f6e1b3]'}`}>
      <Clock3 size={19} className={`mt-0.5 shrink-0 ${st.ok ? 'text-good' : 'text-[#b45309]'}`} />
      <span className="min-w-0 flex-1">
        <b className="block text-[14px] text-ink">Availability · {st.label}</b>
        <span className="block text-[12.5px] leading-snug text-ink-2">{st.detail}</span>
        <span className="block text-[11.5px] text-muted">PR agents see this on the test and in the patient’s message</span>
      </span>
      <button type="button" onClick={() => setOpen(true)} className="press shrink-0 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 shadow-sm">
        Change
      </button>
      {open && <TestAvailSheet id={id} name={name} category={category} branchId={branchId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function TestAvailSheet({ id, name, category, branchId, onClose }: { id: number; name: string; category: string; branchId: string | null; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const avail = useAvailability();
  const cur = ruleOf(id, category, avail);
  const [kind, setKind] = useState<TestRule['kind']>(cur.kind);
  const [win, setWin] = useState<Window>(cur.kind === 'schedule' ? { days: cur.days, from: cur.from, to: cur.to } : { days: [1, 2, 3, 4, 5], from: '09:00', to: '16:00' });
  const [until, setUntil] = useState(cur.kind === 'off' && cur.until ? localInput(new Date(cur.until)) : '');
  const [note, setNote] = useState(cur.kind === 'off' ? (cur.note ?? '') : '');
  const [tried, setTried] = useState(false);
  const err = kind === 'off' && note.trim().length < 3 ? 'Say why, for example: the radiologist is away.' : kind === 'schedule' && !win.days.length ? 'Choose at least one day.' : null;
  const save = () => {
    if (err) return setTried(true);
    const rule: TestRule = kind === 'hours' ? { kind: 'hours' } : kind === 'schedule' ? { kind: 'schedule', ...win } : { kind: 'off', until: until ? new Date(until).toISOString() : undefined, note: note.trim() };
    setTestSetting(id, rule, user.name);
    logAudit({ category: 'Catalogue', action: kind === 'off' ? 'Test marked not available' : kind === 'schedule' ? 'Test schedule set' : 'Test follows opening hours', record: `${name} (#${id})`, details: kind === 'off' ? [note.trim(), until ? `until ${until.replace('T', ' ')}` : ''].filter(Boolean).join(' · ') : kind === 'schedule' ? windowText(win) : 'Opening hours', branchId });
    showToast('Saved. PR agents see it now.');
    onClose();
  };
  return (
    <Sheet back title="When this test is done" subtitle={name} onClose={onClose} tall footer={<button type="button" onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">Save</button>}>
      <div className="space-y-3 px-1 pb-3">
        {(
          [
            ['hours', 'During opening hours', 'Anyone on duty can do it'],
            ['schedule', 'On a schedule', 'Only when the specialist or machine is there'],
            ['off', 'Not available now', 'For example the radiologist is away or the machine is being repaired'],
          ] as const
        ).map(([k, t, d]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`press flex w-full items-center gap-3 rounded-2xl p-3 text-left ${kind === k ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] text-ink">{t}</b>
              <span className="block text-[12.5px] text-muted">{d}</span>
            </span>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${kind === k ? 'bg-brand-600 text-white' : 'ring-2 ring-[#d3dce9]'}`}>{kind === k && <Check size={12} strokeWidth={3} />}</span>
          </button>
        ))}
        {kind === 'schedule' && (
          <div className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
            <p className="text-[14.5px] font-bold text-ink">Days and hours</p>
            <WindowEditor value={win} onChange={setWin} />
          </div>
        )}
        {kind === 'off' && (
          <>
            <label className="block">
              <FieldLabel label="Available again on" optional />
              <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={inputCls()} />
              <span className="mt-1 block text-[12px] text-muted">Then it follows its usual hours again by itself.</span>
            </label>
            <LongText label="Why" required value={note} onChange={setNote} max={160} minRows={2} placeholder="For example: the radiologist is away until Monday" />
          </>
        )}
        {tried && <FieldErr msg={err} />}
      </div>
    </Sheet>
  );
}
