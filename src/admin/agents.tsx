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
import { useMemo, useRef, useState } from 'react';
import { Building2, Camera, Check, Copy, Hospital, Landmark, Megaphone, MessageCircle, Pencil, Phone, Plus, RotateCcw, Send, ShieldAlert, Sparkles, Trash2, Users } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID } from '@company/data/legacy';
import type { DateRange, PeriodSelection } from '@company/data/types';
import { DATA_START, TODAY, diffDays } from '@company/data/demo/generator';
import { patientVisits } from '@company/data/demo/dailyLines';
import { agentRanking } from '@company/services/analytics';
import { agentRate, commissionOn, pct, rateFor } from '@company/services/commission';
import { formatCount, formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import { moneyWordsIn, sendAnnouncement, useAnnouncements, type AnnouncementAudience } from '@/domain/announcements';
import { postText } from '@/domain/chat';
import { Sticker } from '@/ui/kit';
import { squarePhoto } from '@/domain/profile';
import { NIGERIAN_BANKS, isNuban } from '@company/data/userRecords';
import { AgentAvatar, setAgentPhoto, useAgentPhotos } from './agentPhotos';
import { saveAgentBank, useAgentBanks } from './agentBanks';
import { Sheet, useSheetPeriod } from './ui';
import { FocusSheet, Rows, norm, useRowCtx, visitRow, type Focus } from './details';
import { agentConvId } from './chat';
import { LongText } from './fields';
import { AddAgentSheet, AgentEditSheet, TrashSheet } from './prManage';
import { hasPhone, hospitalKey } from '@company/data/legacy';
import { BASELINE_AGENTS } from '@company/data/userRecords';
import { onlyName } from '@/ui/fieldRules';

const ALL_TIME: DateRange = { from: DATA_START, to: TODAY, days: diffDays(DATA_START, TODAY) + 1 };
/** PR agents belong to the branch their referrals go to (the legacy branch until agents carry a branch). */
export const agentBranchId = () => LEGACY_BRANCH_ID;
const hospitalOf = (h: string) => h.trim().toUpperCase() || 'No hospital assigned';
const firstName = (n: string) => n.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss|barrister|pharm\.?|nurse)\s+/i, '').split(/\s+/)[0] ?? n;

/* ─────────────── every PR agent of a branch ─────────────── */

