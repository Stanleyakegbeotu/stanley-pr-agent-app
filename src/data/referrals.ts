/**
 * Sample referral activity (owner's reference: All 28 · Pending 7 · Arrived 9).
 * Dates are relative to today so the dashboard always shows live-looking
 * figures. Referrals the agent creates in the app are real records and are
 * saved on the phone (see app/store.tsx); these samples are rebuilt each time.
 */
import { referralId, type Referral, type ReferralStatus } from '@/domain/referrals';

type Seed = [name: string, services: string[], status: ReferralStatus, daysAgo: number, phone: string, gender: 'Male' | 'Female', age: number];

// Newest first. Commission = full bill × 15%: John (X-Ray + MRI = ₦103,000) → ₦15,450.
const SEEDS: Seed[] = [
  ['John Adeyemi', ['xray-leg', 'mri-knee'], 'Completed', 0, '8034567890', 'Male', 42],
  ['Mary Okafor', ['us-abdomen'], 'Arrived', 0, '8023344556', 'Female', 35],
  ['Tunde Bakare', ['lipid'], 'Completed', 0, '7061234567', 'Male', 51],
  ['Aisha Bello', ['fbc'], 'Pending', 0, '8159876543', 'Female', 27],
  ['Chinedu Obi', ['thyroid'], 'Pending', 0, '9032221100', 'Male', 39],
  ['Emeka Igwe', ['ct-abdomen'], 'Pending', 1, '8067788990', 'Male', 58],
  ['Faith Obi', ['lab-panel'], 'Pending', 2, '7012345678', 'Female', 31],
  ['Halima Yusuf', ['us-pelvic'], 'Completed', 3, '8134455667', 'Female', 29],
  ['Kelechi Nwankwo', ['chest-xray', 'fbc'], 'Completed', 6, '8091122334', 'Male', 46],
  ['Grace Eze', ['lab-panel'], 'Completed', 10, '8145566778', 'Female', 44],
  ['Ibrahim Musa', ['ecg'], 'Completed', 15, '8037788112', 'Male', 63],
  ['Bisi Adebayo', ['us-abdomen'], 'Completed', 21, '7039988776', 'Female', 38],
  ['Samuel Ojo', ['fbc', 'lipid'], 'Pending', 26, '8126677889', 'Male', 55],
  ['Zainab Sani', ['thyroid'], 'Arrived', 29, '9011223344', 'Female', 33],
  ['Peter Okon', ['xray-leg'], 'Arrived', 33, '8056677001', 'Male', 24],
  ['Ruth Alabi', ['us-pelvic'], 'Arrived', 37, '8169900112', 'Female', 30],
  ['Daniel Uche', ['mri-knee'], 'Arrived', 41, '8022211334', 'Male', 36],
  ['Fatima Lawal', ['lab-panel'], 'Arrived', 45, '7055443322', 'Female', 49],
  ['Victor Ede', ['chest-xray'], 'Completed', 49, '8098877665', 'Male', 41],
  ['Joy Nnamdi', ['fbc'], 'Pending', 53, '8131122445', 'Female', 26],
  ['Musa Danjuma', ['ct-abdomen'], 'Arrived', 57, '8064433221', 'Male', 60],
  ['Ada Nwosu', ['lipid'], 'Completed', 61, '9025566778', 'Female', 47],
  ['Yemi Coker', ['us-abdomen'], 'Completed', 65, '8087766554', 'Female', 34],
  ['Uchenna Agu', ['thyroid'], 'Arrived', 70, '7077889900', 'Male', 52],
  ['Hauwa Garba', ['ecg', 'lipid'], 'Completed', 75, '8152233445', 'Female', 57],
  ['Ola Fashola', ['fbc'], 'Pending', 80, '8048899001', 'Male', 28],
  ['Ifeoma Chukwu', ['xray-leg'], 'Arrived', 85, '8119988007', 'Female', 37],
  ['Segun Ajayi', ['lab-panel'], 'Completed', 90, '8035566220', 'Male', 45],
];

export const FIRST_SAMPLE_NUMBER = 842;

export function sampleReferrals(now = new Date()): Referral[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 10, 0, 0);
  return SEEDS.map(([name, serviceIds, status, daysAgo, phone, gender, age], i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    // Spread the day's referrals over the morning, newest first, never in the future.
    d.setHours(Math.min(now.getHours(), 16), 0, 0, 0);
    d.setMinutes(Math.max(0, 50 - i * 7));
    if (d > now) d.setTime(now.getTime() - (i + 1) * 9 * 60_000);
    const createdAt = d.toISOString();
    // Commission for completed referrals from earlier months was paid on the 1st of this month.
    const paidAt = status === 'Completed' && d < monthStart ? monthStart.toISOString() : undefined;
    return { id: referralId(FIRST_SAMPLE_NUMBER - i), patient: { name, phone, gender, age: String(age) }, serviceIds, status, createdAt, paidAt };
  });
}
