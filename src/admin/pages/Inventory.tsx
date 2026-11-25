/**
 * Inventory (mobile, owner 2026-11-25): the service catalogue, same content
 * and rules as the desktop InventoryPage + InventoryCatalog + AddServiceDialog,
 * in the admin's mobile card language.
 *   figures (categories, services, price range, most performed) · quick lists
 *   (no price, needs review, edited, added) · search every service · main
 *   categories as illustrated cards · specialist procedures as tiles.
 * A category opens its services (search, filters, sort, price bands); a
 * service opens its card: price, times performed and billed for the chosen
 * branch and dates, the test guide (what it is, how it's done, how to
 * prepare), the patients who did it, Edit (name, price; restore recorded
 * values) and Move to trash (only services added in STANLEY).
 * The legacy catalogue is read only: renames, edits and added services are
 * kept separately (this session until the database exists) and the recorded
 * values always stay visible.
 */
import { useMemo, useState } from 'react';
import { BookOpen, ChevronRight, CircleAlert, Pencil, Plus, RotateCcw, Search, Tag, Trash2, Users, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { CATALOGUE_CATEGORIES, CATALOGUE_INVENTORY, ITEM_REASSIGN } from '@company/data/catalogueRules';
import { INVENTORY_NOTES, categoryKey } from '@company/data/legacy';
import { nextServiceId, type InventoryChanges } from '@company/data/userRecords';
import { GUIDE_SOURCES, guideFor } from '@company/data/serviceGuide';
import { resolveBranchIds, resolveRange, serviceRanking } from '@company/services/analytics';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import type { StickerKey } from '@/assets';
import { Sticker } from '@/ui/kit';
import { LongText } from '../fields';
import { ScopeBar, Sheet } from '../ui';
import { FocusSheet, type Focus } from '../details';
import { AdminTopBar, EmptyCard, PageGlow, SectionTitle } from '../kit';
import { periodWord } from '../insights';
import { FieldErr, FieldLabel, TrashSheet, inputCls } from '../prManage';
import { Chips, PageTitle } from '../branchFirst';
import { StickyTools } from '@/admin/kit';

/* ─────────────── model (desktop InventoryCatalog) ─────────────── */

export interface Item {
  id: number;
  name: string;
  price: number | null;
  category: string;
  rawCategory: string;
  order: number;
  source: 'legacy' | 'user';
  recorded?: { name: string; price: number | null };
  edited: boolean;
  note?: string;
  recordedAs?: string;
  owner?: boolean;
}
export interface Group {
  key: string;
  label: string;
  raw: string[];
  items: Item[];
  priced: number;
  noPrice: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  notes: number;
  edited: number;
  added: number;
}
type Activity = Map<number, { count: number; revenue: number }>;

export function buildItems(inv: InventoryChanges): Item[] {
  const legacy = CATALOGUE_INVENTORY.map<Item>((i) => {
    const e = inv.edits[i.id];
    const name = e?.name ?? i.name;
    const price = e && 'price' in e && e.price !== undefined ? e.price : i.price;
    const edited = !!e && (name !== i.name || price !== i.price);
    const rawCategory = i.recordedName || i.origin === 'owner' || ITEM_REASSIGN[i.id] ? i.catalogueCategory : i.category;
    return { id: i.id, name, price, category: i.catalogueCategory, rawCategory, order: i.order, source: 'legacy', recorded: edited ? { name: i.name, price: i.price } : undefined, edited, note: INVENTORY_NOTES[i.id], recordedAs: i.recordedName, owner: i.origin === 'owner' };
  });
  const added = inv.added.map<Item>((s, k) => ({ id: s.id, name: s.name, price: s.price, category: categoryKey(s.category), rawCategory: s.category, order: 100_000 + k, source: 'user', edited: false }));
  return [...legacy, ...added];
}

export function groupCategories(items: Item[], names: Record<string, string>): Group[] {
  const map = new Map<string, Item[]>();
  for (const it of items) map.set(it.category, [...(map.get(it.category) ?? []), it]);
  return [...map.entries()]
    .map(([key, list]) => {
      const prices = list.map((i) => i.price).filter((p): p is number => p !== null);
      return {
        key,
        label: names[key] || key,
        raw: [...new Set(list.map((i) => i.rawCategory))],
        items: list,
        priced: prices.length,
        noPrice: list.length - prices.length,
        min: prices.length ? Math.min(...prices) : null,
        max: prices.length ? Math.max(...prices) : null,
        avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
        notes: list.filter((i) => i.note).length,
        edited: list.filter((i) => i.edited).length,
        added: list.filter((i) => i.source === 'user').length,
      };
    })
    .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
}

const META: Record<string, { sticker: StickerKey; label: string; tint: string }> = {
  LAB: { sticker: 'testTube', label: 'Laboratory tests', tint: 'from-[#e6f8ee] to-[#cfeedd]' },
  'X-RAY': { sticker: 'bone', label: 'X-ray imaging', tint: 'from-[#eef1ff] to-[#dfe3ff]' },
  MRI: { sticker: 'brain', label: 'Magnetic resonance imaging', tint: 'from-[#f3eeff] to-[#e4dbff]' },
  SCAN: { sticker: 'heartPulse', label: 'Ultrasound scans', tint: 'from-[#e8f1ff] to-[#d6e6ff]' },
  'CT SCAN': { sticker: 'xray', label: 'Computed tomography', tint: 'from-[#eaf6ff] to-[#d4ecff]' },
  ECHO: { sticker: 'heart', label: 'Echocardiography', tint: 'from-[#ffeef2] to-[#ffdbe4]' },
  ECG: { sticker: 'heartPulse', label: 'Electrocardiogram', tint: 'from-[#ffeef2] to-[#ffdbe4]' },
  'HOLTER ECG': { sticker: 'watch', label: '24 hour heart monitoring', tint: 'from-[#fff3e2] to-[#ffe4c2]' },
  EEG: { sticker: 'brain', label: 'Electroencephalography', tint: 'from-[#f3eeff] to-[#e4dbff]' },
  PHARYNGOSCOPY: { sticker: 'microscope', label: 'Endoscopy procedures', tint: 'from-[#e6f8ee] to-[#cfeedd]' },
  'MEDICAL EXAMINATION': { sticker: 'stethoscope', label: 'Clinical examination', tint: 'from-[#e8f1ff] to-[#d6e6ff]' },
  CARDIOLOGY: { sticker: 'heart', label: 'Cardiology consultation', tint: 'from-[#ffeef2] to-[#ffdbe4]' },
  DNA: { sticker: 'dna', label: 'DNA paternity testing', tint: 'from-[#f3eeff] to-[#e4dbff]' },
};
export const meta = (key: string) => META[key] ?? { sticker: 'clipboard' as StickerKey, label: 'Added category', tint: 'from-[#f4f8fe] to-[#e3ebf7]' };
const money = (n: number | null, compact = false) => (n === null ? 'No price' : formatMoney(n, 'NGN', compact));
const rangeText = (g: Pick<Group, 'min' | 'max'>) => (g.min === null ? 'No price on file' : g.min === g.max ? money(g.min, true) : `${money(g.min, true)} to ${money(g.max, true)}`);
const MAIN_MIN = 3;
type Smart = 'noprice' | 'review' | 'edited' | 'added';
const SMART: Record<Smart, { label: string; test: (i: Item) => boolean; note: string }> = {
  noprice: { label: 'No price', test: (i) => i.price === null, note: 'Services with no price on file. They cannot be billed until a price is set.' },
  review: { label: 'Needs review', test: (i) => !!i.note, note: 'Flagged when the legacy catalogue was imported.' },
  edited: { label: 'Edited', test: (i) => i.edited, note: 'Changed in STANLEY. The recorded values are kept and can be restored.' },
  added: { label: 'Added in STANLEY', test: (i) => i.source === 'user', note: 'New services, stored separately from the legacy catalogue.' },
};

function useCatalogue() {
  const { inventory, context, period } = useCompany();
  const items = useMemo(() => buildItems(inventory), [inventory]);
  const groups = useMemo(() => groupCategories(items, inventory.categoryNames), [items, inventory.categoryNames]);
  const ids = useMemo(() => (context === 'all' ? resolveBranchIds('all') : [context]), [context]);
  const range = resolveRange(period);
  const activity = useMemo(() => {
    const map: Activity = new Map();
    for (const s of serviceRanking(ids, range)) if (s.count) map.set(s.id, { count: s.count, revenue: s.revenue.NGN ?? 0 });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), range.from.getTime(), range.to.getTime()]);
  return { items, groups, ids, activity, period, inventory };
}

