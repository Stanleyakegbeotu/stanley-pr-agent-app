/**
 * Settings for PR agents (owner, 2026-11-26): everything the agent may set
 * for themselves, nothing more.
 *   My account: profile, sign-in email and password, account details
 *   (bank, account number, account name: encrypted on this phone), app lock.
 *   Preferences: which notifications they get.
 *   What I can do: their rights and rules in plain words.
 *   Privacy and help, and sign out of this device.
 * Licence, profession and workplace are changed by Silhouette after checking
 * the licence, so they are shown, not edited.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BadgeCheck, Bell, BookOpen, Check, ChevronRight, CircleHelp, Fingerprint, KeyRound, Landmark, LogOut, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { BRANCH, ROLE_LABEL } from '@/config/org';
import { biometricsAvailable, disableBiometrics, enableBiometrics, resetPin, useAccount } from '@/domain/account';
import { useProfile } from '@/domain/profile';
import { maskAccount, removeAccountDetails, saveAccountDetails, useAccountDetails } from '@/domain/accountDetails';
import { NIGERIAN_BANKS, isNuban } from '@company/data/userRecords';
import { EMAIL_OK, passwordRules, setPassword, setSignInEmail, strength, useSignIn } from '@/admin/signin';
import { signOutDevice } from '@/app/Gate';
import { Sheet } from '@/admin/ui';
import { Button, ScreenHeader, Sticker, inputClass } from '@/ui/kit';
import { onlyDigits, onlyEmail, onlyName } from '@/ui/fieldRules';

type Open = 'signin' | 'account' | 'lock' | 'notify' | 'rights' | 'signout' | null;

export function Settings() {
  const { navigate } = useApp();
  const { account } = useAccount();
  const me = useProfile();
  const c = account?.clinician;
  const key = `clinician:${c?.id ?? 'me'}`;
  const signIn = useSignIn(key);
  const bank = useAccountDetails();
  const [open, setOpen] = useState<Open>(null);
  const status = account?.status === 'active' ? 'Verified' : account?.status === 'suspended' ? 'Suspended' : 'Being verified';
  const name = [me.title, me.firstName, me.lastName].filter(Boolean).join(' ') || 'Your name';

  return (
    <>
      <ScreenHeader title="Settings" />
      <button type="button" onClick={() => navigate('/profile')} className="press relative mb-5 flex w-full items-center gap-3 overflow-hidden rounded-[26px] bg-linear-to-br from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7] p-4 text-left text-white shadow-[0_14px_30px_rgba(31,99,214,0.28)]">
        <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <img src={me.photo} alt="" className="relative h-16 w-16 rounded-full object-cover ring-[3px] ring-white/70" />
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-[18px] font-bold">{name}</span>
          <span className="block truncate text-[12.5px] text-white/85">
            {ROLE_LABEL} · {BRANCH.name}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-semibold">
            <BadgeCheck size={13} /> {status}
          </span>
        </span>
        <ChevronRight size={20} className="relative shrink-0" />
      </button>

      <Group title="My account">
        <Row icon={<UserRound size={19} />} tint="bg-brand-50 text-brand-600" label="My profile" hint="Photo, title, name, phone and email" onClick={() => navigate('/profile')} />
        <Row icon={<KeyRound size={19} />} tint="bg-brand-50 text-brand-600" label="Sign-in and password" hint={signIn?.hash ? `Signs in with ${signIn.email || 'your email'}` : 'Set your sign-in email and password'} badge={!signIn?.hash} onClick={() => setOpen('signin')} />
        <Row icon={<Landmark size={19} />} tint="bg-tint-green text-good-ink" label="Account details" hint={bank ? `${bank.bankName} · ${maskAccount(bank.accountNumber)}` : 'Bank, account number and account name'} badge={!bank} onClick={() => setOpen('account')} />
        <Row icon={<ShieldCheck size={19} />} tint="bg-brand-50 text-brand-600" label="App lock" hint="PIN, face or fingerprint" onClick={() => setOpen('lock')} />
      </Group>

      <Group title="Preferences">
        <Row icon={<Bell size={19} />} tint="bg-tint-orange text-orange" label="Notifications" hint="Arrivals, results ready, branch updates" onClick={() => setOpen('notify')} />
        <Row icon={<BadgeCheck size={19} />} tint="bg-tint-purple text-violet" label="What I can do" hint="Your rights and the rules of the portal" onClick={() => setOpen('rights')} />
      </Group>

      <Group title="Privacy and help">
        <Row icon={<ShieldCheck size={19} />} tint="bg-tint-green text-good-ink" label="Privacy and terms" hint="How patient data is protected, consent records" onClick={() => navigate('/privacy')} />
        <Row icon={<CircleHelp size={19} />} tint="bg-tint-green text-good-ink" label="Help centre" hint="Questions and the branch contact" onClick={() => navigate('/help')} />
        <Row icon={<BookOpen size={19} />} tint="bg-tint-green text-good-ink" label="Training and resources" hint="Guides for requests and patient preparation" onClick={() => navigate('/training')} />
      </Group>

      <Group title="This phone">
        <Row icon={<LogOut size={19} />} tint="bg-[#fdecec] text-[#d93036]" label="Sign out of this device" hint="Deletes every patient record kept on this phone" danger onClick={() => setOpen('signout')} />
      </Group>
      {c?.licence && <p className="mt-2 px-1 text-[12px] text-muted">Licence, profession and workplace are updated by Silhouette after checking your licence.</p>}

      {open === 'signin' && <SignInSheet userKey={key} who={{ name, role: 'PR agent' }} onClose={() => setOpen(null)} />}
      {open === 'account' && <AccountSheet onClose={() => setOpen(null)} />}
      {open === 'lock' && <LockSheet onClose={() => setOpen(null)} />}
      {open === 'notify' && <NotifySheet onClose={() => setOpen(null)} />}
      {open === 'rights' && <RightsSheet onClose={() => setOpen(null)} />}
      {open === 'signout' && (
        <Sheet
          title="Sign out of this device?"
          subtitle="You will sign in again next time"
          onClose={() => setOpen(null)}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button onClick={() => void signOutDevice()} className="bg-none! bg-[#d93036]!">
                Sign out
              </Button>
            </div>
          }
        >
          <p className="px-1 pb-2 text-[14px] text-ink-2">The encryption key on this phone is destroyed and every patient record, chat and voice note kept here is deleted.</p>
        </Sheet>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-white shadow-[0_6px_20px_rgba(30,74,160,0.05)] ring-1 ring-line/70">{children}</div>
    </section>
  );
}

function Row({ icon, tint, label, hint, onClick, badge, danger }: { icon: ReactNode; tint: string; label: string; hint: string; onClick: () => void; badge?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 px-3.5 py-3 text-left">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tint}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-[#d93036]' : 'text-ink'}`}>{label}</span>
        <span className="block truncate text-[12.5px] text-muted">{hint}</span>
      </span>
      {badge && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ef4444]" aria-label="Needs setting up" />}
      <ChevronRight size={17} className="shrink-0 text-faint" />
    </button>
  );
}

/* ─────────────── sign-in and password ─────────────── */

