/**
 * Announcements (owner, 2026-11-26): the Company Admin and Branch Managers
 * post announcements with a time frame (start and end, so they can be
 * scheduled and never stay for ever) to PR agents, Front Desk, Branch
 * Managers and the Company Admin, for every branch or one (a manager: their
 * own branch). Everyone sees the live ones on their dashboard; this page
 * lists everything created (Live, Scheduled, Ended), with End now and Delete.
 */
import { useMemo, useState } from 'react';
import { CalendarClock, Megaphone, Plus, Trash2, X } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES, getBranch } from '@company/data/company';
import { logAudit } from '@company/services/audit';
import { ROLE_TEXT, endAnnouncement, liveState, moneyWordsIn, removeAnnouncement, sendAnnouncement, staffAnnouncements, useAnnouncements, type AdminAnnouncement, type AnnouncementRole, type LiveState } from '@/domain/announcements';
import { useNav } from '@/app/store';
import { Sticker } from '@/ui/kit';
import { Sheet } from './ui';
import { AdminTopBar, EmptyCard, PageGlow } from './kit';
import { PageTitle } from './branchFirst';
import { LongText } from './fields';
import { FieldErr, FieldLabel, inputCls } from './prManage';
import { useStaffChrome } from '@/staff/chrome';

const ROLES: AnnouncementRole[] = ['agents', 'frontdesk', 'manager', 'admin'];
const STATE_TEXT: Record<LiveState, string> = { live: 'Live', scheduled: 'Scheduled', ended: 'Ended' };
const STATE_PILL: Record<LiveState, string> = { live: 'bg-[#e9f9ef] text-good-ink', scheduled: 'bg-[#eef4ff] text-brand-700', ended: 'bg-page text-muted' };
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const localInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Who this person is, for announcements. */
function useWho() {
  const { user } = useCompany();
  const { branchId } = useStaffChrome();
  const role: AnnouncementRole = user.role === 'Company Admin' ? 'admin' : user.role === 'Branch Manager' ? 'manager' : 'frontdesk';
  return { user, role, branchId: branchId || null, canPost: role === 'admin' || role === 'manager' };
}

const periodText = (a: AdminAnnouncement) => `${fmt(a.startsAt ?? a.at)} to ${a.endsAt ? fmt(a.endsAt) : '30 days later'}`;
const audienceText = (a: AdminAnnouncement) => {
  const au = a.audience;
  if (au.kind === 'broadcast') return `${au.roles.map((r) => ROLE_TEXT[r]).join(', ')} · ${au.branchId === 'all' ? 'all branches' : `${au.branchName} branch`}`;
  if (au.kind === 'branch') return `PR agents · ${au.branchName} branch`;
  if (au.kind === 'agent') return `PR agent: ${au.name}`;
  return `${au.agents.length} PR agents`;
};

/* ─────────────── page ─────────────── */

