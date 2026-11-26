/**
 * Marketer workspace (owner, 2026-11-26), mobile only. A marketer looks after
 * their own hospitals: every PR agent there is theirs, and their monthly
 * target comes from those hospitals. Pages: Home, My hospitals, Activity
 * (their own log and months), Report centre (new partner hospitals) and
 * Settings. Hospital-level money only: never what a single PR agent
 * generated, commission or patient details.
 *
 * Until login exists the marketer is picked in the menu (domain/role).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, CheckCircle2, ChevronRight, Hospital, LayoutGrid, Menu as MenuIcon, Plus, Search, Settings, Stethoscope, UserPlus } from 'lucide-react';
import { AppStateProvider, useApp as useCompany } from '@company/app/AppState';
import { branchRoute } from '@company/app/router';
import { getBranch } from '@company/data/company';
import type { AgentHealth } from '@company/services/agentMonitor';
import type { HospitalInfo } from '@company/services/marketing';
import type { StaffRecord } from '@company/data/userRecords';
import { staffKey, useAccountAccess } from '@company/services/accountAccess';
import { ROLES, setActingStaff, setRole, staffBranch, useActingStaff, useRole } from '@/domain/role';
import { NavCtx } from '@/app/store';
import { Sheet } from '@/admin/ui';
import { Sticker } from '@/ui/kit';
import { useMine, initials, type Mine } from './data';
import { MarketerActivity, MarketerCentre, MarketerHome, MarketerHospitals } from './pages';
import { AgentSheet, HospitalSheet, NEEDS, RecruitSheet, RegisterSheet, StatusPill, VisitSheet } from './sheets';

const PAGES = [
  { id: 'dashboard', label: 'Home', icon: LayoutGrid },
  { id: 'hospitals', label: 'Hospitals', icon: Hospital },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'centre', label: 'Report centre', icon: Stethoscope },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
type PageId = (typeof PAGES)[number]['id'];

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
  const pageId = (PAGES.some((p) => p.id === br?.page) ? br!.page : 'dashboard') as PageId;
  const scroller = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

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
  const me = staff.find((s) => s.id === meId);

  return (
    <NavCtx.Provider value={nav}>
      <div className="min-h-dvh bg-page">
        <div ref={scroller} className="h-dvh overflow-y-auto">
          <header className="sticky top-0 z-20 flex items-center gap-3 bg-page/85 px-5 pb-2 pt-[calc(var(--safe-top)+10px)] backdrop-blur">
            <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="press grid h-10 w-10 place-items-center rounded-full bg-white text-ink ring-1 ring-line">
              <MenuIcon size={20} />
            </button>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-extrabold leading-none tracking-[-0.02em] text-brand-700">STANLEY</span>
              <span className="block text-[10px] font-semibold tracking-[0.2em] text-muted">MARKETER · {(getBranch(branchId)?.name ?? '').toUpperCase()}</span>
            </span>
            {me && <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-[13px] font-bold text-white">{initials(me.name)}</span>}
          </header>
          <main className="mx-auto w-full max-w-[720px] px-5 pb-32">
            <div key={`${branchId}/${pageId}/${meId}`} className="page-pop">
              {me ? <Workspace me={me} branchId={branchId} pageId={pageId} go={go} /> : <NoMarketer />}
            </div>
          </main>
        </div>

        {me && <Tabs pageId={pageId} go={go} />}
        {menu && <MenuSheet onClose={() => setMenu(false)} marketers={marketers} meId={meId} go={go} />}
        {toast && (
          <div role="status" className="fixed left-1/2 z-[90] flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white shadow-2xl" style={{ bottom: 'calc(96px + var(--safe-bottom))' }}>
            <CheckCircle2 size={19} className="shrink-0 text-[#4ade80]" />
            {toast}
          </div>
        )}
      </div>
    </NavCtx.Provider>
  );
}

/** One data hook for the page and its sheets (the agent list is worked out once). */
function Workspace({ me, branchId, pageId, go }: { me: StaffRecord; branchId: string; pageId: PageId; go: (p: string) => void }) {
  const m = useMine(branchId, me.id);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [agent, setAgent] = useState<AgentHealth | null>(null);
  const [register, setRegister] = useState(false);
  const open = { hospital: setHospital, agent: setAgent, register: () => setRegister(true) };
  // The + button lives in the tab bar; it opens this through an event.
  const [quick, setQuick] = useState(false);
  useEffect(() => {
    const on = () => setQuick(true);
    window.addEventListener('marketer:quick', on);
    return () => window.removeEventListener('marketer:quick', on);
  }, []);
  return (
    <>
      {pageId === 'dashboard' && <MarketerHome m={m} me={me} open={open} go={go} />}
      {pageId === 'hospitals' && <MarketerHospitals m={m} open={open} />}
      {pageId === 'activity' && <MarketerActivity m={m} me={me} />}
      {pageId === 'centre' && <MarketerCentre m={m} me={me} open={open} />}
      {pageId === 'settings' && <MarketerSettings me={me} m={m} />}
      {hospital && <HospitalSheet h={hospital} m={m} branchId={branchId} onClose={() => setHospital(null)} onAgent={setAgent} />}
      {agent && <AgentSheet a={agent} branchId={branchId} onClose={() => setAgent(null)} />}
      {register && <RegisterSheet m={m} branchId={branchId} onClose={() => setRegister(false)} />}
      {quick && <QuickSheet m={m} branchId={branchId} onClose={() => setQuick(false)} onAgent={(a) => (setQuick(false), setAgent(a))} onRegister={() => (setQuick(false), setRegister(true))} />}
    </>
  );
}

