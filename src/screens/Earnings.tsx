/** My Earnings (owner's reference) and Targets & Incentives. */
import { useState } from 'react';
import { Check, ChevronRight, Database, Users } from 'lucide-react';
import { RULES } from '@/config/org';
import { naira, shortDate } from '@/domain/format';
import { PERIOD_LABEL, commissionOf, inPeriod, statsFor, type Period } from '@/domain/referrals';
import { useApp } from '@/app/store';
import { Card, ProgressBar, ScreenHeader, Segmented, Sticker, Subtitle } from '@/ui/kit';

export function Earnings() {
  const { referrals, navigate } = useApp();
  const [period, setPeriod] = useState<Period>('today');
  const s = statsFor(referrals, period);
  const label = PERIOD_LABEL[period];
  const paidLabel = period === 'today' ? 'Paid Today' : `Paid ${label}`;
  const completedMonth = referrals.filter((r) => r.status === 'Completed' && inPeriod(r.createdAt, 'month')).length;
  const payouts = referrals
    .filter((r) => r.paidAt)
    .reduce<Record<string, number>>((m, r) => ((m[r.paidAt!.slice(0, 10)] = (m[r.paidAt!.slice(0, 10)] ?? 0) + commissionOf(r)), m), {});

  return (
    <>
      <ScreenHeader title="My Earnings" />
      <Subtitle>Your commissions, payments and incentives.</Subtitle>
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' },
        ]}
      />

      {/* Commission hero */}
      <section className="relative mb-3.5 overflow-hidden rounded-[22px] border border-[#d4e5ff] bg-linear-to-br from-[#eaf3ff] to-[#d9e9ff] p-5">
        <Database size={28} className="text-brand-600" strokeWidth={2} />
        <p className="mt-2 text-[16px] font-semibold text-ink">{period === 'today' ? 'Today’s Commission' : `Commission · ${label}`}</p>
        <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.02em] text-brand-700">{naira(s.estimated)}</p>
        <p className="mt-2 text-[14px] text-ink-2">
          From {s.referred} referred patient{s.referred === 1 ? '' : 's'}
        </p>
        <span aria-hidden="true" className="absolute -bottom-1 right-1">
          <Sticker name="coin" size={46} className="absolute -left-10 bottom-1" />
          <Sticker name="moneyBag" size={118} />
        </span>
      </section>

      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <MiniStat icon={<Users size={21} className="text-good" fill="currentColor" strokeWidth={1.4} />} label="Patients Referred" value={s.referred} />
        <MiniStat
          icon={
            <span className="grid h-6 w-6 place-items-center rounded-full bg-good text-white">
              <Check size={15} strokeWidth={3.2} />
            </span>
          }
          label="Patients Completed"
          value={s.completed}
        />
      </div>

      <Card className="mb-3.5 divide-y divide-line">
        <Line label="Confirmed Commission" value={naira(s.confirmed)} />
        <Line label={paidLabel} value={naira(s.paid)} />
        <Line label="Outstanding" value={naira(s.outstanding)} />
      </Card>

      <button type="button" onClick={() => navigate('/targets')} className="card press mb-5 flex w-full items-start gap-3.5 p-4 text-left">
        <Sticker name="target" size={46} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold text-ink">Monthly Target</span>
          <span className="mt-0.5 block text-[15px] text-ink-2">
            {completedMonth} of {RULES.monthlyCompletedTarget} patients
          </span>
          <span className="mt-2.5 flex items-center gap-3">
            <ProgressBar value={completedMonth} max={RULES.monthlyCompletedTarget} label="Completed referrals this month" />
            <span className="text-[14px] text-ink-2">{Math.min(100, Math.round((completedMonth / RULES.monthlyCompletedTarget) * 100))}%</span>
          </span>
          <span className="mt-2.5 block text-[14px] leading-snug text-ink-2">
            Reach {RULES.monthlyCompletedTarget} completed referrals this month and get an additional {naira(RULES.completedBonus)} bonus!
          </span>
        </span>
        <ChevronRight size={20} className="mt-1 shrink-0 text-ink-2" />
      </button>

      <h2 className="mb-2.5 text-[17px] font-bold text-ink">Payment history</h2>
      {Object.keys(payouts).length === 0 ? (
        <p className="text-[14px] text-muted">No payouts yet. Confirmed commission is paid at the start of each month.</p>
      ) : (
        <Card className="divide-y divide-line">
          {Object.entries(payouts)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([d, v]) => (
              <div key={d} className="flex items-center justify-between p-4">
                <span>
                  <span className="block text-[15px] font-semibold text-ink">Commission payout</span>
                  <span className="block text-[13px] text-muted">{shortDate(d)}</span>
                </span>
                <span className="text-[16px] font-bold text-good">{naira(v)}</span>
              </div>
            ))}
        </Card>
      )}
    </>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint-green">{icon}</span>
      <span>
        <span className="block text-[13px] text-ink-2">{label}</span>
        <span className="block text-[22px] font-bold leading-tight text-ink">{value}</span>
      </span>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-4 text-[15.5px]">
      <span className="text-ink">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

/* ─────────────── Targets & Incentives ─────────────── */

export function Targets() {
  const { referrals } = useApp();
  const month = referrals.filter((r) => inPeriod(r.createdAt, 'month') && r.status !== 'Cancelled');
  const completed = month.filter((r) => r.status === 'Completed').length;
  const left = Math.max(0, RULES.monthlyCompletedTarget - completed);
  return (
    <>
      <ScreenHeader title="Targets & Incentives" />
      <Subtitle>Your goals this month and the rewards that come with them.</Subtitle>
      <Goal sticker="target" title="Referral target" value={month.length} max={RULES.monthlyReferralTarget} note={`${Math.max(0, RULES.monthlyReferralTarget - month.length)} more referrals to reach this month’s target.`} />
      <Goal sticker="trophy" title="Completed referrals bonus" value={completed} max={RULES.monthlyCompletedTarget} note={left ? `${left} more completed referrals to unlock a ${naira(RULES.completedBonus)} bonus.` : `Bonus unlocked — ${naira(RULES.completedBonus)} will be added to your next payout.`} />
      <Card className="p-5">
        <h2 className="text-[17px] font-bold text-ink">How it works</h2>
        <ul className="mt-2.5 space-y-2 text-[14.5px] leading-relaxed text-ink-2">
          <li>• A referral counts when it is sent; it is completed when the patient finishes and pays for the tests.</li>
          <li>• Commission is {Math.round(RULES.commissionRate * 100)}% of the patient’s full bill.</li>
          <li>• Bonuses are paid with the next monthly payout.</li>
        </ul>
      </Card>
    </>
  );
}

function Goal({ sticker, title, value, max, note }: { sticker: 'target' | 'trophy'; title: string; value: number; max: number; note: string }) {
  return (
    <Card className="mb-3.5 flex items-start gap-4 p-5">
      <Sticker name={sticker} size={56} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-[28px] font-bold leading-tight text-brand-700">
          {value}
          <span className="text-[15px] font-medium text-muted"> / {max}</span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar value={value} max={max} label={title} />
          <span className="text-[14px] text-ink-2">{Math.min(100, Math.round((value / max) * 100))}%</span>
        </div>
        <p className="mt-2 text-[13.5px] text-muted">{note}</p>
      </div>
    </Card>
  );
}
