/**
 * Sign-in, verification, agreement, PIN and lock screens (compliance,
 * 2026-11-24). See domain/account for the rules and app/Gate for when each
 * screen shows.
 */
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Delete, Fingerprint, KeyRound, Lock, LogOut, ShieldCheck, Stethoscope } from 'lucide-react';
import { COMPANY } from '@/config/org';
import { DEMO_OTP, MAX_PIN_TRIES, SIGN_IN_ENABLED, PROFESSIONS, REGULATORS, REGULATOR_FOR, biometricsAvailable, demoApprove, enableBiometrics, getAccount, setPin, startRegister, startSignIn, unlockWithBiometrics, unlockWithPin, useAccount, verifyOtp } from '@/domain/account';
import { VERSIONS, recordConsent } from '@/domain/consent';
import { canEncrypt } from '@/domain/vault';
import { formatPersonName, isValidNgPhone } from '@/domain/format';
import { TITLES, tidyName, validEmail } from '@/domain/profile';
import { Button, Field, inputClass } from '@/ui/kit';
import { LegalDoc } from '@/screens/Legal';
import { emailProblem, onlyEmail, onlyPhone } from '@/ui/fieldRules';

/* ─────────────── frame ─────────────── */

function Frame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="h-dvh overflow-y-auto bg-[radial-gradient(120%_60%_at_80%_0%,#d6e6ff_0%,#eef4fe_50%,#f4f8fe_100%)] px-5 pb-[max(24px,var(--safe-bottom))] pt-[max(28px,calc(var(--safe-top)+16px))]">
      <div className={`mx-auto ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-[0_6px_14px_rgba(31,111,232,0.3)]">
            <Stethoscope size={23} />
          </span>
          <span>
            <span className="block text-[21px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">{COMPANY.appName}</span>
            <span className="mt-1 block text-[9.5px] font-semibold tracking-[0.25em] text-muted">{COMPANY.appTagline}</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
function Err({ text }: { text: string }) {
  return text ? (
    <p className="mb-3 rounded-xl bg-[#fdecec] px-3.5 py-2.5 text-[13.5px] font-medium text-[#b42318]" role="alert">
      {text}
    </p>
  ) : null;
}
const insecureNote = !canEncrypt && (
  <p className="mb-4 rounded-xl bg-[#fff6e5] px-3.5 py-2.5 text-[12.5px] leading-snug text-[#8a5a12]">This connection isn’t secure (not HTTPS), so the app can’t encrypt data and will save nothing on this phone. Patient data stays in memory until you close the app.</p>
);

/* ─────────────── sign in / create account ─────────────── */

export function SignIn() {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const lockedOut = getAccount()?.lockedOut;
  if (step === 'otp') return <Otp onBack={() => setStep('form')} />;
  return (
    <Frame wide={mode === 'register'}>
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
      <p className="mb-5 mt-1 text-[14.5px] leading-snug text-muted">For licensed healthcare professionals who request tests at {COMPANY.name}.</p>
      {lockedOut && <Err text="Too many wrong PINs. Sign in again with your password and a one-time code, then set a new PIN." />}
      {insecureNote}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-white p-1 ring-1 ring-line">
        {(['signin', 'register'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`press min-h-10 rounded-full text-[14px] font-semibold ${mode === m ? 'bg-brand-600 text-white' : 'text-ink-2'}`}>
            {m === 'signin' ? 'Sign in' : 'New account'}
          </button>
        ))}
      </div>
      {mode === 'signin' ? <SignInForm onOtp={() => setStep('otp')} /> : <RegisterForm onOtp={() => setStep('otp')} />}
    </Frame>
  );
}

function SignInForm({ onOtp }: { onOtp: () => void }) {
  const [who, setWho] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!who.trim()) return setErr('Enter your phone number or email.');
        try {
          await startSignIn(who.trim(), pw);
          onOtp();
        } catch (x) {
          setErr(x instanceof Error ? x.message : 'Couldn’t sign in.');
        }
      }}
    >
      <Err text={err} />
      <Field label="Phone number or email" id="si-who">
        <input id="si-who" autoComplete="username" value={who} onChange={(e) => setWho(e.target.value)} className={inputClass()} />
      </Field>
      <Field label="Password" id="si-pw">
        <input id="si-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass()} />
      </Field>
      <Button type="submit" block>
        Continue
      </Button>
      <p className="mt-3 text-center text-[12.5px] text-muted">We’ll send a one-time code to your phone.</p>
    </form>
  );
}

function RegisterForm({ onOtp }: { onOtp: () => void }) {
  const [f, setF] = useState({ title: 'Dr.', firstName: '', lastName: '', profession: 'Doctor', regulator: 'MDCN', licence: '', facility: '', phone: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    const first = tidyName(f.firstName);
    const last = tidyName(f.lastName);
    if (!first || !last) return setErr('Enter your first and last name.');
    if (f.licence.trim().length < 4) return setErr('Enter your licence or folio number. Silhouette checks it with your regulator.');
    if (f.facility.trim().length < 3) return setErr('Enter the facility where you work.');
    if (!isValidNgPhone(f.phone)) return setErr('Enter a valid Nigerian mobile number.');
    if (emailProblem(f.email, true)) return setErr(emailProblem(f.email, true)!);
    try {
      await startRegister({ title: f.title, firstName: first, lastName: last, profession: f.profession, regulator: f.regulator, licence: f.licence.trim().toUpperCase(), facility: f.facility.trim(), phone: f.phone.trim(), email: f.email.trim().toLowerCase() }, f.password);
      onOtp();
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Couldn’t create the account.');
    }
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), void submit())}>
      <Err text={err} />
      <div className="grid grid-cols-[100px_1fr] gap-3">
        <Field label="Title" id="rg-title">
          <select id="rg-title" value={f.title} onChange={(e) => set('title', e.target.value)} className={inputClass()}>
            {TITLES.map((t) => (
              <option key={t || 'none'} value={t}>
                {t || 'None'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First name" id="rg-first">
          <input id="rg-first" autoComplete="given-name" value={f.firstName} onChange={(e) => set('firstName', formatPersonName(e.target.value))} className={inputClass()} />
        </Field>
      </div>
      <Field label="Last name" id="rg-last">
        <input id="rg-last" autoComplete="family-name" value={f.lastName} onChange={(e) => set('lastName', formatPersonName(e.target.value))} className={inputClass()} />
      </Field>
      <Field label="Profession" id="rg-prof">
        <select id="rg-prof" value={f.profession} onChange={(e) => setF((x) => ({ ...x, profession: e.target.value, regulator: REGULATOR_FOR[e.target.value] ?? x.regulator }))} className={inputClass()}>
          {PROFESSIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field label="Regulator" id="rg-reg">
        <select id="rg-reg" value={f.regulator} onChange={(e) => set('regulator', e.target.value)} className={inputClass()}>
          {Object.entries(REGULATORS).map(([k, v]) => (
            <option key={k} value={k}>
              {k}, {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Licence or folio number" id="rg-lic">
        <input id="rg-lic" value={f.licence} onChange={(e) => set('licence', e.target.value)} placeholder="As on your practising licence" className={inputClass()} />
      </Field>
      <Field label="Workplace (facility)" id="rg-fac">
        <input id="rg-fac" value={f.facility} onChange={(e) => set('facility', e.target.value)} placeholder="Hospital or clinic name" className={inputClass()} />
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Phone" id="rg-phone">
          <input id="rg-phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', onlyPhone(e.target.value))} className={inputClass()} />
        </Field>
        <Field label="Email" id="rg-email">
          <input id="rg-email" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', onlyEmail(e.target.value))} className={inputClass()} />
        </Field>
      </div>
      <Field label="Password (at least 8 characters)" id="rg-pw">
        <input id="rg-pw" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} className={inputClass()} />
      </Field>
      <Button type="submit" block>
        Create account
      </Button>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Silhouette checks your licence with your regulator before you can send requests or see patients. Until then you can browse the test catalogue.</p>
    </form>
  );
}

function Otp({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  return (
    <Frame>
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">Enter the code</h1>
      <p className="mb-5 mt-1 text-[14.5px] text-muted">We sent a 6-digit code to your phone.</p>
      {/* TODO(backend): the server sends the OTP by SMS; remove the demo hint. */}
      <p className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-700">Demo: SMS isn’t connected yet. Use code {DEMO_OTP}.</p>
      <Err text={err} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await verifyOtp(code);
          } catch (x) {
            setErr(x instanceof Error ? x.message : 'Wrong code.');
          }
        }}
      >
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="One-time code" className={`${inputClass()} mb-4 text-center text-[24px] font-bold tracking-[0.5em]`} />
        <Button type="submit" block disabled={code.length !== 6}>
          Verify
        </Button>
        <Button variant="ghost" block className="mt-2" onClick={onBack}>
          Back
        </Button>
      </form>
    </Frame>
  );
}

/* ─────────────── agreement (first use) ─────────────── */

const DUTIES: { title: string; points: string[] }[] = [
  {
    title: 'Data protection',
    points: [
      'Patient details are health data (sensitive personal data under the Nigeria Data Protection Act 2023). I use them only to request tests and follow up care for my own patients.',
      'I don’t share, screenshot or forward patient information or results outside this app.',
      'I tell each patient that their details and tests are sent to Silhouette.',
    ],
  },
  { title: 'Confidentiality', points: ['I keep patient information confidential (National Health Act 2014, section 26).', 'I keep my phone locked and sign out of devices I no longer use.'] },
  {
    title: 'Professional conduct',
    points: ['I request only tests that are clinically needed, and give a clinical reason for X-ray and CT (radiation must be justified).', 'I accept no payment, gift or other benefit for requesting tests (MDCN Code of Medical Ethics).', 'For a medical emergency, I send the patient to emergency care first.'],
  },
];

export function Agreement() {
  const { account } = useAccount();
  const [ok, setOk] = useState<boolean[]>(DUTIES.map(() => false));
  const [legal, setLegal] = useState(false);
  const [doc, setDoc] = useState<'privacy' | 'terms' | null>(null);
  if (!account) return null;
  if (doc) return <LegalDoc kind={doc} onClose={() => setDoc(null)} />;
  const all = ok.every(Boolean) && legal;
  return (
    <Frame wide>
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">Before you start</h1>
      <p className="mb-5 mt-1 text-[14.5px] leading-snug text-muted">Please read and accept your duties when using the Referrer Portal.</p>
      {DUTIES.map((d, i) => (
        <label key={d.title} className={`mb-3 flex cursor-pointer gap-3 rounded-2xl border-[1.5px] bg-white p-4 ${ok[i] ? 'border-brand-500' : 'border-line'}`}>
          <input type="checkbox" checked={ok[i]} onChange={(e) => setOk((x) => x.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
          <span>
            <span className="block text-[15.5px] font-bold text-ink">{d.title}</span>
            <ul className="mt-1 space-y-1 text-[13.5px] leading-snug text-ink-2">
              {d.points.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </span>
        </label>
      ))}
      <label className={`mb-5 flex cursor-pointer gap-3 rounded-2xl border-[1.5px] bg-white p-4 ${legal ? 'border-brand-500' : 'border-line'}`}>
        <input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
        <span className="text-[14px] leading-snug text-ink">
          I have read the{' '}
          <button type="button" onClick={() => setDoc('privacy')} className="font-semibold text-brand-600 underline">
            Privacy Notice
          </button>{' '}
          and accept the{' '}
          <button type="button" onClick={() => setDoc('terms')} className="font-semibold text-brand-600 underline">
            Terms of Use
          </button>
          .
        </span>
      </label>
      <Button
        block
        disabled={!all}
        onClick={() => {
          const by = account.clinician.id;
          recordConsent({ kind: 'agreement', version: VERSIONS.agreement, by });
          recordConsent({ kind: 'privacy', version: VERSIONS.privacy, by });
          recordConsent({ kind: 'terms', version: VERSIONS.terms, by });
        }}
      >
        I agree
      </Button>
      <p className="mt-3 text-center text-[12px] text-muted">Version {VERSIONS.agreement}. Your acceptance is recorded with the date.</p>
    </Frame>
  );
}

/* ─────────────── PIN ─────────────── */

function PinPad({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: (v: string) => void }) {
  const press = (d: string) => {
    if (value.length >= 6) return;
    const v = value + d;
    onChange(v);
    if (v.length === 6) window.setTimeout(() => onDone(v), 120);
  };
  return (
    <>
      <div className="mb-6 flex justify-center gap-3" aria-label={`${value.length} of 6 digits entered`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < value.length ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`} />
        ))}
      </div>
      <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="press grid h-16 place-items-center rounded-full bg-white text-[24px] font-semibold text-ink shadow-sm ring-1 ring-line">
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} className="press grid h-16 place-items-center rounded-full bg-white text-[24px] font-semibold text-ink shadow-sm ring-1 ring-line">
          0
        </button>
        <button type="button" onClick={() => onChange(value.slice(0, -1))} aria-label="Delete digit" className="press grid h-16 place-items-center rounded-full text-ink-2">
          <Delete size={24} />
        </button>
      </div>
    </>
  );
}

