/**
 * Service Catalogue (owner, 2026-11-23, redesigned) — the Abuja branch's real
 * catalogue with the service guide for every test.
 *  • Featured categories as large photo cards; specialist categories as
 *    gradient tiles with 3D icons; tap → that category, "Back to categories".
 *  • Search + category filters pinned under the title.
 *  • Search by name or by describing the test (domain/testSearch).
 *  • Each service: what it is, what it's for, how it's done, how to prepare.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Clock3, Droplets, ScanLine, Lightbulb, ListChecks, Share2, Stethoscope, Target, UserPlus, Utensils } from 'lucide-react';
import { PHOTOS } from '@/assets';
import { BRANCH } from '@/config/org';
import { CATEGORIES, GUIDE_SOURCES, SERVICES, categoryFrom, categoryInfo, categoryVisual, serviceById, type Service } from '@/data/services';
import { naira } from '@/domain/format';
import { SEARCH_EXAMPLES, smartSearch } from '@/domain/testSearch';
import { useApp } from '@/app/store';
import { Button, Chip, EmptyState, ScreenHeader, SearchField, ServiceThumb, Sticker, Subtitle } from '@/ui/kit';

/** Price, or a clear note when the branch hasn't recorded one. */
export const priceText = (p: number | null) => (p == null ? 'Price at branch' : naira(p));

const PAGE = 40;
const FEATURED = ['LAB', 'X-RAY', 'MRI', 'SCAN', 'CT SCAN'];
/** Soft gradient per specialist category (tiles). */
const TINT: Record<string, string> = {
  PHARYNGOSCOPY: 'from-[#ffe9ef] to-[#ffd6e1]',
  DNA: 'from-[#e6f0ff] to-[#f1e6ff]',
  ECHO: 'from-[#ffeaf0] to-[#ffdbe5]',
  CARDIOLOGY: 'from-[#e2f7f2] to-[#d9ecff]',
  ECG: 'from-[#ffe8e6] to-[#fff0de]',
  EEG: 'from-[#f1e9ff] to-[#e5ddff]',
  'HOLTER ECG': 'from-[#e7ebff] to-[#dde9ff]',
  'MEDICAL EXAMINATION': 'from-[#e3f4ff] to-[#e3f7ec]',
};

