/**
 * My Profile (owner, 2026-11-24).
 *  • The agent can change their profile photo, phone number and email.
 *    Name, partner ID and branch are set by the branch.
 *  • Clear figures that open the patients behind them: everyone referred,
 *    completed, and still waiting (yet to arrive, or arrived but not finished),
 *    plus total commission earned.
 */
import { useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronRight, Clock3, Mail, Pencil, Phone, Users, Wallet } from 'lucide-react';
import { useApp } from '@/app/store';
import { AGENT, BRANCH, RULES, agentName } from '@/config/org';
import { naira, shortDate } from '@/domain/format';
import { commissionOf, serviceSummary, type Referral } from '@/domain/referrals';
import { TITLES, saveProfile, squarePhoto, tidyName, tidyPhone, useProfile, validEmail } from '@/domain/profile';
import { BANK_PURPOSE, BankRow } from '@/screens/BankDetails';
import { Button, Card, Chip, ChipRow, EmptyState, Field, InitialsAvatar, ScreenHeader, StatusBadge, inputClass } from '@/ui/kit';

/** Which patients a figure opens. */
export type PatientView = 'all' | 'completed' | 'waiting';
const VIEW_LABEL: Record<PatientView, string> = { all: 'All', completed: 'Completed', waiting: 'Waiting' };
const inView = (r: Referral, v: PatientView) => (v === 'all' ? true : v === 'completed' ? r.status === 'Completed' : r.status === 'Pending' || r.status === 'Arrived');

export function Profile() {
  const { referrals, navigate, showToast } = useApp();
  const me = useProfile();
  const [editing, setEditing] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const completed = referrals.filter((r) => r.status === 'Completed');
  const waiting = referrals.filter((r) => r.status === 'Pending' || r.status === 'Arrived');
  const notArrived = waiting.filter((r) => r.status === 'Pending').length;
  const earned = completed.reduce((s, r) => s + commissionOf(r), 0);
  const paid = completed.filter((r) => r.paidAt).reduce((s, r) => s + commissionOf(r), 0);

  const changePhoto = async (f?: File) => {
    if (!f) return;
    try {
      saveProfile({ photo: await squarePhoto(f) });
      showToast('Profile photo updated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t use that photo.');
    }
  };

  const rows: [string, string][] = [
    ['Partner ID', AGENT.id],
    ['Branch', BRANCH.label],
    ['Commission rate', `${Math.round(RULES.commissionRate * 100)}% of the patient’s full bill`],
    ['Member since', shortDate(`${AGENT.memberSince}T12:00:00`)],
  ];

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

      {/* Photo and name */}
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
          {AGENT.role}, {AGENT.id}
        </p>
      </div>

      {/* Figures that open their patients */}
      <div className="mb-2 grid grid-cols-2 gap-3">
        <Stat icon={<Users size={19} />} tone="bg-tint-blue text-brand-700" value={String(referrals.length)} label="Patients referred" note="Everyone you’ve sent" onClick={() => navigate('/profile/patients?show=all')} />
        <Stat icon={<CheckCircle2 size={19} />} tone="bg-tint-green text-good-ink" value={String(completed.length)} label="Completed" note="Tests done at the branch" onClick={() => navigate('/profile/patients?show=completed')} />
        <Stat icon={<Clock3 size={19} />} tone="bg-tint-orange text-orange" value={String(waiting.length)} label="Still waiting" note={`${notArrived} yet to arrive, ${waiting.length - notArrived} not finished`} onClick={() => navigate('/profile/patients?show=waiting')} />
        <Stat icon={<Wallet size={19} />} tone="bg-tint-purple text-violet" value={naira(earned)} label="Total earned" note={`${naira(paid)} paid out so far`} onClick={() => navigate('/earnings')} />
      </div>
      <p className="mb-5 px-1 text-[12.5px] text-muted">Tap a figure to see the patients behind it.</p>

      {/* Contact details (editable) */}
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Your contact details</h2>
      <Card className="mb-5 divide-y divide-line">
        <button type="button" onClick={() => setEditing(true)} className="press flex w-full items-center gap-3.5 p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-blue text-brand-600">
            <Phone size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Phone number</span>
            <span className="block truncate text-[15.5px] font-medium text-ink">{me.phone}</span>
          </span>
          <Pencil size={16} className="text-muted" />
        </button>
        <button type="button" onClick={() => setEditing(true)} className="press flex w-full items-center gap-3.5 p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-purple text-violet">
            <Mail size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Email</span>
            <span className="block truncate text-[15.5px] font-medium text-ink">{me.email}</span>
          </span>
          <Pencil size={16} className="text-muted" />
        </button>
      </Card>

      {/* Bank account (required) */}
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Payouts</h2>
      <div className="mb-5">
        <BankRow />
        <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-muted">{BANK_PURPOSE}</p>
      </div>

      {/* Set by the branch */}
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Set by your branch</h2>
      <Card className="divide-y divide-line">
        {rows.map(([l, v]) => (
          <div key={l} className="flex items-center justify-between gap-4 p-4">
            <span className="shrink-0 text-[14px] text-muted">{l}</span>
            <span className="text-right text-[15px] font-medium text-ink">{v}</span>
          </div>
        ))}
      </Card>
      <p className="mt-3 px-1 text-[12.5px] leading-relaxed text-muted">To change your branch, message your branch manager. Your name, photo, phone, email and bank changes are saved on this phone and reach the branch once the cloud connection is on.</p>

      {editing && <EditProfile onClose={() => setEditing(false)} onSaved={() => (setEditing(false), showToast('Profile updated'))} onPhoto={() => file.current?.click()} />}
    </>
  );
}

