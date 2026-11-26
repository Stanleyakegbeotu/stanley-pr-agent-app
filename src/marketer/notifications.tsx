/**
 * Marketer notifications (the bell, owner, 2026-11-26): written by the system
 * from their own figures (weekly and monthly targets, PR agents who have gone
 * quiet or are slipping, decisions on hospitals they registered, hospitals
 * given to them, answers to their reports). Each can be marked read or unread,
 * or all at once; filters for unread, targets, PR agents and hospitals.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { CalendarCheck, CheckCheck, ChevronRight, Flag, Hospital, Target, Trophy } from 'lucide-react';
import { useIssueReports } from '@company/services/issueReports';
import { AdminTopBar, PageGlow, StickyTools } from '@/admin/kit';
import { Chips, PageTitle } from '@/admin/branchFirst';
import { Sticker } from '@/ui/kit';
import { stamp } from './data';
import { notificationPrefs } from './settings';
import { useMk } from './ui';

export type AlertKind = 'target' | 'agent' | 'hospital' | 'report';
export interface Alert {
  key: string;
  kind: AlertKind;
  tone: 'warn' | 'danger' | 'ok' | 'brand';
  title: string;
  text: string;
  at?: string;
  onOpen?: () => void;
}
const TONE = { warn: 'bg-[#fff1de] text-[#b45309]', danger: 'bg-[#ffe4e4] text-[#b42318]', ok: 'bg-[#e6f8ee] text-good-ink', brand: 'bg-brand-50 text-brand-700' } as const;

export function useAlerts(): Alert[] {
  const { m, me, openAgent, go } = useMk();
  const reports = useIssueReports();
  return useMemo(() => {
    const out: Alert[] = [];
    const p = m.my;
    if (p) {
      const w = p.week;
      if (w.revenue >= w.target) out.push({ key: `week-hit-${w.from}`, kind: 'target', tone: 'ok', title: 'Weekly target beaten', text: `${m.money(w.revenue)} this week against ${m.money(w.target)}. Well done!`, onOpen: () => go('analysis') });
      else if (w.pace > 0.4 && w.pct < w.pace * 0.8) out.push({ key: `week-behind-${w.from}`, kind: 'target', tone: 'danger', title: 'Behind on this week', text: `${m.money(w.revenue)} of ${m.money(w.target)} so far. The target guide on My hospitals shows what to do.`, onOpen: () => go('hospitals') });
      if (p.pct >= 1) out.push({ key: `month-hit-${p.month}`, kind: 'target', tone: 'ok', title: 'Monthly target reached', text: `${m.money(p.revenue)} against ${m.money(p.target)}. Congratulations!`, onOpen: () => go('analysis') });
      else if (p.pace >= 0.5 && p.pct < p.pace * 0.8) out.push({ key: `month-behind-${p.month}`, kind: 'target', tone: 'warn', title: 'The month needs a push', text: `${Math.round(p.pct * 100)}% of your target with ${Math.round((1 - p.pace) * 100)}% of the month left.`, onOpen: () => go('hospitals') });
    }
    for (const a of m.myHealth.filter((x) => x.due && x.status === 'quiet').slice(0, 10)) out.push({ key: `quiet-${a.agent.id}`, kind: 'agent', tone: 'warn', title: `${a.agent.name} has gone quiet`, text: `${a.hospital} · no referral for ${a.daysSince} days`, at: a.lastAt?.toISOString(), onOpen: () => openAgent(a) });
    for (const a of m.myHealth.filter((x) => x.due && x.status === 'slipping').slice(0, 6)) out.push({ key: `slip-${a.agent.id}`, kind: 'agent', tone: 'warn', title: `${a.agent.name} is slipping`, text: `${a.hospital} · ${a.action}`, onOpen: () => openAgent(a) });
    for (const pt of m.st.partners.filter((x) => x.marketerId === me.id && x.status !== 'proposed')) out.push({ key: `partner-${pt.id}-${pt.status}`, kind: 'hospital', tone: pt.status === 'partnered' ? 'ok' : 'brand', title: pt.status === 'partnered' ? `${pt.name} is now your hospital` : `${pt.name} was not taken on`, text: `Decided by ${pt.decidedBy ?? 'your manager'}`, at: pt.decidedAt, onOpen: () => go('centre') });
    for (const h of m.st.ownerHistory.filter((x) => (x.to === me.id || x.from === me.id) && x.by !== 'STANLEY').slice(0, 8)) out.push({ key: `own-${h.hospital}-${h.at}`, kind: 'hospital', tone: 'brand', title: h.to === me.id ? `${h.hospital} is now yours` : `${h.hospital} moved to another marketer`, text: `${h.by}: ${h.reason}`, at: h.at, onOpen: () => go('hospitals') });
    for (const r of reports.filter((x) => x.from.name === me.name && x.history.length > 1)) {
      const last = r.history[r.history.length - 1]!;
      out.push({ key: `report-${r.id}-${r.history.length}`, kind: 'report', tone: r.status === 'resolved' ? 'ok' : 'brand', title: `Your report: ${last.action.toLowerCase()}`, text: `${r.subject}${last.note ? ` · ${last.note}` : ''}`, at: last.at, onOpen: () => go('centre') });
    }
    // Only what they chose in Settings > Notifications.
    const prefs = notificationPrefs(me.id);
    const on: Record<AlertKind, boolean> = { target: prefs.week, agent: prefs.quiet, hospital: prefs.hospitals, report: prefs.reports };
    return out.filter((x) => on[x.kind]);
  }, [m, me, openAgent, go, reports]);
}

/* ─────────────── read / unread ─────────────── */

