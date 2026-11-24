/**
 * Results (compliance rebuild, 2026-11-24).
 *  • Only the requesting clinician sees a result, and only after the
 *    pathologist / radiologist has signed it off (flag from the branch).
 *  • Viewed in the app with a watermark; no download.
 *  • Access ends RESULT_ACCESS_DAYS after the result was released.
 *  • Every view is written to the audit log (domain/audit).
 *  • Results never go through chat.
 * Until the server is connected the reports below are SAMPLES, clearly marked.
 * TODO(backend): fetchResult() from domain/api replaces resultFor().
 */
import { categoryInfo } from '@/data/services';
import { notDoneOf, servicesOf, statusOf, type Referral } from './referrals';

export const RESULT_ACCESS_DAYS = 90;
const DAY = 86_400_000;

export interface ResultItem {
  serviceId: string;
  name: string;
  section: string;
  finding: string;
}
export interface ResultReport {
  requestId: string;
  signedOff: boolean;
  signedBy: string;
  signedAt: string;
  items: ResultItem[];
  notDone: string[];
  sample: boolean;
}

const IMAGING = new Set(['X-RAY', 'MRI', 'SCAN', 'CT SCAN', 'ECHO', 'ECG', 'EEG']);

export function resultFor(r: Referral): ResultReport | null {
  if (statusOf(r) !== 'ResultsReady' || !r.resultsAt) return null;
  const skip = new Set(notDoneOf(r).map((s) => s.id));
  const items = servicesOf(r)
    .filter((s) => !skip.has(s.id))
    .map((s) => ({
      serviceId: s.id,
      name: s.name,
      section: categoryInfo(s.category).label,
      finding: IMAGING.has(s.category) ? 'Sample report: no abnormality detected. The signed report from the branch replaces this text.' : 'Sample result: values within the reference ranges. The signed laboratory report from the branch replaces this text.',
    }));
  const imaging = items.some((i) => IMAGING.has(servicesOf({ serviceIds: [i.serviceId] })[0]?.category ?? ''));
  return { requestId: r.id, signedOff: true, signedBy: imaging ? 'Consultant radiologist' : 'Consultant pathologist', signedAt: r.resultsAt, items, notDone: notDoneOf(r).map((s) => s.name), sample: true };
}

/** Days left before access to this result ends (0 = expired). */
export function accessDaysLeft(r: Referral, now = Date.now()) {
  if (!r.resultsAt) return 0;
  return Math.max(0, Math.ceil((new Date(r.resultsAt).getTime() + RESULT_ACCESS_DAYS * DAY - now) / DAY));
}
