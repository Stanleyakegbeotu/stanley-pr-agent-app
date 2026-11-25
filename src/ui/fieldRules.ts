/**
 * What each kind of field accepts (owner, 2026-11-25), shared by the admin
 * and the Referrer Portal:
 *  • Phone numbers: digits only (and one + at the start for a country code).
 *    Letters and symbols never appear as you type. A Nigerian number is 11
 *    digits starting with 0 (08031234567) or +234 followed by 10 digits.
 *  • Email: no spaces; must have an @, a name before it and a full domain
 *    after it (name@gmail.com, name@yahoo.com, name@outlook.com).
 *  • People's names: letters, spaces, apostrophes, hyphens and full stops
 *    (Dr. Amaka O'Neil-Obi); no digits or symbols.
 *  • Website: looks like an address (example.com or https://example.com).
 *  • Amounts and account numbers: digits only.
 * The filters run as you type; the checks give one plain sentence.
 */

/** Keep digits and one leading +. */
export function onlyPhone(v: string): string {
  const t = v.replace(/[^\d+]/g, '');
  const plus = t.startsWith('+');
  return ((plus ? '+' : '') + t.replace(/\+/g, '')).slice(0, plus ? 16 : 15);
}

export function phoneProblem(v: string, required = false): string | null {
  const s = v.trim();
  if (!s) return required ? 'Enter a phone number.' : null;
  const d = s.replace(/\D/g, '');
  if (s.startsWith('+')) {
    if (d.startsWith('234')) return d.length === 13 ? null : 'A Nigerian number has 10 digits after +234, for example +2348031234567.';
    return d.length >= 8 && d.length <= 15 ? null : 'Enter the full number with the country code, for example +447911123456.';
  }
  if (s.startsWith('0')) return d.length === 11 ? null : `A phone number has 11 digits (you typed ${d.length}), for example 08031234567.`;
  return 'Start with 0, for example 08031234567, or with the country code, for example +234.';
}

/** Emails never contain spaces. */
export const onlyEmail = (v: string) => v.replace(/\s/g, '');

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export function emailProblem(v: string, required = false): string | null {
  const s = v.trim();
  if (!s) return required ? 'Enter an email address.' : null;
  if (!s.includes('@')) return 'An email address needs an @, for example name@gmail.com.';
  const [user, domain = ''] = s.split('@');
  if (!user) return 'Add your name before the @, for example name@gmail.com.';
  if (s.split('@').length > 2) return 'An email address has only one @.';
  if (!domain) return 'Add the part after the @, for example gmail.com.';
  if (!domain.includes('.')) return `Finish the address after the @, for example ${user}@${domain || 'gmail'}.com.`;
  return EMAIL_RE.test(s) ? null : 'Check the email address, for example name@gmail.com.';
}

/** Letters, spaces, apostrophes, hyphens and full stops. */
export const onlyName = (v: string) => v.replace(/[^\p{L}\s.'’-]/gu, '').replace(/\s{2,}/g, ' ');

export function nameProblem(v: string, required = true): string | null {
  const s = v.trim();
  if (!s) return required ? 'Enter the full name.' : null;
  return s.replace(/[^\p{L}]/gu, '').length < 2 ? 'Enter at least two letters.' : null;
}

export const onlyDigits = (v: string, max = 20) => v.replace(/\D/g, '').slice(0, max);

export function websiteProblem(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  return /^(https?:\/\/)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(\/\S*)?$/.test(s) ? null : 'Enter a website address, for example silhouette.ng or https://silhouette.ng.';
}
