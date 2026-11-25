/**
 * Smart announcement bar + "what changed" (owner, 2026-11-25).
 *
 * useInsightSlides builds the admin's announcement bar from the same figures
 * as the desktop: who referred the most (with "Say thank you" and "Chat", to
 * build the relationship with PR agents), what each branch made and spent
 * (with "See what changed"), then the latest notifications.
 *
 * WhatChangedSheet explains a period against the one before it: what moved
 * revenue (more or fewer patients, a higher or lower average bill), which
 * tests, PR agents and expense categories changed most, and how collection
 * went. Every line opens the records behind it.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { getBranch } from '@company/data/company';
import type { Currency, PeriodSelection } from '@company/data/types';
import { agentRanking, expenseMix, priorRange, resolveRange, serviceRanking, summarize, trend } from '@company/services/analytics';
import { isRead, useNotifications, type Note } from '@company/services/notifications';
import { formatCount, formatMoney } from '@company/shared/format';
import { InitialsAvatar, Sticker } from '@/ui/kit';
import { THEMES, type Slide } from './kit';
import { NOTE_LOOK, NoteSheet } from './notes';
import { AgentAvatar } from './agentPhotos';
import { Sheet, TrendChart, useSheetPeriod } from './ui';
import { DetailSheet, FocusSheet, type DetailKind, type Focus } from './details';
import { ComposeSheet, agentBranchId } from './agents';
import { agentConvId } from './chat';

export const periodWord = (p: PeriodSelection) => ({ today: 'today', yesterday: 'yesterday', week: 'this week', month: 'this month', year: 'this year', custom: 'in this period' })[p.key];
const pctChange = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);
const firstName = (n: string) => n.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss|barrister|pharm\.?|nurse)\s+/i, '').split(/\s+/)[0] ?? n;

/* ─────────────── the announcement bar ─────────────── */

type Open = { kind: 'thanks'; agentId: number; name: string; phone: string; n: number } | { kind: 'changed'; branchIds: string[]; title: string } | { kind: 'note'; note: Note };

/** Slides for the admin announcement bar, plus the slide-ups their buttons open. */
export function useInsightSlides(branchIds: string[], period: PeriodSelection, opts: { notes?: boolean } = {}) {
  const { navigate, agents } = useCompany();
  const { notes } = useNotifications();
  const [open, setOpen] = useState<Open | null>(null);
  const key = branchIds.join(',');
  const slides = useMemo(() => {
    const out: Slide[] = [];
    const range = resolveRange(period);
    const when = periodWord(period);
    // 1. Who referred the most: thank them, or chat.
    const top = agentRanking(branchIds, range)[0];
    if (top && top.referrals > 0) {
      const rec = agents.find((a) => a.id === top.id);
      const phone = rec?.phone && rec.phone !== 'N/A' ? rec.phone : '';
      out.push({
        id: `top-${top.id}`,
        theme: THEMES.violet,
        sticker: 'trophy',
        label: `Top PR agent ${when}`,
        isNew: true,
        title: `${top.name} referred the most patients ${when}`,
        text: `${formatCount(top.referrals)} patient${top.referrals === 1 ? '' : 's'}${top.hospitalKey ? ` from ${top.hospitalKey}` : ''}. Would you like to say thank you or chat with ${firstName(top.name)}?`,
        actions: [
          { label: 'Say thank you', onClick: () => setOpen({ kind: 'thanks', agentId: top.id, name: top.name, phone, n: top.referrals }) },
          { label: 'Chat', onClick: () => navigate(`/messages/${agentConvId(top.id)}`) },
        ],
      });
    }
    // 2. Each branch's day: made, spent, what changed.
    for (const id of branchIds) {
      const b = getBranch(id);
      if (!b || b.status !== 'Active') continue;
      const s = summarize([id], range);
      const pr = priorRange(range);
      const s0 = pr ? summarize([id], pr) : null;
      const c = b.currency;
      const rev = s.revenue[c] ?? 0;
      const ch = s0 ? pctChange(rev, s0.revenue[c] ?? 0) : null;
      out.push({
        id: `branch-${id}`,
        theme: ch != null && ch < 0 ? THEMES.orange : THEMES.blue,
        sticker: 'chart',
        label: `${b.name} branch ${when}`,
        title: `${b.name} made ${formatMoney(rev, c, true)} ${when}`,
        text: `Spent ${formatMoney(s.expenses[c] ?? 0, c, true)}. ${ch == null ? 'See what happened.' : `Revenue is ${ch >= 0 ? 'up' : 'down'} ${Math.abs(ch).toFixed(0)}% on the period before. See what changed.`}`,
        actions: [{ label: 'See what changed', onClick: () => setOpen({ kind: 'changed', branchIds: [id], title: `${b.name} branch` }) }],
      });
    }
    // 3. Latest notifications.
    if (opts.notes !== false)
      for (const n of notes.filter((x) => !x.branchId || branchIds.includes(x.branchId)).slice(0, 4)) {
        const look = NOTE_LOOK[n.kind];
        out.push({ id: n.id, theme: look.theme, sticker: look.sticker, label: look.label, isNew: !isRead(n), title: n.title, text: n.summary, actions: [{ label: 'View details', onClick: () => setOpen({ kind: 'note', note: n }) }] });
      }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, period.key, period.from, period.to, notes, agents]);

  const sheets: ReactNode = open ? (
    open.kind === 'thanks' ? (
      <ComposeSheet
        audience={{ kind: 'agent', agentId: open.agentId, name: open.name, phone: open.phone }}
        branchId={agentBranchId()}
        preset="thanks"
        draft={{ title: `Thank you, ${firstName(open.name)}!`, text: `Thank you for the ${formatCount(open.n)} patient${open.n === 1 ? '' : 's'} you referred to us ${periodWord(period)}. We truly appreciate your trust in Silhouette.` }}
        onClose={() => setOpen(null)}
      />
    ) : open.kind === 'changed' ? (
      <WhatChangedSheet branchIds={open.branchIds} period={period} title={open.title} onClose={() => setOpen(null)} />
    ) : (
      <NoteSheet note={open.note} onClose={() => setOpen(null)} />
    )
  ) : null;
  return { slides, sheets };
}