/** Short tags for a service row: sample, preparation, time. */
function tagsOf(s: Service): { icon: React.ReactNode; text: string; tone: string }[] {
  const out: { icon: React.ReactNode; text: string; tone: string }[] = [];
  const sample = s.sample.split(/ or |\(|,| with /)[0]!.replace(/\b(sample|samples|images?)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (sample) out.push({ icon: /blood|urine|stool|swab|semen|sputum|fluid|cells|tissue|breath|drop/i.test(s.sample) ? <Droplets size={12} /> : <ScanLine size={12} />, text: sample, tone: 'bg-brand-50 text-brand-700' });
  const p = s.preparation.toLowerCase();
  if (/\bfast(ing)?\b|no food/.test(p)) out.push({ icon: <Utensils size={12} />, text: 'Fasting', tone: 'bg-[#fff1e0] text-[#b45309]' });
  else if (p.includes('full bladder')) out.push({ icon: <Droplets size={12} />, text: 'Full bladder', tone: 'bg-[#e6f6ff] text-[#0369a1]' });
  const d = s.duration.match(/about (\d+(?: to \d+)? (?:minutes|hours))/i);
  if (d) out.push({ icon: <Clock3 size={12} />, text: d[1]!.replace('minutes', 'min').replace('hours', 'h'), tone: 'bg-[#f1f4f9] text-ink-2' });
  return out;
}

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
    navigate(`/services?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { replace: true });
  };
  const current = cat === 'All' ? null : categoryInfo(cat);
  const linkCat = route.query.get('cat') ?? 'All';
  const linkQ = route.query.get('q') ?? '';
  useEffect(() => {
    setCat(linkCat);
    setShown(PAGE);
  }, [linkCat]);
  useEffect(() => {
    if (linkQ) setQ(linkQ);
  }, [linkQ]);
  const chipRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chipRow.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [cat]);

  return (
    <>
      <ScreenHeader title="Service Catalogue" />
      <Subtitle>Explore all diagnostic tests and services offered at your branch.</Subtitle>

      <div className="sticky top-[calc(4rem+var(--safe-top))] z-20 -mx-5 mb-4 bg-page px-5 pb-3 pt-1 md:-mx-8 md:px-8">
        <SearchField
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search or describe a test…"
          aria-label="Search for a test, or describe what the doctor is checking for"
        />
        <div ref={chipRow} className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 md:-mx-8 md:px-8">
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
        <button type="button" onClick={() => open('All')} className="press mb-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(11,23,48,0.18)]">
          <ArrowLeft size={17} /> Back to categories
        </button>
      )}

      {searching ? (
        <SearchResults q={q} result={result} shown={shown} more={() => setShown((n) => n + PAGE)} inCategory={current?.label} onClearCategory={() => open('All')} onExample={setQ} />
      ) : current ? (
        <>
          <CategoryHeader keyName={current.key} />
          <ServiceList list={result.hits.map((h) => h.service)} shown={shown} more={() => setShown((n) => n + PAGE)} />
        </>
      ) : (
        <CategoryHome onOpen={open} onExample={setQ} />
      )}
    </>
  );
}

/* ─────────────── Category home ─────────────── */

export function CategoryHome({ onOpen, onExample }: { onOpen: (k: string) => void; onExample: (q: string) => void }) {
  const featured = FEATURED.map((k) => CATEGORIES.find((c) => c.key === k)).filter(Boolean) as typeof CATEGORIES;
  const specialist = CATEGORIES.filter((c) => !FEATURED.includes(c.key));
  const [hero, ...rest] = featured;
  return (
    <>
      <div className="mb-6 flex items-start gap-3 rounded-[20px] bg-linear-to-br from-[#f3edff] to-[#eaf2ff] p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-violet shadow-[0_4px_12px_rgba(109,61,242,0.15)]">
          <Lightbulb size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-ink">Search help: you choose the tests</p>
          <p className="text-[13px] text-ink-2">Describe what the doctor is checking for:</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SEARCH_EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => onExample(x)} className="press rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-violet shadow-[0_2px_8px_rgba(109,61,242,0.1)]">
                {x}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionLabel title="Main categories" note={`${SERVICES.length} tests in ${CATEGORIES.length} categories`} />
      {hero && <PhotoCard keyName={hero.key} big onOpen={() => onOpen(hero.key)} />}
      <div className="mb-7 mt-3 grid grid-cols-2 gap-3">
        {rest.map((c) => (
          <PhotoCard key={c.key} keyName={c.key} onOpen={() => onOpen(c.key)} />
        ))}
      </div>

      <SectionLabel title="Specialist services" note="Heart, brain, DNA & procedures" />
      <div className="grid grid-cols-2 gap-3">
        {specialist.map((c) => (
          <SpecialistTile key={c.key} keyName={c.key} onOpen={() => onOpen(c.key)} />
        ))}
      </div>
    </>
  );
}

function SectionLabel({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
      <p className="text-[12.5px] text-muted">{note}</p>
    </div>
  );
}

/** Full-bleed photo card with a soft dark fade, white title and glass details. */
function PhotoCard({ keyName, big, onOpen }: { keyName: string; big?: boolean; onOpen: () => void }) {
  const c = categoryInfo(keyName);
  const v = categoryVisual(keyName);
  const from = categoryFrom(keyName);
  return (
    <button type="button" onClick={onOpen} className={`press group relative block w-full overflow-hidden rounded-[24px] text-left shadow-[0_14px_30px_rgba(11,23,48,0.16)] ${big ? 'h-[188px]' : 'h-[158px]'}`}>
      {v.photo ? <img src={PHOTOS[v.photo].hero} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <span className="absolute inset-0 bg-linear-to-br from-brand-500 to-brand-800" />}
      <span className="absolute inset-0 bg-linear-to-t from-[#06122b]/85 via-[#06122b]/30 to-transparent" />
      <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
        {c.count} test{c.count === 1 ? '' : 's'}
      </span>
      <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-md">
        <ArrowUpRight size={18} />
      </span>
      <span className="absolute inset-x-4 bottom-3.5">
        <span className={`block font-bold leading-tight tracking-[-0.01em] text-white ${big ? 'text-[24px]' : 'text-[18px]'}`}>{c.label}</span>
        <span className="mt-0.5 block text-[12.5px] text-white/85">
          {from != null ? `from ${naira(from)}` : ''}
        </span>
      </span>
    </button>
  );
}

function SpecialistTile({ keyName, onOpen }: { keyName: string; onOpen: () => void }) {
  const c = categoryInfo(keyName);
  const v = categoryVisual(keyName);
  const from = categoryFrom(keyName);
  return (
    <button type="button" onClick={onOpen} className={`press relative flex h-[118px] w-full flex-col overflow-hidden rounded-[22px] border border-white/70 bg-linear-to-br p-3.5 text-left shadow-[0_8px_20px_rgba(30,74,160,0.08)] ${TINT[keyName] ?? 'from-tint-blue to-tint-purple'}`}>
      <Sticker name={v.sticker ?? 'microscope'} size={66} className="absolute -bottom-2 -right-2 rotate-[-8deg]" />
      <span className="relative block max-w-[72%] text-[15.5px] font-bold leading-tight text-ink">{c.label}</span>
      <span className="relative mt-1 block text-[12.5px] font-medium text-ink-2">
        {c.count} test{c.count === 1 ? '' : 's'}
      </span>
      {from != null && <span className="relative mt-auto text-[12.5px] font-semibold text-brand-700">from {naira(from)}</span>}
    </button>
  );
}

export function CategoryHeader({ keyName }: { keyName: string }) {
  const c = categoryInfo(keyName);
  const v = categoryVisual(keyName);
  const from = categoryFrom(keyName);
  return (
    <div className="relative mb-5 h-[120px] overflow-hidden rounded-[24px] shadow-[0_12px_26px_rgba(11,23,48,0.14)]">
      {v.photo ? <img src={PHOTOS[v.photo].hero} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className={`absolute inset-0 bg-linear-to-br ${TINT[keyName] ?? 'from-tint-blue to-tint-purple'}`} />}
      {v.photo && <span className="absolute inset-0 bg-linear-to-r from-[#06122b]/85 via-[#06122b]/45 to-transparent" />}
      {!v.photo && <Sticker name={v.sticker ?? 'microscope'} size={96} className="absolute -bottom-3 right-2" />}
      <div className="absolute inset-y-0 left-4 flex flex-col justify-center">
        <p className={`text-[22px] font-bold ${v.photo ? 'text-white' : 'text-ink'}`}>{c.label}</p>
        <p className={`text-[13px] ${v.photo ? 'text-white/85' : 'text-ink-2'}`}>
          {c.count} test{c.count === 1 ? '' : 's'}
          {from != null ? ` · from ${naira(from)}` : ''} · {BRANCH.name}
        </p>
      </div>
    </div>
  );
}

/* ─────────────── Service rows ─────────────── */

function ServiceRow({ s, reason }: { s: Service; reason?: string }) {
  const { navigate } = useApp();
  return (
    <button type="button" onClick={() => navigate(`/services/${s.id}`)} className="press flex w-full items-start gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
      <ServiceThumb service={s} className="h-[64px] w-[64px] shrink-0 rounded-[16px]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{s.name}</span>
          <span className={`shrink-0 whitespace-nowrap font-bold ${s.price == null ? 'text-[12.5px] text-muted' : 'text-[15px] text-brand-600'}`}>{priceText(s.price)}</span>
        </span>
        <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{s.about}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {reason ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-tint-purple px-2 py-0.5 text-[11.5px] font-medium text-violet">
              <Lightbulb size={11} /> {reason}
            </span>
          ) : (
            tagsOf(s).map((t) => (
              <span key={t.text} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${t.tone}`}>
                {t.icon} {t.text}
              </span>
            ))
          )}
        </span>
      </span>
    </button>
  );
}

