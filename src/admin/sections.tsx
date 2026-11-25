/** Dashboard sections shared by the Dashboard and a branch's page (same cards, same slide-ups). */
import { ArrowRight } from 'lucide-react';
import type { Currency } from '@company/data/types';
import type { AgentRank, HospitalRank, ServiceRank } from '@company/services/analytics';
import { formatCount, formatMoney } from '@company/shared/format';
import { serviceByName } from '@/data/services';
import { InitialsAvatar, ServiceThumb, Sticker } from '@/ui/kit';
import { EmptyCard, SectionTitle, Tag } from './kit';
import type { Focus } from './details';
import { AgentAvatar } from './agentPhotos';

const CARD = 'press flex w-full items-start gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_20px_rgba(30,74,160,0.07)] ring-1 ring-line/70';

export function TopAgents({ title = 'Top PR Agents', agents, onPick, onAll, action = 'See all' , money = true }: { title?: string; agents: AgentRank[]; onPick: (f: Focus) => void; onAll: () => void; action?: string ; /** Commission figures (Commission and payouts right). */ money?: boolean }) {
  return (
    <>
      <SectionTitle title={title} action={action} onAction={onAll} />
      {agents.length === 0 ? (
        <EmptyCard sticker="stethoscope" text="No referrals in this period." />
      ) : (
        <ul className="space-y-2.5">
          {agents.slice(0, 3).map((a, i) => (
            <li key={a.id}>
              <button type="button" onClick={() => onPick({ kind: 'agent', id: a.id })} className={CARD}>
                <span className="relative">
                  <AgentAvatar id={a.id} name={a.name} phone={a.phone} size={56} />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-700 shadow-sm">#{i + 1}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[15px] font-bold text-ink">{a.name}</span>
                    {money && <span className="shrink-0 text-[14.5px] font-bold text-violet">{formatMoney(a.commission[a.branch.currency] ?? 0, a.branch.currency)}</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">{a.hospitalKey || 'No hospital assigned'}{money ? ' · commission' : ''}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Tag tone="bg-brand-50 text-brand-700">{`${formatCount(a.referrals)} patient${a.referrals === 1 ? '' : 's'}`}</Tag>
                    <Tag tone="bg-page text-ink-2">{formatMoney(a.revenue[a.branch.currency] ?? 0, a.branch.currency, true)} billed</Tag>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Hospitals({ list, onPick, onAll }: { list: HospitalRank[]; onPick: (f: Focus) => void; onAll: () => void }) {
  return (
    <>
      <SectionTitle title="Referring Hospitals" action="See all" onAction={onAll} />
      {list.length === 0 ? (
        <EmptyCard sticker="hospital" text="No hospital referrals in this period." />
      ) : (
        <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
          {list.slice(0, 8).map((h) => (
            <button key={h.key} type="button" onClick={() => onPick({ kind: 'hospital', key: h.key, name: h.name })} className="press relative w-[150px] shrink-0 overflow-hidden rounded-[20px] bg-linear-to-br from-[#eef9ff] to-[#d7efff] p-3.5 text-left ring-1 ring-[#cfe8fb]">
              <span className="block truncate text-[15px] font-bold text-ink">{h.name}</span>
              <span className="block text-[12px] text-ink-2">
                {h.activeAgents} of {h.agentCount} agents
              </span>
              <span className="mt-6 block text-[22px] font-bold leading-none text-brand-700">{formatCount(h.referrals)}</span>
              <span className="text-[11.5px] text-muted">referrals</span>
              <Sticker name="hospital" size={54} className="absolute -bottom-1 -right-1" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function TopServices({ list, c, onPick, onAll }: { list: ServiceRank[]; c: Currency; onPick: (f: Focus) => void; onAll: () => void }) {
  return (
    <>
      <SectionTitle title="Top Diagnostic Services" action="See all" onAction={onAll} />
      {list.length === 0 ? (
        <EmptyCard sticker="microscope" text="No tests in this period." />
      ) : (
        <ul className="space-y-2.5">
          {list.slice(0, 4).map((s) => {
            const svc = serviceByName(s.name);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onPick({ kind: 'service', id: s.id, name: s.name })} className={CARD}>
                  {svc ? (
                    <ServiceThumb service={svc} className="h-[64px] w-[64px] shrink-0 rounded-[16px]" />
                  ) : (
                    <span className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[16px] bg-tint-blue">
                      <Sticker name="microscope" size={44} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{s.name}</span>
                      <span className="shrink-0 text-[15px] font-bold text-brand-600">×{formatCount(s.count)}</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      <Tag tone="bg-brand-50 text-brand-700">{s.category}</Tag>
                      <Tag tone="bg-tint-green text-good-ink">{formatMoney(s.revenue[c] ?? 0, c)} billed</Tag>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function ExpensesCard({ label, total, mix, c, onClick }: { label: string; total: number; mix: { label: string; value: number }[]; c: Currency; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press relative mt-6 block w-full overflow-hidden rounded-[24px] bg-linear-to-br from-[#fff3e2] to-[#ffe0b8] p-5 text-left ring-1 ring-[#ffe2c6]">
      <span className="block max-w-[66%]">
        <span className="text-[13px] font-semibold text-warn-ink">{label}</span>
        <span className="mt-1 block text-[26px] font-bold leading-tight text-ink">{formatMoney(total, c)}</span>
        <span className="mt-2 block space-y-1">
          {mix.slice(0, 3).map((x) => (
            <span key={x.label} className="flex justify-between gap-3 text-[12.5px] text-ink-2">
              <span className="truncate">{x.label}</span>
              <b className="shrink-0 text-ink">{formatMoney(x.value, c, true)}</b>
            </span>
          ))}
        </span>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700">
          See every expense <ArrowRight size={15} />
        </span>
      </span>
      <Sticker name="clipboard" size={104} className="absolute -bottom-2 right-2 rotate-[8deg]" />
    </button>
  );
}