export function AnnouncementsPage() {
  const all = useAnnouncements();
  const { user, role, branchId, canPost } = useWho();
  const [tab, setTab] = useState<LiveState>('live');
  const [creating, setCreating] = useState(false);
  // Admin: everything. Manager: their branch's and their own. Front Desk: what is meant for them.
  const mine = useMemo(
    () =>
      all.filter((a) => {
        if (role === 'admin') return true;
        if (a.from.name === user.name) return true;
        const au = a.audience;
        if (au.kind !== 'broadcast') return role === 'manager' && 'branchId' in au && au.branchId === branchId;
        return (au.branchId === 'all' || au.branchId === branchId) && (role === 'manager' || au.roles.includes(role));
      }),
    [all, role, user.name, branchId],
  );
  const by = (st: LiveState) => mine.filter((a) => liveState(a) === st);
  const list = by(tab).sort((a, b) => (b.startsAt ?? b.at).localeCompare(a.startsAt ?? a.at));
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle
          title="Announcements"
          sub={canPost ? 'Post to PR agents and staff, with a start and an end' : 'From the Company Admin and your Branch Manager'}
          action={
            canPost && (
              <button type="button" onClick={() => setCreating(true)} aria-label="New announcement" className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand-600 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
                <Plus size={18} /> New
              </button>
            )
          }
        />
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 ring-1 ring-line" role="tablist">
          {(['live', 'scheduled', 'ended'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`press min-h-10 rounded-xl text-[13.5px] font-semibold ${tab === k ? 'bg-brand-600 text-white' : 'text-ink-2'}`}>
              {STATE_TEXT[k]} {by(k).length}
            </button>
          ))}
        </div>
        {list.length ? (
          <ul className="space-y-2.5">
            {list.map((a) => (
              <li key={a.id}>
                <AnnouncementCard a={a} manage={canPost && (role === 'admin' || a.from.name === user.name)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyCard sticker="megaphone" text={tab === 'live' ? 'No announcement is showing right now.' : tab === 'scheduled' ? 'Nothing scheduled.' : 'No ended announcements.'} />
        )}
      </div>
      {creating && <CreateSheet onClose={() => setCreating(false)} onCreated={(st) => setTab(st)} />}
    </div>
  );
}

function AnnouncementCard({ a, manage }: { a: AdminAnnouncement; manage: boolean }) {
  const { showToast } = useNav();
  const st = liveState(a);
  return (
    <div className="rounded-[20px] bg-white p-3.5 shadow-[0_6px_18px_rgba(30,74,160,0.06)] ring-1 ring-line/70">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff4e0]">
          <Sticker name="megaphone" size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <b className="min-w-0 text-[15px] leading-snug text-ink">{a.title}</b>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATE_PILL[st]}`}>{STATE_TEXT[st]}</span>
          </span>
          <span className="mt-0.5 block whitespace-pre-wrap text-[13.5px] leading-snug text-ink-2">{a.text}</span>
          <span className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            <CalendarClock size={13} className="shrink-0" /> {periodText(a)}
          </span>
          <span className="block text-[12px] text-muted">
            To {audienceText(a)} · by {a.from.name}, {a.from.role}
          </span>
        </span>
      </div>
      {manage && st !== 'ended' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              endAnnouncement(a.id);
              logAudit({ category: 'Settings', action: 'Announcement ended early', record: a.title, details: audienceText(a), branchId: null });
              showToast('Announcement ended');
            }}
            className="press flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-page text-[13.5px] font-semibold text-ink-2 ring-1 ring-line"
          >
            <X size={15} /> End now
          </button>
          <button
            type="button"
            onClick={() => {
              removeAnnouncement(a.id);
              logAudit({ category: 'Settings', action: 'Announcement deleted', record: a.title, details: audienceText(a), branchId: null });
              showToast('Announcement deleted');
            }}
            className="press grid min-h-10 w-12 place-items-center rounded-xl bg-[#fdecec] text-[#b42318]"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── create ─────────────── */

function CreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (st: LiveState) => void }) {
  const { user, role, branchId } = useWho();
  const { showToast } = useNav();
  const now = new Date();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [roles, setRoles] = useState<AnnouncementRole[]>(['agents']);
  const [branch, setBranch] = useState<string>(role === 'manager' && branchId ? branchId : 'all');
  const [start, setStart] = useState(localInput(now));
  const [end, setEnd] = useState(localInput(new Date(now.getTime() + 7 * 86_400_000)));
  const [tried, setTried] = useState(false);
  const money = roles.includes('agents') ? moneyWordsIn(`${title} ${text}`) : [];
  const errs = {
    title: title.trim().length < 3 ? 'Give it a short title.' : null,
    text: text.trim().length < 5 ? 'Write the announcement.' : null,
    roles: roles.length ? null : 'Choose who sees it.',
    end: !end ? 'Choose when it ends.' : new Date(end) <= new Date(start) ? 'It must end after it starts.' : null,
    money: money.length ? `PR agents never see money words in announcements: ${money.join(', ')}.` : null,
  };
  const ok = Object.values(errs).every((e) => !e);
  const quick = (days: number) => setEnd(localInput(new Date(new Date(start).getTime() + days * 86_400_000)));
  const save = () => {
    if (!ok) return setTried(true);
    const b = branch === 'all' ? null : getBranch(branch);
    const a = sendAnnouncement({
      from: { name: user.name, role: user.role },
      audience: { kind: 'broadcast', branchId: branch, branchName: b?.name ?? 'All', roles },
      kind: 'notice',
      title: title.trim(),
      text: text.trim(),
      replyInChat: false,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    } as Parameters<typeof sendAnnouncement>[0]);
    logAudit({ category: 'Settings', action: liveState(a) === 'scheduled' ? 'Announcement scheduled' : 'Announcement posted', record: a.title, details: `${audienceText(a)} · ${periodText(a)}`, branchId: branch === 'all' ? null : branch });
    showToast(liveState(a) === 'scheduled' ? `Scheduled for ${fmt(a.startsAt!)}` : 'Announcement is live');
    onCreated(liveState(a));
    onClose();
  };
  return (
    <Sheet title="New announcement" subtitle="It shows from the start to the end you choose" onClose={onClose} tall footer={<button type="button" onClick={save} className="press min-h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">{new Date(start) > new Date() ? 'Schedule announcement' : 'Post announcement'}</button>}>
      <div className="space-y-4 px-1 pb-3">
        <label className="block">
          <FieldLabel label="Title" required />
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 70))} placeholder="For example: Open on Sunday for the health week" className={inputCls(tried ? errs.title : null)} />
          {tried && <FieldErr msg={errs.title} />}
        </label>
        <LongText label="Announcement" required value={text} onChange={setText} max={500} minRows={3} placeholder={'Write it in plain words.\nPress Enter for a new line.'} error={tried ? errs.text : null} />
        <div>
          <FieldLabel label="Who sees it" required />
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const on = roles.includes(r);
              return (
                <button key={r} type="button" aria-pressed={on} onClick={() => setRoles((x) => (on ? x.filter((y) => y !== r) : [...x, r]))} className={`press min-h-11 rounded-2xl px-3 text-left text-[13.5px] font-semibold ${on ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500' : 'bg-[#f8fafd] text-ink-2 ring-1 ring-[#e3eaf4]'}`}>
                  {ROLE_TEXT[r]}
                </button>
              );
            })}
          </div>
          {tried && <FieldErr msg={errs.roles} />}
          {money.length > 0 && <FieldErr msg={errs.money} />}
        </div>
        <div>
          <FieldLabel label="Branch" required />
          {role === 'manager' ? (
            <p className="rounded-2xl bg-page px-3.5 py-3 text-[14px] text-ink">{getBranch(branchId ?? '')?.name ?? ''} branch (yours)</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[{ id: 'all', name: 'All branches' }, ...ACTIVE_BRANCHES.map((b) => ({ id: b.id, name: `${b.name} branch` }))].map((b) => (
                <button key={b.id} type="button" aria-pressed={branch === b.id} onClick={() => setBranch(b.id)} className={`press min-h-10 rounded-full px-3.5 text-[13.5px] font-semibold ${branch === b.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-[20px] bg-[#f6f9ff] p-3.5 ring-1 ring-[#e3eaf4]">
          <p className="mb-2 flex items-center gap-1.5 text-[14.5px] font-bold text-ink">
            <CalendarClock size={16} className="text-brand-600" /> Time frame
          </p>
          <div className="grid grid-cols-1 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[12.5px] text-muted">Starts</span>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls()} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] text-muted">Ends</span>
              <input type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputCls(tried ? errs.end : null)} />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(
              [
                [1, '1 day'],
                [3, '3 days'],
                [7, '1 week'],
                [14, '2 weeks'],
                [30, '1 month'],
              ] as const
            ).map(([d, l]) => (
              <button key={d} type="button" onClick={() => quick(d)} className="press min-h-8 rounded-full bg-white px-3 text-[12.5px] font-semibold text-ink-2 ring-1 ring-line">
                {l}
              </button>
            ))}
          </div>
          {tried && <FieldErr msg={errs.end} />}
          <p className="mt-2 text-[12px] text-muted">{new Date(start) > new Date() ? 'It is scheduled: it appears at the start time.' : 'It appears as soon as you post it.'} It disappears by itself at the end.</p>
        </div>
      </div>
    </Sheet>
  );
}

/* ─────────────── dashboard banner ─────────────── */

/** Live announcements for the person's role, on their dashboard. */
export function LiveAnnouncements({ onManage }: { onManage?: () => void }) {
  const all = useAnnouncements();
  const { role, branchId } = useWho();
  const live = staffAnnouncements(all, role, branchId);
  const [i, setI] = useState(0);
  if (!live.length) return null;
  const a = live[i % live.length]!;
  return (
    <section className="mb-4 overflow-hidden rounded-[22px] bg-linear-to-br from-[#fffaf0] to-[#fdeccb] p-4 ring-1 ring-[#f6e1b3]">
      <div className="flex items-start gap-3">
        <Megaphone size={20} className="mt-0.5 shrink-0 text-[#b45309]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <b className="min-w-0 truncate text-[15px] text-[#4a3208]">{a.title}</b>
            {live.length > 1 && (
              <button type="button" onClick={() => setI((x) => x + 1)} className="press shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11.5px] font-semibold text-[#6b4a12]">
                {(i % live.length) + 1} of {live.length}
              </button>
            )}
          </span>
          <span className="mt-0.5 block whitespace-pre-wrap text-[13.5px] leading-snug text-[#5a3d0c]">{a.text}</span>
          <span className="mt-1.5 block text-[11.5px] text-[#8a6a2c]">
            {a.from.name}, {a.from.role} · until {fmt(a.endsAt ?? a.at)}
          </span>
        </span>
      </div>
      {onManage && (
        <button type="button" onClick={onManage} className="press mt-2.5 text-[12.5px] font-semibold text-[#6b4a12]">
          All announcements
        </button>
      )}
    </section>
  );
}
