/**
 * Expenses (mobile staff workspace): the desktop ExpensesPage and ExpenseForm
 * on the same expense service. Record what was spent, how much, how it was
 * paid and who approved it (approval is never optional: name who approved it
 * or send it for approval). The Branch Manager (expenses.approve) approves or
 * rejects with a reason; other staff see their own requests waiting.
 * Period, status, category and search filters, totals, spend by category and
 * by approver, and every expense opens its record (receipt photo, approval,
 * history, edit, move to trash). Demo activity expenses are listed read only
 * so the totals match the dashboard and Finance.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { BadgeCheck, Camera, Check, ChevronRight, Hourglass, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { BRANCH_MANAGER_PLACEHOLDER, CURRENT_USER, getBranch } from '@company/data/company';
import { PAYMENT_METHODS, type PaymentMethod, type PeriodSelection } from '@company/data/types';
import { expenseLines, type ExpenseLine } from '@company/data/demo/dailyLines';
import { isoDate } from '@company/data/demo/generator';
import { resolveRange } from '@company/services/analytics';
import { can, usePermissions } from '@company/services/permissions';
import { readImage } from '@company/services/settingsStore';
import { CATEGORY_HINT, CATEGORY_ITEMS, LARGE_EXPENSE, OUTSOURCED, RECORD_CATEGORIES, approveExpense, expenseApprovers, expenseSyncQueue, recordExpense, retained, updateExpense, useExpenses, type ExpenseRecord, type ExpenseStatus, type Person } from '@company/services/expenses';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import type { StickerKey } from '@/assets';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { Sheet, periodText } from '@/admin/ui';
import { AdminTopBar, EmptyCard, PageGlow, StickyTools } from '@/admin/kit';
import { Chips, Facts, Panel, PageTitle, PeriodChip } from '@/admin/branchFirst';
import { CountUp, Donut, useSeen } from '@/admin/charts';
import { BarList } from '@/admin/ui';
import { LongText } from '@/admin/fields';
import { FieldErr, FieldLabel, TrashSheet, inputCls } from '@/admin/prManage';
import { RejectSheet } from '@/admin/pages/Finance';
import { StaffSheetByName, useIsStaff } from '@/admin/pages/Staff';
import { photoOf, useTeam } from '@/admin/people';
import { useStaffChrome } from '../chrome';

/* ─────────────── one row for both sources (as the desktop) ─────────────── */

interface XRow {
  id: string;
  at: Date;
  date: string;
  category: string;
  description: string;
  amount: number;
  method: string | null;
  paidTo: string;
  recordedBy: Person | null;
  approvedBy: Person | null;
  status: ExpenseStatus;
  source: 'stanley' | 'demo';
  rec?: ExpenseRecord;
  line?: ExpenseLine;
}

const fromRecord = (r: ExpenseRecord): XRow => {
  const made = new Date(r.recordedAt);
  const at = isoDate(made) === r.date ? made : new Date(`${r.date}T12:00:00`);
  return { id: r.id, at, date: r.date, category: r.category, description: r.description, amount: r.amount, method: r.method, paidTo: r.paidTo, recordedBy: r.recordedBy, approvedBy: r.approvedBy, status: r.status, source: 'stanley', rec: r };
};

const naira = (n: number, compact = false) => formatMoney(n, 'NGN', compact);
const dayText = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeText = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayKey = (d: Date) => isoDate(d);
const dayHead = (d: Date) => {
  const t = isoDate(new Date());
  const y = isoDate(new Date(Date.now() - 86_400_000));
  const k = isoDate(d);
  return k === t ? 'Today' : k === y ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};

const STICKER: Record<string, StickerKey> = {
  'Reagents & consumables': 'testTube',
  Salaries: 'moneyBag',
  Utilities: 'sparkles',
  'Equipment maintenance': 'microscope',
  Logistics: 'rocket',
  Administrative: 'clipboard',
  [OUTSOURCED]: 'hospital',
};
const TINT: Record<string, string> = {
  'Reagents & consumables': 'bg-[#e8f1ff]',
  Salaries: 'bg-[#e9f9ef]',
  Utilities: 'bg-[#fff5dc]',
  'Equipment maintenance': 'bg-[#f1ecff]',
  Logistics: 'bg-[#e6f7fb]',
  Administrative: 'bg-[#fff0e6]',
  [OUTSOURCED]: 'bg-[#ffeef3]',
};
const COLOR: Record<string, string> = {
  'Reagents & consumables': '#1f6fe8',
  Salaries: '#16a34a',
  Utilities: '#f59e0b',
  'Equipment maintenance': '#8b5cf6',
  Logistics: '#0ea5e9',
  Administrative: '#f97316',
  [OUTSOURCED]: '#ec4899',
};
const stickerOf = (c: string): StickerKey => STICKER[c] ?? 'clipboard';
const STATUS_LABEL: Record<ExpenseStatus, string> = { Approved: 'Approved', Pending: 'Awaiting approval', Rejected: 'Rejected' };
const STATUS_PILL: Record<ExpenseStatus, string> = { Approved: 'bg-[#e9f9ef] text-good-ink', Pending: 'bg-[#fff3dc] text-warn-ink', Rejected: 'bg-[#ffecec] text-[#b42318]' };
const METHOD_HINT: Record<PaymentMethod, string> = { Cash: 'From the till or petty cash', POS: 'Card payment', Transfer: 'Bank transfer' };

/** Settings, Roles and Permissions: "Approve or reject expenses" (same rules as the desktop). */
function useRights() {
  const { user } = useCompany();
  usePermissions();
  const canApprove = can(user.role, 'expenses.approve');
  const mine = (r: ExpenseRecord) => r.recordedBy.name === user.name;
  return {
    canApprove,
    canEdit: (r: ExpenseRecord) => r.status !== 'Approved' && (canApprove || mine(r)),
    canTrash: (r: ExpenseRecord) => canApprove || (mine(r) && r.status !== 'Approved'),
    me: { name: user.name, role: user.role } as Person,
  };
}

