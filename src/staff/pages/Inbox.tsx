/**
 * Staff Inbox (owner, 2026-11-25): the chat icon next to the bell. The
 * Company Admin, the branch team, and PR agents (searchable; "New chat" to
 * start one). Same rows and chat screens as the admin and the PR agent app.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, SquarePen, Users } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { useInbox, type InboxRow } from '@/domain/chat';
import { conversationById } from '@/data/team';
import { ScreenHeader, SearchField, Subtitle } from '@/ui/kit';
import { ConversationRow, InboxSection } from '@/screens/chat/Inbox';
import { Sheet } from '@/admin/ui';
import { StickyTools } from '@/admin/kit';
import { AgentAvatar } from '@/admin/agentPhotos';
import { useRole } from '@/domain/role';
import { STAFF_AGENT_PREFIX, staffAgentId, useStaffConversations } from '../chat';
import { useStaffChrome } from '../chrome';

export function StaffInbox() {
  const { branchId } = useStaffChrome();
  const { navigate } = useCompany();
  const role = useRole();
  const branch = getBranch(branchId);
  const { fixed, agentConvs } = useStaffConversations(branchId);
  const fixedIds = useMemo(() => fixed.map((c) => c.id), [fixed]);
  const { inboxes, direct } = useInbox(fixedIds, STAFF_AGENT_PREFIX);
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState(false);
  const t = q.trim().toLowerCase();
  const match = (r: InboxRow) => {
    if (!t) return true;
    const c = conversationById(r.id);
    return !!c && [c.name, c.role, ...c.members.map((m) => m.name), r.last?.text ?? ''].join(' ').toLowerCase().includes(t);
  };
  const open = (id: string) => navigate(`/branch/${branchId}/messages/${id}`);
  const found = t ? agentConvs.filter((c) => !direct.some((d) => d.id === c.id) && `${c.name} ${c.role}`.toLowerCase().includes(t)).slice(0, 8) : [];
  const company = inboxes.filter((r) => r.id === fixedIds[0] && match(r));
  const team = inboxes.filter((r) => r.id === fixedIds[1] && match(r));

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
      <Subtitle>{role === 'frontdesk' ? `Message the Company Admin, your Branch Manager or a PR agent · ${branch?.name ?? ''} branch` : `Message the Company Admin, the front desk on duty or a PR agent · ${branch?.name ?? ''} branch`}</Subtitle>
      <StickyTools>
        <div className="mb-2">
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats and PR agents..." aria-label="Search chats" />
        </div>
      </StickyTools>

      {company.length > 0 && (
        <InboxSection title="Head office">
          {company.map((r) => (
            <ConversationRow key={r.id} row={r} onOpen={() => open(r.id)} />
          ))}
        </InboxSection>
      )}
      {team.length > 0 && (
        <InboxSection title={`${branch?.name ?? ''} branch team`}>
          {team.map((r) => (
            <ConversationRow key={r.id} row={r} onOpen={() => open(r.id)} />
          ))}
        </InboxSection>
      )}
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
              <AgentAvatar id={Number(c.id.slice(STAFF_AGENT_PREFIX.length))} name={c.name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                <span className="block truncate text-[12.5px] text-muted">{c.role}</span>
              </span>
              <ChevronRight size={18} className="text-faint" />
            </button>
          ))}
        </InboxSection>
      )}
      {t && !company.length && !team.length && !direct.some(match) && !found.length && <p className="py-8 text-center text-[14px] text-muted">No chats or PR agents match “{q}”.</p>}

      <button type="button" onClick={() => setPicker(true)} className="press mt-1 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-left">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          <Users size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Start a new chat</span>
          <span className="text-[13px] text-muted">Any PR agent who refers patients to the branch</span>
        </span>
        <ChevronRight size={19} className="text-muted" />
      </button>

      {picker && <NewChat branchId={branchId} onClose={() => setPicker(false)} onPick={(id) => (setPicker(false), open(id))} />}
    </>
  );
}

function NewChat({ branchId, onClose, onPick }: { branchId: string; onClose: () => void; onPick: (id: string) => void }) {
  const { agentConvs } = useStaffConversations(branchId);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(40);
  const t = q.trim().toLowerCase();
  const list = useMemo(() => [...agentConvs].sort((a, b) => a.name.localeCompare(b.name)).filter((c) => !t || `${c.name} ${c.role}`.toLowerCase().includes(t)), [agentConvs, t]);
  return (
    <Sheet title="New chat" subtitle="Message a PR agent" onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Search PR agent or hospital' }}>
      {list.slice(0, shown).map((c) => {
        const id = Number(c.id.slice(STAFF_AGENT_PREFIX.length));
        return (
          <button key={c.id} type="button" onClick={() => onPick(staffAgentId(id))} className="press flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left hover:bg-page">
            <AgentAvatar id={id} name={c.name} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
              <span className="block truncate text-[12.5px] text-muted">{c.role}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </button>
        );
      })}
      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + 40)} className="press mx-auto mt-2 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({list.length - shown} more)
        </button>
      )}
      {!list.length && <p className="py-8 text-center text-[14px] text-muted">No PR agent matches “{q}”.</p>}
    </Sheet>
  );
}
