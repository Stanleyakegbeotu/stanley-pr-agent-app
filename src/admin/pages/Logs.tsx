/**
 * Audit Log and Trash (mobile, owner 2026-11-25): same records and rules as
 * the desktop AuditPage / TrashPage (AdminLogs), in the admin's mobile card
 * language.
 *  • Audit Log: every change made in STANLEY, read only, newest first and
 *    grouped by day. Search, area chips, person and dates in a filter
 *    slide-up; an entry opens its full details.
 *  • Trash: deleted records kept 30 days. Restore (back exactly as it was), or
 *    delete permanently after a confirmation. Only records created in STANLEY
 *    can be deleted; the legacy baseline never can.
 * Both follow the branch scope (All branches or one branch).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronRight, Info, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { TRASH_RETENTION_DAYS, useApp as useCompany, type TrashItem } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { DATA_START, TODAY, isoDate } from '@company/data/demo/generator';
import { AUDIT_CATEGORIES, useAuditLog, type AuditEntry } from '@company/services/audit';
import { formatCount } from '@company/shared/format';
import { useNav } from '@/app/store';
import type { StickerKey } from '@/assets';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { ScopeBar, Sheet } from '../ui';
import { AdminTopBar, EmptyCard, PageGlow } from '../kit';
import { Chips, Facts, PageTitle } from '../branchFirst';
import { StickyTools } from '@/admin/kit';
import { useRight } from '../access';
import { useStaffChrome } from '@/staff/chrome';

const DAY = 86_400_000;
const branchName = (id: string | null) => (id ? (getBranch(id)?.name ?? id) : 'Company wide');
const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const longWhen = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${time(d)}`;
function dayTitle(d: Date) {
  const k = isoDate(d);
  if (k === isoDate(new Date())) return 'Today';
  if (k === isoDate(new Date(Date.now() - DAY))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const AREA: Record<string, { sticker: StickerKey; tint: string }> = {
  Billing: { sticker: 'moneyBag', tint: 'bg-tint-green' },
  'PR agents': { sticker: 'stethoscope', tint: 'bg-tint-purple' },
  Commission: { sticker: 'coin', tint: 'bg-[#eef1ff]' },
  Staff: { sticker: 'womanHealthWorker', tint: 'bg-tint-blue' },
  Catalogue: { sticker: 'testTube', tint: 'bg-tint-green' },
  Trash: { sticker: 'clipboard', tint: 'bg-[#fdecec]' },
  Reports: { sticker: 'chart', tint: 'bg-tint-blue' },
  Receipts: { sticker: 'envelope', tint: 'bg-tint-orange' },
  Expenses: { sticker: 'clipboard', tint: 'bg-tint-orange' },
  Settings: { sticker: 'sparkles', tint: 'bg-page' },
  System: { sticker: 'bell', tint: 'bg-page' },
};
const area = (c: string) => AREA[c] ?? { sticker: 'clipboard' as StickerKey, tint: 'bg-page' };

function useScopeIds() {
  const { context: ctx } = useCompany();
  // Branch workspace: its own branch only.
  const context = useStaffChrome().branchId || ctx;
  return { scope: context === 'all' ? null : [context], scopeText: context === 'all' ? 'All branches' : `${getBranch(context)?.name ?? ''} branch` };
}

function SearchBox({ value, onChange, placeholder, right }: { value: string; onChange: (v: string) => void; placeholder: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-h-12 w-full rounded-full bg-white pl-11 pr-10 text-[15px] text-ink shadow-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500" />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted">
            <X size={18} />
          </button>
        )}
      </div>
      {right}
    </div>
  );
}

function Fig({ label, value, sub, tone = 'text-ink' }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-[18px] bg-white p-3 ring-1 ring-line/70">
      <p className="truncate text-[11.5px] font-medium text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-[20px] font-bold leading-tight ${tone}`}>{value}</p>
      <p className="line-clamp-2 text-[11px] leading-snug text-muted">{sub}</p>
    </div>
  );
}

/* ─────────────── Audit Log ─────────────── */