export function SetPin() {
  const [first, setFirst] = useState<string | null>(null);
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  /** Chosen PIN, waiting for the face / fingerprint choice (in-app, no browser pop-up). */
  const [ready, setReady] = useState<string | null>(null);
  if (ready)
    return (
      <Frame>
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Fingerprint size={26} />
          </span>
          <h1 className="mt-3 text-[24px] font-bold text-ink">Use face or fingerprint?</h1>
          <p className="mt-1 text-[14px] text-muted">Open the app with your face or fingerprint. Your PIN still works as a backup.</p>
        </div>
        <div className="grid gap-2.5">
          <Button
            block
            onClick={async () => {
              await setPin(ready);
              try {
                await enableBiometrics();
              } catch {
                /* cancelled: the PIN still works */
              }
            }}
          >
            <Fingerprint size={19} /> Use face or fingerprint
          </Button>
          <Button variant="secondary" block onClick={() => void setPin(ready)}>
            Not now, use my PIN
          </Button>
        </div>
      </Frame>
    );
  return (
    <Frame>
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <KeyRound size={26} />
        </span>
        <h1 className="mt-3 text-[24px] font-bold text-ink">{first ? 'Enter the PIN again' : 'Choose a 6-digit PIN'}</h1>
        <p className="mt-1 text-[14px] text-muted">You’ll use it (or your face or fingerprint) to open the app.</p>
      </div>
      <Err text={err} />
      <PinPad
        value={v}
        onChange={(x) => (setV(x), setErr(''))}
        onDone={async (pin) => {
          if (!first) {
            if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') {
              setErr('Choose a PIN that’s harder to guess.');
              return setV('');
            }
            setFirst(pin);
            return setV('');
          }
          if (pin !== first) {
            setErr('The PINs don’t match. Start again.');
            setFirst(null);
            return setV('');
          }
          if (await biometricsAvailable()) setReady(pin);
          else await setPin(pin);
        }}
      />
    </Frame>
  );
}