/* ─────────────── what changed ─────────────── */

interface Mover {
  key: string;
  label: string;
  sub: string;
  delta: number;
  text: string;
  open?: Focus;
  avatar?: 'service' | 'agent' | 'expense';
}

export function WhatChangedSheet({ branchIds, period, title, onClose }: { branchIds: string[]; period: PeriodSelection; title: string; onClose: () => void }) {
  const { range, filter, period: sel } = useSheetPeriod(period);
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const c: Currency = getBranch(branchIds[0] ?? '')?.currency ?? 'NGN';
  const a = useMemo(() => {
    const pr = priorRange(range);
    const s = summarize(branchIds, range);
    const s0 = pr ? summarize(branchIds, pr) : null;
    const rev = s.revenue[c] ?? 0;
    const rev0 = s0?.revenue[c] ?? 0;
    const avg = s.patients ? rev / s.patients : 0;
    const avg0 = s0?.patients ? rev0 / s0.patients : 0;
    // Revenue change = more/fewer patients at the old average bill + the change in the average bill.
    const volumeEffect = s0 ? (s.patients - s0.patients) * avg0 : 0;
    const billEffect = s0 ? (avg - avg0) * s.patients : 0;
    const svc = serviceRanking(branchIds, range);
    const svc0 = pr ? new Map(serviceRanking(branchIds, pr).map((x) => [x.id, x])) : new Map();
    const svcMoves: Mover[] = svc
      .map((x) => {
        const before = svc0.get(x.id);
        const d = (x.revenue[c] ?? 0) - (before?.revenue[c] ?? 0);
        return { key: `s${x.id}`, label: x.name, sub: `${formatCount(x.count)} now, ${formatCount(before?.count ?? 0)} before`, delta: d, text: `${d >= 0 ? '+' : ''}${formatMoney(d, c, true)}`, open: { kind: 'service', id: x.id, name: x.name } as Focus, avatar: 'service' as const };
      })
      .filter((m) => m.delta !== 0)
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
      .slice(0, 5);
    const ag = agentRanking(branchIds, range);
    const ag0 = pr ? new Map(agentRanking(branchIds, pr).map((x) => [x.id, x])) : new Map();
    const ids = new Set([...ag.map((x) => x.id), ...ag0.keys()]);
    const agNow = new Map(ag.map((x) => [x.id, x]));
    const agMoves: Mover[] = [...ids]
      .map((id) => {
        const now = agNow.get(id);
        const before = ag0.get(id);
        const d = (now?.referrals ?? 0) - (before?.referrals ?? 0);
        const name = now?.name ?? before?.name ?? `PR agent #${id}`;
        return { key: `a${id}`, label: name, sub: `${formatCount(now?.referrals ?? 0)} patient${(now?.referrals ?? 0) === 1 ? "" : "s"} now, ${formatCount(before?.referrals ?? 0)} before`, delta: d, text: `${d >= 0 ? '+' : ''}${formatCount(d)}`, open: { kind: 'agent', id } as Focus, avatar: 'agent' as const };
      })
      .filter((m) => m.delta !== 0)
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
      .slice(0, 5);
    const ex = expenseMix(branchIds, range, c);
    const ex0 = pr ? new Map(expenseMix(branchIds, pr, c).map((x) => [x.label, x.value])) : new Map<string, number>();
    const exMoves: Mover[] = ex
      .map((x) => {
        const d = x.value - (ex0.get(x.label) ?? 0);
        return { key: `e${x.label}`, label: x.label, sub: `${formatMoney(x.value, c, true)} now, ${formatMoney(ex0.get(x.label) ?? 0, c, true)} before`, delta: d, text: `${d >= 0 ? '+' : ''}${formatMoney(d, c, true)}`, avatar: 'expense' as const };
      })
      .filter((m) => m.delta !== 0)
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
      .slice(0, 4);
    const coll = rev ? ((s.payments[c] ?? 0) / rev) * 100 : 0;
    const coll0 = rev0 ? ((s0?.payments[c] ?? 0) / rev0) * 100 : 0;
    return { s, s0, rev, rev0, avg, avg0, volumeEffect, billEffect, svcMoves, agMoves, exMoves, coll, coll0, pr, tr: trend(branchIds, range, c) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIds.join(','), range.from.getTime(), range.to.getTime(), c]);

  const m = (v: number) => formatMoney(v, c, true);
  const { s, s0 } = a;
  const net = (s.payments[c] ?? 0) - (s.expenses[c] ?? 0);
  const net0 = s0 ? (s0.payments[c] ?? 0) - (s0.expenses[c] ?? 0) : 0;
  const revCh = s0 ? pctChange(a.rev, a.rev0) : null;
  const story = !s0
    ? 'There is no earlier period on record to compare with.'
    : a.rev === a.rev0
      ? 'Revenue is the same as the period before.'
      : `Revenue is ${a.rev > a.rev0 ? 'up' : 'down'} ${m(Math.abs(a.rev - a.rev0))}${revCh != null ? ` (${Math.abs(revCh).toFixed(0)}%)` : ''}. ${Math.abs(a.volumeEffect) >= Math.abs(a.billEffect) ? `Mostly because ${s.patients >= s0.patients ? 'more' : 'fewer'} patients came (${formatCount(s.patients)} against ${formatCount(s0.patients)})` : `Mostly because the average bill ${a.avg >= a.avg0 ? 'rose' : 'fell'} to ${m(a.avg)} from ${m(a.avg0)}`}.`;

  return (
    <Sheet back title="What changed" subtitle={`${title} · against the period before`} onClose={onClose} tall filter={filter}>
      <div className="relative mb-3 overflow-hidden rounded-[22px] bg-linear-to-br from-[#e8f1ff] to-[#d3e4ff] p-4">
        <p className="text-[12.5px] font-medium text-ink-2">Revenue generated · {filter.label}</p>
        <p className="mt-0.5 text-[26px] font-bold leading-tight text-ink">{formatMoney(a.rev, c)}</p>
        <p className="mt-1 max-w-[72%] text-[13px] leading-snug text-ink-2">{story}</p>
        <Sticker name="chart" size={84} className="absolute -bottom-2 -right-1" />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Compare label="Revenue" now={a.rev} before={s0 ? a.rev0 : null} fmt={m} onClick={() => setDetail('revenue')} />
        <Compare label="Payments" now={s.payments[c] ?? 0} before={s0?.payments[c] ?? null} fmt={m} onClick={() => setDetail('payments')} />
        <Compare label="Expenses" now={s.expenses[c] ?? 0} before={s0?.expenses[c] ?? null} fmt={m} invert onClick={() => setDetail('expenses')} />
        <Compare label="Money in less spent" now={net} before={s0 ? net0 : null} fmt={m} onClick={() => setDetail('payments')} />
        <Compare label="Patients" now={s.patients} before={s0?.patients ?? null} fmt={formatCount} onClick={() => setDetail('patients')} />
        <Compare label="Referred patients" now={s.referrals} before={s0?.referrals ?? null} fmt={formatCount} onClick={() => setDetail('referrals')} />
      </div>

      {s0 && (
        <Card title="Why revenue moved">
          <Reason label={`${s.patients >= s0.patients ? 'More' : 'Fewer'} patients`} sub={`${formatCount(s.patients)} visits against ${formatCount(s0.patients)}`} delta={a.volumeEffect} text={`${a.volumeEffect >= 0 ? '+' : ''}${m(a.volumeEffect)}`} onClick={() => setDetail('patients')} />
          <Reason label={`Average bill ${a.avg >= a.avg0 ? 'higher' : 'lower'}`} sub={`${m(a.avg)} per visit against ${m(a.avg0)}`} delta={a.billEffect} text={`${a.billEffect >= 0 ? '+' : ''}${m(a.billEffect)}`} onClick={() => setDetail('revenue')} />
          <Reason label="New patients" sub={`${formatCount(s.newPatients)} against ${formatCount(s0.newPatients)}`} delta={s.newPatients - s0.newPatients} text={`${s.newPatients - s0.newPatients >= 0 ? '+' : ''}${formatCount(s.newPatients - s0.newPatients)}`} onClick={() => setDetail('patients')} />
          <Reason label="Collected" sub={`${a.coll.toFixed(0)}% of billed, ${a.coll0.toFixed(0)}% before`} delta={a.coll - a.coll0} text={`${a.coll - a.coll0 >= 0 ? '+' : ''}${(a.coll - a.coll0).toFixed(0)} pts`} onClick={() => setDetail('outstanding')} />
        </Card>
      )}

      {a.svcMoves.length > 0 && <Movers title="Tests that moved revenue" list={a.svcMoves} onOpen={setFocus} />}
      {a.agMoves.length > 0 && <Movers title="PR agents who referred more or less" list={a.agMoves} onOpen={setFocus} />}
      {a.exMoves.length > 0 && <Movers title="Spending that changed" list={a.exMoves} invert onOpen={() => setDetail('expenses')} />}

      <Card title={`Trend · ${a.tr.note}`}>
        <div className="px-1 pb-1 pt-2">
          <TrendChart
            labels={a.tr.labels}
            series={[
              { name: 'Revenue', color: '#2f7df6', values: a.tr.revenue },
              { name: 'Payments', color: '#16a34a', values: a.tr.payments },
              { name: 'Expenses', color: '#f27a1a', values: a.tr.expenses },
            ]}
          />
        </div>
      </Card>

      {detail && <DetailSheet kind={detail} branchIds={branchIds} period={sel} scopeText={title} onClose={() => setDetail(null)} />}
      {focus && <FocusSheet focus={focus} branchIds={branchIds} period={sel} onClose={() => setFocus(null)} />}
    </Sheet>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3 rounded-[20px] bg-white p-3 ring-1 ring-line/70">
      <p className="mb-1 px-1 text-[13px] font-semibold text-ink-2">{title}</p>
      {children}
    </div>
  );
}

function Arrow({ delta, invert }: { delta: number; invert?: boolean }) {
  if (delta === 0) return <Minus size={16} className="text-muted" />;
  const good = invert ? delta < 0 : delta > 0;
  const I = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return <I size={17} className={good ? 'text-good' : 'text-[#d93036]'} strokeWidth={2.6} />;
}

function Compare({ label, now, before, fmt, invert, onClick }: { label: string; now: number; before: number | null; fmt: (v: number) => string; invert?: boolean; onClick: () => void }) {
  const ch = before == null ? null : pctChange(now, before);
  const good = ch == null ? null : invert ? ch <= 0 : ch >= 0;
  return (
    <button type="button" onClick={onClick} className="press min-w-0 rounded-2xl bg-white p-3 text-left ring-1 ring-line/70">
      <span className="block truncate text-[11.5px] font-medium text-muted">{label}</span>
      <span className="mt-0.5 block truncate text-[17px] font-bold text-ink">{fmt(now)}</span>
      <span className="mt-0.5 flex items-center gap-1 text-[11.5px]">
        {ch != null && <span className={`font-semibold ${good ? 'text-good' : 'text-[#d93036]'}`}>{`${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(0)}%`}</span>}
        <span className="truncate text-muted">{before == null ? 'No earlier figure' : `from ${fmt(before)}`}</span>
      </span>
    </button>
  );
}

function Reason({ label, sub, delta, text, onClick }: { label: string; sub: string; delta: number; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-page">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-page">
        <Arrow delta={delta} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{label}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
      <b className={`shrink-0 text-[14px] ${delta >= 0 ? 'text-good-ink' : 'text-[#b42318]'}`}>{text}</b>
    </button>
  );
}

function Movers({ title, list, invert, onOpen }: { title: string; list: Mover[]; invert?: boolean; onOpen: (f: Focus) => void }) {
  return (
    <Card title={title}>
      {list.map((x) => (
        <button key={x.key} type="button" onClick={() => x.open && onOpen(x.open)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-page">
          {x.avatar === 'agent' ? (
            <AgentAvatar id={Number(x.key.slice(1))} name={x.label} size={36} />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-page">
              <Sticker name={x.avatar === 'expense' ? 'clipboard' : 'testTube'} size={24} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{x.label}</span>
            <span className="block truncate text-[12px] text-muted">{x.sub}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Arrow delta={x.delta} invert={invert} />
            <b className={`text-[13.5px] ${(invert ? x.delta < 0 : x.delta > 0) ? 'text-good-ink' : 'text-[#b42318]'}`}>{x.text}</b>
          </span>
        </button>
      ))}
    </Card>
  );
}
