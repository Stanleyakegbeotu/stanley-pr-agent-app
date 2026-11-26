/**
 * Reports from the marketer (owner, 2026-11-26): from the Report centre a
 * marketer sends a complaint or an issue to the Branch Manager or the Company
 * Admin (for example, a PR agent complaining about a result or the front
 * desk), and follows what happens to it. Same reports as the rest of STANLEY
 * (services/issueReports): visibility follows what the report is about.
 */
import { useState } from 'react';
import { ChevronRight, Flag, Send, Siren } from 'lucide-react';
import { logAudit } from '@company/services/audit';
import { ABOUT, PRIORITY_TEXT, STATUS_TEXT, addReport, useIssueReports, type AboutKind, type IssueReport, type ReportPriority, type ReportTo } from '@company/services/issueReports';
import { useNav } from '@/app/store';
import { Sheet } from '@/admin/ui';
import { LongText } from '@/admin/fields';
import { FieldErr, FieldLabel, inputCls } from '@/admin/prManage';
import { Sticker } from '@/ui/kit';
import { stamp } from './data';
import { Card, useMk } from './ui';

const STATUS_PILL = { new: 'bg-[#fff1de] text-[#b45309]', attended: 'bg-brand-50 text-brand-700', resolved: 'bg-[#e6f8ee] text-good-ink' } as const;
const PRIO_PILL: Record<ReportPriority, string> = { critical: 'bg-[#ffe4e4] text-[#b42318]', high: 'bg-[#fff1de] text-[#b45309]', normal: 'bg-page text-ink-2' };
/** What a marketer can report about (no monthly payouts: that is the PR agents' own). */
const CHOICES = ABOUT.filter((a) => a.kind !== 'payout');

