/**
 * Price calculator for PR agents (owner, 2026-11-26): from the Home and
 * Catalogue header bars, like the branch's calculator. Pick tests (search,
 * describe a test, or a category), see the total, and when the price is too
 * much for the patient, suggest a lower price with a reason. "Request these
 * tests" starts a referral with the tests and the suggested reduction; the
 * branch manager approves any reduction at billing (every discount is
 * approved), so the price the patient pays is confirmed at the branch.
 */
import { useMemo, useState } from 'react';
import { Calculator, Check, ChevronRight, Plus, Search, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { CATEGORIES, SERVICES, categoryVisual, serviceById, type Service } from '@/data/services';
import { smartSearch } from '@/domain/testSearch';
import { naira } from '@/domain/format';
import { Sheet } from '@/admin/ui';
import { Sticker, inputClass } from '@/ui/kit';
import { onlyDigits } from '@/ui/fieldRules';

/** Header button (Home and Catalogue). */
export function CalculatorButton({ tone = 'plain' }: { tone?: 'plain' | 'card' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Price calculator" className={`press relative grid h-11 w-11 place-items-center rounded-full text-ink ${tone === 'card' ? 'bg-white shadow-[0_4px_12px_rgba(30,74,160,0.1)] ring-1 ring-line' : ''}`}>
        <Calculator size={24} strokeWidth={1.9} />
      </button>
      {open && <PriceCalculator onClose={() => setOpen(false)} />}
    </>
  );
}

export function PriceCalculator({ onClose }: { onClose: () => void }) {
  const { draft, setDraft, navigate, showToast } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [view, setView] = useState<'pick' | 'quote'>('pick');
  const [off, setOff] = useState('');
  const [why, setWhy] = useState('');
  const chosen = ids.map(serviceById).filter((s): s is Service => !!s);
  const total = chosen.reduce((n, s) => n + (s.price ?? 0), 0);
  const cut = Math.min(Number(off || 0), total);
  const pay = total - cut;
  const pct = total ? Math.round((cut / total) * 100) : 0;
  const result = useMemo(() => (q.trim() ? smartSearch(q, cat ?? 'All') : null), [q, cat]);
  const list: Service[] = result ? result.hits.map((h) => h.service) : cat ? SERVICES.filter((s) => s.category === cat) : [];
  const toggle = (s: Service) => (s.price === null ? undefined : setIds((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id])));
  const start = () => {
    setDraft((d) => ({ ...d, serviceIds: [...new Set([...d.serviceIds, ...ids])], priceAsk: cut > 0 ? { amount: cut, reason: why.trim() } : d.priceAsk, step: d.patient.name.trim() ? 1 : 0 }));
    showToast(`${ids.length} test${ids.length === 1 ? '' : 's'} added to your request${cut ? `, with ${naira(cut)} off asked` : ''}`);
    onClose();
    navigate(draft.patient.name.trim() ? '/refer/services' : '/refer');
  };

  const row = (s: Service) => {
    const on = ids.includes(s.id);
    return (
      <li key={s.id}>
        <button type="button" disabled={s.price === null} onClick={() => toggle(s)} aria-pressed={on} className={`press flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-55 ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-1 ring-line/70'}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold leading-snug text-ink">{s.name}</span>
            <span className="block truncate text-[12px] text-muted">{s.about}</span>
          </span>
          <b className={`shrink-0 text-[14px] ${s.price === null ? 'text-faint' : 'text-ink'}`}>{s.price === null ? 'At branch' : naira(s.price)}</b>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${on ? 'bg-brand-600 text-white' : 'bg-page text-brand-600'}`}>{on ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.6} />}</span>
        </button>
      </li>
    );
  };

  return (
    <Sheet
      title={view === 'quote' ? 'Price for the patient' : 'Price calculator'}
      subtitle={view === 'quote' ? 'Suggest a lower price if the patient cannot afford it' : 'Add tests to see what the patient will pay'}
      onClose={view === 'quote' ? () => setView('pick') : onClose}
      back={view === 'quote'}
      tall
      search={view === 'pick' ? { value: q, onChange: setQ, placeholder: 'Search or describe a test' } : undefined}
      footer={
        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <span className="text-[12.5px] text-muted">
              {chosen.length} test{chosen.length === 1 ? '' : 's'}
              {cut > 0 && <span className="block text-faint line-through">{naira(total)}</span>}
            </span>
            <b className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{naira(pay)}</b>
          </div>
          {view === 'pick' ? (
            <button type="button" disabled={!chosen.length} onClick={() => setView('quote')} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(31,111,232,0.3)] disabled:opacity-40 disabled:shadow-none">
              See the price <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" disabled={!chosen.length || (cut > 0 && why.trim().length < 3)} onClick={start} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
              <Plus size={18} /> Request these tests
            </button>
          )}
        </div>
      }
    >
      {view === 'quote' ? (
        <div className="px-1 pb-4">
          <div className="relative overflow-hidden rounded-[24px] bg-linear-to-br from-[#123e9c] via-[#1f6fe8] to-[#5ea6f7] p-4 text-white shadow-[0_14px_30px_rgba(31,111,232,0.3)]">
            <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15" />
            <Sticker name="coin" size={58} className="absolute right-3 top-3" />
            <p className="text-[13px] font-semibold text-white/85">{cut ? 'Price after the reduction' : 'Total for the tests'}</p>
            <p className="mt-1 text-[32px] font-extrabold leading-none">{naira(pay)}</p>
            <p className="mt-1.5 text-[12.5px] text-white/85">{cut ? `${naira(total)} less ${naira(cut)} (${pct}%)` : `${chosen.length} test${chosen.length === 1 ? '' : 's'} at the branch price`}</p>
          </div>
          <ul className="mt-3 divide-y divide-line rounded-2xl bg-white ring-1 ring-line/70">
            {chosen.map((s) => (
              <li key={s.id} className="flex items-start gap-2 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] leading-snug text-ink">{s.name}</b>
                  <span className="text-[12px] text-muted">{s.category}</span>
                </span>
                <b className="shrink-0 text-[14px] text-ink">{naira(s.price ?? 0)}</b>
                <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s.name}`} className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#d93036]">
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-[22px] bg-[#faf7ff] p-3.5 ring-1 ring-[#e4dbff]">
            <p className="text-[15px] font-bold text-ink">Too much for the patient?</p>
            <p className="mb-2.5 text-[12.5px] leading-snug text-muted">Suggest how much to take off. The branch manager approves every reduction when the patient is billed.</p>
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-semibold text-ink">Amount off</span>
              <span className="relative block">
                <b className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">₦</b>
                <input inputMode="numeric" value={off ? Number(off).toLocaleString('en-NG') : ''} onChange={(e) => setOff(String(Math.min(Number(onlyDigits(e.target.value, 9) || 0), total) || ''))} placeholder="0" className={`${inputClass()} pl-9 text-[17px] font-bold`} />
              </span>
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1000, 2000, 3000, 5000].filter((v) => v < total).map((v) => (
                <button key={v} type="button" onClick={() => setOff(String(v))} className={`press min-h-8 rounded-full px-3 text-[12.5px] font-semibold ${cut === v ? 'bg-violet text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                  {naira(v)} off
                </button>
              ))}
              {cut > 0 && (
                <button type="button" onClick={() => (setOff(''), setWhy(''))} className="press min-h-8 rounded-full px-3 text-[12.5px] font-semibold text-muted">
                  No reduction
                </button>
              )}
            </div>
            {cut > 0 && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[13.5px] font-semibold text-ink">Why</span>
                <textarea value={why} onChange={(e) => setWhy(e.target.value.slice(0, 200))} rows={2} placeholder="For example: the patient is short of money for both tests" className={`${inputClass()} min-h-20 py-3 leading-6`} />
              </label>
            )}
          </div>
          <p className="mt-3 rounded-2xl bg-page px-3.5 py-3 text-[12.5px] leading-snug text-muted">A price estimate, not a bill. The branch confirms the final price when the patient arrives.</p>
        </div>
      ) : (
        <div className="px-1 pb-4">
          {chosen.length > 0 && (
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {chosen.map((s) => (
                <span key={s.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 py-1.5 pl-3 pr-1.5 text-[12.5px] font-semibold text-brand-700 ring-1 ring-brand-100">
                  <span className="max-w-40 truncate">{s.name}</span>
                  <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s.name}`} className="grid h-5 w-5 place-items-center rounded-full bg-white text-brand-600">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {cat && !q.trim() && (
            <button type="button" onClick={() => setCat(null)} className="press mb-2 text-[13.5px] font-semibold text-brand-600">
              All categories
            </button>
          )}
          {q.trim() || cat ? (
            list.length ? (
              <ul className="space-y-2">{list.slice(0, 80).map(row)}</ul>
            ) : (
              <div className="flex flex-col items-center rounded-[22px] bg-page px-5 py-8 text-center">
                <Search size={26} className="text-faint" />
                <p className="mt-2 text-[14.5px] font-semibold text-ink">No test matches “{q}”</p>
                <p className="text-[12.5px] text-muted">Try another word, or describe what the test is for.</p>
              </div>
            )
          ) : (
            <>
              <p className="mb-2 px-1 text-[13px] font-bold text-ink-2">Categories</p>
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map((c) => {
                  const v = categoryVisual(c.key);
                  const n = chosen.filter((s) => s.category === c.key).length;
                  return (
                    <button key={c.key} type="button" onClick={() => setCat(c.key)} className="press relative rounded-[20px] bg-white p-3 text-left ring-1 ring-line/70">
                      <Sticker name={v.sticker ?? 'microscope'} size={38} />
                      <b className="mt-1.5 block truncate text-[14.5px] text-ink">{c.label}</b>
                      <span className="block text-[12px] text-muted">{c.count} tests</span>
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
