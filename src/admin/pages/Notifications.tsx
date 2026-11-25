/**
 * Admin Notifications page: the PR agent app's notification pattern (sticker
 * cards) with the desktop's notices. All / Unread, mark all as read, and each
 * notice opens its details in a slide-up card.
 */
import { useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { isRead, markAllRead, markRead, useNotifications, type Note } from '@company/services/notifications';
import { branchLabel } from '@company/services/notifications';
import { EmptyState, ScreenHeader, Sticker } from '@/ui/kit';
import { NOTE_LOOK, NoteSheet, noteWhen } from '../notes';

export function AdminNotifications() {
  const { notes } = useNotifications();
  const [show, setShow] = useState<'all' | 'unread'>('all');
  const [open, setOpen] = useState<Note | null>(null);
  const [shown, setShown] = useState(30);
  const unread = useMemo(() => notes.filter((n) => !isRead(n)), [notes]);
  const list = show === 'unread' ? unread : notes;
  return (
    <>
      <ScreenHeader
        title="Notifications"
        right={
          unread.length > 0 && (
            <button type="button" onClick={() => markAllRead(unread.map((n) => n.id))} className="press flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-brand-600 shadow-sm ring-1 ring-line">
              <CheckCheck size={17} /> Mark all read
            </button>
          )
        }
      />
      <div className="mb-4 flex gap-2">
        {(['all', 'unread'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k} className={`press min-h-10 rounded-full px-4 text-[14px] font-semibold ${show === k ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
            {k === 'all' ? `All (${notes.length})` : `Unread (${unread.length})`}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState sticker="bell" title={show === 'unread' ? 'All caught up' : 'No notifications yet'} text={show === 'unread' ? 'You have read every notification.' : 'Daily summaries, large bills and payouts appear here.'} />
      ) : (
        <ul className="space-y-3">
          {list.slice(0, shown).map((n) => {
            const look = NOTE_LOOK[n.kind];
            const fresh = !isRead(n);
            return (
              <li key={n.id}>
                <button type="button" onClick={() => (markRead(n.id), setOpen(n))} className={`card press flex w-full items-start gap-3.5 p-4 text-left ${fresh ? 'ring-1 ring-brand-200' : ''}`}>
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${look.tint}`}>
                    <Sticker name={look.sticker} size={40} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`text-[15.5px] leading-snug text-ink ${fresh ? 'font-bold' : 'font-semibold'}`}>{n.title}</span>
                      {fresh && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-ink-2">{n.summary}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${n.priority === 'high' ? 'bg-[#fdecec] text-[#b42318]' : 'bg-page text-ink-2'}`}>{look.label}</span>
                      {branchLabel(n.branchId)} · {noteWhen(n.at)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {shown < list.length && (
        <button type="button" onClick={() => setShown((x) => x + 30)} className="press mx-auto mt-4 block rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-brand-600 ring-1 ring-line">
          Show more ({list.length - shown} more)
        </button>
      )}
      {open && <NoteSheet note={open} onClose={() => setOpen(null)} />}
    </>
  );
}