function SignInSheet({ userKey, who, onClose }: { userKey: string; who: { name: string; role: string }; onClose: () => void }) {
  const { showToast } = useApp();
  const cur = useSignIn(userKey);
  const [email, setEmail] = useState(cur?.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = passwordRules(next);
  const st = strength(next);
  const save = async () => {
    setErr(null);
    if (!EMAIL_OK(email)) return setErr('Enter a valid email, for example you@example.com.');
    if (next || again || current) {
      if (!rules.every((r) => r.ok)) return setErr('The new password does not meet every rule.');
      if (next !== again) return setErr('The two new passwords are not the same.');
    }
    setBusy(true);
    if (email.trim() !== (cur?.email ?? '')) setSignInEmail(userKey, who, email);
    if (next) {
      const problem = await setPassword(userKey, who, next, current || undefined);
      setBusy(false);
      if (problem) return setErr(problem);
    }
    setBusy(false);
    showToast(next ? 'Sign-in details saved' : 'Sign-in email saved');
    onClose();
  };
  return (
    <Sheet title="Sign-in and password" subtitle="Set by you. No one at the branch can see your password." onClose={onClose} tall footer={<Button block onClick={() => void save()} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>}>
      <div className="space-y-4 px-1 pb-3">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Sign-in email</span>
          <input value={email} onChange={(e) => setEmail(onlyEmail(e.target.value))} inputMode="email" autoComplete="email" placeholder="you@example.com" className={inputClass()} />
        </label>
        {cur?.hash && (
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-ink">Current password</span>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass()} />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">{cur?.hash ? 'New password' : 'Password'}</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass()} />
        </label>
        {next && (
          <div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= st.score ? (st.score >= 3 ? 'bg-good' : 'bg-[#f59e0b]') : 'bg-line'}`} />
              ))}
            </div>
            <p className="mt-1 text-[12.5px] font-semibold text-ink-2">{st.label}</p>
            <ul className="mt-1.5 space-y-1">
              {rules.map((r) => (
                <li key={r.label} className={`flex items-center gap-1.5 text-[12.5px] ${r.ok ? 'text-good-ink' : 'text-muted'}`}>
                  {r.ok ? <Check size={13} /> : <X size={13} />} {r.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Type the new password again</span>
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className={inputClass()} />
        </label>
        {err && <p className="rounded-2xl bg-[#fdecec] px-3.5 py-2.5 text-[13px] font-medium text-[#b42318]">{err}</p>}
      </div>
    </Sheet>
  );
}

/* ─────────────── account details ─────────────── */

function AccountSheet({ onClose }: { onClose: () => void }) {
  const { showToast } = useApp();
  const cur = useAccountDetails();
  const [bank, setBank] = useState(cur?.bankName ?? '');
  const [num, setNum] = useState(cur?.accountNumber ?? '');
  const [acct, setAcct] = useState(cur?.accountName ?? '');
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState(!cur);
  const [tried, setTried] = useState(false);
  const banks = useMemo(() => NIGERIAN_BANKS.filter((b) => !q.trim() || b.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const errs = { bank: bank ? '' : 'Choose your bank.', num: isNuban(num) ? '' : 'Enter the 10-digit account number.', acct: acct.trim().length >= 3 ? '' : 'Enter the name on the account.' };
  const ok = !errs.bank && !errs.num && !errs.acct;
  return (
    <Sheet
      title="Account details"
      subtitle={cur ? `Last changed ${new Date(cur.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Where the branch pays you'}
      onClose={onClose}
      tall
      footer={
        <div className="grid gap-2">
          <Button
            block
            onClick={() => {
              setTried(true);
              if (!ok) return;
              saveAccountDetails({ bankName: bank, accountNumber: num.trim(), accountName: acct.trim() });
              showToast('Account details saved');
              onClose();
            }}
          >
            Save account details
          </Button>
          {cur && (
            <button
              type="button"
              onClick={() => {
                removeAccountDetails();
                showToast('Account details removed');
                onClose();
              }}
              className="press min-h-11 rounded-2xl text-[14px] font-semibold text-[#d93036]"
            >
              Remove account details
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 px-1 pb-3">
        <div className="flex items-center gap-3 rounded-[20px] bg-linear-to-br from-[#e9f9ef] to-[#d3f3e1] p-3.5">
          <Sticker name="coin" size={44} />
          <p className="text-[13px] leading-snug text-good-ink">Kept encrypted on this phone. Check the account name matches your bank exactly.</p>
        </div>
        <div>
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Bank</span>
          {picking ? (
            <>
              <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-400">
                <Search size={17} className="text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all Nigerian banks" aria-label="Search banks" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
              </label>
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-2xl bg-page p-1">
                {banks.map((b) => (
                  <li key={b}>
                    <button type="button" onClick={() => (setBank(b), setPicking(false), setQ(''))} className={`press flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14.5px] ${bank === b ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-ink'}`}>
                      {b}
                      {bank === b && <Check size={16} className="text-brand-600" />}
                    </button>
                  </li>
                ))}
                {!banks.length && <li className="px-3 py-4 text-center text-[13px] text-muted">No bank matches “{q}”.</li>}
              </ul>
            </>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="press flex min-h-13 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left ring-1 ring-line">
              <Landmark size={18} className="text-good-ink" />
              <span className="flex-1 text-[15px] font-semibold text-ink">{bank}</span>
              <span className="text-[13px] font-semibold text-brand-600">Change</span>
            </button>
          )}
          {tried && errs.bank && <p className="mt-1 text-[12.5px] font-medium text-[#d93036]">{errs.bank}</p>}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Account number</span>
          <input value={num} onChange={(e) => setNum(onlyDigits(e.target.value, 10))} inputMode="numeric" placeholder="10 digits" className={`${inputClass(tried && errs.num ? errs.num : undefined)} font-mono text-[17px] tracking-wider`} />
          {tried && errs.num && <p className="mt-1 text-[12.5px] font-medium text-[#d93036]">{errs.num}</p>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Account name</span>
          <input value={acct} onChange={(e) => setAcct(onlyName(e.target.value).toUpperCase())} placeholder="As shown by your bank" className={inputClass(tried && errs.acct ? errs.acct : undefined)} />
          {tried && errs.acct && <p className="mt-1 text-[12.5px] font-medium text-[#d93036]">{errs.acct}</p>}
        </label>
      </div>
    </Sheet>
  );
}

/* ─────────────── app lock ─────────────── */

function LockSheet({ onClose }: { onClose: () => void }) {
  const { showToast } = useApp();
  const { account } = useAccount();
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => {
    void biometricsAvailable().then(setBioOk);
  }, []);
  return (
    <Sheet title="App lock" subtitle="Keeps patient details safe if the phone is shared or lost" onClose={onClose}>
      <div className="space-y-2.5 px-1 pb-3">
        <button type="button" onClick={() => (resetPin(), showToast('Choose your new PIN'), onClose())} className="press flex w-full items-center gap-3 rounded-2xl bg-page p-3.5 text-left">
          <KeyRound size={20} className="text-brand-600" />
          <span className="flex-1">
            <b className="block text-[15px] text-ink">Change PIN</b>
            <span className="text-[12.5px] text-muted">Asked when the app opens and after 5 minutes away</span>
          </span>
          <ChevronRight size={17} className="text-faint" />
        </button>
        {bioOk ? (
          <button
            type="button"
            onClick={async () => {
              if (account?.biometricId) {
                disableBiometrics();
                showToast('Face or fingerprint turned off');
              } else if (await enableBiometrics()) showToast('Face or fingerprint turned on');
              else showToast('Couldn’t set up face or fingerprint.');
            }}
            className="press flex w-full items-center gap-3 rounded-2xl bg-page p-3.5 text-left"
          >
            <Fingerprint size={20} className="text-brand-600" />
            <span className="flex-1">
              <b className="block text-[15px] text-ink">Face or fingerprint</b>
              <span className="text-[12.5px] text-muted">{account?.biometricId ? 'On. Tap to turn off.' : 'Off. Tap to turn on.'}</span>
            </span>
          </button>
        ) : (
          <p className="rounded-2xl bg-page p-3.5 text-[13px] text-muted">Face or fingerprint unlock is not available on this phone or browser.</p>
        )}
      </div>
    </Sheet>
  );
}

/* ─────────────── notifications ─────────────── */

const NOTIFY_KEY = 'stanley.pr.notify.v1';
const NOTIFY = [
  { id: 'arrived', label: 'A patient arrived at the branch' },
  { id: 'results', label: 'Results are ready' },
  { id: 'status', label: 'The branch updated a referral (coming later, did not come)' },
  { id: 'messages', label: 'New messages from the branch' },
  { id: 'news', label: 'Announcements and campaigns' },
] as const;

function NotifySheet({ onClose }: { onClose: () => void }) {
  const [on, setOn] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const set = (id: string, v: boolean) => {
    const next = { ...on, [id]: v };
    setOn(next);
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
  };
  return (
    <Sheet title="Notifications" subtitle="Notifications never show patient names or tests" onClose={onClose}>
      <ul className="divide-y divide-line px-1 pb-3">
        {NOTIFY.map((n) => {
          const v = on[n.id] !== false;
          return (
            <li key={n.id}>
              <button type="button" role="switch" aria-checked={v} onClick={() => set(n.id, !v)} className="press flex w-full items-center gap-3 py-3.5 text-left">
                <span className="flex-1 text-[14.5px] text-ink">{n.label}</span>
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${v ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${v ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/* ─────────────── rights ─────────────── */

function RightsSheet({ onClose }: { onClose: () => void }) {
  const can = ['Send referrals (e-requests) to the branch, with a note and a voice note', 'See your own referred patients, their status and the value of tests that went through', 'View results for your own patients, for 90 days', 'Message the front desk, the branch manager and the admin', 'Change your profile, sign-in details and account details'];
  const cannot = ['See other agents’ patients', 'Download, copy or screenshot results and receipts', 'Change prices or the tests a branch offers', 'Change your licence details (Silhouette does this after checking)'];
  return (
    <Sheet title="What I can do" subtitle="The rules of the portal" onClose={onClose} tall>
      <div className="space-y-4 px-1 pb-3">
        <List title="You can" items={can} ok />
        <List title="You can’t" items={cannot} />
      </div>
    </Sheet>
  );
}
function List({ title, items, ok }: { title: string; items: string[]; ok?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted">{title}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line/70">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3 px-3.5 py-2.5">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${ok ? 'bg-good text-white' : 'bg-page text-faint ring-1 ring-line'}`}>{ok ? <Check size={12} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}</span>
            <span className="text-[13.5px] text-ink">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
