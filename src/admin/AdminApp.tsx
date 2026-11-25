/**
 * Company Admin workspace on mobile (owner, 2026-11-25): the mobile version
 * of the desktop admin dashboard. SAME logic, rules and figures (the desktop
 * code is shared through src/company, synced by scripts/sync-company.mjs),
 * in the mobile app's own design. No STANLEY AI here (it stays on desktop).
 *
 * Same hierarchy as the desktop menu: Dashboard, Branches, Inventory, Staff
 * Management, PR Management, Patients, Finance & Expenses, Reports, Settings,
 * Audit Log, Trash. The four most used pages are in the bottom bar; every page
 * is in the menu. Routes: "#/admin/<desktop path>".
 */
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { CheckCircle2, Building2, ChartLine, Handshake, LayoutGrid, Menu as MenuIcon, Package, ScrollText, Settings, Trash2, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { AppStateProvider, useApp as useCompany } from '@company/app/AppState';
import { isRead, useNotifications } from '@company/services/notifications';
import { COMPANY as CO } from '@company/data/company';
import { ROLES, setRole, useRole } from '@/domain/role';
import { NavCtx } from '@/app/store';
import { useInbox } from '@/domain/chat';
import { ChatThread } from '@/screens/chat/ChatThread';
import { AdminShellCtx } from './shell';
import { AGENT_PREFIX, useAdminConversations } from './chat';
import { AdminInbox } from './pages/Inbox';
import { AdminNotifications } from './pages/Notifications';
import { AdminDashboard } from './pages/Dashboard';
import { ComingNext } from './pages/ComingNext';
import { BranchesPage } from './pages/Branches';
import { PatientsPage } from './pages/Patients';

interface AdminPage {
  id: string;
  label: string;
  icon: LucideIcon;
  screen: ComponentType<{ sub?: string }>;
}

/** Desktop order (COMPANY_NAV), minus STANLEY AI and Report an issue. */
export const ADMIN_PAGES: AdminPage[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, screen: AdminDashboard },
  { id: 'branches', label: 'Branches', icon: Building2, screen: BranchesPage },
  { id: 'inventory', label: 'Inventory', icon: Package, screen: () => <ComingNext title="Inventory" /> },
  { id: 'staff', label: 'Staff Management', icon: Users, screen: () => <ComingNext title="Staff Management" /> },
  { id: 'pr', label: 'PR Management', icon: Handshake, screen: () => <ComingNext title="PR Management" /> },
  { id: 'patients', label: 'Patients', icon: UserRound, screen: PatientsPage },
  { id: 'finance', label: 'Finance & Expenses', icon: Wallet, screen: () => <ComingNext title="Finance & Expenses" /> },
  { id: 'reports', label: 'Reports', icon: ChartLine, screen: () => <ComingNext title="Reports" /> },
  { id: 'settings', label: 'Settings', icon: Settings, screen: () => <ComingNext title="Settings" /> },
  { id: 'audit', label: 'Audit Log', icon: ScrollText, screen: () => <ComingNext title="Audit Log" /> },
  { id: 'trash', label: 'Trash', icon: Trash2, screen: () => <ComingNext title="Trash" /> },
];
const EXTRA: AdminPage[] = [
  { id: 'notifications', label: 'Notifications', icon: LayoutGrid, screen: AdminNotifications },
  { id: 'messages', label: 'Inbox', icon: LayoutGrid, screen: ({ sub }) => (sub ? <ChatThread id={sub} /> : <AdminInbox />) },
];
/** Bottom bar: the most used pages, then the menu. */
const TABS = ['dashboard', 'branches', 'patients', 'finance'];

export function AdminApp() {
  return (
    <AppStateProvider>
      <AdminFrame />
    </AppStateProvider>
  );
}

