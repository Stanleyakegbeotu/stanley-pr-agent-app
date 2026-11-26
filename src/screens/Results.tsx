/**
 * Results (compliance rebuild, 2026-11-24): only the requesting clinician's
 * own patients, only after specialist sign-off, view only (no screenshots or download),
 * every view logged (domain/audit), access ends after RESULT_ACCESS_DAYS.
 * Results never go through chat.
 */
import { useEffect } from 'react';
import { BadgeCheck, ChevronRight, Clock3, EyeOff, FileText, ShieldAlert } from 'lucide-react';
import { useApp } from '@/app/store';
import { useAccount } from '@/domain/account';
import { logAudit } from '@/domain/audit';
import { RESULT_ACCESS_DAYS, accessDaysLeft, resultFor } from '@/domain/results';
import { partialNote, statusOf } from '@/domain/referrals';
import { shortDate } from '@/domain/format';
import { Card, EmptyState, InitialsAvatar, ScreenHeader, Subtitle } from '@/ui/kit';
import { useDetail } from '@/ui/detailSheet';

export function ResultsList() {
  const detail = useDetail();
  const { referrals, navigate } = useApp();
  const ready = referrals.filter((r) => statusOf(r) === 'ResultsReady' && accessDaysLeft(r) > 0);
  const waiting = referrals.filter((r) => statusOf(r) === 'TestsDone').length;
  return (
    <>
      <ScreenHeader title="Results" back={false} />
      <Subtitle>Results for patients you requested tests for. They appear after the specialist signs them off and stay here for {RESULT_ACCESS_DAYS} days.</Subtitle>
      {waiting > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-[13.5px] text-brand-700">
          <Clock3 size={17} /> {waiting} patient{waiting === 1 ? '’s' : 's’'} tests are done, waiting for sign-off.
        </p>
      )}
      {ready.length === 0 ? (
        <EmptyState sticker="clipboard" title="No results right now" text="When a result is signed off you’ll see it here, and get a notification without any patient details." />
      ) : (
        <ul className="space-y-2.5">
          {ready.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => detail.open({ kind: 'result', id: r.id })} className="press flex w-full items-center gap-3.5 rounded-[20px] bg-white p-3.5 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70">
                <InitialsAvatar name={r.patient.name} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-bold text-ink">{r.patient.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {r.id}, released {shortDate(r.resultsAt!)}
                  </span>
                  {partialNote(r) && <span className="mt-0.5 block text-[12.5px] font-medium text-[#b45309]">{partialNote(r)}</span>}
                  <span className="mt-0.5 block text-[12px] text-muted">Available for {accessDaysLeft(r)} more days</span>
                </span>
                <ChevronRight size={18} className="text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ResultView({ id }: { id: string }) {
  const { referrals } = useApp();
  const { account } = useAccount();
  const r = referrals.find((x) => x.id === id);
  const report = r ? resultFor(r) : null;
  const allowed = !!r && !!report && report.signedOff && accessDaysLeft(r) > 0;

  // Every view is logged for the server.
  useEffect(() => {
    if (allowed) logAudit({ type: 'result.view', requestId: id, by: account?.clinician.id });
  }, [allowed, id, account?.clinician.id]);

  if (!r || !report)
    return (
      <>
        <ScreenHeader title="Result" />
        <EmptyState sticker="clipboard" title="Result not available" text="Only the clinician who requested the tests can see a result, after the specialist has signed it off." />
      </>
    );
  if (!allowed)
    return (
      <>
        <ScreenHeader title="Result" />
        <EmptyState sticker="clipboard" title="Access to this result has ended" text={`Results stay in the app for ${RESULT_ACCESS_DAYS} days. Contact the branch if you still need it for this patient’s care.`} />
      </>
    );

  return (
    <>
      <ScreenHeader title="Result" />
      <div className="relative select-none overflow-hidden rounded-[22px]" onContextMenu={(e) => e.preventDefault()}>
        <Card className="relative p-5">
          {report.sample && <p className="mb-3 rounded-xl bg-[#fff6e5] px-3 py-2 text-[12.5px] font-semibold text-[#8a5a12]">SAMPLE RESULT for the demo. Real results come from the branch once connected.</p>}
          <div className="flex items-start gap-3">
            <InitialsAvatar name={r.patient.name} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-bold text-ink">{r.patient.name}</p>
              <p className="text-[13px] text-muted">
                {[r.patient.gender, r.patient.age ? `${r.patient.age} years` : ''].filter(Boolean).join(', ')}
                {r.patient.gender || r.patient.age ? ' · ' : ''}
                {r.id}
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-tint-green px-3 py-2 text-[13px] font-semibold text-good-ink">
            <BadgeCheck size={16} /> Signed off by the {report.signedBy.toLowerCase()}, {shortDate(report.signedAt)}
          </p>
          <ul className="mt-4 divide-y divide-line">
            {report.items.map((i) => (
              <li key={i.serviceId} className="py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{i.section}</p>
                <p className="text-[15.5px] font-bold text-ink">{i.name}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{i.finding}</p>
              </li>
            ))}
          </ul>
          {report.notDone.length > 0 && <p className="mt-2 text-[13.5px] text-[#b45309]">Not done: {report.notDone.join(', ')}.</p>}
        </Card>
      </div>
      <div className="mt-4 space-y-2 px-1 text-[12.5px] leading-snug text-muted">
        <p className="flex items-start gap-2">
          <EyeOff size={15} className="mt-px shrink-0" /> For this patient’s care only. No downloads; don’t screenshot or forward results. Each time you open a result it is recorded.
        </p>
        <p className="flex items-start gap-2">
          <ShieldAlert size={15} className="mt-px shrink-0" /> Available for {accessDaysLeft(r)} more days.
        </p>
        <p className="flex items-start gap-2">
          <FileText size={15} className="mt-px shrink-0" /> Requested {shortDate(r.createdAt)}.
        </p>
      </div>
    </>
  );
}
