/**
 * "Describe the test" search (owner, 2026-11-23) — no AI. Agents can type a
 * test's name OR describe what the doctor is checking for ("malaria", "sugar
 * level", "kidney check", "pregnancy scan", "back pain") and get the related
 * tests from the branch's real catalogue, each with the reason it matched.
 *
 * How it works:
 *  1. Words in the query are matched (typo-tolerant, Fuse.js) against a guide
 *     of everyday health words → the catalogue tests they relate to.
 *  2. Test names are matched directly (and fuzzily, e.g. "lipd profile").
 *  3. Results: name matches first, then related tests, then near-spellings.
 */
import Fuse from 'fuse.js';
import { categoryInfo, SERVICES, type Service } from '@/data/services';

interface Concept {
  /** Shown to the agent: "Related to: blood sugar". */
  label: string;
  /** Everyday words that mean this. */
  triggers: string[];
  /** Words found in catalogue names (upper case). */
  names?: string[];
  /** Whole categories that belong to it. */
  categories?: string[];
}

const CONCEPTS: Concept[] = [
  { label: 'malaria', triggers: ['malaria', 'mp', 'fever', 'plasmodium'], names: ['MP', 'FULL BLOOD COUNT', 'WIDAL'] },
  { label: 'typhoid', triggers: ['typhoid', 'widal', 'enteric'], names: ['WIDAL', 'BLOOD CULTURE', 'STOOL M/C/S'] },
  { label: 'blood sugar / diabetes', triggers: ['sugar', 'diabetes', 'diabetic', 'glucose', 'hba1c', 'insulin', 'fbs', 'rbs'], names: ['FBS', 'RBS', 'OGTT', '2HPP', 'HBA1C', 'INSULIN', 'C-PEPTIDE', 'C -PEPTIDE', 'MICROALBUMIN', 'GAD'] },
  { label: 'kidney', triggers: ['kidney', 'kidneys', 'renal', 'urea', 'creatinine', 'electrolytes', 'euc', 'e u c', 'kft'], names: ['E/U/C', 'UREA', 'CREATININ', 'SODIUM', 'POTASSIUM', 'CHLORIDE', 'BICARBONATE', 'CYSTATIN', 'ALBUMIN CREATININ', 'MICRO ALBUMIN', 'URINALYSIS', 'RENAL', 'CT UROGRAM', '24 HOURS URINE'] },
  { label: 'liver', triggers: ['liver', 'lft', 'jaundice', 'hepatic', 'yellow eyes'], names: ['LIVER', 'BILIRUBIN', 'ALKALINE PHOSPHATASE', 'ASAT', 'ALAT', 'GGT', 'ALBUMIN', 'TOTAL PROTEIN', 'HEPATITIS', 'HBSAG', 'HCV', 'TRIPHASIC LIVER', 'ABDOMINOPELVIC', 'ALPHA-FETO'] },
  { label: 'hepatitis', triggers: ['hepatitis', 'hbv', 'hcv', 'hepb', 'hep b', 'hep c'], names: ['HEPATITIS', 'HBSAG', 'HCV', 'HBCAB', 'ANTI HBC', 'ANTI-HBC', 'ANTI HCV'] },
  { label: 'heart', triggers: ['heart', 'cardiac', 'chest pain', 'palpitation', 'palpitations', 'cardio', 'blood pressure', 'hypertension'], names: ['ECG', 'ECHOCARDIOGRAPHY', 'TROPONIN', 'CK-MB', 'PRO BNP', 'LIPID', 'CHOLESTEROL', 'HOLTER', 'CONSULTATION', 'HS-CRP', 'CAROTID'], categories: ['ECG', 'ECHO', 'HOLTER ECG', 'CARDIOLOGY'] },
  { label: 'cholesterol', triggers: ['cholesterol', 'lipid', 'fat', 'lipids'], names: ['LIPID', 'CHOLESTEROL', 'TRIGLYCERIDE', 'HDL', 'LDL'] },
  { label: 'pregnancy', triggers: ['pregnancy', 'pregnant', 'antenatal', 'baby', 'fetus', 'foetus', 'obstetric'], names: ['PREGNANCY TEST', 'BETA-HCG', 'OBSTETRICS', 'ANOMALY', 'BIOPHYSICAL', 'UMBILICAL DOPPLER', 'NIPT', 'TORCH', 'RUBELLA', 'TOXOPLASMA', 'HB GENOTYPE', 'BLOOD GROUPING'] },
  { label: 'fertility', triggers: ['fertility', 'infertility', 'conceive', 'conception', 'sperm', 'ovulation', 'hormone', 'hormones'], names: ['HORMONAL PROFILE', 'PROGESTERONE', 'LUITINIZING', 'FOLLICLE STIMULATING', 'PROLACTIN', 'ESTRADIOL', 'TESTOSTERONE', 'AMH', 'SEMEN', 'FOLLICULAR TRACKING', 'HSG', 'TRANSVAGINAL', 'LH', 'FSH'] },
  { label: 'thyroid', triggers: ['thyroid', 'goitre', 'goiter', 'tsh', 't3', 't4'], names: ['THYROID', 'TSH', 'FREE T3', 'FREE T4', 'NECK ULTRASOUND'] },
  { label: 'cancer screening', triggers: ['cancer', 'tumour', 'tumor', 'lump', 'mass', 'growth', 'biopsy'], names: ['PSA', 'CA-125', 'CA 15-3', 'CA 19-9', 'CEA', 'ALPHA-FETO', 'HISTOLOGY', 'BIOPSY', 'MAMMOGRAM', 'BREAST', 'PAP SMEAR', 'HPV', 'IMMUNOHISTO', 'FNAC'] },
  { label: 'HIV & STIs', triggers: ['hiv', 'aids', 'sti', 'std', 'syphilis', 'gonorrhoea', 'gonorrhea', 'chlamydia', 'herpes', 'discharge'], names: ['HIV', 'VDRL', 'CHLAMYDIA', 'GONORRHEA', 'HSV', 'HERPES', 'HVS', 'ECS', 'URETHRAL SWAB', 'CD 4'] },
  { label: 'blood count / anaemia', triggers: ['fbc', 'cbc', 'anaemia', 'anemia', 'blood count', 'low blood', 'pale', 'weakness', 'tired', 'tiredness', 'iron'], names: ['FULL BLOOD COUNT', 'PCV', 'RETICULOCYTE', 'IRON STUDIES', 'FERRATIN', 'BLOOD FILM', 'PERIPHERAL BLOOD FILM', 'ESR', 'VITAMIN B'] },
  { label: 'genotype / sickle cell', triggers: ['genotype', 'sickle', 'sickler', 'sickling'], names: ['HB GENOTYPE', 'HB GENOTYPING', 'HAEMOGLOBIN ELECTROPHORESIS', 'HPLC'] },
  { label: 'blood group', triggers: ['blood group', 'blood type', 'rhesus', 'transfusion'], names: ['BLOOD GROUPING', 'COMB', 'COOMB'] },
  { label: 'bleeding & clotting', triggers: ['bleeding', 'clotting', 'clot', 'coagulation', 'surgery', 'pre-op', 'preop', 'dvt'], names: ['CLOTTING', 'BLEEDING TIME', 'PROTHROMBIN', 'INR', 'PTTK', 'D-DIMER', 'FIBRINOGEN', 'PLATELET', 'VON WILLEBRAND', 'LUPOS'] },
  { label: 'bones & fractures', triggers: ['bone', 'bones', 'fracture', 'broken', 'injury', 'accident', 'fall', 'sprain'], categories: ['X-RAY'], names: ['FEMUR', 'KNEE', 'ANKLE', 'VITAMIN D', 'CALCIUM'] },
  { label: 'joints & arthritis', triggers: ['joint', 'joints', 'arthritis', 'knee pain', 'swelling', 'gout', 'rheumatism'], names: ['RHEUMATOID', 'URIC ACID', 'ASO', 'ANA', 'CRP', 'C-REACTIVE', 'KNEE', 'HIP', 'SHOULDER', 'ELBOW', 'ANKLE', 'ANTI -DS DNA'] },
  { label: 'spine & back pain', triggers: ['back', 'back pain', 'spine', 'neck pain', 'waist', 'lumbar', 'disc'], names: ['SPINE', 'LUMBAR', 'LUMBOSACRAL', 'THORACIC', 'CERVICAL', 'C-SPINE', 'L-SPINE', 'SACRO', 'THORACOLUMBAR'] },
  { label: 'head & brain', triggers: ['head', 'brain', 'headache', 'stroke', 'head injury', 'dizziness', 'migraine'], names: ['BRAIN', 'SKULL', 'EEG', 'TRANSCRANIAL', 'CRANIO', 'PITUITARY'] },
  { label: 'seizures', triggers: ['seizure', 'seizures', 'convulsion', 'epilepsy', 'fits'], names: ['EEG', 'BRAIN'] },
  { label: 'chest & lungs', triggers: ['chest', 'lungs', 'lung', 'cough', 'breathing', 'asthma', 'pneumonia', 'tb', 'tuberculosis'], names: ['CHEST', 'SPUTUM', 'AFB', 'GENE EXPERT', 'TB', 'QUANTIFERON', 'THORACIC INLET'] },
  { label: 'stomach & digestion', triggers: ['stomach', 'abdomen', 'abdominal', 'belly', 'ulcer', 'gastric', 'indigestion', 'vomiting'], names: ['PYLORI', 'ABDOMINOPELVIC', 'ABDOMEN', 'GASTROSCOPY', 'ESOPHAGOSCOPY', 'BARIUM', 'AMYLASE', 'LIPASE', 'CALPROTECTIN', 'UREA BREATH'] },
  { label: 'bowel & stool', triggers: ['stool', 'diarrhoea', 'diarrhea', 'constipation', 'bowel', 'colon', 'blood in stool', 'piles'], names: ['STOOL', 'OCCULT', 'FOB', 'COLONOSCOPY', 'BARIUM ENEMA', 'CALPROTECTIN'] },
  { label: 'urine & UTI', triggers: ['urine', 'uti', 'urinary', 'burning', 'bladder'], names: ['URINALYSIS', 'URINE', 'RENAL SCAN', 'PELVIC ULTRASOUND'] },
  { label: 'prostate', triggers: ['prostate', 'urinating', 'frequent urination'], names: ['PSA', 'PROSTATE', 'TROSS', 'TESTICULAR'] },
  { label: 'breast', triggers: ['breast', 'breasts', 'mammogram'], names: ['BREAST', 'MAMMOGRAM', 'CA 15-3'] },
  { label: 'women’s health', triggers: ['women', 'woman', 'female', 'period', 'menstrual', 'fibroid', 'fibroids', 'pelvic', 'womb', 'uterus', 'ovary', 'ovarian'], names: ['PELVIC', 'TRANSVAGINAL', 'PAP SMEAR', 'HVS', 'HSG', 'FOLLICULAR', 'HORMONAL PROFILE', 'CA-125'] },
  { label: 'infection & inflammation', triggers: ['infection', 'inflammation', 'sepsis', 'swab', 'wound'], names: ['CULTURE', 'M/C/S', 'MCS', 'SWAB', 'CRP', 'C-REACTIVE', 'PROCALCITONIN', 'ESR', 'WIDAL'] },
  { label: 'allergy & immunity', triggers: ['allergy', 'allergic', 'rash', 'immune', 'autoimmune', 'lupus'], names: ['IGE', 'ANA', 'ANCA', 'AUTOIMMUNE', 'C3', 'C4', 'ENA', 'ANTI -DS DNA'] },
  { label: 'vitamins', triggers: ['vitamin', 'vitamins', 'deficiency', 'calcium'], names: ['VITAMIN', 'CALCIUM', 'MAGANISUM', 'SERUM PHOSPHATE', 'BIOTIN'] },
  { label: 'blood vessels', triggers: ['veins', 'vein', 'circulation', 'blood flow', 'leg swelling', 'varicose'], names: ['DOPPLER', 'D-DIMER'] },
  { label: 'eyes, ears & sinuses', triggers: ['eye', 'eyes', 'ear', 'ears', 'sinus', 'sinusitis', 'nose'], names: ['OCULAR', 'ORBIT', 'EAR SWAB', 'MASTOIDS', 'PARANASAL', 'POST NASAL', 'NASOPHARYNX'] },
  { label: 'children & infants', triggers: ['child', 'children', 'infant', 'newborn', 'baby head'], names: ['ANTERIOR FONTANELLE', 'TRANSFONTANELLE', 'ECHOCARDIOGRAPHY (CHILDREN)'] },
  { label: 'paternity / DNA', triggers: ['paternity', 'dna', 'father', 'relationship test'], categories: ['DNA'] },
  { label: 'general check-up', triggers: ['checkup', 'check-up', 'check up', 'medical', 'routine', 'fitness', 'employment', 'school', 'general'], names: ['MEDICAL EXAMINATION', 'FULL BLOOD COUNT', 'FASTING LIPID PROFILE', 'E/U/C', 'LIVER FUNCTION TEST', 'FBS', 'URINALYSIS', 'HB GENOTYPE', 'BLOOD GROUPING', 'HBSAG', 'HIV I&II', 'CHEST (AP)'] },
  { label: 'imaging scans', triggers: ['scan', 'scans', 'imaging', 'ultrasound', 'sonography'], categories: ['SCAN'] },
  { label: 'MRI', triggers: ['mri', 'magnetic'], categories: ['MRI'] },
  { label: 'CT scan', triggers: ['ct', 'cat scan', 'tomography'], categories: ['CT SCAN'] },
  { label: 'X-ray', triggers: ['xray', 'x-ray', 'x ray', 'radiograph'], categories: ['X-RAY'] },
  { label: 'endoscopy', triggers: ['scope', 'endoscopy', 'camera', 'throat'], categories: ['PHARYNGOSCOPY'] },
  { label: 'drug test', triggers: ['drug', 'drugs', 'substance'], names: ['DRUG TEST'] },
];

