/**
 * Inbox (owner, 2026-11-24): the agent's branch team, opened from the inbox
 * icon on Home (beside notifications) or Menu, Inbox.
 * Always three inboxes: Front Desk (shared; the agent sees and messages
 * whoever is on duty, never a chosen person), Branch Manager, Admin.
 */
import { useState } from 'react';
import { ChevronRight, SquarePen, Users } from 'lucide-react';
import { useApp } from '@/app/store';
import { BRANCH } from '@/config/org';
import { INBOXES, conversationById, type Conversation } from '@/data/team';
import { previewOf, useInbox, type ChatMsg, type InboxRow } from '@/domain/chat';
import { ConvAvatar } from '@/ui/avatars';
import { ScreenHeader, SearchField, Subtitle } from '@/ui/kit';

function when(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function lastLine(c: Conversation, m?: ChatMsg) {
  if (!m) return c.shared ? 'Message whoever is on duty' : 'No messages yet. Say hello';
  if (m.deleted) return m.from === 'me' ? 'You deleted this message' : 'This message was deleted';
  const who = m.from === 'me' ? 'You: ' : c.shared && m.sender ? `${m.sender.split(' ')[0]}: ` : '';
  return who + previewOf(m).replace(/\s+/g, ' ');
}

const TAG: Record<Conversation['kind'], string> = { frontdesk: 'Shared', manager: 'Manager', admin: 'Admin' };

export function Inbox() {
  const { navigate } = useApp();
  const { inboxes } = useInbox();
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState(false);
  const t = q.trim().toLowerCase();
  const match = (r: InboxRow) => {
    if (!t) return true;
    const c = conversationById(r.id)!;
    return [c.name, c.role, ...c.members.map((m) => m.name), r.last?.text ?? ''].join(' ').toLowerCase().includes(t);
  };
  const fixed = inboxes.filter(match);

  return (
    <>
      <ScreenHeader
        title="Inbox"
        right={
          <button type="button" onClick={() => setPicker(true)} aria-label="New chat" className="press grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
            <SquarePen size={19} />
          </button>
        }
      />
      <Subtitle>Your team at {BRANCH.label}. Message the front desk, your manager or the admin.</Subtitle>
      <div className="mb-4">
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats and people..." aria-label="Search chats" />
      </div>

      <Section title="Branch inboxes">
        {fixed.map((r) => (
          <Row key={r.id} row={r} onOpen={() => navigate(`/messages/${r.id}`)} />
        ))}
      </Section>

      {t && fixed.length === 0 && <p className="py-8 text-center text-[14px] text-muted">No chats match “{q}”.</p>}

      <button type="button" onClick={() => setPicker(true)} className="press mt-1 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-left">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          <Users size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Start a new chat</span>
          <span className="text-[13px] text-muted">Front desk on duty, branch manager or admin</span>
        </span>
        <ChevronRight size={19} className="text-muted" />
      </button>
      <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-muted">The team list comes from Staff Management in the STANLEY desktop app, so new staff appear here automatically.</p>

      {picker && <PeoplePicker onClose={() => setPicker(false)} onPick={(id) => (setPicker(false), navigate(`/messages/${id}`))} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ row, onOpen }: { row: InboxRow; onOpen: () => void }) {
  const c = conversationById(row.id)!;
  return (
    <button type="button" onClick={onOpen} className="press flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
      <ConvAvatar conv={c} size={52} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[16px] font-bold text-ink">{c.name}</span>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${c.kind === 'frontdesk' ? 'bg-[#e6f7ee] text-[#16794a]' : c.kind === 'admin' ? 'bg-[#efe7ff] text-violet' : c.kind === 'manager' ? 'bg-brand-100 text-brand-700' : 'bg-page text-ink-2'}`}>{TAG[c.kind]}</span>
          </span>
          <span className={`shrink-0 text-[12.5px] ${row.unread ? 'font-semibold text-brand-600' : 'text-muted'}`}>{when(row.last?.at)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">{c.role}</span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-[14px] ${row.unread ? 'font-semibold text-ink' : 'text-ink-2'}`}>{lastLine(c, row.last)}</span>
          {row.unread > 0 && <span className="grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-[12px] font-bold text-white">{row.unread}</span>}
        </span>
      </span>
    </button>
  );
}

/** Choose who to message: the front desk person on duty, the branch manager or the admin. */
function PeoplePicker({ onClose, onPick }: { onClose: () => void; onPick: (convId: string) => void }) {
  const NOTE: Record<Conversation['kind'], string> = {
    frontdesk: 'Front desk, on duty now. Patients arriving, payments, results',
    manager: 'Branch manager. Approvals, problems, anything urgent',
    admin: 'Company admin. Commission, payouts and your account',
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[26px] bg-white px-2 pb-[max(14px,var(--safe-bottom))] pt-3 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        <p className="px-3 text-[19px] font-bold text-ink">New chat</p>
        <p className="mb-2 px-3 text-[13.5px] text-muted">Who do you want to message at {BRANCH.label}?</p>
        {INBOXES.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c.id)} className="press flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left hover:bg-page">
            <ConvAvatar conv={c} size={52} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold text-ink">{c.kind === 'frontdesk' && c.face ? c.face.name : c.name}</span>
              <span className="block text-[13px] leading-snug text-muted">{NOTE[c.kind]}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </button>
        ))}
        <p className="px-3 pt-2 text-[12.5px] leading-relaxed text-muted">Front desk staff work in shifts, so you always reach whoever is on duty. Earlier replies keep the name of who sent them.</p>
      </div>
    </div>
  );
}
