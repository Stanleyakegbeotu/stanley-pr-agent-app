/**
 * Announcements, campaigns, messages, help and training content (samples).
 * When the cloud database is connected these come from the company.
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
  /** Big figure on the pill ("15%"). */
  badge?: string;
  /** Show the rising bar chart behind the sticker. */
  chart?: boolean;
  date: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  { id: 'rate-15', kicker: 'Announcement', title: 'Your Commission\nis now 15%', text: 'We’ve increased your referral commission on eligible services.', cta: 'View Details', to: '/earnings', theme: 'blue', sticker: 'womanHealthWorker', badge: '15%', chart: true, date: 'This week' },
  { id: 'bonus', kicker: 'Monthly bonus', title: 'Earn ₦10,000\nextra this month', text: 'Reach 15 completed referrals this month and unlock your bonus.', cta: 'See My Target', to: '/targets', theme: 'indigo', sticker: 'trophy', badge: '₦10k', date: 'This month' },
  { id: 'screening', kicker: 'Campaign', title: 'Free Health\nScreening Week', text: 'Invite patients for free blood pressure and sugar checks at the branch.', cta: 'View Campaign', to: '/campaigns', theme: 'teal', sticker: 'manHealthWorker', badge: 'FREE', date: 'Starts Monday' },
  { id: 'catalogue', kicker: 'Abuja Branch', title: `${SERVICES.length} services,\none referral`, text: 'Lab, X-ray, MRI, ultrasound, CT and more. See every service and price.', cta: 'View Services', to: '/services', theme: 'violet', sticker: 'hospital', badge: String(SERVICES.length), date: 'Now available' },
];

export interface Campaign {
  id: string;
  title: string;
  text: string;
  period: string;
  sticker: StickerKey;
  status: 'Active' | 'Upcoming' | 'Ended';
}
export const CAMPAIGNS: Campaign[] = [
  { id: 'screening', title: 'Free Health Screening Week', text: 'Free blood pressure and blood sugar checks for every patient you refer during the week.', period: 'Mon to Sat, next week', sticker: 'stethoscope', status: 'Upcoming' },
  { id: 'women', title: 'Women’s Wellness Month', text: '10% off pelvic ultrasound and thyroid tests for women referred this month.', period: 'All this month', sticker: 'womanHealthWorker', status: 'Active' },
  { id: 'heart', title: 'Know Your Heart', text: 'Lipid profile + ECG package at a reduced price for patients over 40.', period: 'Last month', sticker: 'chart', status: 'Ended' },
];

/* Conversations: see data/team.ts (branch inboxes). */

export interface Notice {
  id: string;
  title: string;
  text: string;
  when: string;
  sticker: StickerKey;
  to?: RoutePath;
}
export const NOTIFICATIONS: Notice[] = [
  { id: 'n1', title: 'Patient completed', text: 'John Adeyemi’s X-Ray and MRI are completed. Commission confirmed.', when: 'Today · 09:42', sticker: 'check', to: '/referrals' },
  { id: 'n2', title: 'Patient arrived', text: 'Mary Okafor has arrived at the Abuja branch.', when: 'Today · 09:10', sticker: 'hospital', to: '/referrals' },
  { id: 'n3', title: 'Commission rate updated', text: 'Your commission is now 15% on eligible services.', when: 'This week', sticker: 'moneyBag', to: '/earnings' },
];

export interface Faq {
  q: string;
  a: string;
}
export const FAQS: Faq[] = [
  { q: 'How do I refer a patient?', a: 'Tap Refer (the blue + button), enter the patient’s details, choose the services and send. The patient gets a referral ID to show at the branch front desk.' },
  { q: 'When is my commission confirmed?', a: 'Your commission is an estimate until the patient’s tests are completed and paid at the branch. It is then confirmed and paid in the next payout.' },
  { q: 'How is commission calculated?', a: 'Commission is a percentage of the patient’s full bill for all the tests they do, currently 15%. ₦103,000 × 15% = ₦15,450.' },
  { q: 'Can I refer without internet?', a: 'Yes. The referral is saved on your phone and sent automatically when you are back online.' },
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
  { slug: 'first-referral', title: 'Your first referral, made simple', text: 'Create a referral and guide your patient through every step.', minutes: 5, sticker: 'clipboard', body: ['Open Refer and enter the patient’s full name and phone number.', 'Pick the services the doctor requested, the price and your estimated commission show as you go.', 'Review the summary and send. Share the referral ID with the patient; the front desk uses it to bill them.'] },
  { slug: 'services', title: 'Understanding diagnostic services', text: 'Know the difference between lab tests, X-ray, CT, MRI and ultrasound.', minutes: 7, sticker: 'microscope', body: ['Laboratory tests use blood or other samples.', 'X-ray, CT and MRI are imaging tests, MRI uses no radiation and shows soft tissue best.', 'Ultrasound uses sound waves and is safe in pregnancy.'] },
  { slug: 'preparation', title: 'Preparing patients for their visit', text: 'Fasting, full bladder and metal-free tips that save time at the branch.', minutes: 4, sticker: 'calendar', body: ['Check each service’s preparation note before the patient travels.', 'Many blood tests and abdominal scans need fasting.', 'Pelvic ultrasound usually needs a full bladder.'] },
];
