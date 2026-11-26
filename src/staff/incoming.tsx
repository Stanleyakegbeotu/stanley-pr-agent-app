/**
 * Incoming referrals (owner, 2026-11-25): every referral PR agents send to
 * the branch lands in a folder on the Branch Manager's and Front Desk's
 * dashboard, with a count of the ones still waiting. Open it to see them all,
 * search when a patient walks in ("my name is ..."), and start the bill from
 * the referral (patient, referrer and requested tests filled in). Starting
 * and saving the bill attends to it, so the count goes down. Not found? Start
 * a new patient bill, or enter the referral ID the patient was given.
 *
 * Referrals sent from the Referrer Portal reach the branch through the cloud
 * connection; until it exists, the folder shows the branch's demo referrals
 * (same agents, tests and prices as the rest of the app). A referral counts
 * as attended when a saved bill carries its referral ID; a draft with it
 * shows as "Bill started".
 *
 * Weekly folder (owner, 2026-11-25): the folder holds this week's referrals
 * (from Monday). Older ones move to Referral history (Records), never
 * deleted; a past week's referral nobody updated shows as Not attended.
 * The branch sets a status on any referral not billed: Coming later (with
 * the day), Did not come, or Cancelled (domain/referralStatus); the PR agent
 * sees it on their request. The referral ID can be copied.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DAY_MS, hash, isOpen, statusLabel, thisWeek, useIncomingFrom, weekStart, ago, STATUS_TEXT, type Incoming, type IncomingStatus, type PoolItem, type Urgency } from '@company/services/incoming';
import { ArrowRight, BadgeCheck, CalendarDays, Check, ChevronRight, Clock3, Copy, FilePlus2, Hash, ListChecks, MessageCircle, Mic, Pause, Phone, Play, Search, Siren, Stethoscope } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { addDays, isoDate } from '@company/data/demo/generator';
import { patientNameOf } from '@company/data/demo/dailyLines';
import { hospitalKey } from '@company/data/legacy';
import { resolveRange, serviceRanking } from '@company/services/analytics';
import { branchPrefix, useBilling, type SelectedService } from '@company/services/billing';
import { formatCount, formatMoney } from '@company/shared/format';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { Sheet } from '@/admin/ui';
import { AgentAvatar } from '@/admin/agentPhotos';
import { buildItems, groupCategories, type Item } from '@/admin/pages/Inventory';
import { staffAgentId } from './chat';
import { logAudit } from '@company/services/audit';
import { useNav } from '@/app/store';
import type { StickerKey } from '@/assets';
import { copyText } from '@/ui/privacy';
import { LongText } from '@/admin/fields';
import { FieldErr, FieldLabel, inputCls } from '@/admin/prManage';
import { branchUpdateText, setBranchUpdate, useBranchUpdates, type BranchUpdate, type BranchUpdateKind } from '@/domain/referralStatus';
import { branchItems, catalogueOf, useBranchCatalogue } from '@/admin/branchCatalogue';

export { STATUS_TEXT, ago, findIncoming, isOpen, thisWeek, weekStart, type Incoming, type IncomingStatus, type Urgency } from '@company/services/incoming';

export const STATUS_PILL: Record<IncomingStatus, string> = {
  waiting: 'bg-[#fff1de] text-[#b45309]',
  billing: 'bg-[#e8f1ff] text-brand-700',
  attended: 'bg-[#e9f9ef] text-good-ink',
  coming: 'bg-[#efe9ff] text-violet',
  no_show: 'bg-[#f1f3f7] text-ink-2',
  cancelled: 'bg-[#ffe9e9] text-[#b42318]',
};
const DAY = DAY_MS;

/** The branch's incoming referrals, newest first, with their live status. */
export const useIncoming = (branchId: string): Incoming[] => useIncomingMany(useMemo(() => [branchId], [branchId]));