/* ─────────────── matching ─────────────── */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('a an the for of to and or in on at with test tests check checking patient need needs want do doctor some my his her their is are be with please'.split(' '));

/** Every trigger word/phrase, for spelling correction. */
const TRIGGERS = CONCEPTS.flatMap((c, i) => c.triggers.map((t) => ({ t: norm(t), i })));
const triggerFuse = new Fuse(TRIGGERS.filter((x) => !x.t.includes(' ')), { keys: ['t'], threshold: 0.22, ignoreLocation: true, includeScore: true, minMatchCharLength: 4 });
/** Words that are already exact triggers or ordinary words — never "corrected". */
const EXACT = new Set([...TRIGGERS.map((x) => x.t), 'pain', 'pains', 'cell', 'cells', 'level', 'levels', 'count', 'check', 'scan', 'scans', 'blood', 'profile', 'result', 'results', 'urgent', 'today', 'swelling']);
const nameFuse = new Fuse(SERVICES, { keys: ['name'], threshold: 0.32, ignoreLocation: true, includeScore: true, minMatchCharLength: 3 });

function conceptsIn(q: string): number[] {
  const text = ` ${norm(q)} `;
  const found = new Set<number>();
  // Phrases and words written exactly.
  TRIGGERS.forEach(({ t, i }) => {
    if (text.includes(` ${t} `)) found.add(i);
  });
  // Misspelt single words ("malria", "diabetis").
  for (const w of norm(q).split(' ')) {
    if (w.length < 5 || STOP.has(w) || EXACT.has(w)) continue;
    const hit = triggerFuse.search(w, { limit: 1 })[0];
    if (hit && (hit.score ?? 1) < 0.22) found.add(hit.item.i);
  }
  return [...found];
}