function AdminFrame() {
  const { route, navigate } = useCompany();
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const { notes } = useNotifications();
  const unread = useMemo(() => notes.filter((n) => !isRead(n)).length, [notes]);
  const [pageId, sub] = route.segments;
  const page = [...ADMIN_PAGES, ...EXTRA].find((p) => p.id === pageId) ?? ADMIN_PAGES[0]!;
  // Admin chats are registered before any screen renders (chat threads look them up).
  const { fixed } = useAdminConversations();
  const fixedIds = useMemo(() => fixed.map((c) => c.id), [fixed]);
  const inboxUnread = useInbox(fixedIds, AGENT_PREFIX).unread;
  const chat = page.id === 'messages' && !!sub;
  const [toast, setToast] = useState<string | null>(null);
  const nav = useMemo(
    () => ({
      navigate: (to: string) => navigate(to),
      back: () => (window.history.length > 1 ? window.history.back() : navigate('/dashboard')),
      showToast: (t: string) => {
        setToast(t);
        window.setTimeout(() => setToast((c) => (c === t ? null : c)), 3500);
      },
    }),
    [navigate],
  );

  // Admin addresses live under #/admin: send anything else to the dashboard.
  useEffect(() => {
    if (!window.location.hash.startsWith('#/admin')) navigate('/dashboard');
  }, [navigate]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setMenu(false);
  }, [route.path]);

  const Screen = page.screen;
  return (
    <NavCtx.Provider value={nav}>
    <AdminShellCtx.Provider value={{ openMenu: () => setMenu((m) => !m), unread, inboxUnread }}>
      <div className="h-dvh overflow-hidden bg-page">
        <AdminMenu open={menu} current={page.id} onClose={() => setMenu(false)} />
        <div ref={scroller} className="h-dvh overflow-y-auto md:ml-[264px]">
          <main className={`mx-auto w-full max-w-[860px] px-5 md:px-8 ${chat ? 'pb-10' : 'pb-32 md:pb-12'}`}>
            <Screen sub={sub} />
          </main>
        </div>
        {!chat && <AdminTabs current={page.id} onMore={() => setMenu((m) => !m)} moreOpen={menu} />}
        {toast && (
          <div role="status" className="fixed left-1/2 z-[90] flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white shadow-2xl" style={{ bottom: 'calc(96px + var(--safe-bottom))' }}>
            <CheckCircle2 size={19} className="shrink-0 text-[#4ade80]" />
            {toast}
          </div>
        )}
      </div>
    </AdminShellCtx.Provider>
    </NavCtx.Provider>
  );
}

function AdminTabs({ current, onMore, moreOpen }: { current: string; onMore: () => void; moreOpen: boolean }) {
  const { navigate } = useCompany();
  const tabs = TABS.map((id) => ADMIN_PAGES.find((p) => p.id === id)!);
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(8px,var(--safe-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(30,74,160,0.08)] md:hidden">
      {tabs.map((t) => {
        const on = !moreOpen && current === t.id;
        return (
          <button key={t.id} type="button" onClick={() => navigate(`/${t.id}`)} aria-current={on ? 'page' : undefined} className="press flex min-h-15 flex-col items-center justify-center gap-1">
            <t.icon size={24} strokeWidth={on ? 2.3 : 1.7} className={on ? 'text-brand-600' : 'text-[#6b778c]'} />
            <span className={`text-[12px] ${on ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>{t.label.split(' ')[0]}</span>
          </button>
        );
      })}
      <button type="button" onClick={onMore} aria-label="More pages" className="press flex min-h-15 flex-col items-center justify-center gap-1">
        <MenuIcon size={24} strokeWidth={moreOpen || !TABS.includes(current) ? 2.3 : 1.7} className={moreOpen || !TABS.includes(current) ? 'text-brand-600' : 'text-[#6b778c]'} />
        <span className={`text-[12px] ${moreOpen || !TABS.includes(current) ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>More</span>
      </button>
    </nav>
  );
}

function AdminMenu({ open, current, onClose }: { open: boolean; current: string; onClose: () => void }) {
  const { navigate, user } = useCompany();
  const role = useRole();
  return (
    <>
      <button aria-label="Close menu" aria-hidden={!open} tabIndex={open ? 0 : -1} className={`fixed inset-0 z-40 bg-[#0b1730]/30 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose} />
      <aside aria-label="Admin menu" className={`fixed bottom-0 left-0 top-0 z-50 flex w-[290px] flex-col border-r border-line bg-white pb-[var(--safe-bottom)] pt-[var(--safe-top)] transition-[transform,box-shadow] duration-[380ms] ease-[cubic-bezier(0.22,0.8,0.24,1)] md:w-[264px] md:translate-x-0 ${open ? 'translate-x-0 shadow-[10px_0_40px_rgba(11,23,48,0.12)]' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <p className="text-[21px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">STANLEY</p>
            <p className="mt-1 text-[9.5px] font-semibold tracking-[0.25em] text-muted">COMPANY ADMINISTRATION</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full text-ink-2 md:hidden">
            <X size={22} />
          </button>
        </div>

        {/* Developer switch until login exists (domain/role). */}
        <div className="mx-3 mb-2 rounded-2xl bg-page p-2">
          <p className="px-2 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">VIEWING AS (UNTIL LOGIN)</p>
          <div className="grid grid-cols-2 gap-1">
            {ROLES.map((r) => (
              <button key={r.id} type="button" onClick={() => r.id !== role && setRole(r.id)} className={`press rounded-xl px-2 py-2 text-[12.5px] font-semibold ${r.id === role ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {ADMIN_PAGES.map((p) => {
            const on = p.id === current;
            return (
              <button key={p.id} type="button" onClick={() => (navigate(`/${p.id}`), onClose())} aria-current={on ? 'page' : undefined} className={`press flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] ${on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-2 hover:bg-page'}`}>
                <p.icon size={20} strokeWidth={on ? 2.2 : 1.8} />
                <span className="flex-1">{p.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-line px-5 py-3.5">
          <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
          <p className="truncate text-[12.5px] text-muted">
            {user.role} · {CO.name}
          </p>
        </div>
      </aside>
    </>
  );
}
