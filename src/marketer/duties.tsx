/**
 * The marketer's duties (owner, 2026-11-27): this month's tasks and bonus as
 * set by the Branch Manager or Company Admin, what needs them now (cautions to
 * answer, hospitals they are asked to release or offered, the handover of a
 * hospital they received: get to know its PR agents), offering a hospital to
 * a colleague, and the rules of engagement (read and agree on first sign-in,
 * again when the rules change; always in Settings and the menu).
 */
import { useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronRight, FileText, Gift, Handshake, Hospital, Lock, Send, ShieldAlert, Target } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { CAUTION_REASONS, STAGE_LABEL, answerTransfer, ackRules, bonusEstimate, bonusFor, hasAgreed, hospitalStatuses, offerTransfer, policyOf, replyCaution, rulesText, rulesVersion, setTaskDone, taskDoneAt, tasksFor, type Caution, type HospitalStatus, type Transfer } from '@company/services/marketing';
import { useNav } from '@/app/store';
import { Sheet } from '@/admin/ui';
import { LongText } from '@/admin/fields';
import { FieldLabel, inputCls } from '@/admin/prManage';
import { SectionTitle } from '@/admin/kit';
import { Sticker } from '@/ui/kit';
import { plural, stamp, type Mine } from './data';
import { Card, GrowBar, useMk } from './ui';

/** Hospital states for the marketer's own view. */
export function useMyStatuses(m: Mine) {
  return useMemo(() => hospitalStatuses(m.st, m.branchId, m.hospitals, m.agents), [m.st, m.branchId, m.hospitals, m.agents]);
}

/* ─────────────── tasks and bonus ─────────────── */

export function TasksCard() {
  const { m, me } = useMk();
  const p = m.my;
  if (!p) return null;
  const t = tasksFor(m.st, m.branchId, me.id);
  const rows = [
    { l: 'Money target', now: p.revenue, of: p.target, text: `${m.money(p.revenue)} of ${m.money(p.target)}` },
    { l: 'New partner hospitals', now: p.sourcedHospitals, of: t.newHospitals, text: `${p.sourcedHospitals} of ${t.newHospitals}` },
    { l: 'New PR agents with a first patient', now: p.firstPatientAgents, of: t.newAgents, text: `${p.firstPatientAgents} of ${t.newAgents}` },
    { l: 'Follow-ups this week', now: p.weekFollowUps, of: t.followUpsPerWeek, text: `${p.weekFollowUps} of ${t.followUpsPerWeek}` },
  ].filter((r) => r.of > 0);
  const done = rows.filter((r) => r.now >= r.of).length + t.custom.filter((c) => taskDoneAt(m.st, m.branchId, m.ym, me.id, c.id)).length;
  return (
    <>
      <SectionTitle title="Your tasks this month" />
      <Card>
        <p className="mb-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>Set by your manager</span>
          <b className="text-ink-2">
            {done} of {rows.length + t.custom.length} done
          </b>
        </p>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.l}>
              <div className="mb-1 flex justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  {r.now >= r.of ? <CheckCircle2 size={15} className="text-good" /> : <Target size={15} className="text-brand-600" />} {r.l}
                </span>
                <b className="shrink-0 text-ink-2">{r.text}</b>
              </div>
              <GrowBar pct={r.of ? r.now / r.of : 0} className="h-2 bg-page" />
            </div>
          ))}
          {t.custom.map((c) => (
            <CustomTaskRow key={c.id} id={c.id} title={c.title} due={c.due} />
          ))}
        </div>
      </Card>
    </>
  );
}

