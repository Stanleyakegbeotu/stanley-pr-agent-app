/**
 * Marketer workspace (owner, 2026-11-26), mobile only. Every marketer has their
 * own dashboard: the hospitals they are assigned to and every PR agent there,
 * their monthly and weekly targets (money: the amount their hospitals
 * generate), Analysis, an Inbox to chat with their PR agents, Activity, the
 * Report centre and Settings. Same frame, motion and card language as the
 * other mobile workspaces. Hospital-level money only: never what a single PR
 * agent generated, commission or patient details.
 *
 * Until login exists the marketer is picked in the menu (domain/role).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Activity, BarChart3, Bell, CheckCircle2, Hospital, LayoutGrid, MessagesSquare, Plus, Settings, Stethoscope, X, type LucideIcon } from 'lucide-react';
import { AppStateProvider, useApp as useCompany } from '@company/app/AppState';
import { branchRoute } from '@company/app/router';
import { getBranch } from '@company/data/company';
import type { AgentHealth } from '@company/services/agentMonitor';
import type { HospitalInfo } from '@company/services/marketing';
import type { StaffRecord } from '@company/data/userRecords';
import { staffKey, useAccountAccess } from '@company/services/accountAccess';
import { ROLES, setActingStaff, setRole, staffBranch, useActingStaff, useRole } from '@/domain/role';
import { NavCtx } from '@/app/store';
import { AdminShellCtx } from '@/admin/shell';
import { Sticker } from '@/ui/kit';
import { useInbox } from '@/domain/chat';
import { ChatThread } from '@/screens/chat/ChatThread';
import { useMine, initials } from './data';
import { marketerAgentChat, marketerPrefix, useMarketerConversations } from './chat';
import { MarketerActivity, MarketerAlerts, MarketerAnalysis, MarketerCentre, MarketerHome, MarketerHospitals, MarketerInbox, MarketerSettings, seenAlerts, useAlerts } from './pages';
import { AgentSheet, HospitalSheet, LogSheet, RegisterSheet } from './sheets';
import { MarketerCtx, useMk, type MarketerCtxValue } from './ui';

interface Page {
  id: string;
  label: string;
  icon: LucideIcon;
  screen: ComponentType;
}
const PAGES: Page[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, screen: MarketerHome },
  { id: 'hospitals', label: 'My hospitals', icon: Hospital, screen: MarketerHospitals },
  { id: 'analysis', label: 'Analysis', icon: BarChart3, screen: MarketerAnalysis },
  { id: 'inbox', label: 'Inbox', icon: MessagesSquare, screen: MarketerInbox },
  { id: 'activity', label: 'Activity', icon: Activity, screen: MarketerActivity },
  { id: 'centre', label: 'Report centre', icon: Stethoscope, screen: MarketerCentre },
  { id: 'settings', label: 'Settings', icon: Settings, screen: MarketerSettings },
];
const EXTRA: Page[] = [{ id: 'alerts', label: 'Alerts', icon: Bell, screen: MarketerAlerts }];
const TAB_LABEL: Record<string, string> = { dashboard: 'Home', hospitals: 'Hospitals', inbox: 'Inbox', analysis: 'Analysis' };

export function MarketerApp() {
  return (
    <AppStateProvider>
      <MarketerFrame />
    </AppStateProvider>
  );
}

function MarketerFrame() {
  const { route, navigate, user, staff, switchAccount, context, setContext } = useCompany();
  const acting = useActingStaff();
  const access = useAccountAccess();
  const br = branchRoute(route);
  const branchId = br?.branchId ?? staffBranch();
  // A deactivated marketer can't sign in.
  const marketers = useMemo(() => staff.filter((s) => s.branchId === branchId && s.role === 'Marketer' && s.status === 'Active' && !access[staffKey(s.id)]?.off).sort((a, b) => a.name.localeCompare(b.name)), [staff, branchId, access]);
  const meId = marketers.some((s) => s.id === acting) ? acting : (marketers[0]?.id ?? null);
  useEffect(() => {
    if (!br) navigate(`/branch/${staffBranch()}/dashboard`);
  }, [br, navigate]);
  useEffect(() => {
    if (context !== branchId) setContext(branchId);
  }, [context, branchId, setContext]);
  useEffect(() => {
    if (meId && user.staffId !== meId) switchAccount(branchId, meId);
  }, [branchId, meId, switchAccount, user.staffId]);
  const me = staff.find((s) => s.id === meId);
  if (!me) return <NoMarketer />;
  return <Workspace key={me.id} me={me} branchId={branchId} marketers={marketers} />;
}

function Workspace({ me, branchId, marketers }: { me: StaffRecord; branchId: string; marketers: StaffRecord[] }) {
  const { route, navigate } = useCompany();
  const m = useMine(branchId, me.id);
  const br = branchRoute(route);
  const pageId = br?.page ?? 'dashboard';
  const page = [...PAGES, ...EXTRA].find((p) => p.id === pageId) ?? PAGES[0]!;
  const chatId = page.id === 'inbox' ? route.segments[3] : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentHealth | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [register, setRegister] = useState(false);
  const [log, setLog] = useState(false);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setMenu(false);
  }, [route.path]);

  const go = useCallback((p: string) => navigate(`/branch/${branchId}/${p}`), [navigate, branchId]);
  const nav = useMemo(
    () => ({
      navigate: (to: string) => navigate(to),
      back: () => (window.history.length > 1 ? window.history.back() : go('dashboard')),
      showToast: (t: string) => {
        setToast(t);
        window.setTimeout(() => setToast((c) => (c === t ? null : c)), 3500);
      },
    }),
    [navigate, go],
  );
  const ctx: MarketerCtxValue = useMemo(
    () => ({
      m,
      me,
      go,
      openAgent: (a) => setAgent(a),
      openHospital: (h) => setHospital(h),
      openRegister: () => setRegister(true),
      openLog: () => setLog(true),
      chat: (agentId) => {
        setAgent(null);
        setHospital(null);
        setLog(false);
        navigate(`/branch/${branchId}/inbox/${marketerAgentChat(me.id, agentId)}`);
      },
    }),
    [m, me, go, navigate, branchId],
  );
  const Screen = page.screen;
  const branch = getBranch(branchId);

  return (
    <NavCtx.Provider value={nav}>
      <MarketerCtx.Provider value={ctx}>
        <Chrome openMenu={() => setMenu((x) => !x)}>
          <div className="h-dvh overflow-hidden bg-page">
            <SideMenu open={menu} current={page.id} branchName={branch?.name ?? ''} marketers={marketers} onClose={() => setMenu(false)} go={go} />
            <div ref={scroller} className="h-dvh overflow-y-auto md:ml-[264px]">
              <main className={`mx-auto w-full max-w-[860px] px-5 md:px-8 ${chatId ? 'pb-10' : 'pb-32 md:pb-12'}`}>
                <div key={`${page.id}/${chatId ?? ''}`} className="page-pop">
                  {chatId ? <ChatScreen id={chatId} /> : <Screen />}
                </div>
              </main>
            </div>
            {!chatId && <Tabs current={page.id} go={go} onLog={() => setLog(true)} />}
            {agent && <AgentSheet a={agent} onClose={() => setAgent(null)} />}
            {hospital && <HospitalSheet h={hospital} onClose={() => setHospital(null)} />}
            {register && <RegisterSheet onClose={() => setRegister(false)} />}
            {log && <LogSheet onClose={() => setLog(false)} />}
            {toast && (
              <div role="status" className="fixed left-1/2 z-[90] flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white shadow-2xl" style={{ bottom: 'calc(96px + var(--safe-bottom))' }}>
                <CheckCircle2 size={19} className="shrink-0 text-[#4ade80]" />
                {toast}
              </div>
            )}
          </div>
        </Chrome>
      </MarketerCtx.Provider>
    </NavCtx.Provider>
  );
}

/** Top-bar counts (bell: alerts not seen yet; chat: unread messages) and where they go. */
function Chrome({ openMenu, children }: { openMenu: () => void; children: ReactNode }) {
  const { m, me } = useMk();
  const alerts = useAlerts();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('marketer:alerts', on);
    return () => window.removeEventListener('marketer:alerts', on);
  }, []);
  const unread = useMemo(() => {
    const seen = new Set(seenAlerts(me.id));
    return alerts.filter((a) => !seen.has(a.key)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, me.id, tick]);
  const { fixed } = useMarketerConversations(m.branchId, me.id, m.myAgentIds);
  const fixedIds = useMemo(() => fixed.map((c) => c.id), [fixed]);
  const inboxUnread = useInbox(fixedIds, marketerPrefix(me.id)).unread;
  return <AdminShellCtx.Provider value={{ openMenu, unread, inboxUnread, paths: { notifications: `/branch/${m.branchId}/alerts`, inbox: `/branch/${m.branchId}/inbox` } }}>{children}</AdminShellCtx.Provider>;
}

