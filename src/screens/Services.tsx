/**
 * Service Catalogue (owner, 2026-11-23) — like the dashboard's inventory:
 *  • first the CATEGORIES as cards (picture, number of tests, starting price);
 *  • tap a category → its services, with "Back to categories";
 *  • the search box and category filters stay pinned under the title while the
 *    list scrolls underneath;
 *  • search by name OR by describing the test ("malaria", "kidney check",
 *    "pregnancy scan") — each result says why it matched (domain/testSearch).
 * The catalogue is the Abuja branch's real one from the desktop app.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Clock3, Droplets, Info, Layers, Lightbulb, UserPlus } from 'lucide-react';
import { PHOTOS } from '@/assets';
import { BRANCH, RULES } from '@/config/org';
import { CATEGORIES, SERVICES, categoryFrom, categoryInfo, categoryVisual, serviceById, type Service } from '@/data/services';
import { naira } from '@/domain/format';
import { SEARCH_EXAMPLES, smartSearch } from '@/domain/testSearch';
import { useApp } from '@/app/store';
import { Button, Card, Chip, EmptyState, ScreenHeader, SearchField, ServiceThumb, Sticker, Subtitle } from '@/ui/kit';

/** Price, or a clear note when the branch hasn't recorded one. */
export const priceText = (p: number | null) => (p == null ? 'Price at branch' : naira(p));

/** How many cards to draw at once — "Show more" adds the next batch (smooth on older phones). */
const PAGE = 40;

