/**
 * Refer a Patient (owner's reference): 1 Patient → 2 Services → 3 Summary,
 * then "Referral sent" with the referral ID the patient shows at the branch.
 *
 * Everything typed is kept in the draft (app/store), so leaving the screen
 * or a refresh loses nothing. Errors are shown on the field itself.
 */
import { useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronDown, Copy, Hash, Pencil, Phone, Send, UserRound, Wallet } from 'lucide-react';
import { BRANCH, RULES } from '@/config/org';
import { CATEGORIES, categoryInfo } from '@/data/services';
import { smartSearch } from '@/domain/testSearch';
import { shareOnWhatsApp } from '@/domain/whatsapp';
import { priceText } from '@/screens/Services';
import { displayPhone, formatPersonName, isValidNgPhone, naira } from '@/domain/format';
import { billOf, commissionOf, servicesOf } from '@/domain/referrals';
import { useApp } from '@/app/store';
import { Button, Card, Chip, ChipRow, EmptyState, Field, ScreenHeader, SearchField, ServiceThumb, Stepper, Sticker, Subtitle, WhatsAppButton, FIELD_ON, inputClass } from '@/ui/kit';

const STEPS = ['Patient', 'Services', 'Summary'];
const PATH = ['/refer', '/refer/services', '/refer/summary'] as const;

export function ReferPatient({ step }: { step: 0 | 1 | 2 }) {
  if (step === 1) return <ServicesStep />;
  if (step === 2) return <SummaryStep />;
  return <PatientStep />;
}

/** Action bar fixed at the bottom of the screen (above the home indicator). */
function BottomAction({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-24" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-page/95 px-5 pb-[max(16px,var(--safe-bottom))] pt-3 backdrop-blur-xl md:left-[264px]">
        <div className="mx-auto max-w-[700px]">{children}</div>
      </div>
    </>
  );
}

/* ─────────────── 1 · Patient ─────────────── */

