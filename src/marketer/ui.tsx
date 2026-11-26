/**
 * Shared marketer pieces: the workspace context (one data load for pages and
 * slide-ups), agent quick actions (call, WhatsApp, chat, copy the number),
 * and charts that animate the first time they scroll into view, like the
 * other dashboards (admin/charts: useSeen, CountUp).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { Copy, MessageCircle, MessagesSquare, Phone } from 'lucide-react';
import type { AgentHealth, AgentStatus } from '@company/services/agentMonitor';
import { STATUS_LABEL } from '@company/services/agentMonitor';
import type { HospitalInfo } from '@company/services/marketing';
import type { StaffRecord } from '@company/data/userRecords';
import { hasPhone } from '@company/data/legacy';
import { useNav } from '@/app/store';
import { copyText } from '@/ui/privacy';
import { AgentAvatar } from '@/admin/agentPhotos';
import { useSeen } from '@/admin/charts';
import { daysText, dial, waLink, type Mine } from './data';

export interface MarketerCtxValue {
  m: Mine;
  me: StaffRecord;
  go: (page: string) => void;
  openAgent: (a: AgentHealth) => void;
  openHospital: (h: HospitalInfo) => void;
  openRegister: () => void;
  openLog: () => void;
  /** Hospitals with the agents to follow up in each, then the agents there. */
  openFollow: () => void;
  /** Open the in-app chat with a PR agent. */
  chat: (agentId: number) => void;
}
export const MarketerCtx = createContext<MarketerCtxValue | null>(null);
export function useMk(): MarketerCtxValue {
  const v = useContext(MarketerCtx);
  if (!v) throw new Error('useMk outside the marketer workspace');
  return v;
}

/* ─────────────── agents ─────────────── */

export const STATUS_TONE: Record<AgentStatus, string> = {
  top: 'bg-[#e6f8ee] text-good-ink',
  rising: 'bg-[#e6f8ee] text-good-ink',
  steady: 'bg-brand-50 text-brand-700',
  slipping: 'bg-[#fff1de] text-[#b45309]',
  quiet: 'bg-[#ffe4e4] text-[#b42318]',
  inactive: 'bg-page text-ink-2',
  never: 'bg-page text-muted',
};
export const STATUS_COLOR: Record<AgentStatus, string> = { top: '#16a34a', rising: '#22c55e', steady: '#1f6fe8', slipping: '#f59e0b', quiet: '#ef4444', inactive: '#94a3b8', never: '#cbd5e1' };
export const NEEDS: AgentStatus[] = ['slipping', 'quiet', 'inactive'];
export const GOOD: AgentStatus[] = ['top', 'rising', 'steady'];

export function StatusPill({ s }: { s: AgentStatus }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>;
}

