/**
 * Organisation settings for the PR agent app — the ONE place for company,
 * branch and agent facts and the business rules the app follows.
 *
 * Values follow the owner's reference design (2026-11-23). Branch contact
 * details marked "sample" are placeholders until the cloud database supplies
 * the real branch record.
 */

export const COMPANY = {
  name: 'Stanley Diagnostics',
  appName: 'STANLEY',
  appTagline: 'PR AGENT PORTAL',
};

export const BRANCH = {
  id: 'abuja',
  name: 'Abuja',
  label: 'Stanley Diagnostics – Abuja Branch',
  /** Prefix of referral IDs — must match the dashboard's Billing ("ABJ-R" + 6 digits). */
  idCode: 'ABJ',
  // Sample contact details — replaced by the real branch record when the cloud database is connected.
  address: 'Abuja, Federal Capital Territory (sample address)',
  hours: 'Monday – Saturday · 7:00am – 7:00pm',
  phone: '+234 800 000 0000 (sample)',
  email: 'abuja@example.com',
  manager: 'Branch Manager',
};

export const AGENT = {
  id: 'PR-00842',
  title: 'Dr.',
  firstName: 'Stanley',
  lastName: 'Okafor',
  role: 'PR Agent Partner',
  phone: '+234 803 456 7890',
  email: 'stanley.okafor@example.com',
  memberSince: '2025-01-12',
};

export const agentName = (a = AGENT) => `${a.title} ${a.firstName} ${a.lastName}`;
export const agentShortName = (a = AGENT) => `${a.title} ${a.firstName}`;

export const RULES = {
  /**
   * Company commission rate (owner rule): commission = the referred patient's
   * FULL bill × rate. ₦103,000 × 15% = ₦15,450.
   */
  commissionRate: 0.15,
  /** Monthly goals. */
  monthlyReferralTarget: 20,
  monthlyCompletedTarget: 15,
  completedBonus: 10_000,
};
