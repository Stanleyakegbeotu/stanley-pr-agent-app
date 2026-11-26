/**
 * The message the PATIENT receives about their referral (owner, 2026-11-26):
 * the PR agent sends it from their own phone, by WhatsApp or by SMS (many
 * patients have a button phone, so SMS must always work). It carries what
 * the patient needs at the branch:
 *   the referral ID (the front desk types it and the patient's details and
 *   tests come up; they only take the payment), the branch's name, full
 *   address, phone and hours, each test with its price and when it is done,
 *   the total (and any reduction asked for), and how to prepare (optional).
 * Every send is written to the audit log with the channel.
 */
import { BRANCH, COMPANY } from '@/config/org';
import { naira } from './format';
import { quoteOf, servicesOf, type Referral } from './referrals';
import { logAudit } from './audit';
import { branchStatus, ruleOf, testStatus, useAvailability, whenText, windowText } from './availability';
import { useReceiptProfile } from '@company/services/receiptProfile';

export interface BranchContact {
  address: string | null;
  phone: string | null;
}
/** The branch's address and phone as the admin or manager set them (receipts), else the records. */
export function useBranchContact(): BranchContact {
  const p = useReceiptProfile();
  const c = p.branches[BRANCH.id];
  return { address: c?.address?.trim() || BRANCH.address, phone: c?.phone?.trim() || BRANCH.phone };
}

export function patientMessageText(r: Referral, opts: { prep: boolean; contact: BranchContact; agent: string; avail: ReturnType<typeof useAvailability> }): string {
  const first = r.patient.name.split(' ')[0] ?? r.patient.name;
  const tests = servicesOf(r);
  const total = quoteOf(r);
  const branch = branchStatus(opts.avail);
  const lines = tests.map((s, i) => {
    // Only tests with their own times get a note (the opening hours are given once below).
    const rule = ruleOf(s.id, s.category, opts.avail);
    const st = testStatus(s.id, s.category, opts.avail);
    const when = rule.kind === 'schedule' ? ` (done ${windowText(rule)}${st.ok ? ', available now' : st.next ? `, next ${whenText(st.next)}` : ''})` : rule.kind === 'off' ? ` (${st.detail.replace(/\.$/, '').toLowerCase()})` : '';
    return `${i + 1}. ${s.name}: ${s.price == null ? 'price at the branch' : naira(s.price)}${when}`;
  });
  const prep = tests.filter((s) => s.preparation).map((s) => `${s.name}: ${s.preparation}`);
  return [
    `Hello ${first},`,
    ``,
    `${opts.agent} has referred you to ${COMPANY.name}, ${BRANCH.name} branch, for these tests:`,
    ...lines,
    `Total: ${naira(total)}${r.priceAsk ? `, with ${naira(r.priceAsk.amount)} off asked for you (the branch confirms it)` : ''}. The branch confirms the final price.`,
    ``,
    `Your referral ID: ${r.id}`,
    `Show this ID at the front desk. They will find your details and tests, and you only pay.`,
    ``,
    `Where to go: ${COMPANY.name}, ${BRANCH.name} branch`,
    `Address: ${opts.contact.address ?? 'ask the branch, the address is not on record yet'}`,
    `Phone: ${opts.contact.phone ?? 'not on record yet'}`,
    `Opening hours: ${windowText(opts.avail.hours)}. ${branch.ok ? 'Open now.' : branch.next ? `Closed now, opens ${whenText(branch.next)}.` : 'Closed now.'}${branch.note ? ` ${branch.note}.` : ''}`,
    ...(opts.prep && prep.length ? ['', 'How to prepare:', ...prep.map((p) => `• ${p}`)] : []),
  ].join('\n');
}

/** 0803 123 4567 → 2348031234567 (WhatsApp and SMS need the country code). */
export function intlNumber(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('234')) return d;
  if (d.startsWith('0')) return `234${d.slice(1)}`;
  return d;
}

/** Opens WhatsApp on a chat with the patient's number and the message typed in (no need to save the contact first). */
export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${intlNumber(phone)}?text=${encodeURIComponent(text)}`;
}
/** Opens the phone's Messages app with the number and the message typed in. */
export function smsLink(phone: string, text: string) {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return `sms:+${intlNumber(phone)}${ios ? '&' : '?'}body=${encodeURIComponent(text)}`;
}

export function logPatientMessage(r: Referral, channel: 'whatsapp' | 'sms') {
  logAudit({ type: 'patient.message', requestId: r.id, channel });
}