/** Call, WhatsApp, in-app chat and copy the number, for one PR agent. */
export function AgentActions({ a, big }: { a: AgentHealth; big?: boolean }) {
  const { chat } = useMk();
  const { showToast } = useNav();
  const phone = hasPhone(a.agent.phone) ? a.agent.phone : null;
  const cls = big ? 'press flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/85 text-[11.5px] font-semibold' : 'press grid h-9 w-9 place-items-center rounded-full bg-page';
  const off = 'pointer-events-none opacity-35';
  return (
    <div className={big ? 'grid grid-cols-4 gap-2' : 'flex shrink-0 items-center gap-1'} onClick={(e) => e.stopPropagation()}>
      <a href={phone ? `tel:${dial(phone)}` : undefined} aria-label={`Call ${a.agent.name}`} className={`${cls} text-brand-700 ${phone ? '' : off}`}>
        <Phone size={big ? 19 : 15} />
        {big && 'Call'}
      </a>
      <a href={phone ? waLink(phone) : undefined} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${a.agent.name}`} className={`${cls} text-[#128c4b] ${phone ? '' : off}`}>
        <MessageCircle size={big ? 19 : 15} />
        {big && 'WhatsApp'}
      </a>
      <button type="button" onClick={() => chat(a.agent.id)} aria-label={`Chat with ${a.agent.name}`} className={`${cls} text-violet`}>
        <MessagesSquare size={big ? 19 : 15} />
        {big && 'Chat'}
      </button>
      {big && (
        <button type="button" onClick={() => phone && copyText(phone, 'Phone number', showToast)} aria-label="Copy phone number" className={`${cls} text-ink-2 ${phone ? '' : off}`}>
          <Copy size={18} />
          Copy no.
        </button>
      )}
    </div>
  );
}

/** One PR agent in a list: photo, name, last referral, status, and quick call/chat. */
export function AgentRow({ a, sub, quick = true }: { a: AgentHealth; sub?: ReactNode; quick?: boolean }) {
  const { openAgent } = useMk();
  return (
    <div role="button" tabIndex={0} onClick={() => openAgent(a)} onKeyDown={(e) => e.key === 'Enter' && openAgent(a)} className="press flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 text-left">
      <AgentAvatar id={a.agent.id} name={a.agent.name} phone={a.agent.phone} size={42} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <b className="min-w-0 truncate text-[14.5px] text-ink">{a.agent.name}</b>
        </span>
        <span className="block truncate text-[12px] text-muted">{sub ?? `${a.hospital} · ${daysText(a.daysSince)}`}</span>
        <span className="mt-1 inline-block">
          <StatusPill s={a.status} />
        </span>
      </span>
      {quick && <AgentActions a={a} />}
    </div>
  );
}

/* ─────────────── charts that grow into view ─────────────── */

/** Progress bar that fills when it scrolls into view, with an even-pace marker. */
export function GrowBar({ pct, pace, tone = 'auto', className = 'h-2.5 bg-page' }: { pct: number; pace?: number; tone?: 'auto' | 'white'; className?: string }) {
  const { ref, seen } = useSeen<HTMLSpanElement>();
  const color = tone === 'white' ? 'bg-white' : pct >= 1 ? 'bg-[#22a06b]' : pace == null || pct >= pace ? 'bg-brand-500' : pct >= pace * 0.8 ? 'bg-[#f2a93b]' : 'bg-[#ef4444]';
  return (
    <span ref={ref} className={`relative block overflow-visible rounded-full ${className}`}>
      <i className={`block h-full rounded-full ${color} transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]`} style={{ width: seen ? `${Math.min(100, pct * 100)}%` : '0%' }} />
      {pace != null && pace < 1 && <span className={`absolute -top-1 bottom-[-4px] w-[3px] rounded-full ${tone === 'white' ? 'bg-[#ffd166]' : 'bg-ink/45'}`} style={{ left: `calc(${pace * 100}% - 1.5px)` }} title="Even pace by today" />}
    </span>
  );
}

/** Vertical bars (value against an optional target) that grow when seen; tap a bar to read it. */
export function GrowBars({ items, format, height = 150, note }: { items: { label: string; value: number; target?: number; sub?: string }[]; format: (n: number) => string; height?: number; note?: ReactNode }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const max = Math.max(...items.map((i) => Math.max(i.value, i.target ?? 0)), 1);
  return (
    <div ref={ref}>
      <div className="flex items-end gap-2" style={{ height }}>
        {items.map((it, i) => {
          const hit = it.target != null && it.value >= it.target;
          return (
            <div key={it.label + i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${it.label}: ${format(it.value)}${it.target != null ? ` of ${format(it.target)}` : ''}`}>
              <span className={`text-[10.5px] font-bold transition-opacity duration-500 ${hit ? 'text-good-ink' : 'text-ink-2'}`} style={{ opacity: seen ? 1 : 0, transitionDelay: `${500 + i * 80}ms` }}>
                {it.target != null && it.target > 0 ? `${Math.round((it.value / it.target) * 100)}%` : format(it.value)}
              </span>
              <span className="relative flex w-full flex-1 items-end justify-center gap-[3px]">
                {it.target != null && <i className="w-[38%] max-w-4 rounded-t-md bg-[#e8eef8] transition-[height] duration-[900ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]" style={{ height: seen ? `${(it.target / max) * 100}%` : '0%', transitionDelay: `${i * 70}ms` }} />}
                <i className={`${it.target != null ? 'w-[38%] max-w-4' : 'w-[60%] max-w-7'} rounded-t-md ${hit ? 'bg-linear-to-t from-[#16a34a] to-[#4ade80]' : 'bg-linear-to-t from-brand-600 to-brand-400'} transition-[height] duration-[1000ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]`} style={{ height: seen ? `${Math.max(2, (it.value / max) * 100)}%` : '0%', transitionDelay: `${120 + i * 70}ms` }} />
              </span>
              <span className="w-full truncate text-center text-[10.5px] font-semibold text-muted">{it.label}</span>
            </div>
          );
        })}
      </div>
      {note && <div className="mt-2 text-[11.5px] text-muted">{note}</div>}
    </div>
  );
}

/** A ring that sweeps round when seen (target share), with the text in the middle. */
export function GrowRing({ pct, pace, size = 112, stroke = 11, light, children }: { pct: number; pace?: number; size?: number; stroke?: number; light?: boolean; children?: ReactNode }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, pct);
  const a = (pace ?? 0) * 2 * Math.PI - Math.PI / 2;
  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? 'rgba(255,255,255,0.22)' : '#eef2f8'} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? '#fff' : pct >= 1 ? '#16a34a' : '#1f6fe8'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${seen ? p * c : 0} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1100ms cubic-bezier(0.22,0.8,0.24,1) 150ms' }} />
        {pace != null && pace < 1 && <line x1={size / 2 + Math.cos(a) * (r - stroke / 2 - 2)} y1={size / 2 + Math.sin(a) * (r - stroke / 2 - 2)} x2={size / 2 + Math.cos(a) * (r + stroke / 2 + 2)} y2={size / 2 + Math.sin(a) * (r + stroke / 2 + 2)} stroke={light ? '#ffd166' : '#0b1730'} strokeOpacity={light ? 1 : 0.45} strokeWidth="3" strokeLinecap="round" />}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** White rounded card used across the marketer pages. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(30,74,160,0.06)] ring-1 ring-line/70 ${className}`}>{children}</div>;
}
