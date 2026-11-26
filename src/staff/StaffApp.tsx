/**
 * Staff workspace on mobile (owner, 2026-11-25): the desktop branch workspace
 * that the Branch Manager and the Front Desk share, on the same company logic
 * (src/company). As on the desktop, opening "/branch/<id>/..." signs in as
 * that branch's manager; the Front Desk is a branch staff account picked with
 * "Switch account" (here: who you are signed in as, until real sign-in).
 *
 * Pages (desktop branch menu, minus STANLEY AI and Report an issue): Dashboard,
 * Billing, Drafts, Records, Inventory, PR Management, Analysis, Expenses,
 * Staff Management, Settings, Audit, Trash. Which ones a person sees follows
 * Roles & Permissions (desktop canOpenBranchPage). Figures follow the branch.
 * Routes: "#/admin/branch/<branchId>/<page>".
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Banknote, ChartColumn, CheckCircle2, FilePenLine, Flag, FolderOpen, Handshake, LayoutGrid, Megaphone, Menu as MenuIcon, Package, Plus, ReceiptText, ScrollText, Settings, Trash2, Users, X, type LucideIcon } from 'lucide-react';
import { AppStateProvider, useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { branchRoute } from '@company/app/router';
import { isRead } from '@company/services/notifications';
import { usePermissions } from '@company/services/permissions';
import { ROLES, setActingStaff, setRole, staffBranch, useActingStaff, useRole } from '@/domain/role';
import { NavCtx } from '@/app/store';
import { InitialsAvatar } from '@/ui/kit';
import { AdminShellCtx } from '@/admin/shell';
import { AdminNotifications, useScopedNotes } from '@/admin/pages/Notifications';
import { PatientsPage } from '@/admin/pages/Patients';
import { InventoryPage } from '@/admin/pages/Inventory';
import { PRPage } from '@/admin/pages/PR';
import { ReportsPage } from '@/admin/pages/Reports';
import { StaffPage } from '@/admin/pages/Staff';
import { SettingsPage } from '@/admin/pages/Settings';
import { AuditPage, TrashPage } from '@/admin/pages/Logs';
import { photoOf, useTeam } from '@/admin/people';
import { StaffChromeCtx } from './chrome';
import { StaffHome, canOpenPage } from './pages/Home';
import { BillingPage } from './pages/Billing';
import { DraftsPage } from './pages/Drafts';
import { StaffInbox } from './pages/Inbox';
import { CalculatorButton } from './calculator';
import { STAFF_AGENT_PREFIX, useStaffConversations } from './chat';
import { useInbox } from '@/domain/chat';
import { ChatThread } from '@/screens/chat/ChatThread';
import { ExpensesPage } from './pages/Expenses';
import { AnnouncementsPage } from '@/admin/announcementsPage';
import { ReportsPageMobile } from '@/admin/reportsPage';
import { NavCount, useNavCounts, type NavCounts } from './navCounts';

interface StaffPage {
  id: string;
  label: string;
  icon: LucideIcon;
  screen: ComponentType;
}
/** Desktop BRANCH_NAV_ITEMS order, minus STANLEY AI and Report an issue. */
const PAGES: StaffPage[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, screen: StaffHome },
  { id: 'billing', label: 'Billing', icon: ReceiptText, screen: BillingPage },
  { id: 'drafts', label: 'Drafts', icon: FilePenLine, screen: DraftsPage },
  { id: 'records', label: 'Records', icon: FolderOpen, screen: () => <PatientsPage /> },
  { id: 'inventory', label: 'Inventory', icon: Package, screen: InventoryPage },
  { id: 'pr', label: 'PR Management', icon: Handshake, screen: () => <PRPage /> },
  { id: 'analysis', label: 'Analysis', icon: ChartColumn, screen: ReportsPage },
  { id: 'reports', label: 'Reports', icon: Flag, screen: ReportsPageMobile },
  { id: 'expenses', label: 'Expenses', icon: Banknote, screen: ExpensesPage },
  { id: 'staff', label: 'Staff Management', icon: Users, screen: () => <StaffPage /> },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, screen: AnnouncementsPage },
  { id: 'settings', label: 'Settings', icon: Settings, screen: SettingsPage },
  { id: 'audit', label: 'Audit', icon: ScrollText, screen: AuditPage },
  { id: 'trash', label: 'Trash', icon: Trash2, screen: TrashPage },
];
const EXTRA: StaffPage[] = [
  { id: 'notifications', label: 'Notifications', icon: LayoutGrid, screen: AdminNotifications },
  { id: 'messages', label: 'Inbox', icon: LayoutGrid, screen: Messages },
];

/** Inbox, or one chat (/branch/<id>/messages/<conversation>). */
function Messages() {
  const { route } = useCompany();
  const sub = route.segments[3];
  return sub ? <ChatThread id={sub} /> : <StaffInbox />;
}
const TAB_ORDER = ['dashboard', 'records', 'expenses', 'drafts', 'analysis', 'billing'];

export function StaffApp() {
  return (
    <AppStateProvider>
      <StaffFrame />
    </AppStateProvider>
  );
}