export function ServiceCatalogue() {
  const { route, navigate } = useApp();
  const [q, setQ] = useState(route.query.get('q') ?? '');
  const [cat, setCat] = useState<string>(route.query.get('cat') ?? 'All');
  const [shown, setShown] = useState(PAGE);
  const result = useMemo(() => smartSearch(q, cat), [q, cat]);
  const searching = q.trim().length > 0;
  const open = (c: string) => {
    setCat(c);
    setShown(PAGE);
    // Keep the choice in the address so "back" from a service returns here.
    navigate(`/services?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { replace: true });
  };
  const current = cat === 'All' ? null : categoryInfo(cat);

  return (
    <>
      <ScreenHeader title="Service Catalogue" />
      <Subtitle>Explore all diagnostic tests and services offered at your branch.</Subtitle>

      {/* Pinned: search + category filters stay on screen while the list scrolls under them. */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-5 mb-4 bg-page/95 px-5 pb-3 pt-1 backdrop-blur-xl md:-mx-8 md:px-8">
        <SearchField
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search or describe a test…"
          aria-label="Search for a test, or describe what the doctor is checking for"
        />
        <div className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 md:-mx-8 md:px-8">
          <Chip active={cat === 'All'} onClick={() => open('All')}>
            All categories
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} active={cat === c.key} onClick={() => open(c.key)}>
              {c.label} ({c.count})
            </Chip>
          ))}
        </div>
      </div>

      {current && !searching && (
        <button type="button" onClick={() => open('All')} className="press mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[14.5px] font-semibold text-brand-600 shadow-[0_4px_12px_rgba(30,74,160,0.06)]">
          <ArrowLeft size={18} /> Back to categories
        </button>
      )}

      {searching ? (
        <SearchResults q={q} result={result} shown={shown} more={() => setShown((n) => n + PAGE)} inCategory={current?.label} onClearCategory={() => open('All')} onExample={setQ} />
      ) : current ? (
        <>
          <CategoryBanner keyName={current.key} />
          <ServiceList list={result.hits.map((h) => h.service)} shown={shown} more={() => setShown((n) => n + PAGE)} />
        </>
      ) : (
        <>
          <Examples onPick={setQ} />
          <h2 className="mb-3 text-[18px] font-bold text-ink">
            Categories <span className="text-[14px] font-medium text-muted">· {SERVICES.length} tests</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => (
              <li key={c.key}>
                <CategoryCard keyName={c.key} onOpen={() => open(c.key)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ─────────────── Categories ─────────────── */

function CategoryVisual({ keyName, className }: { keyName: string; className: string }) {
  const v = categoryVisual(keyName);
  if (v.photo) return <img src={PHOTOS[v.photo].thumb} alt="" draggable={false} className={`object-cover ${className}`} />;
  return (
    <span className={`grid place-items-center bg-linear-to-br from-tint-blue to-tint-purple ${className}`}>
      <Sticker name={v.sticker ?? 'microscope'} size={58} />
    </span>
  );
}

function CategoryCard({ keyName, onOpen }: { keyName: string; onOpen: () => void }) {
  const c = categoryInfo(keyName);
  const from = categoryFrom(keyName);
  return (
    <button type="button" onClick={onOpen} className="card press flex h-full w-full flex-col overflow-hidden text-left">
      <CategoryVisual keyName={keyName} className="h-24 w-full" />
      <span className="flex flex-1 flex-col p-3">
        <span className="text-[15.5px] font-bold leading-tight text-ink">{c.label}</span>
        <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-brand-700">
          {c.count} test{c.count === 1 ? '' : 's'}
        </span>
        {from != null && <span className="mt-1.5 text-[12.5px] text-muted">from {naira(from)}</span>}
      </span>
    </button>
  );
}

function CategoryBanner({ keyName }: { keyName: string }) {
  const c = categoryInfo(keyName);
  const from = categoryFrom(keyName);
  return (
    <div className="card mb-4 flex items-center gap-3.5 p-3">
      <CategoryVisual keyName={keyName} className="h-16 w-16 shrink-0 rounded-2xl" />
      <div className="min-w-0">
        <p className="text-[18px] font-bold text-ink">{c.label}</p>
        <p className="text-[13.5px] text-muted">
          {c.count} test{c.count === 1 ? '' : 's'}
          {from != null ? ` · from ${naira(from)}` : ''} · {BRANCH.name} branch
        </p>
      </div>
    </div>
  );
}

function Examples({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mb-5 rounded-2xl border border-[#e2d8ff] bg-tint-purple/60 p-3.5">
      <p className="mb-2 flex items-center gap-2 text-[13.5px] font-medium text-ink-2">
        <Lightbulb size={16} className="text-violet" /> Not sure of the name? Describe what the doctor is checking for:
      </p>
      <div className="flex flex-wrap gap-2">
        {SEARCH_EXAMPLES.map((x) => (
          <button key={x} type="button" onClick={() => onPick(x)} className="press rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-violet shadow-[0_2px_8px_rgba(109,61,242,0.08)]">
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Lists ─────────────── */

function ServiceRow({ s, reason }: { s: Service; reason?: string }) {
  const { navigate } = useApp();
  return (
    <button type="button" onClick={() => navigate(`/services/${s.id}`)} className="card press flex w-full items-center gap-3.5 p-3 text-left">
      <ServiceThumb service={s} className="h-[78px] w-[86px] shrink-0 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold leading-snug text-ink">{s.name}</span>
        <span className={`mt-0.5 block font-bold ${s.price == null ? 'text-[14px] text-muted' : 'text-[17px] text-brand-600'}`}>{priceText(s.price)}</span>
        {reason ? (
          <span className="mt-1 inline-block rounded-md bg-tint-purple px-2 py-0.5 text-[12px] font-medium leading-snug text-violet">{reason}</span>
        ) : (
          <span className="mt-0.5 block truncate text-[13px] text-muted">{categoryInfo(s.category).label}</span>
        )}
      </span>
      <ChevronRight size={20} className="shrink-0 text-muted" />
    </button>
  );
}

function ServiceList({ list, shown, more }: { list: Service[]; shown: number; more: () => void }) {
  return (
    <>
      <ul className="space-y-3">
        {list.slice(0, shown).map((s) => (
          <li key={s.id}>
            <ServiceRow s={s} />
          </li>
        ))}
      </ul>
      {shown < list.length && (
        <Button variant="secondary" block className="mt-4" onClick={more}>
          Show more ({list.length - shown} more)
        </Button>
      )}
    </>
  );
}

function SearchResults({ q, result, shown, more, inCategory, onClearCategory, onExample }: { q: string; result: ReturnType<typeof smartSearch>; shown: number; more: () => void; inCategory?: string; onClearCategory: () => void; onExample: (q: string) => void }) {
  if (!result.hits.length)
    return (
      <>
        <EmptyState sticker="microscope" title="No matching test" text={`Nothing matches “${q}”${inCategory ? ` in ${inCategory}` : ''}. Try the test’s name, or describe it — for example:`} />
        <div className="-mt-4 flex flex-wrap justify-center gap-2">
          {inCategory && (
            <Chip active={false} onClick={onClearCategory}>
              Search all categories
            </Chip>
          )}
          {SEARCH_EXAMPLES.map((x) => (
            <Chip key={x} active={false} onClick={() => onExample(x)}>
              {x}
            </Chip>
          ))}
        </div>
      </>
    );
  return (
    <>
      <p className="mb-1 text-[14px] text-ink-2">
        <b className="text-ink">{result.hits.length}</b> test{result.hits.length === 1 ? '' : 's'} for “{q}”{inCategory ? ` in ${inCategory}` : ''}
      </p>
      {result.topics.length > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          <Lightbulb size={14} className="text-violet" /> Understood as:
          {result.topics.map((t) => (
            <span key={t} className="rounded-md bg-tint-purple px-2 py-0.5 font-medium text-violet">
              {t}
            </span>
          ))}
        </p>
      )}
      <ul className="space-y-3">
        {result.hits.slice(0, shown).map((h) => (
          <li key={h.service.id}>
            <ServiceRow s={h.service} reason={result.topics.length > 1 ? h.reason : undefined} />
          </li>
        ))}
      </ul>
      {shown < result.hits.length && (
        <Button variant="secondary" block className="mt-4" onClick={more}>
          Show more ({result.hits.length - shown} more)
        </Button>
      )}
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">Suggestions come from the service guide — the doctor decides which tests the patient needs.</p>
    </>
  );
}

export function ServiceDetails({ id }: { id: string }) {
  const { navigate, setDraft } = useApp();
  const s = serviceById(id);
  if (!s)
    return (
      <>
        <ScreenHeader title="Service" />
        <EmptyState sticker="microscope" title="Service not found" text="It may have been removed from the catalogue." />
      </>
    );
  const cat = categoryInfo(s.category);
  const refer = () => {
    setDraft((d) => ({ ...d, serviceIds: d.serviceIds.includes(s.id) ? d.serviceIds : [...d.serviceIds, s.id] }));
    navigate('/refer');
  };
  return (
    <>
      <ScreenHeader title={cat.label} />
      <div className="mb-4 overflow-hidden rounded-[22px] shadow-[0_12px_28px_rgba(30,74,160,0.12)]">
        {s.photo ? (
          <img src={PHOTOS[s.photo].hero} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="grid aspect-[16/9] place-items-center bg-linear-to-br from-tint-blue to-tint-purple">
            <Sticker name={s.sticker ?? 'microscope'} size={128} />
          </div>
        )}
      </div>
      <p className="text-[14px] font-semibold text-brand-600">{cat.label}</p>
      <h2 className="mt-1 text-[23px] font-bold leading-tight tracking-[-0.02em] text-ink">{s.name}</h2>
      <p className={`mt-1 font-bold ${s.price == null ? 'text-[16px] text-muted' : 'text-[26px] text-brand-600'}`}>{priceText(s.price)}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.description}</p>

      <Card className="mt-5 divide-y divide-line">
        <Row icon={<Droplets size={20} className="text-brand-500" />} label="Sample / procedure" value={s.procedure} />
        <Row icon={<Clock3 size={20} className="text-orange" />} label="Preparation" value={s.preparation} />
        <Row icon={<Layers size={20} className="text-violet" />} label="Category" value={`${cat.label} · ${cat.count} service${cat.count === 1 ? '' : 's'} at the ${BRANCH.name} branch`} />
        <Row icon={<Info size={20} className="text-good" />} label="Your commission" value={s.price == null ? 'The branch hasn’t recorded a price for this service yet, so it can’t be referred in the app.' : `${naira(s.price * RULES.commissionRate)} (${Math.round(RULES.commissionRate * 100)}% of ${naira(s.price)}) — paid when the patient completes the test`} />
      </Card>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Preparation is general guidance for {cat.label.toLowerCase()} services. Final prices and instructions are confirmed at the branch.</p>

      {s.price != null && (
        <Button block className="mt-5" onClick={refer}>
          <UserPlus size={20} /> Refer a patient for this test
        </Button>
      )}
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="mt-0.5 block text-[15px] leading-relaxed text-ink">{value}</span>
      </span>
    </div>
  );
}
