/**
 * Bank details (owner, 2026-11-24): REQUIRED for every PR agent. Commission is
 * paid into this account, so until the agent adds bank name, account number
 * and account name, Home shows a "Required" card (and Profile and Earnings
 * say it is missing).
 */
import { useState } from 'react';
import { AlertTriangle, ChevronRight, Landmark, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '@/app/store';
import { saveProfile, useProfile, type BankDetails } from '@/domain/profile';
import { Button, Card, Field, ScreenHeader, Subtitle, inputClass } from '@/ui/kit';

/** Banks and payment banks commonly used in Nigeria. Any other bank can be typed in. */
const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank', 'First Bank of Nigeria', 'First City Monument Bank (FCMB)', 'Globus Bank', 'Guaranty Trust Bank (GTBank)',
  'Jaiz Bank', 'Keystone Bank', 'Kuda Bank', 'Moniepoint MFB', 'OPay', 'Optimus Bank', 'PalmPay', 'Parallex Bank', 'Polaris Bank', 'PremiumTrust Bank', 'Providus Bank',
  'Signature Bank', 'Stanbic IBTC Bank', 'Standard Chartered Bank', 'Sterling Bank', 'SunTrust Bank', 'Taj Bank', 'Titan Trust Bank', 'Union Bank of Nigeria',
  'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
];

export const maskAccount = (n: string) => `•••• ${n.slice(-4)}`;

/** Home: the required-settings card, shown until bank details are added. */
export function BankRequiredCard() {
  const { navigate } = useApp();
  const { bank } = useProfile();
  if (bank) return null;
  return (
    <section className="mb-5 overflow-hidden rounded-[22px] border border-[#f5c46b] bg-linear-to-br from-[#fff8e6] to-[#fff1d6] shadow-[0_10px_24px_rgba(180,110,10,0.12)]">
      <div className="flex items-start gap-3.5 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f59e0b] text-white shadow-[0_6px_14px_rgba(245,158,11,0.35)]">
          <Landmark size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[16px] font-bold text-[#7a4a00]">
            Add your bank details
            <span className="rounded-md bg-[#d93036] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Required</span>
          </p>
          <p className="mt-1 text-[13.5px] leading-snug text-[#8a5a12]">Your commission is paid into your bank account. Add your bank name, account number and account name so you can be paid.</p>
        </div>
      </div>
      <button type="button" onClick={() => navigate('/profile/bank')} className="press flex w-full items-center justify-between border-t border-[#f5d699] bg-white/60 px-4 py-3 text-[15px] font-semibold text-[#9a5b00]">
        Add bank details now <ChevronRight size={18} />
      </button>
    </section>
  );
}

/** Profile and Earnings: the account on record, or a "missing" row. */
export function BankRow() {
  const { navigate } = useApp();
  const { bank } = useProfile();
  return (
    <button type="button" onClick={() => navigate('/profile/bank')} className="card press flex w-full items-center gap-3.5 p-4 text-left">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${bank ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>{bank ? <Landmark size={18} /> : <AlertTriangle size={18} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted">Bank account for payouts</span>
        {bank ? (
          <>
            <span className="block truncate text-[15.5px] font-medium text-ink">
              {bank.bankName}, {maskAccount(bank.accountNumber)}
            </span>
            <span className="block truncate text-[13px] text-muted">{bank.accountName}</span>
          </>
        ) : (
          <span className="block text-[15px] font-semibold text-[#b45309]">Required, not added yet</span>
        )}
      </span>
      <ChevronRight size={18} className="text-faint" />
    </button>
  );
}

export function BankDetailsScreen() {
  const { back, showToast } = useApp();
  const { bank } = useProfile();
  const [bankName, setBankName] = useState(bank?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(bank?.accountNumber ?? '');
  const [accountName, setAccountName] = useState(bank?.accountName ?? '');
  const [tried, setTried] = useState(false);

  const errors = {
    bankName: bankName.trim().length < 3 ? 'Choose or type your bank’s name.' : undefined,
    accountNumber: !/^\d{10}$/.test(accountNumber) ? 'Nigerian account numbers have exactly 10 digits.' : undefined,
    accountName: accountName.trim().split(/\s+/).filter(Boolean).length < 2 ? 'Enter the name on the account, as the bank shows it.' : undefined,
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  const save = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const next: BankDetails = { bankName: bankName.trim(), accountNumber, accountName: accountName.trim().replace(/\s+/g, ' ').toUpperCase(), at: new Date().toISOString() };
    try {
      saveProfile({ bank: next });
      showToast('Bank details saved');
      back();
    } catch {
      showToast('Couldn’t save on this phone. Free up some space and try again.');
    }
  };

  return (
    <>
      <ScreenHeader title="Bank Details" />
      <Subtitle>Your commission is paid into this account. All three details are required.</Subtitle>

      {!bank && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[#fff6e5] p-3.5 text-[13.5px] leading-snug text-[#8a5a12]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#d97706]" /> You haven’t added a bank account yet, so your commission can’t be paid.
        </div>
      )}

      <Card className="mb-4 p-4 pb-1">
        <Field label="Bank name" required id="b-bank" error={show('bankName')}>
          <input id="b-bank" list="ng-banks" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Choose or type your bank" autoComplete="off" className={inputClass(show('bankName'))} />
          <datalist id="ng-banks">
            {NIGERIAN_BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="Account number" required id="b-acct" error={show('accountNumber')}>
          <input id="b-acct" inputMode="numeric" autoComplete="off" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 digit account number" className={`${inputClass(show('accountNumber'))} tabular-nums tracking-wider`} />
          <p className="mt-1.5 text-[12.5px] text-muted">{accountNumber.length}/10 digits</p>
        </Field>
        <Field label="Account name" required id="b-name" error={show('accountName')}>
          <input id="b-name" autoComplete="name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on the account" className={`${inputClass(show('accountName'))} uppercase`} />
        </Field>
      </Card>

      <div className="mb-5 space-y-2.5 px-1 text-[13px] leading-snug text-muted">
        <p className="flex items-start gap-2.5">
          <ShieldCheck size={17} className="mt-px shrink-0 text-good" /> Check the account name carefully. Payouts go only to the account saved here.
        </p>
        <p className="flex items-start gap-2.5">
          <Lock size={16} className="mt-px shrink-0 text-ink-2" /> Saved on this phone and sent to your branch’s finance team once the cloud connection is on. Only the last 4 digits are shown in the app.
        </p>
      </div>

      <Button block onClick={save}>
        {bank ? 'Save changes' : 'Save bank details'}
      </Button>
    </>
  );
}
