/**
 * Settings (mobile, owner 2026-11-25): the desktop Settings Center for the
 * Company Admin, as a settings home: your profile card, a search that matches
 * what each setting controls ("discount", "patient id", "backup"), and the
 * same four groups (Control center, Organisation, Business configuration,
 * System) with badges for what needs attention. Each section opens as a
 * slide-up (src/admin/settingsSections.tsx) and writes to the same stores the
 * desktop uses. Staff, Audit log and Inventory are full pages on mobile, so
 * those rows go there.
 */
import { useState, type ComponentType } from 'react';
import { Bell, BookOpenText, Building2, Check, ChevronRight, ClipboardCheck, CreditCard, Database, Gauge, Handshake, Info, KeyRound, LayoutDashboard, Package, Palette, Plug, ScrollText, Search, ShieldCheck, Stethoscope, Store, UserRound, UserSquare2, Users, X, type LucideIcon } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { useProfile } from '@company/services/settingsStore';
import { useOrgFacts } from '@company/features/settings/admin/orgData';
import { InitialsAvatar } from '@/ui/kit';
import { Sheet } from '../ui';
import { AdminTopBar, PageGlow } from '../kit';
import { PageTitle } from '../branchFirst';
import * as S from '../settingsSections';
import { useSignIn } from '../signin';
import { PERMISSION_GROUPS, can, usePermissions } from '@company/services/permissions';
import { getBranch } from '@company/data/company';
import { useStaffChrome } from '@/staff/chrome';
import { useInBranch, useRight } from '../access';
import { photoOf } from '../people';

interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  hint: string;
  keywords: string;
  /** Full page on mobile. */
  page?: string;
}
const GROUPS: { label: string; sections: Section[] }[] = [
  {
    label: 'Control center',
    sections: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, tint: 'bg-brand-50 text-brand-600', hint: 'The organisation at a glance and what needs attention.', keywords: 'dashboard alerts status quick' },
      { id: 'profile', label: 'My profile', icon: UserRound, tint: 'bg-brand-50 text-brand-600', hint: 'Your own account: photo and contact details.', keywords: 'photo avatar name email phone account' },
      { id: 'signin', label: 'Sign-in and password', icon: KeyRound, tint: 'bg-brand-50 text-brand-600', hint: 'Your sign-in email and password, set by you.', keywords: 'password login sign in email reset change security account' },
      { id: 'about', label: 'About my account', icon: BookOpenText, tint: 'bg-brand-50 text-brand-600', hint: 'Your role in plain words: what you can do and who to ask.', keywords: 'about role duties rules' },
    ],
  },
  {
    label: 'Organisation',
    sections: [
      { id: 'company', label: 'Company settings', icon: Building2, tint: 'bg-tint-purple text-violet', hint: 'Company information, logo and what receipts print.', keywords: 'company name logo branding receipt registration rc address motto' },
      { id: 'branches', label: 'Branch management', icon: Store, tint: 'bg-tint-purple text-violet', hint: 'Add, edit, activate or suspend branches; contact and payment methods.', keywords: 'branch add code activate suspend deactivate contact hours' },
      { id: 'monitoring', label: 'Branch monitoring', icon: Gauge, tint: 'bg-tint-purple text-violet', hint: 'Branch health side by side.', keywords: 'health compare comparison activity sync' },
      { id: 'managers', label: 'Branch managers', icon: KeyRound, tint: 'bg-tint-purple text-violet', hint: 'Who runs each branch: assign, replace, remove.', keywords: 'manager assign replace remove head' },
      { id: 'staff', label: 'Staff management', icon: Users, tint: 'bg-tint-purple text-violet', hint: 'Every staff account: roles, status, the front desk rota.', keywords: 'staff front desk transfer role suspend employee rota', page: '/staff' },
      { id: 'roles', label: 'Roles and permissions', icon: ShieldCheck, tint: 'bg-tint-purple text-violet', hint: 'What each role can see and do.', keywords: 'permissions roles access rights discount override' },
    ],
  },
  {
    label: 'Business configuration',
    sections: [
      { id: 'approvals', label: 'Approvals and workflows', icon: ClipboardCheck, tint: 'bg-tint-orange text-orange', hint: 'Everything waiting for a decision, and how approvals work.', keywords: 'approval queue expense reject workflow pending' },
      { id: 'patients', label: 'Patient and registration', icon: UserSquare2, tint: 'bg-tint-orange text-orange', hint: 'Patient ID format per branch and registration rules.', keywords: 'patient id format referred walk in duplicate phone registration' },
      { id: 'billing', label: 'Billing and payments', icon: CreditCard, tint: 'bg-tint-orange text-orange', hint: 'Payment methods, split payments, discounts and numbering.', keywords: 'payment method cash pos transfer split discount invoice receipt numbering' },
      { id: 'referral', label: 'Referral and commission', icon: Handshake, tint: 'bg-tint-orange text-orange', hint: 'The company commission rate and referral rules.', keywords: 'referral commission pr agent hospital rate percentage' },
      { id: 'services', label: 'Services and inventory', icon: Package, tint: 'bg-tint-orange text-orange', hint: 'The catalogue and who can change prices.', keywords: 'services inventory catalogue price list categories' },
    ],
  },
  {
    label: 'System',
    sections: [
      { id: 'notifications', label: 'Notifications', icon: Bell, tint: 'bg-tint-green text-good', hint: 'Which notifications appear in the app.', keywords: 'notifications alerts email sms bell' },
      { id: 'security', label: 'Security and access', icon: ShieldCheck, tint: 'bg-tint-green text-good', hint: 'Access control, sensitive actions and security history.', keywords: 'security password login session access' },
      { id: 'appearance', label: 'Appearance and themes', icon: Palette, tint: 'bg-tint-green text-good', hint: 'The colour theme of the desktop app.', keywords: 'theme colour color appearance' },
      { id: 'health', label: 'System health', icon: Stethoscope, tint: 'bg-tint-green text-good', hint: 'Scans, automatic backups and recent problems.', keywords: 'scan errors health problem crash backup' },
      { id: 'data', label: 'Data and backup', icon: Database, tint: 'bg-tint-green text-good', hint: "What's stored on this device, backups and restore.", keywords: 'backup restore data storage export file' },
      { id: 'integrations', label: 'Integrations', icon: Plug, tint: 'bg-tint-green text-good', hint: 'Connected services, honest status only.', keywords: 'integration cloud sync email sms payment gateway' },
      { id: 'audit', label: 'Audit log', icon: ScrollText, tint: 'bg-tint-green text-good', hint: 'Every change, who made it and when.', keywords: 'audit log history activity', page: '/audit' },
      { id: 'system', label: 'System and about', icon: Info, tint: 'bg-tint-green text-good', hint: 'System configuration, version and data sources.', keywords: 'system version timezone currency format about' },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.sections);

function AboutSection() {
  const { user } = useCompany();
  usePermissions();
  if (user.role !== 'Company Admin') return <MyAccess />;
  return (
    <>
      <div className="rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff] p-4">
        <p className="text-[12.5px] text-ink-2">You are</p>
        <p className="text-[20px] font-bold text-ink">{user.role}</p>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">You run the whole company: every branch, its money, people, PR network and settings.</p>
      </div>
      <div className="mt-3 space-y-3 px-1 text-[13.5px] leading-relaxed text-ink-2">
        <p>
          <b className="text-ink">What you can do:</b> see every branch and the company figures (including net profit), approve expenses, add and manage branches, managers and staff, set roles and permissions, change the commission rate and prices, restore from Trash, and back up the data.
        </p>
        <p>
          <b className="text-ink">What you don't do:</b> register patients or create bills. That is branch work for the Branch Manager and the Front Desk.
        </p>
        <p>
          <b className="text-ink">Rules:</b> every change is recorded in the Audit Log; nothing is deleted outright; money never shows on the Referrer Portal.
        </p>
      </div>
    </>
  );
}

/** Branch roles: what this role can do, straight from Roles and Permissions. */
function MyAccess() {
  const { user } = useCompany();
  usePermissions();
  const role = user.role as 'Branch Manager' | 'Front Desk';
  const groups = PERMISSION_GROUPS.map((g) => ({ g, perms: g.perms.filter((p) => !p.adminOnly) })).filter((x) => x.perms.length);
  return (
    <>
      <div className="rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff] p-4">
        <p className="text-[12.5px] text-ink-2">You are</p>
        <p className="text-[20px] font-bold text-ink">{user.role}</p>
        <p className="mt-1 text-[13px] leading-snug text-ink-2">{role === 'Branch Manager' ? 'You run your branch: its team, its money, its PR agents and its price list.' : 'You receive patients, bill them and keep the branch records.'} What you can do is set by the Company Admin in Roles and Permissions.</p>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map(({ g, perms }) => (
          <div key={g.id}>
            <p className="mb-1.5 px-1 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted">{g.label}</p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line/70">
              {perms.map((p) => {
                const on = can(user.role, p.id);
                return (
                  <li key={p.id} className="flex items-start gap-3 px-3.5 py-2.5">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? 'bg-good text-white' : 'bg-page text-faint ring-1 ring-line'}`}>{on ? <Check size={12} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}</span>
                    <span className="min-w-0">
                      <b className={`block text-[13.5px] ${on ? 'text-ink' : 'text-muted'}`}>{p.label}</b>
                      <span className="block text-[12px] text-muted">{p.description}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/** My branch: its details; contact and hours editable with "Edit branch details". */
function MyBranchSection() {
  const { branchId } = useStaffChrome();
  const right = useRight();
  const [open, setOpen] = useState(true);
  const b = getBranch(branchId);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 rounded-2xl bg-page p-3.5 text-left">
        <Store size={20} className="text-brand-600" />
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] text-ink">{b?.name} branch · {b?.code}</b>
          <span className="block text-[12.5px] text-muted">{right('branch.settings') ? 'Address, phone, Google Maps link and opening hours' : 'View the branch details'}</span>
        </span>
        <ChevronRight size={17} className="text-faint" />
      </button>
      {open && branchId && <S.BranchSettingsSheet branchId={branchId} limited canEdit={right('branch.settings')} onClose={() => setOpen(false)} />}
    </>
  );
}

const BODY: Record<string, ComponentType<{ go: S.Go }>> = {
  mybranch: () => <MyBranchSection />,
  overview: ({ go }) => <S.OverviewSection go={go} />,
  profile: () => <S.ProfileSection />,
  about: () => <AboutSection />,
  signin: () => <S.SignInSection />,
  company: () => <S.CompanySection />,
  branches: () => <S.BranchesSection />,
  monitoring: () => <S.MonitoringSection />,
  managers: () => <S.ManagersSection />,
  roles: () => <S.RolesSection />,
  approvals: ({ go }) => <S.ApprovalsSection go={go} />,
  patients: () => <S.PatientsSection />,
  billing: ({ go }) => <S.BillingSection go={go} />,
  referral: () => <S.ReferralSection />,
  services: () => <S.ServicesSection />,
  notifications: () => <S.NotificationsSection />,
  security: () => <S.SecuritySection />,
  appearance: () => <S.AppearanceSection />,
  health: () => <S.DesktopOnly what="System health" why="Error scans and automatic backups run on the desktop computer that holds the branch data. Backups can also be made here, in Data and backup." />,
  data: () => <S.DataSection />,
  integrations: () => <S.IntegrationsSection />,
  system: () => <S.SystemSection />,
};

/** Branch workspace (owner, 2026-11-25): personal settings, the branch's details, and only what the role allows. */
const BRANCH_GROUPS = (right: (p: string) => boolean): { label: string; sections: Section[] }[] => [
  { label: 'My account', sections: ALL.filter((s) => s.id === 'profile' || s.id === 'signin' || s.id === 'about').map((s) => (s.id === 'about' ? { ...s, label: 'My access', hint: 'What your role can do, from Roles and Permissions.' } : s)) },
  {
    label: 'My branch',
    sections: [
      { id: 'mybranch', label: 'Branch details', icon: Store, tint: 'bg-tint-purple text-violet', hint: 'Address, phone, Google Maps link and opening hours. PR agents send them to patients.', keywords: 'branch address phone email hours opening map google location receipt' },
      ...ALL.filter((s) => s.id === 'approvals' && right('expenses.approve')),
    ],
  },
  { label: 'This phone', sections: ALL.filter((s) => s.id === 'appearance' || (s.id === 'audit' && right('audit.view'))) },
];

export function SettingsPage() {
  const { navigate, user, staff } = useCompany();
  const inBranch = useInBranch();
  const { branchId } = useStaffChrome();
  const right = useRight();
  const groups = inBranch ? BRANCH_GROUPS(right) : GROUPS;
  const allShown = groups.flatMap((g) => g.sections);
  const facts = useOrgFacts();
  const p = useProfile(user.key);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const mySignIn = useSignIn(user.key);
  const badges: Record<string, number> = {
    signin: mySignIn?.hash && mySignIn.email ? 0 : 1,
    approvals: facts.pendingApprovals,
    managers: facts.perBranch.filter((b) => !b.manager && b.branch.status !== 'Inactive').length,
    data: facts.backupOverdue ? 1 : 0,
    company: facts.companyGaps.length ? 1 : 0,
  };
  const go = (id: string) => {
    const s = allShown.find((x) => x.id === id) ?? ALL.find((x) => x.id === id);
    if (s?.page) return navigate(inBranch ? `/branch/${branchId}${s.page}` : s.page);
    setOpen(id);
  };
  const t = q.trim().toLowerCase();
  const hits = t ? allShown.map((s) => ({ s, n: s.label.toLowerCase().includes(t) ? 0 : s.hint.toLowerCase().includes(t) ? 1 : s.keywords.includes(t) ? 2 : 9 })).filter((x) => x.n < 9).sort((a, b) => a.n - b.n).map((x) => x.s) : [];
  const cur = open ? (allShown.find((s) => s.id === open) ?? null) : null;
  const Body = open ? BODY[open] : null;
  // Staff: their Staff Management photo (team pictures resolve through people.photoOf).
  const me = staff.find((x) => x.id === user.staffId);
  const photo = p.photo === undefined ? (me ? photoOf(me) : user.photo) : p.photo || undefined;

  const row = (s: Section) => (
    <button key={s.id} type="button" onClick={() => go(s.id)} className="press flex w-full items-center gap-3 px-3.5 py-3 text-left">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tint}`}>
        <s.icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-ink">{s.label}</span>
        <span className="block truncate text-[12px] text-muted">{s.hint}</span>
      </span>
      {badges[s.id] ? <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-[#ef4444] px-1.5 text-[11.5px] font-bold text-white">{badges[s.id]}</span> : null}
      <ChevronRight size={17} className="shrink-0 text-faint" />
    </button>
  );

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Settings" sub={inBranch ? `Your account and ${getBranch(branchId)?.name ?? ''} branch` : 'Company configuration · whole organisation'} />

        <button type="button" onClick={() => go('profile')} className="press relative mb-4 flex w-full items-center gap-3 overflow-hidden rounded-[24px] bg-linear-to-br from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7] p-4 text-left text-white shadow-[0_14px_30px_rgba(31,99,214,0.25)]">
          <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <span className="relative rounded-full ring-[3px] ring-white/70">{photo ? <img src={photo} alt="" className="h-14 w-14 rounded-full object-cover" /> : <InitialsAvatar name={p.name ?? user.name} size={56} />}</span>
          <span className="relative min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold">{p.name ?? user.name}</span>
            <span className="block truncate text-[12.5px] text-white/85">
              {[user.role, p.email ?? (user.email && !/not on record/i.test(user.email) ? user.email : '')].filter(Boolean).join(' · ')}
            </span>
          </span>
          <ChevronRight size={20} className="relative shrink-0" />
        </button>

        <div className="relative mb-4">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings, for example discount" aria-label="Search settings" className="min-h-12 w-full rounded-full bg-white pl-11 pr-11 text-[15px] text-ink shadow-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted">
              <X size={18} />
            </button>
          )}
        </div>

        {t ? (
          <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-line/70 divide-y divide-line">{hits.length ? hits.map(row) : <p className="px-4 py-6 text-center text-[13.5px] text-muted">No setting matches “{q}”.</p>}</div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-4">
              <h2 className="mb-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted">{g.label}</h2>
              <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.05)] ring-1 ring-line/70">{g.sections.map(row)}</div>
            </section>
          ))
        )}
      </div>
      {cur && Body && (
        <Sheet title={cur.label} subtitle={cur.hint} onClose={() => setOpen(null)} tall>
          <div className="px-1 pb-3">
            <Body go={go} />
          </div>
        </Sheet>
      )}
    </div>
  );
}
