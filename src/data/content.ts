/**
 * Announcements, campaigns, notifications, help and training content (samples).
 * When the server is connected these come from the company.
 *
 * Compliance (2026-11-24):
 *  • No money content for clinicians (no commission, targets or rewards).
 *  • Campaigns are patient-facing health information or offers open to ALL
 *    patients, and only show once they carry an ARCON approval (ARCON Act 2022).
 *  • Notifications never contain patient names or tests; details are only
 *    inside the unlocked app.
 */
import type { StickerKey } from '@/assets';
import type { RoutePath } from '@/app/routes';
import { SERVICES } from './services';

export interface Announcement {
  id: string;
  kicker: string;
  title: string;
  text: string;
  cta: string;
  to: RoutePath;
  /** Card gradient (all in the app's blue family, one accent each). */
  theme: 'blue' | 'indigo' | 'teal' | 'violet';
  sticker: StickerKey;
  /** Short word on the pill ("NEW"). */
  badge?: string;
  /** Show the rising bar chart behind the sticker. */
  chart?: boolean;
  date: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  { id: 'results', kicker: 'New', title: 'Results in\nthe app', text: 'Signed-off results for your own patients, kept for 90 days.', cta: 'Open Results', to: '/results', theme: 'blue', sticker: 'womanHealthWorker', badge: 'NEW', date: 'This week' },
  { id: 'erequest', kicker: 'Requests', title: 'No more\npaper forms', text: 'Send the request with the clinical reason. Silhouette tells the patient the tests and price.', cta: 'New request', to: '/refer', theme: 'indigo', sticker: 'clipboard', date: 'Now available' },
  { id: 'prep', kicker: 'Patient care', title: 'Preparing\npatients', text: 'Fasting, full bladder and metal-free tips for every test.', cta: 'Read the guide', to: '/training/preparation', theme: 'teal', sticker: 'calendar', date: 'Guide' },
  { id: 'catalogue', kicker: 'Abuja Branch', title: `${SERVICES.length} tests,\none request`, text: 'Lab, X-ray, MRI, ultrasound, CT and more, with prices and preparation.', cta: 'View tests', to: '/services', theme: 'violet', sticker: 'hospital', badge: String(SERVICES.length), date: 'Now available' },
];

export interface Campaign {
  id: string;
  title: string;
  text: string;
  period: string;
  sticker: StickerKey;
  status: 'Active' | 'Upcoming' | 'Ended';
  /** ARCON approval (reference + date). Without it the campaign is not shown. */
  arconApproval?: { reference: string; date: string };
}
export const CAMPAIGNS: Campaign[] = [
  {
    id: 'screening',
    title: 'Free Health Screening Week',
    text: 'Free blood pressure and blood sugar checks for anyone who visits the branch during the week. Share this information with patients who may benefit.',
    period: 'Mon to Sat, next week',
    sticker: 'stethoscope',
    status: 'Upcoming',
    // TODO(company): replace with the real ARCON approval reference and date.
    arconApproval: { reference: 'Sample reference, replace with ARCON approval', date: '2026-11-10' },
  },
  { id: 'women', title: 'Women’s Wellness Month', text: 'Pelvic ultrasound and thyroid tests at a reduced price for all women this month.', period: 'All this month', sticker: 'womanHealthWorker', status: 'Active' },
];
/** Only campaigns with an ARCON approval may be shown. */
export const approvedCampaigns = () => CAMPAIGNS.filter((c) => c.arconApproval?.reference && c.arconApproval.date);

/* Conversations: see data/team.ts (branch inboxes). */

export interface Notice {
  id: string;
  title: string;
  text: string;
  when: string;
  sticker: StickerKey;
  to?: RoutePath;
}
/** Generic on purpose: no patient names or tests in notifications. */
export const NOTIFICATIONS: Notice[] = [
  { id: 'n1', title: 'Results ready', text: 'Results are ready for one of your patients. Open the app to view them.', when: 'Today · 09:42', sticker: 'check', to: '/results' },
  { id: 'n2', title: 'Patient arrived', text: 'A patient you referred has arrived at the branch.', when: 'Today · 09:10', sticker: 'hospital', to: '/referrals' },
  { id: 'n3', title: 'Account verified', text: 'Silhouette has verified your licence. You can send requests.', when: 'This week', sticker: 'stethoscope', to: '/refer' },
];

export interface Faq {
  q: string;
  a: string;
}
export const FAQS: Faq[] = [
  { q: 'How do I send a request?', a: 'Tap the blue + button. Enter the patient’s details, choose the tests, add the clinical details and send. The patient gets a request ID to show at the front desk.' },
  { q: 'Why must I give a reason for X-ray and CT?', a: 'Imaging that uses radiation must be clinically justified (NNRA). Add the symptoms, findings and what you want to rule out. It also helps the radiologist report.' },
  { q: 'What does the patient receive?', a: 'Silhouette sends the patient the request ID, the branch address, the tests, how to prepare and the quoted price, with a link to the patient privacy notice. It never comes from your personal WhatsApp.' },
  { q: 'When do I get the results?', a: 'After the pathologist or radiologist signs them off. You get a notification without patient details, then open Results in the app. Results stay available for 90 days.' },
  { q: 'Who can see my patients’ information?', a: 'Only you, for the patients you requested tests for, and the Silhouette staff caring for them. Data on your phone is encrypted and the app locks with your PIN.' },
  { q: 'Can I send a request without internet?', a: 'Yes. It is saved on your phone, encrypted, and sent when you are back online.' },
];

export interface Resource {
  slug: string;
  title: string;
  text: string;
  minutes: number;
  sticker: StickerKey;
  body: string[];
}
export const RESOURCES: Resource[] = [
  { slug: 'first-request', title: 'Sending your first request', text: 'The four steps of an e-request, from patient details to sending.', minutes: 5, sticker: 'clipboard', body: ['Enter the patient’s full name and phone number (gender and age are optional).', 'Choose the tests by category or by name. Search help can suggest tests from a description, but you decide.', 'Add the clinical reason (required for X-ray and CT) and the urgency.', 'Tell the patient their details go to Silhouette, tick the box, and send. Give the patient the request ID.'] },
  { slug: 'services', title: 'Understanding diagnostic tests', text: 'The difference between lab tests, X-ray, CT, MRI and ultrasound.', minutes: 7, sticker: 'microscope', body: ['Laboratory tests use blood or other samples.', 'X-ray and CT use radiation and must be clinically justified; MRI uses no radiation and shows soft tissue best.', 'Ultrasound uses sound waves and is safe in pregnancy.'] },
  { slug: 'preparation', title: 'Preparing patients for their visit', text: 'Fasting, full bladder and metal-free tips that save time at the branch.', minutes: 4, sticker: 'calendar', body: ['Check each test’s preparation note before the patient travels.', 'Many blood tests and abdominal scans need fasting.', 'Pelvic ultrasound usually needs a full bladder.', 'Patients should remove metal before X-ray, CT and MRI, and tell staff if they may be pregnant.'] },
  { slug: 'results', title: 'Receiving results', text: 'When results appear, how long they stay and how to keep them confidential.', minutes: 3, sticker: 'check', body: ['Results appear after the specialist signs them off.', 'Only you can see results for the patients you requested tests for, for 90 days.', 'Results are watermarked with your name. Don’t screenshot or forward them; each view is recorded.'] },
];