function ServiceList({ list, shown, more }: { list: Service[]; shown: number; more: () => void }) {
  return (
    <>
      <ul className="space-y-2.5">
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
        <EmptyState sticker="microscope" title="No matching test" text={`Nothing matches “${q}”${inCategory ? ` in ${inCategory}` : ''}. Try the test’s name, or describe it, for example:`} />
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
      <ul className="space-y-2.5">
        {result.hits.slice(0, shown).map((h) => (
          <li key={h.service.id}>
            <ServiceRow s={h.service} reason={h.reason} />
          </li>
        ))}
      </ul>
      {shown < result.hits.length && (
        <Button variant="secondary" block className="mt-4" onClick={more}>
          Show more ({result.hits.length - shown} more)
        </Button>
      )}
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">Suggestions come from the service guide. The doctor decides which tests the patient needs.</p>
    </>
  );
}

/* ─────────────── Service details ─────────────── */

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
  const shareGuide = () => {
    const text = [`*${s.name}*, ${BRANCH.label}`, '', s.about, '', `*What it’s for:* ${s.usedFor}`, '', '*How it’s done:*', ...s.procedure.map((p, i) => `${i + 1}. ${p}`), '', `*How to prepare:* ${s.preparation}`, `*Time:* ${s.duration}`, ...(s.price != null ? [`*Price:* ${naira(s.price)}`] : [])].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return (
    <>
      <ScreenHeader title={cat.label} />
      <div className="relative mb-4 overflow-hidden rounded-[24px] shadow-[0_14px_30px_rgba(11,23,48,0.16)]">
        {s.photo ? (
          <img src={PHOTOS[s.photo].hero} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className={`grid aspect-[16/9] place-items-center bg-linear-to-br ${TINT[s.category] ?? 'from-tint-blue to-tint-purple'}`}>
            <Sticker name={s.sticker ?? 'microscope'} size={128} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[12.5px] font-semibold text-ink backdrop-blur-md">{cat.label}</span>
      </div>

      <h2 className="text-[23px] font-bold leading-tight tracking-[-0.02em] text-ink">{s.name}</h2>
      <p className={`mt-1 font-bold ${s.price == null ? 'text-[16px] text-muted' : 'text-[26px] text-brand-600'}`}>{priceText(s.price)}</p>
      <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{s.about}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tagsOf(s).map((t) => (
          <span key={t.text} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${t.tone}`}>
            {t.icon} {t.text}
          </span>
        ))}
      </div>

      <GuideSection icon={<Target size={18} />} title="What it’s used for">
        <p>{s.usedFor}</p>
      </GuideSection>
      <GuideSection icon={<ListChecks size={18} />} title="How it’s done">
        <ol className="space-y-3">
          {s.procedure.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </GuideSection>
      <div className="mt-3 rounded-[20px] border border-[#ffe0b8] bg-[#fff7ec] p-4">
        <p className="mb-1 flex items-center gap-2 text-[14px] font-bold text-[#9a4a06]">
          <Utensils size={17} /> How to prepare
        </p>
        <p className="text-[14.5px] leading-relaxed text-[#5c3a12]">{s.preparation}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Fact icon={<Droplets size={17} />} label="Sample / test" value={s.sample} />
        <Fact icon={<Clock3 size={17} />} label="Usual time" value={s.duration} />
      </div>
      {s.price == null && <p className="mt-3 rounded-[20px] bg-page p-4 text-[14px] leading-snug text-ink-2">The branch hasn’t recorded a price for this test yet, so it can’t be requested in the app.</p>}
      <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
        <Stethoscope size={14} className="mt-0.5 shrink-0" /> General guidance written from {GUIDE_SOURCES.join(', ')}. The requesting doctor and the branch confirm the details for each patient.
      </p>

      <div className="mt-5 grid gap-3">
        {s.price != null && (
          <Button block onClick={refer}>
            <UserPlus size={20} /> Request this test for a patient
          </Button>
        )}
        <Button block variant="secondary" onClick={shareGuide}>
          <Share2 size={18} /> Send this guide on WhatsApp
        </Button>
      </div>
    </>
  );
}

function GuideSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-[20px] bg-white p-4 text-[14.5px] leading-relaxed text-ink-2 shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-ink">
        <span className="text-brand-600">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white p-3.5 shadow-[0_6px_20px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
        <span className="text-brand-600">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-[14px] font-semibold leading-snug text-ink">{value}</p>
    </div>
  );
}