function StaffFrame() {
  usePermissions();
  const { route, navigate, user, staff, switchAccount, context, setContext } = useCompany();
  const role = useRole();
  const acting = useActingStaff();
  const team = useTeam();
  const br = branchRoute(route);
  const branchId = br?.branchId ?? staffBranch();
  const pageId = br?.page ?? 'dashboard';
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(false);
  const counts = useNavCounts(branchId);
  const scroller = useRef<HTMLDivElement>(null);
  const notes = useScopedNotes(branchId);
  const { fixed } = useStaffConversations(branchId);
  const fixedIds = useMemo(() => fixed.map((c) => c.id), [fixed]);
  const inboxUnread = useInbox(fixedIds, STAFF_AGENT_PREFIX).unread;
  const unread = useMemo(() => notes.filter((n) => !isRead(n)).length, [notes]);
  const [toast, setToast] = useState<string | null>(null);

  // Always inside a branch.
  useEffect(() => {
    if (!br) navigate(`/branch/${staffBranch()}/dashboard`);
  }, [br, navigate]);
  // Figures and lists follow this branch.
  useEffect(() => {
    if (context !== branchId) setContext(branchId);
  }, [context, branchId, setContext]);
  // Who is signed in: the manager, or a Front Desk person (today's on-seat one by default).
  const deskId = useMemo(() => {
    if (role !== 'frontdesk') return null;
    const desk = team.frontDesk(branchId);
    if (acting && desk.some((s) => s.id === acting)) return acting;
    const duty = team.onDuty(branchId);
    return staff.find((s) => s.name === duty?.name)?.id ?? desk[0]?.id ?? null;
  }, [role, acting, team, branchId, staff]);
  // Switch only when the signed-in person differs (each switch is written to the Audit Log, as on the desktop).
  useEffect(() => {
    if (deskId ? user.staffId !== deskId : user.kind !== 'manager') switchAccount(branchId, deskId);
  }, [branchId, deskId, switchAccount, user.staffId, user.kind]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setMenu(false);
  }, [route.path]);

  const go = useCallback((page: string) => navigate(`/branch/${branchId}/${page}`), [navigate, branchId]);
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
  const allowed = PAGES.filter((p) => canOpenPage(user.role, p.id));
  const page = [...PAGES, ...EXTRA].find((p) => p.id === pageId) ?? PAGES[0]!;
  const blocked = !EXTRA.includes(page) && !canOpenPage(user.role, page.id);
  const canBill = canOpenPage(user.role, 'billing');
  // With billing, the centre of the bar is a big + that starts a quick bill (like the Referrer Portal's New request).
  const tabs = TAB_ORDER.filter((id) => allowed.some((p) => p.id === id) && (!canBill || id !== 'billing')).slice(0, canBill ? 3 : 4);
  const branch = getBranch(branchId);
  const Screen = page.screen;
  // A chat takes the whole screen (no tab bar), as in the admin and the PR agent app.
  const chat = page.id === 'messages' && !!route.segments[3];
  const bare = focus || chat;
  const chrome = useMemo(() => ({ branchId, setFocusMode: setFocus, go }), [branchId, go]);

  return (
    <NavCtx.Provider value={nav}>
      <StaffChromeCtx.Provider value={chrome}>
        <AdminShellCtx.Provider value={{ openMenu: () => setMenu((m) => !m), unread, inboxUnread, paths: { notifications: `/branch/${branchId}/notifications`, inbox: `/branch/${branchId}/messages` }, tools: <CalculatorButton branchId={branchId} /> }}>
          <div className="h-dvh overflow-hidden bg-page">
            <StaffMenu open={menu} current={page.id} counts={counts} pages={allowed} branchName={branch?.name ?? ''} onClose={() => setMenu(false)} go={go} />
            <div ref={scroller} className="h-dvh overflow-y-auto md:ml-[264px]">
              <main className={`mx-auto w-full max-w-[860px] px-5 md:px-8 ${bare ? 'pb-10' : 'pb-32 md:pb-12'}`}>
                <div key={`${branchId}/${page.id}`} className="page-pop">
                  {blocked ? <NoAccess label={page.label} role={user.role} onHome={() => go('dashboard')} /> : <Screen />}
                </div>
              </main>
            </div>
            {!bare && (
              <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(8px,var(--safe-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(30,74,160,0.08)] md:hidden">
                {tabs.map((id, i) => {
                  const t = PAGES.find((p) => p.id === id)!;
                  const on = !menu && page.id === id;
                  const tab = (
                    <button key={id} type="button" onClick={() => go(id)} aria-current={on ? 'page' : undefined} className="press relative flex min-h-15 flex-col items-center justify-center gap-1">
                      <NavCount id={id} counts={counts} dot />
                      <t.icon size={24} strokeWidth={on ? 2.3 : 1.7} className={on ? 'text-brand-600' : 'text-[#6b778c]'} />
                      <span className={`text-[12px] ${on ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>{id === 'dashboard' ? 'Home' : t.label.split(' ')[0]}</span>
                    </button>
                  );
                  if (!(canBill && i === 1)) return tab;
                  return [
                    tab,
                    <button key="new-bill" type="button" onClick={() => navigate(`/branch/${branchId}/billing?new=1`)} aria-label="Start a quick bill" className="press flex flex-col items-center">
                      <span className="-mt-7 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_10px_24px_rgba(31,111,232,0.45)]">
                        <Plus size={32} strokeWidth={2.6} />
                      </span>
                      <span className={`mt-1 text-[12px] font-semibold ${page.id === 'billing' ? 'text-brand-700' : 'text-brand-600'}`}>Bill</span>
                    </button>,
                  ];
                })}
                <button type="button" onClick={() => setMenu((m) => !m)} aria-label="More pages" className="press relative flex min-h-15 flex-col items-center justify-center gap-1" style={{ gridColumn: 5 }}>
                  {allowed.some((p) => !tabs.includes(p.id) && (counts[p.id]?.n ?? 0) > 0) && <span aria-hidden="true" className="absolute right-[calc(50%-16px)] top-2 h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-white" />}
                  <MenuIcon size={24} strokeWidth={menu || !tabs.includes(page.id) ? 2.3 : 1.7} className={menu || !tabs.includes(page.id) ? 'text-brand-600' : 'text-[#6b778c]'} />
                  <span className={`text-[12px] ${menu || !tabs.includes(page.id) ? 'font-semibold text-brand-600' : 'text-[#6b778c]'}`}>More</span>
                </button>
              </nav>
            )}
            {toast && (
              <div role="status" className="fixed left-1/2 z-[90] flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white shadow-2xl" style={{ bottom: focus ? 'calc(96px + var(--safe-bottom))' : 'calc(96px + var(--safe-bottom))' }}>
                <CheckCircle2 size={19} className="shrink-0 text-[#4ade80]" />
                {toast}
              </div>
            )}
          </div>
        </AdminShellCtx.Provider>
      </StaffChromeCtx.Provider>
    </NavCtx.Provider>
  );
}

function NoAccess({ label, role, onHome }: { label: string; role: string; onHome: () => void }) {
  return (
    <div className="pt-[calc(var(--safe-top)+48px)]">
      <div className="rounded-[24px] bg-white p-6 text-center ring-1 ring-line/70">
        <p className="text-[18px] font-bold text-ink">{label} isn't part of your work</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Your account ({role}) covers the branch's day to day work. {label} is for the Branch Manager. Ask them if you need something from it.</p>
        <button type="button" onClick={onHome} className="press mt-4 min-h-11 rounded-2xl bg-brand-600 px-5 text-[14.5px] font-semibold text-white">
          Back to my dashboard
        </button>
      </div>
    </div>
  );
}

function StaffMenu({ open, current, counts, pages, branchName, onClose, go }: { open: boolean; current: string; counts: NavCounts; pages: StaffPage[]; branchName: string; onClose: () => void; go: (p: string) => void }) {
  const { user, staff } = useCompany();
  const role = useRole();
  const team = useTeam();
  const me = staff.find((s) => s.id === user.staffId);
  const photo = me ? photoOf(me) : undefined;
  const desk = team.frontDesk(user.branchId ?? '');
  return (
    <>
      <button aria-label="Close menu" aria-hidden={!open} tabIndex={open ? 0 : -1} className={`fixed inset-0 z-40 bg-[#0b1730]/30 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose} />
      <aside aria-label="Branch menu" className={`fixed bottom-0 left-0 top-0 z-50 flex w-[290px] flex-col border-r border-line bg-white pb-[var(--safe-bottom)] pt-[var(--safe-top)] transition-[translate,box-shadow] duration-[380ms] ease-[cubic-bezier(0.22,0.8,0.24,1)] md:w-[264px] md:translate-x-0 ${open ? 'translate-x-0 shadow-[10px_0_40px_rgba(11,23,48,0.12)]' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <p className="text-[21px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">STANLEY</p>
            <p className="mt-1 text-[9.5px] font-semibold tracking-[0.25em] text-muted">{branchName.toUpperCase()} BRANCH</p>
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
          {role === 'frontdesk' && desk.length > 1 && (
            <div className="mt-2">
              <p className="px-2 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-faint">SIGNED IN AS</p>
              <div className="flex flex-wrap gap-1">
                {desk.map((s) => (
                  <button key={s.id} type="button" onClick={() => setActingStaff(s.id)} className={`press rounded-full px-2.5 py-1 text-[12px] font-semibold ${user.staffId === s.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                    {s.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {pages.map((p) => {
            const on = p.id === current;
            return (
              <button key={p.id} type="button" onClick={() => (go(p.id), onClose())} aria-current={on ? 'page' : undefined} className={`press flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] ${on ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-2 hover:bg-page'}`}>
                <p.icon size={20} strokeWidth={on ? 2.2 : 1.8} />
                <span className="flex-1">{p.label}</span>
                <NavCount id={p.id} counts={counts} />
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-line px-4 py-3.5">
          {photo ? <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <InitialsAvatar name={user.name} size={40} />}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-[12.5px] text-muted">
              {user.role} · {branchName} branch
            </span>
          </span>
        </div>
      </aside>
    </>
  );
}
