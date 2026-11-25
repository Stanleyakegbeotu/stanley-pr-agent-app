/**
 * Branches (mobile). Same content and rules as the desktop BranchesPage and
 * BranchWorkspace (features/company/pages.tsx, features/branch): company
 * totals, one card per branch, Add branch (services/org addBranch: unique
 * 3-letter Patient ID code, starts "Pending setup"), and a branch view with
 * figures, attention items, payments, top services, PR agents and staff.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, Building2, ChevronRight, Info, MapPin, Plus, ShieldAlert, Users, Wallet } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, BRANCHES, NOT_ON_RECORD, getBranch } from '@company/data/company';
import { addBranch, idCodeProblem, normCode, statusHistory, useBranches, type BranchInput } from '@company/services/org';
import { agentRanking, paymentMix, periodLabel, resolveBranchIds, resolveRange, serviceRanking, summarize } from '@company/services/analytics';
import { attentionItems, type Severity } from '@company/services/insights';
import { formatCount, formatMoney, moneyEntries } from '@company/shared/format';
import { AdminHeader, BarList, Card, Empty, Kpi, PALETTE, ScopeBar, SectionHead, ShareBar, Sheet } from '../ui';

export function BranchesPage({ sub }: { sub?: string }) {
  useBranches(); // re-render when a branch is added or changes status
  return sub ? <BranchView branchId={sub} /> : <BranchList />;
}

function BranchList() {
  const { period, staff } = useCompany();
  const [adding, setAdding] = useState(false);
  const range = resolveRange(period);
  const all = summarize(resolveBranchIds('all'), range);
  const pay = moneyEntries(all.payments);
  const assigned = staff.filter((s) => s.status !== 'Left').length;
  return (
    <>
      <AdminHeader title="Branches" scope={false} right={<AddButton onClick={() => setAdding(true)} />} />
      <PeriodOnly />
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi icon={<Building2 size={18} />} tone="bg-tint-blue text-brand-700" title="Active branches" value={formatCount(ACTIVE_BRANCHES.length)} note={`${BRANCHES.length - ACTIVE_BRANCHES.length} in setup`} />
        <Kpi icon={<Users size={18} />} tone="bg-tint-purple text-violet" title="Assigned staff" value={formatCount(assigned)} note="Across all branches" />
        <Kpi icon={<Users size={18} />} tone="bg-tint-green text-good-ink" title="Patient visits" value={formatCount(all.patients)} note={`${formatCount(all.newPatients)} new patients`} />
        <Kpi icon={<Wallet size={18} />} tone="bg-tint-orange text-orange" title="Payments received" value={pay.length ? formatMoney(pay[0]![1], pay[0]![0]) : formatMoney(0, 'NGN')} note={pay.length > 1 ? pay.slice(1).map(([c, v]) => `+ ${formatMoney(v, c)}`).join(' · ') : 'Kept per currency'} />
      </div>
      <SectionHead title="Your branches" note={periodLabel(period)} />
      <div className="space-y-3">
        {BRANCHES.map((b) => (
          <BranchCard key={b.id} branchId={b.id} />
        ))}
        <button type="button" onClick={() => setAdding(true)} className="press flex w-full items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-brand-300 bg-brand-50/50 p-4 text-left">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
            <Plus size={22} />
          </span>
          <span>
            <span className="block text-[15px] font-bold text-ink">Add another branch</span>
            <span className="block text-[12.5px] text-muted">A new location with its own Patient ID prefix and currency.</span>
          </span>
        </button>
      </div>
      {adding && <AddBranchSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function PeriodOnly() {
  // The branch list shows every branch; only the period applies (desktop: same).
  return (
    <div className="-mt-1">
      <ScopePeriod />
    </div>
  );
}
const ScopePeriod = () => <ScopeBar periodOnly />;

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Add branch" className="press grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
      <Plus size={20} />
    </button>
  );
}

function BranchCard({ branchId }: { branchId: string }) {
  const { period, navigate, staff } = useCompany();
  const b = getBranch(branchId)!;
  const active = b.status === 'Active';
  const range = resolveRange(period);
  const s = active ? summarize([b.id], range) : null;
  const c = b.currency;
  const billed = s?.revenue[c] ?? 0;
  const paid = s?.payments[c] ?? 0;
  const collected = billed > 0 ? Math.min(100, (paid / billed) * 100) : 0;
  const alerts = active ? attentionItems([b.id], range, false).length : 0;
  const team = staff.filter((x) => x.branchId === b.id && x.status !== 'Left').length;
  const hasAddress = b.address && b.address !== NOT_ON_RECORD;
  return (
    <button type="button" onClick={() => navigate(`/branches/${b.id}`)} className="press block w-full rounded-[22px] bg-white p-4 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
      <span className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Building2 size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold text-ink">{b.name}</span>
          <span className="flex items-center gap-1 text-[12.5px] text-muted">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{hasAddress ? `${b.address}, ${b.city}` : `${b.city}, ${b.country} · address not on record`}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${active ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{b.status}</span>
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-page text-ink-2" aria-label={`${alerts} item${alerts === 1 ? '' : 's'} need attention`}>
            <Bell size={16} />
            {alerts > 0 && <b className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#ef4444] px-1 text-[10px] text-white">{alerts}</b>}
          </span>
        </span>
      </span>

      <span className="mt-3 flex gap-2 text-[12px]">
        <span className="rounded-md bg-page px-2 py-1 text-ink-2">
          Code <b className="text-ink">{b.code}</b>
        </span>
        <span className="rounded-md bg-page px-2 py-1 text-ink-2">
          Patient IDs <b className="text-ink">{b.idCode ? `${b.idCode}-R` : 'Not set'}</b>
        </span>
        <span className="rounded-md bg-page px-2 py-1 text-ink-2">
          Referrals <b className="text-ink">{s ? formatCount(s.referrals) : '—'}</b>
        </span>
      </span>

      {s ? (
        <>
          <span className="mt-3 block rounded-2xl bg-tint-green/60 p-3">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-good-ink">Payments received</span>
              <span className="text-[17px] font-bold text-good-ink">{formatMoney(paid, c)}</span>
            </span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white">
              <span className="block h-full rounded-full bg-good" style={{ width: `${Math.max(billed > 0 ? 2 : 0, collected)}%` }} />
            </span>
            <span className="mt-1 block text-[11.5px] text-good-ink/80">{billed > 0 ? `${Math.round(collected)}% of ${formatMoney(billed, c)} billed` : 'Nothing billed in this period'}</span>
          </span>
          <span className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ['Visits', formatCount(s.patients)],
                ['New patients', formatCount(s.newPatients)],
                ['Revenue', formatMoney(billed, c, true)],
                ['Outstanding', formatMoney(s.outstanding[c] ?? 0, c, true)],
                ['Expenses', formatMoney(s.expenses[c] ?? 0, c, true)],
                ['Staff', formatCount(team)],
              ] as const
            ).map(([l, v]) => (
              <span key={l} className="min-w-0 rounded-xl bg-page px-2.5 py-2">
                <span className={`block truncate text-[14.5px] font-bold ${l === 'Outstanding' && (s.outstanding[c] ?? 0) > 0 ? 'text-[#b42318]' : 'text-ink'}`}>{v}</span>
                <span className="block truncate text-[11px] text-muted">{l}</span>
              </span>
            ))}
          </span>
        </>
      ) : (
        <span className="mt-3 block rounded-2xl bg-page p-3 text-[13px] text-muted">Setup in progress. Figures start once the branch is active.</span>
      )}
      <span className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
        <span>
          <span className="mr-1.5 rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">{c}</span>
          Manager: {b.manager || 'Not assigned yet'}
        </span>
        <span className="flex items-center font-semibold text-brand-600">
          Open <ChevronRight size={15} />
        </span>
      </span>
    </button>
  );
}

const SEVERITY: Record<Severity, { label: string; tone: string; icon: React.ReactNode }> = {
  urgent: { label: 'Urgent', tone: 'bg-[#fdecec] text-[#b42318]', icon: <ShieldAlert size={17} /> },
  attention: { label: 'Needs attention', tone: 'bg-[#fff1e0] text-[#b45309]', icon: <AlertTriangle size={17} /> },
  info: { label: 'For information', tone: 'bg-brand-50 text-brand-700', icon: <Info size={17} /> },
};

function BranchView({ branchId }: { branchId: string }) {
  const { period, navigate, staff } = useCompany();
  const b = getBranch(branchId);
  const range = resolveRange(period);
  const data = useMemo(() => {
    if (!b || b.status !== 'Active') return null;
    return {
      s: summarize([b.id], range),
      alerts: attentionItems([b.id], range, false),
      pay: paymentMix([b.id], range, b.currency),
      services: serviceRanking([b.id], range).filter((x) => x.count > 0).slice(0, 5),
      agents: agentRanking([b.id], range).slice(0, 5),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, range.from.getTime(), range.to.getTime()]);
  if (!b)
    return (
      <>
        <AdminHeader title="Branch" back scope={false} />
        <Empty title="Branch not found" />
      </>
    );
  const c = b.currency;
  const team = staff.filter((x) => x.branchId === b.id && x.status !== 'Left');
  const history = statusHistory(b.id);
  return (
    <>
      <AdminHeader title={`${b.name} branch`} back scope={false} />
      <ScopeBar periodOnly />
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Kpi icon={<Wallet size={18} />} tone="bg-tint-blue text-brand-700" title="Revenue" value={formatMoney(data.s.revenue[c] ?? 0, c)} />
            <Kpi icon={<Wallet size={18} />} tone="bg-tint-green text-good-ink" title="Payments" value={formatMoney(data.s.payments[c] ?? 0, c)} note={`${formatCount(data.s.transactions)} transactions`} />
            <Kpi icon={<Wallet size={18} />} tone="bg-[#fdecec] text-[#b42318]" title="Outstanding" value={formatMoney(data.s.outstanding[c] ?? 0, c)} note={`${formatCount(data.s.openBills)} open bills`} />
            <Kpi icon={<Wallet size={18} />} tone="bg-tint-orange text-orange" title="Expenses" value={formatMoney(data.s.expenses[c] ?? 0, c)} />
            <Kpi icon={<Users size={18} />} tone="bg-tint-purple text-violet" title="Patient visits" value={formatCount(data.s.patients)} note={`${formatCount(data.s.newPatients)} new`} />
            <Kpi icon={<Users size={18} />} tone="bg-tint-blue text-brand-700" title="PR commission" value={formatMoney(data.s.prCommission[c] ?? 0, c)} note={`${formatCount(data.s.referrals)} referrals`} />
          </div>

          <SectionHead title="Needs attention" note={data.alerts.length ? `${data.alerts.length} item${data.alerts.length === 1 ? '' : 's'}` : 'Nothing needs attention'} />
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <button key={a.id} type="button" onClick={() => navigate(a.route)} className="press flex w-full items-start gap-3 rounded-[18px] bg-white p-3.5 text-left ring-1 ring-line/70">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${SEVERITY[a.severity].tone}`}>{SEVERITY[a.severity].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold leading-snug text-ink">{a.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{a.detail}</span>
                    <span className="mt-1 block text-[12.5px] font-semibold text-brand-600">{a.action}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <SectionHead title="Payments by method" />
          <Card className="p-4">
            <ShareBar parts={data.pay.map((p, i) => ({ label: p.label, value: p.value, color: PALETTE[i]! }))} format={(v) => formatMoney(v, c)} />
          </Card>

          <SectionHead title="Top diagnostic services" />
          <Card className="overflow-hidden">{data.services.length ? <BarList color="bg-good" rows={data.services.map((x) => ({ key: String(x.id), label: x.name, sub: `${x.category} · ${formatMoney(x.revenue[c] ?? 0, c)}`, value: x.count, text: formatCount(x.count) }))} /> : <Empty title="No tests in this period" />}</Card>

          <SectionHead title="Top PR agents" action="PR Management" onAction={() => navigate('/pr')} />
          <Card className="overflow-hidden">{data.agents.length ? <BarList rows={data.agents.map((a) => ({ key: String(a.id), label: a.name, sub: `${a.hospitalKey || 'No hospital'} · commission ${formatMoney(a.commission[c] ?? 0, c)}`, value: a.referrals, text: `${formatCount(a.referrals)} ref.` }))} /> : <Empty title="No referrals in this period" />}</Card>
        </>
      ) : (
        <Card className="mt-2 p-4 text-[14px] text-muted">This branch is {b.status.toLowerCase()}. Figures start once it is active.</Card>
      )}

      <SectionHead title="Staff" note={`${team.length} assigned`} action="Staff Management" onAction={() => navigate('/staff')} />
      <Card className="divide-y divide-line">
        {team.length ? (
          team.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{p.name}</span>
                <span className="block text-[12.5px] text-muted">
                  {p.role} · {p.employment}
                </span>
              </span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${p.status === 'Active' ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{p.status}</span>
            </div>
          ))
        ) : (
          <Empty title="No staff assigned yet" />
        )}
      </Card>

      <SectionHead title="Branch details" />
      <Card className="divide-y divide-line">
        {(
          [
            ['Branch code', b.code],
            ['Patient ID prefix', b.idCode ? `${b.idCode}-R / ${b.idCode}-W` : 'Not set'],
            ['Currency', b.currency],
            ['Address', b.address || NOT_ON_RECORD],
            ['Phone', b.phone || NOT_ON_RECORD],
            ['Manager', b.manager || 'Not assigned yet'],
            ['Opened', b.openedOn || NOT_ON_RECORD],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="flex items-start justify-between gap-4 px-4 py-3 text-[14px]">
            <span className="shrink-0 text-muted">{l}</span>
            <span className="text-right font-medium text-ink">{v}</span>
          </div>
        ))}
      </Card>
      {history.length > 0 && (
        <>
          <SectionHead title="Status history" />
          <Card className="divide-y divide-line">
            {[...history].reverse().map((h, i) => (
              <div key={i} className="px-4 py-3 text-[13.5px]">
                <p className="font-semibold text-ink">
                  {h.from} → {h.to}
                </p>
                <p className="text-muted">
                  {h.reason} · {h.by} · {new Date(h.at).toLocaleDateString('en-GB')}
                </p>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

const EMPTY: BranchInput = { name: '', idCode: '', city: '', state: '', country: 'Nigeria', address: '', phone: '', email: '', contactPerson: '', openedOn: '', timezone: 'Africa/Lagos' };

function AddBranchSheet({ onClose }: { onClose: () => void }) {
  const { user, showToast, navigate } = useCompany();
  const [f, setF] = useState<BranchInput>(EMPTY);
  const [tried, setTried] = useState(false);
  const set = (k: keyof BranchInput, v: string) => setF((x) => ({ ...x, [k]: v }));
  const codeErr = idCodeProblem(f.idCode);
  const errs = { name: f.name.trim().length < 2 ? 'Enter the branch name.' : '', idCode: codeErr ?? '', city: f.city.trim().length < 2 ? 'Enter the city.' : '' };
  const ok = !errs.name && !errs.idCode && !errs.city;
  const field = (k: keyof BranchInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">{label}</span>
      <input value={f[k]} onChange={(e) => set(k, k === 'idCode' ? normCode(e.target.value).slice(0, 3) : e.target.value)} className="min-h-12 w-full rounded-2xl border-[1.5px] border-brand-500 bg-white px-4 text-[15px] text-ink outline-none ring-4 ring-brand-100 focus:border-brand-600 focus:ring-brand-200" {...props} />
      {tried && (errs as Record<string, string>)[k] && <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{(errs as Record<string, string>)[k]}</span>}
    </label>
  );
  return (
    <Sheet title="Add a branch" onClose={onClose} tall>
      <div className="px-2 pb-4">
        <p className="mb-4 text-[13.5px] text-muted">The branch starts as “Pending setup”. Patient IDs use its three-letter code (e.g. LAG-R000001).</p>
        {field('name', 'Branch name', { placeholder: 'e.g. Wuse II' })}
        {field('idCode', 'Patient ID code (3 letters)', { placeholder: 'e.g. LAG' })}
        {field('city', 'City')}
        {field('state', 'State')}
        {field('address', 'Street address')}
        {field('phone', 'Phone', { type: 'tel', inputMode: 'tel' })}
        {field('email', 'Email', { type: 'email' })}
        {field('contactPerson', 'Contact person')}
        {field('openedOn', 'Opening date', { type: 'date' })}
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (!ok) return;
            const b = addBranch(f, user.name);
            showToast(`${b.name} branch added (pending setup)`);
            onClose();
            navigate(`/branches/${b.id}`);
          }}
          className="press mt-2 min-h-12 w-full rounded-2xl bg-brand-600 text-[15.5px] font-semibold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)]"
        >
          Add branch
        </button>
      </div>
    </Sheet>
  );
}
