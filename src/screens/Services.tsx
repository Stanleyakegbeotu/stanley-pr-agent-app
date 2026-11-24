/** Service Catalogue (owner's reference) and a service's details. */
import { useState } from 'react';
import { ChevronRight, Clock3, Droplets, Info, UserPlus } from 'lucide-react';
import { PHOTOS } from '@/assets';
import { RULES } from '@/config/org';
import { CATEGORIES, searchServices, serviceById, type Category } from '@/data/services';
import { naira } from '@/domain/format';
import { useApp } from '@/app/store';
import { Button, Card, Chip, ChipRow, EmptyState, ScreenHeader, SearchField, ServiceThumb, Sticker, Subtitle } from '@/ui/kit';

export function ServiceCatalogue() {
  const { route, navigate } = useApp();
  const [q, setQ] = useState(route.query.get('q') ?? '');
  const [cat, setCat] = useState<Category | 'All'>((route.query.get('cat') as Category) || 'All');
  const list = searchServices(q, cat);

  return (
    <>
      <ScreenHeader title="Service Catalogue" />
      <Subtitle>Explore all diagnostic tests and services offered at your branch.</Subtitle>
      <SearchField className="mb-4" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a test or service..." aria-label="Search for a test or service" />
      <ChipRow>
        {(['All', ...CATEGORIES] as const).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </ChipRow>

      {list.length === 0 ? (
        <EmptyState sticker="microscope" title="No matching service" text={`Nothing matches “${q}”. Try another name, e.g. “MRI”, “blood count” or “scan”.`} />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => navigate(`/services/${s.id}`)} className="card press flex w-full items-center gap-3.5 p-3 text-left">
                <ServiceThumb service={s} className="h-[84px] w-[92px] shrink-0 rounded-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16.5px] font-bold text-ink">{s.name}</span>
                  <span className="mt-0.5 block text-[18px] font-bold text-brand-600">{naira(s.price)}</span>
                  <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{s.description}</span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
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
  const refer = () => {
    setDraft((d) => ({ ...d, serviceIds: d.serviceIds.includes(s.id) ? d.serviceIds : [...d.serviceIds, s.id] }));
    navigate('/refer');
  };
  return (
    <>
      <ScreenHeader title={s.name} />
      <div className="mb-4 overflow-hidden rounded-[22px] shadow-[0_12px_28px_rgba(30,74,160,0.12)]">
        {s.photo ? (
          <img src={PHOTOS[s.photo].hero} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="grid aspect-[16/9] place-items-center bg-linear-to-br from-tint-blue to-tint-purple">
            <Sticker name={s.sticker ?? 'microscope'} size={120} />
          </div>
        )}
      </div>
      <p className="text-[14px] font-semibold text-brand-600">{s.category}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">{s.name}</h2>
        <span className="text-[24px] font-bold text-brand-600">{naira(s.price)}</span>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.purpose}</p>

      <Card className="mt-5 divide-y divide-line">
        <Row icon={<Droplets size={20} className="text-brand-500" />} label="Sample / procedure" value={s.procedure} />
        <Row icon={<Clock3 size={20} className="text-orange" />} label="Preparation" value={s.preparation} />
        <Row icon={<Info size={20} className="text-good" />} label="Your commission" value={`${naira(s.price * RULES.commissionRate)} (${Math.round(RULES.commissionRate * 100)}% of ${naira(s.price)}) — paid when the patient completes the test`} />
      </Card>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Final prices and availability are confirmed at the branch.</p>

      <Button block className="mt-5" onClick={refer}>
        <UserPlus size={20} /> Refer a patient for this test
      </Button>
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
