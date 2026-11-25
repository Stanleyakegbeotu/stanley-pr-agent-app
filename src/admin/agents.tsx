/**
 * PR agents, without leaving the page (owner, 2026-11-25):
 *  • AgentsSheet: every PR agent of a branch ("View all"), searchable, with
 *    their referrals for the chosen dates.
 *  • AgentProfileSheet: one agent's profile as a slide-up: contact (copy or
 *    call the phone), account details, figures, referred patients, and the
 *    two ways to reach them: start a conversation (chat) or send an
 *    announcement to their Referrer Portal announcement bar.
 *  • ComposeSheet: a message, thank-you or notice for one agent or for every
 *    agent of a branch, with a preview of how it looks on their phone.
 * Same logic and figures as the desktop PR Management (src/company).
 */
import { useMemo, useState } from 'react';
import { Building2, Check, Copy, Hospital, Landmark, Megaphone, MessageCircle, Phone, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID } from '@company/data/legacy';
import type { DateRange, PeriodSelection } from '@company/data/types';
import { DATA_START, TODAY, diffDays } from '@company/data/demo/generator';
import { patientVisits } from '@company/data/demo/dailyLines';
import { agentRanking } from '@company/services/analytics';
import { commissionOn, pct, rateFor } from '@company/services/commission';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import { moneyWordsIn, sendAnnouncement, useAnnouncements, type AnnouncementAudience } from '@/domain/announcements';
import { postText } from '@/domain/chat';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { Sheet, useSheetPeriod } from './ui';
import { FocusSheet, Rows, norm, useRowCtx, visitRow, type Focus } from './details';
import { agentConvId } from './chat';

const ALL_TIME: DateRange = { from: DATA_START, to: TODAY, days: diffDays(DATA_START, TODAY) + 1 };
/** PR agents belong to the branch their referrals go to (the legacy branch until agents carry a branch). */
export const agentBranchId = () => LEGACY_BRANCH_ID;
const hospitalOf = (h: string) => h.trim().toUpperCase() || 'No hospital assigned';
const firstName = (n: string) => n.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss|barrister|pharm\.?|nurse)\s+/i, '').split(/\s+/)[0] ?? n;

/* ─────────────── every PR agent of a branch ─────────────── */