export function AgentsSheet({ branchId, period, onClose, hospital, initialShow = 'all', canAdd }: { branchId: string; period: PeriodSelection; onClose: () => void; /** A hospital code, null for agents with no hospital, or all agents. */ hospital?: string | null; initialShow?: 'all' | 'active' | 'quiet' | 'nophone' | 'edited'; canAdd?: boolean }) {
  const { agents: everyone, agentEdits } = useCompany();
  const [adding, setAdding] = useState(false);
  const agents = hospital === undefined ? everyone : everyone.filter((a) => hospitalKey(a.hospital) === (hospital ?? ''));
  const { range, filter, period: sel } = useSheetPeriod(period);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'active' | 'quiet' | 'nophone' | 'edited'>(initialShow);
  const [open, setOpen] = useState<number | null>(null);
  const [shown, setShown] = useState(40);
  const banks = useAgentBanks();
  const branch = getBranch(branchId);
  const mine = branchId === agentBranchId() ? agents : [];
  const stats = useMemo(() => new Map(agentRanking([branchId], range).map((a) => [a.id, a])), [branchId, range]);
  const t = norm(q);
  const list = useMemo(
    () =>
      mine
        .map((a) => ({ a, s: stats.get(a.id) }))
        .filter(({ a, s }) => (show === 'all' || (show === 'active' ? !!s : show === 'quiet' ? !s : show === 'nophone' ? !hasPhone(a.phone) : !!agentEdits[a.id])) && (!t || norm(`${a.name} ${a.hospital} ${a.phone} ${a.id}`).includes(t)))
        .sort((x, y) => (y.s?.referrals ?? 0) - (x.s?.referrals ?? 0) || x.a.name.localeCompare(y.a.name)),
    [mine, stats, show, t, agentEdits],
  );
  const active = mine.filter((a) => stats.has(a.id)).length;
  return (
    <Sheet
      title={hospital === undefined ? 'PR agents' : hospital === null ? 'No hospital assigned' : hospital}
      subtitle={`${branch?.name ?? ''} branch · ${formatCount(mine.length)} agents`}
      onClose={onClose}
      tall
      search={{ value: q, onChange: setQ, placeholder: 'Search name, hospital, phone or ID' }}
      filter={filter}
      footer={
        canAdd ? (
          <button type="button" onClick={() => setAdding(true)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            <Plus size={18} /> Add PR agent{hospital ? ` to ${hospital}` : ''}
          </button>
        ) : undefined
      }
    >
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#f3eeff] to-[#e4dbff] p-4">
        <p className="text-[12.5px] font-medium text-ink-2">Referred patients in this period</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight text-ink">
          {formatCount(active)} <span className="text-[15px] font-semibold text-ink-2">of {formatCount(mine.length)} agents</span>
        </p>
        <p className="mt-1 max-w-[70%] text-[12px] leading-snug text-ink-2/80">{hospital === null ? 'Agents without a hospital code. Assign one from their profile, under Edit profile.' : 'Tap an agent for their profile, account details, chat and announcements.'}</p>
        <Sticker name="stethoscope" size={80} className="absolute -bottom-1 right-1" />
      </div>
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-2 pb-0.5">
        {(
          [
            ['all', `All (${mine.length})`],
            ['active', `Referred (${active})`],
            ['quiet', `No referrals (${mine.length - active})`],
            ['nophone', `No phone (${mine.filter((a) => !hasPhone(a.phone)).length})`],
            ...(mine.some((a) => agentEdits[a.id]) ? ([['edited', `Edited (${mine.filter((a) => agentEdits[a.id]).length})`]] as const) : []),
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
                <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={46} />
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
                    {(a.bank || banks[a.id]) && <span className="rounded-full bg-tint-green px-2 py-0.5 text-[11.5px] font-medium text-good-ink">Bank on record</span>}
                    {agentEdits[a.id] && <span className="rounded-full bg-[#fff1e0] px-2 py-0.5 text-[11.5px] font-medium text-[#b45309]">Edited</span>}
                    {a.source === 'user' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand-700">Added in STANLEY</span>}
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
      {adding && <AddAgentSheet hospital={hospital ?? ''} onClose={() => setAdding(false)} onAdded={setOpen} />}
    </Sheet>
  );
}

/* ─────────────── one agent's profile ─────────────── */

export function AgentProfileSheet({ id, branchIds, period, onClose }: { id: number; branchIds: string[]; period: PeriodSelection; onClose: () => void }) {
  const { agents, navigate, agentEdits, revertAgent, moveAgentToTrash } = useCompany();
  const { showToast } = useNav();
  const { range, filter, period: sel } = useSheetPeriod(period);
  const [editing, setEditing] = useState(false);
  const [trash, setTrash] = useState(false);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [compose, setCompose] = useState(false);
  const [editBank, setEditBank] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const photos = useAgentPhotos();
  const banks = useAgentBanks();
  const ctx = useRowCtx(setFocus);
  const sent = useAnnouncements();
  const found = agents.find((a) => a.id === id);
  const rec = found ? { ...found, bank: found.bank ?? banks[id] } : undefined;
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
  const mineSent = sent.filter((a) => (a.audience.kind === 'agent' && a.audience.agentId === id) || (a.audience.kind === 'agents' && a.audience.agents.some((x) => x.id === id))).slice(0, 3);
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
          <span className="relative shrink-0">
            <span className="block rounded-full ring-[3px] ring-white">
              <AgentAvatar id={id} name={name} phone={phone ?? undefined} size={64} />
            </span>
            <button type="button" onClick={() => photoInput.current?.click()} aria-label={photos.photoOf(id, phone ?? undefined) ? 'Change photo' : 'Add photo'} className="press absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-violet text-white ring-2 ring-white">
              <Camera size={14} />
            </button>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  setAgentPhoto(id, await squarePhoto(file, 320));
                  showToast('Photo saved');
                } catch (err) {
                  showToast((err as Error).message);
                }
              }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-ink">{name}</p>
            <p className="truncate text-[12.5px] text-ink-2">
              {hospital} · {branch?.name ?? ''} branch
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Agent #{id} · {photos.fromPortal(phone ?? undefined) ? 'Photo from their Referrer Portal' : rec?.source === 'user' ? 'Added in STANLEY' : 'From the legacy records'}
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
        <Figure label="Commission rate" value={pct(rateFor(id))} sub={agentRate(id) !== undefined ? "This agent's own rate" : 'Company rate'} onClick={found ? () => setEditing(true) : undefined} />
      </div>

      {/* Contact and account */}
      <div className="mb-3 divide-y divide-line rounded-[20px] bg-white ring-1 ring-line/70">
        <InfoRow icon={<Phone size={16} />} label="Phone" value={phone ?? 'Not on record'} action={phone ? () => copy(phone, 'Phone number') : undefined} />
        <InfoRow icon={<Hospital size={16} />} label="Hospital" value={hospital} />
        <InfoRow icon={<Building2 size={16} />} label="Branch" value={branch ? `${branch.name} · ${branch.code}` : 'Not assigned'} />
      </div>

      {/* Account details (for monthly payouts) */}
      <div className="mb-3 overflow-hidden rounded-[20px] bg-white ring-1 ring-line/70">
        <div className="flex items-center justify-between gap-2 bg-linear-to-r from-[#e6f8ee] to-[#d4f1e2] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-good-ink">
            <Landmark size={16} /> Account details
          </span>
          <button type="button" onClick={() => setEditBank(true)} className="press flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-600 shadow-sm">
            <Pencil size={13} /> {rec?.bank ? 'Change' : 'Add'}
          </button>
        </div>
        {rec?.bank ? (
          <div className="divide-y divide-line">
            <InfoRow icon={<Landmark size={16} />} label="Bank" value={rec.bank.bankName} />
            <InfoRow icon={<Landmark size={16} />} label="Account number" value={rec.bank.accountNumber} action={() => copy(rec.bank!.accountNumber, 'Account number')} />
            <InfoRow icon={<Landmark size={16} />} label="Account name" value={rec.bank.accountName} sub={`Updated ${new Date(rec.bank.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`} action={() => copy(rec.bank!.accountName, 'Account name')} />
          </div>
        ) : (
          <button type="button" onClick={() => setEditBank(true)} className="press flex w-full items-center gap-3 px-3.5 py-3 text-left">
            <Sticker name="coin" size={34} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">No account details yet</span>
              <span className="block text-[12px] text-muted">Add the bank, account number and name for monthly payouts.</span>
            </span>
          </button>
        )}
      </div>

      {/* Manage (desktop: Edit profile, Restore recorded details, Move to trash) */}
      {found && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className="press flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-brand-700 ring-1 ring-line">
            <Pencil size={15} /> Edit profile
          </button>
          {agentEdits[id] && (
            <button
              type="button"
              onClick={() => {
                revertAgent(id);
                showToast(`${BASELINE_AGENTS.find((a) => a.id === id)?.name ?? name} restored to the recorded details`);
              }}
              className="press flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-ink-2 ring-1 ring-line"
            >
              <RotateCcw size={15} /> Restore recorded details
            </button>
          )}
          {found.source === 'user' && (
            <button type="button" onClick={() => setTrash(true)} className="press flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-[#b42318] ring-1 ring-[#f9d4d4]">
              <Trash2 size={15} /> Move to trash
            </button>
          )}
        </div>
      )}
      {agentEdits[id] && (
        <p className="-mt-1 mb-3 rounded-2xl bg-[#fff7ec] px-3 py-2 text-[12.5px] text-[#9a4a07]">
          Edited in STANLEY. Recorded as {BASELINE_AGENTS.find((a) => a.id === id)?.name ?? name}, {hospitalOf(BASELINE_AGENTS.find((a) => a.id === id)?.hospital ?? '')}.
        </p>
      )}

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
      {editBank && <BankSheet id={id} name={name} onClose={() => setEditBank(false)} />}
      {editing && <AgentEditSheet id={id} onClose={() => setEditing(false)} />}
      {trash && (
        <TrashSheet
          name={name}
          what="PR agent (added in the app)"
          onClose={() => setTrash(false)}
          onConfirm={(reason) => {
            moveAgentToTrash(id, reason);
            showToast(`${name} moved to trash. Restore it from Trash within 30 days`);
            setTrash(false);
            onClose();
          }}
        />
      )}
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

function Figure({ label, value, sub, strong, onClick }: { label: string; value: string; sub?: string; strong?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag {...(onClick ? { type: 'button' as const, onClick } : {})} className={`min-w-0 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70 ${onClick ? 'press' : ''}`}>
      <p className="truncate text-[11.5px] font-medium text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-[18px] font-bold ${strong ? 'text-violet' : 'text-ink'}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
    </Tag>
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

/* ─────────────── account details (PR Management rule: same as the desktop) ─────────────── */

/** Add or change an agent's bank account for monthly payouts. Saved through the desktop logic (audit logged). */
function BankSheet({ id, name, onClose }: { id: number; name: string; onClose: () => void }) {
  const { agents, setAgentBank } = useCompany();
  const { showToast } = useNav();
  const saved = useAgentBanks();
  const cur = agents.find((a) => a.id === id)?.bank ?? saved[id];
  const [bank, setBank] = useState(cur?.bankName ?? '');
  const [num, setNum] = useState(cur?.accountNumber ?? '');
  const [acct, setAcct] = useState(cur?.accountName ?? name);
  const [q, setQ] = useState('');
  const [tried, setTried] = useState(false);
  const errs = { bank: bank ? '' : 'Choose the bank.', num: isNuban(num) ? '' : 'Enter the 10-digit account number.', acct: acct.trim().length >= 3 ? '' : 'Enter the name on the account.' };
  const ok = !errs.bank && !errs.num && !errs.acct;
  const banks = NIGERIAN_BANKS.filter((b) => !q || b.toLowerCase().includes(q.trim().toLowerCase()));
  const inputCls = 'min-h-12 w-full rounded-2xl border-[1.5px] border-brand-500 bg-white px-4 text-[15px] text-ink outline-none ring-4 ring-brand-100';
  const save = () => {
    setTried(true);
    if (!ok) return;
    const details = { bankName: bank, accountNumber: num.trim(), accountName: acct.trim() };
    setAgentBank(id, details);
    saveAgentBank(id, details);
    showToast('Account details saved');
    onClose();
  };
  return (
    <Sheet
      back
      title={cur ? 'Change account details' : 'Add account details'}
      subtitle={`${name} · for monthly payouts`}
      onClose={onClose}
      tall
      footer={
        <div className="flex gap-2">
          {cur && (
            <button type="button" onClick={() => (setAgentBank(id, null), saveAgentBank(id, null), showToast('Account details removed'), onClose())} className="press min-h-12 rounded-2xl bg-[#fdecec] px-4 text-[14.5px] font-semibold text-[#b42318]">
              Remove
            </button>
          )}
          <button type="button" onClick={save} className="press min-h-12 flex-1 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
            Save account details
          </button>
        </div>
      }
    >
      <div className="px-1 pb-2">
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-brand-50 p-3">
          <Sticker name="coin" size={36} />
          <p className="text-[12.5px] leading-snug text-brand-800">Used only by the company for the agent’s monthly payout. It is never shown on the Referrer Portal. Every change is recorded in the Audit Log.</p>
        </div>
        <p className="mb-1.5 text-[14px] font-semibold text-ink">Bank {bank && <span className="font-normal text-brand-700">· {bank}</span>}</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all Nigerian banks" aria-label="Search banks" className={inputCls} />
        <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-page p-1">
          {banks.map((b) => (
            <button key={b} type="button" onClick={() => (setBank(b), setQ(''))} className={`press flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] ${bank === b ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-ink'}`}>
              {b} {bank === b && <Check size={16} />}
            </button>
          ))}
          {!banks.length && <p className="px-3 py-3 text-[13px] text-muted">No bank matches “{q}”.</p>}
        </div>
        {tried && errs.bank && <p className="mt-1 text-[12.5px] font-medium text-[#d93036]">{errs.bank}</p>}
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Account number</span>
          <input value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10 digits" className={inputCls} />
          {tried && errs.num && <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{errs.num}</span>}
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Account name</span>
          <input value={acct} onChange={(e) => setAcct(onlyName(e.target.value))} autoCapitalize="words" placeholder="Name on the bank account" className={inputCls} />
          {tried && errs.acct && <span className="mt-1 block text-[12.5px] font-medium text-[#d93036]">{errs.acct}</span>}
        </label>
      </div>
    </Sheet>
  );
}

/* ─────────────── message / thank you / notice to agents ─────────────── */

type Kind = 'message' | 'thanks' | 'notice';
const KINDS: { id: Kind; label: string; sticker: 'envelope' | 'trophy' | 'megaphone' }[] = [
  { id: 'message', label: 'Message', sticker: 'envelope' },
  { id: 'thanks', label: 'Thank you', sticker: 'trophy' },
  { id: 'notice', label: 'Notice', sticker: 'megaphone' },
];
type Picked = { id: number; name: string; phone: string };
type Mode = 'one' | 'all' | 'pick';

/**
 * Compose an announcement. Who sees it: only this agent, every agent of the
 * branch, or agents the admin chooses (search, by hospital). "Also send in
 * chat" puts the same words in each chosen agent's chat with the admin, so
 * the announcement can say "Read and reply".
 */
export function ComposeSheet({ audience, branchId, preset, draft, onClose }: { audience: AnnouncementAudience; branchId: string; preset: Kind; draft?: { title: string; text: string }; onClose: () => void }) {
  const { user } = useCompany();
  const { showToast } = useNav();
  const branch = getBranch(branchId);
  const agentAud = audience.kind === 'agent' ? audience : null;
  const [mode, setMode] = useState<Mode>(agentAud ? 'one' : 'all');
  const [picked, setPicked] = useState<Picked[]>(audience.kind === 'agents' ? audience.agents : agentAud ? [{ id: agentAud.agentId, name: agentAud.name, phone: agentAud.phone }] : []);
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<Kind>(preset);
  const who = agentAud ? firstName(agentAud.name) : '';
  const template = (k: Kind) =>
    draft ??
    (k === 'thanks'
      ? { title: agentAud && mode === 'one' ? `Thank you, ${who}!` : 'Thank you for your referrals', text: `We appreciate every patient you trust us with at ${branch?.name ?? 'our'} branch. Thank you for working with Silhouette.` }
      : k === 'message'
        ? { title: 'The Admin sent you a message', text: '' }
        : { title: '', text: '' });
  const [title, setTitle] = useState(template(preset).title);
  const [text, setText] = useState(template(preset).text);
  const [inChat, setInChat] = useState(true);
  const [tried, setTried] = useState(false);
  const money = moneyWordsIn(`${title} ${text}`);
  const problem = !title.trim() ? 'Add a short title.' : !text.trim() ? 'Write the message.' : money.length ? `The Referrer Portal never shows money. Remove: ${money.join(', ')}.` : mode === 'pick' && !picked.length ? 'Choose at least one agent.' : '';
  const pickKind = (k: Kind) => {
    setKind(k);
    const t = template(k);
    setTitle(t.title);
    setText(t.text);
  };
  const personal = mode === 'one' || mode === 'pick';
  const sendLabel = mode === 'one' ? `Send to ${who}` : mode === 'all' ? `Send to all ${branch?.name ?? ''} agents` : `Send to ${picked.length} agent${picked.length === 1 ? '' : 's'}`;
  const send = async () => {
    setTried(true);
    if (problem) return;
    const aud: AnnouncementAudience = mode === 'one' && agentAud ? agentAud : mode === 'pick' ? { kind: 'agents', branchId, agents: picked } : { kind: 'branch', branchId, branchName: branch?.name ?? branchId };
    sendAnnouncement({ from: { name: user.name, role: 'Company Admin' }, audience: aud, kind, title: title.trim(), text: text.trim(), replyInChat: personal && inChat });
    if (personal && inChat) {
      const ids = mode === 'one' && agentAud ? [agentAud.agentId] : picked.map((p) => p.id);
      for (const pid of ids) await postText(agentConvId(pid), `${title.trim()}\n\n${text.trim()}`);
    }
    showToast(mode === 'one' ? `Sent to ${who}${inChat ? ', in chat and their announcement bar' : "'s announcement bar"}` : mode === 'pick' ? `Sent to ${picked.length} agent${picked.length === 1 ? '' : 's'}` : `Announced to every PR agent at ${branch?.name ?? ''}`);
    onClose();
  };
  const look = KINDS.find((k) => k.id === kind)!;
  const modes: { id: Mode; label: string }[] = [...(agentAud ? [{ id: 'one' as const, label: `Only ${who}` }] : []), { id: 'all', label: `All ${branch?.name ?? ''}` }, { id: 'pick', label: 'Choose agents' }];
  const chooseMode = (m: Mode) => {
    setMode(m);
    if (m === 'pick' && !picked.length) setPicking(true);
  };
  return (
    <Sheet
      back
      title={kind === 'thanks' ? 'Say thank you' : kind === 'message' ? 'Send a message' : 'Send a notice'}
      subtitle="Shows in the agents’ announcement bar"
      onClose={onClose}
      tall
      footer={
        <button type="button" onClick={send} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          <Send size={18} /> {sendLabel}
        </button>
      }
    >
      <div className="px-1 pb-2">
        <p className="mb-1.5 text-[14px] font-semibold text-ink">Who should see it?</p>
        <div className={`mb-2 grid gap-1 rounded-2xl bg-page p-1 ${modes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} role="tablist" aria-label="Send to">
          {modes.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => chooseMode(m.id)} className={`press min-h-10 truncate rounded-xl px-2 text-[13px] font-semibold ${mode === m.id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'pick' && (
          <button type="button" onClick={() => setPicking(true)} className="press mb-3 flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line">
            <span className="flex -space-x-2">
              {picked.slice(0, 4).map((p) => (
                <span key={p.id} className="rounded-full ring-2 ring-white">
                  <AgentAvatar id={p.id} name={p.name} phone={p.phone} size={32} />
                </span>
              ))}
              {!picked.length && <Users size={22} className="text-brand-600" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{picked.length ? `${picked.length} agent${picked.length === 1 ? '' : 's'} chosen` : 'Choose who sees it'}</span>
              <span className="block truncate text-[12px] text-muted">{picked.length ? picked.map((p) => p.name).join(', ') : 'Search by name or pick a whole hospital'}</span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-brand-600">{picked.length ? 'Change' : 'Choose'}</span>
          </button>
        )}
        {mode === 'all' && <p className="mb-3 px-1 text-[12px] text-muted">Every PR agent of {branch?.name} branch sees it.</p>}

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
        <div className="mb-3">
          <LongText label="Message" value={text} onChange={setText} max={280} minRows={4} placeholder={kind === 'message' ? 'Write your message. They can reply in chat.' : 'What should they know?'} hint="Press Enter for a new line." />
        </div>

        {personal && (
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
            <span className="mt-2.5 inline-flex rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-700">{personal && inChat ? 'Read and reply' : 'Reply to Admin'}</span>
          </div>
          <Sticker name={look.sticker} size={104} className="absolute -bottom-2 -right-2" />
        </div>
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">The Referrer Portal never shows money, so commission, payments and prices can’t be announced there. Don’t include patient details.</p>
      </div>
      {picking && (
        <AgentPicker
          branchId={branchId}
          value={picked}
          onDone={(v) => {
            setPicked(v);
            setPicking(false);
            setMode(v.length ? 'pick' : agentAud ? 'one' : 'all');
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </Sheet>
  );
}

/** Choose which agents see an announcement: search, filter by hospital or recent referrals, select several. */
function AgentPicker({ branchId, value, onDone, onClose }: { branchId: string; value: Picked[]; onDone: (v: Picked[]) => void; onClose: () => void }) {
  const { agents } = useCompany();
  const [q, setQ] = useState('');
  const [hosp, setHosp] = useState<string | null>(null);
  const [recent, setRecent] = useState(false);
  const [sel, setSel] = useState<Map<number, Picked>>(() => new Map(value.map((p) => [p.id, p])));
  const [shown, setShown] = useState(50);
  const mine = branchId === agentBranchId() ? agents : [];
  const month = useMemo(() => {
    const to = TODAY;
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return new Set(agentRanking([branchId], { from, to, days: diffDays(from, to) + 1 }).map((a) => a.id));
  }, [branchId]);
  const hospitals = useMemo(() => {
    const n = new Map<string, number>();
    for (const a of mine) {
      const h = a.hospital.trim().toUpperCase();
      if (h) n.set(h, (n.get(h) ?? 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [mine]);
  const t = norm(q);
  const list = mine.filter((a) => (!hosp || a.hospital.trim().toUpperCase() === hosp) && (!recent || month.has(a.id)) && (!t || norm(`${a.name} ${a.hospital} ${a.phone}`).includes(t))).sort((a, b) => a.name.localeCompare(b.name));
  const toPick = (a: (typeof mine)[number]): Picked => ({ id: a.id, name: a.name, phone: a.phone !== 'N/A' ? a.phone : '' });
  const toggle = (a: (typeof mine)[number]) =>
    setSel((m) => {
      const n = new Map(m);
      if (n.has(a.id)) n.delete(a.id);
      else n.set(a.id, toPick(a));
      return n;
    });
  const allShown = list.length > 0 && list.every((a) => sel.has(a.id));
  const toggleAll = () =>
    setSel((m) => {
      const n = new Map(m);
      if (allShown) list.forEach((a) => n.delete(a.id));
      else list.forEach((a) => n.set(a.id, toPick(a)));
      return n;
    });
  return (
    <Sheet
      back
      title="Choose agents"
      subtitle={`${sel.size} chosen · ${formatCount(mine.length)} agents at ${getBranch(branchId)?.name ?? ''}`}
      onClose={onClose}
      tall
      search={{ value: q, onChange: setQ, placeholder: 'Search name, hospital or phone' }}
      footer={
        <button type="button" onClick={() => onDone([...sel.values()])} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          <Check size={18} /> Done, {sel.size} chosen
        </button>
      }
    >
      <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1">
        <button type="button" onClick={() => setRecent((v) => !v)} aria-pressed={recent} className={`press min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${recent ? 'bg-violet text-white' : 'bg-tint-purple text-violet'}`}>
          Referred this month
        </button>
        <button type="button" onClick={() => setHosp(null)} aria-pressed={!hosp} className={`press min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${!hosp ? 'bg-brand-600 text-white' : 'bg-page text-ink-2'}`}>
          All hospitals
        </button>
        {hospitals.map(([h, n]) => (
          <button key={h} type="button" onClick={() => setHosp(hosp === h ? null : h)} aria-pressed={hosp === h} className={`press min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold ${hosp === h ? 'bg-brand-600 text-white' : 'bg-page text-ink-2'}`}>
            {h} <span className={hosp === h ? 'text-white/80' : 'text-muted'}>{n}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={toggleAll} disabled={!list.length} className="press mb-2 flex w-full items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2.5 text-left disabled:opacity-40">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${allShown ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-300 bg-white'}`}>{allShown && <Check size={15} strokeWidth={3} />}</span>
        <span className="text-[14px] font-semibold text-brand-700">
          {allShown ? 'Unselect' : 'Select'} all {formatCount(list.length)} shown{hosp ? ` from ${hosp}` : ''}
        </span>
      </button>
      <ul className="space-y-1">
        {list.slice(0, shown).map((a) => {
          const on = sel.has(a.id);
          return (
            <li key={a.id}>
              <button type="button" onClick={() => toggle(a)} aria-pressed={on} className={`press flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left ${on ? 'bg-brand-50' : 'hover:bg-page'}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'}`}>{on && <Check size={15} strokeWidth={3} />}</span>
                <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{a.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {hospitalOf(a.hospital)}
                    {month.has(a.id) ? ' · referred this month' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + 50)} className="press mx-auto mt-2 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({formatCount(list.length - shown)} more)
        </button>
      )}
      {!list.length && <p className="py-8 text-center text-[14px] text-muted">No agent matches.</p>}
    </Sheet>
  );
}
