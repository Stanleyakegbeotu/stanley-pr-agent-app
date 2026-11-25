/**
 * Settings sections (mobile, owner 2026-11-25): each section of the desktop
 * Settings Center as the body of a slide-up, writing to the same stores the
 * rest of the app reads (settingsStore, receiptProfile, org, config,
 * permissions, commission, staff), so nothing here is display only. Sections
 * that are whole pages on mobile (Staff, Audit log, Inventory) link there.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronRight, Download, Plus, ShieldCheck, Upload } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { THEMES } from '@company/app/themes';
import { COMPANY, getBranch } from '@company/data/company';
import { PAYMENT_METHODS, type Branch, type BranchStatus, type PaymentMethod } from '@company/data/types';
import { CATALOGUE_CATEGORIES, CATALOGUE_INVENTORY } from '@company/data/catalogueRules';
import { LEGACY_BRANCH_ID, buildHospitalDirectory } from '@company/data/legacy';
import { FRONT_DESK_ROLE, MANAGER_ROLE, type StaffRecord } from '@company/data/userRecords';
import { logAudit, useAuditLog } from '@company/services/audit';
import { branchPrefix, useBilling } from '@company/services/billing';
import { backupOverdue, recordBackup, updateConfig, useConfig } from '@company/services/config';
import { pct, rateSummary, useCommission } from '@company/services/commission';
import { branchPaymentMode, enabledMethods, setBranchPayments, setBranchStatus, statusHistory, useBranches } from '@company/services/org';
import { BRANCH_ROLES, PERMISSION_GROUPS, can, isDefault, resetRole, setPermission, usePermissions, type RoleName } from '@company/services/permissions';
import { updateBranchContact, updateReceiptProfile, useReceiptProfile } from '@company/services/receiptProfile';
import { readImage, updateBranchProfile, updateCompany, updateProfile, useBranchProfile, useCompanyProfile, useProfile, type CompanyProfile } from '@company/services/settingsStore';
import { resolveRange, summarize } from '@company/services/analytics';
import { useOrgFacts } from '@company/features/settings/admin/orgData';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import type { StickerKey } from '@/assets';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { Sheet } from './ui';
import { Facts, Panel } from './branchFirst';
import { FieldErr, FieldLabel, RateSheet, inputCls } from './prManage';
import { AddBranchSheet } from './addBranch';
import { AddStaffSheet } from './pages/Staff';
import { Approvals } from './pages/Finance';
import { photoOf } from './people';
import { LongText, RuleInput, ruleProblem, type RuleKind } from './fields';
import { emailProblem, nameProblem, phoneProblem } from '@/ui/fieldRules';
import { emailTaken, passwordRules, setPassword, setSignInEmail, strength, useSignIn } from './signin';

export type Go = (section: string) => void;

/* ─────────────── small shared pieces ─────────────── */

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="press flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line disabled:opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {hint && <span className="block text-[12px] leading-snug text-muted">{hint}</span>}
      </span>
      <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

function NotConnected({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-2xl bg-[#fff7ec] px-3 py-2.5 text-[12.5px] leading-snug text-[#9a4a07]">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function LinkRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press mt-2 flex w-full items-center gap-2 rounded-2xl bg-brand-50 px-3.5 py-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-brand-700">{label}</span>
        {sub && <span className="block text-[12px] text-brand-800/80">{sub}</span>}
      </span>
      <ChevronRight size={17} className="shrink-0 text-brand-600" />
    </button>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-[13.5px] leading-snug text-ink-2">
          <Check size={15} className="mt-0.5 shrink-0 text-good" /> {t}
        </li>
      ))}
    </ul>
  );
}

const dateTime = (iso: string | Date) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const HEALTH_TONE: Record<string, string> = { ok: 'bg-tint-green text-good-ink', attention: 'bg-[#fff1e0] text-[#b45309]', incomplete: 'bg-brand-50 text-brand-700', disabled: 'bg-page text-muted' };

/* ─────────────── Overview ─────────────── */