export function MyReports() {
  const { me } = useMk();
  const all = useIssueReports();
  const mine = all.filter((r) => r.from.name === me.name && r.from.role === 'Marketer');
  const [writing, setWriting] = useState(false);
  const [open, setOpen] = useState<IssueReport | null>(null);
  return (
    <>
      <button type="button" onClick={() => setWriting(true)} className="press relative mb-3 flex w-full items-center gap-3 overflow-hidden rounded-[24px] bg-linear-to-br from-[#7a1f1f] via-[#d93036] to-[#f0646a] p-4 text-left text-white shadow-[0_14px_32px_rgba(217,48,54,0.28)]">
        <span aria-hidden="true" className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <Sticker name="megaphone" size={46} />
        <span className="relative min-w-0 flex-1">
          <b className="block text-[17px]">Make a report</b>
          <span className="block text-[12.5px] text-white/85">A complaint or an issue, to your Branch Manager or the Company Admin</span>
        </span>
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/20">
          <Flag size={19} />
        </span>
      </button>
      {mine.length ? (
        <div className="space-y-2">
          {mine.map((r) => (
            <button key={r.id} type="button" onClick={() => setOpen(r)} className="press w-full rounded-[20px] bg-white p-3.5 text-left ring-1 ring-line/70">
              <span className="flex items-start gap-2">
                <b className="min-w-0 flex-1 text-[14.5px] leading-snug text-ink">{r.subject}</b>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_PILL[r.status]}`}>{STATUS_TEXT[r.status]}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${PRIO_PILL[r.priority]}`}>{PRIORITY_TEXT[r.priority]}</span>
                {r.category} · to {r.to === 'admin' ? 'Company Admin' : 'Branch Manager'} · {stamp(r.at)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Card className="text-center text-[13.5px] text-muted">No reports yet. Anything a PR agent, doctor or patient complains about can be reported here.</Card>
      )}
      {writing && <ReportSheet onClose={() => setWriting(false)} onSent={(r) => (setWriting(false), setOpen(r))} />}
      {open && <ReportView r={all.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReportView({ r, onClose }: { r: IssueReport; onClose: () => void }) {
  return (
    <Sheet back tall title={r.subject} subtitle={`${r.id} · ${STATUS_TEXT[r.status]}`} onClose={onClose}>
      <Card className="mb-3">
        <p className="text-[12px] font-semibold text-muted">
          {r.category} · {PRIORITY_TEXT[r.priority]} · to {r.to === 'admin' ? 'the Company Admin' : 'the Branch Manager'}
        </p>
        {r.about && <p className="mt-1 text-[13px] text-ink-2">About: {r.about}</p>}
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{r.details}</p>
      </Card>
      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">What has happened</p>
      <ol className="mb-3 ml-2 border-l-2 border-line pl-4">
        {r.history.map((h, i) => (
          <li key={i} className="relative pb-3">
            <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
            <p className="text-[13.5px] font-semibold text-ink">{h.action}</p>
            {h.note && <p className="text-[13px] text-ink-2">{h.note}</p>}
            <p className="text-[11.5px] text-muted">
              {stamp(h.at)} · {h.by}
            </p>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

function ReportSheet({ onClose, onSent }: { onClose: () => void; onSent: (r: IssueReport) => void }) {
  const { m, me } = useMk();
  const { showToast } = useNav();
  const [about, setAbout] = useState<AboutKind>('other');
  const [to, setTo] = useState<Exclude<ReportTo, 'frontdesk'>>('manager');
  const [priority, setPriority] = useState<ReportPriority>('normal');
  const [who, setWho] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  // A report about the Branch Manager can only go to the Company Admin.
  const finalTo: Exclude<ReportTo, 'frontdesk'> = about === 'manager' ? 'admin' : to;
  const choice = CHOICES.find((c) => c.kind === about)!;
  const bad = { subject: subject.trim().length < 4 ? 'Say in a few words what it is about' : '', details: details.trim().length < 10 ? 'Describe what happened' : '' };
  const send = () => {
    setTried(true);
    if (bad.subject || bad.details) return;
    const r = addReport(
      { branchId: m.branchId, from: { kind: 'staff', name: me.name, role: 'Marketer' }, to: finalTo, aboutKind: about, priority, subject: subject.trim(), details: details.trim(), about: who.trim() || undefined, patientRef: ref.trim() || undefined },
      me.name,
    );
    logAudit({ category: 'Reports', action: 'Report sent', record: `${r.id} · ${r.subject}`, details: `By ${me.name} (Marketer) to the ${finalTo === 'admin' ? 'Company Admin' : 'Branch Manager'} · ${r.category}`, branchId: m.branchId });
    showToast(`Report sent to the ${finalTo === 'admin' ? 'Company Admin' : 'Branch Manager'}`);
    onSent(r);
  };
  return (
    <Sheet
      back
      tall
      title="Make a report"
      subtitle="It is recorded with your name and followed up"
      onClose={onClose}
      footer={
        <button type="button" onClick={send} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          <Send size={17} /> Send report
        </button>
      }
    >
      <div className="space-y-4 px-1 pb-2">
        <div>
          <FieldLabel label="Send to" />
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-page p-1">
            {(
              [
                ['manager', 'Branch Manager'],
                ['admin', 'Company Admin'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" disabled={about === 'manager' && k === 'manager'} aria-pressed={finalTo === k} onClick={() => setTo(k)} className={`press min-h-11 rounded-xl text-[14px] font-semibold disabled:opacity-35 ${finalTo === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-2'}`}>
                {l}
              </button>
            ))}
          </div>
          {about === 'manager' && <p className="mt-1 text-[12px] text-muted">A report about the Branch Manager goes to the Company Admin only.</p>}
        </div>
        <div>
          <FieldLabel label="What is it about?" />
          <div className="space-y-1.5">
            {CHOICES.map((c) => (
              <button key={c.kind} type="button" aria-pressed={about === c.kind} onClick={() => setAbout(c.kind)} className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 ${about === c.kind ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-line'}`}>
                <span className="min-w-0 flex-1">
                  <b className={`block text-[14px] ${about === c.kind ? 'text-brand-700' : 'text-ink'}`}>{c.label}</b>
                  {about === c.kind && <span className="block text-[12px] text-muted">{c.hint}</span>}
                </span>
                <ChevronRight size={15} className={about === c.kind ? 'text-brand-600' : 'text-faint'} />
              </button>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-muted">Type: {choice.category}</p>
        </div>
        <label className="block">
          <FieldLabel label="Who raised it, or who it is about" optional />
          <input value={who} maxLength={80} onChange={(e) => setWho(e.target.value)} placeholder="For example: Dr Frank, PR agent at MDH" className={inputCls()} />
        </label>
        <label className="block">
          <FieldLabel label="Subject" required />
          <input value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} placeholder="For example: Doctor says results are coming late" className={inputCls(tried ? bad.subject : null)} />
          <FieldErr msg={tried ? bad.subject : ''} />
        </label>
        <LongText label="What happened" required value={details} onChange={setDetails} max={1500} error={tried ? bad.details || null : null} placeholder="Who complained, what they said, when it happened, what they would like done" />
        <label className="block">
          <FieldLabel label="Referral or patient ID" optional />
          <input value={ref} maxLength={30} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="ABJ-R… (no patient names)" className={inputCls()} />
        </label>
        <div>
          <FieldLabel label="How urgent?" />
          <div className="grid grid-cols-3 gap-1.5">
            {(['normal', 'high', 'critical'] as ReportPriority[]).map((k) => (
              <button key={k} type="button" aria-pressed={priority === k} onClick={() => setPriority(k)} className={`press flex min-h-11 items-center justify-center gap-1 rounded-2xl text-[13.5px] font-semibold ring-1 ${priority === k ? (k === 'critical' ? 'bg-[#ffe4e4] text-[#b42318] ring-[#f6b4b4]' : k === 'high' ? 'bg-[#fff1de] text-[#b45309] ring-[#fcd9a8]' : 'bg-brand-50 text-brand-700 ring-brand-200') : 'bg-white text-ink-2 ring-line'}`}>
                {k === 'critical' && <Siren size={14} />}
                {PRIORITY_TEXT[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
