/**
 * Organisation settings for the Referrer Portal: the ONE place for company
 * and branch facts.
 *
 * Company and branch come from the STANLEY desktop app (the same data the
 * dashboard uses): the real Abuja branch, BR001. Details the dashboard has no
 * record of yet stay "Not on record", never invented.
 *
 * Compliance (2026-11-24): this app is an e-request and results portal for
 * verified, licensed clinicians. It has NO referral payments of any kind
 * (MDCN Code: no fee-splitting), so there are no commission rules here.
 */
import CATALOGUE from '@/data/catalogue.generated.json';

const NOT_ON_RECORD = 'Not on record';
const known = (v: string | undefined) => (v && v !== NOT_ON_RECORD ? v : null);

export const COMPANY = {
  /** "Silhouette Diagnostic Consultants" */
  name: CATALOGUE.company.name,
  shortName: CATALOGUE.company.shortName,
  appName: 'STANLEY',
  appTagline: 'REFERRER PORTAL',
  /** Placeholders the company fills in (privacy notices, DPO). */
  dpo: { name: 'Data Protection Officer (to be appointed)', email: 'dpo@silhouette.example', phone: 'Not on record yet', address: 'Not on record yet' },
};

const b = CATALOGUE.branch;
export const BRANCH = {
  /** Same id as the dashboard ("br001-abuja"). */
  id: b.id,
  code: b.code,
  name: b.name,
  city: b.city,
  /** "Silhouette, Abuja Branch" */
  label: `${CATALOGUE.company.shortName}, ${b.name} Branch`,
  /** Prefix of request IDs: the dashboard's Billing reads "ABJ-R" + 6 digits. */
  idCode: b.idCode,
  /** null = the dashboard has no record of it yet. */
  address: known(b.address),
  phone: known(b.phone),
  manager: known(b.manager),
};

/** What users see for their role. */
export const ROLE_LABEL = 'Referring clinician';
