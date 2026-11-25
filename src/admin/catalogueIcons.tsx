/**
 * Icons for tests and categories (owner, 2026-11-25). The catalogue's own
 * categories keep their images (Laboratory, CT scan, MRI ... exactly as
 * they are). A NEW category or test gets its picture one of three ways:
 *   • Automatic: the app reads the name and picks the icon that fits
 *     (blood → blood drop, X-ray → bone, brain or EEG → brain, ...);
 *   • Icon library: the person picks from the app's 3D icons;
 *   • Photo: upload a picture, for example the machine used for the test.
 * Kept on this device until the cloud connection.
 */
import { useState, useSyncExternalStore } from 'react';
import { Camera, Check, Sparkles, Trash2 } from 'lucide-react';
import { readImage } from '@company/services/settingsStore';
import { STICKERS, type StickerKey } from '@/assets';
import { Sticker } from '@/ui/kit';
import { FieldErr } from './prManage';

export type IconChoice = { kind: 'auto' } | { kind: 'sticker'; name: StickerKey } | { kind: 'photo'; src: string };

/* ─────────────── automatic match ─────────────── */

const RULES: [RegExp, StickerKey][] = [
  [/x[\s-]?ray|radiograph|mammo|fluoro|bone|joint|spine|ortho|skull|pelvi|dexa/i, 'bone'],
  [/\bct\b|tomograph|cat scan/i, 'xray'],
  [/mri|magnetic|brain|neuro|eeg|head\b|cranial/i, 'brain'],
  [/echo|cardi|heart|holter|angio/i, 'heart'],
  [/ecg|ekg|ultra\s?sound|sono|doppler|scan|pulse|pregnan|obstetric|pelvic/i, 'heartPulse'],
  [/lung|chest|spiro|respirat|pulmon|breath|asthma/i, 'lungs'],
  [/dna|gene|genetic|pcr|patern|molecular/i, 'dna'],
  [/culture|swab|micro\s?bio|stool|urine|sensitivity|bacteri|fung/i, 'petriDish'],
  [/blood|haem|hem|fbc|cbc|platelet|sugar|glucose|lipid|group|genotype|serum|plasma/i, 'bloodDrop'],
  [/lab|test|panel|profile|assay|marker|hormone|vitamin|function/i, 'testTube'],
  [/histo|cyto|patholog|biopsy|smear|pap|endoscop|scope/i, 'microscope'],
  [/consult|exam|medical|check[\s-]?up|review|clinic|physician|doctor/i, 'stethoscope'],
  [/monitor|24\s?h|hour|timed|watch/i, 'watch'],
  [/vaccin|inject|immun/i, 'hospital'],
];
/** The icon that fits a name (category or test). */
export function autoIcon(text: string): StickerKey {
  for (const [re, k] of RULES) if (re.test(text)) return k;
  return 'clipboard';
}

/** Library: every 3D icon, with a plain name. */
export const ICON_LIBRARY: { name: StickerKey; label: string }[] = ([
  { name: 'testTube', label: 'Laboratory' },
  { name: 'bloodDrop', label: 'Blood' },
  { name: 'microscope', label: 'Microscope' },
  { name: 'petriDish', label: 'Culture' },
  { name: 'dna', label: 'DNA' },
  { name: 'bone', label: 'Bone, X-ray' },
  { name: 'xray', label: 'CT, X-ray' },
  { name: 'brain', label: 'Brain, MRI' },
  { name: 'heart', label: 'Heart' },
  { name: 'heartPulse', label: 'Scan, pulse' },
  { name: 'lungs', label: 'Lungs' },
  { name: 'stethoscope', label: 'Examination' },
  { name: 'watch', label: 'Monitoring' },
  { name: 'hospital', label: 'Hospital' },
  { name: 'clipboard', label: 'Form' },
  { name: 'healthWorker', label: 'Health worker' },
] as { name: StickerKey; label: string }[]).filter((x) => x.name in STICKERS);

/* ─────────────── store ─────────────── */

interface IconStore {
  categories: Record<string, IconChoice>;
  services: Record<number, IconChoice>;
}
const KEY = 'stanley.catalogue.icons.v1';
const listeners = new Set<() => void>();
let cache: IconStore = load();
function load(): IconStore {
  try {
    return { categories: {}, services: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<IconStore>) };
  } catch {
    return { categories: {}, services: {} };
  }
}
function commit(next: IconStore) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a big photo may not fit: kept for this session */
  }
  listeners.forEach((l) => l());
}
export function useIcons(): IconStore {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
}
export const setCategoryIcon = (key: string, c: IconChoice) => commit({ ...cache, categories: { ...cache.categories, [key.toUpperCase()]: c } });
export const setServiceIcon = (id: number, c: IconChoice) => commit({ ...cache, services: { ...cache.services, [id]: c } });
export const categoryIconOf = (key: string): IconChoice | undefined => cache.categories[key.toUpperCase()];
export const serviceIconOf = (id: number): IconChoice | undefined => cache.services[id];