/* ─────────────── page ─────────────── */

export function ExpensesPage() {
  const { branchId } = useStaffChrome();
  const branch = getBranch(branchId)!;
  const all = useExpenses();
  const rights = useRights();
  const { expensePeople } = useTeam();
  const recorded = useMemo(() => all.filter((r) => r.branchId === branchId), [all, branchId]);
  const [period, setPeriod] = useState<PeriodSelection>({ key: 'month' });
  const range = useMemo(() => resolveRange(period), [period]);
  const [status, setStatus] = useState<'all' | ExpenseStatus>('all');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState<'all' | 'stanley' | 'demo'>('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ editing: ExpenseRecord | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const from = isoDate(range.from);
  const to = isoDate(range.to);

  const periodRows = useMemo(() => {
    const demo = expenseLines([branchId], range).map((l): XRow => {
      const p = expensePeople(l);
      return { id: l.id, at: l.at, date: isoDate(l.at), category: l.category, description: l.description, amount: l.amount, method: null, paidTo: '', recordedBy: p.recordedBy ? { name: p.recordedBy.name, role: p.recordedBy.role } : null, approvedBy: { name: p.approvedBy.name, role: p.approvedBy.role }, status: 'Approved', source: 'demo', line: l };
    });
    const mine = recorded.filter((r) => r.date >= from && r.date <= to).map(fromRecord);
    return [...mine, ...demo].sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [branchId, range, recorded, from, to, expensePeople]);

  const needle = q.trim().toLowerCase();
  const rows = periodRows.filter(
    (r) =>
      (category === 'all' || r.category === category) &&
      (status === 'all' || r.status === status) &&
      (source === 'all' || r.source === source) &&
      (!needle || `${r.id} ${r.description} ${r.category} ${r.paidTo} ${r.method ?? ''} ${r.recordedBy?.name ?? ''} ${r.approvedBy?.name ?? ''} ${r.rec?.reference ?? ''} ${r.rec?.notes ?? ''}`.toLowerCase().includes(needle)),
  );
  const approvedRows = rows.filter((r) => r.status === 'Approved');
  const spent = approvedRows.reduce((s, r) => s + r.amount, 0);
  const pendingAll = recorded.filter((r) => r.status === 'Pending').sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const pendingShown = rights.canApprove ? pendingAll : pendingAll.filter((r) => r.recordedBy.name === rights.me.name);
  const pendingAmount = pendingAll.reduce((s, r) => s + r.amount, 0);
  const largest = [...approvedRows].sort((a, b) => b.amount - a.amount)[0];
  const queued = expenseSyncQueue(recorded).length;
  const openRow = openId ? (periodRows.find((r) => r.id === openId) ?? (recorded.find((r) => r.id === openId) ? fromRecord(recorded.find((r) => r.id === openId)!) : null)) : null;
  const { ref: seenRef, seen } = useSeen<HTMLDivElement>();

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of approvedRows) m.set(r.category, (m.get(r.category) ?? 0) + r.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [approvedRows]);
  const byApprover = useMemo(() => {
    const m = new Map<string, { p: Person; total: number; n: number }>();
    for (const r of approvedRows) {
      if (!r.approvedBy) continue;
      const k = r.approvedBy.name;
      const x = m.get(k) ?? { p: r.approvedBy, total: 0, n: 0 };
      x.total += r.amount;
      x.n += 1;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [approvedRows]);

  const shown = rows.slice(0, limit);
  const groups: { key: string; at: Date; items: XRow[]; total: number }[] = [];
  for (const r of shown) {
    const k = dayKey(r.at);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) groups.push((g = { key: k, at: r.at, items: [], total: 0 }));
    g.items.push(r);
    if (r.status === 'Approved') g.total += r.amount;
  }
  const dirty = status !== 'all' || category !== 'all' || source !== 'all' || !!needle;

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Expenses" sub={`What the branch spends · ${branch.name} branch`} />

        {/* Hero: what was spent in the period, what is waiting. */}
        <section ref={seenRef} className="relative overflow-hidden rounded-[26px] bg-linear-to-br from-[#ff9a3c] via-[#f97316] to-[#e2551b] p-4 text-white shadow-[0_16px_34px_rgba(226,85,27,0.32)]">
          <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15" />
          <Sticker name="moneyBag" size={74} className="absolute right-3 top-3" />
          <p className="text-[13px] font-semibold text-white/85">Spent · {periodText(period)}</p>
          <p className="mt-1 text-[32px] font-extrabold leading-none tracking-[-0.02em]">
            <CountUp value={spent} format={(n) => naira(Math.round(n))} seen={seen} />
          </p>
          <p className="mt-1.5 text-[12.5px] text-white/85">
            {formatCount(approvedRows.length)} approved expense{approvedRows.length === 1 ? '' : 's'}
            {queued ? ` · ${formatCount(queued)} waiting to sync` : ''}
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <Glass label="Awaiting approval" value={`${formatCount(pendingAll.length)} · ${naira(pendingAmount, true)}`} />
            <Glass label="Recorded in STANLEY" value={formatCount(recorded.length)} />
          </div>
          <button type="button" onClick={() => setForm({ editing: null })} className="press mt-3.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-[#c2410c] shadow-[0_8px_18px_rgba(120,40,0,0.18)]">
            <Plus size={19} strokeWidth={2.6} /> Record an expense
          </button>
        </section>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PeriodChip value={period} onChange={(p) => (setPeriod(p), setLimit(30))} />
          <span className="text-[12px] text-muted">Every expense names who approved it</span>
        </div>

        {pendingShown.length > 0 && <Queue items={pendingShown} total={pendingAll.length} canApprove={rights.canApprove} me={rights.me} onOpen={setOpenId} />}

        {/* Figures */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Tile sticker="coin" tint="bg-[#e9f9ef]" label="Spent (approved)" value={naira(spent, true)} sub={`${formatCount(approvedRows.length)} expenses`} />
          <Tile sticker="watch" tint="bg-[#fff5dc]" label="Awaiting approval" value={formatCount(pendingAll.length)} sub={pendingAll.length ? `${naira(pendingAmount, true)} not counted yet` : 'Nothing waiting'} />
          <Tile sticker="chart" tint="bg-[#e8f1ff]" label="Average expense" value={approvedRows.length ? naira(Math.round(spent / approvedRows.length), true) : 'None yet'} sub={periodText(period)} />
          <Tile sticker="target" tint="bg-[#ffeef3]" label="Largest expense" value={largest ? naira(largest.amount, true) : 'None yet'} sub={largest ? largest.description : 'No approved expenses'} onClick={largest ? () => setOpenId(largest.id) : undefined} />
        </div>

        {byCat.length > 0 && (
          <Panel title="Where the money went" note="Approved spending by category. Tap a category to filter the list.">
            <Donut parts={byCat.map(([c, v]) => ({ label: c, value: v, color: COLOR[c] ?? '#64748b' }))} total={naira(spent, true)} label="spent" format={(n) => naira(n, true)} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {byCat.map(([c]) => (
                <button key={c} type="button" onClick={() => setCategory((x) => (x === c ? 'all' : c))} aria-pressed={category === c} className={`press flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold ${category === c ? 'bg-ink text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                  <Sticker name={stickerOf(c)} size={18} /> {c}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {byApprover.length > 0 && (
          <Panel title="Approved by" note="Who approved the spending in this period.">
            <BarList rows={byApprover.map((a) => ({ key: a.p.name, label: a.p.name, sub: `${a.p.role} · ${formatCount(a.n)} expense${a.n === 1 ? '' : 's'}`, value: a.total, text: naira(a.total, true) }))} color="bg-[#f97316]" />
          </Panel>
        )}

        {/* List */}
        <div className="mt-5 flex items-center gap-2">
          <h2 className="flex-1 text-[17px] font-bold text-ink">Every expense</h2>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setCategory('all');
                setSource('all');
                setQ('');
              }}
              className="press text-[13px] font-semibold text-brand-600"
            >
              Clear filters
            </button>
          )}
        </div>
        <StickyTools>
        <label className="mb-2.5 flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-400">
          <Search size={18} className="shrink-0 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Description, supplier, person, receipt no." aria-label="Search expenses" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="grid h-7 w-7 place-items-center rounded-full bg-page text-muted">
              <X size={14} />
            </button>
          )}
        </label>
          <Chips
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All', count: periodRows.length },
              { value: 'Approved', label: 'Approved', count: periodRows.filter((r) => r.status === 'Approved').length },
              { value: 'Pending', label: 'Awaiting', count: periodRows.filter((r) => r.status === 'Pending').length },
              { value: 'Rejected', label: 'Rejected', count: periodRows.filter((r) => r.status === 'Rejected').length },
            ]}
          />
        </StickyTools>
        <div className="mt-1">
          <Chips label="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...RECORD_CATEGORIES.map((c) => ({ value: c, label: c === OUTSOURCED ? 'Outsourced' : c }))]} />
          <Chips
            label="Source"
            value={source}
            onChange={setSource}
            options={[
              { value: 'all', label: 'All expenses' },
              { value: 'stanley', label: 'Recorded in STANLEY' },
              { value: 'demo', label: 'Demo activity' },
            ]}
          />
        </div>
        <p className="mb-2 text-[12.5px] text-muted">
          {formatCount(rows.length)} expense{rows.length === 1 ? '' : 's'} · {periodText(period)} · newest first
        </p>
        {rows.length === 0 ? (
          <EmptyCard sticker="clipboard" text={dirty ? 'Nothing matches these filters.' : 'No expenses in this period yet.'} />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <span className="text-[13px] font-bold text-ink-2">{dayHead(g.at)}</span>
                  <span className="text-[12.5px] text-muted">{naira(g.total)}</span>
                </div>
                <ul className="space-y-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <ExpenseItem r={r} onOpen={() => setOpenId(r.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {rows.length > limit && (
              <button type="button" onClick={() => setLimit((n) => n + 30)} className="press min-h-12 w-full rounded-2xl bg-white text-[14.5px] font-semibold text-brand-600 ring-1 ring-line">
                Show more ({formatCount(rows.length - limit)} left)
              </button>
            )}
          </div>
        )}
      </div>
      {openRow && <ExpenseSheet row={openRow} onClose={() => setOpenId(null)} onEdit={(r) => (setOpenId(null), setForm({ editing: r }))} />}
      {form && <ExpenseFormSheet branchId={branchId} editing={form.editing} onClose={() => setForm(null)} onSaved={(id) => setOpenId(id)} />}
    </div>
  );
}

function Glass({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/18 px-3 py-2 ring-1 ring-white/25 backdrop-blur-sm">
      <p className="text-[11.5px] font-semibold text-white/80">{label}</p>
      <p className="truncate text-[15px] font-bold">{value}</p>
    </div>
  );
}

function Tile({ sticker, tint, label, value, sub, onClick }: { sticker: StickerKey; tint: string; label: string; value: string; sub: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag {...(onClick ? { type: 'button' as const, onClick } : {})} className={`${onClick ? 'press ' : ''}rounded-[20px] bg-white p-3 text-left shadow-[0_6px_18px_rgba(30,74,160,0.06)] ring-1 ring-line/70`}>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
        <Sticker name={sticker} size={28} />
      </span>
      <p className="mt-2 text-[12px] font-semibold text-muted">{label}</p>
      <p className="truncate text-[18px] font-extrabold tracking-[-0.01em] text-ink">{value}</p>
      <p className="truncate text-[11.5px] text-muted">{sub}</p>
    </Tag>
  );
}

function ExpenseItem({ r, onOpen }: { r: XRow; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="press flex w-full items-start gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TINT[r.category] ?? 'bg-tint-orange'}`}>
        <Sticker name={stickerOf(r.category)} size={30} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{r.description}</span>
          <span className={`shrink-0 text-[14.5px] font-bold ${r.status === 'Rejected' ? 'text-muted line-through' : 'text-ink'}`}>{naira(r.amount)}</span>
        </span>
        <span className="block truncate text-[12.5px] text-muted">{[r.category, timeText(r.at), r.method, r.paidTo].filter(Boolean).join(' · ')}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span>
          {r.approvedBy && <span className="truncate text-[11.5px] text-muted">by {r.approvedBy.name}</span>}
          {r.source === 'stanley' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">STANLEY</span>}
          {r.rec?.receipt && <span className="rounded-full bg-page px-2 py-0.5 text-[11px] font-semibold text-ink-2">Receipt</span>}
        </span>
      </span>
      <ChevronRight size={16} className="mt-3 shrink-0 text-faint" />
    </button>
  );
}

/* ─────────────── awaiting approval ─────────────── */

function Queue({ items, total, canApprove, me, onOpen }: { items: ExpenseRecord[]; total: number; canApprove: boolean; me: Person; onOpen: (id: string) => void }) {
  const { showToast } = useNav();
  const [reject, setReject] = useState<ExpenseRecord | null>(null);
  return (
    <section className="mt-4 rounded-[22px] bg-linear-to-br from-[#fff7ec] to-[#ffeacc] p-4 ring-1 ring-[#ffe0b8]">
      <div className="mb-2 flex items-center gap-2">
        <Sticker name="bell" size={30} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold text-ink">{canApprove ? `Waiting for your approval · ${formatCount(items.length)}` : `Your requests waiting · ${formatCount(items.length)}`}</h2>
          <p className="text-[12px] text-muted">{canApprove ? 'Approve, or reject with a reason the requester will see.' : `The Branch Manager approves or rejects them${total > items.length ? ` (${formatCount(total)} waiting at the branch)` : ''}.`}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="rounded-[18px] bg-white ring-1 ring-[#ffe0b8]">
            <button type="button" onClick={() => onOpen(e.id)} className="press flex w-full items-start gap-3 p-3 text-left">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TINT[e.category] ?? 'bg-tint-orange'}`}>
                <Sticker name={stickerOf(e.category)} size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-[14.5px] font-semibold text-ink">{e.description}</span>
                  <b className="shrink-0 text-[14.5px] text-ink">{naira(e.amount)}</b>
                </span>
                <span className="block truncate text-[12.5px] text-muted">
                  {e.category} · {e.method} · {dayText(new Date(`${e.date}T00:00:00`))}
                </span>
                <span className="block text-[12px] text-muted">
                  Requested by <b className="font-semibold text-ink-2">{e.recordedBy.name === me.name ? 'you' : `${e.recordedBy.name}, ${e.recordedBy.role}`}</b>
                </span>
              </span>
              <ChevronRight size={16} className="mt-2.5 shrink-0 text-faint" />
            </button>
            {canApprove && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <button type="button" onClick={() => setReject(e)} className="press flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[13.5px] font-semibold text-[#b42318] ring-1 ring-[#f9d4d4]">
                  <X size={16} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    approveExpense(e.id, me);
                    showToast(`${e.description} approved`);
                  }}
                  className="press flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-good text-[13.5px] font-semibold text-white"
                >
                  <Check size={16} /> Approve
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {reject && <RejectSheet e={reject} onClose={() => setReject(null)} />}
    </section>
  );
}

/* ─────────────── one expense ─────────────── */

function ExpenseSheet({ row, onClose, onEdit }: { row: XRow; onClose: () => void; onEdit: (r: ExpenseRecord) => void }) {
  const { moveExpenseToTrash } = useCompany();
  const { showToast } = useNav();
  const rights = useRights();
  const isStaff = useIsStaff();
  const team = useTeam();
  const [trash, setTrash] = useState(false);
  const [reject, setReject] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const r = row.rec;
  const o = r?.outsourced;
  const approvedAt = r?.approvedAt ? new Date(r.approvedAt) : row.line ? team.expensePeople(row.line).approvedAt : null;
  const who = (p: Person | null, sub?: string) =>
    p ? (
      <PersonLine p={p} sub={sub} onClick={isStaff(p.name) ? () => setPerson(p.name) : undefined} />
    ) : (
      <span className="text-muted">Name not on record</span>
    );
  return (
    <Sheet
      title={row.description}
      subtitle={`${row.id} · ${row.category}`}
      onClose={onClose}
      tall
      footer={
        r && (rights.canEdit(r) || rights.canTrash(r) || (rights.canApprove && r.status === 'Pending')) ? (
          <div className="grid gap-2">
            {rights.canApprove && r.status === 'Pending' && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setReject(true)} className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[15px] font-semibold text-[#b42318] ring-1 ring-[#f9d4d4]">
                  <X size={18} /> Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    approveExpense(r.id, rights.me);
                    showToast(`${r.description} approved`);
                  }}
                  className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-good text-[15px] font-semibold text-white"
                >
                  <Check size={18} /> Approve
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {rights.canTrash(r) && (
                <button type="button" onClick={() => setTrash(true)} className="press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[14.5px] font-semibold text-[#b42318] ring-1 ring-line">
                  <Trash2 size={17} /> Move to trash
                </button>
              )}
              {rights.canEdit(r) && (
                <button type="button" onClick={() => onEdit(r)} className={`press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white ${rights.canTrash(r) ? '' : 'col-span-2'}`}>
                  <Pencil size={17} /> {r.status === 'Rejected' ? 'Correct and resubmit' : 'Edit'}
                </button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="px-1 pb-4">
        <div className={`relative overflow-hidden rounded-[22px] p-4 ${row.status === 'Approved' ? 'bg-linear-to-br from-[#eafaf0] to-[#d6f5e2]' : row.status === 'Pending' ? 'bg-linear-to-br from-[#fff7ec] to-[#ffe7c4]' : 'bg-linear-to-br from-[#fff1f1] to-[#ffdede]'}`}>
          <Sticker name={stickerOf(row.category)} size={64} className="absolute right-3 top-3" />
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${STATUS_PILL[row.status]} ring-1 ring-white`}>
            {row.status === 'Approved' ? <BadgeCheck size={14} /> : row.status === 'Pending' ? <Hourglass size={14} /> : <X size={14} />}
            {STATUS_LABEL[row.status]}
          </span>
          <p className="mt-2.5 text-[30px] font-extrabold leading-none tracking-[-0.02em] text-ink">{naira(row.amount)}</p>
          <p className="mt-1 text-[13px] text-ink-2">
            {dayText(row.at)}
            {row.method ? ` · ${row.method}` : ''}
            {row.paidTo ? ` · ${row.paidTo}` : ''}
          </p>
          {r?.rejectReason && (
            <p className="mt-2.5 rounded-xl bg-white/80 px-3 py-2 text-[13px] text-[#b42318]">
              <b>Reason:</b> {r.rejectReason}
              {r.rejectedBy ? ` (${r.rejectedBy.name})` : ''}
            </p>
          )}
        </div>

        {o && (
          <div className={`mt-3 rounded-2xl p-3.5 ${retained(o, row.amount) >= 0 ? 'bg-[#eef6ff]' : 'bg-[#fff1f1]'}`}>
            <p className="text-[12.5px] font-semibold text-muted">Partner service</p>
            <p className="text-[15px] font-bold text-ink">{o.service}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              Patient paid {naira(o.charged)} · partner {naira(row.amount)}
            </p>
            <p className={`mt-0.5 text-[14px] font-bold ${retained(o, row.amount) >= 0 ? 'text-good-ink' : 'text-[#b42318]'}`}>
              {retained(o, row.amount) >= 0 ? `Branch keeps ${naira(retained(o, row.amount))}` : `Branch loses ${naira(-retained(o, row.amount))}`}
            </p>
            {o.patient && <p className="mt-0.5 text-[12.5px] text-muted">Patient: {o.patient}</p>}
          </div>
        )}

        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">People</p>
        <div className="divide-y divide-line rounded-2xl bg-page">
          <div className="px-3.5 py-2.5">
            <p className="text-[12px] text-muted">Recorded by</p>
            {who(row.recordedBy, r ? `${dayText(new Date(r.recordedAt))}, ${timeText(new Date(r.recordedAt))}` : undefined)}
          </div>
          <div className="px-3.5 py-2.5">
            <p className="text-[12px] text-muted">{row.status === 'Pending' ? 'Approval' : row.status === 'Rejected' ? 'Rejected by' : 'Approved by'}</p>
            {row.status === 'Pending' ? <span className="text-[14px] font-semibold text-warn-ink">Waiting for the Branch Manager</span> : row.status === 'Rejected' ? who(r?.rejectedBy ?? null) : who(row.approvedBy, approvedAt ? `${r?.approval === 'stated' ? 'Approval stated when recorded' : 'Approved in STANLEY'} · ${dayText(approvedAt)}, ${timeText(approvedAt)}` : undefined)}
          </div>
        </div>

        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Details</p>
        <Facts
          rows={[
            { label: 'What it was for', value: row.description, sub: row.category },
            { label: 'Date spent', value: dayText(new Date(`${row.date}T00:00:00`)) },
            ...(row.method ? [{ label: 'Paid by', value: row.method }] : []),
            ...(row.paidTo ? [{ label: o ? 'Partner' : 'Paid to', value: row.paidTo }] : []),
            ...(r?.reference ? [{ label: 'Receipt no.', value: r.reference }] : []),
            { label: 'Source', value: row.source === 'stanley' ? 'Recorded in STANLEY' : 'Demo activity', sub: r ? (r.sync === 'queued' ? 'Saved on this device, waiting to sync' : 'Synced') : 'Read only' },
            { label: 'Reference', value: row.id },
          ]}
        />
        {r?.notes && (
          <div className="mt-3 rounded-2xl bg-page px-3.5 py-3">
            <p className="text-[12px] text-muted">Notes</p>
            <p className="whitespace-pre-wrap text-[14px] text-ink">{r.notes}</p>
          </div>
        )}
        {r?.receipt && (
          <>
            <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Receipt photo</p>
            <img src={r.receipt} alt="Receipt" className="max-h-80 w-full rounded-2xl bg-page object-contain ring-1 ring-line" />
          </>
        )}
        {r && r.history.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">History</p>
            <ol className="relative ml-2 border-l-2 border-line pl-4">
              {[...r.history].reverse().map((h, i) => (
                <li key={i} className="relative pb-3 last:pb-0">
                  <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${i === 0 ? 'bg-brand-500' : 'bg-[#c3cede]'}`} />
                  <p className="text-[13.5px] font-semibold text-ink">{h.action}</p>
                  <p className="text-[12px] text-muted">
                    {h.by.name}, {h.by.role} · {dayText(new Date(h.at))}, {timeText(new Date(h.at))}
                  </p>
                  {h.note && <p className="mt-0.5 text-[12.5px] text-ink-2">{h.note}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      {trash && r && (
        <TrashSheet
          name={r.description}
          what="expense"
          onClose={() => setTrash(false)}
          onConfirm={(reason) => {
            moveExpenseToTrash(r.id, reason);
            showToast(`${r.description} moved to Trash`);
            setTrash(false);
            onClose();
          }}
        />
      )}
      {reject && r && <RejectSheet e={r} onClose={() => setReject(false)} />}
      {person && <StaffSheetByName name={person} onClose={() => setPerson(null)} />}
    </Sheet>
  );
}

function PersonLine({ p, sub, onClick }: { p: Person; sub?: string; onClick?: () => void }) {
  const photo = usePhoto()(p.name);
  const body = (
    <>
      {photo ? <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <InitialsAvatar name={p.name} size={36} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{p.name}</span>
        <span className="block truncate text-[12px] text-muted">{[p.role, sub].filter(Boolean).join(' · ')}</span>
      </span>
      {onClick && <ChevronRight size={15} className="shrink-0 text-faint" />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="press mt-1 flex w-full items-center gap-2.5 text-left">
      {body}
    </button>
  ) : (
    <div className="mt-1 flex items-center gap-2.5">{body}</div>
  );
}

/* ─────────────── record or edit ─────────────── */

const filled = (s: string) => s.trim().length > 0;
const digits = (s: string) => s.replace(/[^\d]/g, '');
const withCommas = (s: string) => (s ? Number(s).toLocaleString('en-NG') : '');

function ExpenseFormSheet({ branchId, editing, onClose, onSaved }: { branchId: string; editing: ExpenseRecord | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { user, staff } = useCompany();
  const { showToast } = useNav();
  const branch = getBranch(branchId)!;
  const today = isoDate(new Date());
  const me: Person = { name: user.name, role: user.role };
  const findPhoto = usePhoto();
  const approvers = useMemo(() => {
    const list = expenseApprovers(staff, branchId, { name: BRANCH_MANAGER_PLACEHOLDER.name, role: BRANCH_MANAGER_PLACEHOLDER.role }, { name: CURRENT_USER.name, role: CURRENT_USER.role });
    // A manager recording their own expense approves it themselves.
    if (user.kind === 'manager' && !list.some((a) => a.value === `${me.name}|${me.role}`)) list.unshift({ value: `${me.name}|${me.role}`, label: me.name, description: `${me.role} · you`, person: me });
    return list.map((a) => (a.person.name === me.name ? { ...a, description: `${a.person.role} · you` } : a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, branchId, user.kind, me.name, me.role]);

  const [category, setCategory] = useState(editing?.category ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing?.date ?? today);
  const [method, setMethod] = useState<PaymentMethod | ''>(editing?.method ?? '');
  const [paidTo, setPaidTo] = useState(editing?.paidTo ?? '');
  const [reference, setReference] = useState(editing?.reference ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [receipt, setReceipt] = useState(editing?.receipt ?? '');
  const [photoErr, setPhotoErr] = useState('');
  const [service, setService] = useState(editing?.outsourced?.service ?? '');
  const [patient, setPatient] = useState(editing?.outsourced?.patient ?? '');
  const [charged, setCharged] = useState(editing?.outsourced ? String(editing.outsourced.charged) : '');
  const defaultMode = editing ? (editing.status === 'Approved' ? 'approved' : 'pending') : user.kind === 'manager' ? 'approved' : '';
  const [mode, setMode] = useState<'approved' | 'pending' | ''>(defaultMode as 'approved' | 'pending' | '');
  const [approver, setApprover] = useState(editing?.approvedBy ? `${editing.approvedBy.name}|${editing.approvedBy.role}` : user.kind === 'manager' ? `${me.name}|${me.role}` : '');
  const [tried, setTried] = useState(false);

  const outsourced = category === OUTSOURCED;
  const value = Number(amount || 0);
  const amountOk = value > 0;
  const chargedValue = Number(charged || 0);
  const kept = chargedValue - value;
  const descText = outsourced ? (filled(service) ? `${service.trim()} (partner)` : '') : description;
  const dateOk = filled(date) && date <= today;
  const approverPick = approvers.find((a) => a.value === approver);
  const suggestions = category && !outsourced ? (CATEGORY_ITEMS[category] ?? []) : [];

  const errors = {
    category: !filled(category) ? 'Choose what kind of expense this is.' : '',
    service: outsourced && !filled(service) ? 'Say which test or service the partner did.' : '',
    charged: outsourced && !(chargedValue > 0) ? 'Enter what the patient paid the branch for this service.' : '',
    description: !outsourced && filled(category) && !filled(description) ? 'Say what the money was spent on.' : '',
    amount: !amountOk ? (outsourced ? 'Enter what the branch paid the partner.' : 'Enter the amount spent, more than ₦0.') : '',
    date: !filled(date) ? 'Choose the day the money was spent.' : !dateOk ? 'The date cannot be in the future.' : '',
    paidTo: outsourced && !filled(paidTo) ? 'Name the partner who did the test.' : '',
    method: !method ? 'Choose how it was paid.' : '',
    mode: !mode ? 'Say whether it is already approved or needs approval.' : '',
    approver: mode === 'approved' && !approverPick ? 'Choose who approved this expense.' : '',
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] || null : null);
  const ok = Object.values(errors).every((e) => !e);
  const steps = [
    { label: 'What', done: filled(category) && filled(descText) && amountOk && (!outsourced || chargedValue > 0) },
    { label: 'Payment', done: dateOk && !!method && (!outsourced || filled(paidTo)) },
    { label: 'Approval', done: mode === 'pending' || (mode === 'approved' && !!approverPick) },
    { label: 'Proof', done: !!receipt || filled(reference) || filled(notes) },
  ];

  const save = () => {
    if (!ok) {
      setTried(true);
      showToast('Some details are missing. Check the fields marked in red.');
      return;
    }
    const input = {
      branchId,
      date,
      category,
      description: descText,
      outsourced: outsourced ? { service: service.trim(), patient: patient.trim(), charged: chargedValue } : undefined,
      amount: value,
      method: method as PaymentMethod,
      paidTo,
      reference,
      notes,
      receipt: receipt || undefined,
      approvedBy: mode === 'approved' && approverPick ? approverPick.person : null,
    };
    let id = editing?.id ?? '';
    if (editing) updateExpense(editing.id, input, me);
    else id = recordExpense(input, me).id;
    showToast(input.approvedBy ? `${descText.trim()} · ${naira(value)} saved, approved by ${input.approvedBy.name}` : `${descText.trim()} · ${naira(value)} sent for approval`);
    onClose();
    onSaved(id);
  };

  return (
    <Sheet
      title={editing ? 'Edit expense' : 'Record an expense'}
      subtitle={editing ? `${editing.id} · ${branch.name} branch` : `${branch.name} branch · only approved expenses count as spent`}
      onClose={onClose}
      tall
      footer={
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
            <span className="text-muted">{outsourced ? 'Paid to the partner' : 'Amount'}</span>
            <b className="text-[16px] text-ink">{amountOk ? naira(value) : '₦0'}</b>
          </div>
          <button type="button" onClick={save} className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white ${ok ? 'bg-brand-600 shadow-[0_10px_22px_rgba(31,111,232,0.3)]' : 'bg-brand-600/55'}`}>
            {mode === 'pending' ? <Hourglass size={18} /> : <Check size={18} />}
            {editing ? 'Save changes' : mode === 'pending' ? 'Send for approval' : 'Save expense'}
          </button>
        </div>
      }
    >
      <div className="px-1 pb-6">
        {/* progress */}
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {steps.map((s) => (
            <div key={s.label}>
              <span className={`block h-1.5 rounded-full ${s.done ? 'bg-good' : 'bg-line'}`} />
              <span className={`mt-1 block text-center text-[11.5px] font-semibold ${s.done ? 'text-good-ink' : 'text-muted'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        <Group title="What was spent">
          <FieldLabel label="Category" required />
          <div role="group" aria-label="Category" className="mt-1.5 grid grid-cols-2 gap-2">
            {RECORD_CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => setCategory(c)} className={`press relative flex items-center gap-2 rounded-2xl p-2.5 text-left ${c === OUTSOURCED ? 'col-span-2' : ''} ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-line'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TINT[c] ?? 'bg-page'}`}>
                    <Sticker name={stickerOf(c)} size={28} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold leading-tight text-ink">{c}</span>
                    <span className="block truncate text-[11.5px] text-muted">{CATEGORY_HINT[c] ?? (CATEGORY_ITEMS[c] ?? []).slice(0, 2).join(', ')}</span>
                  </span>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <FieldErr msg={show('category')} />

          {outsourced ? (
            <>
              <p className="mt-3 rounded-2xl bg-[#eef6ff] px-3.5 py-3 text-[13px] leading-snug text-ink-2">For a test this branch does not do: the patient pays us, we pay the partner who does the test, and the branch keeps the difference. The amount paid to the partner is the expense.</p>
              <Field label="Service done at the partner" required error={show('service')}>
                <input value={service} maxLength={70} onChange={(e) => setService(e.target.value)} placeholder="For example: MRI brain" className={inputCls(show('service'))} />
              </Field>
              <Pills items={CATEGORY_ITEMS[OUTSOURCED]} value={service} onPick={setService} />
              <Field label="Patient" optional hint="Name or Patient ID">
                <input value={patient} maxLength={60} onChange={(e) => setPatient(e.target.value)} placeholder="For example: ABJ-W000123 or Amina Bello" className={inputCls()} />
              </Field>
              <Field label="Patient paid us" required error={show('charged')} hint="What we charged the patient, for example 60,000.">
                <MoneyInput value={charged} onChange={setCharged} err={show('charged')} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Description" required error={show('description')}>
                <input value={description} maxLength={80} onChange={(e) => setDescription(e.target.value)} placeholder="For example: Diesel for generator" className={inputCls(show('description'))} />
              </Field>
              <Pills items={suggestions} value={description} onPick={setDescription} />
            </>
          )}
          <Field label={outsourced ? 'Paid to the partner' : 'Amount spent'} required error={show('amount')} hint={value >= LARGE_EXPENSE ? `Large expense (${naira(value)}). Double check the amount before saving.` : outsourced ? "The partner's price. This is the expense." : 'Whole naira, for example 25,000.'}>
            <MoneyInput value={amount} onChange={setAmount} err={show('amount')} />
          </Field>
          {outsourced && chargedValue > 0 && amountOk && (
            <div role="status" className={`mt-3 rounded-2xl px-3.5 py-3 ${kept < 0 ? 'bg-[#fff1f1]' : 'bg-[#eafaf0]'}`}>
              <p className="text-[12.5px] text-ink-2">
                Patient paid <b>{naira(chargedValue)}</b> less partner <b>{naira(value)}</b>
              </p>
              <p className={`text-[15px] font-bold ${kept < 0 ? 'text-[#b42318]' : 'text-good-ink'}`}>
                {kept >= 0 ? `Branch keeps ${naira(kept)}` : `Branch loses ${naira(-kept)}`}
                <span className="text-[12px] font-medium text-muted"> · {Math.round((kept / chargedValue) * 100)}% of what the patient paid</span>
              </p>
            </div>
          )}
        </Group>

        <Group title="Payment">
          <Field label="Date spent" required error={show('date')}>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls(show('date'))} />
          </Field>
          <Field label={outsourced ? 'Partner branch or facility' : 'Paid to'} required={outsourced} optional={!outsourced} error={show('paidTo')} hint={outsourced ? 'Who did the test for us.' : 'The supplier, shop or person paid.'}>
            <input value={paidTo} maxLength={80} onChange={(e) => setPaidTo(e.target.value)} placeholder={outsourced ? 'For example: Garki Imaging Centre' : 'For example: Total filling station'} className={inputCls(show('paidTo'))} />
          </Field>
          <div className="mt-3">
            <FieldLabel label="Paid by" required />
            <div role="group" aria-label="Paid by" className="mt-1.5 grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Choice key={m} on={method === m} onClick={() => setMethod(m)} title={m} sub={METHOD_HINT[m]} />
              ))}
            </div>
            <FieldErr msg={show('method')} />
          </div>
        </Group>

        <Group title="Approval" note="Every expense must say who approved it, usually the Branch Manager.">
          <div role="group" aria-label="Approval" className="grid grid-cols-2 gap-2">
            <Choice on={mode === 'approved'} onClick={() => setMode('approved')} title="Already approved" sub="Name who approved it" icon={<BadgeCheck size={18} className="text-good" />} />
            <Choice on={mode === 'pending'} onClick={() => setMode('pending')} title="Send for approval" sub="The Branch Manager decides" icon={<Hourglass size={18} className="text-warn-ink" />} />
          </div>
          <FieldErr msg={show('mode')} />
          {mode === 'approved' && (
            <div className="mt-3">
              <FieldLabel label="Approved by" required />
              <ul className="mt-1.5 space-y-2">
                {approvers.map((a) => {
                  const on = approver === a.value;
                  const photo = findPhoto(a.person.name);
                  return (
                    <li key={a.value}>
                      <button type="button" aria-pressed={on} onClick={() => setApprover(a.value)} className={`press flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-line'}`}>
                        {photo ? <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <InitialsAvatar name={a.label} size={40} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold text-ink">{a.label}</span>
                          <span className="block truncate text-[12px] text-muted">{a.description}</span>
                        </span>
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? 'bg-brand-600 text-white' : 'ring-2 ring-line'}`}>{on && <Check size={14} strokeWidth={3} />}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <FieldErr msg={show('approver')} />
            </div>
          )}
          {mode === 'pending' && <p className="mt-3 rounded-2xl bg-[#fff7ec] px-3.5 py-3 text-[13px] text-ink-2">It counts as spent once a Branch Manager approves it. You can follow it on this page.</p>}
        </Group>

        <Group title="Receipt and notes" note="Optional, but it helps the approver and the accountant.">
          <Field label="Receipt or invoice number" optional>
            <input value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} placeholder="For example: INV-2041" className={inputCls()} />
          </Field>
          <div className="mt-3">
            <FieldLabel label="Photo of the receipt" optional />
            {receipt ? (
              <div className="relative mt-1.5">
                <img src={receipt} alt="Receipt" className="max-h-64 w-full rounded-2xl bg-page object-contain ring-1 ring-line" />
                <button type="button" onClick={() => setReceipt('')} aria-label="Remove the photo" className="press absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#b42318] shadow">
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label className="press mt-1.5 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-page text-center">
                <Camera size={24} className="text-brand-600" />
                <span className="text-[14px] font-semibold text-ink">Take or choose a photo</span>
                <span className="text-[12px] text-muted">PNG, JPG or WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      setReceipt(await readImage(file, 1000));
                      setPhotoErr('');
                    } catch (err) {
                      setPhotoErr(err instanceof Error ? err.message : 'That photo could not be read.');
                    }
                  }}
                />
              </label>
            )}
            <FieldErr msg={photoErr || null} />
          </div>
          <div className="mt-3">
            <LongText label="Notes" optional value={notes} onChange={setNotes} max={300} placeholder={'Anything the approver or accountant should know.\nFor example: paid half now, the rest next week.'} />
          </div>
        </Group>
      </div>
    </Sheet>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-[22px] bg-white p-3.5 ring-1 ring-line/70">
      <h3 className="text-[16px] font-bold text-ink">{title}</h3>
      {note && <p className="mb-2 text-[12.5px] text-muted">{note}</p>}
      <div className={note ? '' : 'mt-2'}>{children}</div>
    </section>
  );
}

function Field({ label, required, optional, hint, error, children }: { label: string; required?: boolean; optional?: boolean; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="mt-3 block">
      <FieldLabel label={label} required={required} optional={optional} />
      <span className="mt-1.5 block">{children}</span>
      {error ? <FieldErr msg={error} /> : hint ? <span className="mt-1 block text-[12.5px] text-muted">{hint}</span> : null}
    </label>
  );
}

function MoneyInput({ value, onChange, err }: { value: string; onChange: (v: string) => void; err?: string | null }) {
  return (
    <span className="relative block">
      <b className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-muted">₦</b>
      <input value={withCommas(value)} onChange={(e) => onChange(digits(e.target.value).slice(0, 10))} placeholder="0" inputMode="numeric" className={`${inputCls(err)} pl-9 text-[17px] font-bold`} />
    </span>
  );
}

function Pills({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Common descriptions">
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)} className={`press min-h-8 rounded-full px-3 text-[12.5px] font-semibold ${value === s ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
          {s}
        </button>
      ))}
    </div>
  );
}

function Choice({ on, onClick, title, sub, icon }: { on: boolean; onClick: () => void; title: string; sub: string; icon?: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`press rounded-2xl p-2.5 text-left ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-line'}`}>
      <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
        {icon}
        {title}
      </span>
      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{sub}</span>
    </button>
  );
}

/** A team member's photo by name (the Company Admin and unknown names show initials). */
function usePhoto() {
  const { staff } = useCompany();
  return (name: string) => {
    const s = staff.find((x) => x.name === name);
    return s ? photoOf(s) : undefined;
  };
}