/** Incoming referrals for several branches (the Company Admin's view), newest first. Each branch's own price list. */
export function useIncomingMany(branchIds: string[]): Incoming[] {
  const { inventory } = useCompany();
  const catalogues = useBranchCatalogue(branchIds[0] ?? '');
  const company = useMemo(() => buildItems(inventory), [inventory]);
  const labels = useMemo(() => new Map(groupCategories(company, inventory.categoryNames).map((g) => [g.key, g.label])), [company, inventory.categoryNames]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const itemsOf = useCallback((id: string): PoolItem[] => branchItems(company, catalogueOf(id)), [company, catalogues]);
  const labelOf = useCallback((k: string) => labels.get(k) ?? k, [labels]);
  return useIncomingFrom(branchIds, itemsOf, labelOf);
}

const URGENT_TONE: Record<Urgency, string> = { Routine: 'bg-page text-ink-2', Urgent: 'bg-[#fff1de] text-[#b45309]', Emergency: 'bg-[#ffe4e4] text-[#b42318]' };
const STRIP: Record<Urgency, string> = { Routine: 'bg-brand-400', Urgent: 'bg-[#f59e0b]', Emergency: 'bg-[#ef4444]' };

/* ─────────────── the folder on the dashboard ─────────────── */

export function IncomingFolder({ branchId, onOpen }: { branchId: string; onOpen: () => void }) {
  const list = thisWeek(useIncoming(branchId));
  const waiting = list.filter(isOpen);
  const urgent = waiting.filter((r) => r.urgency !== 'Routine').length;
  const today = list.filter((r) => isoDate(r.sentAt) === isoDate(new Date()));
  const slips = waiting.slice(0, 3);
  const n = waiting.length;
  return (
    <button type="button" onClick={onOpen} aria-label={`Incoming referrals, ${n} waiting`} className="press group relative mb-4 block w-full pt-7 text-left">
      {/* back of the folder, with its tab */}
      <span aria-hidden="true" className="absolute inset-x-0 top-3 h-[70%] rounded-[26px] bg-linear-to-br from-[#ffd877] to-[#f6a823] shadow-[0_10px_24px_rgba(214,128,8,0.25)]" />
      <span aria-hidden="true" className="absolute left-5 top-0 flex h-9 items-start rounded-t-[16px] bg-[#ffd877] px-4 pt-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#7a4a00]">
        Referrals in
      </span>
      {/* papers peeking out */}
      <span aria-hidden="true" className="absolute left-6 right-16 top-8 h-24">
        {(slips.length ? slips : [null, null]).map((r, i) => (
          <span
            key={r?.id ?? i}
            className="pick-in absolute inset-x-0 rounded-[14px] bg-white px-3.5 py-2 shadow-[0_6px_14px_rgba(120,70,0,0.16)] ring-1 ring-[#f3e2bd]"
            style={{ top: i * 9, transform: `rotate(${[-2.5, 1.8, -1][i]}deg) translateX(${[-4, 6, 0][i]}px)`, animationDelay: `${i * 90}ms`, zIndex: i }}
          >
            {r ? (
              <span className="flex items-center gap-2 text-[12px]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STRIP[r.urgency]}`} />
                <b className="truncate text-ink">{r.patient.name}</b>
                <span className="ml-auto shrink-0 text-muted">{ago(r.sentAt)}</span>
              </span>
            ) : (
              <span className="block h-3.5 w-2/3 rounded bg-[#f4ead6]" />
            )}
          </span>
        ))}
      </span>
      {/* front pocket */}
      <span className="relative z-10 mt-16 block overflow-hidden rounded-[24px] bg-linear-to-br from-[#ffc94d] via-[#ffb21f] to-[#f08c00] p-4 shadow-[0_14px_30px_rgba(214,128,8,0.35)] ring-1 ring-white/40">
        <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20" />
        <span className="relative flex items-center gap-3">
          <Sticker name="envelope" size={54} className="-my-1 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-extrabold leading-tight tracking-[-0.01em] text-[#4a2a00]">Incoming referrals</span>
            <span className="block truncate text-[13px] font-medium text-[#6b4100]">
              {n ? `${formatCount(n)} waiting · newest ${ago(waiting[0]!.sentAt)}` : 'Everyone referred this week is attended'}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {urgent > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[#b42318] px-2 py-0.5 text-[11.5px] font-bold text-white">
                  <Siren size={12} /> {urgent} urgent
                </span>
              )}
              <span className="rounded-full bg-white/55 px-2 py-0.5 text-[11.5px] font-semibold text-[#5c3700]">{formatCount(today.length)} today · {formatCount(list.length)} this week</span>
            </span>
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-[#7a4a00] transition-transform group-active:translate-x-0.5">
            <ChevronRight size={20} />
          </span>
        </span>
      </span>
      {/* the count: always visible, pulsing while anything waits */}
      <span className="absolute right-3 top-1 z-20 grid place-items-center">
        {n > 0 && <span className="absolute h-11 w-11 animate-ping rounded-full bg-[#ef4444]/45" />}
        <span className={`relative grid h-11 min-w-11 place-items-center rounded-full px-2 text-[17px] font-extrabold text-white ring-4 ring-white ${n ? 'bg-linear-to-b from-[#ff5a5f] to-[#e11d2a] shadow-[0_8px_18px_rgba(225,29,42,0.45)]' : 'bg-good'}`}>
          {n ? (n > 99 ? '99+' : n) : <BadgeCheck size={20} />}
        </span>
      </span>
    </button>
  );
}

/* ─────────────── the folder opened ─────────────── */

export function IncomingSheet({ branchId, onClose, onStart, onResume, onNewBill, onEnterId }: { branchId: string; onClose: () => void; onStart: (r: Incoming) => void; onResume: (draftId: string) => void; onNewBill: (name: string) => void; onEnterId: () => void }) {
  const everything = useIncoming(branchId);
  const list = thisWeek(everything);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'waiting' | 'attended' | 'all'>('waiting');
  const [history, setHistory] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, '');
  const matches = (r: Incoming) => !t || [r.patient.name, r.patient.phone, r.id, r.agentName, r.hospital, ...r.services.map((s) => s.name)].join(' ').toLowerCase().includes(t) || (digits.length >= 3 && (r.id.replace(/\D/g, '').includes(digits) || r.patient.phone.includes(digits)));
  const waiting = list.filter(isOpen);
  const attended = list.filter((r) => r.status === 'attended');
  // A search looks through older weeks too, so a patient with last week's referral is still found.
  const base = t ? everything : tab === 'waiting' ? waiting : tab === 'attended' ? attended : list;
  const shown = base.filter(matches);
  const current = open ? everything.find((r) => r.id === open) ?? null : null;
  return (
    <Sheet title="Incoming referrals" subtitle={`This week · ${formatCount(waiting.length)} waiting · ${getBranch(branchId)?.name ?? ''} branch`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Patient name, phone, referral ID or agent' }}>
      <div className="px-1 pb-4">
        {!t && (
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-page p-1" role="tablist">
            {(
              [
                ['waiting', `Open ${waiting.length}`],
                ['attended', `Attended ${attended.length}`],
                ['all', `This week ${list.length}`],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${tab === k ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {!t && tab === 'waiting' && waiting.length > 0 && <p className="mb-2 px-1 text-[12.5px] text-muted">When a referred patient arrives, find them here and start their bill. Search by the name they give you.</p>}
        {shown.length ? (
          <ul className="space-y-2.5">
            {shown.map((r) => (
              <li key={r.id}>
                <Slip r={r} onOpen={() => setOpen(r.id)} />
              </li>
            ))}
          </ul>
        ) : t ? (
          <div className="rounded-[22px] bg-linear-to-br from-[#f4f8ff] to-[#e8f0ff] p-5 text-center ring-1 ring-[#dce7fb]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
              <Search size={26} className="text-brand-600" />
            </span>
            <p className="mt-3 text-[16px] font-bold text-ink">No referral for “{q}”</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">Ask the patient if they were given a referral ID. If not, start a new patient bill.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={onEnterId} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white text-[14.5px] font-semibold text-brand-700 ring-1 ring-brand-200">
                <Hash size={17} /> Enter a referral ID
              </button>
              <button type="button" onClick={() => onNewBill(/\d{3}/.test(q) ? '' : q.trim())} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)]">
                <FilePlus2 size={17} /> Start a new patient bill
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-[22px] bg-page px-5 py-8 text-center">
            <Sticker name="check" size={64} />
            <p className="mt-2 text-[15px] font-semibold text-ink">{tab === 'waiting' ? 'No one is waiting' : 'Nothing here yet'}</p>
            <p className="text-[13px] text-muted">New referrals from PR agents appear here the moment they are sent.</p>
          </div>
        )}
        {!t && (
          <button type="button" onClick={() => setHistory(true)} className="press mt-4 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left ring-1 ring-line/70">
            <Sticker name="books" size={36} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-ink">Referral history</span>
              <span className="text-[12.5px] text-muted">Earlier weeks and their status. The folder starts fresh every Monday.</span>
            </span>
            <ChevronRight size={18} className="text-muted" />
          </button>
        )}
        {!t && (
          <button type="button" onClick={onEnterId} className="press mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
              <Hash size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-ink">The patient has a referral ID</span>
              <span className="text-[12.5px] text-muted">Type the number on their slip or message</span>
            </span>
            <ChevronRight size={18} className="text-muted" />
          </button>
        )}
      </div>
      {current && <IncomingDetail r={current} onClose={() => setOpen(null)} onStart={() => onStart(current)} onResume={() => current.draftId && onResume(current.draftId)} />}
      {history && <ReferralHistory branchIds={[branchId]} onClose={() => setHistory(false)} onStart={onStart} onResume={onResume} />}
    </Sheet>
  );
}

export function Slip({ r, onOpen, showBranch }: { r: Incoming; onOpen: () => void; showBranch?: boolean }) {
  const done = !isOpen(r);
  return (
    <button type="button" onClick={onOpen} className={`press relative flex w-full gap-3 overflow-hidden rounded-[20px] bg-white p-3.5 pl-4 text-left ring-1 ${done ? 'ring-line/70' : 'ring-[#f3dfb6] shadow-[0_6px_16px_rgba(214,128,8,0.1)]'}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${r.status === 'attended' ? 'bg-good' : done ? 'bg-[#c3cede]' : STRIP[r.urgency]}`} />
      <InitialsAvatar name={r.patient.name} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <b className="min-w-0 truncate text-[15px] text-ink">{r.patient.name}</b>
          <span className="shrink-0 text-[12px] text-muted">{ago(r.sentAt)}</span>
        </span>
        <span className="block truncate text-[12.5px] text-muted">
          {r.patient.gender}, {r.patient.age} · {r.id}{showBranch ? ` · ${getBranch(r.branchId)?.name ?? ''}` : ''}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {r.services.slice(0, 2).map((s) => (
            <span key={s.id} className="max-w-[48%] truncate rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700">
              {s.name}
            </span>
          ))}
          {r.services.length > 2 && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">+{r.services.length - 2}</span>}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-2">
          <AgentAvatar id={r.agentId} name={r.agentName} size={20} />
          <span className="truncate">
            {[r.agentName, r.hospital].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {r.priceAsk && <span className="rounded-full bg-[#efe9ff] px-2 py-0.5 text-[11.5px] font-bold text-violet">Asks ₦{r.priceAsk.amount.toLocaleString('en-NG')} off</span>}
          {r.voiceNote && <span className="flex items-center gap-1 rounded-full bg-[#fff4e0] px-2 py-0.5 text-[11.5px] font-bold text-[#9a5b00]"><Mic size={11} /> Voice note</span>}
          {r.urgency !== 'Routine' && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${URGENT_TONE[r.urgency]}`}>{r.urgency}</span>}
          {r.status !== 'waiting' && (
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_PILL[r.status]}`}>
              {statusLabel(r)}
              {r.status === 'attended' && r.attended?.invoiceNo ? ` · ${r.attended.invoiceNo}` : ''}
              {r.status === 'coming' && r.update?.date ? ` · ${new Date(`${r.update.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}
            </span>
          )}
          {r.status === 'waiting' && Date.now() - r.sentAt.getTime() > DAY && <span className="rounded-full bg-[#fff1de] px-2 py-0.5 text-[11.5px] font-bold text-[#b45309]">Not arrived yet</span>}
        </span>
      </span>
    </button>
  );
}

export function IncomingDetail({ r, onClose, onStart, onResume, onAsk }: { r: Incoming; onClose: () => void; onStart: () => void; onResume: () => void; /** Company Admin: ask the branch about this referral instead of billing it. */ onAsk?: () => void }) {
  const { navigate } = useCompany();
  const { showToast } = useNav();
  const [statusOpen, setStatusOpen] = useState(false);
  const canUpdate = !onAsk && r.status !== 'attended' && r.status !== 'billing';
  const branch = getBranch(r.branchId)!;
  const money = (n: number) => formatMoney(n, branch.currency);
  const total = r.services.reduce((s, x) => s + x.price, 0);
  return (
    <Sheet
      back
      title={r.patient.name}
      subtitle={`${r.id} · sent ${ago(r.sentAt)}`}
      onClose={onClose}
      tall
      footer={
        onAsk ? (
          r.status === 'attended' ? undefined : (
            <button type="button" onClick={onAsk} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              <MessageCircle size={18} /> Ask the front desk about this referral
            </button>
          )
        ) : r.status === 'attended' ? undefined : r.status === 'billing' ? (
          <button type="button" onClick={onResume} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            Continue the bill <ArrowRight size={18} />
          </button>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => setStatusOpen(true)} className="press flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-white px-4 text-[14px] font-semibold text-ink ring-1 ring-line">
              <ListChecks size={18} /> Status
            </button>
            <button type="button" onClick={onStart} className="press flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-linear-to-b from-brand-500 to-brand-600 text-[15.5px] font-bold text-white shadow-[0_12px_26px_rgba(31,111,232,0.35)]">
              Continue to billing <ArrowRight size={19} />
            </button>
          </div>
        )
      }
    >
      <div className="px-1 pb-4">
        <div className={`relative overflow-hidden rounded-[24px] p-4 ${r.urgency === 'Emergency' ? 'bg-linear-to-br from-[#fff0f0] to-[#ffd9d9]' : r.urgency === 'Urgent' ? 'bg-linear-to-br from-[#fff8ec] to-[#ffe6bf]' : 'bg-linear-to-br from-[#f2f7ff] to-[#dfeaff]'}`}>
          <Sticker name={r.urgency === 'Routine' ? 'clipboard' : 'heartPulse'} size={70} className="absolute right-3 top-3" />
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ring-white ${r.status === 'waiting' ? URGENT_TONE[r.urgency] : STATUS_PILL[r.status]}`}>
            {r.status === 'attended' ? <BadgeCheck size={14} /> : r.urgency === 'Routine' ? <Clock3 size={14} /> : <Siren size={14} />}
            {r.status === 'waiting' ? `${r.urgency} · waiting` : statusLabel(r)}
          </span>
          <p className="mt-2.5 max-w-[70%] text-[22px] font-extrabold leading-tight text-ink">{r.patient.name}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {r.patient.gender}, {r.patient.age} years · {r.patient.phone}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2">
              <Hash size={15} className="text-brand-600" />
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Referral ID</span>
                <span className="block text-[16px] font-bold tracking-wide text-brand-700">{r.id}</span>
              </span>
            </div>
            <button type="button" onClick={() => void copyText(r.id, 'Referral ID', showToast, { allow: true })} aria-label="Copy the referral ID" className="press flex min-h-11 items-center gap-1.5 rounded-2xl bg-white px-3 text-[13px] font-semibold text-brand-600 shadow-sm">
              <Copy size={15} /> Copy
            </button>
          </div>
        </div>

        {(r.update || r.closed || canUpdate) && (
          <div className={`mt-3 rounded-2xl p-3.5 ring-1 ${r.update ? 'bg-[#f6f2ff] ring-[#e4dbff]' : r.closed ? 'bg-page ring-line/70' : 'bg-white ring-line/70'}`}>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-muted">Referral status</span>
                <b className="block text-[15px] text-ink">{statusLabel(r)}</b>
                <span className="block text-[12.5px] leading-snug text-ink-2">
                  {r.update ? branchUpdateText(r.update) : r.closed ? 'Not updated during its week, so it closed as not attended.' : 'No update yet. Set one if the patient will come later or will not come.'}
                </span>
                {r.update && (
                  <span className="mt-1 block text-[11.5px] text-muted">
                    {r.update.by.name}, {r.update.by.role} · {new Date(r.update.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(r.update.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · the PR agent sees this
                  </span>
                )}
              </span>
              {canUpdate && (
                <button type="button" onClick={() => setStatusOpen(true)} className="press shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-[12.5px] font-semibold text-brand-700">
                  Update
                </button>
              )}
            </div>
          </div>
        )}

        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Referred by</p>
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <AgentAvatar id={r.agentId} name={r.agentName} size={46} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] text-ink">{r.agentName}</b>
            <span className="block truncate text-[12.5px] text-muted">{['PR agent', r.hospital].filter(Boolean).join(' · ')}</span>
          </span>
          <button type="button" onClick={() => navigate(onAsk ? `/messages/adm-pr-${r.agentId}` : `/branch/${r.branchId}/messages/${staffAgentId(r.agentId)}`)} aria-label={`Message ${r.agentName}`} className="press grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600">
            <MessageCircle size={18} />
          </button>
        </div>

        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Tests requested</p>
        <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line/70">
          {r.services.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
              <span className="min-w-0">
                <b className="block text-[14px] leading-snug text-ink">{s.name}</b>
                <span className="text-[12px] text-muted">{s.category}</span>
              </span>
              <b className="shrink-0 text-[14px] text-ink">{money(s.price)}</b>
            </li>
          ))}
          <li className="flex items-center justify-between px-3.5 py-3">
            <span className="text-[13px] font-semibold text-muted">Estimated total</span>
            <b className="text-[17px] text-ink">{money(total)}</b>
          </li>
        </ul>

        {r.priceAsk && (
          <div className="mt-4 rounded-2xl bg-[#faf7ff] p-3.5 ring-1 ring-[#e4dbff]">
            <p className="text-[13px] font-bold text-violet">The PR agent asked for {money(r.priceAsk.amount)} off</p>
            <p className="mt-0.5 text-[13px] text-ink-2">{r.priceAsk.reason}</p>
            <p className="mt-1 text-[12px] text-muted">It is filled in as a discount when you start the bill. The branch manager approves it.</p>
          </div>
        )}

        {(r.indication || r.note || r.voiceNote) && (
          <>
            <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">From the referrer</p>
            <div className="space-y-2 rounded-2xl bg-[#fffaf0] p-3.5 ring-1 ring-[#f6e5bf]">
              {r.indication && (
                <p className="flex gap-2 text-[13.5px] text-ink">
                  <Stethoscope size={16} className="mt-0.5 shrink-0 text-[#b45309]" />
                  <span>
                    <b>Reason for the tests:</b> {r.indication}
                  </span>
                </p>
              )}
              {r.note && (
                <p className="text-[13.5px] text-ink-2">
                  <b className="text-ink">Note:</b> {r.note}
                </p>
              )}
              {r.voiceNote && <VoiceNote seed={Number(r.id.replace(/\D/g, ''))} duration={r.voiceNote.duration} by={r.agentName} />}
            </div>
          </>
        )}

        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Progress</p>
        <ol className="relative ml-2 border-l-2 border-line pl-4">
          <Step on title="Referral sent" sub={`${r.sentAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${r.sentAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} by ${r.agentName}`} />
          {r.update ? (
            <Step on title={STATUS_TEXT[r.update.status]} sub={branchUpdateText(r.update)} />
          ) : (
            <Step on={r.status === 'billing' || r.status === 'attended'} title={r.status === 'billing' || r.status === 'attended' ? 'Patient arrived, bill started' : r.closed ? 'Closed as not attended' : 'Waiting for the patient to arrive'} sub={r.status === 'waiting' ? 'Start the bill when they come in' : undefined} />
          )}
          <Step on={r.status === 'attended'} title="Attended" sub={r.attended ? `${r.attended.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${r.attended.invoiceNo ? ` · ${r.attended.invoiceNo}` : ''}${r.attended.by ? ` · ${r.attended.by}` : ''}` : 'Saved bill with this referral ID'} />
        </ol>
        <a href={`tel:${r.patient.phone}`} className="press mt-4 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-brand-600 ring-1 ring-line">
          <Phone size={16} /> Call the patient
        </a>
      </div>
      {statusOpen && <StatusSheet r={r} onClose={() => setStatusOpen(false)} />}
    </Sheet>
  );
}

function Step({ on, title, sub }: { on: boolean; title: string; sub?: string }) {
  return (
    <li className="relative pb-3 last:pb-0">
      <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${on ? 'bg-good' : 'bg-[#c3cede]'}`} />
      <p className={`text-[13.5px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>{title}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </li>
  );
}

/** The folder plus its slide-ups, wired to Billing (used on the dashboard and the Billing start screen). */
export function IncomingEntry({ branchId }: { branchId: string }) {
  const { navigate } = useCompany();
  const [open, setOpen] = useState(false);
  const bill = (q: string) => {
    setOpen(false);
    navigate(`/branch/${branchId}/billing?${q}`);
  };
  return (
    <>
      <IncomingFolder branchId={branchId} onOpen={() => setOpen(true)} />
      {open && (
        <IncomingSheet
          branchId={branchId}
          onClose={() => setOpen(false)}
          onStart={(r) => bill(`incoming=${encodeURIComponent(r.id)}`)}
          onResume={(id) => bill(`draft=${encodeURIComponent(id)}`)}
          onNewBill={(name) => bill(`new=1${name ? `&name=${encodeURIComponent(name)}` : ''}`)}
          onEnterId={() => bill('refid=1')}
        />
      )}
    </>
  );
}


/* ─────────────── status update ─────────────── */

const STATUS_CHOICES: { k: BranchUpdateKind | 'waiting'; title: string; sub: string; sticker: StickerKey }[] = [
  { k: 'waiting', title: 'Still waiting', sub: 'No news yet. Keeps it in the folder.', sticker: 'watch' },
  { k: 'coming', title: 'Coming later', sub: 'The patient said when they will come', sticker: 'calendar' },
  { k: 'no_show', title: 'Did not come', sub: 'Closes it as not attended', sticker: 'bell' },
  { k: 'cancelled', title: 'Cancelled', sub: 'The patient or the referrer cancelled', sticker: 'clipboard' },
];

/** The front desk or manager says what happened. The PR agent sees it on their request. */
function StatusSheet({ r, onClose }: { r: Incoming; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const [k, setK] = useState<BranchUpdateKind | 'waiting'>(r.update?.status ?? 'waiting');
  const [date, setDate] = useState(r.update?.date ?? '');
  const [note, setNote] = useState(r.update?.note ?? '');
  const [tried, setTried] = useState(false);
  const today = isoDate(new Date());
  const err = k === 'coming' && !date ? 'Choose the day the patient said they will come.' : k === 'cancelled' && note.trim().length < 3 ? 'Say why it was cancelled.' : null;
  const save = () => {
    if (err) return setTried(true);
    setBranchUpdate(r.id, k === 'waiting' ? null : { status: k, date: k === 'coming' ? date : undefined, note: note.trim() || undefined, by: { name: user.name, role: user.role }, at: new Date().toISOString() });
    logAudit({ category: 'PR agents', action: k === 'waiting' ? 'Referral status cleared' : `Referral status: ${STATUS_TEXT[k]}`, record: `${r.patient.name} (${r.id})`, details: [k === 'coming' && date ? `coming on ${date}` : '', note.trim(), `referred by ${r.agentName}`].filter(Boolean).join(' · '), branchId: r.branchId });
    showToast(k === 'waiting' ? 'Status cleared' : `${STATUS_TEXT[k]} saved. ${r.agentName} can see it.`);
    onClose();
  };
  return (
    <Sheet
      back
      title="Referral status"
      subtitle={`${r.patient.name} · ${r.id}`}
      onClose={onClose}
      footer={
        <button type="button" onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          Save status
        </button>
      }
    >
      <div className="px-1 pb-3">
        <div role="radiogroup" aria-label="Status" className="space-y-2">
          {STATUS_CHOICES.map((c) => (
            <button key={c.k} type="button" role="radio" aria-checked={k === c.k} onClick={() => setK(c.k)} className={`press flex w-full items-center gap-3 rounded-2xl p-3 text-left ${k === c.k ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
              <Sticker name={c.sticker} size={34} />
              <span className="min-w-0 flex-1">
                <b className="block text-[14.5px] text-ink">{c.title}</b>
                <span className="block text-[12.5px] text-muted">{c.sub}</span>
              </span>
              <span className={`grid h-5 w-5 place-items-center rounded-full ${k === c.k ? 'bg-brand-600 text-white' : 'ring-2 ring-[#d3dce9]'}`}>{k === c.k && <Check size={12} strokeWidth={3} />}</span>
            </button>
          ))}
        </div>
        {k === 'coming' && (
          <label className="mt-3 block">
            <FieldLabel label="The day they will come" required />
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={inputCls(tried && !date ? err : null)} />
          </label>
        )}
        {k !== 'waiting' && (
          <div className="mt-3">
            <LongText label={k === 'cancelled' ? 'Reason' : 'Note'} required={k === 'cancelled'} optional={k !== 'cancelled'} value={note} onChange={setNote} max={200} minRows={2} placeholder={k === 'coming' ? 'For example: will come after work on Friday' : k === 'no_show' ? 'For example: called twice, no answer' : 'For example: the doctor changed the tests'} />
          </div>
        )}
        {tried && err && <FieldErr msg={err} />}
        <p className="mt-3 text-[12.5px] text-muted">The PR agent who referred the patient sees this status, so they can follow up.</p>
      </div>
    </Sheet>
  );
}

/* ─────────────── referral history ─────────────── */

/**
 * Every referral, week by week (owner, 2026-11-25): the folder only holds
 * this week; older referrals are kept here with their status, never deleted.
 */
export function ReferralHistory({ branchIds, onClose, onStart, onResume, admin }: { branchIds: string[]; onClose: () => void; onStart?: (r: Incoming) => void; onResume?: (draftId: string) => void; admin?: boolean }) {
  const { navigate } = useCompany();
  const list = useIncomingMany(branchIds);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'attended' | 'not'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [shownWeeks, setShownWeeks] = useState(4);
  // Date filter (owner, 2026-11-25): any dates, a quick period, or from and to.
  const [when, setWhen] = useState<'any' | 'week' | 'last' | 'month' | '4w' | 'custom'>('any');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const bounds = useMemo((): [number, number] => {
    const now = new Date();
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const wk = weekStart().getTime();
    if (when === 'week') return [wk, Infinity];
    if (when === 'last') return [wk - 7 * DAY, wk];
    if (when === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), Infinity];
    if (when === '4w') return [day0 - 27 * DAY, Infinity];
    if (when === 'custom') return [from ? new Date(`${from}T00:00:00`).getTime() : -Infinity, to ? new Date(`${to}T00:00:00`).getTime() + DAY : Infinity];
    return [-Infinity, Infinity];
  }, [when, from, to]);
  const t = q.trim().toLowerCase();
  const pass = (r: Incoming) =>
    r.sentAt.getTime() >= bounds[0] &&
    r.sentAt.getTime() < bounds[1] &&
    (filter === 'all' || (filter === 'open' && isOpen(r)) || (filter === 'attended' && r.status === 'attended') || (filter === 'not' && (r.status === 'no_show' || r.status === 'cancelled'))) &&
    (!t || [r.patient.name, r.patient.phone, r.id, r.agentName, r.hospital, getBranch(r.branchId)?.name ?? ''].join(' ').toLowerCase().includes(t));
  const weeks = useMemo(() => {
    const m = new Map<number, Incoming[]>();
    for (const r of list) {
      const w = weekStart(r.sentAt).getTime();
      m.set(w, [...(m.get(w) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [list]);
  const multi = branchIds.length > 1;
  const current = open ? list.find((r) => `${r.id}|${r.branchId}` === open) ?? null : null;
  const thisMonday = weekStart().getTime();
  return (
    <Sheet back title="Referral history" subtitle={`${formatCount(list.length)} referrals · last ${weeks.length} weeks`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Patient, phone, referral ID or agent' }}>
      <div className="px-1 pb-4">
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Status">
          {(
            [
              ['all', 'All'],
              ['open', 'Open'],
              ['attended', 'Attended'],
              ['not', 'Not attended or cancelled'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`press min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${filter === k ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Dates">
          {(
            [
              ['any', 'Any date'],
              ['week', 'This week'],
              ['last', 'Last week'],
              ['month', 'This month'],
              ['4w', 'Last 4 weeks'],
              ['custom', 'Choose dates'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={when === k} onClick={() => setWhen(k)} className={`press flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${when === k ? 'bg-ink text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
              {k === 'custom' && <CalendarDays size={14} />}
              {l}
            </button>
          ))}
        </div>
        {when === 'custom' && (
          <div className="drop-down mb-3 grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[12.5px] text-muted">From</span>
              <input type="date" value={from} max={to || isoDate(new Date())} onChange={(e) => setFrom(e.target.value)} className={inputCls()} />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[12.5px] text-muted">To</span>
              <input type="date" value={to} min={from || undefined} max={isoDate(new Date())} onChange={(e) => setTo(e.target.value)} className={inputCls()} />
            </label>
          </div>
        )}
        {weeks.slice(0, t || when !== 'any' ? weeks.length : shownWeeks).map(([w, rows]) => {
          const shown = rows.filter(pass);
          if (!shown.length) return null;
          const att = rows.filter((r) => r.status === 'attended').length;
          const rate = rows.length ? Math.round((att / rows.length) * 100) : 0;
          const end = new Date(w + 6 * DAY);
          return (
            <section key={w} className="mb-4">
              <div className="mb-2 rounded-2xl bg-white p-3 ring-1 ring-line/70">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-[14.5px] text-ink">{w === thisMonday ? 'This week' : `Week of ${new Date(w).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}</b>
                  <span className="text-[12.5px] text-muted">
                    {formatCount(att)} of {formatCount(rows.length)} attended
                  </span>
                </div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-page">
                  <span className={`block h-full rounded-full ${rate >= 70 ? 'bg-good' : rate >= 45 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`} style={{ width: `${rate}%` }} />
                </span>
              </div>
              <ul className="space-y-2">
                {shown.map((r) => (
                  <li key={`${r.id}|${r.branchId}`}>
                    <Slip r={r} showBranch={multi} onOpen={() => setOpen(`${r.id}|${r.branchId}`)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!t && when === 'any' && shownWeeks < weeks.length && (
          <button type="button" onClick={() => setShownWeeks((n) => n + 4)} className="press min-h-12 w-full rounded-2xl bg-white text-[14px] font-semibold text-brand-600 ring-1 ring-line">
            Show earlier weeks
          </button>
        )}
        {!list.some(pass) && <p className="py-10 text-center text-[14px] text-muted">No referral matches these filters.</p>}
      </div>
      {current && (
        <IncomingDetail
          r={current}
          onClose={() => setOpen(null)}
          onStart={() => onStart?.(current)}
          onResume={() => current.draftId && onResume?.(current.draftId)}
          onAsk={admin ? () => navigate(`/messages/adm-fd-${current.branchId}`) : undefined}
        />
      )}
    </Sheet>
  );
}

/** Records page entry (staff and admin): opens Referral history. */
export function ReferralHistoryCard({ branchIds, admin }: { branchIds: string[]; admin?: boolean }) {
  const { navigate } = useCompany();
  const [open, setOpen] = useState(false);
  const list = useIncomingMany(branchIds);
  const older = list.filter((r) => r.sentAt < weekStart());
  const att = older.filter((r) => r.status === 'attended').length;
  const bill = (q: string) => navigate(`/branch/${branchIds[0]}/billing?${q}`);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press mb-3 flex w-full items-center gap-3 rounded-[22px] bg-linear-to-br from-[#fff9ec] to-[#ffefcc] p-3.5 text-left ring-1 ring-[#f6e1b3]">
        <Sticker name="books" size={46} />
        <span className="min-w-0 flex-1">
          <b className="block text-[15.5px] text-ink">Referral history</b>
          <span className="block text-[12.5px] text-[#7a4a00]">
            {formatCount(older.length)} earlier referrals · {older.length ? Math.round((att / older.length) * 100) : 0}% attended
          </span>
        </span>
        <ChevronRight size={19} className="text-[#b07a1e]" />
      </button>
      {open && <ReferralHistory branchIds={branchIds} admin={admin} onClose={() => setOpen(false)} onStart={admin ? undefined : (r) => bill(`incoming=${encodeURIComponent(r.id)}`)} onResume={admin ? undefined : (id) => bill(`draft=${encodeURIComponent(id)}`)} />}
    </>
  );
}


/* ─────────────── the PR agent's voice note ─────────────── */

/** The referrer's voice note: play, pause, a waveform that fills as it plays, and the time left. */
function VoiceNote({ seed, duration, by }: { seed: number; duration: number; by: string }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setPos((p) => (p + 0.1 >= duration ? (setPlaying(false), 0) : p + 0.1)), 100);
    return () => window.clearInterval(t);
  }, [playing, duration]);
  const bars = Array.from({ length: 30 }, (_, i) => 6 + (hash(seed * 31 + i) % 20));
  const done = pos / duration;
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-[#f3dfb6]">
      <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause the voice note' : 'Play the voice note'} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-linear-to-b from-[#ffb21f] to-[#f08c00] text-white shadow-[0_6px_14px_rgba(214,128,8,0.35)]">
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <span className="min-w-0 flex-1">
        <span className="flex h-7 items-center gap-[3px]" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} className={`w-[3px] rounded-full transition-colors ${i / bars.length < done ? 'bg-[#f08c00]' : 'bg-[#f1dcb4]'}`} style={{ height: h }} />
          ))}
        </span>
        <span className="mt-0.5 flex justify-between text-[11.5px] text-muted">
          <span>Voice note from {by}</span>
          <span>{fmt(playing || pos ? duration - pos : duration)}</span>
        </span>
      </span>
    </div>
  );
}
