/**
 * Staff Management (mobile, owner 2026-11-25): same content and rules as the
 * desktop StaffPage + StaffWorkspace + AddStaffDialog, in the admin's mobile
 * card language. Branch first, then:
 *   the branch manager (head of every staff member, one per branch) · staff
 *   figures · the front desk rota (who is on seat each day) · the team with
 *   search, role and status filters.
 * Every person opens a profile slide-up: contact, employment, team or who
 * they report to, access and permissions (from the role), days on seat,
 * chat, call, Edit profile (details, role, employment, status, notes; the
 * manager role is closed while the branch has one), photo, move to trash.
 * Add staff: name, email or phone (at least one), branch, role, start date,
 * employment type. Changes last for the session until the database exists.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, CalendarDays, Camera, ChevronRight, Copy, Crown, Mail, MessageCircle, Pencil, Phone, Plus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, getBranch } from '@company/data/company';
import { EMPLOYMENT_TYPES, MANAGER_ROLE, STAFF_ROLES, STAFF_STATUSES, isManager, managerOf, type StaffRecord, type StaffStatus } from '@company/data/userRecords';
import { readImage, updateProfile, useSettings } from '@company/services/settingsStore';
import { formatCount } from '@company/shared/format';
import { useNav } from '@/app/store';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { LongText } from '../fields';
import { RuleInput } from '../fields';
import { SignInStatus } from '../settingsSections';
import { emailProblem, nameProblem, phoneProblem } from '@/ui/fieldRules';
import { Sheet } from '../ui';
import { AdminTopBar, EmptyCard, PageGlow, SectionTitle } from '../kit';
import { DutyRota } from '../duty';
import { frontDeskId, managerId } from '../chat';
import { photoOf, useTeam } from '../people';
import { FieldErr, FieldLabel, TrashSheet, inputCls, nameCase } from '../prManage';
import { PICK_THEME, BranchCrumb, BranchPick, Chips, Facts, PageTitle, useBranchFirst } from '../branchFirst';
import { StickyTools } from '@/admin/kit';
import { copyText } from '@/ui/privacy';
import { useChatLink, useInBranch, useRight } from '../access';
import { AccountCard, QueriesCard } from '../staffQueries';
import { staffKey, useAccountAccess } from '@company/services/accountAccess';
import { usesApp } from '@company/data/userRecords';

const STATUS_TONE: Record<StaffStatus, string> = { Active: 'bg-tint-green text-good-ink', 'On leave': 'bg-[#fff1e0] text-[#b45309]', Suspended: 'bg-[#fdecec] text-[#b42318]', Left: 'bg-page text-muted' };
const longDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not on record');
function tenure(iso: string): string {
  if (!iso) return 'Not on record';
  const start = new Date(`${iso}T00:00:00`);
  const now = new Date();
  if (start > now) return `Starts ${longDate(iso)}`;
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() - (now.getDate() < start.getDate() ? 1 : 0);
  if (months < 1) return 'Less than a month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} year${y === 1 ? '' : 's'}` : '', m ? `${m} month${m === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
}

function Face({ s, size }: { s: StaffRecord; size: number }) {
  useSettings(); // re-render when a photo changes
  const src = photoOf(s);
  return src ? <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} /> : <InitialsAvatar name={s.name} size={size} />;
}

export function StaffPage({ sub }: { sub?: string }) {
  const { branch, fromScope } = useBranchFirst(sub);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar title={branch ? 'Staff' : undefined} />
      <div className="relative">{branch ? <Workspace branchId={branch.id} crumb={!fromScope} /> : <Choose />}</div>
    </div>
  );
}

function Choose() {
  const { staff } = useCompany();
  return (
    <>
      <PageTitle title="Staff Management" sub="All branches" />
      <BranchPick
        page="staff"
        sticker="womanHealthWorker"
        go="Open"
        theme={PICK_THEME.staff}
        note="Each branch has one manager who heads its staff. Choose a branch."
        stats={(b) => {
          const people = staff.filter((s) => s.branchId === b.id && s.status !== 'Left');
          const m = managerOf(staff, b.id);
          return [
            { label: 'Branch manager', value: m ? m.name : 'Not assigned yet' },
            { label: 'Staff', value: formatCount(people.length) },
            { label: 'Active', value: formatCount(people.filter((s) => s.status === 'Active').length) },
            { label: 'On leave', value: formatCount(people.filter((s) => s.status === 'On leave').length) },
          ];
        }}
        foot={(b) => {
          const n = staff.filter((s) => s.branchId === b.id && s.status !== 'Left').length;
          return n ? `${formatCount(n)} people at ${b.name}` : 'No staff added yet';
        }}
      />
    </>
  );
}

function Workspace({ branchId, crumb }: { branchId: string; crumb: boolean }) {
  const { staff, navigate, user } = useCompany();
  const team = useTeam();
  const b = getBranch(branchId)!;
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState<'all' | StaffStatus>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ role?: string } | null>(null);
  // Roles and Permissions: front desk staff (staff.manage); the manager is appointed by the Company Admin (branch.managers).
  const chatLink = useChatLink();
  const right = useRight();
  const canManage = right('staff.manage');
  const canManagers = right('branch.managers');
  const people = staff.filter((s) => s.branchId === branchId);
  const manager = managerOf(staff, branchId);
  const others = people.filter((s) => s.id !== manager?.id);
  const current = people.filter((s) => s.status !== 'Left');
  const duty = team.onDuty(branchId);
  const t = q.trim().toLowerCase();
  const shown = others.filter((s) => (role === 'all' || s.role === role) && (status === 'all' || s.status === status) && (!t || `${s.name} ${s.role} ${s.phone} ${s.email} ${s.id}`.toLowerCase().includes(t)));
  return (
    <>
      {crumb && <BranchCrumb page="staff" label="Staff" branch={b} />}
      <PageTitle
        title="Staff Management"
        sub={`${b.name} branch · ${b.code}`}
        action={
          canManage && <button type="button" onClick={() => setAdding({})} aria-label="Add staff" className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand-600 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
            <Plus size={18} /> Add
          </button>
        }
      />

      {/* Manager */}
      {manager ? (
        <div role="button" tabIndex={0} onClick={() => setOpen(manager.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(manager.id))} className="press relative cursor-pointer overflow-hidden rounded-[24px] bg-linear-to-br from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7] p-5 text-white shadow-[0_14px_34px_rgba(31,99,214,0.25)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3.5">
            <span className="relative shrink-0">
              <span className="block rounded-full ring-[3px] ring-white/80">
                <Face s={manager} size={66} />
              </span>
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#f5b301] text-white ring-2 ring-white">
                <Crown size={14} />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-white/85">Branch manager · {manager.id}</p>
              <p className="truncate text-[20px] font-bold leading-tight">{manager.name}</p>
              <p className="mt-0.5 text-[12.5px] text-white/90">
                {manager.status} · leads {formatCount(others.filter((s) => s.status !== 'Left').length)} staff · {tenure(manager.startDate)}
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
            {manager.name !== user.name && <button type="button" onClick={(e) => (e.stopPropagation(), navigate(chatLink.manager(branchId)))} className="press inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-semibold text-brand-700 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
              <MessageCircle size={15} /> Chat
            </button>}
            {manager.phone && (
              <a href={`tel:${manager.phone.replace(/\s+/g, '')}`} onClick={(e) => e.stopPropagation()} className="press inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white ring-1 ring-white/40">
                <Phone size={15} /> Call
              </a>
            )}
            <span className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white ring-1 ring-white/40">
              Profile <ChevronRight size={15} />
            </span>
          </div>
        </div>
      ) : !canManagers ? (
        <div className="flex w-full items-center gap-3 rounded-[22px] bg-white p-4 ring-1 ring-line/70">
          <Sticker name="manHealthWorker" size={44} />
          <span className="text-[13px] text-muted">No branch manager yet. The Company Admin appoints one.</span>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding({ role: MANAGER_ROLE })} className="press flex w-full items-center gap-3 rounded-[22px] border-[1.5px] border-dashed border-[#9cc3ff] bg-brand-50/60 p-4 text-left">
          <Sticker name="manHealthWorker" size={44} />
          <span>
            <span className="block text-[15px] font-bold text-ink">Add the branch manager</span>
            <span className="block text-[12.5px] text-muted">The head of every staff member at {b.name}.</span>
          </span>
        </button>
      )}

      {/* Figures */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat tint="bg-tint-blue border-[#d6e7ff]" icon={<Users size={22} className="text-brand-500" />} label="Staff" value={formatCount(current.length)} sub={`${formatCount(current.filter((s) => !isManager(s)).length)} report to the manager`} onClick={() => setStatus('all')} />
        <Stat tint="bg-tint-green border-[#cdeedb]" icon={<BadgeCheck size={22} className="text-good" />} label="Active" value={formatCount(people.filter((s) => s.status === 'Active').length)} sub="Working now" onClick={() => setStatus('Active')} />
        <Stat
          tint="bg-tint-orange border-[#ffe2c6]"
          icon={<CalendarDays size={22} className="text-orange" />}
          label="Away"
          value={formatCount(people.filter((s) => s.status === 'On leave' || s.status === 'Suspended').length)}
          sub={`${formatCount(people.filter((s) => s.status === 'On leave').length)} on leave · ${formatCount(people.filter((s) => s.status === 'Suspended').length)} suspended`}
          onClick={() => setStatus('On leave')}
        />
      </div>

      {/* Who is on seat */}
      <DutyRota branchId={branchId} />

      <SectionTitle title={`Team · ${formatCount(others.length)}`} />
      <StickyTools>
      <div className="relative mb-2.5">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, phone, email or ID" aria-label="Search staff" className="min-h-12 w-full rounded-full bg-white pl-11 pr-11 text-[15px] text-ink shadow-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500" />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted">
            <X size={18} />
          </button>
        )}
      </div>
      <Chips label="Role" value={role} onChange={setRole} options={[{ value: 'all', label: 'All roles' }, ...STAFF_ROLES.filter((r) => r.value !== MANAGER_ROLE).map((r) => ({ value: r.value, label: r.value, count: others.filter((s) => s.role === r.value).length }))]} />
      </StickyTools>
      <Chips label="Status" value={status} onChange={setStatus} options={[{ value: 'all' as const, label: 'Any status' }, ...STAFF_STATUSES.map((s) => ({ value: s, label: s, count: others.filter((x) => x.status === s).length }))]} />

      {shown.length === 0 ? (
        others.length === 0 && canManage ? (
          <button type="button" onClick={() => setAdding({ role: 'Front Desk' })} className="press flex w-full items-center gap-3 rounded-[22px] border-[1.5px] border-dashed border-[#9cc3ff] bg-brand-50/60 p-4 text-left">
            <Sticker name="womanHealthWorker" size={44} />
            <span>
              <span className="block text-[15px] font-bold text-ink">Add front desk staff</span>
              <span className="block text-[12.5px] text-muted">{manager ? `They report to ${manager.name}.` : 'They report to the branch manager.'}</span>
            </span>
          </button>
        ) : (
          <EmptyCard sticker="clipboard" text="No staff match these filters." />
        )
      ) : (
        <ul className="space-y-2.5">
          {shown.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s.id)} className="press flex w-full items-start gap-3 rounded-[20px] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
                <Face s={s} size={50} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[15.5px] font-bold text-ink">{s.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_TONE[s.status]}`}>{s.status}</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {s.role} · {s.employment} · {s.id}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {duty?.name === s.name && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11.5px] font-semibold text-white">On seat today</span>}
                    <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{tenure(s.startDate)}</span>
                    {s.phone && <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{s.phone}</span>}
                  </span>
                  <span className="mt-2 block border-t border-line pt-2 text-[12px] text-muted">Reports to {manager ? manager.name : 'the branch manager (not assigned)'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-[12px] leading-relaxed text-muted">No staff records came with the legacy export, so people are added here. Changes last for this session until the database is connected.</p>

      {open && staff.find((s) => s.id === open) && <StaffProfileSheet member={staff.find((s) => s.id === open)!} onClose={() => setOpen(null)} />}
      {adding && <AddStaffSheet branchId={branchId} presetRole={adding.role} onClose={() => setAdding(null)} onCreated={setOpen} />}
    </>
  );
}

