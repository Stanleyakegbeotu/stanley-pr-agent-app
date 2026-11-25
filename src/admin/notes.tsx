/**
 * Admin notifications (owner, 2026-11-25): the same pattern as the PR agent
 * app's notifications (a sticker card per notice), filled from the desktop's
 * notification logic (src/company/services/notifications). Tapping a notice
 * marks it read and opens its full details in a slide-up card with a "Go to"
 * button to the exact page.
 */
import { ChevronRight } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import type { Note, NoteKind } from '@company/services/notifications';
import type { StickerKey } from '@/assets';
import { Sheet } from './ui';

export const NOTE_LOOK: Record<NoteKind, { theme: string; tint: string; sticker: StickerKey; label: string }> = {
  summary: { theme: 'from-[#1b5fd6] via-[#2b78e8] to-[#5ea6f7]', tint: 'bg-tint-blue', sticker: 'chart', label: 'Daily summary' },
  bill: { theme: 'from-[#0c7f86] via-[#139aa0] to-[#4cc5bd]', tint: 'bg-[#e0f7f5]', sticker: 'moneyBag', label: 'High-value bill' },
  unpaid: { theme: 'from-[#c2410c] via-[#e0601a] to-[#f59e0b]', tint: 'bg-tint-orange', sticker: 'clipboard', label: 'Unpaid balance' },
  overdue: { theme: 'from-[#b42318] via-[#d93036] to-[#f0646a]', tint: 'bg-[#fdecec]', sticker: 'calendar', label: 'Overdue balances' },
  payout: { theme: 'from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7]', tint: 'bg-tint-purple', sticker: 'coin', label: 'PR payout' },
  data: { theme: 'from-[#3346c9] via-[#4f63e6] to-[#8796f7]', tint: 'bg-[#eef1ff]', sticker: 'bell', label: 'Data notice' },
};

export const noteWhen = (at: Date) => {
  const now = new Date();
  const mins = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (at.toDateString() === now.toDateString()) return `Today, ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (at.toDateString() === y.toDateString()) return `Yesterday, ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  return at.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** A notice's full details, as a slide-up card. */
export function NoteSheet({ note, onClose }: { note: Note; onClose: () => void }) {
  const { navigate } = useCompany();
  return (
    <Sheet
      title={note.title}
      subtitle={`${NOTE_LOOK[note.kind].label} · ${noteWhen(note.at)}`}
      onClose={onClose}
      footer={
        <button type="button" onClick={() => (onClose(), navigate(note.route))} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-[15px] font-semibold text-white">
          <span className="truncate">Go to {note.target.split(' · ')[0]}</span> <ChevronRight size={18} className="shrink-0" />
        </button>
      }
    >
      <div className="px-2 pb-2">
        <p className="mb-3 text-[14.5px] leading-relaxed text-ink-2">{note.summary}</p>
        <div className="divide-y divide-line rounded-2xl bg-page">
          {note.details.map((d) => (
            <div key={d.label} className="flex items-start justify-between gap-4 px-4 py-3 text-[14px]">
              <span className="shrink-0 text-muted">{d.label}</span>
              <span className="text-right font-medium text-ink">{d.value}</span>
            </div>
          ))}
        </div>
        {note.note && <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-800">{note.note}</p>}
      </div>
    </Sheet>
  );
}
