/**
 * New request (compliance rebuild, 2026-11-24): an e-request that replaces
 * the paper request form. 1 Patient → 2 Tests → 3 Clinical details → 4 Review
 * & send, then the request ID. A clinical reason is required for X-ray / CT;
 * the clinician confirms the patient has been told; the patient sees the tests
 * and the quoted price, and Silhouette (not the clinician's WhatsApp) sends
 * the patient their message. No payments of any kind to the clinician.
 *
 * Everything typed is kept in the draft (app/store), so leaving the screen
 * or a refresh loses nothing. Errors are shown on the field itself.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Hash, Pencil, Phone, Send, Siren, Stethoscope, UserRound, X } from 'lucide-react';
import { BRANCH, COMPANY } from '@/config/org';
import { isActive, useAccount } from '@/domain/account';
import { PatientMessageButton } from './PatientMessage';
import { CATEGORIES, categoryInfo } from '@/data/services';
import { smartSearch } from '@/domain/testSearch';
import { CategoryHeader, CategoryHome, priceText } from '@/screens/Services';
import { displayPhone, formatPersonName, isValidNgPhone, naira } from '@/domain/format';
import { needsIndication, quoteOf, servicesOf } from '@/domain/referrals';
import { hasDraftContent, useApp } from '@/app/store';
import { ResumedBanner } from '@/screens/refer/ResumeDraft';
import { ReferralNoteEditor } from './ReferralNote';
import { Button, Card, Chip, ChipRow, EmptyState, Field, ScreenHeader, SearchField, ServiceThumb, Stepper, Sticker, Subtitle, FIELD_ON, inputClass } from '@/ui/kit';
import { GuideButton } from '@/admin/testGuide';
import { useDetail } from '@/ui/detailSheet';

const STEPS = ['Patient', 'Tests', 'Clinical', 'Review'];
const PATH = ['/refer', '/refer/services', '/refer/clinical', '/refer/summary'] as const;

export function ReferPatient({ step }: { step: 0 | 1 | 2 | 3 }) {
  const { draft, setDraft } = useApp();
  // Remember where the agent is, so a restart brings them back to the same step.
  useEffect(() => {
    if (hasDraftContent(draft) && draft.step !== step) setDraft((d) => ({ ...d, step }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  if (step === 1) return <ServicesStep />;
  if (step === 2) return <ClinicalStep />;
  if (step === 3) return <SummaryStep />;
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
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink">New Request</h1>
          <p className="mt-1 text-[15px] text-muted">Request tests for your patient at {BRANCH.label}.</p>
        </div>
        <ReferIllustration />
      </div>
      <Stepper steps={STEPS} current={0} />
      <ResumedBanner />

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
            Next: Choose Tests <ArrowRight size={20} />
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
  const detail = useDetail();
  const { draft, setDraft, navigate } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('All');
  const [error, setError] = useState('');
  const [shown, setShown] = useState(40);
  const searching = q.trim().length > 0;
  const result = smartSearch(q, cat);
  const list = result.hits.map((h) => h.service);
  const chosen = draft.serviceIds;
  const total = quoteOf(draft);
  const toggle = (id: string) => {
    setDraft((d) => ({ ...d, serviceIds: d.serviceIds.includes(id) ? d.serviceIds.filter((x) => x !== id) : [...d.serviceIds, id] }));
    setError('');
  };
  const open = (c: string) => {
    setCat(c);
    setShown(40);
    document.querySelector('.h-dvh.overflow-y-auto')?.scrollTo({ top: 0 });
  };
  const current = cat === 'All' ? null : categoryInfo(cat);

  if (!draft.patient.name) {
    // Arrived here without a patient (e.g. from a link): start at step 1.
    return <PatientStep />;
  }

  return (
    <>
      <ScreenHeader title="Choose Tests" />
      <Subtitle>Choose the tests for {draft.patient.name}. Pick a category, or search by name. Search help can suggest tests from a description, but you choose the tests.</Subtitle>
      <Stepper steps={STEPS} current={1} />
      <ResumedBanner />

      {/* Search and categories stay pinned while the list scrolls (as in Branch Inventory). */}
      <div className="sticky top-[calc(4rem+var(--safe-top))] z-20 -mx-5 mb-4 bg-page px-5 pb-1 pt-2 md:-mx-8 md:px-8">
        <SearchField active value={q} onChange={(e) => (setQ(e.target.value), setShown(40))} placeholder="Search help: name or describe a test…" aria-label="Search help: type a test name or a description. You choose the tests." />
        <div className="h-4" aria-hidden="true" />
        <ChipRow>
          <Chip active={cat === 'All'} onClick={() => open('All')}>
            All categories
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} active={cat === c.key} onClick={() => open(c.key)}>
              {c.label} ({c.count})
            </Chip>
          ))}
        </ChipRow>
      </div>

      {/* What's been picked so far, removable from any category. */}
      {chosen.length > 0 && (
        <div className="mb-4 rounded-2xl bg-white p-3 ring-1 ring-line">
          <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Selected ({chosen.length})</p>
          <div className="flex flex-wrap gap-2">
            {servicesOf(draft).map((s) => (
              <button key={s.id} type="button" onClick={() => toggle(s.id)} aria-label={`Remove ${s.name}`} className="press inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-2 text-[13px] font-medium text-brand-700">
                <span className="truncate">{s.name}</span>
                <X size={14} className="shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {current && !searching && (
        <button type="button" onClick={() => open('All')} className="press mb-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(11,23,48,0.18)]">
          <ArrowLeft size={17} /> Back to categories
        </button>
      )}

      {!searching && !current ? (
        <CategoryHome onOpen={open} onExample={(x) => (setQ(x), setShown(40))} />
      ) : (
        <>
          {current && !searching && <CategoryHeader keyName={current.key} />}
          {searching && (
            <p className="mb-3 px-1 text-[13.5px] text-ink-2">
              <b className="text-ink">{list.length}</b> test{list.length === 1 ? '' : 's'} for “{q.trim()}”{current ? ` in ${current.label}` : ''}
              {result.topics.length > 0 && <span className="text-muted">. Understood as {result.topics.join(', ')}</span>}
            </p>
          )}
          {list.length === 0 ? (
            <EmptyState sticker="microscope" title="No matching service" text="Try another name, e.g. “MRI” or “blood count”, or describe what the doctor is checking for." />
          ) : (
            <ul className="space-y-3" role="listbox" aria-multiselectable="true" aria-label="Services">
              {list.slice(0, shown).map((s) => {
                const on = chosen.includes(s.id);
                const unpriced = s.price == null;
                return (
                  <li key={s.id}>
                    <div role="option" tabIndex={0} aria-selected={on} aria-disabled={unpriced} onClick={() => (unpriced ? setError(`${s.name} has no price recorded yet. Ask the branch.`) : toggle(s.id))} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), unpriced ? setError(`${s.name} has no price recorded yet. Ask the branch.`) : toggle(s.id))} className={`card press flex w-full cursor-pointer items-center gap-3.5 p-3 text-left ${on ? 'border-brand-500 ring-1 ring-brand-500' : ''} ${unpriced ? 'opacity-60' : ''}`}>
                      <ServiceThumb service={s} className="h-[72px] w-[80px] shrink-0 rounded-2xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold text-ink">{s.name}</span>
                        <span className={`mt-0.5 block font-bold ${unpriced ? 'text-[14px] text-muted' : 'text-[17px] text-brand-600'}`}>{priceText(s.price)}</span>
                        <span className="block truncate text-[13px] text-muted">{s.about || categoryInfo(s.category).label}</span>
                        <span className="mt-1 flex">
                          <GuideButton label={s.name} onClick={() => detail.open({ kind: 'service', id: s.id })} />
                        </span>
                      </span>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c4cfdf]'}`}>{on && <Check size={16} strokeWidth={3} />}</span>
                    </div>
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
        </>
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
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <BackButton onClick={() => navigate(PATH[0])} label="Back to patient details" />
          <Button block onClick={() => (chosen.length ? navigate(PATH[2]) : setError('Choose at least one test to continue.'))}>
            Next: Clinical details <ArrowRight size={20} />
          </Button>
        </div>
      </BottomAction>
    </>
  );
}

/** Go back one step to correct something (owner, 2026-11-24). Nothing typed is lost. */
function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="secondary" onClick={onClick} aria-label={label} className="px-5">
      <ArrowLeft size={19} /> Back
    </Button>
  );
}

/* ─────────────── 3 · Clinical details ─────────────── */

function ClinicalStep() {
  const { draft, setDraft, navigate } = useApp();
  const { account } = useAccount();
  const [error, setError] = useState('');
  if (!draft.patient.name) return <PatientStep />;
  if (!draft.serviceIds.length) return <ServicesStep />;
  const c = account?.clinician;
  const required = needsIndication(draft.serviceIds);
  const next = () => {
    if (required && (draft.indication?.trim().length ?? 0) < 10) return setError('Give the clinical reason for the X-ray / CT (at least a short sentence). Imaging with radiation must be justified.');
    navigate(PATH[3]);
  };
  return (
    <>
      <ScreenHeader title="Clinical Details" />
      <Subtitle>Tell the branch why these tests are needed and how soon.</Subtitle>
      <Stepper steps={STEPS} current={2} />
      <ResumedBanner />

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#f6c9c9] bg-[#fdecec] p-3.5 text-[13.5px] leading-snug text-[#7a271a]">
        <Siren size={18} className="mt-0.5 shrink-0 text-[#d93036]" /> For a medical emergency, send the patient to emergency care first.
      </div>

      <Card className="mb-3.5 p-5">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">Requesting clinician</p>
        <p className="mt-1 text-[16px] font-bold text-ink">
          {c?.title} {c?.firstName} {c?.lastName}
        </p>
        <p className="text-[13.5px] text-ink-2">
          {c?.profession}, {c?.regulator} {c?.licence}
        </p>
        <p className="text-[13px] text-muted">{c?.facility}</p>
      </Card>

      <Card className="mb-3.5 p-5">
        <Field label="Urgency" id="cl-urg">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Urgency">
            {(['Routine', 'Urgent'] as const).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={draft.urgency === u} onClick={() => setDraft((d) => ({ ...d, urgency: u }))} className={`press flex min-h-13 items-center gap-3 rounded-2xl border-[1.5px] px-4 text-[15px] ${FIELD_ON} ${draft.urgency === u ? (u === 'Urgent' ? 'bg-[#fdecec] font-semibold text-[#b42318]' : 'bg-brand-50 font-semibold text-ink') : 'bg-white text-ink-2'}`}>
                <span className={`grid h-5.5 w-5.5 place-items-center rounded-full border-2 ${draft.urgency === u ? 'border-brand-600' : 'border-[#b6c2d4]'}`}>{draft.urgency === u && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}</span>
                {u}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Clinical indication / reason for tests" required={required} optional={!required} error={error || undefined} id="cl-ind">
          <textarea
            id="cl-ind"
            rows={4}
            value={draft.indication ?? ''}
            onChange={(e) => (setDraft((d) => ({ ...d, indication: e.target.value.slice(0, 500) })), setError(''))}
            placeholder={required ? 'Required for X-ray and CT: symptoms, findings, what you want to rule out...' : 'Symptoms, findings, what you want to rule out...'}
            className={`${inputClass(error || undefined)} resize-none py-3 leading-snug`}
          />
        </Field>
        {required && <p className="-mt-2 text-[12.5px] leading-snug text-muted">Imaging that uses radiation (X-ray, CT, mammography, fluoroscopy) must be clinically justified (NNRA).</p>}
      </Card>

      {/* Optional note and voice note for the branch */}
      <ReferralNoteEditor />

      <BottomAction>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <BackButton onClick={() => navigate(PATH[1])} label="Back to tests" />
          <Button block onClick={next}>
            Next: Review <ArrowRight size={20} />
          </Button>
        </div>
      </BottomAction>
    </>
  );
}

/* ─────────────── 4 · Review & send ─────────────── */

function SummaryStep() {
  const { draft, setDraft, navigate, sendReferral } = useApp();
  const { account } = useAccount();
  const [error, setError] = useState('');
  const services = servicesOf(draft);
  if (!draft.patient.name) return <PatientStep />;
  if (!services.length) return <ServicesStep />;
  if (needsIndication(draft.serviceIds) && (draft.indication?.trim().length ?? 0) < 10) return <ClinicalStep />;
  const p = draft.patient;
  const send = () => {
    if (!isActive(account)) return setError('Your account must be verified before you can send requests.');
    if (!draft.patientInformed) return setError('Confirm that you have told the patient (the box above).');
    const r = sendReferral();
    navigate(`/refer/done/${r.id}`, { replace: true });
  };

  return (
    <>
      <ScreenHeader title="Review & Send" />
      <Subtitle>Check the request before sending it to {BRANCH.label}.</Subtitle>
      <Stepper steps={STEPS} current={3} />
      <ResumedBanner />

      <Card className="mb-3.5 p-5">
        <CardHead icon={<UserRound size={22} className="text-brand-600" fill="currentColor" strokeWidth={1.5} />} title="Patient" onEdit={() => navigate(PATH[0])} />
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
        <CardHead icon={<span className="grid h-6 w-6 place-items-center rounded-md bg-brand-600 text-[11px] font-bold text-white">Rx</span>} title={`Tests (${services.length})`} onEdit={() => navigate(PATH[1])} />
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
        <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5 text-[16px]">
          <span className="text-ink">Quoted total for the patient</span>
          <span className="font-bold text-ink">{naira(quoteOf(draft))}</span>
        </div>
        {draft.priceAsk && draft.priceAsk.amount > 0 && (
          <div className="mt-3 rounded-2xl bg-[#faf7ff] p-3 ring-1 ring-[#e4dbff]">
            <div className="flex items-center justify-between gap-2 text-[14.5px]">
              <span className="font-semibold text-violet">Reduction you asked for</span>
              <b className="text-violet">minus {naira(draft.priceAsk.amount)}</b>
            </div>
            <p className="mt-0.5 text-[12.5px] text-ink-2">{draft.priceAsk.reason}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[13px] text-ink">
                Patient would pay <b>{naira(Math.max(0, quoteOf(draft) - draft.priceAsk.amount))}</b> if approved
              </span>
              <button type="button" onClick={() => setDraft((d) => ({ ...d, priceAsk: undefined }))} className="press text-[12.5px] font-semibold text-[#d93036]">
                Remove
              </button>
            </div>
          </div>
        )}
        <p className="mt-1 text-[12.5px] text-muted">The patient sees these prices. The final price is confirmed at the branch{draft.priceAsk?.amount ? ', and the branch manager decides on the reduction' : ''}.</p>
      </Card>

      <Card className="mb-3.5 p-5">
        <CardHead icon={<Stethoscope size={21} className="text-brand-600" />} title="Clinical details" onEdit={() => navigate(PATH[2])} />
        <p className="text-[14.5px] text-ink-2">
          Urgency: <b className={draft.urgency === 'Urgent' ? 'text-[#b42318]' : 'text-ink'}>{draft.urgency}</b>
        </p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">Reason: {draft.indication?.trim() ? <span className="text-ink">{draft.indication.trim()}</span> : <span className="text-muted">Not given</span>}</p>
        {(draft.note?.trim() || draft.voiceNote) && <p className="mt-1 text-[14px] text-muted">{[draft.note?.trim() ? 'Note for the branch' : '', draft.voiceNote ? 'voice note' : ''].filter(Boolean).join(' and ')} attached.</p>}
      </Card>

      {/* Patient notice (required) */}
      <label className={`mb-3 flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] bg-white p-4 ${error && !draft.patientInformed ? 'border-[#e5484d]' : 'border-line'}`}>
        <input type="checkbox" checked={!!draft.patientInformed} onChange={(e) => (setDraft((d) => ({ ...d, patientInformed: e.target.checked })), setError(''))} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
        <span className="text-[14px] leading-snug text-ink">I have told the patient that their details and requested tests are being sent to {COMPANY.name}, and that I will be told when they attend and when results are ready.</span>
      </label>
      {error && (
        <p className="mb-2 px-1 text-[13.5px] font-medium text-[#d93036]" role="alert">
          {error}
        </p>
      )}

      <BottomAction>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <BackButton onClick={() => navigate(PATH[2])} label="Back to clinical details" />
          <Button block onClick={send}>
            <Send size={20} /> Send request
          </Button>
        </div>
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
  const { referrals, navigate } = useApp();
  const r = referrals.find((x) => x.id === id);
  if (!r) return <EmptyState sticker="clipboard" title="Request not found" text="It may have been sent from another device." />;
  return (
    <div className="flex min-h-[80dvh] flex-col items-center pt-[max(40px,var(--safe-top))] text-center">
      <div className="relative">
        <Sticker name="clipboard" size={110} />
        <Sticker name="check" size={52} className="absolute -bottom-1 -right-2" />
      </div>
      <h1 className="mt-5 text-[26px] font-bold tracking-[-0.02em] text-ink">Request sent</h1>
      <p className="mt-2 max-w-80 text-[15px] leading-relaxed text-muted">The front desk uses the request ID to find {r.patient.name.split(' ')[0]}’s tests. You’ll be told when they arrive and when results are ready.</p>

      <div className="card mt-6 flex w-full max-w-sm items-center justify-between gap-3 px-5 py-4">
        <span className="text-left">
          <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-muted">Request ID</span>
          <span className="block text-[26px] font-bold tracking-wide text-brand-700">{r.id}</span>
        </span>
        <Hash size={22} className="text-brand-600" />
      </div>
      {r.queued && <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-muted">Saved on this phone (encrypted). It’s sent to the branch when the server is connected.</p>}

      <div className="mt-6 grid w-full max-w-sm gap-3">
        <PatientMessageButton r={r} />
        <Button block variant="secondary" onClick={() => navigate(`/referrals/${r.id}`, { replace: true })}>
          View request
        </Button>
        <Button block variant="ghost" onClick={() => navigate('/', { replace: true })}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}