function Stat({ tint, icon, label, value, sub, onClick }: { tint: string; icon: ReactNode; label: string; value: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`press flex min-h-[118px] min-w-0 flex-col items-start rounded-[18px] border p-3 text-left ${tint}`}>
      {icon}
      <span className="mt-1.5 text-[13px] leading-tight text-ink-2">{label}</span>
      <span className="mt-0.5 text-[22px] font-bold leading-none text-ink">{value}</span>
      <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{sub}</span>
    </button>
  );
}

/* ─────────────── a person's profile ─────────────── */

export function StaffProfileSheet({ member, onClose }: { member: StaffRecord; onClose: () => void }) {
  const { staff, moveStaffToTrash, navigate } = useCompany();
  const { showToast } = useNav();
  const team = useTeam();
  const [editing, setEditing] = useState(false);
  const [trash, setTrash] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const branch = getBranch(member.branchId);
  const mgr = isManager(member);
  const manager = managerOf(staff, member.branchId);
  const mates = staff.filter((s) => s.branchId === member.branchId && s.id !== member.id && s.status !== 'Left');
  const roleDef = STAFF_ROLES.find((r) => r.value === member.role);
  const onSeatToday = team.onDuty(member.branchId)?.name === member.name;
  // Days on seat this month and the next one (front desk rota).
  const seat = useMemo(() => {
    if (member.role !== 'Front Desk' || member.status !== 'Active') return null;
    const now = new Date();
    let month = 0;
    let next: Date | null = null;
    for (let d = 1; d <= now.getDate(); d++) if (team.onDuty(member.branchId, new Date(now.getFullYear(), now.getMonth(), d))?.name === member.name) month++;
    for (let i = 1; i <= 31 && !next; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (team.onDuty(member.branchId, d)?.name === member.name) next = d;
    }
    return { month, next };
  }, [member, team]);
  const chatLink = useChatLink();
  const inBranch = useInBranch();
  const right = useRight();
  const canManage = right('staff.manage');
  const rightNow = right;
  const accountOff = !!useAccountAccess()[staffKey(member.id)]?.off;
  const chatPath = mgr ? chatLink.manager(member.branchId) : onSeatToday ? chatLink.frontDesk(member.branchId) : null;
  const chatId = chatPath;
  const copy = (text: string, what: string) => copyText(text, what, showToast);
  return (
    <Sheet
      back
      title={member.name}
      subtitle={`${member.role} · ${branch?.name ?? ''} branch`}
      onClose={onClose}
      tall
      footer={
        canManage && (member.role !== MANAGER_ROLE || rightNow('branch.managers')) ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setTrash(true)} aria-label="Move to trash" className="press grid min-h-12 w-12 place-items-center rounded-2xl bg-[#fdecec] text-[#b42318]">
              <Trash2 size={19} />
            </button>
            <button type="button" onClick={() => setEditing(true)} className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              <Pencil size={17} /> Edit profile
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff] p-4">
        <div className="flex items-center gap-3">
          <span className="relative shrink-0">
            <span className="block rounded-full ring-[3px] ring-white">
              <Face s={member} size={66} />
            </span>
            <button type="button" onClick={() => photoInput.current?.click()} aria-label="Change photo" className="press absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white ring-2 ring-white">
              <Camera size={14} />
            </button>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  updateProfile(member.id, { photo: await readImage(file, 320) });
                  showToast('Photo saved');
                } catch (err) {
                  showToast((err as Error).message);
                }
              }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-bold text-ink">{member.name}</p>
            <p className="truncate text-[12.5px] text-ink-2">
              {member.role} · {member.id}
            </p>
            <span className="mt-1 flex flex-wrap gap-1.5">
              {mgr && <span className="flex items-center gap-1 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[11.5px] font-semibold text-[#8a6100]"><Crown size={12} /> Head of branch</span>}
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_TONE[member.status]}`}>{member.status}</span>
              {onSeatToday && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11.5px] font-semibold text-white">On seat today</span>}
              <SignInStatus userKey={member.id} />
              {accountOff && <span className="rounded-full bg-[#ffe4e4] px-2 py-0.5 text-[11.5px] font-semibold text-[#b42318]">Account off</span>}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Quick icon={<MessageCircle size={19} />} label="Chat" onClick={chatPath ? () => navigate(chatPath) : undefined} />
          <Quick icon={<Phone size={19} />} label="Call" href={member.phone ? `tel:${member.phone.replace(/\s+/g, '')}` : undefined} />
          <Quick icon={<Mail size={19} />} label="Email" href={member.email ? `mailto:${member.email}` : undefined} />
          <Quick icon={<Copy size={18} />} label="Copy phone" onClick={member.phone ? () => copy(member.phone, 'Phone number') : undefined} />
        </div>
        {!chatId && <p className="mt-2 text-[11.5px] text-ink-2">Chat goes to the manager and to the front desk person on seat today.</p>}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Fig label="Role" value={member.role} sub={roleDef?.access} />
        <Fig label="With the company" value={tenure(member.startDate)} sub={`Since ${longDate(member.startDate)}`} />
        <Fig label={mgr ? 'Team' : 'Reports to'} value={mgr ? `${formatCount(mates.length)} staff` : (manager?.name ?? 'Not assigned')} sub={mgr ? 'Everyone at the branch' : 'Branch manager'} />
        <Fig label="Status" value={member.status} sub={member.updatedAt ? `Updated ${new Date(member.updatedAt).toLocaleDateString('en-GB')}` : `Added ${new Date(member.createdAt).toLocaleDateString('en-GB')}`} />
      </div>

      {seat && (
        <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <Sticker name="calendar" size={40} />
          <p className="min-w-0 flex-1 text-[13.5px] text-ink-2">
            On seat <b className="text-ink">{formatCount(seat.month)} day{seat.month === 1 ? '' : 's'}</b> this month.
            {seat.next && (
              <>
                {' '}
                Next: <b className="text-ink">{seat.next.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</b>.
              </>
            )}
          </p>
        </div>
      )}

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Contact</p>
      <div className="mb-3 overflow-hidden rounded-[20px] bg-white ring-1 ring-line/70">
        <Facts
          plain
          rows={[
            { label: 'Phone', value: member.phone || 'Not on record' },
            { label: 'Email', value: member.email || 'Not on record' },
            { label: 'Address', value: member.address || 'Not on record' },
          ]}
        />
      </div>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Employment</p>
      <div className="mb-3 overflow-hidden rounded-[20px] bg-white ring-1 ring-line/70">
        <Facts
          plain
          rows={[
            { label: 'Branch', value: branch ? `${branch.name} · ${branch.code}` : member.branchId },
            { label: 'Type', value: member.employment },
            { label: 'Started', value: longDate(member.startDate) },
            ...(member.notes ? [{ label: 'Notes', value: member.notes }] : []),
          ]}
        />
      </div>

      {mgr && (
        <>
          <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Team</p>
          <div className="mb-3 rounded-[20px] bg-white p-2 ring-1 ring-line/70">
            {mates.length ? (
              mates.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <Face s={s} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{s.name}</span>
                    <span className="block text-[12px] text-muted">{s.role}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_TONE[s.status]}`}>{s.status}</span>
                </div>
              ))
            ) : (
              <p className="px-2 py-2 text-[13px] text-muted">No staff added yet. Staff you add to this branch report to {member.name}.</p>
            )}
          </div>
        </>
      )}

      {canManage && <QueriesCard staffId={member.id} staffName={member.name} branchId={member.branchId} />}

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Access and permissions</p>
      <div className="mb-2 rounded-[20px] bg-white p-3 ring-1 ring-line/70">
        <ul className="space-y-2">
          {(roleDef?.permissions ?? []).map((p) => (
            <li key={p} className="flex items-start gap-2 text-[13.5px] text-ink">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" /> {p}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-muted">Access follows the role. To change it, change the role under Edit profile.{mgr ? ' As branch manager they also manage the staff of this branch.' : ''}</p>
        {member.status !== 'Active' && <p className="mt-2 rounded-xl bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#b42318]">While {member.status.toLowerCase()}, this person cannot sign in.</p>}
      </div>
      {canManage && usesApp(member) && !mgr && <AccountCard accountKey={staffKey(member.id)} name={member.name} what={member.role} branchId={member.branchId} />}
      <p className="px-1 pb-2 text-[12px] text-muted">Patients, bills and payments this person records will show here once staff sign in is connected.</p>

      {editing && <StaffEditSheet member={member} onClose={() => setEditing(false)} />}
      {trash && (
        <TrashSheet
          name={member.name}
          what={`staff record${mgr ? ' (the branch will have no manager until you add one)' : ''}`}
          onClose={() => setTrash(false)}
          onConfirm={(reason) => {
            moveStaffToTrash(member.id, reason);
            showToast(`${member.name} moved to trash. Restore it from Trash within 30 days`);
            setTrash(false);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function Quick({ icon, label, onClick, href }: { icon: ReactNode; label: string; onClick?: () => void; href?: string }) {
  const cls = 'press flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/80 text-[11.5px] font-semibold text-brand-700';
  if (href)
    return (
      <a href={href} className={cls}>
        {icon}
        {label}
      </a>
    );
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`${cls} disabled:opacity-40`}>
      {icon}
      {label}
    </button>
  );
}

function Fig({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3 ring-1 ring-line/70">
      <p className="truncate text-[11.5px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 truncate text-[15.5px] font-bold text-ink">{value}</p>
      {sub && <p className="line-clamp-2 text-[11px] leading-snug text-muted">{sub}</p>}
    </div>
  );
}

/* ─────────────── role picker (one manager per branch) ─────────────── */

function RolePick({ value, onChange, blockedBy }: { value: string; onChange: (v: string) => void; blockedBy?: StaffRecord }) {
  return (
    <div className="space-y-2" role="group" aria-label="Role">
      {STAFF_ROLES.map((r) => {
        const blocked = r.value === MANAGER_ROLE && !!blockedBy;
        const on = value === r.value;
        return (
          <button key={r.value} type="button" disabled={blocked} aria-pressed={on} onClick={() => onChange(r.value)} className={`press flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 disabled:opacity-50 ${on ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-line'}`}>
            <Sticker name={r.value === MANAGER_ROLE ? 'manHealthWorker' : 'womanHealthWorker'} size={34} />
            <span className="min-w-0">
              <span className={`block text-[14.5px] font-semibold ${on ? 'text-brand-700' : 'text-ink'}`}>{r.value}</span>
              <span className="block text-[12.5px] text-muted">{blocked ? `${blockedBy!.name} is the manager. Change their role first.` : r.access}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`press min-h-10 rounded-xl px-3.5 text-[14px] font-semibold ${value === o ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ─────────────── edit ─────────────── */

function StaffEditSheet({ member, onClose }: { member: StaffRecord; onClose: () => void }) {
  const { staff, editStaff } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [email, setEmail] = useState(member.email);
  const [address, setAddress] = useState(member.address ?? '');
  const [role, setRole] = useState(member.role);
  const [employment, setEmployment] = useState(member.employment);
  const [startDate, setStartDate] = useState(member.startDate);
  const [status, setStatus] = useState<StaffStatus>(member.status);
  const [notes, setNotes] = useState(member.notes ?? '');
  const [tried, setTried] = useState(false);
  const otherManager = useMemo(() => staff.find((s) => s.branchId === member.branchId && s.id !== member.id && isManager(s) && s.status !== 'Left'), [staff, member]);
  const errs = {
    name: nameProblem(name),
    phone: phoneProblem(phone),
    email: emailProblem(email),
    contact: !phone.trim() && !email.trim() ? 'Give at least a phone number or an email address.' : null,
    startDate: !startDate ? 'Choose the start date.' : null,
    role: role === MANAGER_ROLE && otherManager ? `${otherManager.name} is already the branch manager. Change their role first.` : null,
  };
  const patch = { name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() || undefined, role, employment, startDate, status, notes: notes.trim() || undefined };
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (patch[k] ?? '') !== (member[k] ?? ''));
  const e = (k: keyof typeof errs) => (tried ? errs[k] : null);
  return (
    <Sheet
      back
      title={`Edit ${member.name}`}
      subtitle="Details, role, employment and status"
      onClose={onClose}
      tall
      footer={
        <button
          type="button"
          disabled={!changed}
          onClick={() => {
            setTried(true);
            if (Object.values(errs).some(Boolean)) return;
            editStaff(member.id, patch);
            showToast(`${patch.name} updated`);
            onClose();
          }}
          className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Save changes
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <RuleInput kind="name" label="Full name" required value={name} onChange={setName} showError={tried} />
        <RuleInput kind="phone" label="Phone number" value={phone} onChange={setPhone} showError={tried} />
        <RuleInput kind="email" label="Email address" value={email} onChange={setEmail} showError={tried} />
        <FieldErr msg={e('contact')} />
        <LongText label="Home address" optional value={address} onChange={setAddress} max={240} minRows={2} placeholder={"House number and street\nArea, city"} hint="Press Enter for a new line." />
        <div>
          <FieldLabel label="Role" />
          <RolePick value={role} onChange={setRole} blockedBy={otherManager} />
          <FieldErr msg={e('role')} />
        </div>
        <div>
          <FieldLabel label="Employment type" />
          <Pills label="Employment type" value={employment} options={EMPLOYMENT_TYPES} onChange={setEmployment} />
        </div>
        <label className="block">
          <FieldLabel label="Start date" required />
          <input type="date" value={startDate} onChange={(x) => setStartDate(x.target.value)} className={inputCls(e('startDate'))} />
          <FieldErr msg={e('startDate')} />
        </label>
        <div>
          <FieldLabel label="Status" />
          <Pills label="Status" value={status} options={STAFF_STATUSES} onChange={setStatus} />
          <span className="mt-1 block text-[12px] text-muted">“Left” keeps the record for history but removes them from the active team.</span>
        </div>
        <LongText label="Notes" optional value={notes} onChange={setNotes} max={400} placeholder="For example: covers weekends; trained on the new POS." hint="Anything the team should know about this person." />
      </div>
    </Sheet>
  );
}

/* ─────────────── add ─────────────── */

export function AddStaffSheet({ branchId, presetRole, onClose, onCreated }: { branchId: string; presetRole?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  const { staff, addStaff } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState(branchId);
  const [role, setRole] = useState(presetRole ?? '');
  const [employment, setEmployment] = useState('Full-time');
  const [start, setStart] = useState('');
  const [tried, setTried] = useState(false);
  const b = getBranch(branch);
  const currentManager = managerOf(staff, branch);
  const errs = {
    name: nameProblem(name),
    phone: phoneProblem(phone),
    email: emailProblem(email),
    contact: !email.trim() && !phone.trim() ? 'Enter an email address or a phone number.' : null,
    role: !role ? 'Choose a role.' : role === MANAGER_ROLE && currentManager ? 'This branch already has a manager. Choose another role.' : null,
    start: !start ? 'Choose the start date.' : null,
  };
  const e = (k: keyof typeof errs) => (tried ? errs[k] : null);
  const r = STAFF_ROLES.find((x) => x.value === role);
  return (
    <Sheet
      title={name.trim() ? `Add ${name.trim()}` : 'Add a staff member'}
      subtitle="Assigned to one branch; the role decides their access"
      onClose={onClose}
      tall
      footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (Object.values(errs).some(Boolean)) return;
            const created = addStaff({ name, role, branchId: branch, status: 'Active', email, phone, employment, startDate: start });
            showToast(`${created.name} added as ${role} at ${b?.name} branch`);
            onCreated?.(created.id);
            onClose();
          }}
          className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          Add staff member
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <div className="flex items-center gap-3 rounded-[20px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff] p-3.5">
          <Sticker name={role === MANAGER_ROLE ? 'manHealthWorker' : 'womanHealthWorker'} size={46} />
          <div className="min-w-0 text-[13px] text-ink-2">
            <p>
              <b className="text-ink">{role || 'Role not chosen'}</b> · {b ? `${b.name} · ${b.code}` : ''}
            </p>
            <p>{r ? r.access : 'Choose a role to see what this person can access.'}</p>
          </div>
        </div>
        <p className="text-[13px] font-semibold text-ink-2">Personal details · at least an email or a phone number</p>
        <RuleInput kind="name" label="Full name" required value={name} onChange={setName} placeholder="For example Chiamaka Eze" showError={tried} />
        <RuleInput kind="email" label="Email address" value={email} onChange={setEmail} showError={tried} />
        <RuleInput kind="phone" label="Phone number" value={phone} onChange={setPhone} showError={tried} />
        <FieldErr msg={e('contact')} />
        <div>
          <FieldLabel label="Branch" required />
          <div className="flex flex-wrap gap-2">
            {ACTIVE_BRANCHES.map((x) => (
              <button key={x.id} type="button" aria-pressed={branch === x.id} onClick={() => setBranch(x.id)} className={`press min-h-10 rounded-xl px-3.5 text-[14px] font-semibold ${branch === x.id ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                {x.name} · {x.code}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel label="Role" required />
          <RolePick value={role} onChange={setRole} blockedBy={currentManager} />
          <FieldErr msg={e('role')} />
        </div>
        <label className="block">
          <FieldLabel label="Start date" required />
          <input type="date" value={start} onChange={(x) => setStart(x.target.value)} className={inputCls(e('start'))} />
          <FieldErr msg={e('start')} />
        </label>
        <div>
          <FieldLabel label="Employment type" required />
          <Pills label="Employment type" value={employment} options={EMPLOYMENT_TYPES} onChange={setEmployment} />
        </div>
      </div>
    </Sheet>
  );
}

/** Opens the staff profile of the person with this name (as PR agent profiles open), from anywhere a staff member appears. */
export function StaffSheetByName({ name, onClose }: { name: string; onClose: () => void }) {
  const { staff } = useCompany();
  const m = staff.find((s) => s.name === name);
  return m ? <StaffProfileSheet member={m} onClose={onClose} /> : null;
}
/** Whether a name belongs to a staff record (the Company Admin is not one). */
export function useIsStaff() {
  const { staff } = useCompany();
  return (name?: string | null) => !!name && staff.some((s) => s.name === name);
}
