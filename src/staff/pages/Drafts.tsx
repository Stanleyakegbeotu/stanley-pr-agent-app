/**
 * Drafts (mobile staff workspace): the desktop BranchDraftsPage. Every
 * unfinished bill at the branch, newest first, with who started it, the step
 * it stopped at, its tests and total. Resume opens it in Billing; Move to
 * trash keeps it 30 days (its reserved Patient ID is released).
 */
import { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { computeBill, useBilling } from '@company/services/billing';
import { formatMoney } from '@company/shared/format';
import { useNav } from '@/app/store';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { AdminTopBar, EmptyCard, PageGlow } from '@/admin/kit';
import { TrashSheet } from '@/admin/prManage';
import { PageTitle } from '@/admin/branchFirst';
import { useStaffChrome } from '../chrome';

const STEP = ['', 'Patient', 'Services', 'Payment', 'Preview', 'Receipt'];

export function DraftsPage() {
  const { branchId } = useStaffChrome();
  const { navigate, moveDraftToTrash } = useCompany();
  const { showToast } = useNav();
  const store = useBilling();
  const branch = getBranch(branchId)!;
  const [trash, setTrash] = useState<string | null>(null);
  const drafts = store.drafts.filter((d) => d.branchId === branchId).sort((a, b) => (b.lastSaved ?? b.startedAt).localeCompare(a.lastSaved ?? a.startedAt));
  const target = drafts.find((d) => d.id === trash);
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <PageTitle title="Drafts" sub={`Unfinished bills · ${branch.name} branch`} />
        {drafts.length === 0 ? (
          <EmptyCard sticker="check" text="No unfinished bills. Bills save here automatically if you leave before completing them." />
        ) : (
          <ul className="space-y-2.5">
            {drafts.map((d) => {
              const t = computeBill(d);
              return (
                <li key={d.id} className="rounded-[20px] bg-white ring-1 ring-line/70">
                  <button type="button" onClick={() => navigate(`/branch/${branchId}/billing?draft=${d.id}`)} className="press flex w-full items-start gap-3 p-3.5 text-left">
                    {d.patient.name.trim() ? <InitialsAvatar name={d.patient.name} size={46} /> : <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-tint-orange"><Sticker name="clipboard" size={28} /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2">
                        <b className="truncate text-[15px] text-ink">{d.patient.name.trim() || 'Unnamed patient'}</b>
                        <b className="shrink-0 text-[14.5px] text-ink">{formatMoney(t.total, branch.currency)}</b>
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {d.patient.existingId ?? d.reservedId ?? 'No Patient ID yet'} · {d.walkIn ? 'Walk-in' : 'Referred'}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-semibold text-brand-700">
                          Stopped at {STEP[d.step]} · step {d.step} of 5
                        </span>
                        <span className="rounded-full bg-page px-2 py-0.5 text-[11.5px] text-ink-2">
                          {d.services.length} test{d.services.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="mt-1.5 block text-[12px] text-muted">
                        {d.startedBy ? `Started by ${d.startedBy.name}, ${d.startedBy.role} · ` : ''}saved {d.lastSaved ? new Date(d.lastSaved).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'earlier'}
                      </span>
                    </span>
                    <ChevronRight size={17} className="mt-3 shrink-0 text-faint" />
                  </button>
                  <div className="flex gap-2 px-3.5 pb-3.5">
                    <button type="button" onClick={() => navigate(`/branch/${branchId}/billing?draft=${d.id}`)} className="press min-h-10 flex-1 rounded-xl bg-brand-600 text-[13.5px] font-semibold text-white">
                      Resume bill
                    </button>
                    <button type="button" onClick={() => setTrash(d.id)} aria-label="Move to trash" className="press grid min-h-10 w-12 place-items-center rounded-xl bg-[#fdecec] text-[#b42318]">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {target && (
        <TrashSheet
          name={target.patient.name.trim() || 'this unfinished bill'}
          what="unfinished bill"
          onClose={() => setTrash(null)}
          onConfirm={(reason) => {
            moveDraftToTrash(target.id, reason);
            showToast('Moved to Trash. Restore it within 30 days');
            setTrash(null);
          }}
        />
      )}
    </div>
  );
}