export function AuditPage() {
  const log = useAuditLog();
  const { scope, scopeText } = useScopeIds();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [user, setUser] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState(false);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const [shown, setShown] = useState(40);
  const inScope = useMemo(() => log.filter((e) => !scope || (e.branchId ? scope.includes(e.branchId) : true)), [log, scope]);
  const users = [...new Set(inScope.map((e) => e.user))];
  const t = q.trim().toLowerCase();
  const rows = inScope.filter((e) => {
    if (category !== 'all' && e.category !== category) return false;
    if (user !== 'all' && e.user !== user) return false;
    const day = isoDate(e.at);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return !t || `${e.id} ${e.user} ${e.role} ${e.action} ${e.record} ${e.details} ${e.category}`.toLowerCase().includes(t);
  });
  const today = isoDate(new Date());
  const extra = (user !== 'all' ? 1 : 0) + (from || to ? 1 : 0);
  const filtered = category !== 'all' || extra > 0 || !!t;
  // Group the visible entries by day.
  const groups: { title: string; items: AuditEntry[] }[] = [];
  for (const e of rows.slice(0, shown)) {
    const title = dayTitle(e.at);
    const g = groups[groups.length - 1];
    if (g && g.title === title) g.items.push(e);
    else groups.push({ title, items: [e] });
  }
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Audit Log" sub={`Read only record · ${scopeText}`} />
        <ScopeBar branchOnly />
        <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#3346c9] via-[#4f63e6] to-[#8796f7] p-5 text-white shadow-[0_14px_34px_rgba(51,70,201,0.25)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative max-w-[64%]">
            <p className="text-[13px] font-medium text-white/90">Every change made in STANLEY</p>
            <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.02em]">{formatCount(inScope.length)}</p>
            <p className="mt-2 text-[12.5px] leading-snug text-white/90">
              {formatCount(inScope.filter((e) => isoDate(e.at) === today).length)} today · {formatCount(users.filter((u) => u !== 'System').length)} {users.filter((u) => u !== 'System').length === 1 ? 'person' : 'people'} made changes
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold ring-1 ring-white/30">
              <ShieldCheck size={14} /> Protected: entries cannot be edited or deleted
            </p>
          </div>
          <Sticker name="clipboard" size={108} className="absolute right-1 top-4" />
        </div>

        <StickyTools className="mt-2">
        <div className="mb-2.5">
          <SearchBox
            value={q}
            onChange={(v) => (setQ(v), setShown(40))}
            placeholder="Search action, record, person or details"
            right={
              <button type="button" onClick={() => setFilters(true)} aria-label="Person and dates" className="press relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm ring-1 ring-line">
                <SlidersHorizontal size={19} />
                {extra > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{extra}</span>}
              </button>
            }
          />
        </div>
        <Chips label="Area" value={category} onChange={(v) => (setCategory(v), setShown(40))} options={[{ value: 'all', label: 'All areas' }, ...AUDIT_CATEGORIES.filter((c) => inScope.some((e) => e.category === c)).map((c) => ({ value: c, label: c, count: inScope.filter((e) => e.category === c).length }))]} />
        </StickyTools>
        <div className="mb-2 flex items-center justify-between gap-2 text-[12.5px] text-muted">
          <span>
            {formatCount(rows.length)} of {formatCount(inScope.length)} entries · newest first
          </span>
          {filtered && (
            <button type="button" onClick={() => (setQ(''), setCategory('all'), setUser('all'), setFrom(''), setTo(''))} className="font-semibold text-brand-600">
              Clear filters
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyCard sticker="clipboard" text={filtered ? 'No entries match these filters.' : 'No activity yet.'} />
        ) : (
          groups.map((g) => (
            <section key={g.title} className="mb-4">
              <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13.5px] font-bold text-ink-2">
                <CalendarDays size={15} /> {g.title}
              </h2>
              <ul className="space-y-2">
                {g.items.map((e) => {
                  const a = area(e.category);
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => setOpen(e)} className="press flex w-full items-start gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${a.tint}`}>
                          <Sticker name={a.sticker} size={28} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 text-[14.5px] font-semibold leading-snug text-ink">{e.action}</span>
                            <span className="shrink-0 text-[12px] text-muted">{time(e.at)}</span>
                          </span>
                          <span className="block truncate text-[12.5px] text-ink-2">{e.record}</span>
                          <span className="mt-0.5 line-clamp-2 text-[12px] text-muted">{e.details}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{e.category}</span>
                            <span className="truncate text-[11.5px] text-muted">
                              {e.user}, {e.role}
                              {!scope ? ` · ${branchName(e.branchId)}` : ''}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        {shown < rows.length && (
          <button type="button" onClick={() => setShown((n) => n + 40)} className="press mx-auto block rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-brand-600 ring-1 ring-line">
            Show more ({formatCount(rows.length - shown)} more)
          </button>
        )}
        <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 shrink-0" /> Changes are recorded as they happen and cannot be edited or removed. Saved on this device until the database is connected.
        </p>
      </div>

      {filters && (
        <Sheet
          title="Filter the log"
          subtitle="Person and dates"
          onClose={() => setFilters(false)}
          footer={
            <button type="button" onClick={() => setFilters(false)} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
              Show {formatCount(rows.length)} entries
            </button>
          }
        >
          <div className="px-1 pb-2">
            <p className="mb-2 text-[14px] font-semibold text-ink">Who made the change</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {['all', ...users].map((u) => (
                <button key={u} type="button" aria-pressed={user === u} onClick={() => setUser(u)} className={`press min-h-10 rounded-xl px-3.5 text-[14px] font-semibold ${user === u ? 'bg-brand-600 text-white' : 'bg-page text-ink-2 ring-1 ring-line'}`}>
                  {u === 'all' ? 'Everyone' : u}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[14px] font-semibold text-ink">Dates</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[12.5px] text-muted">From</span>
                <input type="date" value={from} min={isoDate(DATA_START)} max={to || isoDate(TODAY)} onChange={(e) => setFrom(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[12.5px] text-muted">To</span>
                <input type="date" value={to} min={from || isoDate(DATA_START)} onChange={(e) => setTo(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border-[1.5px] border-brand-500 bg-white px-2 text-[14px] ring-4 ring-brand-100" />
              </label>
            </div>
            {(from || to || user !== 'all') && (
              <button type="button" onClick={() => (setUser('all'), setFrom(''), setTo(''))} className="mt-3 text-[13.5px] font-semibold text-brand-600">
                Clear person and dates
              </button>
            )}
          </div>
        </Sheet>
      )}
      {open && (
        <Sheet title={open.action} subtitle={`${open.id} · ${longWhen(open.at)}`} onClose={() => setOpen(null)}>
          <div className="px-1 pb-2">
            <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-page p-3">
              <InitialsAvatar name={open.user} size={44} />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold text-ink">{open.user}</span>
                <span className="block text-[12.5px] text-muted">{open.role}</span>
              </span>
            </div>
            <Facts
              rows={[
                { label: 'Area', value: open.category },
                { label: 'Record', value: open.record },
                { label: 'Branch', value: branchName(open.branchId) },
                { label: 'When', value: longWhen(open.at) },
              ]}
            />
            <p className="mb-1 mt-3 px-1 text-[13px] font-semibold text-ink-2">What changed</p>
            <p className="rounded-2xl bg-page p-3.5 text-[14px] leading-relaxed text-ink">{open.details}</p>
            <p className="mt-3 flex items-center gap-1.5 px-1 text-[12px] text-muted">
              <ShieldCheck size={14} /> This entry cannot be edited or deleted.
            </p>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ─────────────── Trash ─────────────── */

const RESTORED_TO: Record<TrashItem['kind'], string> = { staff: 'Staff Management', agent: 'PR Management', expense: 'Expenses', draft: 'Drafts', bill: 'Records', service: 'Inventory' };
const KIND: Record<TrashItem['kind'], { label: string; sticker: StickerKey; tint: string }> = {
  bill: { label: 'Bills', sticker: 'moneyBag', tint: 'bg-tint-green' },
  draft: { label: 'Unfinished bills', sticker: 'clipboard', tint: 'bg-tint-blue' },
  expense: { label: 'Expenses', sticker: 'clipboard', tint: 'bg-tint-orange' },
  staff: { label: 'Staff', sticker: 'womanHealthWorker', tint: 'bg-tint-blue' },
  agent: { label: 'PR agents', sticker: 'stethoscope', tint: 'bg-tint-purple' },
  service: { label: 'Services', sticker: 'testTube', tint: 'bg-tint-green' },
};
export const daysLeft = (t: TrashItem) => Math.max(0, TRASH_RETENTION_DAYS - Math.floor((Date.now() - new Date(t.deletedAt).getTime()) / DAY));
const refOf = (t: TrashItem) => t.staff?.id ?? t.expense?.id ?? t.bill?.patient.patientId ?? (t.draft ? (t.draft.patient.existingId ?? 'Unfinished bill') : null) ?? (t.service ? `Service #${t.service.id}` : null) ?? (t.agent ? `Agent #${t.agent.id}` : '');

export function TrashPage() {
  const { trash, restoreFromTrash, purgeFromTrash } = useCompany();
  const { showToast } = useNav();
  const { scope, scopeText } = useScopeIds();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | TrashItem['kind']>('all');
  const [purge, setPurge] = useState<TrashItem | null>(null);
  // Roles and Permissions: viewing Trash is not restoring it (trash.restore).
  const canRestore = useRight()('trash.restore');
  const [open, setOpen] = useState<TrashItem | null>(null);
  const inScope = useMemo(() => trash.filter((t) => !scope || scope.includes(t.branchId)), [trash, scope]);
  const t = q.trim().toLowerCase();
  const rows = inScope.filter((x) => (kind === 'all' || x.kind === kind) && (!t || `${x.name} ${x.type} ${x.reason ?? ''} ${x.deletedBy}`.toLowerCase().includes(t)));
  const restore = (x: TrashItem) => {
    restoreFromTrash(x.id);
    showToast(`${x.name} restored${RESTORED_TO[x.kind] ? `. Back in ${RESTORED_TO[x.kind]}` : ''}`);
    setOpen(null);
  };
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Trash" sub={`Recoverable for ${TRASH_RETENTION_DAYS} days · ${scopeText}`} />
        <ScopeBar branchOnly />
        <div className="grid grid-cols-2 gap-2.5">
          <Fig label="In trash" value={formatCount(inScope.length)} sub={`Kept ${TRASH_RETENTION_DAYS} days, then removed for good`} />
          <Fig label="Expiring soon" value={formatCount(inScope.filter((x) => daysLeft(x) <= 7).length)} sub="7 days or less left" tone="text-[#b42318]" />
          <Fig label="Bills and expenses" value={formatCount(inScope.filter((x) => x.kind === 'bill' || x.kind === 'draft' || x.kind === 'expense').length)} sub="Bills, unfinished bills and expenses" />
          <Fig label="People and catalogue" value={formatCount(inScope.filter((x) => x.kind === 'staff' || x.kind === 'agent' || x.kind === 'service').length)} sub="Staff, PR agents and services" />
        </div>

        <StickyTools className="mt-2">
          <div className="mb-2.5">
            <SearchBox value={q} onChange={setQ} placeholder="Search name, type, reason or who deleted it" />
          </div>
          <Chips label="Type" value={kind} onChange={setKind} options={[{ value: 'all' as const, label: 'All types', count: inScope.length }, ...(Object.keys(KIND) as TrashItem['kind'][]).map((k) => ({ value: k, label: KIND[k].label, count: inScope.filter((x) => x.kind === k).length }))]} />
        </StickyTools>

        {rows.length === 0 ? (
          inScope.length ? (
            <EmptyCard sticker="clipboard" text="No deleted records match these filters." />
          ) : (
            <div className="rounded-[22px] bg-white p-5 text-center ring-1 ring-line/70">
              <Sticker name="check" size={64} className="mx-auto" />
              <p className="mt-2 text-[16px] font-bold text-ink">Trash is empty</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">Nothing in STANLEY is deleted outright: bills, unfinished bills, expenses, staff, PR agents and services added in the app come here first and can be restored for {TRASH_RETENTION_DAYS} days. Records from the legacy system can never be deleted.</p>
            </div>
          )
        ) : (
          <ul className="space-y-2.5">
            {rows.map((x) => {
              const left = daysLeft(x);
              const k = KIND[x.kind];
              return (
                <li key={x.id} className="rounded-[20px] bg-white ring-1 ring-line/70">
                  <button type="button" onClick={() => setOpen(x)} className="press flex w-full items-start gap-3 p-3 text-left">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tint}`}>
                      <Sticker name={k.sticker} size={28} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{x.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${left <= 7 ? 'bg-[#fdecec] text-[#b42318]' : left <= 20 ? 'bg-[#fff1e0] text-[#b45309]' : 'bg-page text-ink-2'}`}>
                          {left} day{left === 1 ? '' : 's'} left
                        </span>
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {x.type} · {refOf(x)}
                        {!scope ? ` · ${branchName(x.branchId)}` : ''}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        Deleted by {x.deletedBy} · {new Date(x.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {x.reason ? ` · “${x.reason}”` : ''}
                      </span>
                    </span>
                    <ChevronRight size={16} className="mt-3 shrink-0 text-faint" />
                  </button>
                  {canRestore && <div className="flex gap-2 px-3 pb-3">
                    <button type="button" onClick={() => restore(x)} className="press flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-[13.5px] font-semibold text-white">
                      <RotateCcw size={15} /> Restore
                    </button>
                    <button type="button" onClick={() => setPurge(x)} aria-label={`Delete ${x.name} permanently`} className="press grid min-h-10 w-12 place-items-center rounded-xl bg-[#fdecec] text-[#b42318]">
                      <Trash2 size={17} />
                    </button>
                  </div>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
          <Info size={14} className="mt-0.5 shrink-0" /> {canRestore ? 'Restoring puts the record back exactly as it was. Deleting permanently cannot be undone.' : 'You can see what was deleted. Restoring or deleting for good needs the Restore and delete permanently right.'}
        </p>
      </div>

      {open && (
        <Sheet
          title={open.name}
          subtitle={`${open.type} · ${daysLeft(open)} days left in Trash`}
          onClose={() => setOpen(null)}
          footer={
            !canRestore ? undefined : <div className="flex gap-2">
              <button type="button" onClick={() => (setPurge(open), setOpen(null))} className="press min-h-12 rounded-2xl bg-[#fdecec] px-4 text-[14.5px] font-semibold text-[#b42318]">
                Delete for good
              </button>
              <button type="button" onClick={() => restore(open)} className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
                <RotateCcw size={17} /> Restore
              </button>
            </div>
          }
        >
          <div className="px-1 pb-2">
            <Facts
              rows={[
                { label: 'Type', value: open.type },
                { label: 'Reference', value: refOf(open) || 'None' },
                { label: 'Branch', value: branchName(open.branchId) },
                { label: 'Deleted by', value: open.deletedBy },
                { label: 'Deleted on', value: longWhen(new Date(open.deletedAt)) },
                { label: 'Reason', value: open.reason ?? 'No reason given' },
                { label: 'Removed for good', value: new Date(new Date(open.deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), tone: daysLeft(open) <= 7 ? 'due' : undefined },
                { label: 'Restores to', value: RESTORED_TO[open.kind] },
              ]}
            />
          </div>
        </Sheet>
      )}
      {purge && (
        <Sheet
          title="Delete permanently?"
          subtitle={`${purge.name} (${purge.type})`}
          onClose={() => setPurge(null)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setPurge(null)} className="press min-h-12 flex-1 rounded-2xl bg-page text-[15px] font-semibold text-ink-2 ring-1 ring-line">
                Keep in trash
              </button>
              <button
                type="button"
                onClick={() => {
                  purgeFromTrash(purge.id);
                  showToast(`${purge.name} deleted permanently`);
                  setPurge(null);
                }}
                className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#d93036] text-[15px] font-semibold text-white"
              >
                <Trash2 size={17} /> Delete
              </button>
            </div>
          }
        >
          <div className="px-1 pb-2 text-[14px] leading-relaxed text-ink-2">
            <p>
              <b className="text-ink">{purge.name}</b> will be removed for good. This cannot be undone.
            </p>
            <p className="mt-2">If you might need this record again, restore it instead. It stays in the trash for {daysLeft(purge)} more days.</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
