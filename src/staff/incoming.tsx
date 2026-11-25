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
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronRight, Clock3, FilePlus2, Hash, MessageCircle, Phone, Search, Siren, Stethoscope } from 'lucide-react';
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

export type Urgency = 'Routine' | 'Urgent' | 'Emergency';
export type IncomingStatus = 'waiting' | 'billing' | 'attended';

export interface Incoming {
  id: string;
  branchId: string;
  sentAt: Date;
  patient: { name: string; phone: string; gender: 'Male' | 'Female'; age: number };
  agentId: number;
  agentName: string;
  hospital: string;
  services: SelectedService[];
  urgency: Urgency;
  indication?: string;
  note?: string;
  status: IncomingStatus;
  /** When the patient was attended (bill saved), and by whom / which invoice. */
  attended?: { at: Date; invoiceNo?: string; by?: string };
  /** The open bill (draft) for this referral. */
  draftId?: string;
}

const hash = (n: number) => {
  let h = (n * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
};
const DAY = 86_400_000;
const FEMALE = new Set(['Adaeze', 'Aisha', 'Amaka', 'Amina', 'Bola', 'Chiamaka', 'Chioma', 'Esther', 'Fatima', 'Funke', 'Grace', 'Halima', 'Ifeoma', 'Joy', 'Kemi', 'Ladi', 'Maryam', 'Nkechi', 'Ngozi', 'Nneka', 'Ronke', 'Yetunde', 'Zainab', 'Blessing', 'Hauwa', 'Rukayat', 'Hadiza']);
const INDICATIONS = ['Persistent cough for three weeks', 'Abdominal pain, right upper side', 'Follow up after treatment', 'Fever and body weakness for five days', 'Antenatal check, second trimester', 'Routine screening before surgery', 'Headache and dizziness', 'Painful swelling of the right knee', 'Suspected urinary tract infection', 'High blood pressure review'];
const NOTES = ['Patient is fasting since last night.', 'Please call me when the results are ready.', 'Elderly patient, comes with a relative.', 'Patient has an HMO card.', 'Repeat test after two weeks of treatment.'];

/** Age in words, "12 min ago". */
export function ago(d: Date, now = new Date()) {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** The branch's incoming referrals, newest first, with their live status. */
export const useIncoming = (branchId: string): Incoming[] => useIncomingMany(useMemo(() => [branchId], [branchId]));

/** Incoming referrals for several branches (the Company Admin's view), newest first. */
export function useIncomingMany(branchIds: string[]): Incoming[] {
  const { agents, inventory } = useCompany();
  const billing = useBilling();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const minute = Math.floor(now.getTime() / 60_000);
  const key = branchIds.join(',');
  const items = useMemo(() => buildItems(inventory), [inventory]);
  const labels = useMemo(() => new Map(groupCategories(items, inventory.categoryNames).map((g) => [g.key, g.label])), [items, inventory.categoryNames]);
  const pools = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const range = resolveRange({ key: 'custom', from: isoDate(addDays(new Date(), -59)), to: isoDate(new Date()) });
    return new Map(
      branchIds.map((id) => {
        const ranked = serviceRanking([id], range)
          .map((r) => byId.get(r.id))
          .filter((i): i is Item => !!i && i.price !== null)
          .slice(0, 60);
        return [id, ranked.length ? ranked : items.filter((i) => i.price !== null).slice(0, 60)] as const;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, items]);

  const base = useMemo(() => {
    const out: Omit<Incoming, 'status' | 'attended' | 'draftId'>[] = [];
    if (!agents.length) return out;
    const nowD = new Date(minute * 60_000);
    const today0 = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
    for (const branchId of branchIds) {
      const pool = pools.get(branchId) ?? [];
      if (!pool.length) continue;
      const prefix = branchPrefix(branchId);
      const salt = [...branchId].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 9973;
      for (let d = 2; d >= 0; d--) {
        const dayStart = today0 - d * DAY;
        const dayNo = Math.floor(dayStart / DAY);
        const n = 4 + (hash(dayNo + salt) % 4);
        for (let k = 0; k < n; k++) {
          const seed = dayNo * 16 + k;
          const h = hash(seed + salt * 1_000_003);
          // Sent between 07:30 and 18:30, spread through the day.
          const sentAt = new Date(dayStart + (7.5 * 60 + Math.floor((k + (h % 100) / 100) * (660 / n))) * 60_000);
          if (sentAt.getTime() > nowD.getTime()) continue;
          const ag = agents[h % agents.length]!;
          const count = 1 + (h % 3 === 0 ? 1 : 0) + (h % 7 === 0 ? 1 : 0);
          const services: SelectedService[] = [];
          for (let j = 0; j < count; j++) {
            const it = pool[hash(h + j * 7919) % pool.length]!;
            if (!services.some((x) => x.id === it.id)) services.push({ id: it.id, name: it.name, category: labels.get(it.category) ?? it.category, price: it.price!, overridePrice: null });
          }
          const name = patientNameOf(700_000 + (h % 900_000));
          const imaging = services.some((x) => !/lab/i.test(x.category));
          out.push({
            id: `${prefix}-R${String(400_000 + (seed % 500_000)).padStart(6, '0')}`,
            branchId,
            sentAt,
            patient: { name, phone: `080${String(hash(h * 5) % 100_000_000).padStart(8, '0')}`, gender: FEMALE.has(name.split(' ')[0]!) ? 'Female' : 'Male', age: 18 + (h % 58) },
            agentId: ag.id,
            agentName: ag.name,
            hospital: hospitalKey(ag.hospital) || ag.hospital,
            services,
            urgency: h % 23 === 0 ? 'Emergency' : h % 6 === 0 ? 'Urgent' : 'Routine',
            indication: imaging || h % 4 === 0 ? INDICATIONS[h % INDICATIONS.length] : undefined,
            note: h % 5 === 0 ? NOTES[h % NOTES.length] : undefined,
          });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, pools, labels, key, minute]);

  return useMemo(() => {
    const nowT = minute * 60_000;
    return base
      .map((r): Incoming => {
        const order = billing.orders.find((o) => o.branchId === r.branchId && o.referral.referralId === r.id);
        if (order) return { ...r, status: 'attended', attended: { at: new Date(order.createdAt), invoiceNo: order.invoiceNo, by: order.createdBy.name } };
        const draft = billing.drafts.find((x) => x.branchId === r.branchId && x.referralId === r.id);
        if (draft) return { ...r, status: 'billing', draftId: draft.id };
        // Demo: most patients arrive within a few hours of the referral (the older ones are already attended).
        const h = hash(Number(r.id.replace(/\D/g, '')) + r.branchId.length);
        const arrive = r.sentAt.getTime() + (40 + (h % 200)) * 60_000;
        const age = nowT - r.sentAt.getTime();
        if (age > 150 * 60_000 && h % 4 !== 0 && arrive <= nowT) return { ...r, status: 'attended', attended: { at: new Date(arrive) } };
        return { ...r, status: 'waiting' };
      })
      .sort((x, y) => y.sentAt.getTime() - x.sentAt.getTime());
  }, [base, billing.orders, billing.drafts, minute]);
}

export const findIncoming = (list: Incoming[], id: string) => list.find((r) => r.id.toUpperCase() === id.trim().toUpperCase()) ?? null;

const URGENT_TONE: Record<Urgency, string> = { Routine: 'bg-page text-ink-2', Urgent: 'bg-[#fff1de] text-[#b45309]', Emergency: 'bg-[#ffe4e4] text-[#b42318]' };
const STRIP: Record<Urgency, string> = { Routine: 'bg-brand-400', Urgent: 'bg-[#f59e0b]', Emergency: 'bg-[#ef4444]' };

/* ─────────────── the folder on the dashboard ─────────────── */

export function IncomingFolder({ branchId, onOpen }: { branchId: string; onOpen: () => void }) {
  const list = useIncoming(branchId);
  const waiting = list.filter((r) => r.status !== 'attended');
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
              {n ? `${formatCount(n)} waiting · newest ${ago(waiting[0]!.sentAt)}` : 'Everyone referred has been attended'}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {urgent > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[#b42318] px-2 py-0.5 text-[11.5px] font-bold text-white">
                  <Siren size={12} /> {urgent} urgent
                </span>
              )}
              <span className="rounded-full bg-white/55 px-2 py-0.5 text-[11.5px] font-semibold text-[#5c3700]">{formatCount(today.length)} sent today</span>
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
  const list = useIncoming(branchId);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'waiting' | 'attended' | 'all'>('waiting');
  const [open, setOpen] = useState<string | null>(null);
  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, '');
  const matches = (r: Incoming) => !t || [r.patient.name, r.patient.phone, r.id, r.agentName, r.hospital, ...r.services.map((s) => s.name)].join(' ').toLowerCase().includes(t) || (digits.length >= 3 && (r.id.replace(/\D/g, '').includes(digits) || r.patient.phone.includes(digits)));
  const waiting = list.filter((r) => r.status !== 'attended');
  const attended = list.filter((r) => r.status === 'attended');
  const base = t ? list : tab === 'waiting' ? waiting : tab === 'attended' ? attended : list;
  const shown = base.filter(matches);
  const current = open ? list.find((r) => r.id === open) ?? null : null;
  return (
    <Sheet title="Incoming referrals" subtitle={`${formatCount(waiting.length)} waiting · ${getBranch(branchId)?.name ?? ''} branch`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Patient name, phone, referral ID or agent' }}>
      <div className="px-1 pb-4">
        {!t && (
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-page p-1" role="tablist">
            {(
              [
                ['waiting', `Waiting ${waiting.length}`],
                ['attended', `Attended ${attended.length}`],
                ['all', `All ${list.length}`],
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
          <button type="button" onClick={onEnterId} className="press mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-left">
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
    </Sheet>
  );
}

export function Slip({ r, onOpen, showBranch }: { r: Incoming; onOpen: () => void; showBranch?: boolean }) {
  const done = r.status === 'attended';
  return (
    <button type="button" onClick={onOpen} className={`press relative flex w-full gap-3 overflow-hidden rounded-[20px] bg-white p-3.5 pl-4 text-left ring-1 ${done ? 'ring-line/70' : 'ring-[#f3dfb6] shadow-[0_6px_16px_rgba(214,128,8,0.1)]'}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${done ? 'bg-good' : STRIP[r.urgency]}`} />
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
          {r.urgency !== 'Routine' && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${URGENT_TONE[r.urgency]}`}>{r.urgency}</span>}
          {r.status === 'billing' && <span className="rounded-full bg-[#e8f1ff] px-2 py-0.5 text-[11.5px] font-bold text-brand-700">Bill started</span>}
          {done && <span className="rounded-full bg-[#e9f9ef] px-2 py-0.5 text-[11.5px] font-bold text-good-ink">Attended{r.attended?.invoiceNo ? ` · ${r.attended.invoiceNo}` : ''}</span>}
          {r.status === 'waiting' && Date.now() - r.sentAt.getTime() > DAY && <span className="rounded-full bg-[#fff1de] px-2 py-0.5 text-[11.5px] font-bold text-[#b45309]">Not arrived yet</span>}
        </span>
      </span>
    </button>
  );
}

export function IncomingDetail({ r, onClose, onStart, onResume, onAsk }: { r: Incoming; onClose: () => void; onStart: () => void; onResume: () => void; /** Company Admin: ask the branch about this referral instead of billing it. */ onAsk?: () => void }) {
  const { navigate } = useCompany();
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
          <button type="button" onClick={onStart} className="press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-b from-brand-500 to-brand-600 text-[15.5px] font-bold text-white shadow-[0_12px_26px_rgba(31,111,232,0.35)]">
            <FilePlus2 size={19} /> Patient is here: start the bill
          </button>
        )
      }
    >
      <div className="px-1 pb-4">
        <div className={`relative overflow-hidden rounded-[24px] p-4 ${r.urgency === 'Emergency' ? 'bg-linear-to-br from-[#fff0f0] to-[#ffd9d9]' : r.urgency === 'Urgent' ? 'bg-linear-to-br from-[#fff8ec] to-[#ffe6bf]' : 'bg-linear-to-br from-[#f2f7ff] to-[#dfeaff]'}`}>
          <Sticker name={r.urgency === 'Routine' ? 'clipboard' : 'heartPulse'} size={70} className="absolute right-3 top-3" />
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ring-white ${r.status === 'attended' ? 'bg-[#e9f9ef] text-good-ink' : r.status === 'billing' ? 'bg-white text-brand-700' : URGENT_TONE[r.urgency]}`}>
            {r.status === 'attended' ? <BadgeCheck size={14} /> : r.urgency === 'Routine' ? <Clock3 size={14} /> : <Siren size={14} />}
            {r.status === 'attended' ? 'Attended' : r.status === 'billing' ? 'Bill started' : `${r.urgency} · waiting`}
          </span>
          <p className="mt-2.5 max-w-[70%] text-[22px] font-extrabold leading-tight text-ink">{r.patient.name}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {r.patient.gender}, {r.patient.age} years · {r.patient.phone}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2">
            <Hash size={15} className="text-brand-600" />
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Referral ID</span>
              <span className="block text-[16px] font-bold tracking-wide text-brand-700">{r.id}</span>
            </span>
          </div>
        </div>

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

        {(r.indication || r.note) && (
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
              {r.note && <p className="text-[13.5px] text-ink-2">{r.note}</p>}
            </div>
          </>
        )}

        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Progress</p>
        <ol className="relative ml-2 border-l-2 border-line pl-4">
          <Step on title="Referral sent" sub={`${r.sentAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${r.sentAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} by ${r.agentName}`} />
          <Step on={r.status !== 'waiting'} title={r.status === 'waiting' ? 'Waiting for the patient to arrive' : 'Patient arrived, bill started'} sub={r.status === 'waiting' ? 'Start the bill when they come in' : undefined} />
          <Step on={r.status === 'attended'} title="Attended" sub={r.attended ? `${r.attended.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${r.attended.invoiceNo ? ` · ${r.attended.invoiceNo}` : ''}${r.attended.by ? ` · ${r.attended.by}` : ''}` : 'Saved bill with this referral ID'} />
        </ol>
        <a href={`tel:${r.patient.phone}`} className="press mt-4 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold text-brand-600 ring-1 ring-line">
          <Phone size={16} /> Call the patient
        </a>
      </div>
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
