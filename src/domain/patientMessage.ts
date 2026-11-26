/**
 * The message the PATIENT receives about their referral (owner, 2026-11-26):
 * the PR agent sends it from their own phone, by WhatsApp or by SMS (many
 * patients have a button phone, so SMS must always work). It carries what
 * the patient needs at the branch:
 *   the referral ID (the front desk types it and the patient's details and
 *   tests come up; they only take the payment), each test with its price
 *   and when it is done, the total (and any reduction asked for), and how to
 *   prepare (optional).
 * Always at the bottom: "for more clarification on preparation, please
 * contact" the company, the branch's full address, Google Maps link, phone
 * and opening hours (branch settings), and "for more description, please
 * contact" the company with its number.
 * Button phones cut long texts, so they get a short plain SMS instead
 * (shortSmsText), and the agent writes the referral ID on paper for them.
 * Every send is written to the audit log with the channel.
 */
import { BRANCH, COMPANY } from '@/config/org';
import { naira } from './format';
import { quoteOf, servicesOf, type Referral } from './referrals';
import { logAudit } from './audit';
import { branchStatus, ruleOf, testStatus, useAvailability, whenText, windowText } from './availability';
import { useReceiptProfile } from '@company/services/receiptProfile';
import { useBranchProfile } from '@company/services/settingsStore';
import { weekText } from '@company/services/openingHours';

export interface BranchContact {
  address: string | null;
  phone: string | null;
  /** Google Maps link (branch settings). */
  mapLink: string | null;
}
/** The branch's address, phone and map link as the admin or manager set them (branch settings), else the records. */
export function useBranchContact(): BranchContact {
  const p = useReceiptProfile();
  const prof = useBranchProfile(BRANCH.id);
  const c = p.branches[BRANCH.id];
  return { address: c?.address?.trim() || BRANCH.address, phone: c?.phone?.trim() || BRANCH.phone, mapLink: prof.mapLink?.trim() || null };
}

export interface MessageOpts {
  prep: boolean;
  contact: BranchContact;
  agent: string;
  avail: ReturnType<typeof useAvailability>;
}

/** An address typed on several lines, on one line. */
const oneLine = (t: string) =>
  t
    .split(/\n+/)
    .map((x) => x.trim().replace(/,$/, ''))
    .filter(Boolean)
    .join(', ');
/** "Silhouette Diagnostics on 0803 123 4567" (or the branch, when no phone is on record). */
const contactLine = (phone: string | null) => (phone ? `${COMPANY.name} on ${phone}` : `${COMPANY.name}, ${BRANCH.name} branch`);

/** The full message: WhatsApp, or SMS to a smartphone (long messages arrive whole there). */
export function patientMessageText(r: Referral, opts: MessageOpts): string {
  const first = r.patient.name.split(' ')[0] ?? r.patient.name;
  const tests = servicesOf(r);
  const total = quoteOf(r);
  const branch = branchStatus(opts.avail);
  const who = contactLine(opts.contact.phone);
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
    // Preparation: the steps when the agent includes them, and always who to ask.
    ...(opts.prep && prep.length ? ['How to prepare:', ...prep.map((p) => `• ${p}`)] : []),
    `For more clarification on preparation, please contact ${who}.`,
    ``,
    // Always at the bottom: where to go and how to reach the branch.
    `Where to go: ${COMPANY.name}, ${BRANCH.name} branch`,
    `Address: ${opts.contact.address ? oneLine(opts.contact.address) : 'ask the branch, the address is not on record yet'}`,
    ...(opts.contact.mapLink ? [`Google Maps: ${opts.contact.mapLink}`] : []),
    `Phone: ${opts.contact.phone ?? 'not on record yet'}`,
    `Opening hours: ${weekText(opts.avail.hours)}. ${branch.ok ? 'Open now.' : branch.next ? `Closed now, opens ${whenText(branch.next)}.` : 'Closed now.'}${branch.note ? ` ${branch.note}.` : ''}`,
    ``,
    `For more description, please contact ${who}.`,
  ].join('\n');
}

/* ─────────────── SMS for button phones ─────────────── */

/**
 * Button phones cut long texts, and any character outside the basic SMS
 * alphabet (₦, curly quotes, dashes, bullets) makes every part hold 70
 * characters instead of 160. So the short SMS keeps to plain characters and
 * to what the patient must have: the referral ID first, where to go, when it
 * is open, the total and the number to call.
 */
const GSM_CHARS = new Set(
  '@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà\n'.split(''),
);
export function toPlainSms(t: string): string {
  return t
    .replace(/₦/g, 'N')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/…/g, '...')
    .split('')
    .filter((c) => GSM_CHARS.has(c))
    .join('');
}
/** How many SMS parts a plain text takes (160 characters for one, 153 each when split). */
export const smsParts = (t: string) => (t.length <= 160 ? 1 : Math.ceil(t.length / 153));

export function shortSmsText(r: Referral, opts: MessageOpts): string {
  const tests = servicesOf(r);
  const total = `N${quoteOf(r).toLocaleString('en-NG')}`;
  const first = r.patient.name.split(' ')[0] ?? r.patient.name;
  const address = opts.contact.address ? oneLine(opts.contact.address) : '';
  // "Mon to Fri 7:30 to 20:00" → "Mon-Fri 7:30-20:00"
  const hours = weekText(opts.avail.hours).replace(/ to /g, '-');
  const build = (names: boolean, addr: string) =>
    toPlainSms(
      [
        `${COMPANY.name}: ${first}, your referral ID is ${r.id}. Show it at the front desk.`,
        `Go to: ${BRANCH.name} branch${addr ? `, ${addr}` : ''}.`,
        `Open: ${hours}.`,
        names ? `Tests: ${tests.map((s) => s.name).join(', ')}. Total ${total}.` : `${tests.length} test${tests.length === 1 ? '' : 's'}, total ${total}.`,
        `Preparation/questions: call ${opts.contact.phone ?? 'the branch'}.`,
      ].join('\n'),
    );
  // Two parts if possible by dropping the test names (the branch has them under the
  // referral ID). The full address stays unless the text would pass three parts.
  let t = build(true, address);
  if (smsParts(t) > 2) t = build(false, address);
  if (smsParts(t) > 3 && address) t = build(false, address.split(',').slice(0, 3).join(','));
  return t;
}

/** What the agent writes on paper for a patient with a button phone. */
export function paperNote(r: Referral, opts: MessageOpts) {
  return {
    id: r.id,
    branch: `${COMPANY.name}, ${BRANCH.name} branch`,
    address: opts.contact.address ? oneLine(opts.contact.address) : null,
    phone: opts.contact.phone,
    hours: weekText(opts.avail.hours),
  };
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

export function logPatientMessage(r: Referral, channel: 'whatsapp' | 'sms' | 'sms-short') {
  logAudit({ type: 'patient.message', requestId: r.id, channel });
}
