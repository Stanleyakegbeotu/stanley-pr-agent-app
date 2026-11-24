/**
 * The message the PATIENT receives about their request (compliance,
 * 2026-11-24). It is sent by Silhouette through a company channel (SMS or
 * WhatsApp Business API), never from the clinician's personal WhatsApp.
 *
 * TODO(backend): sendPatientMessage() posts to the company messaging service.
 * Until it is connected the app shows a preview and queues nothing on the
 * clinician's phone.
 */
import { BRANCH, COMPANY } from '@/config/org';
import { naira } from './format';
import { quoteOf, servicesOf, type Referral } from './referrals';
import { logAudit } from './audit';

/** Where the patient privacy notice will live (placeholder until published). */
export const PATIENT_PRIVACY_URL = 'https://silhouette.example/patient-privacy';

export function patientMessageText(r: Referral): string {
  const first = r.patient.name.split(' ')[0] ?? r.patient.name;
  const tests = servicesOf(r);
  const prep = Array.from(new Set(tests.map((s) => s.preparation).filter(Boolean))).slice(0, 3);
  return [
    `Hello ${first},`,
    ``,
    `Your clinician has requested these tests at ${COMPANY.name}, ${BRANCH.name} branch:`,
    ...tests.map((s) => `• ${s.name}`),
    ``,
    `Request ID: ${r.id} (show this at the front desk).`,
    `Branch address: ${BRANCH.address ?? 'the branch will send its address'}`,
    ...(prep.length ? ['', 'How to prepare:', ...prep.map((p) => `• ${p}`)] : []),
    ``,
    `Quoted price: ${naira(quoteOf(r))}. The final price is confirmed at the branch.`,
    ``,
    `How we use your information: ${PATIENT_PRIVACY_URL}`,
  ].join('\n');
}

export type MessageState = 'not-connected' | 'sent';

/** TODO(backend): POST /requests/:id/notify-patient (company SMS / WhatsApp Business). */
export async function sendPatientMessage(r: Referral): Promise<MessageState> {
  logAudit({ type: 'patient.message', requestId: r.id });
  return 'not-connected';
}