export function OverviewSection({ go }: { go: Go }) {
  const f = useOrgFacts();
  const todo: { text: string; section: string }[] = [
    ...(f.pendingApprovals ? [{ text: `${f.pendingApprovals} expense${f.pendingApprovals === 1 ? '' : 's'} waiting for approval`, section: 'approvals' }] : []),
    ...f.perBranch.filter((b) => !b.manager && b.branch.status !== 'Inactive').map((b) => ({ text: `${b.branch.name} has no branch manager`, section: 'managers' })),
    ...f.paymentsOff.map((n) => ({ text: `${n} has no payment method switched on`, section: 'billing' })),
    ...(f.companyGaps.length ? [{ text: `Company details missing: ${f.companyGaps.join(', ')}`, section: 'company' }] : []),
    ...(f.backupOverdue ? [{ text: f.lastBackup ? 'Backup is overdue' : 'No backup made yet', section: 'data' }] : []),
    ...f.perBranch.filter((b) => b.gaps.length && b.branch.status !== 'Inactive').map((b) => ({ text: `${b.branch.name}: ${b.gaps.join(', ')}`, section: 'branches' })),
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {[
          { l: 'Active branches', v: formatCount(f.active), s: `${formatCount(f.pendingSetup)} in setup · ${formatCount(f.inactive)} off`, go: 'branches' },
          { l: 'Branch managers', v: formatCount(f.managers.length), s: `${formatCount(f.perBranch.filter((b) => !b.manager).length)} branches without one`, go: 'managers' },
          { l: 'Active staff', v: formatCount(f.activeStaff), s: 'Across every branch', go: 'staff' },
          { l: 'Waiting for approval', v: formatCount(f.pendingApprovals), s: 'Expenses', go: 'approvals' },
          { l: 'Waiting to sync', v: formatCount(f.queued), s: 'Until the cloud is connected', go: 'integrations' },
          { l: 'Last backup', v: f.lastBackup ? new Date(f.lastBackup).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never', s: f.backupOverdue ? 'Overdue' : 'Up to date', go: 'data' },
        ].map((x) => (
          <button key={x.l} type="button" onClick={() => go(x.go)} className="press min-w-0 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70">
            <span className="block truncate text-[11.5px] text-muted">{x.l}</span>
            <b className="block truncate text-[19px] text-ink">{x.v}</b>
            <span className="block truncate text-[11px] text-muted">{x.s}</span>
          </button>
        ))}
      </div>
      <Panel title={todo.length ? `Needs attention · ${todo.length}` : 'All in order'} note={todo.length ? 'Tap one to fix it.' : 'Nothing needs your attention right now.'}>
        {todo.length ? (
          <ul className="space-y-1.5">
            {todo.map((t) => (
              <li key={t.text}>
                <button type="button" onClick={() => go(t.section)} className="press flex w-full items-center gap-2.5 rounded-2xl bg-[#fff7ec] px-3 py-2.5 text-left text-[13.5px] text-[#7a3d06]">
                  <AlertTriangle size={16} className="shrink-0 text-[#d97706]" />
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <ChevronRight size={15} className="shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-tint-green p-3">
            <Sticker name="check" size={36} />
            <p className="text-[13.5px] font-medium text-good-ink">Every branch is set up and nothing is waiting.</p>
          </div>
        )}
      </Panel>
      <Panel title="Branches at a glance">
        <ul className="space-y-2">
          {f.perBranch.map((b) => (
            <li key={b.branch.id} className="flex items-center gap-3 rounded-2xl bg-page px-3 py-2.5">
              <Sticker name="hospital" size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{b.branch.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  {b.manager ? b.manager.name : 'No manager'} · {formatCount(b.activeStaff)} active staff · {formatCount(b.paymentMethods)} payment methods
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH_TONE[b.health.tone]}`}>{b.health.label}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

/* ─────────────── My profile ─────────────── */

export function ProfileSection() {
  const { user } = useCompany();
  const { showToast } = useNav();
  const p = useProfile(user.key);
  const [name, setName] = useState(p.name ?? user.name);
  const [email, setEmail] = useState(p.email ?? (user.email && !/not on record/i.test(user.email) ? user.email : ''));
  const [phone, setPhone] = useState(p.phone ?? user.phone ?? '');
  const [address, setAddress] = useState(p.address ?? user.address ?? '');
  const [tried, setTried] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const photo = p.photo === undefined ? user.photo : p.photo || undefined;
  const errs = { name: nameProblem(name), email: emailProblem(email), phone: phoneProblem(phone) };
  return (
    <>
      <div className="mb-4 flex items-center gap-4 rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff] p-4">
        <button type="button" onClick={() => file.current?.click()} className="press relative shrink-0" aria-label="Change photo">
          <span className="block rounded-full ring-[3px] ring-white">{photo ? <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" /> : <InitialsAvatar name={name || user.name} size={64} />}</span>
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white ring-2 ring-white">
            <Upload size={13} />
          </span>
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              updateProfile(user.key, { photo: await readImage(f, 320) });
              showToast('Photo saved');
            } catch (err) {
              showToast((err as Error).message);
            }
          }}
        />
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-bold text-ink">{name || user.name}</span>
          <span className="block text-[12.5px] text-ink-2">{user.role} · managed by the company (owner account)</span>
          {photo && (
            <button type="button" onClick={() => (updateProfile(user.key, { photo: '' }), showToast('Photo removed'))} className="mt-1 text-[12.5px] font-semibold text-[#b42318]">
              Remove photo
            </button>
          )}
        </span>
      </div>
      <div className="space-y-3.5 px-1">
        <RuleInput kind="name" label="Full name" required value={name} onChange={setName} showError={tried} />
        <RuleInput kind="email" label="Email address" value={email} onChange={setEmail} showError={tried} />
        <RuleInput kind="phone" label="Phone number" value={phone} onChange={setPhone} showError={tried} />
        <LongText label="Address" optional value={address} onChange={setAddress} max={240} minRows={2} placeholder={"House number and street\nArea, city"} hint="Press Enter for a new line." />
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (errs.name || errs.email || errs.phone) return;
            updateProfile(user.key, { name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim() });
            showToast('Profile saved');
          }}
          className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          Save profile
        </button>
      </div>
    </>
  );
}

/* ─────────────── Company settings ─────────────── */

const COMPANY_FIELDS: { k: keyof CompanyProfile; label: string; optional?: boolean; type?: string; rule?: RuleKind }[] = [
  { k: 'name', label: 'Company name' },
  { k: 'shortName', label: 'Short name' },
  { k: 'registeredName', label: 'Registered name', optional: true },
  { k: 'rcNumber', label: 'CAC (RC) number', optional: true },
  { k: 'owner', label: 'Owner', optional: true, rule: 'name' },
  { k: 'contactPerson', label: 'Contact person', optional: true, rule: 'name' },
  { k: 'phone', label: 'Company phone', rule: 'phone' },
  { k: 'website', label: 'Website', optional: true, rule: 'website' },
  { k: 'address', label: 'Registered address' },
  { k: 'city', label: 'City', optional: true },
  { k: 'state', label: 'State', optional: true },
  { k: 'country', label: 'Country', optional: true },
  { k: 'postalCode', label: 'Postal code', optional: true },
  { k: 'description', label: 'About the company', optional: true },
];

export function CompanySection() {
  const saved = useCompanyProfile();
  const receipt = useReceiptProfile();
  const { user } = useCompany();
  const { showToast } = useNav();
  const [form, setForm] = useState<CompanyProfile>(saved);
  const [rec, setRec] = useState({ motto: receipt.motto, email: receipt.email, thankYou: receipt.thankYou });
  const logo = useRef<HTMLInputElement>(null);
  const changed = (Object.keys(form) as (keyof CompanyProfile)[]).filter((k) => form[k] !== saved[k]);
  const recChanged = (Object.keys(rec) as (keyof typeof rec)[]).filter((k) => rec[k] !== receipt[k]);
  const [tried, setTried] = useState(false);
  const emailErr = emailProblem(rec.email);
  const ruleErrs = COMPANY_FIELDS.filter((x) => x.rule).map((x) => ruleProblem(x.rule!, form[x.k], false)).filter(Boolean);
  const save = () => {
    setTried(true);
    if (emailErr || !form.name.trim() || ruleErrs.length) return;
    if (changed.length) updateCompany(form);
    if (recChanged.length) updateReceiptProfile(rec);
    logAudit({ category: 'Settings', action: 'Company settings changed', record: form.name, details: `Changed: ${[...changed, ...recChanged].join(', ')}`, branchId: null });
    showToast('Company settings saved');
    void user;
  };
  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-[22px] bg-white p-3.5 ring-1 ring-line/70">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-page ring-1 ring-line">{form.logo ? <img src={form.logo} alt="" className="h-full w-full object-contain" /> : <Sticker name="hospital" size={42} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">Company logo</span>
          <span className="block text-[12px] text-muted">Shown across the app and on receipts. A square logo works best.</span>
          <span className="mt-1 flex gap-3">
            <button type="button" onClick={() => logo.current?.click()} className="text-[13px] font-semibold text-brand-600">
              {form.logo ? 'Change' : 'Upload'}
            </button>
            {form.logo && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, logo: '' }))} className="text-[13px] font-semibold text-[#b42318]">
                Remove
              </button>
            )}
          </span>
        </span>
        <input
          ref={logo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const url = await readImage(f, 512);
              setForm((x) => ({ ...x, logo: url }));
            } catch (err) {
              showToast((err as Error).message);
            }
          }}
        />
      </div>
      <Panel title="Company information" note="Printed on every receipt, quote and report, and shown across the app.">
        <div className="space-y-3">
          {COMPANY_FIELDS.map((f) => (
            <label key={f.k} className="block">
              <FieldLabel label={f.label} optional={f.optional} />
              {f.k === 'description' || f.k === 'address' ? (
                <LongText
                  value={form[f.k]}
                  onChange={(v) => setForm((x) => ({ ...x, [f.k]: v }))}
                  max={f.k === 'address' ? 240 : 600}
                  minRows={f.k === 'address' ? 3 : 4}
                  placeholder={f.k === 'address' ? 'Plot, street and area\nCity, state' : 'What the company does, in a few sentences.'}
                  hint={f.k === 'address' ? 'The registered office address, printed on documents. Press Enter for a new line.' : 'Shown on the company profile.'}
                />
              ) : (
                f.rule ? (
                  <RuleInput kind={f.rule} value={form[f.k]} onChange={(v) => setForm((x) => ({ ...x, [f.k]: v }))} showError={tried} />
                ) : (
                  <input value={form[f.k]} type={f.type ?? 'text'} onChange={(e) => setForm((x) => ({ ...x, [f.k]: e.target.value }))} className={inputCls(f.k === 'name' && !form.name.trim() ? 'x' : null)} />
                )
              )}
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Receipts and documents" note="What every patient receipt prints. Each branch's address and phone come from Branch management.">
        <div className="space-y-3">
          <RuleInput kind="email" label="Company email (printed)" value={rec.email} onChange={(v) => setRec((x) => ({ ...x, email: v }))} showError={tried} />
          <label className="block">
            <FieldLabel label="Motto" optional />
            <input value={rec.motto} onChange={(e) => setRec((x) => ({ ...x, motto: e.target.value }))} className={inputCls()} />
          </label>
          <LongText label="Thank you line" optional value={rec.thankYou} onChange={(v) => setRec((x) => ({ ...x, thankYou: v }))} max={200} minRows={2} placeholder="For example: Thank you for choosing us. Get well soon." hint="Printed at the bottom of every receipt." />
        </div>
      </Panel>
      <div className="sticky bottom-0 mt-4 bg-white/90 pb-1 pt-2 backdrop-blur">
        <button type="button" disabled={!changed.length && !recChanged.length} onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
          Save company settings{changed.length + recChanged.length ? ` · ${changed.length + recChanged.length} change${changed.length + recChanged.length === 1 ? '' : 's'}` : ''}
        </button>
      </div>
    </>
  );
}

/* ─────────────── Branch management ─────────────── */

export function BranchesSection() {
  const f = useOrgFacts();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAdding(true)} className="press mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3 text-[14.5px] font-semibold text-white">
        <Plus size={18} /> Add a branch
      </button>
      <ul className="space-y-2.5">
        {f.perBranch.map((b) => (
          <li key={b.branch.id}>
            <button type="button" onClick={() => setOpen(b.branch.id)} className="press w-full rounded-[20px] bg-white p-3.5 text-left ring-1 ring-line/70">
              <span className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff]">
                  <Sticker name="hospital" size={32} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15.5px] font-bold text-ink">{b.branch.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH_TONE[b.health.tone]}`}>{b.health.label}</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {b.branch.code} · Patient IDs {branchPrefix(b.branch.id)} · {b.branch.city}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {b.manager ? b.manager.name : 'No manager'} · {formatCount(b.staff.length)} staff · {formatCount(b.paymentMethods)} payment methods
                  </span>
                  {b.gaps.length > 0 && <span className="mt-1 block text-[12px] font-medium text-[#b45309]">Missing: {b.gaps.join(', ')}</span>}
                </span>
                <ChevronRight size={16} className="mt-3 shrink-0 text-faint" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <BranchSettingsSheet branchId={open} onClose={() => setOpen(null)} />}
      {adding && <AddBranchSheet onClose={() => setAdding(false)} />}
    </>
  );
}

const STATUS_MOVES: Record<BranchStatus, { to: BranchStatus; label: string; danger?: boolean }[]> = {
  Active: [
    { to: 'Suspended', label: 'Suspend', danger: true },
    { to: 'Inactive', label: 'Deactivate', danger: true },
  ],
  'Pending setup': [{ to: 'Active', label: 'Activate' }],
  Suspended: [
    { to: 'Active', label: 'Reactivate' },
    { to: 'Inactive', label: 'Deactivate', danger: true },
  ],
  Inactive: [{ to: 'Active', label: 'Reactivate' }],
};

function BranchSettingsSheet({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  useBranches();
  const { user, navigate } = useCompany();
  const { showToast } = useNav();
  const b = getBranch(branchId) as Branch;
  const receipt = useReceiptProfile();
  const prof = useBranchProfile(branchId);
  const contact = receipt.branches[branchId] ?? { address: '', phone: '' };
  const [address, setAddress] = useState(contact.address);
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(prof.email);
  const [hours, setHours] = useState(prof.hours);
  const [move, setMove] = useState<BranchStatus | null>(null);
  const [reason, setReason] = useState('');
  const mode = branchPaymentMode(branchId);
  const methods = enabledMethods(branchId);
  const changed = address !== contact.address || phone !== contact.phone || email !== prof.email || hours !== prof.hours;
  const [triedContact, setTriedContact] = useState(false);
  const history = statusHistory(branchId);
  const toggleMethod = (m: PaymentMethod) => {
    const cur = Object.fromEntries(PAYMENT_METHODS.map((x) => [x, methods.includes(x)])) as Record<PaymentMethod, boolean>;
    cur[m] = !cur[m];
    if (!Object.values(cur).some(Boolean)) return showToast('Keep at least one payment method on');
    setBranchPayments(branchId, cur, user.name);
  };
  return (
    <Sheet back title={b.name} subtitle={`${b.code} · ${b.status}`} onClose={onClose} tall>
      <LinkRow label="Open the branch page" sub="Figures, team, PR agents and the front desk rota" onClick={() => navigate(`/branches/${branchId}`)} />
      <Panel title="Branch identity" note={branchId === LEGACY_BRANCH_ID ? "The Abuja branch's name and codes come from the legacy records and can't be changed." : 'The Patient ID code locks once IDs have been issued with it.'}>
        <Facts
          rows={[
            { label: 'Name', value: b.name },
            { label: 'Branch code', value: b.code },
            { label: 'Patient ID code', value: branchPrefix(branchId) },
            { label: 'Location', value: `${b.city}, ${b.country}` },
            { label: 'Currency', value: b.currency },
          ]}
        />
      </Panel>
      <Panel title="Contact and hours" note="Printed on this branch's receipts and quotes.">
        <div className="space-y-3">
          <LongText label="Address" value={address} onChange={setAddress} max={240} placeholder={"Street, building and area\nLandmark, city"} hint="Printed on this branch's receipts. Press Enter for a new line." />
          <RuleInput kind="phone" label="Phone" value={phone} onChange={setPhone} showError={triedContact} />
          <RuleInput kind="email" label="Branch email" optional value={email} onChange={setEmail} showError={triedContact} />
          <label className="block">
            <FieldLabel label="Opening hours" optional />
            <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="For example Mon to Sat, 7am to 8pm" className={inputCls()} />
          </label>
          <button
            type="button"
            disabled={!changed}
            onClick={() => {
              setTriedContact(true);
              if (phoneProblem(phone) || emailProblem(email)) return;
              updateBranchContact(branchId, { address: address.trim(), phone: phone.trim() });
              updateBranchProfile(branchId, { email: email.trim(), hours: hours.trim() });
              logAudit({ category: 'Settings', action: 'Branch contact changed', record: b.name, details: 'Address, phone, email or hours updated', branchId });
              showToast('Branch contact saved');
            }}
            className="press min-h-11 w-full rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white disabled:opacity-40"
          >
            Save contact
          </button>
        </div>
      </Panel>
      <Panel title="Payment methods at this branch" note={mode === 'inherit' ? 'Follows the company default. Change one below to give this branch its own set.' : 'This branch has its own set.'}>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <Toggle key={m} label={m} checked={methods.includes(m)} onChange={() => toggleMethod(m)} />
          ))}
        </div>
        {mode === 'custom' && (
          <button type="button" onClick={() => (setBranchPayments(branchId, null, user.name), showToast('Back to the company default'))} className="mt-2 text-[13px] font-semibold text-brand-600">
            Use the company default instead
          </button>
        )}
      </Panel>
      <Panel title="Branch status" note="Only the Company Admin can change a branch's status. Every change needs a reason and is recorded.">
        <p className="mb-2 text-[13.5px] text-ink-2">
          Now: <b className="text-ink">{b.status}</b>
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_MOVES[b.status].map((o) => (
            <button key={o.to} type="button" onClick={() => (setMove(o.to), setReason(''))} className={`press min-h-10 rounded-xl px-4 text-[13.5px] font-semibold ${o.danger ? 'bg-[#fdecec] text-[#b42318]' : 'bg-brand-600 text-white'}`}>
              {o.label}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {history.map((h, i) => (
              <li key={i} className="rounded-2xl bg-page px-3 py-2 text-[12.5px] text-ink-2">
                <b className="text-ink">
                  {h.from} to {h.to}
                </b>{' '}
                · {h.by} · {dateTime(h.at)}
                {h.reason && <span className="block text-muted">“{h.reason}”</span>}
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {move && (
        <Sheet
          back
          title={`${STATUS_MOVES[b.status].find((o) => o.to === move)?.label} ${b.name}?`}
          subtitle={`Status becomes ${move}`}
          onClose={() => setMove(null)}
          footer={
            <button
              type="button"
              disabled={reason.trim().length < 3}
              onClick={() => {
                setBranchStatus(branchId, move, reason.trim(), user.name);
                showToast(`${b.name} is now ${move}`);
                setMove(null);
              }}
              className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Confirm
            </button>
          }
        >
          <div className="px-1 pb-2">
            <LongText label="Reason" required value={reason} onChange={setReason} max={300} minRows={3} placeholder="For example: renovation of the scan room until the end of the month." hint="Recorded in the status history and the Audit Log." />
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

/* ─────────────── Branch monitoring ─────────────── */

export function MonitoringSection() {
  const f = useOrgFacts();
  const today = resolveRange({ key: 'today' });
  const month = resolveRange({ key: 'month' });
  const rows = f.perBranch.map((b) => {
    const live = b.branch.status === 'Active';
    const t = live ? summarize([b.branch.id], today) : null;
    const m = live ? summarize([b.branch.id], month) : null;
    return { b, t, m, c: b.branch.currency };
  });
  const max = Math.max(1, ...rows.map((r) => r.m?.revenue[r.c] ?? 0));
  return (
    <ul className="space-y-2.5">
      {rows.map(({ b, t, m, c }) => (
        <li key={b.branch.id} className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[15.5px] font-bold text-ink">{b.branch.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH_TONE[b.health.tone]}`}>{b.health.label}</span>
          </span>
          {t && m ? (
            <>
              <span className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { l: 'Billed today', v: formatMoney(t.revenue[c] ?? 0, c, true) },
                  { l: 'Patients today', v: formatCount(t.patients) },
                  { l: 'Billed this month', v: formatMoney(m.revenue[c] ?? 0, c, true) },
                ].map((x) => (
                  <span key={x.l} className="min-w-0 rounded-2xl bg-page px-2.5 py-2">
                    <span className="block truncate text-[11px] text-muted">{x.l}</span>
                    <b className="block truncate text-[14px] text-ink">{x.v}</b>
                  </span>
                ))}
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#eef2f8]">
                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${((m.revenue[c] ?? 0) / max) * 100}%` }} />
              </span>
              <span className="mt-2 block text-[12px] text-muted">
                {formatCount(b.activeStaff)} active staff · {formatCount(b.billsToday)} bills made in STANLEY today · {formatCount(b.queued)} waiting to sync
                {b.lastActivity ? ` · last change ${dateTime(b.lastActivity.at)}` : ''}
              </span>
            </>
          ) : (
            <span className="mt-1 block text-[12.5px] text-muted">Not trading ({b.branch.status}).</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ─────────────── Branch managers ─────────────── */

export function ManagersSection() {
  const f = useOrgFacts();
  const { staff, editStaff } = useCompany();
  const { showToast } = useNav();
  const [pick, setPick] = useState<{ branch: Branch; replacing?: StaffRecord } | null>(null);
  const [remove, setRemove] = useState<StaffRecord | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  return (
    <>
      <ul className="space-y-2.5">
        {f.perBranch.map(({ branch, manager }) => (
          <li key={branch.id} className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
            <p className="text-[12.5px] font-semibold text-muted">
              {branch.name} · {branch.code}
            </p>
            {manager ? (
              <div className="mt-2 flex items-center gap-3">
                {photoOf(manager) ? <img src={photoOf(manager)} alt="" className="h-11 w-11 rounded-full object-cover" /> : <InitialsAvatar name={manager.name} size={44} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{manager.name}</span>
                  <span className="block text-[12px] text-muted">
                    Branch manager · {manager.status} · {manager.id}
                  </span>
                </span>
              </div>
            ) : (
              <p className="mt-2 rounded-2xl bg-[#fff7ec] px-3 py-2 text-[13px] text-[#9a4a07]">No manager. The branch has no head until you assign one.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPick({ branch, replacing: manager })} className="press min-h-9 rounded-xl bg-brand-600 px-3.5 text-[13px] font-semibold text-white">
                {manager ? 'Replace' : 'Assign from staff'}
              </button>
              {!manager && (
                <button type="button" onClick={() => setAdding(branch.id)} className="press min-h-9 rounded-xl bg-page px-3.5 text-[13px] font-semibold text-ink-2 ring-1 ring-line">
                  Add a new manager
                </button>
              )}
              {manager && (
                <button type="button" onClick={() => (setRemove(manager), setReason(''))} className="press min-h-9 rounded-xl bg-[#fdecec] px-3.5 text-[13px] font-semibold text-[#b42318]">
                  Remove as manager
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {pick && (
        <Sheet back title={pick.replacing ? `Replace ${pick.replacing.name}` : `Manager for ${pick.branch.name}`} subtitle="Choose someone at this branch" onClose={() => setPick(null)} tall>
          {(() => {
            const options = staff.filter((s) => s.branchId === pick.branch.id && s.id !== pick.replacing?.id && s.status === 'Active');
            return options.length ? (
              <ul className="space-y-2 px-1 pb-2">
                {options.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (pick.replacing) editStaff(pick.replacing.id, { role: FRONT_DESK_ROLE }, `Replaced as manager by ${s.name}`);
                        editStaff(s.id, { role: MANAGER_ROLE }, `Made manager of ${pick.branch.name}`);
                        showToast(`${s.name} is now the manager of ${pick.branch.name}`);
                        setPick(null);
                      }}
                      className="press flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line"
                    >
                      {photoOf(s) ? <img src={photoOf(s)} alt="" className="h-10 w-10 rounded-full object-cover" /> : <InitialsAvatar name={s.name} size={40} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                        <span className="block text-[12px] text-muted">
                          {s.role} · {s.id}
                        </span>
                      </span>
                      <ChevronRight size={16} className="text-faint" />
                    </button>
                  </li>
                ))}
                {pick.replacing && <p className="px-1 text-[12px] text-muted">{pick.replacing.name} becomes Front Desk. Both changes are recorded in the Audit Log.</p>}
              </ul>
            ) : (
              <p className="px-2 py-6 text-center text-[13.5px] text-muted">No other active staff at {pick.branch.name}. Add a new manager instead.</p>
            );
          })()}
        </Sheet>
      )}
      {remove && (
        <Sheet
          back
          title={`Remove ${remove.name} as manager?`}
          subtitle="They stay on the team as Front Desk"
          onClose={() => setRemove(null)}
          footer={
            <button
              type="button"
              disabled={reason.trim().length < 3}
              onClick={() => {
                editStaff(remove.id, { role: FRONT_DESK_ROLE }, reason.trim());
                showToast(`${remove.name} is no longer the manager`);
                setRemove(null);
              }}
              className="press min-h-12 w-full rounded-2xl bg-[#d93036] text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Remove as manager
            </button>
          }
        >
          <div className="px-1 pb-2">
            <LongText label="Reason" required value={reason} onChange={setReason} max={300} minRows={3} placeholder="For example: moving to another branch from Monday." hint="Recorded on their staff record and in the Audit Log." />
          </div>
        </Sheet>
      )}
      {adding && <AddStaffSheet branchId={adding} presetRole={MANAGER_ROLE} onClose={() => setAdding(null)} />}
    </>
  );
}

/* ─────────────── Roles and permissions ─────────────── */

export function RolesSection() {
  usePermissions();
  const { user } = useCompany();
  const { showToast } = useNav();
  const [role, setRole] = useState<Exclude<RoleName, 'Company Admin'>>(BRANCH_ROLES[0]!);
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-page p-1">
        {BRANCH_ROLES.map((r) => (
          <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`press min-h-10 rounded-full text-[13.5px] font-semibold ${role === r ? 'bg-brand-600 text-white' : 'text-ink-2'}`}>
            {r}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[12.5px] text-muted">The Company Admin always has every permission. Changes apply straight away and are recorded in the Audit Log.</p>
      {PERMISSION_GROUPS.map((g) => (
        <div key={g.id} className="mb-4">
          <p className="mb-2 px-1 text-[13px] font-bold text-ink-2">{g.label}</p>
          <div className="space-y-2">
            {g.perms.map((p) => (
              <Toggle
                key={p.id}
                label={`${p.label}${p.sensitive ? ' · sensitive' : ''}${!p.adminOnly && !isDefault(role, p.id) && can(role, p.id) ? ' · changed' : ''}`}
                hint={p.adminOnly ? 'Company Admin only, by design.' : p.description}
                checked={!p.adminOnly && can(role, p.id)}
                disabled={p.adminOnly}
                onChange={(on) => {
                  setPermission(role, p.id, on, user.name);
                  showToast(`${p.label} ${on ? 'given to' : 'taken from'} ${role}`);
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => (resetRole(role, user.name), showToast(`${role} reset to the default permissions`))} className="press min-h-11 w-full rounded-2xl bg-page text-[14px] font-semibold text-ink-2 ring-1 ring-line">
        Reset {role} to the defaults
      </button>
    </>
  );
}

/* ─────────────── Approvals ─────────────── */

const who = (perm: string) => ['Company Admin', ...BRANCH_ROLES.filter((r) => can(r, perm))].join(', ');

export function ApprovalsSection({ go }: { go: Go }) {
  usePermissions();
  const cfg = useConfig();
  const audit = useAuditLog();
  const decisions = audit.filter((e) => e.category === 'Expenses' && /approved|rejected/i.test(e.action)).slice(0, 8);
  const flows: { name: string; approves: string; rule: string; built: boolean; section?: string }[] = [
    { name: 'Expenses', approves: who('expenses.approve'), rule: 'Either name who already approved it, or send it for approval. Rejections need a reason.', built: true, section: 'roles' },
    { name: 'Balances (part payment or unpaid)', approves: 'The person billing or the branch manager, named on the bill', rule: 'Reason, approver and an optional promised date are required.', built: true },
    { name: 'Discounts', approves: who('billing.discount'), rule: cfg.discounts.enabled ? `Up to ${cfg.discounts.maxPercent}% of the bill.` : 'Discounts are turned off.', built: true, section: 'billing' },
    { name: 'Price change on one bill', approves: who('billing.override'), rule: 'Never changes the catalogue price.', built: true, section: 'roles' },
    { name: 'Catalogue price changes', approves: who('services.edit'), rule: 'Applied directly and audited. A request and approve step is not built yet.', built: false, section: 'services' },
    { name: 'Branch configuration', approves: 'Company Admin only', rule: 'Create, activate, suspend. A reason is required.', built: true, section: 'branches' },
    { name: 'Deletions', approves: `Trash, permanent delete: ${who('trash.restore')}`, rule: 'Nothing is deleted outright; Trash keeps it 30 days.', built: true },
    { name: 'Commission changes', approves: who('referral.commission'), rule: 'Company rate and agents’ own rates, audited.', built: true, section: 'referral' },
    { name: 'Two step approvals', approves: 'Not available', rule: 'Manager then admin approvals are not built yet.', built: false },
  ];
  return (
    <>
      <Approvals title="Approval queue" />
      <Panel title="Approval rules" note="How each kind of change is approved today. Who may approve comes from Roles and permissions.">
        <ul className="space-y-2">
          {flows.map((w) => (
            <li key={w.name}>
              <button type="button" disabled={!w.section} onClick={() => w.section && go(w.section)} className="press w-full rounded-2xl bg-page px-3 py-2.5 text-left">
                <span className="flex items-center justify-between gap-2">
                  <b className="text-[13.5px] text-ink">{w.name}</b>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${w.built ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{w.built ? 'Active' : 'Not built yet'}</span>
                </span>
                <span className="block text-[12px] text-ink-2">Approves: {w.approves}</span>
                <span className="block text-[12px] text-muted">{w.rule}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      {decisions.length > 0 && (
        <Panel title="Recent expense decisions">
          <ul className="space-y-1.5">
            {decisions.map((e) => (
              <li key={e.id} className="rounded-2xl bg-page px-3 py-2 text-[12.5px]">
                <b className="text-ink">{e.action}</b> · {e.record}
                <span className="block text-muted">
                  {e.user} · {dateTime(e.at)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

/* ─────────────── Patient and registration ─────────────── */

export function PatientsSection() {
  const cfg = useConfig();
  const branches = useBranches();
  const billing = useBilling();
  const p = cfg.patient;
  return (
    <>
      <Panel title="Patient ID format" note="Issued automatically, one sequence per branch and patient type. Staff can't type or change an ID.">
        <ul className="space-y-2">
          {branches.map((b) => {
            const code = branchPrefix(b.id);
            const r = billing.sequences[`${code}-R`] ?? 0;
            const w = billing.sequences[`${code}-W`] ?? 0;
            return (
              <li key={b.id} className="rounded-2xl bg-page px-3 py-2.5">
                <span className="flex items-center justify-between">
                  <b className="text-[14px] text-ink">{b.name}</b>
                  <span className="font-mono text-[12.5px] text-ink-2">{code}</span>
                </span>
                <span className="mt-1 grid grid-cols-2 gap-2 text-[12px] text-muted">
                  <span>
                    Referred next <b className="font-mono text-ink">{`${code}-R${String(r + 1).padStart(6, '0')}`}</b>
                    <span className="block">{formatCount(r)} issued</span>
                  </span>
                  <span>
                    Walk in next <b className="font-mono text-ink">{`${code}-W${String(w + 1).padStart(6, '0')}`}</b>
                    <span className="block">{formatCount(w)} issued</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="Registration rules">
        <div className="space-y-2">
          <Toggle label="Phone number is required" hint="Billing won't continue without a patient phone number." checked={p.phoneRequired} onChange={(on) => updateConfig('patient', { phoneRequired: on }, `Phone number ${on ? 'required' : 'optional'}`)} />
        </div>
      </Panel>
      <Panel title="Duplicate patient warnings" note="Possible duplicates are shown to the person billing. Records are never merged automatically.">
        <div className="space-y-2">
          <Toggle label="Same name" checked={p.duplicateBy.name} onChange={(on) => updateConfig('patient', { duplicateBy: { ...p.duplicateBy, name: on } }, `Duplicate check by name ${on ? 'on' : 'off'}`)} />
          <Toggle label="Same phone number" checked={p.duplicateBy.phone} onChange={(on) => updateConfig('patient', { duplicateBy: { ...p.duplicateBy, phone: on } }, `Duplicate check by phone ${on ? 'on' : 'off'}`)} />
        </div>
      </Panel>
      <Panel title="Fixed rules" note="Built into STANLEY for safe records.">
        <Bullets items={['Patient IDs are never reused or edited.', 'Referred patients carry the PR agent who referred them; walk ins do not.', 'A patient record is never deleted; bills go to Trash first.']} />
      </Panel>
    </>
  );
}

/* ─────────────── Billing and payments ─────────────── */

export function BillingSection({ go }: { go: Go }) {
  usePermissions();
  const cfg = useConfig();
  const branches = useBranches();
  const { showToast } = useNav();
  const [max, setMax] = useState(String(cfg.discounts.maxPercent));
  const n = Number(max);
  const ok = Number.isFinite(n) && n > 0 && n <= 100;
  const setMethod = (m: PaymentMethod, on: boolean) => {
    const next = { ...cfg.payments.enabled, [m]: on };
    if (!Object.values(next).some(Boolean)) return showToast('Keep at least one payment method on');
    updateConfig('payments', { enabled: next }, `${m} ${on ? 'enabled' : 'disabled'}`);
  };
  return (
    <>
      <Panel title="Payment methods" note="The company default. Billing only offers enabled methods. A branch can have its own set.">
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <Toggle key={m} label={m} checked={cfg.payments.enabled[m]} onChange={(on) => setMethod(m, on)} />
          ))}
          <Toggle label="Split payments" hint="One bill paid with two methods, for example part cash and part transfer." checked={cfg.payments.split} onChange={(on) => updateConfig('payments', { split: on }, `Split payments ${on ? 'on' : 'off'}`)} />
        </div>
      </Panel>
      <Panel title="Branch payment methods" note="Inherited branches follow the company default; overridden branches use their own set." action="Change" onAction={() => go('branches')}>
        <ul className="space-y-1.5">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-2xl bg-page px-3 py-2 text-[13px]">
              <b className="text-ink">{b.name}</b>
              <span className="text-right text-muted">
                {enabledMethods(b.id).join(', ') || 'None'} · {branchPaymentMode(b.id) === 'inherit' ? 'company default' : 'own set'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Discounts" note={`Who can give discounts: ${who('billing.discount')}. Every discount needs a reason.`}>
        <Toggle label="Discounts allowed" checked={cfg.discounts.enabled} onChange={(on) => updateConfig('discounts', { enabled: on }, `Discounts ${on ? 'allowed' : 'turned off'}`)} />
        <div className="mt-2 flex items-end gap-2">
          <label className="block min-w-0 flex-1">
            <FieldLabel label="Largest discount (% of the bill)" />
            <input value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" disabled={!cfg.discounts.enabled} className={inputCls(ok ? null : 'x')} />
          </label>
          <button type="button" disabled={!ok || n === cfg.discounts.maxPercent || !cfg.discounts.enabled} onClick={() => (updateConfig('discounts', { maxPercent: n }, `Largest discount set to ${n}%`), showToast(`Largest discount set to ${n}%`))} className="press min-h-12 rounded-2xl bg-brand-600 px-4 text-[14px] font-semibold text-white disabled:opacity-40">
            Save
          </button>
        </div>
      </Panel>
      <Panel title="Numbering" note="Issued automatically and never reused.">
        <Bullets items={['Patient IDs: per branch and type (referred R, walk in W).', 'Bills and receipts: per branch, in order.', 'Expenses: EXP, branch code, then a number per branch.']} />
      </Panel>
    </>
  );
}

/* ─────────────── Referral and commission ─────────────── */

export function ReferralSection() {
  const { agents, navigate } = useCompany();
  const commission = useCommission();
  const [rate, setRate] = useState(false);
  const hospitals = useMemo(() => buildHospitalDirectory(agents).length, [agents]);
  return (
    <>
      <div className="relative overflow-hidden rounded-[22px] bg-linear-to-br from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7] p-4 text-white">
        <p className="text-[12.5px] text-white/85">Company commission rate</p>
        <p className="text-[32px] font-bold leading-tight">{pct(commission.rate)}</p>
        <p className="max-w-[70%] text-[12.5px] text-white/90">{rateSummary()}</p>
        <button type="button" onClick={() => setRate(true)} className="press relative z-10 mt-3 rounded-xl bg-white px-3.5 py-2 text-[13.5px] font-semibold text-violet">
          Change rate
        </button>
        <Sticker name="coin" size={86} className="absolute right-2 top-3" />
      </div>
      <Panel title="Referral network" action="Open PR Management" onAction={() => navigate('/pr')}>
        <Facts
          rows={[
            { label: 'PR agents', value: formatCount(agents.length) },
            { label: 'Partner hospitals', value: formatCount(hospitals) },
          ]}
        />
      </Panel>
      <Panel title="Rules">
        <Bullets items={['Commission is the full bill of each referred patient (all tests) times the agent’s rate.', 'An agent can have their own rate; others follow the company rate.', 'Commission and account details never show on the Referrer Portal.', 'Every rate change is recorded in the Audit Log.']} />
      </Panel>
      {rate && <RateSheet onClose={() => setRate(false)} />}
    </>
  );
}

/* ─────────────── Services and inventory ─────────────── */

export function ServicesSection() {
  usePermissions();
  const { navigate, inventory } = useCompany();
  const audit = useAuditLog();
  const recent = audit.filter((e) => e.category === 'Catalogue').slice(0, 6);
  return (
    <>
      <Panel title="Service catalogue" note="One company-wide catalogue and price list for every branch." action="Open Inventory" onAction={() => navigate('/inventory')}>
        <Facts
          rows={[
            { label: 'Categories', value: formatCount(CATALOGUE_CATEGORIES.length) },
            { label: 'Services', value: formatCount(CATALOGUE_INVENTORY.length + inventory.added.length) },
            { label: 'Edited in STANLEY', value: formatCount(Object.keys(inventory.edits).length) },
            { label: 'Added in STANLEY', value: formatCount(inventory.added.length) },
          ]}
        />
      </Panel>
      <Panel title="Who can change prices">
        <p className="text-[13.5px] text-ink-2">{who('services.edit')}</p>
      </Panel>
      {recent.length > 0 && (
        <Panel title="Recent catalogue changes">
          <ul className="space-y-1.5">
            {recent.map((e) => (
              <li key={e.id} className="rounded-2xl bg-page px-3 py-2 text-[12.5px]">
                <b className="text-ink">{e.action}</b> · {e.record}
                <span className="block text-muted">
                  {e.user} · {dateTime(e.at)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

/* ─────────────── Notifications ─────────────── */

const NOTE_LABEL: Record<string, { label: string; hint: string }> = {
  summary: { label: 'Daily summary', hint: 'Each branch’s day: billed, received and spent.' },
  bill: { label: 'New bills', hint: 'When a bill is saved.' },
  unpaid: { label: 'Unpaid bills', hint: 'Bills saved with nothing paid.' },
  overdue: { label: 'Overdue balances', hint: 'Balances past their promised date.' },
  payout: { label: 'Commission payout', hint: 'The monthly PR commission payout is ready.' },
  data: { label: 'Data and backup', hint: 'Backup reminders and records waiting to sync.' },
};

export function NotificationsSection() {
  const cfg = useConfig();
  return (
    <Panel title="In-app notifications" note="Choose which notifications appear in the bell. Switching one off hides it everywhere.">
      <div className="space-y-2">
        {Object.entries(cfg.notifications.kinds).map(([k, on]) => (
          <Toggle key={k} label={NOTE_LABEL[k]?.label ?? k} hint={NOTE_LABEL[k]?.hint} checked={on} onChange={(v) => updateConfig('notifications', { kinds: { ...cfg.notifications.kinds, [k]: v } }, `${NOTE_LABEL[k]?.label ?? k} notifications ${v ? 'on' : 'off'}`)} />
        ))}
      </div>
      <NotConnected>Email and SMS notifications need the cloud connection. Until then, notifications show in the app only.</NotConnected>
    </Panel>
  );
}

/* ─────────────── Security ─────────────── */

export function SecuritySection() {
  const audit = useAuditLog();
  const history = audit.filter((e) => /permission|role|status|manager/i.test(`${e.action} ${e.details}`)).slice(0, 10);
  return (
    <>
      <Panel title="Sign in and passwords" note="These arrive with sign in, which isn't connected yet.">
        <Bullets items={['Password rules, lockout after failed attempts, session timeout', 'Invitations for new managers and staff, password resets', 'Login history']} />
        <NotConnected>Until sign in exists, STANLEY runs on this device. Nothing here pretends to be enforced.</NotConnected>
      </Panel>
      <Panel title="Access control" note="Enforced in the app today.">
        <Bullets items={['Each role sees only the pages, buttons and reports its permissions allow.', 'Branches, company settings, roles, security, backups and net profit belong to the Company Admin only.', 'The Referrer Portal never shows money: no commission, bank or payout details.']} />
      </Panel>
      <Panel title="Security history" note="Permission, role, manager and branch status changes.">
        {history.length ? (
          <ul className="space-y-1.5">
            {history.map((e) => (
              <li key={e.id} className="rounded-2xl bg-page px-3 py-2 text-[12.5px]">
                <b className="text-ink">{e.action}</b> · {e.record}
                <span className="block text-muted">
                  {e.user} · {dateTime(e.at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No security related changes yet.</p>
        )}
      </Panel>
    </>
  );
}

/* ─────────────── Appearance ─────────────── */

export function AppearanceSection() {
  const { theme, setTheme } = useCompany();
  const { showToast } = useNav();
  return (
    <Panel title="Colour theme" note="The colour theme of the desktop app (sidebar, banners, tables and charts). This mobile app keeps its own light look.">
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => (
          <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => (setTheme(t.id), showToast(`${t.name} theme selected`))} className={`press overflow-hidden rounded-2xl text-left ring-2 ${theme === t.id ? 'ring-brand-600' : 'ring-transparent'}`}>
            <span className="flex h-14">
              <span className="w-1/3" style={{ background: t.sidebar }} />
              <span className="flex-1" style={{ background: t.accent }} />
            </span>
            <span className="flex items-center justify-between bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink">
              {t.name}
              {theme === t.id && <Check size={15} className="text-brand-600" />}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/* ─────────────── Desktop only ─────────────── */

export function DesktopOnly({ what, why }: { what: string; why: string }) {
  return (
    <div className="rounded-[22px] bg-page p-5 text-center">
      <Sticker name="sparkles" size={56} className="mx-auto" />
      <p className="mt-2 text-[16px] font-bold text-ink">{what} is on the desktop app</p>
      <p className="mt-1 text-[13px] leading-snug text-muted">{why}</p>
    </div>
  );
}

/* ─────────────── Data and backup ─────────────── */

const stanleyKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('stanley.'));
const sizeOf = (k: string) => (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export function DataSection() {
  const cfg = useConfig();
  const { user } = useCompany();
  const { showToast } = useNav();
  const file = useRef<HTMLInputElement>(null);
  const [tick, setTick] = useState(0);
  const [restore, setRestore] = useState<{ name: string; keys: Record<string, string> } | null>(null);
  const [err, setErr] = useState('');
  const keys = useMemo(() => stanleyKeys(), [tick, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = keys.reduce((s, k) => s + sizeOf(k), 0);
  const backup = () => {
    const data: Record<string, string> = {};
    for (const k of stanleyKeys()) data[k] = localStorage.getItem(k) ?? '';
    const payload = JSON.stringify({ app: 'STANLEY', format: 1, createdAt: new Date().toISOString(), company: COMPANY.name, by: user.name, keys: data }, null, 1);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stanley-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    recordBackup('backup', user.name, payload.length);
    setTick((t) => t + 1);
    showToast('Backup saved to this phone');
  };
  const read = async (f: File) => {
    setErr('');
    try {
      const parsed = JSON.parse(await f.text()) as { app?: string; keys?: Record<string, string> };
      if (parsed.app !== 'STANLEY' || !parsed.keys || typeof parsed.keys !== 'object') throw new Error("This isn't a STANLEY backup file.");
      const entries = Object.entries(parsed.keys).filter(([k, v]) => k.startsWith('stanley.') && typeof v === 'string');
      if (!entries.length) throw new Error('The backup file is empty.');
      setRestore({ name: f.name, keys: Object.fromEntries(entries) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The file couldn't be read.");
    }
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] text-muted">Storage used</p>
          <b className="text-[19px] text-ink">{kb(total)}</b>
          <p className="text-[11px] text-muted">{formatCount(keys.length)} saved items</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] text-muted">Last backup</p>
          <b className={`text-[19px] ${backupOverdue(cfg) ? 'text-[#b42318]' : 'text-ink'}`}>{cfg.backup.lastAt ? new Date(cfg.backup.lastAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}</b>
          <p className="text-[11px] text-muted">{backupOverdue(cfg) ? 'Overdue, back up now' : `Next due within ${cfg.backup.everyDays} days`}</p>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-muted">STANLEY works offline: everything is saved on this device until the cloud database is connected. A backup is one file you can keep safe and restore later.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={backup} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white">
          <Download size={17} /> Back up now
        </button>
        <button type="button" onClick={() => file.current?.click()} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-page text-[14.5px] font-semibold text-ink-2 ring-1 ring-line">
          <Upload size={17} /> Restore
        </button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (e.target.files?.[0] && read(e.target.files[0]), (e.target.value = ''))} />
      <FieldErr msg={err} />
      {cfg.backup.history.length > 0 && (
        <Panel title="Backup history">
          <ul className="space-y-1.5">
            {cfg.backup.history.slice(0, 8).map((h, i) => (
              <li key={i} className="flex justify-between rounded-2xl bg-page px-3 py-2 text-[12.5px]">
                <span className="text-ink">
                  {h.kind === 'backup' ? 'Backup' : 'Restore'} · {h.by}
                </span>
                <span className="text-muted">
                  {dateTime(h.at)} · {kb(h.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {restore && (
        <Sheet
          back
          title="Restore this backup?"
          subtitle={restore.name}
          onClose={() => setRestore(null)}
          footer={
            <button
              type="button"
              onClick={() => {
                try {
                  for (const k of stanleyKeys()) localStorage.removeItem(k);
                  for (const [k, v] of Object.entries(restore.keys)) localStorage.setItem(k, v);
                  recordBackup('restore', user.name, JSON.stringify(restore.keys).length);
                } catch {
                  showToast("The backup couldn't be written. Device storage may be full");
                  return;
                }
                window.location.reload();
              }}
              className="press min-h-12 w-full rounded-2xl bg-[#d93036] text-[15px] font-semibold text-white"
            >
              Replace everything and restore
            </button>
          }
        >
          <p className="px-1 pb-2 text-[14px] leading-relaxed text-ink-2">Everything saved on this device is replaced by the backup ({formatCount(Object.keys(restore.keys).length)} items), then the app reloads. Make a backup first if you might need what is here now.</p>
        </Sheet>
      )}
    </>
  );
}

/* ─────────────── Integrations and system ─────────────── */

export function IntegrationsSection() {
  const f = useOrgFacts();
  const list: { name: string; sticker: StickerKey; text: string; on: boolean; note: string }[] = [
    { name: 'Cloud database and sync', sticker: 'rocket', text: "Keeps every branch's data together and backs it up automatically.", on: false, note: `${f.queued} record${f.queued === 1 ? '' : 's'} saved on this device, waiting to sync.` },
    { name: 'Referrer Portal (PR agents’ app)', sticker: 'stethoscope', text: 'Brings referrals from agents’ phones into billing.', on: false, note: 'Needs the cloud database.' },
    { name: 'Email', sticker: 'envelope', text: 'Invitations, password resets and emailed notifications.', on: false, note: 'Not connected; notifications show in the app only.' },
    { name: 'SMS', sticker: 'speech', text: 'Text messages to patients and staff.', on: false, note: 'Not connected.' },
    { name: 'Payment gateway or POS', sticker: 'coin', text: 'Card terminal or online payments posting straight into bills.', on: false, note: 'Not connected; payments are recorded by hand.' },
    { name: 'Reports: print, PDF and spreadsheet', sticker: 'chart', text: 'Every report prints, downloads as PDF or exports for accountants.', on: true, note: 'Built in, on the Reports page.' },
    { name: 'Backup files', sticker: 'clipboard', text: 'Back up and restore everything as one file.', on: true, note: 'Built in, Data and backup.' },
  ];
  return (
    <ul className="space-y-2">
      {list.map((x) => (
        <li key={x.name} className="flex items-start gap-3 rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
          <Sticker name={x.sticker} size={36} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <b className="text-[14px] text-ink">{x.name}</b>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${x.on ? 'bg-tint-green text-good-ink' : 'bg-page text-muted'}`}>{x.on ? 'Available' : 'Not connected'}</span>
            </span>
            <span className="block text-[12.5px] text-ink-2">{x.text}</span>
            <span className="block text-[12px] text-muted">{x.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SystemSection() {
  return (
    <>
      <Panel title="System configuration" note="Fixed for this version, the same at every branch.">
        <Facts
          rows={[
            { label: 'Currency', value: 'Nigerian naira (NGN)' },
            { label: 'Time zone', value: 'Africa/Lagos (WAT)' },
            { label: 'Date format', value: 'Day month year, for example 25 Nov 2026' },
            { label: 'Records start', value: '1 January 2026' },
            { label: 'Works offline', value: 'Yes, saved on this device' },
          ]}
        />
      </Panel>
      <Panel title="About STANLEY">
        <Bullets items={['The service catalogue, prices and PR agents come from the legacy records, which are never modified.', 'Daily activity is demonstration data built from that catalogue and network; it reconciles line by line.', 'The mobile admin uses the desktop app’s own logic, rules and figures.']} />
      </Panel>
    </>
  );
}

/* ─────────────── Sign-in and password (set by the person themselves) ─────────────── */

function Secret({ label, value, onChange, show, onShow, autoComplete }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onShow: () => void; autoComplete: string }) {
  return (
    <label className="block">
      <FieldLabel label={label} />
      <span className="relative block">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${inputCls()} pr-20`} />
        <button type="button" onClick={onShow} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-brand-600">
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}

export function SignInSection() {
  const { user } = useCompany();
  const { showToast } = useNav();
  const me = useSignIn(user.key);
  const who = { name: user.name, role: user.role };
  const startEmail = me?.email || (user.email && !emailProblem(user.email) ? user.email : '');
  const [email, setEmail] = useState(startEmail);
  const [triedEmail, setTriedEmail] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const emailErr = emailProblem(email, true) ?? (emailTaken(email, user.key) ? 'Someone else already signs in with this email.' : null);
  const rules = passwordRules(next);
  const st = strength(next);
  const ready = rules.every((r) => r.ok) && next === again && (!me?.hash || current.length > 0);
  const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#cfe2ff] p-4">
        <Sticker name="check" size={44} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink">{me?.hash && me.email ? 'Your sign-in is set up' : 'Set up how you sign in'}</p>
          <p className="text-[12.5px] leading-snug text-ink-2">Only you can set or change your password. Nobody else, not even the Company Admin or a manager, can see it.</p>
        </div>
      </div>

      <Panel title="Sign-in email" note={me?.emailSetAt ? `Set on ${when(me.emailSetAt)}` : 'The email you will type to sign in.'}>
        <RuleInput kind="email" label="Email" required value={email} onChange={setEmail} autoComplete="username" showError={triedEmail} error={triedEmail && emailTaken(email, user.key) ? 'Someone else already signs in with this email.' : null} />
        <button
          type="button"
          disabled={email.trim() === (me?.email ?? '') && !!me?.email}
          onClick={() => {
            setTriedEmail(true);
            if (emailErr) return;
            setSignInEmail(user.key, who, email);
            showToast('Sign-in email saved');
          }}
          className="press mt-3 min-h-11 w-full rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white disabled:opacity-40"
        >
          {me?.email ? 'Change sign-in email' : 'Save sign-in email'}
        </button>
      </Panel>

      <Panel title={me?.hash ? 'Change password' : 'Create a password'} note={me?.passwordSetAt ? `Last changed on ${when(me.passwordSetAt)}` : 'You will sign in with your email and this password.'}>
        <div className="space-y-3">
          {me?.hash && <Secret label="Current password" value={current} onChange={(v) => (setCurrent(v), setPwErr(null))} show={show} onShow={() => setShow((s) => !s)} autoComplete="current-password" />}
          <Secret label="New password" value={next} onChange={(v) => (setNext(v), setPwErr(null))} show={show} onShow={() => setShow((s) => !s)} autoComplete="new-password" />
          {next && (
            <div className="drop-down">
              <span className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= st.score ? (st.score <= 1 ? 'bg-[#ef4444]' : st.score === 2 ? 'bg-[#f59e0b]' : 'bg-good') : 'bg-[#e3ebf7]'}`} />
                ))}
              </span>
              <p className="mt-1 text-[12px] font-semibold text-ink-2">{st.label}</p>
            </div>
          )}
          <ul className="grid grid-cols-2 gap-1.5">
            {rules.map((r) => (
              <li key={r.label} className={`flex items-center gap-1.5 text-[12.5px] ${r.ok ? 'text-good-ink' : 'text-muted'}`}>
                <Check size={14} className={r.ok ? '' : 'opacity-30'} /> {r.label}
              </li>
            ))}
          </ul>
          <Secret label="Type it again" value={again} onChange={(v) => (setAgain(v), setPwErr(null))} show={show} onShow={() => setShow((s) => !s)} autoComplete="new-password" />
          {again && again !== next && <FieldErr msg="The two passwords are not the same." />}
          <FieldErr msg={pwErr} />
          <button
            type="button"
            disabled={!ready || busy}
            onClick={async () => {
              setBusy(true);
              const err = await setPassword(user.key, who, next, current);
              setBusy(false);
              if (err) return setPwErr(err);
              setCurrent('');
              setNext('');
              setAgain('');
              showToast(me?.hash ? 'Password changed' : 'Password created');
            }}
            className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Saving' : me?.hash ? 'Change password' : 'Create password'}
          </button>
        </div>
      </Panel>

      <Panel title="Forgot your password?">
        <p className="text-[13px] leading-snug text-ink-2">When sign-in is connected, a reset link goes to your sign-in email{me?.email ? ` (${me.email})` : ''}, and you choose a new password yourself.</p>
        <NotConnected>Sign-in isn't connected yet, so STANLEY still opens without a password on this device. Your email and password are saved here (the password only as a scrambled code) and will be used when sign-in arrives.</NotConnected>
      </Panel>
    </>
  );
}

/** For the admin on someone's profile: whether they have set up their own sign-in (never the password). */
export function SignInStatus({ userKey }: { userKey: string }) {
  const s = useSignIn(userKey);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${s?.hash && s.email ? 'bg-tint-green text-good-ink' : 'bg-page text-muted'}`}>
      {s?.hash && s.email ? `Signs in with ${s.email}` : 'Sign-in not set up yet'}
    </span>
  );
}