function Stat({ icon, tone, value, label, note, onClick }: { icon: React.ReactNode; tone: string; value: string; label: string; note: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card press flex flex-col items-start p-4 text-left">
      <span className="flex w-full items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>{icon}</span>
        <ChevronRight size={17} className="text-faint" />
      </span>
      <span className={`mt-3 font-bold leading-tight text-ink ${value.length > 7 ? 'text-[20px]' : 'text-[26px]'}`}>{value}</span>
      <span className="text-[14px] font-semibold text-ink-2">{label}</span>
      <span className="mt-0.5 text-[12px] leading-snug text-muted">{note}</span>
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white px-5 pb-[max(18px,var(--safe-bottom))] pt-3 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
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
          <input id="p-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass(phoneErr)} />
        </Field>
        <Field label="Email" id="p-email" error={emailErr}>
          <input id="p-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass(emailErr)} />
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

/* ─────────────── The patients behind a figure ─────────────── */

export function ProfilePatients() {
  const { referrals, navigate, route } = useApp();
  const start = (route.query.get('show') as PatientView) || 'all';
  const [view, setView] = useState<PatientView>(['all', 'completed', 'waiting'].includes(start) ? start : 'all');
  const counts = useMemo(() => ({ all: referrals.length, completed: referrals.filter((r) => inView(r, 'completed')).length, waiting: referrals.filter((r) => inView(r, 'waiting')).length }), [referrals]);
  const list = referrals.filter((r) => inView(r, view)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = list.filter((r) => r.status !== 'Cancelled').reduce((s, r) => s + commissionOf(r), 0);
  const NOTE: Record<PatientView, string> = {
    all: 'Every patient you’ve referred, newest first.',
    completed: 'Patients whose tests are done. Their commission is confirmed.',
    waiting: 'Patients yet to arrive at the branch, or who arrived but haven’t finished their tests.',
  };
  return (
    <>
      <ScreenHeader title="My Patients" />
      <p className="-mt-1 mb-4 text-[15px] leading-relaxed text-muted">{NOTE[view]}</p>
      <ChipRow>
        {(['all', 'completed', 'waiting'] as PatientView[]).map((v) => (
          <Chip key={v} active={view === v} onClick={() => setView(v)}>
            {VIEW_LABEL[v]} ({counts[v]})
          </Chip>
        ))}
      </ChipRow>
      {list.length > 0 && (
        <p className="mb-3 px-1 text-[13.5px] text-ink-2">
          {list.length} patient{list.length === 1 ? '' : 's'}, {view === 'completed' ? 'earned' : 'commission'} <b className="text-ink">{naira(total)}</b>
          {view === 'waiting' ? ' (estimated)' : ''}
        </p>
      )}
      {list.length === 0 ? (
        <EmptyState sticker="clipboard" title={view === 'waiting' ? 'No one is waiting' : 'No patients here yet'} text={view === 'waiting' ? 'Everyone you referred has finished, or the visit was cancelled.' : 'Patients you refer will appear here.'} />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => navigate(`/referrals/${r.id}`)} className="card press flex w-full items-start gap-3.5 p-4 text-left">
                <InitialsAvatar name={r.patient.name} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold text-ink">{r.patient.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {r.id}, {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{serviceSummary(r)}</span>
                  {view === 'waiting' && <span className="mt-1 block text-[12.5px] font-medium text-orange">{r.status === 'Pending' ? 'Yet to arrive at the branch' : 'Arrived, tests not finished'}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={r.status} />
                  <span className={`text-[15px] font-bold ${r.status === 'Cancelled' ? 'text-faint line-through' : r.status === 'Completed' ? 'text-good' : 'text-orange'}`}>{naira(commissionOf(r))}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
