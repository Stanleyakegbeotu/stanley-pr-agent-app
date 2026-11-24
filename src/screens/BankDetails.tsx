/**
 * Bank details (owner, 2026-11-24): REQUIRED for every PR agent. Commission is
 * paid into this account, so until the agent adds bank name, account number
 * and account name, Home shows a "Required" card (and Profile and Earnings
 * say it is missing).
 */
import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Info, Landmark, Lock, ShieldCheck, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { saveProfile, useProfile, type BankDetails } from '@/domain/profile';
import { ALL_BANKS, NIGERIAN_BANKS } from '@/data/banks';
import { Button, Card, Field, ScreenHeader, SearchField, Subtitle, inputClass } from '@/ui/kit';

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
          <p className="mt-1 text-[13.5px] leading-snug text-[#8a5a12]">Your PR commission is paid into your bank account every month. Add your bank name, account number and account name so you can be paid.</p>
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

/** Why we ask (owner, 2026-11-24): shown on the bank form and the Profile payouts section. */
export const BANK_PURPOSE = 'Your bank details are used for one purpose only: to pay your PR commission into your account every month. They are not used for anything else.';

export function BankPurposeNote({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-[#cfe0fb] bg-brand-50 p-3.5 ${className}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
        <Info size={18} />
      </span>
      <span className="text-[13.5px] leading-snug text-ink-2">
        <b className="block text-[14.5px] text-ink">Why we need your bank details</b>
        {BANK_PURPOSE}
      </span>
    </div>
  );
}

export function BankDetailsScreen() {
  const { back, showToast } = useApp();
  const { bank } = useProfile();
  const [bankName, setBankName] = useState(bank?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(bank?.accountNumber ?? '');
  const [accountName, setAccountName] = useState(bank?.accountName ?? '');
  const [agreed, setAgreed] = useState(!!bank?.agreedAt);
  const [picking, setPicking] = useState(false);
  const [tried, setTried] = useState(false);

  const errors = {
    bankName: bankName.trim().length < 2 ? 'Choose your bank.' : undefined,
    accountNumber: !/^\d{10}$/.test(accountNumber) ? 'Nigerian account numbers have exactly 10 digits.' : undefined,
    accountName: accountName.trim().split(/\s+/).filter(Boolean).length < 2 ? 'Enter the name on the account, as the bank shows it.' : undefined,
    agreed: !agreed ? 'Please confirm you understand what your bank details are used for.' : undefined,
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  const save = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const now = new Date().toISOString();
    const next: BankDetails = { bankName: bankName.trim(), accountNumber, accountName: accountName.trim().replace(/\s+/g, ' ').toUpperCase(), at: now, agreedAt: bank?.agreedAt ?? now };
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
      <Subtitle>Add the account your monthly PR commission should be paid into. All three details are required.</Subtitle>

      <BankPurposeNote className="mb-4" />

      {!bank && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[#fff6e5] p-3.5 text-[13.5px] leading-snug text-[#8a5a12]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#d97706]" /> You haven’t added a bank account yet, so your commission can’t be paid.
        </div>
      )}

      <Card className="mb-4 p-4 pb-1">
        <Field label="Bank name" required id="b-bank" error={show('bankName')}>
          <button id="b-bank" type="button" onClick={() => setPicking(true)} className={`${inputClass(show('bankName'))} flex items-center justify-between text-left`}>
            <span className={bankName ? 'text-ink' : 'text-faint'}>{bankName || 'Choose your bank'}</span>
            <ChevronDown size={19} className="text-muted" />
          </button>
        </Field>
        <Field label="Account number" required id="b-acct" error={show('accountNumber')}>
          <input id="b-acct" inputMode="numeric" autoComplete="off" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 digit account number" className={`${inputClass(show('accountNumber'))} tabular-nums tracking-wider`} />
          <p className="mt-1.5 text-[12.5px] text-muted">{accountNumber.length}/10 digits</p>
        </Field>
        <Field label="Account name" required id="b-name" error={show('accountName')}>
          <input id="b-name" autoComplete="name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name on the account" className={`${inputClass(show('accountName'))} uppercase`} />
        </Field>
      </Card>

      <label className={`mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 ${show('agreed') ? 'border-[#e5484d]' : 'border-line'}`}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
        <span className="text-[14px] leading-snug text-ink">I understand my bank details will be used only to pay my PR commission into this account every month.</span>
      </label>
      {show('agreed') && (
        <p className="-mt-2 mb-4 px-1 text-[13px] font-medium text-[#d93036]" role="alert">
          {show('agreed')}
        </p>
      )}

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

      {picking && (
        <BankPicker
          value={bankName}
          onClose={() => setPicking(false)}
          onPick={(b) => {
            setBankName(b);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

/** Searchable list of every bank, grouped; "not listed" lets the agent type it. */
function BankPicker({ value, onPick, onClose }: { value: string; onPick: (b: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const groups = NIGERIAN_BANKS.map((g) => ({ ...g, banks: g.banks.filter((b) => !t || b.toLowerCase().includes(t)) })).filter((g) => g.banks.length);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div className="flex h-[88dvh] w-full max-w-md flex-col rounded-t-[26px] bg-white shadow-2xl md:h-[80dvh] md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pt-3">
          <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[19px] font-bold text-ink">Choose your bank</p>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-page">
              <X size={20} />
            </button>
          </div>
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${ALL_BANKS.length} banks...`} aria-label="Search banks" autoFocus />
        </div>
        <div className="mt-2 flex-1 overflow-y-auto px-2 pb-[max(14px,var(--safe-bottom))]">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="sticky top-0 z-10 bg-white px-3 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{g.title}</p>
              {g.banks.map((b) => (
                <button key={b} type="button" onClick={() => onPick(b)} className="press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15.5px] text-ink hover:bg-page">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint-blue text-[12px] font-bold text-brand-700">{b.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                  <span className="min-w-0 flex-1">{b}</span>
                  {value === b && <Check size={18} className="text-brand-600" />}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-2 rounded-2xl bg-page p-3">
            <p className="mb-2 px-1 text-[13px] text-muted">{groups.length ? 'Bank not listed?' : `No bank matches “${q}”.`} Use the name exactly as your bank writes it.</p>
            <Button block variant="secondary" onClick={() => q.trim().length >= 2 && onPick(q.trim())} disabled={q.trim().length < 2}>
              {q.trim().length >= 2 ? `Use “${q.trim()}”` : 'Type your bank’s name above'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
