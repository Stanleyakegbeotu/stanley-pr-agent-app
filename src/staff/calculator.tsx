/**
 * Price calculator (top bar, Branch Manager and Front Desk): the desktop
 * branch header's PriceCalculator for people who come in to ask prices.
 * Search any test or open a category, add tests, see the total. A price can
 * be changed for this quote only (the original stays visible; the inventory
 * price never changes). On the phone the quote is shown on screen (no print
 * or download, privacy rule); "Start a bill with these" carries the tests
 * and the enquirer's name straight into Billing.
 */
import { useMemo, useState } from 'react';
import { Calculator, Check, ChevronRight, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { addDays, isoDate } from '@company/data/demo/generator';
import { resolveRange, serviceRanking } from '@company/services/analytics';
import { frequentServices, useBilling, type SelectedService } from '@company/services/billing';
import { logAudit } from '@company/services/audit';
import { formatCount, formatMoney } from '@company/shared/format';
import { Sticker } from '@/ui/kit';
import { onlyName } from '@/ui/fieldRules';
import { Sheet } from '@/admin/ui';
import { inputCls } from '@/admin/prManage';
import { buildItems, groupCategories, meta, type Item } from '@/admin/pages/Inventory';
import { useBranchItems } from '@/admin/branchCatalogue';

interface Line {
  id: number;
  name: string;
  category: string;
  listPrice: number;
  price: number;
}

/** Hand-over to Billing: the quoted tests and who asked (read once by Billing's ?quote=1). */
export const QUOTE_KEY = 'stanley.staff.quote';
export interface QuoteHandOver {
  name: string;
  services: SelectedService[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The top bar button. */
export function CalculatorButton({ branchId }: { branchId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Price calculator" className="press relative grid h-11 w-11 place-items-center rounded-full text-ink">
        <Calculator size={24} strokeWidth={1.9} />
      </button>
      {open && <PriceCalculator branchId={branchId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PriceCalculator({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const { inventory, user, navigate } = useCompany();
  const billing = useBilling();
  const branch = getBranch(branchId)!;
  const money = (n: number) => formatMoney(n, branch.currency);
  // The branch's own price list.
  const items = useBranchItems(branchId);
  const groups = useMemo(() => groupCategories(items, inventory.categoryNames), [items, inventory.categoryNames]);
  const labelOf = (key: string) => groups.find((g) => g.key === key)?.label ?? key;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [payer, setPayer] = useState('');
  const [view, setView] = useState<'pick' | 'quote'>('pick');
  const quick = useMemo(() => {
    const recent = new Map(serviceRanking([branchId], resolveRange({ key: 'custom', from: isoDate(addDays(new Date(), -29)), to: isoDate(new Date()) })).map((r) => [r.id, r.count]));
    const byId = new Map(items.map((i) => [i.id, i]));
    return frequentServices(branchId, recent, 24)
      .map((f) => byId.get(f.id))
      .filter((i): i is NonNullable<typeof i> => !!i && i.price !== null)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, items, billing.orders]);
  const term = norm(q);
  const hits = term ? items.filter((i) => term.split(' ').every((w) => norm(`${i.name} ${i.category} ${i.id}`).includes(w))).slice(0, 60) : [];
  const group = groups.find((g) => g.key === cat) ?? null;
  const added = new Set(lines.map((l) => l.id));
  const total = lines.reduce((s, l) => s + l.price, 0);
  const listTotal = lines.reduce((s, l) => s + l.listPrice, 0);
  const changed = lines.filter((l) => l.price !== l.listPrice).length;

  const toggle = (i: Item) => {
    if (i.price === null) return;
    if (added.has(i.id)) setLines((ls) => ls.filter((l) => l.id !== i.id));
    else setLines((ls) => [...ls, { id: i.id, name: i.name, category: labelOf(i.category), listPrice: i.price!, price: i.price! }]);
  };
  const setPrice = (id: number, raw: string) => {
    const clean = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
    setDrafts((d) => ({ ...d, [id]: clean }));
    if (clean !== '') setLines((ls) => ls.map((l) => (l.id === id ? { ...l, price: Number(clean) } : l)));
  };
  const resetPrice = (id: number) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, price: l.listPrice } : l)));
    setDrafts(({ [id]: _, ...rest }) => rest);
  };
  const startBill = () => {
    const hand: QuoteHandOver = { name: payer.trim(), services: lines.map((l) => ({ id: l.id, name: l.name, category: l.category, price: l.listPrice, overridePrice: l.price !== l.listPrice ? l.price : null })) };
    sessionStorage.setItem(QUOTE_KEY, JSON.stringify(hand));
    logAudit({ category: 'Billing', action: 'Price quote turned into a bill', record: payer.trim() || 'Walk in enquiry', details: `${lines.length} test${lines.length === 1 ? '' : 's'} · ${money(total)}`, branchId });
    onClose();
    navigate(`/branch/${branchId}/billing?quote=1`);
  };

  const row = (i: Item, showCat: boolean) => {
    const on = added.has(i.id);
    return (
      <li key={i.id}>
        <button type="button" disabled={i.price === null} onClick={() => toggle(i)} aria-pressed={on} className={`press flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-55 ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-line/70'}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold leading-snug text-ink">{i.name}</span>
            <span className="block truncate text-[12px] text-muted">
              {showCat ? `${labelOf(i.category)} · ` : ''}#{i.id}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={`block text-[14px] font-bold ${i.price === null ? 'text-faint' : 'text-ink'}`}>{i.price === null ? 'No price' : money(i.price)}</span>
          </span>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${on ? 'bg-brand-600 text-white' : 'bg-page text-brand-600'}`}>{on ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.6} />}</span>
        </button>
      </li>
    );
  };

  return (
    <Sheet
      title={view === 'quote' ? 'Price quote' : 'Price calculator'}
      subtitle={view === 'quote' ? `${branch.name} branch · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Add tests to see what the patient will pay'}
      onClose={view === 'quote' ? () => setView('pick') : onClose}
      back={view === 'quote'}
      tall
      search={view === 'pick' ? { value: q, onChange: (v) => (setQ(v), v && setCat(null)), placeholder: 'Search any test, category or ID' } : undefined}
      footer={
        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <span>
              <span className="block text-[12.5px] text-muted">
                {formatCount(lines.length)} test{lines.length === 1 ? '' : 's'}
                {changed ? ` · ${changed} price${changed === 1 ? '' : 's'} changed` : ''}
              </span>
              {changed > 0 && <span className="block text-[12px] text-faint line-through">{money(listTotal)}</span>}
            </span>
            <b className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{money(total)}</b>
          </div>
          {view === 'pick' ? (
            <button type="button" disabled={!lines.length} onClick={() => setView('quote')} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)] disabled:opacity-40 disabled:shadow-none">
              See the quote <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" disabled={!lines.length} onClick={startBill} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)] disabled:opacity-40">
              <Plus size={18} /> Start a bill with these tests
            </button>
          )}
        </div>
      }
    >
      {view === 'quote' ? (
        <div className="px-1 pb-4">
          <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#1f6fe8] via-[#2f7cf0] to-[#5aa2ff] p-4 text-white shadow-[0_14px_30px_rgba(31,111,232,0.3)]">
            <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15" />
            <Sticker name="coin" size={62} className="absolute right-3 top-3" />
            <p className="text-[13px] font-semibold text-white/85">Estimated total</p>
            <p className="mt-1 text-[32px] font-extrabold leading-none">{money(total)}</p>
            <p className="mt-1.5 text-[12.5px] text-white/85">
              {formatCount(lines.length)} test{lines.length === 1 ? '' : 's'} · prepared by {user.name}
            </p>
          </div>
          <label className="mt-3 block">
            <span className="text-[13.5px] font-semibold text-ink">
              Enquirer's name <span className="font-normal text-muted">(optional)</span>
            </span>
            <input value={payer} onChange={(e) => setPayer(onlyName(e.target.value).slice(0, 60))} placeholder="Who is asking, for example Amina Bello" autoComplete="off" className={`${inputCls()} mt-1.5`} />
          </label>
          <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold text-ink-2">Tests</p>
          <ul className="space-y-2">
            {lines.map((l) => {
              const draft = drafts[l.id];
              const isEditing = editing === l.id;
              return (
                <li key={l.id} className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold leading-snug text-ink">{l.name}</span>
                      <span className="block text-[12px] text-muted">{l.category}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <b className="block text-[15px] text-ink">{money(l.price)}</b>
                      {l.price !== l.listPrice && <span className="block text-[12px] text-faint line-through">{money(l.listPrice)}</span>}
                    </span>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Remove ${l.name}`} className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#b42318]">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {isEditing ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="relative flex-1">
                        <b className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">₦</b>
                        <input autoFocus inputMode="numeric" value={draft ?? String(l.price)} onChange={(e) => setPrice(l.id, e.target.value)} aria-label={`Price for ${l.name} on this quote`} className={`${inputCls(draft === '' ? 'Enter a price' : null)} min-h-11 pl-8 font-bold`} />
                      </span>
                      <button type="button" onClick={() => setEditing(null)} className="press min-h-11 rounded-xl bg-brand-600 px-4 text-[14px] font-semibold text-white">
                        Done
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex gap-3 text-[12.5px] font-semibold">
                      <button type="button" onClick={() => setEditing(l.id)} className="press text-brand-600">
                        Change price for this quote
                      </button>
                      {l.price !== l.listPrice && (
                        <button type="button" onClick={() => resetPrice(l.id)} className="press flex items-center gap-1 text-muted">
                          <RotateCcw size={13} /> Original
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 rounded-2xl bg-page px-3.5 py-3 text-[12.5px] leading-snug text-muted">A price enquiry, not a receipt. Prices are confirmed at billing. Changed prices apply to this quote only; Inventory prices stay the same.</p>
          <button type="button" onClick={() => setView('pick')} className="press mt-3 min-h-11 w-full rounded-2xl bg-white text-[14px] font-semibold text-brand-600 ring-1 ring-line">
            Add more tests
          </button>
        </div>
      ) : (
        <div className="px-1 pb-4">
          {lines.length > 0 && (
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {lines.map((l) => (
                <span key={l.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 py-1.5 pl-3 pr-1.5 text-[12.5px] font-semibold text-brand-700 ring-1 ring-brand-100">
                  <span className="max-w-40 truncate">{l.name}</span>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Remove ${l.name}`} className="grid h-5 w-5 place-items-center rounded-full bg-white text-brand-600">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {term ? (
            <>
              <p className="mb-2 px-1 text-[13px] font-semibold text-muted">
                {formatCount(hits.length)} test{hits.length === 1 ? '' : 's'} found
              </p>
              {hits.length ? (
                <ul className="space-y-2">{hits.map((i) => row(i, true))}</ul>
              ) : (
                <div className="flex flex-col items-center rounded-[22px] bg-page px-5 py-8 text-center">
                  <Search size={26} className="text-faint" />
                  <p className="mt-2 text-[14.5px] font-semibold text-ink">No test matches “{q}”</p>
                  <p className="text-[12.5px] text-muted">Try part of the name, the category or the test ID.</p>
                </div>
              )}
            </>
          ) : group ? (
            <>
              <button type="button" onClick={() => setCat(null)} className="press mb-2 flex items-center gap-1 text-[13.5px] font-semibold text-brand-600">
                All categories
              </button>
              <div className={`mb-3 flex items-center gap-3 rounded-2xl bg-linear-to-br p-3 ${meta(group.key).tint}`}>
                <Sticker name={meta(group.key).sticker} size={44} />
                <span className="min-w-0">
                  <b className="block text-[16px] text-ink">{group.label}</b>
                  <span className="text-[12.5px] text-ink-2">
                    {formatCount(group.items.length)} tests · {meta(group.key).label}
                  </span>
                </span>
              </div>
              <ul className="space-y-2">{group.items.map((i) => row(i, false))}</ul>
            </>
          ) : (
            <>
              {quick.length > 0 && (
                <>
                  <p className="mb-2 px-1 text-[13px] font-bold text-ink-2">Most asked at this branch</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {quick.map((i) => {
                      const on = added.has(i.id);
                      return (
                        <button key={i.id} type="button" onClick={() => toggle(i)} aria-pressed={on} className={`press flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-white text-ink ring-1 ring-line'}`}>
                          {on ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                          <span className="max-w-44 truncate">{i.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <p className="mb-2 px-1 text-[13px] font-bold text-ink-2">Categories</p>
              <div className="grid grid-cols-2 gap-2.5">
                {groups.map((g) => {
                  const m = meta(g.key);
                  const n = g.items.filter((i) => added.has(i.id)).length;
                  return (
                    <button key={g.key} type="button" onClick={() => setCat(g.key)} className={`press relative overflow-hidden rounded-[20px] bg-linear-to-br p-3 text-left ring-1 ring-white ${m.tint}`}>
                      <Sticker name={m.sticker} size={40} />
                      <b className="mt-1.5 block truncate text-[14.5px] text-ink">{g.label}</b>
                      <span className="block text-[12px] text-ink-2">{formatCount(g.items.length)} tests</span>
                      {n > 0 && <span className="absolute right-2.5 top-2.5 grid h-6 min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 text-[12px] font-bold text-white">{n}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
