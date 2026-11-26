/**
 * Service catalogue of the agent's branch — the REAL catalogue of the Abuja
 * branch (BR001) from the STANLEY desktop app: every category and service,
 * names and prices exactly as recorded (catalogue.generated.json).
 *
 * Each service gets a picture that matches what it is: a photo where we have
 * one (MRI, CT, ultrasound, leg X-ray, blood and lab tests), otherwise a 3D
 * icon chosen from its category and name.
 *
 * Every service carries its GUIDE — what it is, what it is used for, how it is
 * done step by step, how to prepare, the sample, the usual time and the words
 * people use for it. The guide is written once in the dashboard
 * (src/data/serviceGuide) and copied here with the catalogue, so both apps
 * explain every test the same way.
 */
import type { PhotoKey, StickerKey } from '@/assets';
import CATALOGUE from './catalogue.generated.json';

export interface CategoryInfo {
  key: string;
  /** Friendly name for chips and headings. */
  label: string;
  description: string;
  preparation: string;
  procedure: string;
  count: number;
}

const INFO: Record<string, Omit<CategoryInfo, 'key' | 'count'>> = {
  LAB: { label: 'Laboratory', description: 'Laboratory test, the sample is collected at the branch.', preparation: 'Some blood tests need fasting for 8 to 12 hours. Confirm with the branch before the visit.', procedure: 'Sample collected at the branch' },
  'X-RAY': { label: 'X-Ray', description: 'X-ray imaging to look at bones, the chest and other structures.', preparation: 'Remove metal items around the area. Tell staff if the patient may be pregnant.', procedure: 'Quick imaging · about 10 to 15 minutes' },
  MRI: { label: 'MRI', description: 'Magnetic resonance imaging, detailed pictures without radiation.', preparation: 'Remove all metal. Tell staff about pacemakers, implants or pregnancy.', procedure: 'Non-invasive scan · about 30 to 60 minutes' },
  SCAN: { label: 'Ultrasound', description: 'Ultrasound scan, uses sound waves, no radiation.', preparation: 'Abdominal scans may need fasting; pelvic scans usually need a full bladder. Confirm with the branch.', procedure: 'Non-invasive scan · about 20 to 30 minutes' },
  'CT SCAN': { label: 'CT Scan', description: 'CT (computed tomography), cross-sectional imaging of the body.', preparation: 'Some CT scans need fasting or contrast. Confirm with the branch before the visit.', procedure: 'Imaging · about 15 to 30 minutes' },
  PHARYNGOSCOPY: { label: 'Pharyngoscopy', description: 'Endoscopic examination with a thin camera (throat, stomach or colon).', preparation: 'Usually needs fasting, the branch gives the patient full instructions.', procedure: 'Procedure at the branch' },
  DNA: { label: 'DNA', description: 'DNA relationship test.', preparation: 'Each person tested gives a cheek-swab sample at the branch.', procedure: 'Cheek swab' },
  ECHO: { label: 'Echo', description: 'Echocardiography, an ultrasound of the heart.', preparation: 'No special preparation.', procedure: 'Non-invasive scan · about 30 minutes' },
  CARDIOLOGY: { label: 'Cardiology', description: 'Consultation with the heart specialist.', preparation: 'Bring previous results and a list of medicines.', procedure: 'Consultation' },
  ECG: { label: 'ECG', description: 'Electrocardiogram, records the heart’s rhythm.', preparation: 'Avoid lotions on the chest before the visit.', procedure: 'Non-invasive recording · about 10 minutes' },
  EEG: { label: 'EEG', description: 'Electroencephalogram, records the brain’s electrical activity.', preparation: 'Wash hair the night before; no oils or gels.', procedure: 'Non-invasive recording · about 45 minutes' },
  'HOLTER ECG': { label: 'Holter ECG', description: 'Heart rhythm recorded for 24 hours with a small portable monitor.', preparation: 'Wear loose clothing; the patient returns the monitor the next day.', procedure: 'Portable monitor · 24 hours' },
  'MEDICAL EXAMINATION': { label: 'Medical Exam', description: 'General medical examination.', preparation: 'Bring a valid ID and any previous results.', procedure: 'Examination at the branch' },
};
const fallbackInfo = (key: string) => ({ label: key.charAt(0) + key.slice(1).toLowerCase(), description: 'Diagnostic service at the branch.', preparation: 'Confirm preparation with the branch.', procedure: 'At the branch' });

