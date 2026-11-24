/**
 * Organisation settings for the PR agent app — the ONE place for company,
 * branch and agent facts and the business rules the app follows.
 *
 * Company and branch come from the STANLEY desktop app (the same data the
 * dashboard uses): the agent is assigned to the real Abuja branch, BR001.
 * Details the dashboard has no record of yet stay "Not on record" — never
 * invented. The agent profile is a sample until sign-in is connected.
 */
import CATALOGUE from '@/data/catalogue.generated.json';

const NOT_ON_RECORD = 'Not on record';
const known = (v: string | undefined) => (v && v !== NOT_ON_RECORD ? v : null);

export const COMPANY = {
  /** "Silhouette Diagnostic Consultants" */
  name: CATALOGUE.company.name,
  shortName: CATALOGUE.company.shortName,
  appName: 'STANLEY',
  appTagline: 'PR AGENT PORTAL',
};

const b = CATALOGUE.branch;
export const BRANCH = {
  /** Same id as the dashboard ("br001-abuja"). */
  id: b.id,
  code: b.code,
  name: b.name,
  city: b.city,
  /** "Silhouette – Abuja Branch" */
  label: `${CATALOGUE.company.shortName} – ${b.name} Branch`,
  /** Prefix of referral IDs — the dashboard's Billing reads "ABJ-R" + 6 digits. */
  idCode: b.idCode,
  /** null = the dashboard has no record of it yet. */
  address: known(b.address),
  phone: known(b.phone),
  manager: known(b.manager),
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
