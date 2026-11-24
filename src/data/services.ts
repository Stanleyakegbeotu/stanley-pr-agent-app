/**
 * Service catalogue at the agent's branch (sample prices from the owner's
 * reference design). When the cloud database is connected this list comes
 * from the dashboard's live catalogue instead.
 */
import type { PhotoKey, StickerKey } from '@/assets';

export type Category = 'Laboratory' | 'Radiology' | 'Ultrasound' | 'Cardiology';
export const CATEGORIES: Category[] = ['Laboratory', 'Radiology', 'Ultrasound', 'Cardiology'];

export interface Service {
  id: string;
  name: string;
  /** Short name for lists ("X-Ray – Leg"). */
  short: string;
  category: Category;
  price: number;
  /** One line under the name. */
  description: string;
  purpose: string;
  preparation: string;
  procedure: string;
  /** Photo shown in lists and on the details page… */
  photo?: PhotoKey;
  /** …or a sticker when there is no suitable photo. */
  sticker?: StickerKey;
  /** Extra words people search with. */
  aliases: string;
}

export const SERVICES: Service[] = [
  { id: 'mri-knee', name: 'MRI – Knee', short: 'MRI', category: 'Radiology', price: 85_000, description: 'Detailed imaging of the knee joint, ligaments and soft tissues.', purpose: 'Shows ligaments, cartilage, menisci and bone in fine detail to help assess knee injuries and joint problems.', preparation: 'Remove all metal items. Tell staff about pacemakers, implants or pregnancy.', procedure: 'Non-invasive scan · about 30–45 minutes', photo: 'mri', aliases: 'mri knee magnetic resonance joint ligament' },
  { id: 'xray-leg', name: 'X-Ray – Leg', short: 'X-Ray', category: 'Radiology', price: 18_000, description: 'Imaging to assess bones, fractures and structural changes.', purpose: 'Helps confirm fractures, bone alignment and other structural changes in the leg.', preparation: 'Remove metallic items around the area. Inform staff if pregnant.', procedure: 'Quick imaging · about 10 minutes', photo: 'xray', aliases: 'xray x ray leg bone fracture radiograph' },
  { id: 'ct-abdomen', name: 'CT Scan – Abdomen', short: 'CT Scan', category: 'Radiology', price: 120_000, description: 'Detailed cross-sectional imaging of abdominal organs.', purpose: 'Gives cross-sectional images of the liver, kidneys, bowel and other abdominal organs.', preparation: 'May require fasting and contrast — confirm with the branch before the visit.', procedure: 'Cross-sectional imaging · about 20 minutes', photo: 'ct', aliases: 'ct cat scan abdomen tomography' },
  { id: 'us-abdomen', name: 'Ultrasound – Abdomen', short: 'Ultrasound', category: 'Ultrasound', price: 25_000, description: 'Non-invasive imaging of abdominal organs (liver, kidney, etc.).', purpose: 'Examines the liver, kidneys, gallbladder, spleen and other abdominal organs using sound waves.', preparation: 'Fasting for about 6 hours is usually required.', procedure: 'Non-invasive scan · about 20 minutes', photo: 'ultrasound', aliases: 'ultrasound sonography scan abdomen liver kidney' },
  { id: 'us-pelvic', name: 'Ultrasound – Pelvic', short: 'Ultrasound', category: 'Ultrasound', price: 22_000, description: 'Imaging of the bladder and pelvic organs.', purpose: 'Assesses the bladder, uterus, ovaries or prostate.', preparation: 'A full bladder is usually needed — drink water before the scan.', procedure: 'Non-invasive scan · about 20 minutes', photo: 'ultrasound', aliases: 'pelvic ultrasound scan bladder uterus prostate' },
  { id: 'lab-panel', name: 'Comprehensive Lab Panel', short: 'Lab Tests', category: 'Laboratory', price: 30_000, description: 'Blood count, kidney, liver and sugar tests in one visit.', purpose: 'A broad health check covering blood count, kidney and liver function and blood sugar.', preparation: 'Fasting for 8–10 hours is recommended.', procedure: 'Blood sample', photo: 'lab', aliases: 'lab tests panel blood checkup wellness' },
  { id: 'fbc', name: 'Full Blood Count', short: 'Full Blood Count', category: 'Laboratory', price: 8_000, description: 'A closer look at blood cells and overall health.', purpose: 'Measures red cells, white cells and platelets to help investigate anaemia, infection and other conditions.', preparation: 'No special preparation required.', procedure: 'Blood sample', photo: 'blood', aliases: 'fbc cbc complete blood count' },
  { id: 'lipid', name: 'Lipid Profile', short: 'Lipid Profile', category: 'Laboratory', price: 12_000, description: 'Cholesterol and heart-health markers.', purpose: 'Measures cholesterol and triglycerides to support assessment of cardiovascular risk.', preparation: 'Fasting for 9–12 hours is recommended.', procedure: 'Blood sample', photo: 'blood', aliases: 'cholesterol heart lipids' },
  { id: 'thyroid', name: 'Thyroid Function Test', short: 'Thyroid Test', category: 'Laboratory', price: 20_000, description: 'Checks the hormones that regulate metabolism.', purpose: 'Measures thyroid hormone levels to help assess thyroid function.', preparation: 'Tell the branch about any medication the patient takes.', procedure: 'Blood sample', photo: 'blood', aliases: 'tft tsh thyroid hormones' },
  { id: 'chest-xray', name: 'X-Ray – Chest', short: 'Chest X-Ray', category: 'Radiology', price: 10_000, description: 'Imaging of the chest, heart and lungs.', purpose: 'Provides an image of the lungs, heart and chest structures to support clinical assessment.', preparation: 'Remove metallic items. Inform staff if pregnant.', procedure: 'Quick imaging · about 10 minutes', photo: 'xray', aliases: 'chest xray lungs radiograph' },
  { id: 'ecg', name: 'Resting ECG', short: 'ECG', category: 'Cardiology', price: 10_000, description: 'A simple check of the heart’s electrical activity.', purpose: 'Records heart rhythm and electrical activity to help identify irregularities.', preparation: 'Avoid lotions on the chest before the visit.', procedure: 'Non-invasive recording · about 10 minutes', sticker: 'stethoscope', aliases: 'ecg ekg electrocardiogram heart rhythm' },
];

export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);

export function searchServices(q: string, category: Category | 'All' = 'All') {
  const t = q.trim().toLowerCase();
  return SERVICES.filter((s) => (category === 'All' || s.category === category) && (!t || `${s.name} ${s.category} ${s.aliases}`.toLowerCase().includes(t)));
}
