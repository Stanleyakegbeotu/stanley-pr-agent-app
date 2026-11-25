/**
 * My Profile (compliance rebuild, 2026-11-24).
 *  • Editable by the clinician: photo, title, name, phone, email.
 *  • Read-only (changed by Silhouette after checking the licence): profession,
 *    regulator, licence number, workplace.
 *  • Counts of the clinician's own patients (never money).
 *  • Security: change PIN, face / fingerprint, sign out of this device.
 *  • Privacy & Terms, DPO and consent records.
 */
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, ChevronRight, ClipboardList, DoorOpen, FileText, Fingerprint, KeyRound, LogOut, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react';
import { useApp } from '@/app/store';
import { BRANCH, ROLE_LABEL } from '@/config/org';
import { shortDate } from '@/domain/format';
import { countsFor } from '@/domain/referrals';
import { REGULATORS, SIGN_IN_ENABLED, biometricsAvailable, disableBiometrics, enableBiometrics, resetPin, useAccount } from '@/domain/account';
import { TITLES, saveProfile, squarePhoto, tidyName, tidyPhone, useProfile, validEmail } from '@/domain/profile';
import { signOutDevice } from '@/app/Gate';
import { Button, Card, Field, ScreenHeader, inputClass } from '@/ui/kit';
import { onlyEmail, onlyPhone } from '@/ui/fieldRules';

