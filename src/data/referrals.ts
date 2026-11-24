/**
 * Sample requests for the sample clinician (compliance rebuild, 2026-11-24),
 * using REAL tests and prices from the Abuja catalogue. Dates are relative to
 * today. These are demo data until the server sends the clinician's own
 * requests (domain/api fetchMyRequests).
 */
import { referralId, type Referral, type Urgency } from '@/domain/referrals';
import { serviceByName } from './services';

/** Branch progress for a sample: a = arrived, t = tests done, r = results ready, '' = nothing yet. */
type Progress = '' | 'a' | 't' | 'r';
type Seed = [name: string, tests: string[], progress: Progress, daysAgo: number, phone: string, gender: 'Male' | 'Female', age: number, urgency?: Urgency, notDone?: string[], indication?: string];

// Newest first. Test names exactly as recorded in the catalogue.
const SEEDS: Seed[] = [
  ['John Adeyemi', ['LEG X RAY', 'KNEE MRI'], 'r', 0, '8034567890', 'Male', 42, 'Routine', undefined, 'Knee pain after a fall 2 weeks ago, swelling, rule out fracture.'],
  ['Mary Okafor', ['ABDOMINOPELVIC SCAN'], 'a', 0, '8023344556', 'Female', 35],
  ['Tunde Bakare', ['FASTING LIPID PROFILE', 'FBS', 'E/U/C'], 't', 0, '7061234567', 'Male', 51, 'Routine', ['FBS']],
  ['Aisha Bello', ['FULL BLOOD COUNT', 'MP'], '', 0, '8159876543', 'Female', 27, 'Urgent'],
  ['Chinedu Obi', ['THYROID MARKERS (T3,T4,TSH)'], '', 0, '9032221100', 'Male', 39],
  ['Emeka Igwe', ['CT ABDOMEN WITH CONTRAST'], 'a', 1, '8067788990', 'Male', 58, 'Urgent', undefined, 'Right upper abdominal pain and weight loss, suspected mass on ultrasound.'],
  ['Faith Obi', ['E/U/C', 'LIVER FUNCTION TEST (LFT)'], '', 2, '7012345678', 'Female', 31],
  ['Halima Yusuf', ['PELVIC ULTRASOUND'], 'r', 3, '8134455667', 'Female', 29],
  ['Kelechi Nwankwo', ['CHEST (AP)', 'FULL BLOOD COUNT'], 'r', 6, '8091122334', 'Male', 46, 'Routine', undefined, 'Cough for 3 weeks with fever, rule out chest infection.'],
  ['Grace Eze', ['OBSTETRICS SCAN'], 'r', 10, '8145566778', 'Female', 44],
  ['Ibrahim Musa', ['ECG'], 'r', 15, '8037788112', 'Male', 63],
  ['Samuel Ojo', ['FBS', 'FASTING LIPID PROFILE'], '', 26, '8126677889', 'Male', 55],
  ['Bisi Adebayo', ['ABDOMINOPELVIC SCAN'], 'r', 21, '7039988776', 'Female', 38],
  ['Zainab Sani', ['THYROID MARKERS (T3,T4,TSH)', 'FULL BLOOD COUNT', 'E/U/C'], 'r', 29, '9011223344', 'Female', 33, 'Routine', ['E/U/C']],
  ['Ruth Alabi', ['PELVIC ULTRASOUND'], 'r', 37, '8169900112', 'Female', 30],
  ['Daniel Uche', ['KNEE MRI'], 'r', 41, '8022211334', 'Male', 36],
  ['Joy Nnamdi', ['WIDAL', 'MP'], '', 53, '8131122445', 'Female', 26],
  ['Musa Danjuma', ['CT BRAIN/HEAD'], 'r', 57, '8064433221', 'Male', 60, 'Urgent', undefined, 'Sudden severe headache with vomiting.'],
  ['Ada Nwosu', ['FASTING LIPID PROFILE'], 'r', 61, '9025566778', 'Female', 47],
  ['Hauwa Garba', ['ECG', 'ECHOCARDIOGRAPHY (ADULT)'], 'r', 75, '8152233445', 'Female', 57],
  ['Segun Ajayi', ['HB GENOTYPE', 'FULL BLOOD COUNT'], 'r', 120, '8035566220', 'Male', 45],
];

export const FIRST_SAMPLE_NUMBER = 842;
export const SAMPLE_CLINICIAN = 'RC-00842';

export function sampleReferrals(now = new Date()): Referral[] {
  return SEEDS.map(([name, tests, progress, daysAgo, phone, gender, age, urgency = 'Routine', notDone, indication], i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    // Spread the day's requests over the morning, newest first, never in the future; a "today" sample stays today.
    d.setHours(Math.min(now.getHours(), 16), 0, 0, 0);
    d.setMinutes(Math.max(0, 50 - i * 7));
    if (d > now) d.setTime(Math.max(now.getTime() - (i + 1) * 9 * 60_000, daysAgo === 0 ? new Date(now).setHours(0, 0, 0, 0) : -Infinity));
    const at = (mins: number) => new Date(Math.min(now.getTime(), d.getTime() + mins * 60_000)).toISOString();
    const ids = (names: string[]) => names.map((n) => serviceByName(n)?.id).filter((x): x is string => !!x);
    const serviceIds = ids(tests);
    return {
      id: referralId(FIRST_SAMPLE_NUMBER - i),
      clinicianId: SAMPLE_CLINICIAN,
      patient: { name, phone, gender, age: String(age) },
      serviceIds,
      createdAt: d.toISOString(),
      urgency,
      indication,
      patientNotice: { version: '2026-11-v1', at: d.toISOString() },
      arrivedAt: progress ? at(40) : undefined,
      testsDoneAt: progress === 't' || progress === 'r' ? at(90) : undefined,
      resultsAt: progress === 'r' ? at(daysAgo === 0 ? 150 : 24 * 60) : undefined,
      doneServiceIds: notDone ? serviceIds.filter((id) => !ids(notDone).includes(id)) : undefined,
    };
  });
}