export function LockScreen({ onSignOut }: { onSignOut: () => void }) {
  const { account } = useAccount();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const tried = useRef(false);
  const bio = !!account?.biometricId;
  // Offer face / fingerprint straight away.
  useEffect(() => {
    if (bio && !tried.current) {
      tried.current = true;
      void unlockWithBiometrics();
    }
  }, [bio]);
  if (!account) return null;
  const left = MAX_PIN_TRIES - account.failedPins;
  return (
    <Frame>
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Lock size={26} />
        </span>
        <h1 className="mt-3 text-[24px] font-bold text-ink">Enter your PIN</h1>
        <p className="mt-1 text-[14px] text-muted">
          {account.clinician.title} {account.clinician.firstName} {account.clinician.lastName}
        </p>
      </div>
      <Err text={err} />
      <PinPad
        value={v}
        onChange={(x) => (setV(x), setErr(''))}
        onDone={async (pin) => {
          const ok = await unlockWithPin(pin);
          if (!ok) {
            setV('');
            const a = getAccount();
            setErr(a?.lockedOut ? '' : `Wrong PIN. ${Math.max(0, MAX_PIN_TRIES - (a?.failedPins ?? 0))} tries left.`);
          }
        }}
      />
      {left < MAX_PIN_TRIES && left > 0 && <p className="mt-4 text-center text-[12.5px] text-muted">After {MAX_PIN_TRIES} wrong PINs {SIGN_IN_ENABLED ? 'you’ll need to sign in again' : 'you’ll need to set a new PIN'}.</p>}
      <div className="mt-6 grid gap-2">
        {bio && (
          <Button variant="secondary" block onClick={() => void unlockWithBiometrics()}>
            <Fingerprint size={19} /> Use face or fingerprint
          </Button>
        )}
        <Button variant="ghost" block onClick={onSignOut}>
          <LogOut size={17} /> Not you? Sign out of this device
        </Button>
      </div>
    </Frame>
  );
}

