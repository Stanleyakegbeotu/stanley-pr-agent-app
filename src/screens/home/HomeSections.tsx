/**
 * Home sections (owner, 2026-11-24).
 *  • Updates from your branch: shown in the "required" area at the top of
 *    Home, under the bank details card. A patient completed their tests
 *    (billing done), cancelled (before visiting, or at the branch), or
 *    removed/added tests at billing (and how that moved the commission).
 *    Each update can be dismissed. There is no "Arrived" status.
 *  • Today's referred patients: below Quick Actions, every patient referred
 *    today with their status; "No patient referred today" when there are none.
 */
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Ban, CheckCircle2, ChevronRight, Plus, Send, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { naira } from '@/domain/format';
import { STATUS_NOTE, cancelSummary, cancelTitle, commissionOf, serviceSummary, testChanges, type Referral } from '@/domain/referrals';
import { Button, InitialsAvatar, SectionTitle, StatusBadge } from '@/ui/kit';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const names = (list: { name: string }[]) => list.map((s) => s.name).join(', ');

/** "2 tests removed: FBS, E/U/C. Commission down ₦3,450." and/or "1 test added: ...". */
export function ChangeNote({ r, className = '' }: { r: Referral; className?: string }) {
  const c = testChanges(r);
  if (!c) return null;
  const up = c.delta >= 0;
  return (
    <span className={`block rounded-xl px-2.5 py-2 text-[12.5px] leading-snug ${up ? 'bg-[#e8f8ef] text-good-ink' : 'bg-[#fdecec] text-[#b42318]'} ${className}`}>
      {c.removed.length > 0 && (
        <span className="block">
          <b>
            {c.removed.length} test{c.removed.length === 1 ? '' : 's'} removed by the patient:
          </b>{' '}
          {names(c.removed)}
        </span>
      )}
      {c.added.length > 0 && (
        <span className="block">
          <b>
            {c.added.length} test{c.added.length === 1 ? '' : 's'} added at the branch:
          </b>{' '}
          {names(c.added)}
        </span>
      )}
      <span className="mt-0.5 flex items-center gap-1 font-semibold">
        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} Commission {up ? 'up' : 'down'} {naira(Math.abs(c.delta))}
      </span>
    </span>
  );
}

/* ─────────────── Updates from your branch ─────────────── */

const DISMISSED_KEY = 'stanley.pr.updates.dismissed';
const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function BranchUpdates() {
  const { referrals, navigate } = useApp();
  const [gone, setGone] = useState(readDismissed);
  const since = Date.now() - 2 * 86_400_000; // the last 2 days
  const updates = referrals
    .filter((r) => r.status !== 'Pending' && r.updatedAt && new Date(r.updatedAt).getTime() >= since)
    .map((r) => ({ key: `${r.id}:${r.status}`, r }))
    .filter((u) => !gone.includes(u.key))
    .sort((a, b) => b.r.updatedAt!.localeCompare(a.r.updatedAt!));
  if (!updates.length) return null;
  const dismiss = (key: string) => {
    const next = [...gone, key].slice(-200);
    setGone(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* this session only */
    }
  };
  const shown = updates.slice(0, 4);
  return (
    <section className="mb-5">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
          Updates from your branch
          <span className="grid h-5.5 min-w-5.5 place-items-center rounded-full bg-brand-600 px-1.5 text-[12px] font-bold text-white">{updates.length}</span>
        </h2>
        {updates.length > shown.length && (
          <button type="button" onClick={() => navigate('/referrals')} className="text-[14px] font-semibold text-brand-600">
            See all
          </button>
        )}
      </div>
      <ul className="space-y-2.5">
        {shown.map(({ key, r }) => (
          <li key={key}>
            <Update r={r} onOpen={() => navigate(`/referrals/${r.id}`)} onDismiss={() => dismiss(key)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Update({ r, onOpen, onDismiss }: { r: Referral; onOpen: () => void; onDismiss: () => void }) {
  const kind =
    r.status === 'Completed'
      ? { icon: <CheckCircle2 size={20} />, tone: 'bg-tint-green text-good', title: `${r.patient.name} completed at the branch`, text: `Billing is done. Your commission of ${naira(commissionOf(r))} is confirmed.` }
      : { icon: <Ban size={20} />, tone: 'bg-[#fdecec] text-[#d93036]', title: `${r.patient.name}: ${cancelTitle(r).toLowerCase()}`, text: `${cancelSummary(r)} No commission for this referral.` };
  return (
    <div className="card relative flex items-start gap-3 p-3.5 pr-10">
      <button type="button" onClick={onOpen} className="press flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${kind.tone}`}>{kind.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold leading-snug text-ink">{kind.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{kind.text}</span>
          <ChangeNote r={r} className="mt-2" />
          <span className="mt-1 block text-[12px] text-muted">
            {r.id}, {isToday(r.updatedAt!) ? `today ${timeOf(r.updatedAt!)}` : `yesterday ${timeOf(r.updatedAt!)}`}
          </span>
        </span>
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss update" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-faint hover:bg-page">
        <X size={16} />
      </button>
    </div>
  );
}

/* ─────────────── Today's referred patients ─────────────── */

export function TodayPatients() {
  const { referrals, navigate } = useApp();
  const today = referrals.filter((r) => isToday(r.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="mt-6">
      <SectionTitle title="Today’s Referred Patients" action={today.length ? 'See all' : undefined} onAction={() => navigate('/referrals')} />
      {today.length === 0 ? (
        <div className="card flex flex-col items-center px-5 py-7 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-tint-blue text-brand-600">
            <Send size={24} />
          </span>
          <p className="mt-3 text-[16px] font-bold text-ink">No patient referred today</p>
          <p className="mt-1 text-[13.5px] text-muted">Patients you refer today will show here with their status.</p>
          <div className="mt-4 w-full max-w-[240px]">
            <Button block onClick={() => navigate('/refer')}>
              <Plus size={18} /> Refer a Patient
            </Button>
          </div>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {today.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => navigate(`/referrals/${r.id}`)} className="press flex w-full items-start gap-3 px-4 py-3.5 text-left">
                <InitialsAvatar name={r.patient.name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[15.5px] font-bold text-ink">{r.patient.name}</span>
                    <StatusBadge status={r.status} />
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {r.id}, {timeOf(r.createdAt)}, {serviceSummary(r)}
                  </span>
                  <span className={`mt-1 block text-[13px] font-medium ${r.status === 'Completed' ? 'text-good-ink' : r.status === 'Cancelled' ? 'text-[#d93036]' : 'text-orange'}`}>
                    {r.status === 'Cancelled' ? cancelSummary(r) : STATUS_NOTE[r.status]}
                  </span>
                  <ChangeNote r={r} className="mt-1.5" />
                  <span className="mt-1 flex items-center justify-between text-[13px]">
                    <span className="text-muted">{r.status === 'Completed' ? 'Commission confirmed' : r.status === 'Cancelled' ? 'No commission' : 'Estimated commission'}</span>
                    <span className={`font-bold ${r.status === 'Cancelled' ? 'text-faint line-through' : r.status === 'Completed' ? 'text-good' : 'text-orange'}`}>{naira(commissionOf(r))}</span>
                  </span>
                </span>
                <ChevronRight size={17} className="mt-1 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