function CustomTaskRow({ id, title, due }: { id: string; title: string; due?: string }) {
  const { m, me } = useMk();
  const done = !!taskDoneAt(m.st, m.branchId, m.ym, me.id, id);
  return (
    <button type="button" onClick={() => setTaskDone(m.branchId, m.ym, me.id, id, !done)} className="press flex w-full items-center gap-3 rounded-2xl bg-page px-3 py-2.5 text-left">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${done ? 'bg-[#22a06b] text-white' : 'bg-white ring-2 ring-line'}`}>{done && <Check size={15} />}</span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[13.5px] ${done ? 'text-muted line-through' : 'text-ink'}`}>{title}</b>
        {due && <span className="text-[11.5px] text-muted">By {new Date(`${due}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
      </span>
    </button>
  );
}

export function BonusCard() {
  const { m, me } = useMk();
  const p = m.my;
  const plan = bonusFor(m.st, m.branchId, me.id);
  if (!p || !plan || (plan.kind === 'none' && !plan.perHospital && !plan.perAgent && !plan.note)) return null;
  const est = bonusEstimate(plan, p);
  const what = plan.kind === 'fixed' ? `${m.money(plan.amount)} when you reach ${plan.minPct}% of your target` : plan.kind === 'percentOver' ? `${plan.pct}% of everything above your target` : plan.kind === 'percentAll' ? `${plan.pct}% of what your hospitals generate, once you reach ${plan.minPct}%` : 'Set by your manager';
  return (
    <div className="relative mt-3 overflow-hidden rounded-[24px] bg-linear-to-br from-[#0f7a43] via-[#16a35a] to-[#4cc98a] p-4 text-white shadow-[0_14px_30px_rgba(22,163,74,0.28)]">
      <span aria-hidden="true" className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
      <Sticker name="gift" size={64} className="absolute -bottom-1 -right-1" />
      <p className="relative flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/80">
        <Gift size={14} /> Your bonus
      </p>
      <p className="relative mt-1 w-[78%] text-[15px] font-semibold leading-snug">{what}</p>
      <div className="relative mt-3 flex w-[78%] gap-2">
        <span className="flex-1 rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
          <span className="block text-[10.5px] text-white/80">{est.qualifies ? 'Earned so far' : 'At your target'}</span>
          <b className="block text-[17px]">{m.money(est.qualifies ? est.now : est.atTarget)}</b>
        </span>
        {(plan.perHospital > 0 || plan.perAgent > 0) && (
          <span className="flex-1 rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
            <span className="block text-[10.5px] text-white/80">Extras</span>
            <b className="block text-[13px] leading-tight">
              {plan.perHospital ? `${m.money(plan.perHospital)}/hospital` : ''}
              {plan.perHospital && plan.perAgent ? ' · ' : ''}
              {plan.perAgent ? `${m.money(plan.perAgent)}/agent` : ''}
            </b>
          </span>
        )}
      </div>
      {plan.note && <p className="relative mt-2 w-[78%] text-[12px] text-white/90">Also: {plan.note}</p>}
    </div>
  );
}

/* ─────────────── what needs them now ─────────────── */

export function useMyActions() {
  const { m, me } = useMk();
  const statuses = useMyStatuses(m);
  const cautions = m.st.cautions.filter((c) => c.branchId === m.branchId && c.marketerId === me.id && !c.reply);
  const asked = m.st.transfers.filter((t) => t.branchId === m.branchId && ((t.stage === 'owner' && t.from === me.id) || (t.stage === 'receiver' && t.to === me.id)));
  const handovers = [...statuses.values()].filter((s) => s.owner === me.id && s.handoverUntil && s.handoverFrom);
  return { cautions, asked, handovers, statuses };
}

export function ActionItems() {
  const { m } = useMk();
  const { cautions, asked, handovers } = useMyActions();
  const [caution, setCaution] = useState<Caution | null>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  if (!cautions.length && !asked.length && !handovers.length) return null;
  return (
    <>
      <SectionTitle title="Needs you" />
      <div className="space-y-2">
        {cautions.map((c) => (
          <button key={c.id} type="button" onClick={() => setCaution(c)} className="press flex w-full items-center gap-3 rounded-[20px] bg-[#fff6f6] p-3.5 text-left ring-1 ring-[#f6caca]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ffe4e4] text-[#b42318]">
              <ShieldAlert size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] text-ink">Caution: {c.hospital} is dormant</b>
              <span className="block text-[12px] text-muted">
                From {c.by} · answer within {policyOf(m.st, m.branchId).replyDays} days
              </span>
            </span>
            <ChevronRight size={16} className="text-faint" />
          </button>
        ))}
        {asked.map((t) => (
          <button key={t.id} type="button" onClick={() => setTransfer(t)} className="press flex w-full items-center gap-3 rounded-[20px] bg-[#f5f3ff] p-3.5 text-left ring-1 ring-[#ddd6fe]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-violet">
              <Handshake size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[14.5px] text-ink">{t.stage === 'owner' ? `Release ${t.hospital}?` : `${t.hospital} offered to you`}</b>
              <span className="block text-[12px] text-muted">{t.stage === 'owner' ? `Your manager asks you to pass it to a colleague` : `From a colleague · then your manager approves`}</span>
            </span>
            <ChevronRight size={16} className="text-faint" />
          </button>
        ))}
        {handovers.map((s) => (
          <HandoverCard key={s.key} s={s} />
        ))}
      </div>
      {caution && <CautionReplySheet c={caution} onClose={() => setCaution(null)} />}
      {transfer && <TransferAnswerSheet t={transfer} onClose={() => setTransfer(null)} />}
    </>
  );
}

/** A hospital they received: get to know every PR agent there. */
function HandoverCard({ s }: { s: HospitalStatus }) {
  const { m, me, openHospital } = useMk();
  const h = m.mine.find((x) => x.key === s.key);
  const since = m.st.ownerHistory.filter((x) => x.branchId === m.branchId && x.hospital === s.key && x.to === me.id).sort((a, b) => b.at.localeCompare(a.at))[0]?.at ?? '';
  const met = new Set(m.checkUps.filter((c) => c.by.name === me.name && c.at >= since && h?.agentIds.includes(c.agentId)).map((c) => c.agentId)).size;
  const total = h?.agentIds.length ?? 0;
  return (
    <button type="button" onClick={() => h && openHospital(h)} className="press w-full rounded-[20px] bg-white p-3.5 text-left ring-1 ring-brand-200">
      <span className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Hospital size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] text-ink">Handover: get to know {s.key}</b>
          <span className="block text-[12px] text-muted">
            Contact every PR agent there by {new Date(`${s.handoverUntil}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </span>
        <b className="text-[14px] text-brand-700">
          {met}/{total}
        </b>
      </span>
      <GrowBar pct={total ? met / total : 0} className="mt-2.5 h-2 bg-page" />
    </button>
  );
}

function CautionReplySheet({ c, onClose }: { c: Caution; onClose: () => void }) {
  const { me, m } = useMk();
  const { showToast } = useNav();
  const [reason, setReason] = useState<string>(CAUTION_REASONS[0]);
  const [plan, setPlan] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  return (
    <Sheet
      back
      tall
      title={`Caution: ${c.hospital}`}
      subtitle={`From ${c.by} · ${stamp(c.at)}`}
      onClose={onClose}
      footer={
        <button type="button" disabled={plan.trim().length < 10} onClick={() => (replyCaution(c.id, { reason, plan, date }, me.name), showToast('Answer sent to your manager'), onClose())} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
          <Send size={17} /> Send answer
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <p className="rounded-2xl bg-[#fff6f6] p-3 text-[13.5px] leading-snug text-ink ring-1 ring-[#f6caca]">{c.message}</p>
        <div>
          <FieldLabel label="Why it is dormant" />
          <div className="space-y-1.5">
            {CAUTION_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`press flex min-h-11 w-full items-center rounded-2xl px-3 text-left text-[14px] font-semibold ring-1 ${reason === r ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white text-ink-2 ring-line'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <LongText label="Your plan to revive it" required value={plan} onChange={setPlan} max={600} placeholder="Who you will meet, what you will do, new PR agents you will bring in" />
        <label className="block">
          <FieldLabel label="By when" />
          <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className={inputCls()} />
        </label>
        <p className="text-[12px] text-muted">If it is still dormant {policyOf(m.st, c.branchId).snoozeDays} days after your answer, it is flagged again and may move to a colleague.</p>
      </div>
    </Sheet>
  );
}

function TransferAnswerSheet({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const { me } = useMk();
  const { staff } = useCompany();
  const { showToast } = useNav();
  const [note, setNote] = useState('');
  const name = (id: string | null) => staff.find((s) => s.id === id)?.name ?? 'a colleague';
  const isOwner = t.stage === 'owner';
  return (
    <Sheet back title={isOwner ? `Release ${t.hospital}?` : `${t.hospital} offered to you`} subtitle={isOwner ? `To ${name(t.to)}` : `From ${name(t.from)}`} onClose={onClose}>
      <div className="space-y-3 px-1 pb-2">
        <p className="rounded-2xl bg-page p-3 text-[13.5px] text-ink-2">
          <b className="text-ink">Reason:</b> {t.reason}
        </p>
        <p className="text-[12.5px] text-muted">{isOwner ? 'If you agree, the hospital and its PR agents move now. Patients it sent before stay credited to you.' : 'If you accept, your manager approves it, then the hospital and its PR agents become yours, with a handover to get to know them.'}</p>
        <LongText label={isOwner ? 'Your answer' : 'Note'} optional value={note} onChange={setNote} max={300} minRows={2} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => (answerTransfer(t.id, false, me.name, note), showToast('Declined'), onClose())} className="press min-h-12 rounded-2xl bg-page text-[14.5px] font-semibold text-ink-2">
            Decline
          </button>
          <button type="button" onClick={() => (answerTransfer(t.id, true, me.name, note), showToast(isOwner ? `${t.hospital} released` : 'Accepted: waiting for your manager'), onClose())} className="press min-h-12 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white">
            {isOwner ? 'Agree' : 'Accept'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ─────────────── offering a hospital ─────────────── */

export function OfferSheet({ hospital, onClose }: { hospital: string; onClose: () => void }) {
  const { m, me } = useMk();
  const { showToast } = useNav();
  const [to, setTo] = useState('');
  const [why, setWhy] = useState('');
  const pending = m.st.transfers.find((t) => t.hospital === hospital && t.branchId === m.branchId && ['owner', 'receiver', 'manager'].includes(t.stage));
  return (
    <Sheet
      back
      title={`Offer ${hospital} to a colleague`}
      subtitle="They accept, then your manager approves"
      onClose={onClose}
      footer={
        !pending ? (
          <button type="button" disabled={!to || why.trim().length < 5} onClick={() => (offerTransfer(m.branchId, hospital, me.id, to, why, me.name), showToast('Offer sent'), onClose())} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40">
            <ArrowRight size={17} /> Send offer
          </button>
        ) : undefined
      }
    >
      {pending ? (
        <p className="px-1 pb-3 text-[13.5px] text-muted">Already waiting: {STAGE_LABEL[pending.stage]}.</p>
      ) : (
        <div className="space-y-2 px-1 pb-2">
          {m.marketers
            .filter((x) => x.id !== me.id && x.status === 'Active')
            .map((x) => (
              <button key={x.id} type="button" aria-pressed={to === x.id} onClick={() => setTo(x.id)} className={`press flex min-h-12 w-full items-center rounded-2xl px-3 text-left text-[14.5px] font-semibold ring-1 ${to === x.id ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-white text-ink ring-line'}`}>
                {x.name}
              </button>
            ))}
          <LongText label="Why" required value={why} onChange={setWhy} max={300} minRows={2} placeholder="For example: it is closer to their area" />
          <p className="text-[12px] text-muted">Patients it sent while it was yours stay credited to you.</p>
        </div>
      )}
    </Sheet>
  );
}

