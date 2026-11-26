/**
 * Billing (mobile staff workspace, owner 2026-11-25): the desktop's five-step
 * billing (BillingWorkspace + BillingSteps + BillingReceipt) on the phone, on
 * the SAME billing service (src/company/services/billing): Patient ID
 * reservation, totals, validation, duplicates, drafts and saving are never
 * computed here.
 *
 *   Start: New patient bill · Enter referral ID · saved drafts · today's bills.
 *   1 Patient: find an existing patient or enter a new one (same-name / phone
 *     warnings), walk-in or the referring PR agent and hospital, processed by.
 *   2 Services: most done tests, search, categories; selected list with the
 *     price for this bill only (if the role may change prices).
 *   3 Payment: discount (if allowed, capped), method or split, fully paid /
 *     part / not paid; a balance needs a reason, who approved it and an
 *     optional promised date.
 *   4 Preview: everything, with Edit on each part.
 *   5 Receipt: the desktop receipt, view only on the phone (privacy rule).
 * Look (owner, 2026-11-25, "premium"): a frosted header with a numbered
 * stepper, a question per step, calm fields, choice tiles instead of
 * toggles, a receipt style preview and Back / Continue in the bottom bar.
 * The Patient ID is reserved when leaving step 1 and only becomes a record
 * when the bill is saved. Work is saved as a draft automatically; leaving
 * asks Save draft or Discard. The tab bar hides while a bill is open.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowLeftRight, Banknote, Check, ChevronRight, CircleCheck, Clock3, CreditCard, FilePlus2, FlaskConical, Hash, Info, Minus, Pencil, PieChart, Plus, Search, Split, UserCheck, UserRound, X, type LucideIcon } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { PAYMENT_METHODS, type PaymentMethod } from '@company/data/types';
import { buildHospitalDirectory, hasPhone, hospitalKey } from '@company/data/legacy';
import { addDays, isoDate } from '@company/data/demo/generator';
import { resolveRange, serviceRanking } from '@company/services/analytics';
import { config, useConfig } from '@company/services/config';
import { enabledMethods } from '@company/services/org';
import {
  balanceApprovers,
  branchPrefix,
  discountApprovers,
  canOverridePrices,
  computeBill,
  deleteDraft,
  draftsForPatient,
  duplicateWarnings,
  findPatients,
  frequentServices,
  hasContent,
  lookupReferral,
  maxDiscount,
  newSession,
  patientSourceType,
  releasePatientId,
  reservePatientId,
  resolveHospital,
  saveDraft,
  similarPatients,
  submitBilling,
  useBilling,
  validateStep,
  type BillingSession,
  type Order,
  type PayChoice,
  type PatientRecord,
} from '@company/services/billing';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { onlyName, phoneProblem } from '@/ui/fieldRules';
import { Sheet } from '@/admin/ui';
import { AdminTopBar, PageGlow, SectionTitle } from '@/admin/kit';
import { AgentAvatar } from '@/admin/agentPhotos';
import { FieldErr, FieldLabel, inputCls, nameCase } from '@/admin/prManage';
import { LongText, RuleInput } from '@/admin/fields';
import { Toggle } from '@/admin/settingsSections';
import { buildItems, groupCategories, meta, type Item } from '@/admin/pages/Inventory';
import { PageTitle } from '@/admin/branchFirst';
import { useStaffChrome } from '../chrome';
import { ReceiptPanel, methodLabel } from '../receipt';
import { IncomingEntry, findIncoming, useIncoming, type Incoming } from '../incoming';
import { QUOTE_KEY, type QuoteHandOver } from '../calculator';
import { useBranchItems } from '@/admin/branchCatalogue';
import { GuideButton, aboutOf, useGuide } from '@/admin/testGuide';

type Step = 1 | 2 | 3;
const STEPS = ['Patient', 'Services', 'Payment', 'Preview'] as const;
const NEXT = ['Continue to tests', 'Continue to payment', 'Check the bill', 'Complete billing'];
const INTRO: [string, string][] = [
  ['Who is the patient?', 'Find them if they have been here before, or enter their details.'],
  ['Which tests today?', 'Tap the most done tests, search, or open a category.'],
  ['How are they paying?', 'Method, how much was paid, and any discount.'],
  ['Check and complete', 'Everything at a glance. Tap Edit to change a part.'],
];
const ago = (iso: string | null) => {
  if (!iso) return 'not saved yet';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 10 ? 'just now' : s < 60 ? `${s} seconds ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
const METHOD_ICON: Partial<Record<string, LucideIcon>> = { Cash: Banknote, POS: CreditCard, Transfer: ArrowLeftRight, Split };
const METHOD_SUB: Partial<Record<string, string>> = { Cash: 'At the desk', POS: 'Card', Transfer: 'To the bank', Split: 'Two methods' };
const digitsNum = (v: string) => Number(v.replace(/\D/g, '').slice(0, 12)) || 0;
const showNum = (n: number) => (n ? n.toLocaleString('en-NG') : '');

export function BillingPage() {
  const { branchId, setFocusMode } = useStaffChrome();
  const branch = getBranch(branchId)!;
  const { user, agents, route, navigate, moveDraftToTrash } = useCompany();
  const { showToast } = useNav();
  const store = useBilling();
  const me = { name: user.name, role: user.role };
  const money = (n: number) => formatMoney(n, branch.currency);
  const [session, setSession] = useState<BillingSession | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Order[] | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const latest = useRef<BillingSession | null>(null);
  const skipSave = useRef(false);
  latest.current = session;
  const drafts = store.drafts.filter((d) => d.branchId === branchId);
  const scrollTop = () => document.querySelector('.h-dvh.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });

  /* Resume a draft (?draft=id from the Drafts page). */
  const draftParam = route.query.get('draft');
  useEffect(() => {
    if (!draftParam) return;
    const cur = latest.current;
    if (cur && cur.id !== draftParam && cur.step < 5 && hasContent(cur)) saveDraft(cur);
    const d = store.drafts.find((x) => x.id === draftParam && x.branchId === branchId);
    if (!d) {
      setSession(null);
      showToast('That draft is no longer available: it was completed or moved to Trash');
    } else {
      setSession(d);
      setOrder(null);
      setErrs({});
      setLastSaved(d.lastSaved);
      setNotice(`Draft resumed, saved ${ago(d.lastSaved)}.`);
    }
    navigate(`/branch/${branchId}/billing`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);

  /* The + in the tab bar: start a new bill straight away (an open bill is kept as it is). ?name= fills the name typed in a search. */
  const newParam = route.query.get('new');
  const nameParam = route.query.get('name') ?? '';
  useEffect(() => {
    if (!newParam) return;
    const cur = latest.current;
    if (!cur || cur.step === 5) {
      const s0 = newSession(branchId, 'new', me);
      start(nameParam ? { ...s0, patient: { ...s0.patient, name: nameCase(onlyName(nameParam)) } } : s0);
    }
    navigate(`/branch/${branchId}/billing`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam]);

  /* Incoming referrals: ?incoming=<referral ID> starts the bill with the patient, referrer and requested tests. */
  const incoming = useIncoming(branchId);
  const startIncoming = (r: Incoming) => {
    const cur = latest.current;
    if (cur && cur.step < 5 && hasContent(cur)) saveDraft(cur);
    const open = store.drafts.find((d) => d.referralId === r.id && d.branchId === branchId);
    if (open) return start(open);
    start({ ...newSession(branchId, 'referral', me), patient: { uuid: null, existingId: null, existingType: null, name: r.patient.name, phone: r.patient.phone }, walkIn: false, agentId: r.agentId, hospital: null, referralId: r.id, services: r.services, step: 1, ...(r.priceAsk ? { discount: { amount: r.priceAsk.amount, reason: `PR agent asked: ${r.priceAsk.reason}`, approvedBy: '' } } : {}) });
    setNotice(`Referral ${r.id} from ${r.agentName}: check the patient's details, then continue.${r.priceAsk ? ` The agent asked for ${money(r.priceAsk.amount)} off: it is on the payment step, waiting for the branch manager's approval.` : ''}`);
  };
  const incParam = route.query.get('incoming');
  useEffect(() => {
    if (!incParam) return;
    const r = findIncoming(incoming, incParam);
    if (r) startIncoming(r);
    else showToast('That referral is no longer in the folder');
    navigate(`/branch/${branchId}/billing`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incParam]);

  /* Price calculator: ?quote=1 starts a bill with the quoted tests and the enquirer's name. */
  const quoteParam = route.query.get('quote');
  useEffect(() => {
    if (!quoteParam) return;
    try {
      const q = JSON.parse(sessionStorage.getItem(QUOTE_KEY) ?? 'null') as QuoteHandOver | null;
      sessionStorage.removeItem(QUOTE_KEY);
      if (q?.services.length) {
        const cur = latest.current;
        if (cur && cur.step < 5 && hasContent(cur)) saveDraft(cur);
        const s0 = newSession(branchId, 'new', me);
        start({ ...s0, patient: { ...s0.patient, name: q.name }, services: q.services });
        setNotice(`${q.services.length} test${q.services.length === 1 ? '' : 's'} from the price quote added. Fill in the patient's details.`);
      }
    } catch {
      /* nothing to carry over */
    }
    navigate(`/branch/${branchId}/billing`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteParam]);

  /* "The patient has a referral ID" from the folder. */
  const refParam = route.query.get('refid');
  useEffect(() => {
    if (!refParam) return;
    setRefOpen(true);
    navigate(`/branch/${branchId}/billing`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam]);

  /* Auto-save while working. */
  useEffect(() => {
    if (!session || session.step === 5 || !hasContent(session)) return;
    const id = window.setTimeout(() => setLastSaved(saveDraft(session).lastSaved), 900);
    return () => window.clearTimeout(id);
  }, [session]);
  /* Leaving the page any other way keeps the work as a draft. */
  useEffect(
    () => () => {
      const s = latest.current;
      if (s && !skipSave.current && s.step < 5 && hasContent(s)) saveDraft(s);
    },
    [],
  );
  /* A bill in progress takes the whole screen (no tab bar). */
  const open = !!session;
  useEffect(() => {
    setFocusMode(open);
    return () => setFocusMode(false);
  }, [open, setFocusMode]);
  /* Errors update live once shown. */
  useEffect(() => {
    if (!session || session.step > 3 || !Object.keys(errs).length) return;
    const now = check(session, session.step as Step).fields;
    const kept: Record<string, string> = {};
    for (const k of Object.keys(errs)) if (now[k]) kept[k] = now[k];
    if (Object.keys(kept).length !== Object.keys(errs).length || Object.keys(kept).some((k) => kept[k] !== errs[k])) setErrs(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /** The desktop's checks, plus the phone number rule (digits, right length). */
  const check = (s: BillingSession, step: Step) => {
    const c = validateStep(s, step, agents);
    if (step === 1 && s.patient.phone.trim() && !c.fields.phone) {
      const p = phoneProblem(s.patient.phone);
      if (p) return { ok: false, errors: [...c.errors, p], fields: { ...c.fields, phone: p } };
    }
    return c;
  };
  const set = (fn: (s: BillingSession) => BillingSession) => {
    setError(null);
    setSession((prev) => (prev ? fn(prev) : prev));
  };
  const start = (s: BillingSession) => {
    skipSave.current = false;
    setDraftPrompt(false);
    setOrder(null);
    setErrs({});
    setError(null);
    setNotice(null);
    setLastSaved(null);
    setSession(s);
  };
  const close = () => {
    setSession(null);
    setOrder(null);
    setErrs({});
    setNotice(null);
  };
  const ensureReservation = (s: BillingSession): BillingSession => {
    if (s.patient.uuid) {
      if (s.reservedId) releasePatientId(s.reservedId);
      return { ...s, reservedId: null, reservedType: null };
    }
    const type = patientSourceType(s);
    if (s.reservedId && s.reservedType === type) return s;
    if (s.reservedId) releasePatientId(s.reservedId);
    return { ...s, reservedId: reservePatientId(s.branchId, type, s.id), reservedType: type };
  };
  const goStep = (step: 1 | 2 | 3 | 4) => {
    setErrs({});
    setSession((s) => (s ? { ...(step > 1 && s.step === 1 ? ensureReservation(s) : s), step } : s));
    scrollTop();
  };
  const next = () => {
    if (!session) return;
    if (session.step <= 3) {
      const c = check(session, session.step as Step);
      if (!c.ok) {
        setErrs(c.fields);
        return;
      }
      let s = session;
      if (s.step === 1) s = ensureReservation(s);
      setErrs({});
      setNotice(null);
      setSession({ ...s, step: (s.step + 1) as BillingSession['step'] });
      scrollTop();
      return;
    }
    if (session.step === 4) complete();
  };
  const complete = (confirmed = session?.differentPatientConfirmed ?? false) => {
    if (!session) return;
    for (const step of [1, 2, 3] as const) {
      const c = check(session, step);
      if (!c.ok) {
        setSession({ ...session, step });
        setErrs(c.fields);
        return;
      }
    }
    const s = { ...session, differentPatientConfirmed: confirmed };
    if (!confirmed) {
      const d = duplicateWarnings(s);
      if (d.length) return setDupes(d);
    }
    const r = submitBilling(s, agents, me);
    if (!r.ok) return setError(r.error);
    skipSave.current = true;
    setOrder(r.order);
    setSession({ ...s, step: 5 });
    setDupes(null);
    scrollTop();
    showToast(`${r.order.invoiceNo} saved`);
  };
  const newBill = () => (drafts.length ? setDraftPrompt(true) : start(newSession(branchId, 'new', me)));

  /* ── No bill open: the start screen ── */
  if (!session) {
    const today = store.orders.filter((o) => o.branchId === branchId && new Date(o.createdAt).toDateString() === new Date().toDateString()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const todayTotal = today.reduce((s, o) => s + o.amountPaid, 0);
    return (
      <div className="relative">
        <PageGlow />
        <AdminTopBar />
        <div className="relative">
          <PageTitle title="Billing" sub={`${branch.name} branch · ${user.name}, ${user.role}`} />
          <div className="relative overflow-hidden rounded-[26px] bg-linear-to-br from-[#123e9c] via-[#1f6fe8] to-[#5ea6f7] p-5 text-white shadow-[0_18px_40px_rgba(31,99,214,0.3)]">
            <span aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
            <Sticker name="clipboard" size={86} className="absolute right-3 top-4 drop-shadow-[0_10px_18px_rgba(0,0,0,0.2)]" />
            <p className="relative text-[13px] font-medium text-white/85">Bill a patient</p>
            <p className="relative max-w-[70%] text-[22px] font-bold leading-tight">Register, add tests, take payment and print the receipt</p>
            <div className="relative mt-4 grid gap-2">
              <button type="button" onClick={newBill} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-brand-700 shadow-[0_8px_18px_rgba(0,0,0,0.15)]">
                <FilePlus2 size={19} /> New patient bill
              </button>
              <button type="button" onClick={() => setRefOpen(true)} className="press flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/15 text-[14px] font-semibold ring-1 ring-white/35">
                <Hash size={17} /> Enter referral ID
              </button>
            </div>
          </div>

          <div className="mt-4">
            <IncomingEntry branchId={branchId} />
          </div>

          {drafts.length > 0 && (
            <>
              <SectionTitle title={`Unfinished bills · ${drafts.length}`} action="All drafts" onAction={() => navigate(`/branch/${branchId}/drafts`)} />
              <ul className="space-y-2">
                {drafts.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <DraftRow d={d} money={money} onResume={() => start(d)} />
                  </li>
                ))}
              </ul>
            </>
          )}

          <SectionTitle title={`Bills today · ${today.length}`} />
          {today.length ? (
            <>
              <p className="-mt-1 mb-2 text-[12.5px] text-muted">{money(todayTotal)} received on bills made in STANLEY today</p>
              <ul className="space-y-2">
                {today.map((o) => (
                  <li key={o.uuid}>
                    <button type="button" onClick={() => setReceipt(o)} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
                      <InitialsAvatar name={o.patient.name} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-2">
                          <b className="truncate text-[14.5px] text-ink">{o.patient.name}</b>
                          <b className="shrink-0 text-[14.5px] text-ink">{money(o.total)}</b>
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {o.invoiceNo} · {o.patient.patientId} · {new Date(o.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.balance <= 0 ? 'bg-tint-green text-good-ink' : o.amountPaid > 0 ? 'bg-[#fff1e0] text-[#b45309]' : 'bg-[#fdecec] text-[#b42318]'}`}>{o.balance <= 0 ? 'Paid' : o.amountPaid > 0 ? `Part paid · ${money(o.balance)} owed` : 'Not paid'}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-line/70">
              <Sticker name="calendar" size={40} />
              <p className="text-[13.5px] text-muted">No bills made in STANLEY yet today. Tap New patient bill to start.</p>
            </div>
          )}
        </div>
        {refOpen && <ReferralSheet branchId={branchId} incoming={incoming} onIncoming={(r) => (setRefOpen(false), startIncoming(r))} onClose={() => setRefOpen(false)} onFound={(m, ref) => (setRefOpen(false), start({ ...newSession(branchId, 'referral', me), patient: { uuid: m.patient.uuid, existingId: m.patient.patientId, existingType: m.patient.type, name: m.patient.name, phone: m.patient.phone }, walkIn: false, agentId: m.agentId, hospital: m.hospital, referralId: ref, services: m.services, step: 2 }))} />}
        {draftPrompt && (
          <Sheet title="Continue a saved bill?" subtitle={`${drafts.length} unfinished bill${drafts.length === 1 ? '' : 's'} at this branch`} onClose={() => setDraftPrompt(false)} footer={<button type="button" onClick={() => start(newSession(branchId, 'new', me))} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">Start a new bill anyway</button>}>
            <ul className="space-y-2 px-1 pb-2">
              {drafts.map((d) => (
                <li key={d.id}>
                  <DraftRow d={d} money={money} onResume={() => start(d)} />
                </li>
              ))}
            </ul>
          </Sheet>
        )}
        {receipt && (
          <Sheet title="Receipt" subtitle={`${receipt.invoiceNo} · ${receipt.patient.name}`} onClose={() => setReceipt(null)} tall>
            <div className="px-1 pb-3">
              <ReceiptPanel order={receipt} branch={branch} />
            </div>
          </Sheet>
        )}
      </div>
    );
  }

  /* ── A bill in progress ── */
  const t = computeBill(session);
  const step = session.step;
  const sameDrafts = step === 1 ? draftsForPatient(branchId, session.patient, session.id) : [];
  return (
    <div className="no-stagger relative pb-28">
      {/* Header: who is being billed, autosave, and the numbered stepper. */}
      <header className="sticky top-0 z-30 -mx-5 bg-[#f4f8fe]/90 px-5 pb-3 pt-[var(--safe-top)] shadow-[0_10px_24px_-18px_rgba(30,74,160,0.35)] backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex min-h-14 items-center gap-2.5">
          <button type="button" onClick={() => (step === 5 ? close() : hasContent(session) ? setLeaving(true) : (session.reservedId && releasePatientId(session.reservedId), close()))} aria-label="Close bill" className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[0_4px_12px_rgba(30,74,160,0.12)] ring-1 ring-line/60">
            {step === 5 ? <X size={20} /> : <ArrowLeft size={20} />}
          </button>
          {session.patient.name.trim() ? <InitialsAvatar name={session.patient.name} size={38} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16.5px] font-bold leading-tight text-ink">{step === 5 ? 'Billing complete' : session.patient.name.trim() || 'New patient bill'}</p>
            <p className="flex items-center gap-1.5 truncate text-[12px] text-muted">
              {step < 5 && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lastSaved ? 'bg-good' : 'bg-[#c3cede]'}`} />}
              <span className="truncate">{step === 5 ? order?.invoiceNo : `${session.patient.existingId ?? session.reservedId ?? 'ID reserved on Continue'} · ${lastSaved ? `saved ${ago(lastSaved)}` : 'saves as you go'}`}</span>
            </p>
          </div>
          {step >= 2 && step < 5 && (
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-ink shadow-sm ring-1 ring-line/70">{money(t.total)}</span>
          )}
        </div>
        {step < 5 && (
          <ol className="mt-1 flex items-start" aria-label="Billing steps">
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const done = n < step;
              const on = n === step;
              return (
                <li key={label} className="relative flex flex-1 flex-col items-center">
                  {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-[15px] h-[3px] w-full -translate-x-[15px] rounded-full ${n <= step ? 'bg-linear-to-r from-good to-brand-500' : 'bg-[#dbe5f3]'}`} style={{ width: 'calc(100% - 30px)' }} />}
                  <button type="button" disabled={n > step} onClick={() => goStep(n)} aria-current={on ? 'step' : undefined} className={`press relative z-10 grid h-[30px] w-[30px] place-items-center rounded-full text-[13px] font-bold transition-all ${on ? 'bg-linear-to-b from-brand-500 to-brand-700 text-white shadow-[0_6px_14px_rgba(31,111,232,0.4)] ring-4 ring-brand-100' : done ? 'bg-good text-white' : 'bg-white text-faint ring-1 ring-[#dbe5f3]'}`}>
                    {done ? <Check size={15} strokeWidth={3} /> : n}
                  </button>
                  <span className={`mt-1 text-[11.5px] font-semibold ${on ? 'text-brand-700' : done ? 'text-ink-2' : 'text-faint'}`}>{label}</span>
                </li>
              );
            })}
          </ol>
        )}
      </header>

      {step < 5 && (
        <div className="mb-3 mt-4 px-0.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-brand-600">Step {step} of 4</p>
          <h2 className="mt-0.5 text-[23px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{INTRO[step - 1]![0]}</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">{INTRO[step - 1]![1]}</p>
        </div>
      )}

      {notice && (
        <p className="mb-3 flex items-start gap-2.5 rounded-2xl bg-linear-to-r from-[#eaf2ff] to-[#f3f7ff] px-3.5 py-3 text-[13px] leading-snug text-brand-800 ring-1 ring-[#d9e6fb]">
          <Info size={16} className="mt-px shrink-0" /> {notice}
        </p>
      )}
      {error && <p className="mb-3 rounded-2xl bg-[#fdecec] px-3.5 py-3 text-[13px] font-medium text-[#b42318] ring-1 ring-[#f9d4d4]">{error}</p>}
      {sameDrafts.length > 0 && (
        <div className="mb-3 rounded-[20px] bg-[#fff7ec] p-3.5 ring-1 ring-[#ffe0b8]">
          <p className="text-[13.5px] font-semibold text-[#9a4a07]">This patient has an unfinished bill</p>
          {sameDrafts.slice(0, 2).map((d) => (
            <button key={d.id} type="button" onClick={() => (deleteDraft(session.id, { release: true }), start(d))} className="press mt-2 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-[13px]">
              <span>
                Step {d.step} · {d.services.length} test{d.services.length === 1 ? '' : 's'} · saved {ago(d.lastSaved)}
              </span>
              <b className="text-brand-600">Resume</b>
            </button>
          ))}
        </div>
      )}

      {step === 1 && <PatientStep s={session} set={set} errs={errs} branchId={branchId} />}
      {step === 2 && <ServicesStep s={session} set={set} errs={errs} branchId={branchId} />}
      {step === 3 && <PaymentStep s={session} set={set} errs={errs} branchId={branchId} />}
      {step === 4 && <PreviewStep s={session} branchId={branchId} onEdit={goStep} />}
      {step === 5 && order && (
        <>
          <div className={`relative mb-4 overflow-hidden rounded-[26px] bg-linear-to-br p-5 text-white ${order.balance > 0 ? 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]' : 'from-[#0f7a43] via-[#16a35a] to-[#4cc98a]'}`}>
            <Sticker name={order.balance > 0 ? 'calendar' : 'party'} size={80} className="absolute right-3 top-3" />
            <CircleCheck size={30} />
            <p className="mt-2 text-[20px] font-bold leading-tight">Billing complete</p>
            <p className="mt-1 max-w-[75%] text-[13px] text-white/90">
              {order.invoiceNo} saved for {order.patient.name} ({order.patient.patientId}). Total {money(order.total)}, paid {money(order.amountPaid)}
              {order.balance > 0 ? `, ${money(order.balance)} still owed` : ''}.
            </p>
            <p className="mt-2 text-[12px] text-white/85">Saved on this phone and queued for the cloud.</p>
          </div>
          <ReceiptPanel order={order} branch={branch} />
        </>
      )}

      {/* Bottom action bar (on <body>: the page transition must not become its frame) */}
      {createPortal(<div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(12px,var(--safe-bottom))] pt-3 shadow-[0_-10px_30px_rgba(30,74,160,0.1)] backdrop-blur md:left-[264px]">
        <div className="mx-auto flex max-w-[860px] items-center gap-3">
          {step === 5 ? (
            <>
              <button type="button" onClick={close} className="press min-h-12 flex-1 rounded-2xl bg-page text-[15px] font-semibold text-ink-2 ring-1 ring-line">
                Done
              </button>
              <button type="button" onClick={() => start(newSession(branchId, 'new', me))} className="press min-h-12 flex-[1.4] rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
                Start a new bill
              </button>
            </>
          ) : (
            <>
              {step >= 2 && (
                <button type="button" onClick={() => goStep((step - 1) as 1 | 2 | 3)} aria-label="Back to the previous step" className="press grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-page text-ink ring-1 ring-line">
                  <ArrowLeft size={20} />
                </button>
              )}
              {step >= 2 && (
                <span className="min-w-0">
                  <span className="block text-[11.5px] text-muted">{step >= 3 ? (t.balance > 0 ? `Paid ${money(t.amountPaid)}` : 'Total') : `${session.services.length} test${session.services.length === 1 ? '' : 's'}`}</span>
                  <b className="block truncate text-[18px] tracking-[-0.01em] text-ink">{money(t.total)}</b>
                </span>
              )}
              <button type="button" onClick={next} className={`press flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[15px] font-bold text-white ${step === 4 ? 'bg-linear-to-b from-[#22b866] to-[#139a52] shadow-[0_10px_22px_rgba(22,163,90,0.35)]' : 'bg-linear-to-b from-brand-500 to-brand-600 shadow-[0_10px_22px_rgba(31,111,232,0.32)]'}`}>
                {NEXT[step - 1]} {step < 4 ? <ChevronRight size={18} /> : <Check size={18} />}
              </button>
            </>
          )}
        </div>
      </div>, document.body)}

      {dupes && (
        <Sheet
          title="Possible duplicate today"
          subtitle="A similar patient was billed today"
          onClose={() => setDupes(null)}
          footer={
            <div className="grid gap-2">
              <button type="button" onClick={() => complete(true)} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
                It's a different patient, save the bill
              </button>
              <button type="button" onClick={() => (setDupes(null), goStep(1))} className="press min-h-11 w-full rounded-2xl bg-page text-[14px] font-semibold text-ink-2 ring-1 ring-line">
                Go back and check
              </button>
            </div>
          }
        >
          <ul className="space-y-2 px-1 pb-2">
            {dupes.map((o) => (
              <li key={o.uuid} className="rounded-2xl bg-page px-3 py-2.5 text-[13px]">
                <b className="text-ink">{o.patient.name}</b> · {o.patient.patientId}
                <span className="block text-muted">
                  {o.invoiceNo} · {new Date(o.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {o.patient.phone || 'no phone'} · {money(o.total)}
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {leaving && (
        <Sheet
          title="Leave this bill?"
          subtitle="It isn't finished yet"
          onClose={() => setLeaving(false)}
          footer={
            <div className="grid gap-2">
              <button type="button" onClick={() => (saveDraft(session), setLeaving(false), showToast('Saved as a draft. Continue it from Drafts'), close())} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
                Save as draft and leave
              </button>
              <button
                type="button"
                onClick={() => {
                  skipSave.current = true;
                  if (store.drafts.some((d) => d.id === session.id)) moveDraftToTrash(session.id, 'Discarded while billing');
                  else if (session.reservedId) releasePatientId(session.reservedId);
                  setLeaving(false);
                  showToast('Bill discarded. Restore it from Trash within 30 days');
                  close();
                  skipSave.current = false;
                }}
                className="press min-h-11 w-full rounded-2xl bg-[#fdecec] text-[14px] font-semibold text-[#b42318]"
              >
                Discard this bill
              </button>
            </div>
          }
        >
          <p className="px-1 pb-2 text-[14px] text-ink-2">Save it as a draft to finish later, or discard it. A discarded bill goes to Trash and its Patient ID is released.</p>
        </Sheet>
      )}
    </div>
  );
}

/* ─────────────── pieces ─────────────── */

function DraftRow({ d, money, onResume }: { d: BillingSession; money: (n: number) => string; onResume: () => void }) {
  const t = computeBill(d);
  return (
    <button type="button" onClick={onResume} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint-orange">
        <Sticker name="clipboard" size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[14.5px] text-ink">{d.patient.name.trim() || 'Unnamed patient'}</b>
        <span className="block truncate text-[12px] text-muted">
          Step {d.step} of 5 · {d.services.length} test{d.services.length === 1 ? '' : 's'} · {money(t.total)} · saved {ago(d.lastSaved)}
        </span>
        {d.startedBy && <span className="block truncate text-[11.5px] text-muted">Started by {d.startedBy.name}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700">Resume</span>
    </button>
  );
}

function Card({ icon, title, hint, children, n }: { icon: ReactNode; title: string; hint?: string; children: ReactNode; n?: number }) {
  return (
    <section className="mb-3.5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_-12px_rgba(30,74,160,0.18)] ring-1 ring-[#e6edf7]">
      <div className="mb-3.5 flex items-start gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-linear-to-br from-[#eaf2ff] to-[#d6e5ff] text-brand-600">
          {icon}
          {n != null && <span className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-brand-600 text-[10.5px] font-bold text-white ring-2 ring-white">{n}</span>}
        </span>
        <span className="min-w-0 pt-0.5">
          <span className="block text-[16.5px] font-bold leading-tight text-ink">{title}</span>
          {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{hint}</span>}
        </span>
      </div>
      {children}
    </section>
  );
}

/** A big choice tile (instead of a switch): icon or sticker, title, one line. */
function Choice({ on, onClick, title, sub, art, tone = 'brand' }: { on: boolean; onClick: () => void; title: string; sub: string; art: ReactNode; tone?: 'brand' | 'green' | 'violet' }) {
  const ring = tone === 'green' ? 'ring-good bg-[#effbf4]' : tone === 'violet' ? 'ring-violet bg-[#f5f1ff]' : 'ring-brand-500 bg-brand-50';
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`press relative flex flex-col items-start rounded-[20px] p-3.5 text-left transition-all ${on ? `ring-2 ${ring} shadow-[0_8px_20px_-10px_rgba(31,111,232,0.45)]` : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
      <span className="grid h-11 w-11 place-items-center">{art}</span>
      <b className="mt-1.5 block text-[14.5px] leading-tight text-ink">{title}</b>
      <span className="mt-0.5 block text-[12px] leading-snug text-muted">{sub}</span>
      <span className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full ${on ? 'bg-brand-600 text-white' : 'ring-2 ring-[#d3dce9]'}`}>{on && <Check size={12} strokeWidth={3.2} />}</span>
    </button>
  );
}

interface StepProps {
  s: BillingSession;
  set: (fn: (s: BillingSession) => BillingSession) => void;
  errs: Record<string, string>;
  branchId: string;
}

/* ─────────────── 1 Patient ─────────────── */

function PatientStep({ s, set, errs, branchId }: StepProps) {
  const { agents, user } = useCompany();
  const [find, setFind] = useState('');
  const [pickAgent, setPickAgent] = useState(false);
  const [pickHospital, setPickHospital] = useState(false);
  const results = find.trim() ? findPatients(branchId, find) : [];
  const existing = !!s.patient.uuid;
  const similar = existing ? [] : similarPatients(branchId, s.patient.name, s.patient.phone);
  const agent = s.agentId !== null ? agents.find((a) => a.id === s.agentId) : undefined;
  const usePatient = (p: PatientRecord) => {
    set((x) => ({ ...x, patient: { uuid: p.uuid, existingId: p.patientId, existingType: p.type, name: p.name, phone: p.phone }, differentPatientConfirmed: false }));
    setFind('');
  };
  const [mode, setMode] = useState<'new' | 'find'>('new');
  return (
    <>
      <Card icon={<UserRound size={19} />} n={1} title="Patient details" hint="Returning patients keep their Patient ID. A new patient gets one reserved for this bill.">
        {existing ? (
          <div className="relative overflow-hidden rounded-[20px] bg-linear-to-br from-[#e9f9ef] to-[#d3f3e1] p-3.5 ring-1 ring-[#bfe9d0]">
            <div className="flex items-center gap-3">
              <InitialsAvatar name={s.patient.name} size={48} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[16px] text-ink">{s.patient.name}</b>
                <span className="block truncate text-[12.5px] text-good-ink">
                  {s.patient.existingId} · {s.patient.existingType === 'REFERRED' ? 'Referred' : 'Walk-in'}
                  {s.patient.phone ? ` · ${s.patient.phone}` : ''}
                </span>
              </span>
              <UserCheck size={22} className="shrink-0 text-good" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#bfe9d0] pt-2.5">
              <span className="text-[12.5px] text-good-ink">Returning patient. Keeps this Patient ID.</span>
              <button type="button" onClick={() => (set((x) => ({ ...x, patient: { uuid: null, existingId: null, existingType: null, name: '', phone: '' } })), setMode('find'))} className="press shrink-0 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-600 shadow-sm">
                Change
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3.5 grid grid-cols-2 gap-1 rounded-2xl bg-[#eef3fa] p-1" role="tablist" aria-label="New or returning patient">
              {(
                [
                  ['new', 'New patient'],
                  ['find', 'Returning patient'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold transition-all ${mode === k ? 'bg-white text-brand-700 shadow-[0_4px_10px_rgba(30,74,160,0.12)]' : 'text-muted'}`}>
                  {l}
                </button>
              ))}
            </div>
            {mode === 'find' ? (
              <div>
                <div className="relative">
                  <Search size={17} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted" />
                  <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder="Patient ID, name or phone" aria-label="Find a returning patient" className={`${inputCls()} pl-11`} />
                </div>
                {find.trim() ? (
                  <ul className="drop-down mt-2.5 space-y-1.5">
                    {results.length === 0 ? (
                      <li className="rounded-2xl bg-page px-3.5 py-3 text-[13px] text-muted">
                        No registered patient matches “{find.trim()}”.{' '}
                        <button type="button" onClick={() => (setMode('new'), set((x) => ({ ...x, patient: { ...x.patient, name: /\d/.test(find) ? x.patient.name : nameCase(onlyName(find.trim())) } })))} className="font-semibold text-brand-600">
                          Enter them as a new patient
                        </button>
                      </li>
                    ) : (
                      results.map((p) => (
                        <li key={p.uuid}>
                          <button type="button" onClick={() => usePatient(p)} className="press flex w-full items-center gap-3 rounded-2xl bg-[#f8fafd] p-2.5 text-left ring-1 ring-[#e3eaf4]">
                            <InitialsAvatar name={p.name} size={40} />
                            <span className="min-w-0 flex-1">
                              <b className="block truncate text-[14.5px] text-ink">{p.name}</b>
                              <span className="block truncate text-[12px] text-muted">
                                {p.patientId} · {p.type === 'REFERRED' ? 'Referred' : 'Walk-in'}
                                {p.phone ? ` · ${p.phone}` : ''}
                              </span>
                            </span>
                            <span className="rounded-full bg-brand-600 px-3 py-1 text-[12.5px] font-semibold text-white">Use</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : (
                  <p className="mt-2 px-1 text-[12.5px] text-muted">Ask for their Patient ID (on the receipt), or search by name or phone.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3.5">
                <RuleInput kind="name" label="Full name" required value={s.patient.name} onChange={(name) => set((x) => ({ ...x, patient: { ...x.patient, name }, differentPatientConfirmed: false }))} placeholder="As on their ID or hospital card" error={errs.name} />
                <RuleInput kind="phone" label="Phone number" required={config().patient.phoneRequired} optional={!config().patient.phoneRequired} value={s.patient.phone} onChange={(phone) => set((x) => ({ ...x, patient: { ...x.patient, phone } }))} error={errs.phone} />
                {similar.length > 0 && (
                  <div className="rounded-2xl bg-[#fff7ec] p-3 ring-1 ring-[#ffe0b8]">
                    <p className="text-[13px] font-semibold text-[#9a4a07]">
                      {similar.length} registered patient{similar.length === 1 ? '' : 's'} with this name or phone
                    </p>
                    <p className="text-[12px] text-[#9a4a07]/90">Use the existing record to avoid a duplicate, or continue if this is someone else.</p>
                    {similar.slice(0, 3).map((p) => (
                      <button key={p.uuid} type="button" onClick={() => usePatient(p)} className="press mt-1.5 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-[13px]">
                        <span className="truncate">
                          {p.patientId} · {p.name}
                        </span>
                        <b className="text-brand-600">Use</b>
                      </button>
                    ))}
                  </div>
                )}
                {s.patient.name.trim() && similar.length === 0 && (
                  <p className="flex items-center gap-2 rounded-2xl bg-[#f3f7ff] px-3 py-2.5 text-[12.5px] text-brand-800">
                    <Hash size={14} className="shrink-0" />
                    <span>
                      A {s.walkIn ? 'walk-in' : 'referred'} Patient ID like <b>{branchPrefix(branchId)}-{s.walkIn ? 'W' : 'R'}000123</b> is reserved when you continue.
                    </span>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      <Card icon={<UserCheck size={19} />} n={2} title="How they came" hint="Walked in by themselves, or sent by a PR agent.">
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="How the patient came">
          <Choice on={s.walkIn} onClick={() => set((x) => ({ ...x, walkIn: true, agentId: null, hospital: null, referralId: null }))} title="Walk-in" sub="Came by themselves" art={<Sticker name="heart" size={40} />} tone="green" />
          <Choice on={!s.walkIn} onClick={() => set((x) => ({ ...x, walkIn: false }))} title="Referred" sub="Sent by a PR agent" art={<Sticker name="stethoscope" size={40} />} tone="violet" />
        </div>
        {!s.walkIn && (
          <div className="drop-down mt-3.5 space-y-3">
            <div>
              <FieldLabel label="PR agent who referred the patient" required />
              <button type="button" onClick={() => setPickAgent(true)} className={`press flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-[1.5px] px-3 text-left transition-colors ${errs.agent ? 'border-[#e5484d] bg-white ring-4 ring-[#fde3e3]' : agent ? 'border-[#d6c8ff] bg-[#faf7ff]' : 'border-[#dfe6f1] bg-[#f8fafd]'}`}>
                {agent ? <AgentAvatar id={agent.id} name={agent.name} phone={agent.phone} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-tint-purple"><Sticker name="stethoscope" size={24} /></span>}
                <span className="min-w-0 flex-1">
                  <b className={`block truncate text-[14.5px] ${agent ? 'text-ink' : 'text-faint'}`}>{agent ? agent.name : `Choose from ${formatCount(agents.length)} agents`}</b>
                  <span className="block truncate text-[12px] text-muted">{agent ? `${hospitalKey(agent.hospital) || 'No hospital assigned'} · #${agent.id}` : 'Search by name, hospital or phone'}</span>
                </span>
                <ChevronRight size={17} className="text-faint" />
              </button>
              <FieldErr msg={errs.agent} />
            </div>
            <div>
              <FieldLabel label="Referring hospital" optional={!s.hospital} />
              <button type="button" onClick={() => setPickHospital(true)} className="press flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-[#dfe6f1] bg-[#f8fafd] px-4 text-left text-[14.5px] text-ink">
                <span className="truncate">{s.hospital ?? (agent ? `${resolveHospital(null, agent)} (the agent's hospital)` : 'Not specified')}</span>
                <ChevronRight size={17} className="shrink-0 text-faint" />
              </button>
            </div>
            {s.referralId && (
              <p className="flex items-center gap-2 rounded-2xl bg-[#fff8ec] px-3 py-2.5 text-[12.5px] text-[#7a4a00] ring-1 ring-[#f6e5bf]">
                <Hash size={14} className="shrink-0" /> Referral {s.referralId} is attached to this bill.
              </p>
            )}
            {existing && s.patient.existingType === 'WALK_IN' && <p className="rounded-2xl bg-page px-3 py-2 text-[12.5px] text-ink-2">This patient was registered as a walk-in, so their ID stays {s.patient.existingId}. The referral is recorded on this bill.</p>}
          </div>
        )}
        <div className="mt-3.5 flex items-center gap-3 border-t border-dashed border-line pt-3">
          <InitialsAvatar name={user.name} size={32} />
          <span className="min-w-0 flex-1 text-[12.5px] text-muted">
            Processed by <b className="text-ink">{user.name}</b>, {user.role}
          </span>
          <span className="rounded-full bg-page px-2 py-0.5 text-[11px] font-semibold text-muted">Automatic</span>
        </div>
      </Card>
      {pickAgent && <AgentPick value={s.agentId} onClose={() => setPickAgent(false)} onPick={(id) => (set((x) => ({ ...x, agentId: id })), setPickAgent(false))} />}
      {pickHospital && <HospitalPick value={s.hospital} agentHospital={agent ? resolveHospital(null, agent) : null} onClose={() => setPickHospital(false)} onPick={(h) => (set((x) => ({ ...x, hospital: h })), setPickHospital(false))} />}
    </>
  );
}

function AgentPick({ value, onPick, onClose }: { value: number | null; onPick: (id: number) => void; onClose: () => void }) {
  const { agents } = useCompany();
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const list = agents.filter((a) => !t || `${a.name} ${a.hospital} ${a.phone} ${a.id}`.toLowerCase().includes(t)).slice(0, 80);
  return (
    <Sheet title="Who referred the patient?" subtitle={`${formatCount(agents.length)} PR agents`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Name, hospital, phone or ID' }}>
      <ul className="space-y-1.5 px-1 pb-2">
        {list.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onPick(a.id)} className={`press flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${value === a.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-white ring-1 ring-line/70'}`}>
              <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={40} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14.5px] text-ink">{a.name}</b>
                <span className="block truncate text-[12px] text-muted">
                  {hospitalKey(a.hospital) || 'No hospital assigned'}
                  {hasPhone(a.phone) ? ` · ${a.phone}` : ''} · #{a.id}
                </span>
              </span>
              {value === a.id && <Check size={18} className="text-brand-600" />}
            </button>
          </li>
        ))}
        {!list.length && <p className="px-3 py-8 text-center text-[13.5px] text-muted">No PR agent matches “{q}”.</p>}
      </ul>
    </Sheet>
  );
}

function HospitalPick({ value, agentHospital, onPick, onClose }: { value: string | null; agentHospital: string | null; onPick: (h: string | null) => void; onClose: () => void }) {
  const { agents } = useCompany();
  const [q, setQ] = useState('');
  const list = useMemo(() => buildHospitalDirectory(agents).map((h) => h.key), [agents]);
  const t = q.trim().toUpperCase();
  return (
    <Sheet title="Referring hospital" subtitle="Optional" onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Search hospitals' }}>
      <ul className="space-y-1 px-1 pb-2">
        <li>
          <button type="button" onClick={() => onPick(null)} className={`press w-full rounded-2xl px-3.5 py-3 text-left text-[14px] ${!value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink'}`}>
            {agentHospital ? `Use the agent's hospital (${agentHospital})` : 'Not specified'}
          </button>
        </li>
        {list
          .filter((h) => !t || h.includes(t))
          .map((h) => (
            <li key={h}>
              <button type="button" onClick={() => onPick(h)} className={`press w-full rounded-2xl px-3.5 py-3 text-left text-[14px] ${value === h ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink'}`}>
                {h}
              </button>
            </li>
          ))}
      </ul>
    </Sheet>
  );
}

/* ─────────────── 2 Services ─────────────── */

function ServicesStep({ s, set, errs, branchId }: StepProps) {
  const guide = useGuide();
  const { inventory, user } = useCompany();
  const billing = useBilling();
  // The branch's own price list (imported from the company, with its prices and tests).
  const items = useBranchItems(branchId);
  const groups = useMemo(() => groupCategories(items, inventory.categoryNames), [items, inventory.categoryNames]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<Record<number, string>>({});
  const canAdjust = canOverridePrices(user.role);
  const branch = getBranch(branchId)!;
  const money = (n: number) => formatMoney(n, branch.currency);
  const labelOf = (key: string) => groups.find((g) => g.key === key)?.label ?? key;
  const added = new Set(s.services.map((x) => x.id));
  const quick = useMemo(() => {
    const recent = new Map(serviceRanking([branchId], resolveRange({ key: 'custom', from: isoDate(addDays(new Date(), -29)), to: isoDate(new Date()) })).map((r) => [r.id, r.count]));
    const byId = new Map(items.map((i) => [i.id, i]));
    return frequentServices(branchId, recent, 24)
      .map((f) => byId.get(f.id))
      .filter((i): i is NonNullable<typeof i> => !!i && i.price !== null)
      .slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, items, billing.orders]);
  const term = q.trim().toLowerCase();
  const hits = term ? items.filter((i) => term.split(/\s+/).every((w) => `${i.name} ${i.category} ${i.id}`.toLowerCase().includes(w))).slice(0, 60) : [];
  const group = groups.find((g) => g.key === cat) ?? null;
  const toggle = (i: Item) => {
    if (i.price === null) return;
    set((x) => (x.services.some((y) => y.id === i.id) ? { ...x, services: x.services.filter((y) => y.id !== i.id) } : { ...x, services: [...x.services, { id: i.id, name: i.name, category: labelOf(i.category), price: i.price!, overridePrice: null }] }));
  };
  const setOverride = (id: number, raw: string) => {
    const clean = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setPriceDraft((d) => ({ ...d, [id]: clean }));
    if (clean !== '') set((x) => ({ ...x, services: x.services.map((y) => (y.id === id ? { ...y, overridePrice: Number(clean) === y.price ? null : Number(clean) } : y)) }));
  };
  const row = (i: Item, showCat: boolean) => {
    const on = added.has(i.id);
    return (
      <li key={i.id}>
        <div role="button" tabIndex={i.price === null ? -1 : 0} aria-disabled={i.price === null} onClick={() => !(i.price === null) && toggle(i)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !(i.price === null) && (e.preventDefault(), toggle(i))} className={`press flex w-full cursor-pointer items-center gap-3 rounded-2xl p-3 text-left ring-1 aria-disabled:opacity-55 ${on ? 'bg-brand-50 ring-brand-200' : 'bg-white ring-line/70'}`}>
          <span className="min-w-0 flex-1">
            <b className="block text-[14px] leading-snug text-ink">{i.name}</b>
            <span className="block truncate text-[12px] text-muted">{aboutOf(i.name, i.category)}</span>
            <span className="mt-1 flex items-center gap-2">
              <GuideButton label={i.name} onClick={() => guide.open({ id: i.id, name: i.name, category: i.category, label: labelOf(i.category), price: i.price })} />
              <span className="truncate text-[11.5px] text-faint">
                {showCat ? `${labelOf(i.category)} · ` : ''}#{i.id}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <b className={`block text-[14px] ${i.price === null ? 'text-warn-ink' : 'text-ink'}`}>{i.price === null ? 'No price' : money(i.price)}</b>
            <span className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.price === null ? 'bg-page text-muted' : on ? 'bg-brand-600 text-white' : 'bg-page text-brand-700'}`}>
              {i.price === null ? 'Unavailable' : on ? <><Check size={11} /> Added</> : <><Plus size={11} /> Add</>}
            </span>
          </span>
        </div>
      </li>
    );
  };
  return (
    <>
      {quick.length > 0 && (
        <>
          <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Most done here</p>
          <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
            {quick.map((i) => {
              const on = added.has(i.id);
              return (
                <button key={i.id} type="button" onClick={() => toggle(i)} className={`press min-w-[150px] max-w-[180px] shrink-0 rounded-2xl p-3 text-left ring-1 ${on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-line/70'}`}>
                  <span className={`block truncate text-[13.5px] font-semibold ${on ? '' : 'text-ink'}`}>{i.name}</span>
                  <span className={`mt-0.5 flex items-center justify-between text-[12px] ${on ? 'text-white/85' : 'text-muted'}`}>
                    {money(i.price!)} {on ? <Check size={15} /> : <Plus size={15} className="text-brand-600" />}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={group ? `Search ${group.label} or any test` : 'Search any test or category'} aria-label="Search services" className="min-h-12 w-full rounded-full bg-white pl-11 pr-11 text-[15px] text-ink shadow-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-brand-500" />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted">
            <X size={18} />
          </button>
        )}
      </div>
      {term ? (
        <>
          <p className="mb-2 px-1 text-[12.5px] text-muted">{hits.length >= 60 ? '60+' : hits.length} tests match “{q.trim()}”</p>
          {hits.length ? <ul className="mb-3 space-y-1.5">{hits.map((i) => row(i, true))}</ul> : <p className="mb-3 rounded-2xl bg-white p-4 text-center text-[13.5px] text-muted">No test matches “{q.trim()}”.</p>}
        </>
      ) : group ? (
        <>
          <button type="button" onClick={() => setCat(null)} className="press mb-2 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-600 ring-1 ring-line">
            <ArrowLeft size={15} /> All categories
          </button>
          <p className="mb-2 px-1 text-[13px] text-ink-2">
            <b className="text-ink">{group.label}</b> · {group.items.length} tests · {group.items.filter((i) => added.has(i.id)).length} added
          </p>
          <ul className="mb-3 space-y-1.5">{[...group.items].sort((a, b) => a.name.localeCompare(b.name)).map((i) => row(i, false))}</ul>
        </>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {groups.map((g) => {
            const m = meta(g.key);
            const n = g.items.filter((i) => added.has(i.id)).length;
            return (
              <button key={g.key} type="button" onClick={() => setCat(g.key)} className={`press relative flex min-h-[96px] flex-col items-start rounded-[18px] bg-linear-to-br p-3 text-left ring-1 ${m.tint} ${n ? 'ring-brand-500' : 'ring-white'}`}>
                <Sticker name={m.sticker} size={32} />
                <b className="mt-1 w-full truncate text-[14px] text-ink">{g.label}</b>
                <span className="text-[11.5px] text-ink-2">{g.items.length} test{g.items.length === 1 ? '' : 's'}</span>
                {n > 0 && <span className="absolute right-2 top-2 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10.5px] font-bold text-white">{n} added</span>}
              </button>
            );
          })}
        </div>
      )}

      {guide.sheet}
      <Card icon={<FlaskConical size={19} />} title={`Selected tests · ${s.services.length}`} hint={canAdjust ? 'Catalogue prices apply. You can change a price for this bill only.' : 'Catalogue prices apply.'}>
        {s.services.length === 0 ? (
          <>
            <p className="rounded-2xl bg-page p-3 text-center text-[13.5px] text-muted">No tests selected yet. Tap a test above to add it.</p>
            <FieldErr msg={errs.services} />
          </>
        ) : (
          <ul className="space-y-2">
            {s.services.map((x) => (
              <li key={x.id} className={`drop-down rounded-2xl p-3 ring-1 ${x.overridePrice !== null ? 'bg-[#fff7ec] ring-[#ffe0b8]' : 'bg-[#f8fafd] ring-[#e3eaf4]'}`}>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14px] leading-snug text-ink">{x.name}</b>
                    <span className="block text-[12px] text-muted">
                      {x.category} · #{x.id}
                    </span>
                  </span>
                  <button type="button" onClick={() => set((y) => ({ ...y, services: y.services.filter((z) => z.id !== x.id) }))} aria-label={`Remove ${x.name}`} className="press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#b42318] shadow-sm">
                    <Minus size={16} />
                  </button>
                </div>
                {canAdjust ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[12px] text-muted">Price for this bill</span>
                    <input inputMode="numeric" value={priceDraft[x.id] ?? String(x.overridePrice ?? x.price)} onChange={(e) => setOverride(x.id, e.target.value)} onBlur={() => setPriceDraft((d) => ({ ...d, [x.id]: undefined as unknown as string }))} aria-label={`Price for ${x.name}`} className="min-h-10 w-32 rounded-xl border-[1.5px] border-[#dfe6f1] bg-white px-3 text-right text-[14.5px] font-bold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                    {x.overridePrice !== null && <span className="text-[11.5px] text-[#9a4a07]">was {money(x.price)}</span>}
                  </div>
                ) : (
                  <p className="mt-1 text-right text-[14.5px] font-bold text-ink">{money(x.price)}</p>
                )}
                <FieldErr msg={errs[`price-${x.id}`]} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-end justify-between border-t border-dashed border-line pt-3">
          <span className="text-[13.5px] text-ink-2">Subtotal</span>
          <b className="text-[20px] tracking-[-0.01em] text-ink">{money(computeBill(s).subtotal)}</b>
        </p>
      </Card>
    </>
  );
}

/* ─────────────── 3 Payment ─────────────── */

function PaymentStep({ s, set, errs, branchId }: StepProps) {
  const { user, staff } = useCompany();
  const cfg = useConfig();
  const branch = getBranch(branchId)!;
  const money = (n: number) => formatMoney(n, branch.currency);
  const t = computeBill(s);
  const p = s.payment;
  const offered = enabledMethods(branchId);
  const canSplit = cfg.payments.split && offered.length >= 2;
  // Discounts (owner, 2026-11-25): anyone billing may add one when discounts are on; the branch manager approves every discount.
  const canDisc = cfg.discounts.enabled;
  const discountBy = useMemo(() => discountApprovers(staff, branchId, user), [staff, branchId, user]);
  const approvers = useMemo(() => balanceApprovers(staff, branchId, user), [staff, branchId, user]);
  const setPay = (patch: Partial<typeof p>) => set((x) => ({ ...x, payment: { ...x.payment, ...patch } }));
  const balanceLeft = t.total > 0 && t.amountPaid < t.total && (p.method === 'Split' ? t.amountPaid > 0 : p.status !== 'full');
  const methods: PayChoice[] = [...offered, ...(canSplit ? (['Split'] as PayChoice[]) : [])];
  const todayIso = isoDate(new Date());
  const [discOpen, setDiscOpen] = useState(false);
  return (
    <>
      <div className="relative mb-3.5 overflow-hidden rounded-[24px] bg-linear-to-br from-[#0f2f7a] via-[#1f6fe8] to-[#5ea6f7] p-5 text-white shadow-[0_16px_34px_-12px_rgba(31,99,214,0.55)]">
        <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <Sticker name="moneyBag" size={64} className="absolute right-3 top-3" />
        <p className="text-[12.5px] text-white/85">Total to pay</p>
        <p className="text-[32px] font-bold leading-none">{money(t.total)}</p>
        <p className="mt-2 text-[12.5px] text-white/90">
          {money(t.subtotal)} for {s.services.length} test{s.services.length === 1 ? '' : 's'}
          {t.discount > 0 ? ` · minus ${money(t.discount)} discount` : ''}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
            <span className="block text-[11px] text-white/80">Paid now</span>
            <b className="block text-[16px]">{money(t.amountPaid)}</b>
          </span>
          <span className={`rounded-2xl px-3 py-2 ring-1 ${t.balance > 0 ? 'bg-[#ff6b6b]/25 ring-[#ffb4b4]/40' : 'bg-[#34d07f]/25 ring-[#9cf0c4]/40'}`}>
            <span className="block text-[11px] text-white/80">Balance</span>
            <b className="block text-[16px]">{money(t.balance)}</b>
          </span>
        </div>
      </div>

      <Card icon={<CreditCard size={19} />} n={1} title="Payment method">
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Payment method">
          {methods.map((m) => {
            const on = p.method === m;
            const Icon = METHOD_ICON[m] ?? CreditCard;
            return (
              <button key={m} type="button" role="radio" aria-checked={on} onClick={() => setPay({ method: m })} className={`press relative flex items-center gap-2.5 rounded-[18px] p-3 text-left transition-all ${on ? 'bg-brand-50 ring-2 ring-brand-500 shadow-[0_8px_20px_-10px_rgba(31,111,232,0.5)]' : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${on ? 'bg-brand-600 text-white' : 'bg-white text-brand-600 ring-1 ring-[#e3eaf4]'}`}>
                  <Icon size={19} />
                </span>
                <span className="min-w-0">
                  <b className="block text-[14px] text-ink">{methodLabel(m)}</b>
                  <span className="block truncate text-[11.5px] text-muted">{METHOD_SUB[m] ?? ''}</span>
                </span>
              </button>
            );
          })}
        </div>
        <FieldErr msg={errs.method} />
        {p.method !== 'Split' ? (
          <>
            <p className="mb-2 mt-4 text-[14px] font-semibold text-ink">How much was paid?</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment status">
              {(
                [
                  ['full', 'Fully paid', CircleCheck, 'text-good'],
                  ['part', 'Part paid', PieChart, 'text-[#d97706]'],
                  ['unpaid', 'Not paid', Clock3, 'text-[#d93036]'],
                ] as const
              ).map(([k, l, Icon, tone]) => (
                <button key={k} type="button" role="radio" aria-checked={p.status === k} onClick={() => setPay({ status: k })} className={`press flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-[16px] text-[12.5px] font-semibold transition-all ${p.status === k ? 'bg-white text-ink ring-2 ring-brand-500 shadow-[0_8px_18px_-10px_rgba(31,111,232,0.5)]' : 'bg-[#f8fafd] text-ink-2 ring-1 ring-[#e3eaf4]'}`}>
                  <Icon size={20} className={tone} />
                  {l}
                </button>
              ))}
            </div>
            {p.status === 'part' && (
              <label className="mt-3 block">
                <FieldLabel label="Amount received now" required />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted">₦</span>
                  <input inputMode="numeric" value={showNum(p.partAmount)} onChange={(e) => setPay({ partAmount: digitsNum(e.target.value) })} placeholder="0" className={`${inputCls(errs.partAmount)} pl-9 text-[17px] font-bold`} />
                </div>
                <FieldErr msg={errs.partAmount} />
              </label>
            )}
          </>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-[14px] font-semibold text-ink">Amount by method</p>
            {offered.map((m: PaymentMethod) => (
              <label key={m} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[14px] text-ink-2">{methodLabel(m)}</span>
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted">₦</span>
                  <input inputMode="numeric" value={showNum(p.split[m])} onChange={(e) => setPay({ split: { ...p.split, [m]: digitsNum(e.target.value) } })} placeholder="0" className={`${inputCls(errs.split)} pl-9 font-bold`} />
                </div>
              </label>
            ))}
            <p className={`text-[12.5px] ${t.amountPaid > t.total ? 'font-semibold text-[#b42318]' : 'text-muted'}`}>
              Adds up to {money(t.amountPaid)} of {money(t.total)}
            </p>
            <FieldErr msg={errs.split} />
          </div>
        )}
      </Card>

      {balanceLeft && (
        <section className="drop-down mb-3 rounded-[22px] bg-linear-to-br from-[#fff7ec] to-[#ffeccf] p-4 ring-1 ring-[#ffe0b8]">
          <p className="text-[15px] font-bold text-[#7a3d06]">{t.amountPaid > 0 ? `Balance of ${money(t.balance)} left` : 'Nothing paid yet'}</p>
          <p className="mb-3 text-[12.5px] text-[#9a4a07]">A balance needs a reason and who approved it. Admins see this when they review outstanding bills.</p>
          <div className="space-y-3">
            <LongText label={t.amountPaid > 0 ? 'Reason for the part payment' : 'Reason nothing was paid'} required value={p.balanceReason} onChange={(v) => setPay({ balanceReason: v })} max={300} minRows={2} placeholder={t.amountPaid > 0 ? 'For example: will pay the balance on result collection' : 'For example: emergency case, family bringing payment'} error={errs.balanceReason} />
            <div>
              <FieldLabel label="Approved by" required />
              <div className="space-y-1.5">
                {approvers.map((a) => (
                  <button key={a.value} type="button" aria-pressed={p.approvedBy === a.value} onClick={() => setPay({ approvedBy: a.value })} className={`press flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ring-1 ${p.approvedBy === a.value ? 'bg-white ring-brand-500' : 'bg-white/70 ring-white'}`}>
                    <InitialsAvatar name={a.label} size={34} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] text-ink">{a.label}</b>
                      <span className="block truncate text-[12px] text-muted">{a.description}</span>
                    </span>
                    {p.approvedBy === a.value && <Check size={18} className="text-brand-600" />}
                  </button>
                ))}
              </div>
              <FieldErr msg={errs.approvedBy} />
            </div>
            <label className="block">
              <FieldLabel label="Date the patient promised to pay" optional />
              <input type="date" value={p.promiseDate} min={todayIso} onChange={(e) => setPay({ promiseDate: e.target.value })} className={inputCls(errs.promiseDate)} />
              <FieldErr msg={errs.promiseDate} />
            </label>
          </div>
        </section>
      )}

      {canDisc &&
        (discOpen || s.discount.amount > 0 ? (
          <Card icon={<Sticker name="gift" size={24} />} n={2} title="Discount" hint={`Optional. Up to ${money(maxDiscount(t.subtotal))}${cfg.discounts.maxPercent < 100 ? ` (${cfg.discounts.maxPercent}% of the bill)` : ''}. Every discount needs a reason and the branch manager's approval.`}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted">₦</span>
              <input inputMode="numeric" value={showNum(s.discount.amount)} onChange={(e) => set((x) => ({ ...x, discount: { ...x.discount, amount: digitsNum(e.target.value) } }))} placeholder="0" aria-label="Discount amount" className={`${inputCls(errs.discount)} pl-9 font-bold`} />
            </div>
            <FieldErr msg={errs.discount} />
            {s.discount.amount > 0 && (
              <div className="mt-3">
                <LongText label="Reason for the discount" required value={s.discount.reason} onChange={(v) => set((x) => ({ ...x, discount: { ...x.discount, reason: v } }))} max={200} minRows={2} placeholder="For example: the PR agent asked for 3,000 off, the patient is short of money" error={errs.discountReason} />
              </div>
            )}
            {s.discount.amount > 0 && (
              <div className="mt-3">
                <FieldLabel label="Approved by" required />
                <div className="space-y-1.5" role="radiogroup" aria-label="Discount approved by">
                  {discountBy.map((a) => {
                    const on = s.discount.approvedBy === a.value;
                    return (
                      <button key={a.value} type="button" role="radio" aria-checked={on} onClick={() => set((x) => ({ ...x, discount: { ...x.discount, approvedBy: a.value } }))} className={`press flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${on ? 'bg-[#faf7ff] ring-2 ring-violet' : 'bg-[#f8fafd] ring-1 ring-[#e3eaf4]'}`}>
                        <InitialsAvatar name={a.label} size={36} />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-[14px] text-ink">{a.label}</b>
                          <span className="block truncate text-[12px] text-muted">{a.description}</span>
                        </span>
                        <span className={`grid h-5 w-5 place-items-center rounded-full ${on ? 'bg-violet text-white' : 'ring-2 ring-[#d3dce9]'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                      </button>
                    );
                  })}
                </div>
                <FieldErr msg={errs.discountApprovedBy} />
                {!errs.discountApprovedBy && <span className="mt-1 block text-[12px] text-muted">Every discount is approved by the branch manager. Their name is on the bill and the receipt.</span>}
              </div>
            )}
            {s.discount.amount === 0 && (
              <button type="button" onClick={() => setDiscOpen(false)} className="press mt-2 text-[13px] font-semibold text-muted">
                No discount
              </button>
            )}
          </Card>
        ) : (
          <button type="button" onClick={() => setDiscOpen(true)} className="press mb-3.5 flex w-full items-center gap-3 rounded-[22px] border border-dashed border-[#d6c3ff] bg-[#faf7ff] p-3.5 text-left">
            <Sticker name="gift" size={36} />
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] text-ink">Add a discount</b>
              <span className="block text-[12.5px] text-muted">Optional, up to {money(maxDiscount(t.subtotal))}, with a reason</span>
            </span>
            <Plus size={19} className="text-violet" />
          </button>
        ))}
    </>
  );
}

/* ─────────────── 4 Preview ─────────────── */

function PreviewStep({ s, branchId, onEdit }: { s: BillingSession; branchId: string; onEdit: (step: 1 | 2 | 3) => void }) {
  const { agents, user } = useCompany();
  const branch = getBranch(branchId)!;
  const money = (n: number) => formatMoney(n, branch.currency);
  const t = computeBill(s);
  const agent = s.agentId !== null ? agents.find((a) => a.id === s.agentId) : undefined;
  const approver = s.payment.approvedBy ? s.payment.approvedBy.split('|') : null;
  const Part = ({ title, step, children }: { title: string; step: 1 | 2 | 3; children: ReactNode }) => (
    <section className="border-t border-dashed border-[#d9e1ec] px-4 py-3.5 first:border-t-0">
      <div className="mb-1.5 flex items-center justify-between">
        <b className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{title}</b>
        <button type="button" onClick={() => onEdit(step)} className="press flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700">
          <Pencil size={12} /> Edit
        </button>
      </div>
      {children}
    </section>
  );
  const Row = ({ l, v, tone }: { l: string; v: ReactNode; tone?: string }) => (
    <p className="flex justify-between gap-3 py-1 text-[13.5px]">
      <span className="text-muted">{l}</span>
      <b className={`text-right ${tone ?? 'text-ink'}`}>{v}</b>
    </p>
  );
  return (
    <>
      <div className="relative mb-3 overflow-hidden rounded-[24px] bg-white shadow-[0_16px_40px_-16px_rgba(30,74,160,0.35)] ring-1 ring-[#e6edf7]">
        <div className="bg-linear-to-br from-[#0f2f7a] via-[#1f6fe8] to-[#5ea6f7] px-4 pb-4 pt-3.5 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/75">{branch.name} branch · bill preview</p>
          <p className="mt-1 text-[30px] font-extrabold leading-none tracking-[-0.02em]">{money(t.total)}</p>
          <p className="mt-1.5 text-[12.5px] text-white/85">
            {s.patient.name} · {s.services.length} test{s.services.length === 1 ? '' : 's'} · {t.balance > 0 ? `${money(t.balance)} to be paid later` : 'paid in full'}
          </p>
        </div>
      <Part title="Patient" step={1}>
        <Row l="Name" v={s.patient.name} />
        <Row l="Patient ID" v={s.patient.existingId ?? s.reservedId ?? 'Reserved on save'} />
        <Row l="Phone" v={s.patient.phone || 'Not provided'} />
        <Row l="Came as" v={s.walkIn ? 'Walk-in' : 'Referred'} />
        {!s.walkIn && <Row l="PR agent" v={agent?.name ?? 'Not chosen'} />}
        {!s.walkIn && <Row l="Hospital" v={resolveHospital(s.hospital, agent)} />}
        <Row l="Processed by" v={`${user.name}, ${user.role}`} />
      </Part>
      <Part title={`Tests · ${s.services.length}`} step={2}>
        {s.services.map((x) => (
          <Row key={x.id} l={x.name} v={<>{money(x.overridePrice ?? x.price)}{x.overridePrice !== null && <span className="block text-[11px] font-normal text-[#9a4a07]">was {money(x.price)}</span>}</>} />
        ))}
      </Part>
      <Part title="Payment" step={3}>
        <Row l="Subtotal" v={money(t.subtotal)} />
        {t.discount > 0 && <Row l={`Discount (${s.discount.reason})`} v={`minus ${money(t.discount)}`} />}
        {t.discount > 0 && <Row l="Discount approved by" v={s.discount.approvedBy ? s.discount.approvedBy.replace('|', ', ') : 'Not chosen'} tone={s.discount.approvedBy ? undefined : 'text-[#b42318]'} />}
        <Row l="Total" v={money(t.total)} />
        <Row l="Method" v={methodLabel(s.payment.method)} />
        {t.split.map((x) => (
          <Row key={x.method} l={`· ${methodLabel(x.method)}`} v={money(x.amount)} />
        ))}
        <Row l="Paid now" v={money(t.amountPaid)} tone="text-good-ink" />
        {t.balance > 0 && (
          <>
            <Row l="Balance" v={money(t.balance)} tone="text-[#b42318]" />
            <Row l="Reason" v={s.payment.balanceReason} />
            <Row l="Approved by" v={approver ? `${approver[0]}, ${approver[1]}` : 'Not chosen'} />
            <Row l="Promised date" v={s.payment.promiseDate ? new Date(`${s.payment.promiseDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Not given'} />
          </>
        )}
      </Part>
        <div aria-hidden="true" className="h-3 bg-[radial-gradient(circle_at_8px_12px,#f4f8fe_7px,transparent_7.5px)] bg-[length:16px_12px] bg-repeat-x" />
      </div>
      <p className="mb-2 flex items-start gap-2 px-1 text-[12.5px] text-muted">
        <Info size={14} className="mt-0.5 shrink-0" /> The bill and receipt are saved only when you tap Complete billing.
      </p>
    </>
  );
}

/* ─────────────── referral ID ─────────────── */

function ReferralSheet({ branchId, incoming, onIncoming, onClose, onFound }: { branchId: string; incoming: Incoming[]; onIncoming: (r: Incoming) => void; onClose: () => void; onFound: (m: NonNullable<ReturnType<typeof lookupReferral>>, referralId: string) => void }) {
  const prefix = `${branchPrefix(branchId)}-R`;
  const [num, setNum] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const find = () => {
    const full = `${prefix}${num.padStart(6, '0')}`;
    // A referral sent by a PR agent (the incoming folder) first, then a referred patient already on record.
    const inc = findIncoming(incoming, full);
    if (inc) return onIncoming(inc);
    const m = lookupReferral(branchId, full);
    if (!m) return setErr(`No referred patient with the ID ${full} at this branch. Check the number, or start a new patient bill.`);
    onFound(m, full);
  };
  return (
    <Sheet title="Enter referral ID" subtitle="Find a referred patient and continue to their tests" onClose={onClose} footer={<button type="button" disabled={!num} onClick={find} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">Find patient</button>}>
      <div className="px-1 pb-2">
        <FieldLabel label="Referral ID" required />
        <div className="flex items-center gap-2">
          <span className="grid min-h-12 place-items-center rounded-2xl bg-page px-3.5 font-mono text-[15px] font-bold text-ink-2">{prefix}</span>
          <input inputMode="numeric" value={num} onChange={(e) => (setNum(e.target.value.replace(/\D/g, '').slice(0, 6)), setErr(null))} placeholder="000123" autoFocus className={`${inputCls(err)} font-mono text-[17px] font-bold tracking-wider`} />
        </div>
        <FieldErr msg={err} />
        <p className="mt-2 text-[12.5px] text-muted">The number on the patient's referral slip or message from the PR agent. It finds referrals in the incoming folder and referred patients already on record.</p>
      </div>
    </Sheet>
  );
}
