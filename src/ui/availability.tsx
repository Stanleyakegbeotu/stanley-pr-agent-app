/** Availability badges (domain/availability): green when it can be done now, amber with the next time, red when not available. */
import { Clock3, DoorClosed, DoorOpen } from 'lucide-react';
import { branchStatus, testStatus, useAvailability } from '@/domain/availability';

export function TestAvailability({ id, category, compact }: { id: string | number; category: string; compact?: boolean }) {
  const s = useAvailability();
  const st = testStatus(id, category, s);
  const tone = st.ok ? 'bg-[#e9f9ef] text-good-ink' : st.next ? 'bg-[#fff4e0] text-[#9a5b00]' : 'bg-[#ffecec] text-[#b42318]';
  return (
    <span title={st.detail} className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'} ${tone}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.ok ? 'bg-good' : st.next ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`} />
      <span className="truncate">{st.label}</span>
    </span>
  );
}

export function BranchOpenChip() {
  const s = useAvailability();
  const st = branchStatus(s);
  return (
    <span title={st.detail} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${st.ok ? 'bg-[#e9f9ef] text-good-ink' : 'bg-[#ffecec] text-[#b42318]'}`}>
      {st.ok ? <DoorOpen size={13} /> : <DoorClosed size={13} />} {st.label}
    </span>
  );
}

/** One line under a test: when it is done (schedule or "not available"). */
export function TestAvailabilityLine({ id, category }: { id: string | number; category: string }) {
  const s = useAvailability();
  const st = testStatus(id, category, s);
  return (
    <p className={`flex items-start gap-1.5 text-[12.5px] leading-snug ${st.ok ? 'text-good-ink' : 'text-[#9a5b00]'}`}>
      <Clock3 size={13} className="mt-0.5 shrink-0" /> {st.detail}
    </p>
  );
}
