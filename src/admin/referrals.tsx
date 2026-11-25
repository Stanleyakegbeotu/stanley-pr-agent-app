/**
 * Incoming referrals for the Company Admin (owner, 2026-11-25): the same
 * folder the branches see, across every branch the admin manages, so the
 * admin can see how quickly each branch attends to referred patients. Each
 * branch shows what is waiting, the oldest wait and today's attendance;
 * one tap messages that branch's front desk on duty or its manager to ask
 * what is holding the referrals up. The admin views; the branch bills.
 */
import { useMemo, useState } from 'react';
import { BadgeCheck, ChevronDown, Clock3, MessageCircle, Siren, UserRound } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, getBranch } from '@company/data/company';
import { isoDate } from '@company/data/demo/generator';
import { formatCount } from '@company/shared/format';
import { Sticker } from '@/ui/kit';
import { Sheet } from './ui';
import { frontDeskId, managerId } from './chat';
import { IncomingDetail, ReferralHistoryCard, Slip, ago, isOpen, thisWeek, useIncomingMany, type Incoming } from '@/staff/incoming';

const DAY = 86_400_000;

export function AdminReferrals() {
  const { context } = useCompany();
  const ids = useMemo(() => (context === 'all' ? ACTIVE_BRANCHES.map((b) => b.id) : [context]), [context]);
  const list = thisWeek(useIncomingMany(ids));
  const [open, setOpen] = useState(false);
  const waiting = list.filter(isOpen);
  const late = waiting.filter((r) => Date.now() - r.sentAt.getTime() > 4 * 3_600_000).length;
  const byBranch = ids
    .map((id) => ({ id, n: waiting.filter((r) => r.branchId === id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const n = waiting.length;
  const scope = context === 'all' ? `${ids.length} branch${ids.length === 1 ? '' : 'es'}` : `${getBranch(context)?.name ?? ''} branch`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Incoming referrals, ${n} waiting`} className="press group relative mb-3 block w-full pt-6 text-left">
        <span aria-hidden="true" className="absolute inset-x-0 top-3 h-[70%] rounded-[26px] bg-linear-to-br from-[#ffd877] to-[#f6a823] shadow-[0_10px_24px_rgba(214,128,8,0.25)]" />
        <span aria-hidden="true" className="absolute left-5 top-0 flex h-9 items-start rounded-t-[16px] bg-[#ffd877] px-4 pt-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#7a4a00]">
          Referrals in
        </span>
        <span aria-hidden="true" className="absolute left-6 right-16 top-8 flex flex-col gap-1.5">
          {(byBranch.length ? byBranch.slice(0, 2) : [null]).map((b, i) => (
            <span key={b?.id ?? i} className="pick-in flex items-center gap-2 rounded-[12px] bg-white px-3 py-1.5 text-[12px] shadow-[0_6px_14px_rgba(120,70,0,0.14)] ring-1 ring-[#f3e2bd]" style={{ transform: `rotate(${i ? 1.4 : -1.8}deg)`, animationDelay: `${i * 90}ms` }}>
              {b ? (
                <>
                  <b className="truncate text-ink">{getBranch(b.id)?.name} branch</b>
                  <span className="ml-auto shrink-0 font-semibold text-[#b45309]">{b.n} waiting</span>
                </>
              ) : (
                <span className="text-muted">Every branch is up to date</span>
              )}
            </span>
          ))}
        </span>
        <span className="relative z-10 mt-[68px] block overflow-hidden rounded-[24px] bg-linear-to-br from-[#ffc94d] via-[#ffb21f] to-[#f08c00] p-4 shadow-[0_14px_30px_rgba(214,128,8,0.35)] ring-1 ring-white/40">
          <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20" />
          <span className="relative flex items-center gap-3">
            <Sticker name="envelope" size={52} className="-my-1 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[17.5px] font-extrabold leading-tight text-[#4a2a00]">Incoming referrals</span>
              <span className="block truncate text-[13px] font-medium text-[#6b4100]">{n ? `${formatCount(n)} waiting · ${scope}` : `All attended · ${scope}`}</span>
              {late > 0 && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#b42318] px-2 py-0.5 text-[11.5px] font-bold text-white">
                  <Clock3 size={12} /> {late} waiting over 4 hours
                </span>
              )}
            </span>
          </span>
        </span>
        <span className="absolute right-3 top-0 z-20 grid place-items-center">
          {n > 0 && <span className="absolute h-11 w-11 animate-ping rounded-full bg-[#ef4444]/45" />}
          <span className={`relative grid h-11 min-w-11 place-items-center rounded-full px-2 text-[17px] font-extrabold text-white ring-4 ring-white ${n ? 'bg-linear-to-b from-[#ff5a5f] to-[#e11d2a] shadow-[0_8px_18px_rgba(225,29,42,0.45)]' : 'bg-good'}`}>{n ? (n > 999 ? '999+' : n) : <BadgeCheck size={20} />}</span>
        </span>
      </button>
      {open && <AdminReferralsSheet ids={ids} list={list} onClose={() => setOpen(false)} />}
    </>
  );
}

function AdminReferralsSheet({ ids, list, onClose }: { ids: string[]; list: Incoming[]; onClose: () => void }) {
  const { navigate } = useCompany();
  const [q, setQ] = useState('');
  const [openBranch, setOpenBranch] = useState<string | null>(ids.length === 1 ? ids[0]! : null);
  const [detail, setDetail] = useState<string | null>(null);
  const t = q.trim().toLowerCase();
  const today = isoDate(new Date());
  const rows = ids
    .map((id) => {
      const mine = list.filter((r) => r.branchId === id);
      const waiting = mine.filter(isOpen);
      const sentToday = mine.filter((r) => isoDate(r.sentAt) === today);
      const doneToday = sentToday.filter((r) => r.status === 'attended').length;
      const oldest = waiting.reduce<Incoming | null>((o, r) => (!o || r.sentAt < o.sentAt ? r : o), null);
      return { id, b: getBranch(id)!, mine, waiting, sentToday: sentToday.length, doneToday, oldest, urgent: waiting.filter((r) => r.urgency !== 'Routine').length };
    })
    .sort((a, b) => b.waiting.length - a.waiting.length);
  const found = t ? list.filter((r) => [r.patient.name, r.patient.phone, r.id, r.agentName, r.hospital, getBranch(r.branchId)?.name ?? ''].join(' ').toLowerCase().includes(t)) : [];
  const current = detail ? (list.find((r) => `${r.id}|${r.branchId}` === detail) ?? null) : null;
  const totalWaiting = rows.reduce((s, r) => s + r.waiting.length, 0);
  return (
    <Sheet title="Incoming referrals" subtitle={`${formatCount(totalWaiting)} waiting · ${ids.length} branch${ids.length === 1 ? '' : 'es'}`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Patient, referral ID, agent or branch' }}>
      <div className="px-1 pb-4">
        {t ? (
          found.length ? (
            <ul className="space-y-2.5">
              {found.map((r) => (
                <li key={`${r.id}|${r.branchId}`}>
                  <Slip r={r} showBranch onOpen={() => setDetail(`${r.id}|${r.branchId}`)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-[14px] text-muted">No referral matches “{q}”.</p>
          )
        ) : (
          <>
            <p className="mb-3 px-1 text-[12.5px] leading-snug text-muted">This week, branch by branch. Ask the front desk on duty or the manager if referrals are waiting too long. Earlier weeks are in Referral history.</p>
            <ReferralHistoryCard branchIds={ids} admin />
            <ul className="space-y-3">
              {rows.map((x) => {
                const rate = x.sentToday ? Math.round((x.doneToday / x.sentToday) * 100) : 100;
                const expanded = openBranch === x.id;
                const oldMs = x.oldest ? Date.now() - x.oldest.sentAt.getTime() : 0;
                return (
                  <li key={x.id} className={`overflow-hidden rounded-[22px] bg-white ring-1 ${x.waiting.length ? 'ring-[#f3dfb6]' : 'ring-line/70'}`}>
                    <button type="button" onClick={() => setOpenBranch(expanded ? null : x.id)} aria-expanded={expanded} className="press block w-full p-4 text-left">
                      <span className="flex items-start gap-3">
                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[18px] font-extrabold ${x.waiting.length ? 'bg-linear-to-b from-[#ff5a5f] to-[#e11d2a] text-white' : 'bg-[#e9f9ef] text-good-ink'}`}>{x.waiting.length || <BadgeCheck size={22} />}</span>
                        <span className="min-w-0 flex-1">
                          <b className="block text-[16px] text-ink">{x.b.name} branch</b>
                          <span className="block text-[12.5px] text-muted">
                            {x.waiting.length ? `${x.waiting.length} waiting` : 'Nothing waiting'}
                            {x.oldest ? ` · oldest sent ${ago(x.oldest.sentAt)}` : ''}
                          </span>
                        </span>
                        <ChevronDown size={18} className={`mt-1 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </span>
                      <span className="mt-3 block">
                        <span className="flex justify-between text-[12px] text-ink-2">
                          <span>Attended today</span>
                          <b>
                            {x.doneToday} of {x.sentToday} · {rate}%
                          </b>
                        </span>
                        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-page">
                          <span className={`block h-full rounded-full ${rate >= 80 ? 'bg-good' : rate >= 50 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`} style={{ width: `${rate}%`, transition: 'width 700ms ease' }} />
                        </span>
                      </span>
                      {(x.urgent > 0 || oldMs > 4 * 3_600_000) && (
                        <span className="mt-2.5 flex flex-wrap gap-1.5">
                          {x.urgent > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-[#ffe4e4] px-2 py-0.5 text-[11.5px] font-bold text-[#b42318]">
                              <Siren size={12} /> {x.urgent} urgent
                            </span>
                          )}
                          {oldMs > DAY ? (
                            <span className="rounded-full bg-[#fff1de] px-2 py-0.5 text-[11.5px] font-bold text-[#b45309]">Waiting more than a day</span>
                          ) : oldMs > 4 * 3_600_000 ? (
                            <span className="rounded-full bg-[#fff1de] px-2 py-0.5 text-[11.5px] font-bold text-[#b45309]">Waiting over 4 hours</span>
                          ) : null}
                        </span>
                      )}
                    </button>
                    <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                      <button type="button" onClick={() => navigate(`/messages/${frontDeskId(x.id)}`)} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-[13.5px] font-semibold text-white">
                        <MessageCircle size={16} /> Front desk
                      </button>
                      <button type="button" onClick={() => navigate(`/messages/${managerId(x.id)}`)} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-semibold text-brand-700 ring-1 ring-brand-200">
                        <UserRound size={16} /> Manager
                      </button>
                    </div>
                    {expanded && (
                      <div className="drop-down border-t border-line bg-page/60 p-3">
                        {x.waiting.length ? (
                          <ul className="space-y-2">
                            {x.waiting.map((r) => (
                              <li key={r.id}>
                                <Slip r={r} onOpen={() => setDetail(`${r.id}|${r.branchId}`)} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="py-3 text-center text-[13px] text-muted">Everyone referred to {x.b.name} has been attended.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      {current && <IncomingDetail r={current} onClose={() => setDetail(null)} onStart={() => undefined} onResume={() => undefined} onAsk={() => navigate(`/messages/${frontDeskId(current.branchId)}`)} />}
    </Sheet>
  );
}