export function AgentsSheet({ branchId, period, onClose }: { branchId: string; period: PeriodSelection; onClose: () => void }) {
  const { agents } = useCompany();
  const { range, filter, period: sel } = useSheetPeriod(period);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'active' | 'quiet'>('all');
  const [open, setOpen] = useState<number | null>(null);
  const [shown, setShown] = useState(40);
  const branch = getBranch(branchId);
  const mine = branchId === agentBranchId() ? agents : [];
  const stats = useMemo(() => new Map(agentRanking([branchId], range).map((a) => [a.id, a])), [branchId, range]);
  const t = norm(q);
  const list = useMemo(
    () =>
      mine
        .map((a) => ({ a, s: stats.get(a.id) }))
        .filter(({ a, s }) => (show === 'all' || (show === 'active' ? !!s : !s)) && (!t || norm(`${a.name} ${a.hospital} ${a.phone}`).includes(t)))
        .sort((x, y) => (y.s?.referrals ?? 0) - (x.s?.referrals ?? 0) || x.a.name.localeCompare(y.a.name)),
    [mine, stats, show, t],
  );
  const active = mine.filter((a) => stats.has(a.id)).length;
  return (
    <Sheet title="PR agents" subtitle={`${branch?.name ?? ''} branch · ${formatCount(mine.length)} agents`} onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Search name, hospital or phone' }} filter={filter}>
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#f3eeff] to-[#e4dbff] p-4">
        <p className="text-[12.5px] font-medium text-ink-2">Referred patients in this period</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight text-ink">
          {formatCount(active)} <span className="text-[15px] font-semibold text-ink-2">of {formatCount(mine.length)} agents</span>
        </p>
        <p className="mt-1 max-w-[70%] text-[12px] leading-snug text-ink-2/80">Tap an agent for their profile, account details, chat and announcements.</p>
        <Sticker name="stethoscope" size={80} className="absolute -bottom-1 right-1" />
      </div>
      <div className="mb-3 flex gap-2 px-1">
        {(
          [
            ['all', `All (${mine.length})`],
            ['active', `Referred (${active})`],
            ['quiet', `No referrals (${mine.length - active})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => (setShow(k), setShown(40))} aria-pressed={show === k} className={`press min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${show === k ? 'bg-brand-600 text-white' : 'bg-page text-ink-2'}`}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-10 text-center text-[14px] text-muted">{t ? `No agent matches “${q}”.` : 'No agents here.'}</p>
      ) : (
        <ul className="space-y-2">
          {list.slice(0, shown).map(({ a, s }) => (
            <li key={a.id}>
              <button type="button" onClick={() => setOpen(a.id)} className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70">
                <InitialsAvatar name={a.name} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-ink">{a.name}</span>
                    {s && <span className="shrink-0 text-[14px] font-bold text-violet">{formatMoney(s.commission[s.branch.currency] ?? 0, s.branch.currency, true)}</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {hospitalOf(a.hospital)}
                    {a.phone && a.phone !== 'N/A' ? ` · ${a.phone}` : ''}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {s ? (
                      <>
                        <span className="rounded-full bg-tint-purple px-2 py-0.5 text-[11.5px] font-semibold text-violet">{`${formatCount(s.referrals)} patient${s.referrals === 1 ? '' : 's'}`}</span>
                        <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-ink-2">{formatMoney(s.revenue[s.branch.currency] ?? 0, s.branch.currency, true)} billed</span>
                      </>
                    ) : (
                      <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] font-medium text-muted">No referrals in this period</span>
                    )}
                    {a.bank && <span className="rounded-full bg-tint-green px-2 py-0.5 text-[11.5px] font-medium text-good-ink">Bank on record</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + 40)} className="press mx-auto mt-3 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({formatCount(list.length - shown)} more)
        </button>
      )}
      {open != null && <AgentProfileSheet id={open} branchIds={[branchId]} period={sel} onClose={() => setOpen(null)} />}
    </Sheet>
  );
}

/* ─────────────── one agent's profile ─────────────── */

export function AgentProfileSheet({ id, branchIds, period, onClose }: { id: number; branchIds: string[]; period: PeriodSelection; onClose: () => void }) {
  const { agents, navigate } = useCompany();
  const { showToast } = useNav();
  const { range, filter, period: sel } = useSheetPeriod(period);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [compose, setCompose] = useState(false);
  const ctx = useRowCtx(setFocus);
  const sent = useAnnouncements();
  const rec = agents.find((a) => a.id === id);
  const rank = useMemo(() => agentRanking(branchIds, range).find((a) => a.id === id), [branchIds, range, id]);
  const life = useMemo(() => agentRanking(branchIds, ALL_TIME).find((a) => a.id === id), [branchIds, id]);
  const visits = useMemo(() => patientVisits(branchIds, range).filter((v) => v.agentId === id), [branchIds, range, id]);
  const name = rec?.name ?? rank?.name ?? `PR agent #${id}`;
  const branch = getBranch(rank?.branch.id ?? agentBranchId());
  const c = branch?.currency ?? 'NGN';
  const billed = visits.reduce((a, v) => a + v.billed, 0);
  const commission = rank ? (rank.commission[c] ?? 0) : visits.reduce((a, v) => a + commissionOn(v.billed, id), 0);
  const phone = rec?.phone && rec.phone !== 'N/A' ? rec.phone : null;
  const hospital = hospitalOf(rec?.hospital ?? rank?.hospital ?? '');
  const t = norm(q);
  const rows = visits.map((v) => visitRow(v, ctx, { amountNote: `${formatMoney(commissionOn(v.billed, id), c)} commission` })).filter((r) => !t || r.text.includes(t));
  const mineSent = sent.filter((a) => a.audience.kind === 'agent' && a.audience.agentId === id).slice(0, 3);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${what} copied`);
    } catch {
      showToast(`Couldn’t copy. ${what}: ${text}`);
    }
  };
  const chat = () => navigate(`/messages/${agentConvId(id)}`);
  return (
    <Sheet
      back
      title={name}
      subtitle={`PR agent · ${hospital}`}
      onClose={onClose}
      tall
      search={{ value: q, onChange: setQ, placeholder: 'Search referred patients' }}
      filter={filter}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={chat} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[14.5px] font-semibold text-white">
            <MessageCircle size={18} /> Start a conversation
          </button>
          <button type="button" onClick={() => setCompose(true)} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tint-purple text-[14.5px] font-semibold text-violet ring-1 ring-[#e2d8ff]">
            <Megaphone size={18} /> Announcement
          </button>
        </div>
      }
    >
      {/* Who */}
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#f3eeff] to-[#e0d6ff] p-4">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={name} size={58} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-ink">{name}</p>
            <p className="truncate text-[12.5px] text-ink-2">
              {hospital} · {branch?.name ?? ''} branch
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Agent #{id} · {rec?.source === 'user' ? 'Added in STANLEY' : 'From the legacy records'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <QuickBtn icon={<MessageCircle size={19} />} label="Chat" onClick={chat} />
          <QuickBtn icon={<Phone size={19} />} label="Call" href={phone ? `tel:${phone.replace(/\s+/g, '')}` : undefined} />
          <QuickBtn icon={<Copy size={18} />} label="Copy phone" onClick={phone ? () => copy(phone, 'Phone number') : undefined} />
          <QuickBtn icon={<Megaphone size={19} />} label="Announce" onClick={() => setCompose(true)} />
        </div>
      </div>

      {/* Figures */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Figure label="Patients referred" value={formatCount(visits.length)} sub={`${formatCount(life?.referrals ?? 0)} since records began`} />
        <Figure label="Billed for their patients" value={formatMoney(billed, c, true)} sub={`${formatMoney(life?.revenue[c] ?? 0, c, true)} since records began`} />
        <Figure label="Commission" value={formatMoney(commission, c)} sub={`${formatMoney(life?.commission[c] ?? 0, c, true)} since records began`} strong />
        <Figure label="Commission rate" value={pct(rateFor(id))} sub="Set in PR Management" />
      </div>

      {/* Contact and account */}
      <div className="mb-3 divide-y divide-line rounded-[20px] bg-white ring-1 ring-line/70">
        <InfoRow icon={<Phone size={16} />} label="Phone" value={phone ?? 'Not on record'} action={phone ? () => copy(phone, 'Phone number') : undefined} />
        <InfoRow icon={<Hospital size={16} />} label="Hospital" value={hospital} />
        <InfoRow icon={<Building2 size={16} />} label="Branch" value={branch ? `${branch.name} · ${branch.code}` : 'Not assigned'} />
        {rec?.bank ? (
          <>
            <InfoRow icon={<Landmark size={16} />} label="Bank" value={rec.bank.bankName} />
            <InfoRow icon={<Landmark size={16} />} label="Account number" value={rec.bank.accountNumber} action={() => copy(rec.bank!.accountNumber, 'Account number')} />
            <InfoRow icon={<Landmark size={16} />} label="Account name" value={rec.bank.accountName} sub={`Updated ${new Date(rec.bank.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`} />
          </>
        ) : (
          <InfoRow icon={<Landmark size={16} />} label="Account details" value="Not on record yet" sub="Add them in PR Management for monthly payouts" />
        )}
      </div>

      {mineSent.length > 0 && (
        <div className="mb-3 rounded-[20px] bg-white p-3 ring-1 ring-line/70">
          <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Your announcements to {firstName(name)}</p>
          {mineSent.map((a) => (
            <div key={a.id} className="flex items-start gap-2.5 rounded-2xl bg-page p-2.5">
              <Megaphone size={16} className="mt-0.5 shrink-0 text-violet" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{a.title}</span>
                <span className="block text-[11.5px] text-muted">
                  {new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.status === 'queued' ? 'Waiting to deliver' : 'Delivered'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Patients referred · {filter.label}</p>
      <Rows rows={rows} oneDay={range.days <= 1} multi={branchIds.length > 1} empty={t ? `No patient matches “${q}”.` : 'No referred patients in this period.'} />
      {focus && <FocusSheet focus={focus} branchIds={branchIds} period={sel} onClose={() => setFocus(null)} />}
      {compose && <ComposeSheet audience={{ kind: 'agent', agentId: id, name, phone: phone ?? '' }} branchId={branch?.id ?? agentBranchId()} preset="message" onClose={() => setCompose(false)} />}
    </Sheet>
  );
}

function QuickBtn({ icon, label, onClick, href }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string }) {
  const cls = 'press flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/80 text-[11.5px] font-semibold text-violet';
  if (href)
    return (
      <a href={href} className={cls}>
        {icon}
        {label}
      </a>
    );
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`${cls} disabled:opacity-40`}>
      {icon}
      {label}
    </button>
  );
}

function Figure({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3 ring-1 ring-line/70">
      <p className="truncate text-[11.5px] font-medium text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-[18px] font-bold ${strong ? 'text-violet' : 'text-ink'}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function InfoRow({ icon, label, value, sub, action }: { icon: React.ReactNode; label: string; value: string; sub?: string; action?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-page text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] text-muted">{label}</span>
        <span className="block truncate text-[14px] font-semibold text-ink">{value}</span>
        {sub && <span className="block truncate text-[11.5px] text-muted">{sub}</span>}
      </span>
      {action && (
        <button type="button" onClick={action} aria-label={`Copy ${label.toLowerCase()}`} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Copy size={16} />
        </button>
      )}
    </div>
  );
}

/* ─────────────── message / thank you / notice to agents ─────────────── */

type Kind = 'message' | 'thanks' | 'notice';
const KINDS: { id: Kind; label: string; sticker: 'envelope' | 'trophy' | 'megaphone' }[] = [
  { id: 'message', label: 'Message', sticker: 'envelope' },
  { id: 'thanks', label: 'Thank you', sticker: 'trophy' },
  { id: 'notice', label: 'Notice', sticker: 'megaphone' },
];

/**
 * Compose an announcement for one agent or a whole branch. "Also send in
 * chat" puts the same words in the agent's chat with the admin, so the
 * announcement can point them to it ("Read and reply").
 */
export function ComposeSheet({ audience, branchId, preset, draft, onClose }: { audience: AnnouncementAudience; branchId: string; preset: Kind; draft?: { title: string; text: string }; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const branch = getBranch(branchId);
  const agentAud = audience.kind === 'agent' ? audience : null;
  const [toAll, setToAll] = useState(audience.kind === 'branch');
  const [kind, setKind] = useState<Kind>(preset);
  const who = agentAud ? firstName(agentAud.name) : '';
  const template = (k: Kind) =>
    draft ??
    (k === 'thanks'
      ? { title: agentAud && !toAll ? `Thank you, ${who}!` : 'Thank you for your referrals', text: `We appreciate every patient you trust us with at ${branch?.name ?? 'our'} branch. Thank you for working with ${'Silhouette'}.` }
      : k === 'message'
        ? { title: 'The Admin sent you a message', text: '' }
        : { title: '', text: '' });
  const [title, setTitle] = useState(template(preset).title);
  const [text, setText] = useState(template(preset).text);
  const [inChat, setInChat] = useState(true);
  const [tried, setTried] = useState(false);
  const money = moneyWordsIn(`${title} ${text}`);
  const problem = !title.trim() ? 'Add a short title.' : !text.trim() ? 'Write the message.' : money.length ? `The Referrer Portal never shows money. Remove: ${money.join(', ')}.` : '';
  const pickKind = (k: Kind) => {
    setKind(k);
    const t = template(k);
    setTitle(t.title);
    setText(t.text);
  };
  const send = async () => {
    setTried(true);
    if (problem) return;
    const aud: AnnouncementAudience = toAll || !agentAud ? { kind: 'branch', branchId, branchName: branch?.name ?? branchId } : agentAud;
    sendAnnouncement({ from: { name: user.name, role: 'Company Admin' }, audience: aud, kind, title: title.trim(), text: text.trim(), replyInChat: aud.kind === 'agent' && inChat });
    if (aud.kind === 'agent' && inChat) await postText(agentConvId(aud.agentId), `${title.trim()}\n\n${text.trim()}`);
    showToast(aud.kind === 'agent' ? `Sent to ${who}${inChat ? ', in chat and their announcement bar' : "'s announcement bar"}` : `Announced to every PR agent at ${branch?.name ?? ''}`);
    onClose();
  };
  const look = KINDS.find((k) => k.id === kind)!;
  return (
    <Sheet
      back
      title={kind === 'thanks' ? 'Say thank you' : kind === 'message' ? 'Send a message' : 'Send a notice'}
      subtitle="Shows in the agent’s announcement bar"
      onClose={onClose}
      tall
      footer={
        <button type="button" onClick={send} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          <Send size={18} /> {toAll || !agentAud ? `Send to all ${branch?.name ?? ''} agents` : `Send to ${who}`}
        </button>
      }
    >
      <div className="px-1 pb-2">
        {agentAud && (
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-page p-1" role="tablist" aria-label="Send to">
            <button type="button" role="tab" aria-selected={!toAll} onClick={() => setToAll(false)} className={`press min-h-10 truncate rounded-xl px-2 text-[13.5px] font-semibold ${!toAll ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
              Only {who}
            </button>
            <button type="button" role="tab" aria-selected={toAll} onClick={() => setToAll(true)} className={`press min-h-10 truncate rounded-xl px-2 text-[13.5px] font-semibold ${toAll ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
              All {branch?.name} agents
            </button>
          </div>
        )}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => pickKind(k.id)} aria-pressed={kind === k.id} className={`press flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-2xl border text-[13px] font-semibold ${kind === k.id ? 'border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-100' : 'border-line bg-white text-ink-2'}`}>
              <Sticker name={k.sticker} size={32} />
              {k.label}
            </button>
          ))}
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="e.g. New ultrasound hours" className="min-h-12 w-full rounded-2xl border-[1.5px] border-brand-500 bg-white px-4 text-[15px] text-ink outline-none ring-4 ring-brand-100" />
        </label>
        <label className="mb-1 block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Message</span>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} rows={4} placeholder={kind === 'message' ? 'Write your message. They can reply in chat.' : 'What should they know?'} className="w-full resize-none rounded-2xl border-[1.5px] border-brand-500 bg-white px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-4 ring-brand-100" />
        </label>
        <p className="mb-3 text-right text-[11.5px] text-muted">{text.length}/280</p>

        {agentAud && !toAll && (
          <button type="button" onClick={() => setInChat((v) => !v)} aria-pressed={inChat} className="press mb-3 flex w-full items-center gap-3 rounded-2xl bg-page p-3 text-left">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${inChat ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>{inChat && <Check size={15} strokeWidth={3} />}</span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-ink">Also send it in chat</span>
              <span className="block text-[12px] text-muted">The announcement then says “Read and reply”, opening your chat.</span>
            </span>
          </button>
        )}

        {tried && problem && (
          <p className="mb-3 flex items-start gap-2 rounded-2xl bg-[#fdecec] px-3.5 py-3 text-[13px] font-medium text-[#b42318]">
            <ShieldAlert size={17} className="mt-0.5 shrink-0" /> {problem}
          </p>
        )}

        {/* Preview */}
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">
          <Sparkles size={14} /> How it looks on their phone
        </p>
        <div className={`relative isolate h-[176px] overflow-hidden rounded-[22px] bg-linear-to-r p-4 text-white ${kind === 'thanks' ? 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]' : kind === 'message' ? 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]' : 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]'}`}>
          <span aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10" />
          <div className="w-[64%]">
            <p className="mb-1 text-[12px] font-medium text-white/90">{kind === 'thanks' ? 'A thank you from the Admin' : kind === 'message' ? 'Message from the Admin' : 'Notice from the Admin'}</p>
            <p className="line-clamp-2 text-[17px] font-bold leading-tight">{title || 'Your title'}</p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/90">{text || 'Your message appears here.'}</p>
            <span className="mt-2.5 inline-flex rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-700">{agentAud && !toAll && inChat ? 'Read and reply' : 'Open'}</span>
          </div>
          <Sticker name={look.sticker} size={104} className="absolute -bottom-2 -right-2" />
        </div>
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">The Referrer Portal never shows money, so commission, payments and prices can’t be announced there. Don’t include patient details.</p>
      </div>
    </Sheet>
  );
}
