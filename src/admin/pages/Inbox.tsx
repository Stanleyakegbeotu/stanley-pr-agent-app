/**
 * Admin Inbox (owner, 2026-11-25): the PR agent app's inbox pattern. Each
 * branch has its Front Desk (whoever is on duty) and Branch Manager; chats
 * with PR agents are listed under them. "New chat" picks a branch team inbox
 * or any PR agent (searchable).
 */
import { useMemo, useState } from 'react';
import { ChevronRight, SquarePen, Users } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ACTIVE_BRANCHES } from '@company/data/company';
import { useInbox, type InboxRow } from '@/domain/chat';
import { conversationById } from '@/data/team';
import { ConvAvatar } from '@/ui/avatars';
import { InitialsAvatar, ScreenHeader, SearchField, Subtitle } from '@/ui/kit';
import { ConversationRow, InboxSection } from '@/screens/chat/Inbox';
import { AGENT_PREFIX, agentConvId, frontDeskId, managerId, useAdminConversations } from '../chat';
import { Sheet } from '../ui';

export function AdminInbox() {
  const { navigate } = useCompany();
  const { fixed, agentConvs } = useAdminConversations();
  const fixedIds = useMemo(() => fixed.map((c) => c.id), [fixed]);
  const { inboxes, direct } = useInbox(fixedIds, AGENT_PREFIX);
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState(false);
  const t = q.trim().toLowerCase();
  const match = (r: InboxRow) => {
    if (!t) return true;
    const c = conversationById(r.id);
    return !!c && [c.name, c.role, ...c.members.map((m) => m.name), r.last?.text ?? ''].join(' ').toLowerCase().includes(t);
  };
  const open = (id: string) => navigate(`/messages/${id}`);
  // Agents found by the search who have no chat yet, so the admin can start one from here.
  const found = t ? agentConvs.filter((c) => !direct.some((d) => d.id === c.id) && `${c.name} ${c.role}`.toLowerCase().includes(t)).slice(0, 8) : [];

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
      <Subtitle>Message each branch’s front desk on duty, its manager, or any PR agent.</Subtitle>
      <div className="mb-4">
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats, staff and PR agents..." aria-label="Search chats" />
      </div>

      {ACTIVE_BRANCHES.map((b) => {
        const rows = inboxes.filter((r) => (r.id === frontDeskId(b.id) || r.id === managerId(b.id)) && match(r));
        return rows.length ? (
          <InboxSection key={b.id} title={`${b.name} branch team`}>
            {rows.map((r) => (
              <ConversationRow key={r.id} row={r} onOpen={() => open(r.id)} />
            ))}
          </InboxSection>
        ) : null;
      })}

      {direct.filter(match).length > 0 && (
        <InboxSection title="PR agents">
          {direct.filter(match).map((r) => (
            <ConversationRow key={r.id} row={r} onOpen={() => open(r.id)} />
          ))}
        </InboxSection>
      )}

      {found.length > 0 && (
        <InboxSection title="Start a chat with">
          {found.map((c) => (
            <button key={c.id} type="button" onClick={() => open(c.id)} className="press flex w-full items-center gap-3.5 px-4 py-3 text-left">
              <InitialsAvatar name={c.name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                <span className="block truncate text-[12.5px] text-muted">{c.role}</span>
              </span>
              <ChevronRight size={18} className="text-faint" />
            </button>
          ))}
        </InboxSection>
      )}

      {t && !inboxes.some(match) && !direct.some(match) && !found.length && <p className="py-8 text-center text-[14px] text-muted">No chats or people match “{q}”.</p>}

      <button type="button" onClick={() => setPicker(true)} className="press mt-1 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-left">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          <Users size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Start a new chat</span>
          <span className="text-[13px] text-muted">Front desk on duty, a branch manager or a PR agent</span>
        </span>
        <ChevronRight size={19} className="text-muted" />
      </button>
      <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-muted">Front desk staff work in shifts, so you always reach whoever is on duty; earlier replies keep the name of who sent them. Staff come from Staff Management and agents from PR Management.</p>

      {picker && <NewChat onClose={() => setPicker(false)} onPick={(id) => (setPicker(false), open(id))} />}
    </>
  );
}

/** Choose who to message: a branch team inbox or any PR agent. */
function NewChat({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const { fixed, agentConvs } = useAdminConversations();
  const [tab, setTab] = useState<'team' | 'agents'>('team');
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const agents = useMemo(() => [...agentConvs].sort((a, b) => a.name.localeCompare(b.name)).filter((c) => !t || `${c.name} ${c.role}`.toLowerCase().includes(t)), [agentConvs, t]);
  const team = fixed.filter((c) => !t || `${c.name} ${c.role}`.toLowerCase().includes(t));
  const [shown, setShown] = useState(40);
  return (
    <Sheet title="New chat" subtitle="Who do you want to message?" onClose={onClose} tall={tab === 'agents'} search={{ value: q, onChange: setQ, placeholder: tab === 'team' ? 'Search branch team' : 'Search PR agent or hospital' }}>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-page p-1" role="tablist">
        {(['team', 'agents'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`press min-h-10 rounded-xl text-[14px] font-semibold ${tab === k ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>
            {k === 'team' ? 'Branch team' : `PR agents (${agentConvs.length})`}
          </button>
        ))}
      </div>
      {tab === 'team' ? (
        team.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c.id)} className="press flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left hover:bg-page">
            <ConvAvatar conv={c} size={50} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold text-ink">{c.name}</span>
              <span className="block truncate text-[13px] text-muted">{c.kind === 'frontdesk' ? `${c.role}. Patients, payments, the day’s work` : `${c.role}. Approvals, staff, anything urgent`}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </button>
        ))
      ) : (
        <>
          {agents.slice(0, shown).map((c) => (
            <button key={c.id} type="button" onClick={() => onPick(agentConvId(Number(c.id.slice(AGENT_PREFIX.length))))} className="press flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left hover:bg-page">
              <InitialsAvatar name={c.name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                <span className="block truncate text-[12.5px] text-muted">{c.role}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </button>
          ))}
          {shown < agents.length && (
            <button type="button" onClick={() => setShown((n) => n + 40)} className="press mx-auto mt-2 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
              Show more ({agents.length - shown} more)
            </button>
          )}
          {!agents.length && <p className="py-8 text-center text-[14px] text-muted">No PR agent matches “{q}”.</p>}
        </>
      )}
    </Sheet>
  );
}