export function LockNote() {
  return (
    <p className="mt-2 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800">
      <Lock size={14} /> One of your top hospitals: protected while your account is active.
    </p>
  );
}

/* ─────────────── rules of engagement ─────────────── */

function RulesBody() {
  const { m } = useMk();
  const sections = rulesText(m.st, m.branchId);
  const notes = m.st.rules[m.branchId]?.notes;
  return (
    <div className="space-y-2.5">
      {sections.map((s, i) => (
        <div key={s.title} className={`rounded-[20px] p-3.5 ring-1 ${s.title === 'Never' ? 'bg-[#fff6f6] ring-[#f6caca]' : 'bg-white ring-line/70'}`}>
          <p className={`flex items-center gap-2 text-[14.5px] font-bold ${s.title === 'Never' ? 'text-[#b42318]' : 'text-ink'}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-[11.5px] font-bold ${s.title === 'Never' ? 'bg-[#ffe4e4]' : 'bg-brand-50 text-brand-700'}`}>{i + 1}</span>
            {s.title}
          </p>
          <ul className="mt-1.5 space-y-1">
            {s.points.map((x) => (
              <li key={x} className="flex gap-2 text-[13px] leading-snug text-ink-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {notes && (
        <div className="rounded-[20px] bg-[#fff8ec] p-3.5 ring-1 ring-[#fde2b3]">
          <p className="text-[14.5px] font-bold text-ink">From your branch</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-2">{notes}</p>
        </div>
      )}
    </div>
  );
}

/** First sign-in (and after any change): read and agree before starting. */
export function RulesGate() {
  const { m, me } = useMk();
  const { showToast } = useNav();
  const [later, setLater] = useState(false);
  if (later || hasAgreed(m.st, m.branchId, me.id)) return null;
  const version = rulesVersion(m.st, m.branchId);
  const updated = (m.st.acks[me.id]?.version ?? -1) >= 0;
  return (
    <Sheet
      tall
      title={updated ? 'The rules have changed' : 'Before you start'}
      subtitle={`Rules of engagement · ${getBranch(m.branchId)?.name ?? ''} branch`}
      onClose={() => setLater(true)}
      footer={
        <button type="button" onClick={() => (ackRules(me.id, version), showToast('Thank you. You can read the rules any time in Settings.'))} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          <Check size={18} /> I have read and agree
        </button>
      }
    >
      <div className="mb-3 flex items-center gap-3 rounded-[22px] bg-linear-to-br from-[#eef4ff] to-[#dbe8ff] p-4">
        <Sticker name="clipboard" size={46} />
        <p className="text-[13.5px] leading-snug text-ink-2">{updated ? 'Your manager updated the rules. Please read them again.' : 'How hospitals, transfers, targets and bonuses work. You can read them again any time in Settings.'}</p>
      </div>
      <RulesBody />
    </Sheet>
  );
}

/** The rules page (menu and Settings). */
export function MarketerRules() {
  const { m, me } = useMk();
  const { showToast } = useNav();
  const version = rulesVersion(m.st, m.branchId);
  const agreedAt = m.st.acks[me.id]?.at;
  const agreed = hasAgreed(m.st, m.branchId, me.id);
  return (
    <div className="relative">
      <div className="relative pt-2">
        <div className="relative mb-3 overflow-hidden rounded-[26px] bg-linear-to-br from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5] p-5 text-white">
          <span aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <FileText size={26} className="relative" />
          <p className="relative mt-2 text-[22px] font-extrabold leading-tight">Rules of engagement</p>
          <p className="relative mt-1 text-[13px] text-white/85">How your hospitals, transfers, targets and bonus work. Set by your Branch Manager.</p>
          <p className="relative mt-2 text-[12px] text-white/75">
            Version {version}
            {agreedAt && agreed ? ` · you agreed on ${stamp(agreedAt)}` : ' · not agreed yet'}
          </p>
        </div>
        <RulesBody />
        {!agreed && (
          <button type="button" onClick={() => (ackRules(me.id, version), showToast('Thank you'))} className="press mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            <Check size={18} /> I have read and agree
          </button>
        )}
        <p className="mt-3 text-center text-[12px] text-muted">{plural(m.marketers.length, 'marketer')} in your branch follow the same rules.</p>
      </div>
    </div>
  );
}