/* ─────────────── page ─────────────── */

export function InventoryPage() {
  const { items, groups, ids, activity, period } = useCatalogue();
  const { context } = useCompany();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'size' | 'name' | 'performed' | 'price'>('size');
  const [cat, setCat] = useState<string | null>(null);
  const [smart, setSmart] = useState<Smart | null>(null);
  const [svc, setSvc] = useState<number | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const when = periodWord(period);
  const scopeText = context === 'all' ? 'All branches' : `${getBranch(context)?.name ?? ''} branch`;
  const prices = items.map((i) => i.price).filter((p): p is number => p !== null);
  const performed = (g: Group) => g.items.reduce((s, i) => s + (activity.get(i.id)?.count ?? 0), 0);
  const billed = (g: Group) => g.items.reduce((s, i) => s + (activity.get(i.id)?.revenue ?? 0), 0);
  const top = [...items].sort((a, b) => (activity.get(b.id)?.count ?? 0) - (activity.get(a.id)?.count ?? 0))[0];
  const sorted = [...groups].sort((a, b) => (sort === 'name' ? a.label.localeCompare(b.label) : sort === 'performed' ? performed(b) - performed(a) : sort === 'price' ? (b.max ?? 0) - (a.max ?? 0) : b.items.length - a.items.length || a.key.localeCompare(b.key)));
  const main = sorted.filter((g) => g.items.length >= MAIN_MIN);
  const special = sorted.filter((g) => g.items.length < MAIN_MIN);
  const t = q.trim().toLowerCase();
  const hits = t ? items.filter((i) => `${i.name} ${i.category} ${i.id}`.toLowerCase().includes(t)).slice(0, 40) : [];

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar title={undefined} />
      <div className="relative">
        <PageTitle
          title="Inventory"
          sub={`Service catalogue · ${scopeText}`}
          action={
            <button type="button" onClick={() => setAdding('')} aria-label="Add service" className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand-600 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
              <Plus size={18} /> Add
            </button>
          }
        />
        <ScopeBar />

        {/* Hero */}
        <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#0c7f86] via-[#139aa0] to-[#4cc5bd] p-5 text-white shadow-[0_14px_34px_rgba(12,127,134,0.25)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative max-w-[64%]">
            <p className="text-[13px] font-medium text-white/90">Diagnostic services</p>
            <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.02em]">{formatCount(items.length)}</p>
            <p className="mt-2 text-[12.5px] leading-snug text-white/90">
              {formatCount(groups.length)} categories · {formatCount(prices.length)} billable · prices {prices.length ? `${money(Math.min(...prices), true)} to ${money(Math.max(...prices), true)}` : 'not on file'}
            </p>
            {top && activity.get(top.id) && (
              <button type="button" onClick={() => setSvc(top.id)} className="press relative z-10 mt-3.5 inline-flex min-h-9 max-w-full items-center gap-1 rounded-xl bg-white px-3 text-[13px] font-semibold text-[#0c6b71] shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                <span className="truncate">
                  Most done {when}: {top.name}
                </span>
                <ChevronRight size={15} className="shrink-0" />
              </button>
            )}
          </div>
          <Sticker name="microscope" size={112} className="absolute right-1 top-3" />
        </div>

        {/* Quick lists */}
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
          {(Object.keys(SMART) as Smart[]).map((k) => {
            const n = items.filter(SMART[k].test).length;
            return (
              <button key={k} type="button" disabled={!n} onClick={() => setSmart(k)} className="press flex shrink-0 items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-left ring-1 ring-line disabled:opacity-50">
                {k === 'noprice' ? <Tag size={17} className="text-orange" /> : k === 'review' ? <CircleAlert size={17} className="text-[#d93036]" /> : k === 'edited' ? <Pencil size={16} className="text-brand-600" /> : <Plus size={17} className="text-good" />}
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink">{SMART[k].label}</span>
                  <span className="block text-[11.5px] text-muted">{formatCount(n)} services</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Search (sticks under the header) */}
        <StickyTools className="mt-2">
        <div className="relative mb-2">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every service, category or ID" aria-label="Search services" className="min-h-12 w-full rounded-full bg-white pl-11 pr-11 text-[15px] text-ink shadow-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted">
              <X size={18} />
            </button>
          )}
        </div>
        </StickyTools>

        {t ? (
          <>
            <SectionTitle title={`${formatCount(hits.length)} service${hits.length === 1 ? '' : 's'} match`} />
            {hits.length ? (
              <ul className="space-y-2">
                {hits.map((i) => (
                  <li key={i.id}>
                    <ServiceLine i={i} act={activity.get(i.id)} label={groups.find((g) => g.key === i.category)?.label ?? i.category} onClick={() => setSvc(i.id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyCard sticker="microscope" text={`No service matches “${q}”.`} />
            )}
          </>
        ) : (
          <>
            <SectionTitle title="Main categories" />
            <Chips
              label="Sort categories"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'size', label: 'Most services' },
                { value: 'performed', label: `Most done ${when}` },
                { value: 'price', label: 'Highest price' },
                { value: 'name', label: 'Name A to Z' },
              ]}
            />
            <div className="grid grid-cols-2 gap-2.5">
              {main.map((g) => {
                const m = meta(g.key);
                const n = performed(g);
                return (
                  <button key={g.key} type="button" onClick={() => setCat(g.key)} className={`press relative flex min-h-[176px] min-w-0 flex-col items-start overflow-hidden rounded-[22px] bg-linear-to-br p-3.5 text-left ring-1 ring-white ${m.tint}`}>
                    <Sticker name={m.sticker} size={46} />
                    <span className="mt-2 w-full truncate text-[15.5px] font-bold text-ink">{g.label}</span>
                    <span className="w-full truncate text-[11.5px] text-ink-2">{g.label === g.key ? m.label : g.key}</span>
                    <span className="mt-auto pt-2 text-[22px] font-bold leading-none text-ink">{formatCount(g.items.length)}</span>
                    <span className="text-[11.5px] text-ink-2">services · {rangeText(g)}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {n > 0 && <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink">{`×${formatCount(n)} ${when}`}</span>}
                      {g.noPrice > 0 && <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10.5px] font-semibold text-warn-ink">{g.noPrice} no price</span>}
                      {g.edited + g.added > 0 && <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-700">{g.edited + g.added} changed</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {special.length > 0 && (
              <>
                <SectionTitle title="Specialist procedures" />
                <div className="space-y-2">
                  {special.map((g) => {
                    const m = meta(g.key);
                    const n = performed(g);
                    return (
                      <button key={g.key} type="button" onClick={() => setCat(g.key)} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-linear-to-br ${m.tint}`}>
                          <Sticker name={m.sticker} size={30} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold text-ink">{g.label}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {formatCount(g.items.length)} service{g.items.length === 1 ? '' : 's'} · {rangeText(g)}
                            {n ? ` · ×${formatCount(n)} ${when}` : ''}
                          </span>
                        </span>
                        {billed(g) > 0 && <b className="shrink-0 text-[13.5px] text-ink">{money(billed(g), true)}</b>}
                        <ChevronRight size={16} className="shrink-0 text-faint" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        <p className="mt-6 text-[12px] leading-relaxed text-muted">Prices are in NGN, as in the legacy catalogue, which is read only. Renames, edits and added services are kept separately and the recorded values stay visible. They last for this session until the database is connected.</p>
      </div>

      {cat && <CategorySheet gkey={cat} ids={ids} onClose={() => setCat(null)} onAdd={(k) => setAdding(k)} />}
      {smart && <SmartSheet smart={smart} ids={ids} onClose={() => setSmart(null)} />}
      {svc != null && <ServiceSheet id={svc} ids={ids} onClose={() => setSvc(null)} />}
      {adding !== null && <AddServiceSheet category={adding} onClose={() => setAdding(null)} onAdded={(id) => setSvc(id)} />}
    </div>
  );
}

function ServiceLine({ i, act, label, onClick }: { i: Item; act?: { count: number; revenue: number }; label?: string; onClick: () => void }) {
  const m = meta(i.category);
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-start gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-linear-to-br ${m.tint}`}>
        <Sticker name={m.sticker} size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-[14.5px] font-semibold leading-snug text-ink">{i.name}</span>
          <span className={`shrink-0 text-[14.5px] font-bold ${i.price === null ? 'text-warn-ink' : 'text-ink'}`}>{money(i.price)}</span>
        </span>
        <span className="block truncate text-[12px] text-muted">
          {label ?? i.category} · #{i.id}
          {act ? ` · ×${formatCount(act.count)} · ${money(act.revenue, true)} billed` : ''}
        </span>
        {(i.edited || i.source === 'user' || i.note || i.owner) && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {i.edited && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Edited</span>}
            {i.source === 'user' && <span className="rounded-full bg-tint-green px-2 py-0.5 text-[11px] font-semibold text-good-ink">Added in STANLEY</span>}
            {i.owner && <span className="rounded-full bg-tint-purple px-2 py-0.5 text-[11px] font-semibold text-violet">Added by the owner</span>}
            {i.note && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[11px] font-semibold text-[#b42318]">Needs review</span>}
          </span>
        )}
      </span>
      <ChevronRight size={16} className="mt-3 shrink-0 text-faint" />
    </button>
  );
}

/* ─────────────── a category ─────────────── */

const BANDS = [
  { id: 'u10', label: 'Under ₦10K', test: (p: number) => p < 10_000 },
  { id: '10', label: '₦10K to ₦50K', test: (p: number) => p >= 10_000 && p < 50_000 },
  { id: '50', label: '₦50K to ₦100K', test: (p: number) => p >= 50_000 && p < 100_000 },
  { id: '100', label: '₦100K to ₦250K', test: (p: number) => p >= 100_000 && p < 250_000 },
  { id: '250', label: '₦250K and above', test: (p: number) => p >= 250_000 },
];

function CategorySheet({ gkey, ids, onClose, onAdd }: { gkey: string; ids: string[]; onClose: () => void; onAdd: (k: string) => void }) {
  const { groups, activity, period } = useCatalogue();
  const g = groups.find((x) => x.key === gkey);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'priced' | 'noprice' | 'review' | 'edited'>('all');
  const [band, setBand] = useState('all');
  const [sort, setSort] = useState<'order' | 'performed' | 'name' | 'priceDesc' | 'priceAsc'>('order');
  const [svc, setSvc] = useState<number | null>(null);
  const [rename, setRename] = useState(false);
  const [shown, setShown] = useState(40);
  if (!g) return null;
  const m = meta(g.key);
  const t = q.trim().toLowerCase();
  const list = g.items
    .filter((i) => (show === 'all' || (show === 'priced' ? i.price !== null : show === 'noprice' ? i.price === null : show === 'review' ? !!i.note : i.edited)) && (band === 'all' || (i.price !== null && BANDS.find((b) => b.id === band)!.test(i.price))) && (!t || `${i.name} ${i.id}`.toLowerCase().includes(t)))
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'priceDesc' ? (b.price ?? -1) - (a.price ?? -1) : sort === 'priceAsc' ? (a.price ?? Infinity) - (b.price ?? Infinity) : sort === 'performed' ? (activity.get(b.id)?.count ?? 0) - (activity.get(a.id)?.count ?? 0) : a.order - b.order,
    );
  const n = g.items.reduce((s, i) => s + (activity.get(i.id)?.count ?? 0), 0);
  const rev = g.items.reduce((s, i) => s + (activity.get(i.id)?.revenue ?? 0), 0);
  return (
    <Sheet
      title={g.label}
      subtitle={`${formatCount(g.items.length)} services · ${g.key}`}
      onClose={onClose}
      tall
      search={{ value: q, onChange: setQ, placeholder: `Search ${g.label}` }}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={() => setRename(true)} className="press flex min-h-12 items-center gap-1.5 rounded-2xl bg-page px-4 text-[14.5px] font-semibold text-ink-2 ring-1 ring-line">
            <Pencil size={16} /> Rename
          </button>
          <button type="button" onClick={() => onAdd(g.key)} className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            <Plus size={18} /> Add service here
          </button>
        </div>
      }
    >
      <div className={`relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br p-4 ${m.tint}`}>
        <p className="text-[12.5px] font-medium text-ink-2">{g.label === g.key ? m.label : `Recorded as ${g.raw.join(', ')}`}</p>
        <p className="mt-0.5 text-[24px] font-bold leading-tight text-ink">{rangeText(g)}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">
          {g.avg !== null ? `Average ${money(g.avg, true)} · ` : ''}
          {formatCount(g.priced)} priced{g.noPrice ? ` · ${formatCount(g.noPrice)} without a price` : ''}
        </p>
        <p className="mt-1 max-w-[70%] text-[12px] text-ink-2/85">{n ? `Done ${formatCount(n)} times ${periodWord(period)}, ${money(rev, true)} billed.` : `Not done ${periodWord(period)}.`}</p>
        <Sticker name={m.sticker} size={84} className="absolute -bottom-1 right-1" />
      </div>
      <Chips
        label="Show"
        value={show}
        onChange={(v) => (setShow(v), setShown(40))}
        options={[
          { value: 'all', label: 'All', count: g.items.length },
          { value: 'priced', label: 'Priced', count: g.priced },
          { value: 'noprice', label: 'No price', count: g.noPrice },
          ...(g.notes ? [{ value: 'review' as const, label: 'Review', count: g.notes }] : []),
          ...(g.edited ? [{ value: 'edited' as const, label: 'Edited', count: g.edited }] : []),
        ]}
      />
      <Chips label="Price band" value={band} onChange={(v) => (setBand(v), setShown(40))} options={[{ value: 'all', label: 'Any price' }, ...BANDS.map((b) => ({ value: b.id, label: b.label, count: g.items.filter((i) => i.price !== null && b.test(i.price)).length }))]} />
      <div className="-mt-1 mb-3 flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted">{formatCount(list.length)} services</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="min-h-9 rounded-full bg-white px-3 text-[13px] font-semibold text-ink ring-1 ring-line">
          <option value="order">Catalogue order</option>
          <option value="performed">Most performed</option>
          <option value="name">Name A to Z</option>
          <option value="priceDesc">Price, high to low</option>
          <option value="priceAsc">Price, low to high</option>
        </select>
      </div>
      {list.length ? (
        <ul className="space-y-2">
          {list.slice(0, shown).map((i) => (
            <li key={i.id}>
              <ServiceLine i={i} act={activity.get(i.id)} label={g.label} onClick={() => setSvc(i.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-10 text-center text-[14px] text-muted">No services match these filters.</p>
      )}
      {shown < list.length && (
        <button type="button" onClick={() => setShown((x) => x + 40)} className="press mx-auto mt-3 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({formatCount(list.length - shown)} more)
        </button>
      )}
      {svc != null && <ServiceSheet id={svc} ids={ids} onClose={() => setSvc(null)} />}
      {rename && <RenameSheet g={g} onClose={() => setRename(false)} />}
    </Sheet>
  );
}

function SmartSheet({ smart, ids, onClose }: { smart: Smart; ids: string[]; onClose: () => void }) {
  const { items, groups, activity } = useCatalogue();
  const [q, setQ] = useState('');
  const [svc, setSvc] = useState<number | null>(null);
  const t = q.trim().toLowerCase();
  const list = items.filter((i) => SMART[smart].test(i) && (!t || `${i.name} ${i.category} ${i.id}`.toLowerCase().includes(t)));
  return (
    <Sheet title={SMART[smart].label} subtitle={`${formatCount(items.filter(SMART[smart].test).length)} services`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Search these services' }}>
      <p className="mb-3 rounded-2xl bg-page px-3.5 py-2.5 text-[13px] text-ink-2">{SMART[smart].note}</p>
      {list.length ? (
        <ul className="space-y-2">
          {list.slice(0, 80).map((i) => (
            <li key={i.id}>
              <ServiceLine i={i} act={activity.get(i.id)} label={groups.find((g) => g.key === i.category)?.label} onClick={() => setSvc(i.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-10 text-center text-[14px] text-muted">Nothing here.</p>
      )}
      {svc != null && <ServiceSheet id={svc} ids={ids} onClose={() => setSvc(null)} />}
    </Sheet>
  );
}

/* ─────────────── a service ─────────────── */

function ServiceSheet({ id, ids, onClose }: { id: number; ids: string[]; onClose: () => void }) {
  const { items, groups, activity, period } = useCatalogue();
  const { revertService, moveServiceToTrash } = useCompany();
  const { showToast } = useNav();
  const [edit, setEdit] = useState(false);
  const [trash, setTrash] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const i = items.find((x) => x.id === id);
  if (!i) return null;
  const g = groups.find((x) => x.key === i.category);
  const m = meta(i.category);
  const act = activity.get(i.id);
  const guide = guideFor(i.name, i.category);
  return (
    <Sheet
      back
      title={i.name}
      subtitle={`${g?.label ?? i.category} · #${i.id}`}
      onClose={onClose}
      tall
      footer={
        <div className="flex gap-2">
          {i.source === 'user' && (
            <button type="button" onClick={() => setTrash(true)} aria-label="Move to trash" className="press grid min-h-12 w-12 place-items-center rounded-2xl bg-[#fdecec] text-[#b42318]">
              <Trash2 size={19} />
            </button>
          )}
          <button type="button" onClick={() => setEdit(true)} className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            <Pencil size={17} /> Edit name or price
          </button>
        </div>
      }
    >
      <div className={`relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br p-4 ${m.tint}`}>
        <p className="text-[12.5px] font-medium text-ink-2">Price</p>
        <p className={`mt-0.5 text-[28px] font-bold leading-tight ${i.price === null ? 'text-warn-ink' : 'text-ink'}`}>{i.price === null ? 'No price on file' : money(i.price)}</p>
        <p className="mt-0.5 max-w-[68%] text-[12.5px] text-ink-2">{act ? `Done ${formatCount(act.count)} times ${periodWord(period)} · ${money(act.revenue, true)} billed` : `Not done ${periodWord(period)}`}</p>
        <span className="mt-2 flex max-w-[68%] flex-wrap gap-1.5">
          {i.edited && <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Edited</span>}
          {i.source === 'user' && <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-good-ink">Added in STANLEY</span>}
          {i.owner && <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-violet">Added by the owner</span>}
        </span>
        <Sticker name={m.sticker} size={88} className="absolute -bottom-1 right-1" />
      </div>

      <button type="button" onClick={() => setFocus({ kind: 'service', id: i.id, name: i.name })} className="press mb-3 flex w-full items-center gap-3 rounded-[18px] bg-white p-3.5 text-left ring-1 ring-line/70">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Users size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">Patients who did this test</span>
          <span className="block text-[12px] text-muted">With their visit records, for any dates</span>
        </span>
        <ChevronRight size={17} className="text-faint" />
      </button>

      {i.recorded && (
        <div className="mb-3 flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3 text-[13px] text-brand-800">
          <RotateCcw size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Recorded in the legacy system as <b>{i.recorded.name}</b> at <b>{money(i.recorded.price)}</b>. Your change is kept separately.
            <button
              type="button"
              onClick={() => {
                revertService(i.id);
                showToast(`${i.recorded?.name ?? i.name} restored to its recorded values`);
              }}
              className="press mt-1.5 block font-semibold text-brand-700 underline"
            >
              Restore recorded values
            </button>
          </span>
        </div>
      )}
      {i.recordedAs && <p className="mb-3 rounded-2xl bg-page px-3.5 py-2.5 text-[12.5px] text-ink-2">Recorded in the legacy export as {i.recordedAs}.</p>}
      {i.note && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-[#fdecec] px-3.5 py-2.5 text-[12.5px] text-[#9b1c1c]">
          <CircleAlert size={15} className="mt-0.5 shrink-0" /> {i.note}
        </p>
      )}

      <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-ink-2">
        <BookOpen size={15} /> Test guide
      </p>
      <div className="space-y-2.5 rounded-[20px] bg-white p-4 ring-1 ring-line/70 text-[13.5px] leading-relaxed text-ink">
        <GuidePart title="What it is" text={guide.about} />
        <GuidePart title="What it is used for" text={guide.usedFor} />
        <div>
          <p className="text-[12.5px] font-bold uppercase tracking-[0.04em] text-muted">How it is done</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {guide.procedure.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <GuidePart title="How to prepare" text={guide.preparation} />
        <div className="grid grid-cols-2 gap-2">
          <span className="rounded-2xl bg-page px-3 py-2">
            <span className="block text-[11.5px] text-muted">Sample or test</span>
            <b className="block text-[13.5px]">{guide.sample}</b>
          </span>
          <span className="rounded-2xl bg-page px-3 py-2">
            <span className="block text-[11.5px] text-muted">Usual time</span>
            <b className="block text-[13.5px]">{guide.duration}</b>
          </span>
        </div>
        {guide.keywords.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {guide.keywords.map((k) => (
              <span key={k} className="rounded-full bg-page px-2 py-0.5 text-[11.5px] text-ink-2">
                {k}
              </span>
            ))}
          </p>
        )}
        <p className="text-[11.5px] text-muted">General guidance written from {GUIDE_SOURCES.join(', ')}. The requesting doctor and the branch confirm the details for each patient.</p>
      </div>

      {focus && <FocusSheet focus={focus} branchIds={ids} period={period} onClose={() => setFocus(null)} />}
      {edit && <EditServiceSheet item={i} onClose={() => setEdit(false)} />}
      {trash && (
        <TrashSheet
          name={i.name}
          what="service"
          onClose={() => setTrash(false)}
          onConfirm={(reason) => {
            moveServiceToTrash(i.id, reason);
            setTrash(false);
            showToast(`${i.name} moved to Trash. Restore it there within 30 days`);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function GuidePart({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[12.5px] font-bold uppercase tracking-[0.04em] text-muted">{title}</p>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}

/* ─────────────── edit, rename, add ─────────────── */

function EditServiceSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const { editService } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price === null ? '' : String(item.price));
  const [tried, setTried] = useState(false);
  const value = price.trim() === '' ? null : Number(price.replace(/,/g, ''));
  const errs = {
    name: !name.trim() ? 'Enter the service name.' : null,
    price: value !== null && !(Number.isFinite(value) && value > 0) ? 'Enter a price greater than 0, or leave it blank.' : null,
  };
  const changed = name.trim() !== item.name || value !== item.price;
  const recorded = item.recorded ?? (item.source === 'legacy' ? { name: item.name, price: item.price } : null);
  return (
    <Sheet
      back
      title={`Edit ${item.name}`}
      subtitle={`Service #${item.id} · ${item.source === 'user' ? 'added in STANLEY' : item.owner ? 'added by the owner' : 'legacy catalogue item'}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!changed}
          onClick={() => {
            setTried(true);
            if (errs.name || errs.price) return;
            editService(item.id, { name: name.trim(), price: value });
            showToast(`${name.trim()} updated${value !== null ? ` · ${money(value)}` : ''} (this session)`);
            onClose();
          }}
          className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Save changes
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <label className="block">
          <FieldLabel label="Service name" required />
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls(tried ? errs.name : null)} />
          <FieldErr msg={tried ? errs.name : null} />
        </label>
        <label className="block">
          <FieldLabel label="Price (NGN)" />
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="No price on file" inputMode="decimal" className={inputCls(tried ? errs.price : null)} />
          <FieldErr msg={tried ? errs.price : null} />
        </label>
        <p className="rounded-2xl bg-page px-3.5 py-2.5 text-[13px] text-ink-2">Category: {item.category}</p>
        {recorded && item.source === 'legacy' && !item.owner && (
          <p className="rounded-2xl bg-brand-50 p-3 text-[12.5px] text-brand-800">
            Recorded in the legacy system as <b>{recorded.name}</b> at <b>{money(recorded.price)}</b>. The legacy record is never overwritten: your change is kept separately and can be restored at any time.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function RenameSheet({ g, onClose }: { g: Group; onClose: () => void }) {
  const { renameCategory } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState(g.label);
  return (
    <Sheet
      back
      title={`Rename ${g.label}`}
      subtitle={`${g.items.length} services · category code ${g.key}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {g.label !== g.key && (
            <button
              type="button"
              onClick={() => {
                renameCategory(g.key, '');
                showToast(`Category restored to ${g.key}`);
                onClose();
              }}
              className="press min-h-12 rounded-2xl bg-page px-4 text-[14px] font-semibold text-ink-2 ring-1 ring-line"
            >
              Use recorded name
            </button>
          )}
          <button
            type="button"
            disabled={!name.trim() || name.trim() === g.label}
            onClick={() => {
              renameCategory(g.key, name);
              showToast(`${g.key} is now shown as “${name.trim()}” (this session)`);
              onClose();
            }}
            className="press min-h-12 flex-1 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            Save name
          </button>
        </div>
      }
    >
      <div className="px-1 pb-2">
        <label className="block">
          <FieldLabel label="Display name" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={g.key} className={inputCls()} />
        </label>
        <p className="mt-2 text-[12.5px] text-muted">This changes how the category appears in STANLEY. The recorded category ({g.raw.join(', ')}) stays unchanged on every service.</p>
      </div>
    </Sheet>
  );
}

function AddServiceSheet({ category: initial, onClose, onAdded }: { category: string; onClose: () => void; onAdded?: (id: number) => void }) {
  const { addService, inventory } = useCompany();
  const { showToast } = useNav();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(initial);
  const [catQ, setCatQ] = useState('');
  const [price, setPrice] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [sample, setSample] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const value = Number(price.replace(/,/g, ''));
  const validPrice = Number.isFinite(value) && value > 0;
  const options = [
    ...CATALOGUE_CATEGORIES.map((c) => ({ key: c.key, label: inventory.categoryNames[c.key] || c.key, sub: `${c.itemCount} item${c.itemCount === 1 ? '' : 's'}` })),
    ...[...new Set(inventory.added.map((s) => s.category))].filter((k) => !CATALOGUE_CATEGORIES.some((c) => c.key === k)).map((k) => ({ key: k, label: k, sub: 'Added in STANLEY' })),
  ];
  const ct = catQ.trim().toUpperCase();
  const shownCats = options.filter((o) => !ct || o.key.includes(ct) || o.label.toUpperCase().includes(ct));
  const errs = { name: !name.trim() ? 'Enter the service name.' : null, category: !category.trim() ? 'Choose a category.' : null, price: !validPrice ? 'Enter a price greater than 0.' : null };
  return (
    <Sheet
      title={name.trim() ? `Add ${name.trim()}` : 'Add a diagnostic service'}
      subtitle="A billable service, stored separately from the legacy catalogue"
      onClose={onClose}
      tall
      footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (Object.values(errs).some(Boolean)) return;
            const rec = addService({ name: name.trim(), category: category.trim().toUpperCase(), price: value, turnaround: turnaround.trim() || undefined, sample: sample.trim() || undefined, notes: notes.trim() || undefined });
            showToast(`${rec.name} added to ${rec.category} at ${formatMoney(rec.price, 'NGN')} (this session)`);
            onAdded?.(rec.id);
            onClose();
          }}
          className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          Add service
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <div className="flex items-center gap-3 rounded-[20px] bg-linear-to-br from-[#e6f8ee] to-[#cfeedd] p-3.5">
          <Sticker name={meta(category.toUpperCase()).sticker} size={44} />
          <div className="min-w-0 text-[13px] text-ink-2">
            <p>
              Service ID <b className="text-ink">#{nextServiceId(inventory.added)}</b> · {category ? category.toUpperCase() : 'no category yet'}
            </p>
            <p>{validPrice ? formatMoney(value, 'NGN') : 'Price not set'} · prices are in NGN</p>
          </div>
        </div>
        <label className="block">
          <FieldLabel label="Service name" required />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="For example Vitamin D (25 OH)" className={inputCls(tried ? errs.name : null)} />
          <FieldErr msg={tried ? errs.name : null} />
        </label>
        <div>
          <FieldLabel label={`Category · ${category ? category.toUpperCase() : 'not chosen'}`} required />
          <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Search or type a new category" aria-label="Search categories" className={inputCls(tried ? errs.category : null)} />
          <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-page p-1">
            {ct && !options.some((o) => o.key === ct) && (
              <button type="button" onClick={() => (setCategory(ct), setCatQ(''))} className="press flex w-full items-center gap-1.5 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold text-brand-600">
                <Plus size={15} /> Use new category “{ct}”
              </button>
            )}
            {shownCats.map((o) => (
              <button key={o.key} type="button" onClick={() => (setCategory(o.key), setCatQ(''))} className={`press flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left ${category.toUpperCase() === o.key ? 'bg-white shadow-sm' : ''}`}>
                <span className={`text-[14px] ${category.toUpperCase() === o.key ? 'font-semibold text-brand-700' : 'text-ink'}`}>{o.label}</span>
                <span className="text-[12px] text-muted">{o.sub}</span>
              </button>
            ))}
          </div>
          <FieldErr msg={tried ? errs.category : null} />
        </div>
        <label className="block">
          <FieldLabel label="Price (NGN)" required />
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="For example 25,000" inputMode="decimal" className={inputCls(tried ? errs.price : null)} />
          <FieldErr msg={tried ? errs.price : null} />
        </label>
        <label className="block">
          <FieldLabel label="Turnaround" optional />
          <input value={turnaround} onChange={(e) => setTurnaround(e.target.value)} placeholder="For example same day, 48 hours" className={inputCls()} />
        </label>
        <label className="block">
          <FieldLabel label="Sample" optional />
          <input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="For example blood (serum)" className={inputCls()} />
        </label>
        <LongText label="Notes" optional value={notes} onChange={setNotes} max={400} placeholder={"For example: patient should fast for 8 hours.\nKeep the sample cold."} hint="Preparation or handling notes for staff." />
        <p className="text-[12px] text-muted">New services are kept for this session until the database is connected.</p>
      </div>
    </Sheet>
  );
}
