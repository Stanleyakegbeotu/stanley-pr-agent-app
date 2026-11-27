/**
 * Marketer Settings (owner, 2026-11-26): their own profile photo, name,
 * email, phone and address; their sign-in email and password (only they can
 * set it; it is kept as a scrambled code, never the password itself); which
 * notifications they want; and what they can and cannot see.
 */
import { useRef, useState } from 'react';
import { BellRing, Camera, ChevronRight, KeyRound, ScrollText, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { logAudit } from '@company/services/audit';
import { readImage, updateProfile, useProfile } from '@company/services/settingsStore';
import { useNav } from '@/app/store';
import { AdminTopBar, PageGlow } from '@/admin/kit';
import { Panel, PageTitle } from '@/admin/branchFirst';
import { LongText, RuleInput } from '@/admin/fields';
import { SignInSection, Toggle } from '@/admin/settingsSections';
import { useSignIn } from '@/admin/signin';
import { emailProblem, nameProblem, phoneProblem } from '@/ui/fieldRules';
import { Sheet } from '@/admin/ui';
import { plural } from './data';
import { useMk } from './ui';

const PREFS_KEY = (id: string) => `stanley.mk.prefs.${id}`;
type Prefs = { week: boolean; quiet: boolean; hospitals: boolean; reports: boolean };
const DEFAULT_PREFS: Prefs = { week: true, quiet: true, hospitals: true, reports: true };
const readPrefs = (id: string): Prefs => {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY(id)) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
};