export const CATEGORIES: CategoryInfo[] = CATALOGUE.categories.map((c) => ({ key: c.key, count: c.count, ...(INFO[c.key] ?? fallbackInfo(c.key)) }));
export const categoryInfo = (key: string): CategoryInfo => CATEGORIES.find((c) => c.key === key) ?? { key, count: 0, ...fallbackInfo(key) };

type GuideRow = [family: string, about: string, usedFor: string, keywords: string[], preparation: string];
interface FamilyGuide {
  sample: string;
  procedure: string[];
  preparation: string;
  duration: string;
}
/** Owner (2026-11-24): no dashes in text the agent reads. Sentence breaks become commas, ranges "to". */
export const plainText = (t: string) =>
  t
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 to $2')
    .replace(/\b([A-Z])[\u2013\u2014]([A-Z])\b/g, '$1 to $2')
    .replace(/\s+[\u2013\u2014]\s+/g, ', ')
    .replace(/[\u2013\u2014]/g, ', ');
export const plainAll = <T,>(v: T): T => (typeof v === 'string' ? (plainText(v) as T) : Array.isArray(v) ? (v.map(plainAll) as T) : v && typeof v === 'object' ? (Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainAll(x)])) as T) : v);
const GUIDE = plainAll(CATALOGUE.guide as unknown as { sources: string[]; families: Record<string, FamilyGuide>; byId: Record<string, GuideRow> });
export const GUIDE_SOURCES = GUIDE.sources;

export interface Service {
  /** The desktop catalogue's item id (as text). */
  id: string;
  /** As recorded in the catalogue. */
  name: string;
  /** Category key, e.g. "LAB", "X-RAY". */
  category: string;
  /** null = no price recorded yet (can't be referred until the branch sets one — same as Billing). */
  price: number | null;
  /** What the test is (one sentence). */
  about: string;
  /** What doctors use it for. */
  usedFor: string;
  /** Step by step, from arrival to leaving. */
  procedure: string[];
  preparation: string;
  sample: string;
  duration: string;
  /** Words people use for it — used by the describe-a-test search. */
  keywords: string[];
  /** Same as about (short line under the name). */
  description: string;
  photo?: PhotoKey;
  sticker?: StickerKey;
}

const has = (name: string, ...words: string[]) => words.some((w) => name.includes(w));