/** A chat with a PR agent or the manager takes the whole screen. */
function ChatScreen({ id }: { id: string }) {
  const { m, me } = useMk();
  useMarketerConversations(m.branchId, me.id, m.myAgentIds);
  return <ChatThread id={id} />;
}

function Tabs({ current, go, onLog }: { current: string; go: (p: string) => void; onLog: () => void }) {
  const tab = (id: string) => {
    const p = PAGES.find((x) => x.id === id)!;
    const on = current === id;
    return (
      <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'page' : undefined} className="press flex min-h-15 flex-col items-center justify-center gap-1">
        <p.icon size={24} strokeWidth={on ? 2.3 : 1.7} className={on ? 'text-brand-600' : 'text-[#6b778c]'} />
        <span className={`text-[12px] ${on ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>{TAB_LABEL[id]}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(8px,var(--safe-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(30,74,160,0.08)] md:hidden">
      {tab('dashboard')}
      {tab('hospitals')}
      <button type="button" onClick={onLog} aria-label="Log something" className="press flex flex-col items-center">
        <span className="-mt-7 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_10px_24px_rgba(31,111,232,0.45)]">
          <Plus size={32} strokeWidth={2.6} />
        </span>
        <span className="mt-1 text-[12px] font-semibold text-brand-600">Log</span>
      </button>
      {tab('inbox')}
      {tab('analysis')}
    </nav>
  );
}

function SideMenu({ open, current, branchName, marketers, onClose, go }: { open: boolean; current: string; branchName: string; marketers: StaffRecord[]; onClose: () => void; go: (p: string) => void }) {
  const role = useRole();
  const { user } = useCompany();
  return (
    <>
      <button aria-label="Close menu" aria-hidden={!open} tabIndex={open ? 0 : -1} className={`fixed inset-0 z-40 bg-[#0b1730]/30 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose} />
      <aside aria-label="Marketer menu" className={`fixed bottom-0 left-0 top-0 z-50 flex w-[290px] flex-col border-r border-line bg-white pb-[var(--safe-bottom)] pt-[var(--safe-top)] transition-[translate,box-shadow] duration-[380ms] ease-[cubic-bezier(0.22,0.8,0.24,1)] md:w-[264px] md:translate-x-0 ${open ? 'translate-x-0 shadow-[10px_0_40px_rgba(11,23,48,0.12)]' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <p className="text-[21px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">STANLEY</p>
            <p className="mt-1 text-[9.5px] font-semibold tracking-[0.25em] text-muted">MARKETER · {branchName.toUpperCase()}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full text-ink-2 md:hidden">
            <X size={22} />
          </button>
        </div>
        <div className="mx-3 mb-2 rounded-2xl bg-page p-2">
          <p className="px-2 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">VIEWING AS (UNTIL LOGIN)</p>
          <div className="grid grid-cols-2 gap-1">
            {ROLES.map((r) => (
              <button key={r.id} type="button" onClick={() => r.id !== role && setRole(r.id)} className={`press rounded-xl px-2 py-2 text-[12px] font-semibold ${r.id === role ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                {r.label}
              </button>
            ))}
          </div>
          {marketers.length > 1 && (
            <div className="mt-2">
              <p className="px-2 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">SIGNED IN AS</p>
              <div className="flex flex-wrap gap-1">
                {marketers.map((s) => (
                  <button key={s.id} type="button" onClick={() => setActingStaff(s.id)} className={`press rounded-full px-2.5 py-1 text-[12px] font-semibold ${user.staffId === s.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                    {s.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {PAGES.map((p) => {
            const on = p.id === current;
            return (
              <button key={p.id} type="button" onClick={() => (go(p.id), onClose())} aria-current={on ? 'page' : undefined} className={`press flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] ${on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-2 hover:bg-page'}`}>
                <p.icon size={20} strokeWidth={on ? 2.2 : 1.8} />
                <span className="flex-1">{p.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-[13px] font-bold text-white">{initials(user.name)}</span>
          <span className="min-w-0">
            <b className="block truncate text-[14px] text-ink">{user.name}</b>
            <span className="block truncate text-[12px] text-muted">Marketer · {branchName} branch</span>
          </span>
        </div>
      </aside>
    </>
  );
}

function NoMarketer() {
  return (
    <div className="grid min-h-dvh place-items-center bg-page px-6 text-center">
      <div>
        <Sticker name="megaphone" size={64} />
        <p className="mt-3 text-[18px] font-bold text-ink">No marketer account here</p>
        <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-muted">Marketers are added in Staff Management with the Marketer role. A deactivated account can't sign in.</p>
        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-1 rounded-2xl bg-white p-2 ring-1 ring-line">
          {ROLES.map((r) => (
            <button key={r.id} type="button" onClick={() => setRole(r.id)} className="press rounded-xl bg-page px-2 py-2 text-[12px] font-semibold text-ink-2 ring-1 ring-line">
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