export function MarketerSettings() {
  const { m, me, go } = useMk();
  const { user } = useCompany();
  const { showToast } = useNav();
  const p = useProfile(user.key);
  const signIn = useSignIn(user.key);
  const file = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<null | 'profile' | 'password'>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(me.id));
  const photo = p.photo === undefined ? user.photo : p.photo || undefined;
  const setPref = (k: keyof Prefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY(me.id), JSON.stringify(next));
  };
  const pick = async (f?: File) => {
    if (!f) return;
    try {
      updateProfile(user.key, { photo: await readImage(f, 320) });
      logAudit({ category: 'Settings', action: 'Profile photo changed', record: `${user.name} (Marketer)`, details: 'By the account holder', branchId: m.branchId });
      showToast('Photo saved');
    } catch (err) {
      showToast((err as Error).message);
    }
  };
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Settings" sub="Your profile, sign-in and notifications" />

        {/* Profile card with the photo */}
        <div className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5] p-5 text-white shadow-[0_18px_40px_rgba(31,99,214,0.3)]">
          <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            <button type="button" onClick={() => file.current?.click()} className="press relative shrink-0" aria-label="Change profile photo">
              <span className="block overflow-hidden rounded-full ring-4 ring-white/70">{photo ? <img src={photo} alt="" className="h-20 w-20 object-cover" /> : <span className="grid h-20 w-20 place-items-center bg-white/20 text-[24px] font-bold">{user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}</span>}</span>
              <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-white text-brand-700 shadow-md">
                <Camera size={15} />
              </span>
            </button>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
            <span className="min-w-0">
              <b className="block truncate text-[20px]">{user.name}</b>
              <span className="block text-[13px] text-white/85">Marketer · {plural(m.mine.length, 'hospital')}</span>
              <span className="block truncate text-[12.5px] text-white/75">{user.email && !/not on record/i.test(user.email) ? user.email : 'No email yet'}</span>
            </span>
          </div>
          <div className="relative mt-4 flex gap-2">
            <button type="button" onClick={() => file.current?.click()} className="press flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[13px] font-semibold text-brand-700">
              <Camera size={15} /> {photo ? 'Change photo' : 'Upload photo'}
            </button>
            {photo && (
              <button type="button" onClick={() => (updateProfile(user.key, { photo: '' }), showToast('Photo removed'))} className="press flex min-h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 text-[13px] font-semibold text-white ring-1 ring-white/30">
                <Trash2 size={15} /> Remove
              </button>
            )}
          </div>
        </div>

        <Panel title="Account">
          <div className="-mx-1 divide-y divide-line">
            {[
              { icon: <UserRound size={19} />, tint: 'bg-brand-50 text-brand-700', title: 'Profile details', sub: 'Name, email, phone and address', on: () => setSheet('profile') },
              { icon: <ScrollText size={19} />, tint: 'bg-tint-orange text-warn-ink', title: 'Rules of engagement', sub: 'How hospitals, transfers, targets and bonus work', on: () => go('rules') },
              { icon: <KeyRound size={19} />, tint: 'bg-tint-purple text-violet', title: 'Sign-in and password', sub: signIn?.hash ? `Password set · signs in with ${signIn.email || 'no email yet'}` : 'Set up your sign-in email and password', on: () => setSheet('password') },
            ].map((r) => (
              <button key={r.title} type="button" onClick={r.on} className="press flex w-full items-center gap-3 px-1 py-3 text-left">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${r.tint}`}>{r.icon}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] text-ink">{r.title}</b>
                  <span className="block truncate text-[12.5px] text-muted">{r.sub}</span>
                </span>
                <ChevronRight size={17} className="text-faint" />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Notifications" note="What shows on your bell. Push notifications to your phone arrive with the cloud connection.">
          <div className="space-y-1">
            <Toggle label="Weekly and monthly target" hint="Beaten, behind, or needing a push" checked={prefs.week} onChange={(v) => setPref('week', v)} />
            <Toggle label="PR agents who need you" hint="Gone quiet or slipping" checked={prefs.quiet} onChange={(v) => setPref('quiet', v)} />
            <Toggle label="Your hospitals" hint="New hospitals taken on, hospitals given to you" checked={prefs.hospitals} onChange={(v) => setPref('hospitals', v)} />
            <Toggle label="Your reports" hint="When your manager or the admin answers" checked={prefs.reports} onChange={(v) => setPref('reports', v)} />
          </div>
        </Panel>

        <Panel title="What you see, and what you don't">
          <ul className="space-y-1.5 text-[13.5px] text-ink-2">
            <li className="flex gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" /> Your hospitals: patients and the amount each one generated
            </li>
            <li className="flex gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" /> The PR agents at your hospitals and how often they refer
            </li>
            <li className="flex gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" /> Your own targets and progress
            </li>
            <li className="flex gap-2 text-muted">
              <BellRing size={16} className="mt-0.5 shrink-0" /> Never: what a single PR agent generated, commission, patient names, billing
            </li>
          </ul>
        </Panel>
      </div>

      {sheet === 'profile' && <ProfileSheet onClose={() => setSheet(null)} />}
      {sheet === 'password' && (
        <Sheet back tall title="Sign-in and password" subtitle="Only you can set or change it" onClose={() => setSheet(null)}>
          <div className="px-1 pb-2">
            <SignInSection />
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Notification choices, read by the bell (true = show). */
export const notificationPrefs = (id: string) => readPrefs(id);

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { m } = useMk();
  const { user } = useCompany();
  const { showToast } = useNav();
  const p = useProfile(user.key);
  const [name, setName] = useState(p.name ?? user.name);
  const [email, setEmail] = useState(p.email ?? (user.email && !/not on record/i.test(user.email) ? user.email : ''));
  const [phone, setPhone] = useState(p.phone ?? user.phone ?? '');
  const [address, setAddress] = useState(p.address ?? user.address ?? '');
  const [tried, setTried] = useState(false);
  const errs = { name: nameProblem(name), email: emailProblem(email), phone: phoneProblem(phone) };
  return (
    <Sheet
      back
      tall
      title="Profile details"
      subtitle="Shown to your manager and on your work"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (errs.name || errs.email || errs.phone) return;
            updateProfile(user.key, { name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim() });
            logAudit({ category: 'Settings', action: 'Profile updated', record: `${name.trim()} (Marketer)`, details: 'Name, email, phone or address · by the account holder', branchId: m.branchId });
            showToast('Profile saved');
            onClose();
          }}
          className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white"
        >
          Save profile
        </button>
      }
    >
      <div className="space-y-3.5 px-1 pb-2">
        <RuleInput kind="name" label="Full name" required value={name} onChange={setName} showError={tried} />
        <RuleInput kind="email" label="Email address" value={email} onChange={setEmail} showError={tried} />
        <RuleInput kind="phone" label="Phone number" value={phone} onChange={setPhone} showError={tried} />
        <LongText label="Address" optional value={address} onChange={setAddress} max={240} minRows={2} placeholder={'House number and street\nArea, city'} />
        <p className="text-[12px] text-muted">To sign in with a different email, change it under Sign-in and password.</p>
      </div>
    </Sheet>
  );
}