/* ─────────────── verification ─────────────── */

/** Shown instead of patient screens until the account is Active. */
export function VerificationPending() {
  const { account } = useAccount();
  const suspended = account?.status === 'suspended';
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center pt-[var(--safe-top)] text-center">
      <span className={`grid h-16 w-16 place-items-center rounded-2xl ${suspended ? 'bg-[#fdecec] text-[#d93036]' : 'bg-brand-50 text-brand-600'}`}>{suspended ? <Lock size={30} /> : <ShieldCheck size={30} />}</span>
      <h1 className="mt-4 text-[22px] font-bold text-ink">{suspended ? 'Your account is suspended' : 'Your account is being verified by Silhouette'}</h1>
      <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted">
        {suspended
          ? 'You can’t send requests or see patients. Please contact Silhouette (Inbox, Admin) to find out why.'
          : `We’re checking your licence (${account?.clinician.regulator} ${account?.clinician.licence}). You can browse the test catalogue meanwhile; requests and patients open once you’re verified.`}
      </p>
      {!suspended && (
        // TODO(backend): remove. Verification happens on the server; the app reads the new status.
        <button type="button" onClick={demoApprove} className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-brand-700 ring-1 ring-line">
          <BadgeCheck size={16} /> Demo only: mark as verified
        </button>
      )}
    </div>
  );
}
