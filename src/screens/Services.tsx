/**
 * Service Catalogue (owner's reference) — the Abuja branch's real catalogue
 * from the desktop app, every category and service — and a service's details.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Clock3, Droplets, Info, Layers, UserPlus } from 'lucide-react';
import { PHOTOS } from '@/assets';
import { BRANCH, RULES } from '@/config/org';
import { CATEGORIES, SERVICES, categoryInfo, searchServices, serviceById } from '@/data/services';
import { naira } from '@/domain/format';
import { useApp } from '@/app/store';
import { Button, Card, Chip, ChipRow, EmptyState, ScreenHeader, SearchField, ServiceThumb, Sticker, Subtitle } from '@/ui/kit';

/** Price, or a clear note when the branch hasn't recorded one. */
export const priceText = (p: number | null) => (p == null ? 'Price at branch' : naira(p));

/** How many cards to draw at once — more appear as the agent scrolls (smooth on older phones). */
const PAGE = 40;

export function ServiceCatalogue() {
  const { route, navigate } = useApp();
  const [q, setQ] = useState(route.query.get('q') ?? '');
  const [cat, setCat] = useState<string>(route.query.get('cat') ?? 'All');
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => searchServices(q, cat), [q, cat]);
  const pick = (c: string) => {
    setCat(c);
    setShown(PAGE);
  };

  return (
    <>
      <ScreenHeader title="Service Catalogue" />
      <Subtitle>Explore all diagnostic tests and services offered at your branch.</Subtitle>
      <SearchField
        className="mb-4"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setShown(PAGE);
        }}
        placeholder="Search for a test or service..."
        aria-label="Search for a test or service"
      />
      <ChipRow>
        <Chip active={cat === 'All'} onClick={() => pick('All')}>
          All ({SERVICES.length})
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={cat === c.key} onClick={() => pick(c.key)}>
            {c.label} ({c.count})
          </Chip>
        ))}
      </ChipRow>

      {list.length === 0 ? (
        <EmptyState sticker="microscope" title="No matching service" text={`Nothing matches “${q}”. Try another name, e.g. “MRI”, “blood count” or “scan”.`} />
      ) : (
        <>
          <p className="mb-2.5 text-[13px] text-muted">
            {list.length} service{list.length === 1 ? '' : 's'} · {BRANCH.name} branch
          </p>
          <ul className="space-y-3">
            {list.slice(0, shown).map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => navigate(`/services/${s.id}`)} className="card press flex w-full items-center gap-3.5 p-3 text-left">
                  <ServiceThumb service={s} className="h-[84px] w-[92px] shrink-0 rounded-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold leading-snug text-ink">{s.name}</span>
                    <span className={`mt-0.5 block font-bold ${s.price == null ? 'text-[14px] text-muted' : 'text-[18px] text-brand-600'}`}>{priceText(s.price)}</span>
                    <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">
                      {s.description}
                    </span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
          {shown < list.length && (
            <Button variant="secondary" block className="mt-4" onClick={() => setShown((n) => n + PAGE)}>
              Show more ({list.length - shown} more)
            </Button>
          )}
        </>
      )}
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
