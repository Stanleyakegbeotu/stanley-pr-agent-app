/**
 * Sample referral activity (owner's reference: All 28 · Pending 7 · Arrived 9),
 * using REAL services and prices from the Abuja catalogue. Dates are relative
 * to today so the dashboard always shows live-looking figures. Referrals the
 * agent creates in the app are real records and are saved on the phone (see
 * app/store.tsx); these samples are rebuilt each time.
 */
import { referralId, type Referral, type ReferralStatus } from '@/domain/referrals';
import { serviceByName } from './services';

type Seed = [name: string, services: string[], status: ReferralStatus, daysAgo: number, phone: string, gender: 'Male' | 'Female', age: number];

// Newest first. Service names exactly as recorded in the catalogue.
// John: LEG X RAY ₦18,000 + KNEE MRI ₦160,000 = ₦178,000 → 15% = ₦26,700.
const SEEDS: Seed[] = [
  ['John Adeyemi', ['LEG X RAY', 'KNEE MRI'], 'Completed', 0, '8034567890', 'Male', 42],
  ['Mary Okafor', ['ABDOMINOPELVIC SCAN'], 'Arrived', 0, '8023344556', 'Female', 35],
  ['Tunde Bakare', ['FASTING LIPID PROFILE'], 'Completed', 0, '7061234567', 'Male', 51],
  ['Aisha Bello', ['FULL BLOOD COUNT', 'MP'], 'Pending', 0, '8159876543', 'Female', 27],
  ['Chinedu Obi', ['THYROID MARKERS (T3,T4,TSH)'], 'Pending', 0, '9032221100', 'Male', 39],
  ['Emeka Igwe', ['CT ABDOMEN WITH CONTRAST'], 'Pending', 1, '8067788990', 'Male', 58],
  ['Faith Obi', ['E/U/C', 'LIVER FUNCTION TEST (LFT)'], 'Pending', 2, '7012345678', 'Female', 31],
  ['Halima Yusuf', ['PELVIC ULTRASOUND'], 'Completed', 3, '8134455667', 'Female', 29],
  ['Kelechi Nwankwo', ['CHEST (AP)', 'FULL BLOOD COUNT'], 'Completed', 6, '8091122334', 'Male', 46],
  ['Grace Eze', ['OBSTETRICS SCAN'], 'Completed', 10, '8145566778', 'Female', 44],
  ['Ibrahim Musa', ['ECG'], 'Completed', 15, '8037788112', 'Male', 63],
  ['Bisi Adebayo', ['ABDOMINOPELVIC SCAN'], 'Completed', 21, '7039988776', 'Female', 38],
  ['Samuel Ojo', ['FBS', 'FASTING LIPID PROFILE'], 'Pending', 26, '8126677889', 'Male', 55],
  ['Zainab Sani', ['THYROID MARKERS (T3,T4,TSH)'], 'Arrived', 29, '9011223344', 'Female', 33],
  ['Peter Okon', ['LEG X RAY'], 'Arrived', 33, '8056677001', 'Male', 24],
  ['Ruth Alabi', ['PELVIC ULTRASOUND'], 'Arrived', 37, '8169900112', 'Female', 30],
  ['Daniel Uche', ['KNEE MRI'], 'Arrived', 41, '8022211334', 'Male', 36],
  ['Fatima Lawal', ['E/U/C'], 'Arrived', 45, '7055443322', 'Female', 49],
  ['Victor Ede', ['CHEST (AP)'], 'Completed', 49, '8098877665', 'Male', 41],
  ['Joy Nnamdi', ['WIDAL', 'MP'], 'Pending', 53, '8131122445', 'Female', 26],
  ['Musa Danjuma', ['CT BRAIN/HEAD'], 'Arrived', 57, '8064433221', 'Male', 60],
  ['Ada Nwosu', ['FASTING LIPID PROFILE'], 'Completed', 61, '9025566778', 'Female', 47],
  ['Yemi Coker', ['ABDOMINOPELVIC SCAN'], 'Completed', 65, '8087766554', 'Female', 34],
  ['Uchenna Agu', ['PSA'], 'Arrived', 70, '7077889900', 'Male', 52],
  ['Hauwa Garba', ['ECG', 'ECHOCARDIOGRAPHY (ADULT)'], 'Completed', 75, '8152233445', 'Female', 57],
  ['Ola Fashola', ['URINALYSIS'], 'Pending', 80, '8048899001', 'Male', 28],
  ['Ifeoma Chukwu', ['MRI BRAIN'], 'Arrived', 85, '8119988007', 'Female', 37],
  ['Segun Ajayi', ['HB GENOTYPE', 'FULL BLOOD COUNT'], 'Completed', 90, '8035566220', 'Male', 45],
];

export const FIRST_SAMPLE_NUMBER = 842;

export function sampleReferrals(now = new Date()): Referral[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 10, 0, 0);
  return SEEDS.map(([name, services, status, daysAgo, phone, gender, age], i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    // Spread the day's referrals over the morning, newest first, never in the future.
    d.setHours(Math.min(now.getHours(), 16), 0, 0, 0);
    d.setMinutes(Math.max(0, 50 - i * 7));
    if (d > now) d.setTime(now.getTime() - (i + 1) * 9 * 60_000);
    const createdAt = d.toISOString();
    // Commission for completed referrals from earlier months was paid on the 1st of this month.
    const paidAt = status === 'Completed' && d < monthStart ? monthStart.toISOString() : undefined;
    const serviceIds = services.map((n) => serviceByName(n)?.id).filter((x): x is string => !!x);
    return { id: referralId(FIRST_SAMPLE_NUMBER - i), patient: { name, phone, gender, age: String(age) }, serviceIds, status, createdAt, paidAt };
  });
}
