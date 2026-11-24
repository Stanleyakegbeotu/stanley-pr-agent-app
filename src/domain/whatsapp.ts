/**
 * Share a referral with the patient on WhatsApp (owner, 2026-11-23).
 * Opens WhatsApp straight to the patient's number with the message ready —
 * the agent only presses Send. Works on phones (WhatsApp app) and computers
 * (WhatsApp Web). In the React Native app this same link opens via Linking.
 */
import { AGENT, BRANCH, COMPANY, agentName } from '@/config/org';
import { naira, phoneDigits } from './format';
import { billOf, servicesOf, type Referral } from './referrals';

export function referralMessage(r: Referral): string {
  const first = r.patient.name.split(' ')[0] ?? r.patient.name;
  const services = servicesOf(r).map((s) => `• ${s.name}`);
  return [
    `Hello ${first},`,
    ``,
    `You have been referred to *${COMPANY.name}*, ${BRANCH.name} branch, for:`,
    ...services,
    ``,
    `Your referral ID: *${r.id}*`,
    `Please show this ID at the front desk when you arrive.`,
    ``,
    `Estimated cost: ${naira(billOf(r))} (final price confirmed at the branch).`,
    ...(BRANCH.address ? [`Address: ${BRANCH.address}`] : []),
    ``,
    `Referred by ${agentName()}, ${AGENT.role}.`,
  ].join('\n');
}

/** wa.me link to the patient's Nigerian number (+234…). */
export function whatsappLink(phone: string, text: string): string {
  const d = phoneDigits(phone);
  return `https://wa.me/234${d}?text=${encodeURIComponent(text)}`;
}

export function shareOnWhatsApp(r: Referral) {
  window.open(whatsappLink(r.patient.phone, referralMessage(r)), '_blank', 'noopener');
}
