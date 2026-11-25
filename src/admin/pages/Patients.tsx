/**
 * Patients (mobile, owner 2026-11-25): the admin design standard. Same
 * records as the desktop Patients page (src/company dailyLines): every visit
 * in the chosen branch scope and dates, filters (new, returning, referred,
 * walk in, owing), and a search across every patient on record (name or
 * Patient ID). Every patient opens their visit record as a slide-up: tests,
 * prices, payment, who processed it (name and role), who referred them, and
 * their visit history.
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import { addDays, DATA_START } from '@company/data/demo/generator';
import { latestVisit, patientIndex, patientVisits, patientsOnRecord, type PatientVisit } from '@company/data/demo/dailyLines';
import { periodLabel, resolveBranchIds, resolveRange } from '@company/services/analytics';
import { formatCount, formatMoney } from '@company/shared/format';
import { InitialsAvatar, SearchField, Sticker } from '@/ui/kit';
import { ScopeBar } from '../ui';
import { DetailSheet, FocusSheet, Rows, norm, useRowCtx, visitRow, type DetailKind, type Focus } from '../details';
import { AdminTopBar, PageGlow, SectionTitle } from '../kit';
import { StickyTools } from '@/admin/kit';
import { useStaffChrome } from '@/staff/chrome';
import { ReferralHistoryCard } from '@/staff/incoming';

type Filter = 'all' | 'new' | 'returning' | 'referred' | 'walkin' | 'owing';
const FILTERS: { id: Filter; label: string; test: (v: PatientVisit) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'new', label: 'New', test: (v) => v.isNew },
  { id: 'returning', label: 'Returning', test: (v) => !v.isNew },
  { id: 'referred', label: 'Referred', test: (v) => v.agentId != null },
  { id: 'walkin', label: 'Walk in', test: (v) => v.agentId == null },
  { id: 'owing', label: 'Owing', test: (v) => v.paid < v.billed },
];

export function PatientsPage() {
  const { context: ctx0, period, route } = useCompany();
  // Staff workspace: always the person's own branch, whatever the shared scope says.
  const locked = useStaffChrome().branchId;
  const context = locked || ctx0;
  const branchIds = useMemo(() => resolveBranchIds(context), [context]);
  const range = resolveRange(period);
  const [q, setQ] = useState(() => route.query.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const ctx = useRowCtx(setFocus);
  const scopeText = context === 'all' ? 'All branches' : `${getBranch(context)?.name ?? ''} branch`;
  const c = getBranch(branchIds[0] ?? '')?.currency ?? 'NGN';

  const visits = useMemo(() => patientVisits(branchIds, range), [branchIds, range]);
  const onRecord = useMemo(() => branchIds.reduce((s, id) => s + patientsOnRecord(id).total, 0), [branchIds]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, visits.filter(f.test).length])) as Record<Filter, number>, [visits]);
  const billed = visits.reduce((s, v) => s + v.billed, 0);
  const owed = visits.reduce((s, v) => s + Math.max(0, v.billed - v.paid), 0);

  const t = norm(q);
  // Search: every patient on record in the branch scope (all dates), by name or Patient ID.
  const found = useMemo(() => {
    if (t.length < 2) return [];
    const out: { branchId: string; ref: string; name: string; visits: number; last: Date }[] = [];
    for (const id of branchIds)
      for (const p of patientIndex(id)) if (norm(`${p.name} ${p.ref}`).includes(t)) out.push({ branchId: id, ref: p.ref, name: p.name, visits: p.visits, last: addDays(DATA_START, p.lastDay) });
    return out.slice(0, 60);
  }, [t, branchIds]);

  const test = FILTERS.find((f) => f.id === filter)!.test;
  const rows = visits.filter(test).map((v) => visitRow(v, ctx));

  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar />
      <div className="relative">
        <section className="mb-4 pt-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink">Patients</h1>
          <p className="mt-0.5 text-[14.5px] text-ink-2">
            {formatCount(onRecord)} patients on record · {scopeText}
          </p>
        </section>
        <StickyTools>
          <div className="mb-2.5">
            <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or Patient ID..." aria-label="Search patients" />
          </div>
          <ScopeBar />
          {t.length < 2 && (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8" role="group" aria-label="Filter visits">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`press min-h-10 shrink-0 rounded-full px-4 text-[13.5px] font-semibold ${filter === f.id ? 'bg-brand-600 text-white shadow-[0_6px_16px_rgba(31,111,232,0.28)]' : 'bg-white text-ink-2 ring-1 ring-line'}`}>
                    {f.label} <span className={filter === f.id ? 'text-white/80' : 'text-muted'}>{formatCount(counts[f.id])}</span>
                  </button>
                ))}
              </div>
          )}
        </StickyTools>

        {t.length >= 2 ? (
          <>
            <SectionTitle title={`${formatCount(found.length)}${found.length === 60 ? '+' : ''} patient${found.length === 1 ? '' : 's'} found`} />
            {found.length === 0 ? (
              <div className="flex flex-col items-center rounded-[22px] bg-white px-5 py-8 text-center ring-1 ring-line/70">
                <Sticker name="clipboard" size={64} />
                <p className="mt-2 text-[15px] font-semibold text-ink">No patient matches “{q}”</p>
                <p className="mt-0.5 text-[13px] text-muted">Try the Patient ID, e.g. PT-04955, or part of the name.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {found.map((p) => (
                  <li key={`${p.branchId}-${p.ref}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const v = latestVisit(p.branchId, p.ref);
                        if (v) setFocus({ kind: 'visit', visit: v });
                      }}
                      className="press flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-line/70"
                    >
                      <InitialsAvatar name={p.name} size={46} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {p.ref}
                          {branchIds.length > 1 ? ` · ${getBranch(p.branchId)?.name}` : ''} · {formatCount(p.visits)} visit{p.visits === 1 ? '' : 's'}
                        </span>
                        <span className="block text-[12px] text-ink-2">Last visit {p.last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            {/* Referral history (owner, 2026-11-25): earlier weeks' referrals and their status live here. */}
            <div className="mt-2">
              <ReferralHistoryCard branchIds={branchIds} admin={!locked} />
            </div>
            {/* Hero */}
            <div className="relative mt-2 overflow-hidden rounded-[24px] bg-linear-to-br from-[#4b2fc4] via-[#6a4be0] to-[#9a83f7] p-5 text-white shadow-[0_14px_34px_rgba(75,47,196,0.25)]">
              <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
              <div className="relative max-w-[64%]">
                <p className="text-[13px] font-medium text-white/90">Patient visits · {periodLabel(period)}</p>
                <p className="mt-1 text-[32px] font-bold leading-none tracking-[-0.02em]">{formatCount(visits.length)}</p>
                <p className="mt-2 text-[12.5px] leading-snug text-white/90">
                  {formatCount(counts.new)} new · {formatCount(counts.referred)} referred · {formatMoney(billed, c, true)} billed
                </p>
              </div>
              <Sticker name="stethoscope" size={92} className="absolute right-2 top-4" />
              <div className="relative z-10 mt-3.5 grid grid-cols-3 gap-2">
                <HeroBtn label="Returning" value={formatCount(counts.returning)} onClick={() => setFilter('returning')} />
                <HeroBtn label="Walk in" value={formatCount(counts.walkin)} onClick={() => setFilter('walkin')} />
                <HeroBtn label="Still owe" value={formatMoney(owed, c, true)} onClick={() => setDetail('outstanding')} />
              </div>
            </div>


            <SectionTitle title={filter === 'all' ? 'Every visit' : `${FILTERS.find((f) => f.id === filter)!.label} patients`} action="Billing view" onAction={() => setDetail('revenue')} />
            <Rows rows={rows} oneDay={range.days <= 1} multi={branchIds.length > 1} empty="No patient visits in this period." />
          </>
        )}
      </div>
      {focus && <FocusSheet focus={focus} branchIds={branchIds} period={period} onClose={() => setFocus(null)} />}
      {detail && <DetailSheet kind={detail} branchIds={branchIds} period={period} scopeText={scopeText} onClose={() => setDetail(null)} />}
    </div>
  );
}

function HeroBtn({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press min-w-0 rounded-xl bg-white/15 px-2.5 py-1.5 text-left ring-1 ring-white/25 backdrop-blur-sm">
      <span className="block truncate text-[11.5px] text-white/85">{label}</span>
      <b className="block truncate text-[14px]">{value}</b>
    </button>
  );
}