function PatientStep() {
  const { draft, setDraft, navigate } = useApp();
  const p = draft.patient;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<typeof p>) => {
    setDraft((d) => ({ ...d, patient: { ...d.patient, ...patch } }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const next = () => {
    const e: Record<string, string> = {};
    if (p.name.trim().split(' ').filter(Boolean).length < 2) e.name = 'Enter the patient’s first and last name.';
    if (!p.phone.trim()) e.phone = 'Enter the patient’s phone number.';
    else if (!isValidNgPhone(p.phone)) e.phone = 'Enter a valid Nigerian mobile number, e.g. 803 456 7890.';
    if (p.age && (Number(p.age) < 0 || Number(p.age) > 120)) e.age = 'Enter an age between 0 and 120.';
    setErrors(e);
    if (Object.keys(e).length) {
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(e)[0]}"]`)?.focus();
      return;
    }
    navigate(PATH[1]);
  };

  return (
    <>
      <ScreenHeader title="" />
      <div className="-mt-2 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink">Refer a Patient</h1>
          <p className="mt-1 text-[15px] text-muted">Create a new referral for a patient.</p>
        </div>
        <ReferIllustration />
      </div>
      <Stepper steps={STEPS} current={0} />

      <form ref={form} noValidate onSubmit={(e) => (e.preventDefault(), next())}>
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2.5 text-[18px] font-bold text-ink">
            <UserRound size={22} className="text-brand-600" fill="currentColor" strokeWidth={1.5} /> Patient Details
          </h2>
          <Field label="Full Name" required error={errors.name} id="pt-name">
            <input id="pt-name" name="name" autoComplete="name" value={p.name} onChange={(e) => set({ name: formatPersonName(e.target.value) })} placeholder="Enter patient’s full name" className={inputClass(errors.name)} />
          </Field>
          <Field label="Phone Number" required error={errors.phone} id="pt-phone">
            <div className="flex gap-2.5">
              <span className={`flex min-h-13 shrink-0 items-center gap-1.5 rounded-2xl border-[1.5px] bg-white px-3 text-[15px] text-ink ${errors.phone ? 'border-[#e5484d] ring-4 ring-[#fde3e3]' : FIELD_ON}`}>
                <NigeriaFlag /> +234 <ChevronDown size={16} className="text-muted" />
              </span>
              <input id="pt-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={p.phone} onChange={(e) => set({ phone: e.target.value.replace(/[^\d ]/g, '').slice(0, 13) })} placeholder="Enter phone number" className={`${inputClass(errors.phone)} min-w-0`} />
            </div>
          </Field>
          <Field label="Gender" optional>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Gender">
              {(['Male', 'Female'] as const).map((g) => (
                <button key={g} type="button" role="radio" aria-checked={p.gender === g} onClick={() => set({ gender: p.gender === g ? '' : g })} className={`press flex min-h-13 items-center gap-3 rounded-2xl border-[1.5px] px-4 text-[15px] ${FIELD_ON} ${p.gender === g ? 'bg-brand-50 font-semibold text-ink' : 'bg-white text-ink-2'}`}>
                  <span className={`grid h-5.5 w-5.5 place-items-center rounded-full border-2 ${p.gender === g ? 'border-brand-600' : 'border-[#b6c2d4]'}`}>{p.gender === g && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
                  {g}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Age" optional error={errors.age} id="pt-age">
            <input id="pt-age" name="age" type="number" inputMode="numeric" min={0} max={120} value={p.age} onChange={(e) => set({ age: e.target.value.slice(0, 3) })} placeholder="Enter age" className={inputClass(errors.age)} />
          </Field>
        </Card>
        <BottomAction>
          <Button type="submit" block>
            Next: Select Services <ArrowRight size={20} />
          </Button>
        </BottomAction>
      </form>
    </>
  );
}

function NigeriaFlag() {
  return (
    <span aria-label="Nigeria" role="img" className="flex h-4 w-6 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
      <i className="flex-1 bg-[#008751]" />
      <i className="flex-1 bg-white" />
      <i className="flex-1 bg-[#008751]" />
    </span>
  );
}

function ReferIllustration() {
  return (
    <span className="relative grid h-[92px] w-[100px] shrink-0 place-items-center rounded-3xl bg-linear-to-br from-brand-50 to-brand-100" aria-hidden="true">
      <Sticker name="clipboard" size={70} className="-rotate-6" />
      <Sticker name="manHealthWorker" size={46} className="absolute -bottom-2 -right-2" />
    </span>
  );
}

/* ─────────────── 2 · Services ─────────────── */

function ServicesStep() {
  const { draft, setDraft, navigate } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('All');
  const [error, setError] = useState('');
  const [shown, setShown] = useState(40);
  const list = smartSearch(q, cat).hits.map((h) => h.service);
  const chosen = draft.serviceIds;
  const total = billOf(draft);
  const toggle = (id: string) => {
    setDraft((d) => ({ ...d, serviceIds: d.serviceIds.includes(id) ? d.serviceIds.filter((x) => x !== id) : [...d.serviceIds, id] }));
    setError('');
  };

  if (!draft.patient.name) {
    // Arrived here without a patient (e.g. from a link) — start at step 1.
    return <PatientStep />;
  }

  return (
    <>
      <ScreenHeader title="Select Services" />
      <Subtitle>Choose the tests the doctor requested for {draft.patient.name}.</Subtitle>
      <Stepper steps={STEPS} current={1} />
      <SearchField active className="mb-4" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or describe a test…" aria-label="Search for a test, or describe what the doctor is checking for" />
      <ChipRow>
        <Chip active={cat === 'All'} onClick={() => (setCat('All'), setShown(40))}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={cat === c.key} onClick={() => (setCat(c.key), setShown(40))}>
            {c.label} ({c.count})
          </Chip>
        ))}
      </ChipRow>
      {list.length === 0 ? (
        <EmptyState sticker="microscope" title="No matching service" text="Try another name, e.g. “MRI” or “blood count”." />
      ) : (
        <ul className="space-y-3" role="listbox" aria-multiselectable="true" aria-label="Services">
          {list.slice(0, shown).map((s) => {
            const on = chosen.includes(s.id);
            const unpriced = s.price == null;
            return (
              <li key={s.id}>
                <button type="button" role="option" aria-selected={on} aria-disabled={unpriced} onClick={() => (unpriced ? setError(`${s.name} has no price recorded yet. Ask the branch.`) : toggle(s.id))} className={`card press flex w-full items-center gap-3.5 p-3 text-left ${on ? 'border-brand-500 ring-1 ring-brand-500' : ''} ${unpriced ? 'opacity-60' : ''}`}>
                  <ServiceThumb service={s} className="h-[72px] w-[80px] shrink-0 rounded-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-ink">{s.name}</span>
                    <span className={`mt-0.5 block font-bold ${unpriced ? 'text-[14px] text-muted' : 'text-[17px] text-brand-600'}`}>{priceText(s.price)}</span>
                    <span className="block truncate text-[13px] text-muted">{categoryInfo(s.category).label}</span>
                  </span>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c4cfdf]'}`}>{on && <Check size={16} strokeWidth={3} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {shown < list.length && (
        <Button variant="secondary" block className="mt-4" onClick={() => setShown((n) => n + 40)}>
          Show more ({list.length - shown} more)
        </Button>
      )}
      <BottomAction>
        {error && (
          <p className="mb-2 text-center text-[13.5px] font-medium text-[#d93036]" role="alert">
            {error}
          </p>
        )}
        <div className="mb-2.5 flex items-center justify-between text-[14.5px]">
          <span className="text-muted">
            {chosen.length} service{chosen.length === 1 ? '' : 's'} selected
          </span>
          <span className="font-bold text-ink">{naira(total)}</span>
        </div>
        <Button block onClick={() => (chosen.length ? navigate(PATH[2]) : setError('Select at least one service to continue.'))}>
          Next: Review Summary <ArrowRight size={20} />
        </Button>
      </BottomAction>
    </>
  );
}

/* ─────────────── 3 · Summary ─────────────── */

function SummaryStep() {
  const { draft, navigate, sendReferral } = useApp();
  const services = servicesOf(draft);
  if (!draft.patient.name) return <PatientStep />;
  if (!services.length) return <ServicesStep />;
  const bill = billOf(draft);
  const commission = commissionOf(draft);
  const p = draft.patient;

  return (
    <>
      <ScreenHeader title="Referral Summary" />
      <Subtitle>Review the referral details before sending.</Subtitle>
      <Stepper steps={STEPS} current={2} />

      <Card className="mb-3.5 p-5">
        <CardHead icon={<UserRound size={22} className="text-brand-600" fill="currentColor" strokeWidth={1.5} />} title="Patient Information" onEdit={() => navigate(PATH[0])} />
        <p className="text-[17px] font-semibold text-ink">{p.name}</p>
        <p className="mt-1.5 flex items-center gap-2.5 text-[15px] text-ink-2">
          <Phone size={17} className="text-muted" /> {displayPhone(p.phone)}
        </p>
        {(p.gender || p.age) && (
          <p className="mt-1 flex items-center gap-2.5 text-[15px] text-ink-2">
            <CalendarDays size={17} className="text-muted" /> {[p.gender, p.age ? `${p.age} years` : ''].filter(Boolean).join(' • ')}
          </p>
        )}
      </Card>

      <Card className="mb-3.5 p-5">
        <CardHead icon={<span className="grid h-6 w-6 place-items-center rounded-md bg-brand-600 text-[11px] font-bold text-white">Rx</span>} title={`Selected Services (${services.length})`} onEdit={() => navigate(PATH[1])} />
        <ul className="space-y-2.5">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 text-[15.5px]">
              <span className="flex items-center gap-2.5 text-ink">
                <Hash size={15} className="text-muted" /> {s.name}
              </span>
              <span className="font-semibold text-ink">{priceText(s.price)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-3.5 divide-y divide-line">
        <div className="flex items-center justify-between p-4 text-[16px]">
          <span className="text-ink">Estimated Patient Cost</span>
          <span className="font-bold text-ink">{naira(bill)}</span>
        </div>
        <div className="flex items-center justify-between p-4 text-[16px]">
          <span className="text-ink">Commission Rate</span>
          <span className="font-semibold text-ink">{Math.round(RULES.commissionRate * 100)}%</span>
        </div>
      </Card>

      <div className="mb-3 flex items-center gap-3.5 rounded-[20px] border border-[#c8ecd7] bg-tint-green p-4">
        <Wallet size={30} className="shrink-0 text-good" strokeWidth={2} />
        <span>
          <span className="block text-[15px] font-medium text-good-ink">Your Estimated Commission</span>
          <span className="block text-[28px] font-bold tracking-[-0.02em] text-good-ink">{naira(commission)}</span>
        </span>
      </div>
      <p className="mb-2 text-[12.5px] leading-relaxed text-muted">
        Sent to {BRANCH.label}. Commission is confirmed when the patient completes and pays for the tests; final prices are confirmed at the branch.
      </p>

      <BottomAction>
        <Button
          block
          onClick={() => {
            const r = sendReferral();
            navigate(`/refer/done/${r.id}`, { replace: true });
          }}
        >
          <Send size={20} /> Send Referral
        </Button>
      </BottomAction>
    </>
  );
}

function CardHead({ icon, title, onEdit }: { icon: React.ReactNode; title: string; onEdit: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2.5 text-[18px] font-bold text-ink">
        {icon}
        {title}
      </h2>
      <button type="button" onClick={onEdit} aria-label={`Edit ${title}`} className="press grid h-10 w-10 place-items-center rounded-full text-brand-600 hover:bg-brand-50">
        <Pencil size={19} />
      </button>
    </div>
  );
}

/* ─────────────── Sent ─────────────── */

export function ReferralSent({ id }: { id: string }) {
  const { referrals, navigate, showToast } = useApp();
  const r = referrals.find((x) => x.id === id);
  if (!r) return <EmptyState sticker="clipboard" title="Referral not found" text="It may have been sent from another device." />;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.id);
      showToast('Referral ID copied');
    } catch {
      showToast(r.id);
    }
  };
  return (
    <div className="flex min-h-[80dvh] flex-col items-center pt-[max(40px,var(--safe-top))] text-center">
      <div className="relative">
        <Sticker name="party" size={120} />
        <Sticker name="check" size={52} className="absolute -bottom-1 -right-2" />
      </div>
      <h1 className="mt-5 text-[26px] font-bold tracking-[-0.02em] text-ink">Referral sent!</h1>
      <p className="mt-2 max-w-80 text-[15px] leading-relaxed text-muted">Share the referral ID with {r.patient.name}. The front desk uses it to find the referral and bill the patient.</p>

      <button type="button" onClick={copy} className="card press mt-6 flex w-full max-w-sm items-center justify-between gap-3 px-5 py-4">
        <span className="text-left">
          <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-muted">Referral ID</span>
          <span className="block text-[26px] font-bold tracking-wide text-brand-700">{r.id}</span>
        </span>
        <Copy size={22} className="text-brand-600" />
      </button>
      <div className="mt-3 flex w-full max-w-sm items-center justify-between rounded-2xl bg-tint-green px-5 py-3.5 text-[15px]">
        <span className="text-good-ink">Estimated commission</span>
        <span className="font-bold text-good-ink">{naira(commissionOf(r))}</span>
      </div>
      {r.queued && <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-muted">Saved on this phone. It is sent to the branch automatically when the cloud connection is available.</p>}

      <div className="mt-6 grid w-full max-w-sm gap-3">
        <WhatsAppButton onClick={() => shareOnWhatsApp(r)}>Share with patient via WhatsApp</WhatsAppButton>
        <Button block variant="secondary" onClick={() => navigate(`/referrals/${r.id}`, { replace: true })}>
          View referral
        </Button>
        <Button block variant="ghost" onClick={() => navigate('/', { replace: true })}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}