function Tabs({ pageId, go }: { pageId: PageId; go: (p: string) => void }) {
  const tab = (id: PageId, label: string, Icon: typeof LayoutGrid) => {
    const on = pageId === id;
    return (
      <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'page' : undefined} className="press flex min-h-15 flex-col items-center justify-center gap-1">
        <Icon size={24} strokeWidth={on ? 2.3 : 1.7} className={on ? 'text-brand-600' : 'text-[#6b778c]'} />
        <span className={`text-[12px] ${on ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>{label}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(8px,var(--safe-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(30,74,160,0.08)]">
      {tab('dashboard', 'Home', LayoutGrid)}
      {tab('hospitals', 'Hospitals', Hospital)}
      <button type="button" onClick={() => window.dispatchEvent(new Event('marketer:quick'))} aria-label="Log something" className="press flex flex-col items-center">
        <span className="-mt-7 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_10px_24px_rgba(31,111,232,0.45)]">
          <Plus size={32} strokeWidth={2.6} />
        </span>
        <span className="mt-1 text-[12px] font-semibold text-brand-600">Log</span>
      </button>
      {tab('activity', 'Activity', Activity)}
      {tab('centre', 'Centre', Stethoscope)}
    </nav>
  );
}

/* ─────────────── + : log something ─────────────── */

function QuickSheet({ m, branchId, onClose, onAgent, onRegister }: { m: Mine; branchId: string; onClose: () => void; onAgent: (a: AgentHealth) => void; onRegister: () => void }) {
  const [step, setStep] = useState<'menu' | 'agent' | 'visit' | 'recruit'>('menu');
  const [q, setQ] = useState('');
  const [hospital, setHospital] = useState<string | null>(null);
  const t = q.trim().toLowerCase();
  const agents = m.myHealth.filter((a) => (t ? a.agent.name.toLowerCase().includes(t) || a.hospital.toLowerCase().includes(t) : a.due || NEEDS.includes(a.status))).slice(0, 40);
  const Option = ({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 rounded-[20px] bg-white p-3.5 text-left ring-1 ring-line/70">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-ink">{title}</span>
        <span className="block text-[12.5px] text-muted">{sub}</span>
      </span>
      <ChevronRight size={17} className="text-faint" />
    </button>
  );
  const pickHospital = (
    <div className="space-y-1.5">
      {m.mine.map((h) => (
        <button key={h.key} type="button" onClick={() => setHospital(h.key)} className="press flex w-full items-center justify-between rounded-2xl bg-white px-3.5 py-3 text-left ring-1 ring-line/70">
          <span className="text-[15px] font-semibold text-ink">{h.key}</span>
          <span className="text-[12.5px] text-muted">{h.agentIds.length} agent{h.agentIds.length === 1 ? '' : 's'}</span>
        </button>
      ))}
    </div>
  );
  return (
    <Sheet back={step !== 'menu'} title={step === 'menu' ? 'Log something' : step === 'agent' ? 'Follow up a PR agent' : step === 'visit' ? 'Which hospital did you visit?' : 'Where is the new PR agent?'} onClose={step === 'menu' ? onClose : () => (setStep('menu'), setHospital(null))}>
      {step === 'menu' && (
        <div className="space-y-2 pb-2">
          <Option icon={<Stethoscope size={20} />} title="Follow up a PR agent" sub="Visit, call or message, and what they said" onClick={() => setStep('agent')} />
          <Option icon={<Hospital size={20} />} title="Hospital visit" sub="Who you met and what came of it" onClick={() => setStep('visit')} />
          <Option icon={<UserPlus size={20} />} title="New PR agent" sub="Someone you brought in at your hospital" onClick={() => setStep('recruit')} />
          <Option icon={<Plus size={20} />} title="Register a new hospital" sub="A new partner for the branch" onClick={onRegister} />
        </div>
      )}
      {step === 'agent' && (
        <div className="pb-2">
          <label className="mb-2 flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-line">
            <Search size={16} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find any of your PR agents" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
          </label>
          {!t && <p className="mb-2 px-1 text-[12.5px] text-muted">Agents who need you now:</p>}
          <div className="rounded-[20px] bg-white p-1.5 ring-1 ring-line/70">
            {agents.length ? (
              agents.map((a) => (
                <button key={a.agent.id} type="button" onClick={() => onAgent(a)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-page text-[12px] font-bold text-ink-2">{initials(a.agent.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{a.agent.name}</span>
                    <span className="block truncate text-[12px] text-muted">{a.hospital}</span>
                  </span>
                  <StatusPill s={a.status} />
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-[13px] text-muted">{m.healthReady ? 'No PR agent found.' : 'Working out the agents…'}</p>
            )}
          </div>
        </div>
      )}
      {(step === 'visit' || step === 'recruit') && !hospital && pickHospital}
      {step === 'visit' && hospital && <VisitSheet branchId={branchId} hospital={hospital} onClose={onClose} />}
      {step === 'recruit' && hospital && <RecruitSheet branchId={branchId} hospital={hospital} onClose={onClose} />}
    </Sheet>
  );
}

/* ─────────────── menu, settings ─────────────── */

function MenuSheet({ onClose, marketers, meId, go }: { onClose: () => void; marketers: { id: string; name: string }[]; meId: string | null; go: (p: string) => void }) {
  const role = useRole();
  return (
    <Sheet title="Menu" onClose={onClose}>
      <div className="space-y-1 pb-3">
        {PAGES.map((p) => (
          <button key={p.id} type="button" onClick={() => (go(p.id), onClose())} className="press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15.5px] font-semibold text-ink hover:bg-white">
            <p.icon size={20} className="text-brand-600" /> {p.label}
          </button>
        ))}
      </div>
      <div className="mb-3 rounded-2xl bg-white p-2 ring-1 ring-line">
        <p className="px-2 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">SIGNED IN AS (UNTIL LOGIN)</p>
        <div className="flex flex-wrap gap-1">
          {marketers.map((s) => (
            <button key={s.id} type="button" onClick={() => (setActingStaff(s.id), onClose())} className={`press rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${meId === s.id ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
              {s.name}
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">VIEWING AS</p>
        <div className="grid grid-cols-2 gap-1">
          {ROLES.map((r) => (
            <button key={r.id} type="button" onClick={() => r.id !== role && setRole(r.id)} className={`press rounded-xl px-2 py-2 text-[12px] font-semibold ${r.id === role ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function MarketerSettings({ me, m }: { me: StaffRecord; m: Mine }) {
  return (
    <div className="pt-2">
      <h1 className="mb-4 text-[24px] font-extrabold tracking-[-0.03em] text-ink">Settings</h1>
      <div className="mb-4 flex items-center gap-3 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-[18px] font-bold text-white">{initials(me.name)}</span>
        <span className="min-w-0">
          <span className="block text-[17px] font-bold text-ink">{me.name}</span>
          <span className="block text-[13px] text-muted">
            Marketer · {formatPlural(m.mine.length, 'hospital')} · {formatPlural(m.myAgentIds.size, 'PR agent')}
          </span>
          <span className="block text-[12.5px] text-muted">{me.email || 'No email on record'}</span>
        </span>
      </div>
      <div className="mb-4 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <p className="mb-2 text-[14px] font-bold text-ink">What you see, and what you don't</p>
        <ul className="space-y-1.5 text-[13.5px] text-ink-2">
          <li>✓ Your hospitals: patients and the amount each one generated</li>
          <li>✓ The PR agents at your hospitals and how often they refer</li>
          <li>✓ Your target, your progress and the branch ranking</li>
          <li>✗ What a single PR agent generated, or their commission</li>
          <li>✗ Patient names or details</li>
          <li>✗ Billing, payments and the front desk</li>
        </ul>
      </div>
      <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
        <Sticker name="bell" size={36} />
        <p className="text-[13px] text-muted">Sign-in, notifications and syncing between phones arrive when the cloud database is connected. Your manager sets your hospitals and target.</p>
      </div>
      <p className="mt-6 text-center text-[12px] text-faint">STANLEY · Marketer</p>
    </div>
  );
}
const formatPlural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function NoMarketer() {
  return (
    <div className="pt-12 text-center">
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
  );
}