function servicesFor(c: Concept): Service[] {
  return SERVICES.filter((s) => {
    if (c.categories?.includes(s.category)) return true;
    const n = ` ${s.name.toUpperCase()} `;
    return (c.names ?? []).some((k) => (k.length <= 3 ? new RegExp(`[^A-Z]${k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}[^A-Z]`).test(n) : n.includes(k)));
  });
}

export interface SearchHit {
  service: Service;
  /** Why it is listed: undefined = its name matches; otherwise the related health topic. */
  reason?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  /** Health topics understood from the description ("malaria", "kidney"). */
  topics: string[];
}

export function smartSearch(query: string, category = 'All'): SearchResult {
  const q = query.trim();
  const inCat = (s: Service) => category === 'All' || s.category === category;
  if (!q) return { hits: SERVICES.filter(inCat).map((service) => ({ service })), topics: [] };

  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  const add = (service: Service, reason?: string) => {
    if (seen.has(service.id) || !inCat(service)) return;
    seen.add(service.id);
    hits.push({ service, reason });
  };

  // 1. Names (and category names) that contain what was typed — or every word of it ("mri knee" → KNEE MRI).
  const t = norm(q);
  const words = t.split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.replace(/s$/, '').replace(/^x ?ray$/, 'x ray'));
  const label = (s: Service) => norm(`${s.name} ${categoryInfo(s.category).label}`).replace(/xray/g, 'x ray');
  SERVICES.filter((s) => label(s).includes(t)).forEach((s) => add(s));
  if (words.length > 1) SERVICES.filter((s) => words.every((w) => label(s).includes(w))).forEach((s) => add(s));

  // 2. Health topics described in the query. A kind of test ("scan", "MRI") plus a topic ("pregnancy")
  //    means that kind for that topic — otherwise everything related to each topic.
  const ids = conceptsIn(q);
  const kinds = ids.filter((i) => CONCEPTS[i]!.categories && !CONCEPTS[i]!.names);
  const topics = ids.filter((i) => !kinds.includes(i));
  const kindCats = new Set(kinds.flatMap((i) => CONCEPTS[i]!.categories!));
  let narrowed = false;
  if (kinds.length && topics.length) {
    for (const i of topics) {
      const within = servicesFor(CONCEPTS[i]!).filter((s) => kindCats.has(s.category));
      within.forEach((s) => add(s, `${CONCEPTS[i]!.label} · ${kinds.map((k) => CONCEPTS[k]!.label).join(', ')}`));
      if (within.length) narrowed = true;
    }
  }
  // Only a kind of test was named ("mri knee") and its exact tests were found → don't add the whole category.
  const onlyKindAndFound = !topics.length && hits.length > 0;
  if (!narrowed && !onlyKindAndFound) for (const i of ids) servicesFor(CONCEPTS[i]!).forEach((s) => add(s, CONCEPTS[i]!.label));

  // 3. Near-spellings of a test name ("lipd profile", "ultrsound").
  if (hits.length < 8) nameFuse.search(q, { limit: 12 }).forEach((r) => (r.score ?? 1) < 0.32 && add(r.item));

  return { hits, topics: ids.map((i) => CONCEPTS[i]!.label) };
}

/** Example descriptions shown under the search box. */
export const SEARCH_EXAMPLES = ['malaria', 'sugar level', 'kidney check', 'pregnancy', 'back pain', 'heart'];