export function Profile() {
  const { referrals, navigate, showToast } = useApp();
  const { account } = useAccount();
  const me = useProfile();
  const c = account?.clinician;
  const [editing, setEditing] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const counts = countsFor(referrals);
  useEffect(() => {
    void biometricsAvailable().then(setBioOk);
  }, []);

  const changePhoto = async (f?: File) => {
    if (!f) return;
    try {
      saveProfile({ photo: await squarePhoto(f) });
      showToast('Profile photo updated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t use that photo.');
    }
  };
  const status = account?.status === 'active' ? 'Verified' : account?.status === 'suspended' ? 'Suspended' : 'Being verified';

  return (
    <>
      <ScreenHeader
        title="My Profile"
        right={
          <button type="button" onClick={() => setEditing(true)} className="press flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[14.5px] font-semibold text-brand-600 shadow-[0_4px_12px_rgba(30,74,160,0.1)] ring-1 ring-line">
            <Pencil size={16} /> Edit
          </button>
        }
      />

      <div className="mb-5 flex flex-col items-center text-center">
        <button type="button" onClick={() => file.current?.click()} className="press relative" aria-label="Change profile photo">
          <img src={me.photo} alt="" className="h-28 w-28 rounded-full object-cover shadow-[0_14px_30px_rgba(31,111,232,0.22)] ring-4 ring-white" />
          <span className="absolute bottom-0.5 right-0.5 grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white shadow-md ring-[3px] ring-white">
            <Camera size={17} />
          </span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => (void changePhoto(e.target.files?.[0]), (e.target.value = ''))} />
        <p className="mt-3 text-[21px] font-bold text-ink">{me.name}</p>
        <p className="text-[14.5px] text-muted">
          {ROLE_LABEL}, {c?.id}
        </p>
        <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold ${account?.status === 'active' ? 'bg-tint-green text-good-ink' : 'bg-[#fff1e0] text-[#b45309]'}`}>
          <BadgeCheck size={14} /> {status}
        </span>
      </div>

      {/* Counts only, last 90 days */}
      <div className="mb-2 grid grid-cols-3 gap-2.5">
        <Stat icon={<ClipboardList size={18} />} tone="bg-tint-blue text-brand-700" value={counts.referred} label="Patients" onClick={() => navigate('/referrals')} />
        <Stat icon={<DoorOpen size={18} />} tone="bg-tint-orange text-orange" value={counts.attended} label="Attended" onClick={() => navigate('/referrals')} />
        <Stat icon={<FileText size={18} />} tone="bg-tint-green text-good-ink" value={counts.resultsReady} label="Results ready" onClick={() => navigate('/results')} />
      </div>
      <p className="mb-5 px-1 text-[12.5px] text-muted">Your own patients in the last 90 days.</p>

      <Section title="Your contact details">
        <Row icon={<Phone size={18} />} label="Phone number" value={me.phone} onClick={() => setEditing(true)} />
        <Row icon={<Mail size={18} />} label="Email" value={me.email} onClick={() => setEditing(true)} />
      </Section>

      <Section title="Professional details" note="To change these, message Silhouette (Inbox, Admin). Silhouette checks the change with your regulator.">
        <Info label="Profession" value={c?.profession ?? ''} />
        <Info label="Regulator" value={c ? `${c.regulator}, ${REGULATORS[c.regulator] ?? ''}` : ''} />
        <Info label="Licence / folio" value={c?.licence ?? ''} />
        <Info label="Workplace" value={c?.facility ?? ''} />
        <Info label="Branch" value={BRANCH.label} />
        <Info label="Member since" value={c ? shortDate(`${c.memberSince}T12:00:00`) : ''} />
      </Section>

      <Section title="Security">
        <button type="button" onClick={() => (resetPin(), showToast('Choose your new PIN'))} className="press flex w-full items-center gap-3.5 p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-blue text-brand-600">
            <KeyRound size={18} />
          </span>
          <span className="flex-1 text-[15px] font-medium text-ink">Change PIN</span>
          <ChevronRight size={18} className="text-faint" />
        </button>
        {bioOk && (
          <label className="flex items-center gap-3.5 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-purple text-violet">
              <Fingerprint size={18} />
            </span>
            <span className="flex-1 text-[15px] font-medium text-ink">Unlock with face or fingerprint</span>
            <input
              type="checkbox"
              checked={!!account?.biometricId}
              onChange={async (e) => {
                if (e.target.checked) {
                  try {
                    if (!(await enableBiometrics())) showToast('Couldn’t set up face or fingerprint.');
                  } catch {
                    showToast('Face or fingerprint wasn’t set up.');
                  }
                } else disableBiometrics();
              }}
              className="h-5 w-5 accent-brand-600"
            />
          </label>
        )}
        <p className="flex items-start gap-3.5 p-4 text-[13px] leading-snug text-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-good" /> The app locks after 5 minutes without use and whenever you leave it. Patient data on this phone is encrypted.
        </p>
        <button type="button" onClick={() => setConfirmOut(true)} className="press flex w-full items-center gap-3.5 p-4 text-left text-[#d93036]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fdecec]">
            <LogOut size={18} />
          </span>
          <span className="flex-1 text-[15px] font-semibold">Sign out of this device</span>
        </button>
      </Section>

      <Section title="Privacy">
        <button type="button" onClick={() => navigate('/privacy')} className="press flex w-full items-center gap-3.5 p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-green text-good-ink">
            <ShieldCheck size={18} />
          </span>
          <span className="flex-1 text-[15px] font-medium text-ink">Privacy &amp; Terms, DPO and consent records</span>
          <ChevronRight size={18} className="text-faint" />
        </button>
      </Section>

      {editing && <EditProfile onClose={() => setEditing(false)} onSaved={() => (setEditing(false), showToast('Profile updated'))} onPhoto={() => file.current?.click()} />}
      {confirmOut && (
        <div data-slide-layer className="fade-in fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={() => setConfirmOut(false)}>
          <div data-sheet-panel className="sheet-up w-full max-w-md rounded-t-[26px] bg-white px-5 pb-[max(18px,var(--safe-bottom))] pt-5 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[19px] font-bold text-ink">Sign out of this device?</p>
            <p className="mb-4 mt-1 text-[14px] leading-snug text-muted">Everything this app saved on the phone is deleted, including unsent requests, drafts and chat.{SIGN_IN_ENABLED ? ' You’ll need your password and a one-time code to sign in again.' : ' You’ll set up a new PIN next time.'}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setConfirmOut(false)}>
                Cancel
              </Button>
              <Button onClick={() => void signOutDevice()} className="bg-none! bg-[#d93036]!">
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h2>
      <Card className="divide-y divide-line">{children}</Card>
      {note && <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-muted">{note}</p>}
    </section>
  );
}
function Row({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3.5 p-4 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-blue text-brand-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block truncate text-[15.5px] font-medium text-ink">{value}</span>
      </span>
      <Pencil size={16} className="text-muted" />
    </button>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <span className="shrink-0 text-[14px] text-muted">{label}</span>
      <span className="text-right text-[15px] font-medium text-ink">{value}</span>
    </div>
  );
}
function Stat({ icon, tone, value, label, onClick }: { icon: React.ReactNode; tone: string; value: number; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card press flex flex-col items-start p-3.5 text-left">
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <span className="mt-2 text-[24px] font-bold leading-tight text-ink">{value}</span>
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
    </button>
  );
}

function EditProfile({ onClose, onSaved, onPhoto }: { onClose: () => void; onSaved: () => void; onPhoto: () => void }) {
  const me = useProfile();
  const [title, setTitle] = useState(me.title);
  const [first, setFirst] = useState(me.firstName);
  const [last, setLast] = useState(me.lastName);
  const [phone, setPhone] = useState(me.phone);
  const [email, setEmail] = useState(me.email);
  const [tried, setTried] = useState(false);
  const firstOk = tidyName(first);
  const lastOk = tidyName(last);
  const firstErr = tried && !firstOk ? 'Enter your first name (letters only).' : undefined;
  const lastErr = tried && !lastOk ? 'Enter your last name (letters only).' : undefined;
  const tidy = tidyPhone(phone);
  const phoneErr = tried && !tidy ? 'Enter a Nigerian mobile number, like 0803 456 7890.' : undefined;
  const emailErr = tried && !validEmail(email) ? 'Enter a valid email address, like name@example.com.' : undefined;
  const save = () => {
    setTried(true);
    if (!firstOk || !lastOk || !tidy || !validEmail(email)) return;
    saveProfile({ title, firstName: firstOk, lastName: lastOk, phone: tidy, email: email.trim().toLowerCase() });
    onSaved();
  };
  return (
    <div data-slide-layer className="fade-in fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div data-sheet-panel className="sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white px-5 pb-[max(18px,var(--safe-bottom))] pt-3 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        <p className="mb-4 text-[19px] font-bold text-ink">Edit profile</p>
        <div className="mb-5 flex items-center gap-4">
          <img src={me.photo} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPhoto} className="press flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-[14px] font-semibold text-brand-700">
              <Camera size={16} /> Change photo
            </button>
            {me.customPhoto && (
              <button type="button" onClick={() => saveProfile({ photo: undefined })} className="press rounded-full px-3.5 py-2 text-[14px] font-semibold text-[#d93036]">
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-3">
          <Field label="Title" id="p-title">
            <select id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass()}>
              {TITLES.map((t) => (
                <option key={t || 'none'} value={t}>
                  {t || 'None'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="First name" id="p-first" error={firstErr}>
            <input id="p-first" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} className={inputClass(firstErr)} />
          </Field>
        </div>
        <Field label="Last name" id="p-last" error={lastErr}>
          <input id="p-last" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} className={inputClass(lastErr)} />
        </Field>
        <Field label="Phone number" id="p-phone" error={phoneErr}>
          <input id="p-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(onlyPhone(e.target.value))} className={inputClass(phoneErr)} />
        </Field>
        <Field label="Email" id="p-email" error={emailErr}>
          <input id="p-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(onlyEmail(e.target.value))} className={inputClass(emailErr)} />
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}