/** The picture that best shows what the service is. */
function visualFor(name: string, category: string): Pick<Service, 'photo' | 'sticker'> {
  const n = name.toUpperCase();
  switch (category) {
    case 'MRI':
      return { photo: 'mri' };
    case 'CT SCAN':
      return { photo: 'ct' };
    case 'SCAN':
      return { photo: 'ultrasound' };
    case 'X-RAY':
      return has(n, 'LEG', 'KNEE', 'ANKLE', 'FOOT', 'TIBIA', 'FEMUR', 'FERMUR', 'THIGH', 'HIP') ? { photo: 'xray' } : has(n, 'CHEST', 'THORAC') ? { sticker: 'lungs' } : { sticker: 'xray' };
    case 'DNA':
      return { sticker: 'dna' };
    case 'ECHO':
      return { sticker: 'heart' };
    case 'ECG':
      return { sticker: 'heartPulse' };
    case 'HOLTER ECG':
      return { sticker: 'watch' };
    case 'EEG':
      return { sticker: 'brain' };
    case 'PHARYNGOSCOPY':
      return { sticker: 'lungs' };
    case 'CARDIOLOGY':
      return { sticker: 'heart' };
    case 'MEDICAL EXAMINATION':
      return { sticker: 'stethoscope' };
    case 'LAB':
      if (has(n, 'M/C/S', 'MCS', 'CULTURE', 'MICROSCOPY', 'GRAM', 'AFB', 'HISTOLOGY', 'FNAC', 'IMMUNOHISTO', 'PAP', 'FILM', 'MICROFILARIA')) return { sticker: 'microscope' };
      if (has(n, 'DNA', 'GENOTYP', 'GENE ', 'NIPT', 'HPLC', 'ELECTROPHORESIS')) return { sticker: 'dna' };
      if (has(n, 'URINE', 'URINALYSIS', 'STOOL', 'SEMEN', 'SPUTUM', 'SWAB', 'HVS', 'ECS', 'CSF', 'THROAT', 'OCCULT', 'FOB', 'BREATH', 'DRUG TEST')) return { sticker: 'petriDish' };
      if (has(n, 'BLOOD', 'HB ', 'HAEMOGLOBIN', 'PLATELET', 'PCV', 'CLOTTING', 'BLEEDING', 'PROTHROMBIN', 'PTTK', 'INR', 'G6PD', 'FIBRINOGEN', 'RETICULOCYTE', 'ESR', 'FBS', 'RBS', 'OGTT', '2HPP', 'HBA1C', 'D-DIMER', 'GROUP')) return { photo: 'blood' };
      if (has(n, 'BONE', 'CALCIUM', 'VITAMIN D')) return { sticker: 'bone' };
      if (has(n, 'TROPONIN', 'CK-MB', 'BNP', 'CHOLESTEROL', 'LIPID', 'HDL', 'LDL', 'TRIGLYCERIDE')) return { sticker: 'heart' };
      return { photo: 'lab' };
    default:
      return { sticker: 'microscope' };
  }
}

export const SERVICES: Service[] = (CATALOGUE.services as [number, string, string, number | null][]).map(([id, name, category, price]) => {
  const info = categoryInfo(category);
  const g = GUIDE.byId[String(id)];
  const fam = (g && GUIDE.families[g[0]]) || { sample: info.procedure, procedure: [info.procedure], preparation: info.preparation, duration: '' };
  const about = g?.[1] ?? info.description;
  return { id: String(id), name: name.trim(), category, price, about, description: about, usedFor: g?.[2] ?? '', procedure: fam.procedure, preparation: g?.[4] ?? info.preparation, sample: fam.sample, duration: fam.duration, keywords: g?.[3] ?? [], ...visualFor(name, category) };
});

/** Picture for a whole category (category cards). */
const CATEGORY_VISUAL: Record<string, Pick<Service, 'photo' | 'sticker'>> = {
  LAB: { photo: 'lab' },
  'X-RAY': { photo: 'xray' },
  MRI: { photo: 'mri' },
  SCAN: { photo: 'ultrasound' },
  'CT SCAN': { photo: 'ct' },
  PHARYNGOSCOPY: { sticker: 'lungs' },
  DNA: { sticker: 'dna' },
  ECHO: { sticker: 'heart' },
  CARDIOLOGY: { sticker: 'stethoscope' },
  ECG: { sticker: 'heartPulse' },
  EEG: { sticker: 'brain' },
  'HOLTER ECG': { sticker: 'watch' },
  'MEDICAL EXAMINATION': { sticker: 'stethoscope' },
};
export const categoryVisual = (key: string) => CATEGORY_VISUAL[key] ?? { sticker: 'microscope' as StickerKey };
/** Lowest recorded price in a category ("from ₦3,500"). */
export const categoryFrom = (key: string) => {
  const prices = SERVICES.filter((s) => s.category === key && s.price != null).map((s) => s.price!);
  return prices.length ? Math.min(...prices) : null;
};

export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);
/** First service recorded under this exact name (some names are recorded twice on purpose). */
export const serviceByName = (name: string) => SERVICES.find((s) => s.name === name);

export function searchServices(q: string, category: string = 'All') {
  const t = q.trim().toLowerCase();
  return SERVICES.filter((s) => (category === 'All' || s.category === category) && (!t || `${s.name} ${s.category} ${categoryInfo(s.category).label}`.toLowerCase().includes(t)));
}