const KEY = (id: string) => `stanley.mk.alertsRead.${id}`;
const EVENT = 'marketer:alerts';
const readMap = (id: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY(id)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};
let cache: { id: string; raw: string | null; map: Record<string, string> } = { id: '', raw: null, map: {} };
const snapshot = (id: string) => {
  const raw = localStorage.getItem(KEY(id));
  if (cache.id !== id || cache.raw !== raw) cache = { id, raw, map: readMap(id) };
  return cache.map;
};
function save(id: string, map: Record<string, string>) {
  localStorage.setItem(KEY(id), JSON.stringify(map));
  window.dispatchEvent(new Event(EVENT));
}
export function useAlertsRead(id: string) {
  const map = useSyncExternalStore(
    (l) => {
      window.addEventListener(EVENT, l);
      window.addEventListener('storage', l);
      return () => (window.removeEventListener(EVENT, l), window.removeEventListener('storage', l));
    },
    () => snapshot(id),
    () => snapshot(id),
  );
  return {
    isRead: (k: string) => !!map[k],
    markRead: (k: string) => !map[k] && save(id, { ...map, [k]: new Date().toISOString() }),
    markUnread: (k: string) => {
      const next = { ...map };
      delete next[k];
      save(id, next);
    },
    markAll: (keys: string[]) => save(id, { ...map, ...Object.fromEntries(keys.filter((k) => !map[k]).map((k) => [k, new Date().toISOString()])) }),
  };
}

/* ─────────────── the page ─────────────── */

type F = 'all' | 'unread' | AlertKind;
const ICON = { target: Target, agent: CalendarCheck, hospital: Hospital, report: Flag } as const;

export function MarketerAlerts() {
  const { me } = useMk();
  const alerts = useAlerts();
  const r = useAlertsRead(me.id);
  const [f, setF] = useState<F>('all');
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(t);
  }, [flash]);
  const unread = alerts.filter((a) => !r.isRead(a.key));
  const shown = alerts.filter((a) => (f === 'all' ? true : f === 'unread' ? !r.isRead(a.key) : a.kind === f));
  const count = (k: F) => (k === 'all' ? alerts.length : k === 'unread' ? unread.length : alerts.filter((a) => a.kind === k).length);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle
          title="Notifications"
          sub={unread.length ? `${unread.length} unread` : 'All caught up'}
          action={
            unread.length > 0 && (
              <button type="button" onClick={() => r.markAll(alerts.map((a) => a.key))} className="press flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-brand-700 shadow-sm ring-1 ring-line">
                <CheckCheck size={16} /> Mark all read
              </button>
            )
          }
        />
        <StickyTools>
          <Chips
            value={f}
            onChange={setF}
            label="Show"
            options={(['all', 'unread', 'target', 'agent', 'hospital', 'report'] as F[]).map((k) => ({ value: k, label: k === 'all' ? 'All' : k === 'unread' ? 'Unread' : k === 'target' ? 'Targets' : k === 'agent' ? 'PR agents' : k === 'hospital' ? 'Hospitals' : 'Reports', count: count(k) }))}
          />
        </StickyTools>
        {shown.length ? (
          <div className="mt-2 space-y-2">
            {shown.map((a) => {
              const Icon = a.tone === 'ok' ? Trophy : ICON[a.kind];
              const isRead = r.isRead(a.key);
              return (
                <div key={a.key} className={`overflow-hidden rounded-[20px] ring-1 transition-colors ${isRead ? 'bg-white ring-line/70' : 'bg-[#f3f8ff] ring-brand-200'} ${flash === a.key ? 'ring-2 ring-brand-500' : ''}`}>
                  <button type="button" onClick={() => (r.markRead(a.key), a.onOpen?.())} className="press flex w-full items-start gap-3 p-3.5 text-left">
                    <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[a.tone]}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <b className={`min-w-0 flex-1 text-[14.5px] leading-snug text-ink ${isRead ? 'font-semibold' : 'font-bold'}`}>{a.title}</b>
                        {!isRead && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{a.text}</span>
                      {a.at && <span className="mt-1 block text-[11px] text-faint">{stamp(a.at)}</span>}
                    </span>
                    {a.onOpen && <ChevronRight size={16} className="mt-3 shrink-0 text-faint" />}
                  </button>
                  <div className="flex justify-end border-t border-line/60 px-3 py-1.5">
                    <button type="button" onClick={() => (isRead ? r.markUnread(a.key) : r.markRead(a.key), setFlash(a.key))} className="press rounded-full px-2.5 py-1 text-[12px] font-semibold text-brand-600">
                      {isRead ? 'Mark as unread' : 'Mark as read'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-[22px] bg-white p-6 text-center ring-1 ring-line/70">
            <Sticker name="bell" size={52} />
            <p className="mt-2 text-[15px] font-bold text-ink">{f === 'unread' ? 'No unread notifications' : 'Nothing here'}</p>
            <p className="text-[13px] text-muted">Targets, PR agents who need you and news about your hospitals show here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