/** What to draw: a chosen photo, a chosen icon, or the automatic one for this text. */
export function resolveIcon(choice: IconChoice | undefined, text: string, fallback?: StickerKey): { photo?: string; sticker: StickerKey } {
  if (choice?.kind === 'photo') return { photo: choice.src, sticker: fallback ?? autoIcon(text) };
  if (choice?.kind === 'sticker') return { sticker: choice.name };
  return { sticker: fallback ?? autoIcon(text) };
}

/** An icon or photo at a size (photos are rounded squares). */
export function Art({ photo, sticker, size }: { photo?: string; sticker: StickerKey; size: number }) {
  return photo ? <img src={photo} alt="" className="shrink-0 rounded-[14px] object-cover shadow-[0_6px_14px_rgba(20,60,140,0.18)]" style={{ width: size, height: size }} /> : <Sticker name={sticker} size={size} />;
}

/* ─────────────── picker ─────────────── */

/** Automatic, the icon library, or a photo (e.g. the machine). */
export function IconPicker({ value, onChange, text, title = 'Picture' }: { value: IconChoice; onChange: (c: IconChoice) => void; text: string; title?: string }) {
  const [err, setErr] = useState('');
  const auto = autoIcon(text);
  const tab = value.kind;
  return (
    <div>
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">{title}</span>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#eef3fa] p-1" role="tablist" aria-label={title}>
        {(
          [
            ['auto', 'Automatic'],
            ['sticker', 'Choose icon'],
            ['photo', 'Photo'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => (k === 'auto' ? onChange({ kind: 'auto' }) : k === 'sticker' ? onChange({ kind: 'sticker', name: value.kind === 'sticker' ? value.name : auto }) : value.kind !== 'photo' && onChange({ kind: 'photo', src: '' }))}
            className={`press min-h-10 rounded-xl text-[13px] font-semibold ${tab === k ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'auto' && (
        <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-[#f6f9ff] p-3 ring-1 ring-[#e3eaf4]">
          <Sticker name={auto} size={48} />
          <span className="min-w-0 flex-1 text-[13px] text-ink-2">
            <span className="flex items-center gap-1 font-semibold text-brand-700">
              <Sparkles size={14} /> Picked for “{text.trim() || 'the name'}”
            </span>
            The app reads the name and picks the icon that fits. It updates as you type.
          </span>
        </div>
      )}
      {tab === 'sticker' && (
        <div className="mt-2.5 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Icon library">
          {ICON_LIBRARY.map((x) => {
            const on = value.kind === 'sticker' && value.name === x.name;
            return (
              <button key={x.name} type="button" role="radio" aria-checked={on} onClick={() => onChange({ kind: 'sticker', name: x.name })} className={`press relative flex flex-col items-center gap-1 rounded-2xl p-2 ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
                <Sticker name={x.name} size={36} />
                <span className="w-full truncate text-center text-[10.5px] font-semibold text-ink-2">{x.label}</span>
                {on && (
                  <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'photo' && (
        <div className="mt-2.5">
          {value.kind === 'photo' && value.src ? (
            <div className="relative">
              <img src={value.src} alt="Chosen" className="max-h-52 w-full rounded-2xl bg-page object-contain ring-1 ring-line" />
              <button type="button" onClick={() => onChange({ kind: 'photo', src: '' })} aria-label="Remove the photo" className="press absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#b42318] shadow">
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <label className="press flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-page text-center">
              <Camera size={26} className="text-brand-600" />
              <span className="text-[14px] font-semibold text-ink">Take or choose a photo</span>
              <span className="px-4 text-[12px] text-muted">For example the machine used for this test. PNG, JPG or WebP.</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    onChange({ kind: 'photo', src: await readImage(file, 480) });
                    setErr('');
                  } catch (x) {
                    setErr(x instanceof Error ? x.message : 'That photo could not be read.');
                  }
                }}
              />
            </label>
          )}
          <FieldErr msg={err || null} />
        </div>
      )}
    </div>
  );
}
