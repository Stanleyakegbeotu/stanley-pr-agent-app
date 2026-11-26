/**
 * Marketer pages (owner, 2026-11-26), in the same card language and motion as
 * the other mobile dashboards (PageGlow, AdminTopBar, staggered page entry,
 * charts that animate into view). Every marketer has their own view: their
 * hospitals, every PR agent there, their monthly and weekly targets (money:
 * the amount their hospitals generate). Hospital-level money only.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Building2, CalendarCheck, ChevronRight, ClipboardCheck, Hospital, MessageCircle, Plus, SquarePen, Target, TrendingUp, Trophy, UserPlus, Users, Wallet } from 'lucide-react';
import { useApp as useCompany } from '@company/app/AppState';
import { ENTRY_TEXT, PARTNER_STATUS_TEXT, dailyFor, monthName, monthRange, paceWord, shiftMonth, weekStartOf, type HospitalInfo } from '@company/services/marketing';
import { STATUS_LABEL, type AgentStatus } from '@company/services/agentMonitor';
import { formatCount } from '@company/shared/format';
import { useInbox, type InboxRow } from '@/domain/chat';
import { conversationById } from '@/data/team';
import { SearchField, Sticker } from '@/ui/kit';
import { AdminTopBar, PageGlow, SectionTitle, StickyTools } from '@/admin/kit';
import { Chips, PageTitle } from '@/admin/branchFirst';
import { CountUp, Donut, LineChart, useSeen } from '@/admin/charts';
import { Sheet } from '@/admin/ui';
import { AgentAvatar } from '@/admin/agentPhotos';
import { ConversationRow, InboxSection } from '@/screens/chat/Inbox';
import { first, initials, plural, stamp } from './data';
import { WeekAnnouncements } from './insights';
import { marketerAgentChat, marketerPrefix, useMarketerConversations } from './chat';
import { AgentRow, Card, GOOD, GrowBar, GrowBars, GrowRing, NEEDS, STATUS_COLOR, useMk } from './ui';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const PACE_PILL = { ok: 'bg-[#34d07f]/25 text-white', warn: 'bg-[#ffd166]/30 text-white', danger: 'bg-[#ff6b6b]/30 text-white', brand: 'bg-white/25 text-white' } as const;
const daysLeftInMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
};

/** Page frame shared by every marketer page (same as the admin and staff pages). */
function Page({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <PageGlow />
      <AdminTopBar title={title} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Delta({ now, before, money }: { now: number; before: number; money: (n: number) => string }) {
  const d = now - before;
  if (!before && !now) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11.5px] font-bold ${d >= 0 ? 'text-good' : 'text-[#d93036]'}`}>
      {d >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {money(Math.abs(d))}
    </span>
  );
}

/* ─────────────── Home ─────────────── */

export function MarketerHome() {
  const { m, me, go, openLog, openRegister, openHospital } = useMk();
  const p = m.my;
  const seen = useSeen<HTMLDivElement>(0.2);
  const due = m.myHealth.filter((a) => a.due);
  const pw = p ? paceWord(p) : null;
  const total = m.mine.reduce((s, h) => s + (m.figs.get(h.key)?.revenue ?? 0), 0);
  return (
    <Page>
      {/* Main card: monthly target, patients attended, amount generated. */}
      <div ref={seen.ref} className="relative mb-3 overflow-hidden rounded-[28px] bg-linear-to-br from-[#0f2f7a] via-[#1f5fd6] to-[#4d9cf5] p-5 text-white shadow-[0_18px_40px_rgba(31,99,214,0.32)]">
        <span aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 text-[16px] font-bold ring-[3px] ring-white/60">{initials(me.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] text-white/80">Marketer · {plural(m.mine.length, 'hospital')} · {plural(m.myAgentIds.size, 'PR agent')}</span>
            <span className="block truncate text-[20px] font-bold leading-tight">
              {greet()}, {first(me.name)}
            </span>
            {pw && <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ring-1 ring-white/25 ${PACE_PILL[pw.tone]}`}>{pw.text}</span>}
          </span>
        </div>
        {p ? (
          <>
            <p className="relative mt-5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-white/70">Monthly target · {monthName(m.ym, true)}</p>
            <div className="relative mt-1 flex items-end justify-between gap-3">
              <p className="text-[34px] font-extrabold leading-none tracking-[-0.03em]">
                <CountUp value={p.revenue} format={(n) => m.money(n)} seen={seen.seen} />
              </p>
              <p className="pb-1 text-right text-[13px] text-white/80">
                of <b className="text-white">{m.money(p.target)}</b>
              </p>
            </div>
            <div className="relative mt-3">
              <GrowBar pct={p.pct} pace={p.pace} tone="white" className="h-3 bg-white/20" />
            </div>
            <p className="relative mt-2 flex justify-between text-[12px] text-white/85">
              <span>
                <b className="text-white">{Math.round(p.pct * 100)}%</b> reached
              </span>
              <span>{p.revenue >= p.target ? 'Target reached' : `${m.money(p.target - p.revenue)} to go · ${daysLeftInMonth()} days left`}</span>
            </p>
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              {[
                { l: 'Monthly target', v: m.money(p.target), s: p.targetSetBy ? `Set by ${first(p.targetSetBy)}` : 'Usual + 10%' },
                { l: 'Patients attended', v: formatCount(p.patients), s: `${p.patients >= p.lastMonthSoFar ? '▲' : '▼'} ${formatCount(Math.abs(p.patients - p.lastMonthSoFar))} on last mo.` },
                { l: 'Amount generated', v: m.money(p.revenue), s: `${p.revenue >= p.lastMonthSoFarRevenue ? '▲' : '▼'} ${m.money(Math.abs(p.revenue - p.lastMonthSoFarRevenue))}` },
              ].map((x) => (
                <span key={x.l} className="min-w-0 rounded-2xl bg-white/15 px-2.5 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                  <span className="block text-[10.5px] leading-tight text-white/75">{x.l}</span>
                  <b className="block truncate text-[15.5px]">{x.v}</b>
                  <span className="block truncate text-[10px] text-white/70">{x.s}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="relative mt-4 text-[13.5px] text-white/85">No hospitals yet. Your Branch Manager gives you your hospitals; every PR agent there becomes yours and your target comes from them.</p>
        )}
      </div>

      {p && <WeekCard />}
      {/* System-written announcements about the week (owner, 2026-11-26). */}
      <WeekAnnouncements />

      <div className="mt-2.5 grid grid-cols-4 gap-2">
        {[
          { label: 'Follow up', sticker: 'stethoscope' as const, tint: 'bg-tint-blue border-[#d6e7ff]', on: openLog, badge: due.length },
          { label: 'Inbox', sticker: 'speech' as const, tint: 'bg-tint-purple border-[#e2d8ff]', on: () => go('inbox') },
          { label: 'New hospital', sticker: 'hospital' as const, tint: 'bg-tint-green border-[#cdeedb]', on: openRegister },
          { label: 'Analysis', sticker: 'chart' as const, tint: 'bg-tint-orange border-[#ffe2c6]', on: () => go('analysis') },
        ].map((a) => (
          <button key={a.label} type="button" onClick={a.on} className={`press relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[18px] border px-1 ${a.tint}`}>
            {!!a.badge && <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef4444] px-1 text-[10.5px] font-bold text-white">{a.badge}</span>}
            <Sticker name={a.sticker} size={34} />
            <span className="text-center text-[12px] font-semibold leading-tight text-ink">{a.label}</span>
          </button>
        ))}
      </div>

      {m.mine.length > 0 && (
        <>
          <SectionTitle title="Follow up now" action="All agents" onAction={() => go('hospitals')} />
          <Card className="!p-1.5">
            {!m.healthReady ? (
              <p className="px-3 py-3 text-[13px] text-muted">Working out who needs you…</p>
            ) : due.length ? (
              due.slice(0, 5).map((a) => <AgentRow key={a.agent.id} a={a} sub={`${a.hospital} · ${a.action}`} />)
            ) : (
              <p className="flex items-center gap-2 px-3 py-3 text-[13.5px] text-good-ink">
                <Sticker name="check" size={26} /> Everyone slipping or quiet has been followed up.
              </p>
            )}
            {due.length > 5 && (
              <button type="button" onClick={openLog} className="press mt-1 w-full rounded-xl py-2.5 text-[13.5px] font-semibold text-brand-600">
                {due.length - 5} more to follow up
              </button>
            )}
          </Card>

          <SectionTitle title="Your hospitals this month" action="See all" onAction={() => go('hospitals')} />
          <div className="space-y-2">
            {[...m.mine]
              .sort((a, b) => (m.figs.get(b.key)?.revenue ?? 0) - (m.figs.get(a.key)?.revenue ?? 0))
              .slice(0, 4)
              .map((h) => (
                <HospitalCard key={h.key} h={h} total={total} onOpen={() => openHospital(h)} />
              ))}
          </div>
        </>
      )}

      <SectionTitle title="Branch marketers" />
      <Ranking />

      {m.mine.length > 0 && (
        <>
          <SectionTitle title="Your last six months" action="Analysis" onAction={() => go('analysis')} />
          <Card>
            <GrowBars items={m.history.map((h) => ({ label: monthName(h.month).split(' ')[0]!, value: h.revenue, target: h.target }))} format={(n) => m.money(n)} note="Blue: amount generated. Grey: target. Green: target reached." />
          </Card>
        </>
      )}
    </Page>
  );
}

function WeekCard() {
  const { m } = useMk();
  const w = m.my!.week;
  const from = new Date(`${w.from}T12:00:00`);
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7) - 1;
  return (
    <Card className="flex items-center gap-4">
      <GrowRing pct={w.pct} pace={w.pace} size={104} stroke={10}>
        <span>
          <b className="block text-[20px] leading-none text-ink">{Math.round(w.pct * 100)}%</b>
          <span className="text-[10.5px] font-semibold text-muted">this week</span>
        </span>
      </GrowRing>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Weekly target</p>
        <p className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          {m.money(w.revenue)} <span className="text-[14px] font-semibold text-muted">/ {m.money(w.target)}</span>
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {formatCount(w.patients)} patients since {from.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
        <p className="mt-1 text-[12.5px] font-semibold text-ink-2">{w.revenue >= w.target ? 'Week target reached 🎉' : `${m.money(w.target - w.revenue)} to go · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</p>
      </div>
    </Card>
  );
}

function HospitalCard({ h, total, onOpen }: { h: HospitalInfo; total: number; onOpen: () => void }) {
  const { m } = useMk();
  const f = m.figs.get(h.key);
  const lf = m.lastFigs.get(h.key);
  const need = m.myHealth.filter((a) => a.hospital === h.key && NEEDS.includes(a.status)).length;
  return (
    <button type="button" onClick={onOpen} className="press w-full rounded-[20px] bg-white p-3.5 text-left shadow-[0_6px_18px_rgba(30,74,160,0.05)] ring-1 ring-line/70">
      <span className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-50 to-[#dbe8ff] text-brand-700">
          <Hospital size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] text-ink">{h.key}</b>
          <span className="block truncate text-[12px] text-muted">
            {plural(h.agentIds.length, 'agent')} · {plural(f?.patients ?? 0, 'patient')}
          </span>
          {need > 0 && <span className="block text-[11.5px] font-semibold text-[#b45309]">{need} need you</span>}
        </span>
        <span className="text-right">
          <b className="block text-[15px] text-ink">{m.money(f?.revenue ?? 0)}</b>
          <span className="flex items-center justify-end gap-1 text-[11.5px] text-muted">
            <Delta now={f?.revenue ?? 0} before={lf?.revenue ?? 0} money={m.money} />
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-faint" />
      </span>
      {total > 0 && (
        <span className="mt-2.5 flex items-center gap-2">
          <GrowBar pct={(f?.revenue ?? 0) / total} className="h-1.5 flex-1 bg-page" />
          <span className="w-9 text-right text-[11px] font-semibold text-muted">{Math.round(((f?.revenue ?? 0) / total) * 100)}%</span>
        </span>
      )}
    </button>
  );
}

function Ranking() {
  const { m, me } = useMk();
  return (
    <Card className="!p-2">
      {[...m.progress]
        .sort((a, b) => b.pct - a.pct)
        .map((pr, i) => {
          const who = m.marketers.find((x) => x.id === pr.marketerId);
          const isMe = pr.marketerId === me.id;
          return (
            <div key={pr.marketerId} className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 ${isMe ? 'bg-brand-50' : ''}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${i === 0 ? 'bg-[#ffd166] text-[#6b4a00]' : i === 1 ? 'bg-[#e5e7eb] text-ink-2' : 'bg-page text-ink-2'}`}>{i === 0 ? <Trophy size={15} /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <b className="truncate text-[14px] text-ink">
                    {who?.name ?? 'Marketer'}
                    {isMe ? ' (you)' : ''}
                  </b>
                  <span className="shrink-0 text-[13.5px] font-bold text-ink">{Math.round(pr.pct * 100)}%</span>
                </span>
                <GrowBar pct={pr.pct} pace={pr.pace} className="mt-1.5 h-1.5 bg-page" />
              </span>
            </div>
          );
        })}
      <p className="px-2 pb-1 pt-1 text-[11.5px] text-muted">Each marketer against their own target. Your manager and the Company Admin see the same.</p>
    </Card>
  );
}

/* ─────────────── Analysis ─────────────── */

const PIE = ['#1f6fe8', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#94a3b8'];

export function MarketerAnalysis() {
  const { m } = useMk();
  const [which, setWhich] = useState<'this' | 'last'>('this');
  const ym = which === 'this' ? m.ym : shiftMonth(m.ym, -1);
  const p = which === 'this' ? m.my : m.history[m.history.length - 2];
  const figs = which === 'this' ? m.figs : m.lastFigs;
  const keys = m.mine.map((h) => h.key);
  const byHosp = keys.map((k) => ({ k, revenue: figs.get(k)?.revenue ?? 0, patients: figs.get(k)?.patients ?? 0 })).sort((a, b) => b.revenue - a.revenue);
  const top = byHosp.slice(0, 5);
  const rest = byHosp.slice(5).reduce((s, x) => s + x.revenue, 0);
  const statuses: AgentStatus[] = ['top', 'rising', 'steady', 'slipping', 'quiet', 'inactive', 'never'];
  const days = useMemo(() => dailyFor(m.branchId, keys, monthRange(ym), m.agents), [m.branchId, keys.join(','), ym, m.agents]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevDays = useMemo(() => dailyFor(m.branchId, keys, monthRange(shiftMonth(ym, -1)), m.agents), [m.branchId, keys.join(','), ym, m.agents]); // eslint-disable-line react-hooks/exhaustive-deps
  // Weeks of the month (Monday to Sunday), amount against the weekly target.
  const weeks = useMemo(() => {
    // A week cut by the start or end of the month gets that share of the weekly target.
    const perDay = (p?.week.target ?? 0) / 7;
    const out: { label: string; value: number; target: number }[] = [];
    for (const d of days) {
      const label = weekStartOf(new Date(`${d.date}T12:00:00`)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const last = out[out.length - 1];
      if (!last || last.label !== label) out.push({ label, value: d.revenue, target: perDay });
      else (last.value += d.revenue), (last.target += perDay);
    }
    return out.map((w) => ({ ...w, target: Math.round(w.target) }));
  }, [days, p?.week.target]);
  const kpi = useSeen<HTMLDivElement>(0.2);
  if (!p) return <Page title="Analysis"><EmptyMine /></Page>;
  const avg = p.patients ? p.revenue / p.patients : 0;
  return (
    <Page>
      <PageTitle title="Analysis" sub={`Your ${plural(m.mine.length, 'hospital')} · ${monthName(ym, true)}`} />
      <div className="mb-3">
        <Chips value={which} onChange={setWhich} label="Month" options={[{ value: 'this', label: 'This month' }, { value: 'last', label: 'Last month' }]} />
      </div>
      <div ref={kpi.ref} className="grid grid-cols-2 gap-2.5">
        {[
          { l: 'Amount generated', v: p.revenue, f: (n: number) => m.money(n), icon: <Wallet size={22} className="text-brand-500" />, tint: 'bg-tint-blue border-[#d6e7ff]', ink: 'text-brand-800', s: `${Math.round(p.pct * 100)}% of ${m.money(p.target)}` },
          { l: 'Patients attended', v: p.patients, f: (n: number) => formatCount(Math.round(n)), icon: <Users size={22} className="text-violet" />, tint: 'bg-tint-purple border-[#e2d8ff]', ink: 'text-violet', s: `${formatCount(p.lastMonth)} the month before` },
          { l: 'Average per patient', v: avg, f: (n: number) => m.money(n), icon: <TrendingUp size={22} className="text-good" />, tint: 'bg-tint-green border-[#cdeedb]', ink: 'text-[#14633a]', s: 'Amount ÷ patients' },
          { l: 'Follow-ups', v: p.followUps, f: (n: number) => formatCount(Math.round(n)), icon: <ClipboardCheck size={22} className="text-orange" />, tint: 'bg-tint-orange border-[#ffe2c6]', ink: 'text-warn-ink', s: `${p.recruits} new agents · ${p.newHospitals} hospitals` },
        ].map((t) => (
          <div key={t.l} className={`min-h-[118px] rounded-[18px] border p-3 ${t.tint}`}>
            {t.icon}
            <p className="mt-1.5 text-[12.5px] text-ink-2">{t.l}</p>
            <p className={`text-[21px] font-bold leading-tight tracking-[-0.02em] ${t.ink}`}>
              <CountUp value={t.v} format={t.f} seen={kpi.seen} />
            </p>
            <p className="truncate text-[11px] text-muted">{t.s}</p>
          </div>
        ))}
      </div>

      <SectionTitle title="Amount by hospital" />
      <Card>
        <Donut
          parts={[...top.map((x, i) => ({ label: x.k, value: x.revenue, color: PIE[i]!, sub: `${formatCount(x.patients)} patients` })), ...(rest > 0 ? [{ label: 'Other hospitals', value: rest, color: PIE[6]! }] : [])]}
          total={m.money(p.revenue)}
          label="Generated"
          format={(n) => m.money(n)}
          legend="below"
        />
      </Card>

      <SectionTitle title="Amount by week" />
      <Card>
        <GrowBars items={weeks} format={(n) => m.money(n)} note={`Each week against the weekly target (${m.money(p.week.target)}; a part week gets its share). Weeks start on Monday.`} />
      </Card>

      <SectionTitle title="Your PR agents" />
      <Card>
        <Donut
          parts={statuses.map((s) => ({ label: STATUS_LABEL[s], value: m.myHealth.filter((a) => a.status === s).length, color: STATUS_COLOR[s] })).filter((x) => x.value > 0)}
          total={formatCount(m.myHealth.length)}
          label="PR agents"
          format={(n) => formatCount(n)}
        />
        <p className="mt-2 text-[12px] text-muted">
          {formatCount(m.myHealth.filter((a) => GOOD.includes(a.status)).length)} doing well · {formatCount(m.myHealth.filter((a) => NEEDS.includes(a.status)).length)} need you
        </p>
      </Card>

      <SectionTitle title="Day by day" />
      <Card>
        <LineChart labels={days.map((d) => String(Number(d.date.slice(8))))} series={[{ name: monthName(ym), color: '#1f6fe8', values: days.map((d) => d.revenue) }, { name: monthName(shiftMonth(ym, -1)), color: '#94a3b8', values: prevDays.slice(0, days.length).map((d) => d.revenue), dashed: true }]} format={(n) => m.money(n)} />
      </Card>

      <SectionTitle title="Patients by hospital" />
      <Card>
        <HBars rows={[...byHosp].sort((a, b) => b.patients - a.patients).slice(0, 8).map((x) => ({ label: x.k, value: x.patients }))} />
      </Card>

      <SectionTitle title="Six months against target" />
      <Card>
        <GrowBars items={m.history.map((h) => ({ label: monthName(h.month).split(' ')[0]!, value: h.revenue, target: h.target }))} format={(n) => m.money(n)} note="Blue: amount generated. Grey: target. Green: target reached." />
      </Card>
    </Page>
  );
}

function HBars({ rows }: { rows: { label: string; value: number }[] }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div ref={ref} className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[12.5px]">
            <b className="truncate text-ink">{r.label}</b>
            <span className="font-semibold text-ink-2">{formatCount(r.value)} patients</span>
          </div>
          <span className="block h-2.5 overflow-hidden rounded-full bg-page">
            <i className="block h-full rounded-full bg-linear-to-r from-[#7c5cff] to-[#4f46e5] transition-[width] duration-[1000ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]" style={{ width: seen ? `${(r.value / max) * 100}%` : '0%', transitionDelay: `${i * 80}ms` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyMine() {
  return (
    <Card className="mt-4 text-center">
      <Sticker name="hospital" size={56} />
      <p className="mt-3 text-[17px] font-bold text-ink">No hospitals yet</p>
      <p className="mt-1 text-[13.5px] text-muted">Your Branch Manager gives you your hospitals. Every PR agent at them becomes yours.</p>
    </Card>
  );
}

/* ─────────────── My hospitals ─────────────── */

type HFilter = 'all' | 'need' | 'up' | 'down';

export function MarketerHospitals() {
  const { m, openHospital, openRegister } = useMk();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<HFilter>('all');
  const total = m.mine.reduce((s, h) => ({ revenue: s.revenue + (m.figs.get(h.key)?.revenue ?? 0), patients: s.patients + (m.figs.get(h.key)?.patients ?? 0) }), { revenue: 0, patients: 0 });
  const need = (h: HospitalInfo) => m.myHealth.some((a) => a.hospital === h.key && NEEDS.includes(a.status));
  const trend = (h: HospitalInfo) => (m.figs.get(h.key)?.revenue ?? 0) - (m.lastFigs.get(h.key)?.revenue ?? 0);
  const test = (h: HospitalInfo, f: HFilter) => (f === 'all' ? true : f === 'need' ? need(h) : f === 'up' ? trend(h) > 0 : trend(h) < 0);
  const t = q.trim().toUpperCase();
  const shown = m.mine.filter((h) => test(h, filter) && (!t || h.key.includes(t) || m.myHealth.some((a) => a.hospital === h.key && a.agent.name.toUpperCase().includes(t)))).sort((a, b) => (m.figs.get(b.key)?.revenue ?? 0) - (m.figs.get(a.key)?.revenue ?? 0));
  const agentHits = t.length >= 2 ? m.myHealth.filter((a) => a.agent.name.toUpperCase().includes(t)).slice(0, 6) : [];
  return (
    <Page>
      <PageTitle title="My hospitals" sub={`${plural(m.mine.length, 'hospital')} · ${plural(m.myAgentIds.size, 'PR agent')} · all yours`} action={<button type="button" onClick={openRegister} aria-label="Register a hospital" className="press grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]"><Plus size={20} /></button>} />
      <div className="mb-1 grid grid-cols-3 gap-2">
        {[
          { l: 'Generated', v: m.money(total.revenue), i: <Wallet size={18} className="text-brand-500" /> },
          { l: 'Patients', v: formatCount(total.patients), i: <Users size={18} className="text-violet" /> },
          { l: 'Need you', v: formatCount(m.myHealth.filter((a) => NEEDS.includes(a.status)).length), i: <CalendarCheck size={18} className="text-orange" /> },
        ].map((x) => (
          <div key={x.l} className="rounded-[18px] bg-white p-3 ring-1 ring-line/70">
            {x.i}
            <p className="mt-1 text-[11.5px] text-muted">{x.l}</p>
            <b className="block truncate text-[17px] text-ink">{x.v}</b>
          </div>
        ))}
      </div>
      <StickyTools>
        <div className="mb-2">
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a hospital or PR agent" aria-label="Search hospitals and PR agents" />
        </div>
        <Chips
          value={filter}
          onChange={setFilter}
          label="Show"
          options={[
            { value: 'all', label: 'All', count: m.mine.length },
            { value: 'need', label: 'Need you', count: m.mine.filter((h) => test(h, 'need')).length },
            { value: 'up', label: 'Up on last month', count: m.mine.filter((h) => test(h, 'up')).length },
            { value: 'down', label: 'Down', count: m.mine.filter((h) => test(h, 'down')).length },
          ]}
        />
      </StickyTools>
      {agentHits.length > 0 && (
        <>
          <p className="mb-1.5 mt-2 px-1 text-[12.5px] font-semibold text-muted">PR agents</p>
          <Card className="mb-3 !p-1.5">
            {agentHits.map((a) => (
              <AgentRow key={a.agent.id} a={a} />
            ))}
          </Card>
        </>
      )}
      <div className="mt-2 space-y-2">
        {shown.map((h) => (
          <HospitalCard key={h.key} h={h} total={total.revenue} onOpen={() => openHospital(h)} />
        ))}
        {!shown.length && <p className="rounded-[20px] bg-white p-4 text-center text-[13.5px] text-muted ring-1 ring-line/70">{m.mine.length ? 'No hospital matches.' : 'No hospitals yet. Your Branch Manager gives you your hospitals.'}</p>}
      </div>
    </Page>
  );
}

/* ─────────────── Activity ─────────────── */

type AKind = 'all' | 'follow' | 'visit' | 'recruit' | 'hospital' | 'owner';
const A_ICON: Record<Exclude<AKind, 'all'>, { icon: React.ReactNode; tint: string }> = {
  follow: { icon: <ClipboardCheck size={17} />, tint: 'bg-brand-50 text-brand-700' },
  visit: { icon: <Building2 size={17} />, tint: 'bg-tint-green text-good-ink' },
  recruit: { icon: <UserPlus size={17} />, tint: 'bg-tint-purple text-violet' },
  hospital: { icon: <Hospital size={17} />, tint: 'bg-tint-orange text-warn-ink' },
  owner: { icon: <Target size={17} />, tint: 'bg-page text-ink-2' },
};

export function MarketerActivity() {
  const { m, me } = useMk();
  const [tab, setTab] = useState<'log' | 'months'>('log');
  const [kind, setKind] = useState<AKind>('all');
  const seen = useSeen<HTMLDivElement>(0.2);
  const agentName = (id: number) => m.agents.find((a) => a.id === id)?.name ?? `PR agent #${id}`;
  const items = useMemo(
    () =>
      [
        ...m.st.entries.filter((e) => e.marketerId === me.id).map((e) => ({ at: e.at, kind: (e.kind === 'note' ? 'visit' : e.kind) as Exclude<AKind, 'all' | 'follow' | 'owner'>, title: e.hospital ? `${ENTRY_TEXT[e.kind]} · ${e.hospital}` : ENTRY_TEXT[e.kind], text: e.text, by: e.by })),
        ...m.checkUps.filter((c) => c.by.name === me.name).map((c) => ({ at: c.at, kind: 'follow' as const, title: `${c.kind} with ${agentName(c.agentId)}`, text: `${c.outcome}${c.note ? ` · ${c.note}` : ''}`, by: c.by.name })),
        ...m.st.ownerHistory.filter((h) => h.to === me.id || h.from === me.id).map((h) => ({ at: h.at, kind: 'owner' as const, title: h.to === me.id ? `${h.hospital} is now yours` : `${h.hospital} moved to another marketer`, text: h.reason, by: h.by })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.st, m.checkUps, me],
  );
  const shown = items.filter((i) => kind === 'all' || i.kind === kind);
  const days = new Map<string, typeof shown>();
  for (const it of shown) {
    const d = new Date(it.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    days.set(d, [...(days.get(d) ?? []), it]);
  }
  const month = (k: AKind) => items.filter((i) => i.kind === k && i.at.slice(0, 7) === m.ym).length;
  return (
    <Page>
      <PageTitle title="Activity" sub="Everything you have done, and how each month went. Your manager sees the same." />
      <div ref={seen.ref} className="grid grid-cols-4 gap-2">
        {(['follow', 'visit', 'recruit', 'hospital'] as const).map((k) => (
          <div key={k} className="rounded-[18px] bg-white p-2.5 text-center ring-1 ring-line/70">
            <span className={`mx-auto grid h-8 w-8 place-items-center rounded-xl ${A_ICON[k].tint}`}>{A_ICON[k].icon}</span>
            <b className="mt-1 block text-[18px] text-ink">
              <CountUp value={month(k)} format={(n) => formatCount(Math.round(n))} seen={seen.seen} />
            </b>
            <span className="block text-[10.5px] leading-tight text-muted">{k === 'follow' ? 'Follow-ups' : k === 'visit' ? 'Visits' : k === 'recruit' ? 'New agents' : 'Hospitals'}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-[11.5px] text-muted">This month</p>
      <StickyTools>
        <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1 ring-1 ring-line">
          {(
            [
              ['log', 'My log'],
              ['months', 'Targets by month'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`press min-h-10 rounded-xl text-[14px] font-semibold ${tab === k ? 'bg-brand-600 text-white' : 'text-ink-2'}`}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'log' && (
          <Chips
            value={kind}
            onChange={setKind}
            label="Kind"
            options={[
              { value: 'all', label: 'All', count: items.length },
              { value: 'follow', label: 'Follow-ups', count: items.filter((i) => i.kind === 'follow').length },
              { value: 'visit', label: 'Visits', count: items.filter((i) => i.kind === 'visit').length },
              { value: 'recruit', label: 'New agents', count: items.filter((i) => i.kind === 'recruit').length },
              { value: 'hospital', label: 'Hospitals', count: items.filter((i) => i.kind === 'hospital').length },
              { value: 'owner', label: 'Assignments', count: items.filter((i) => i.kind === 'owner').length },
            ]}
          />
        )}
      </StickyTools>
      {tab === 'log' ? (
        shown.length ? (
          [...days.entries()].slice(0, 40).map(([d, list]) => (
            <div key={d} className="mb-4 mt-2">
              <p className="mb-1.5 px-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-faint">{d}</p>
              <Card className="!p-1.5">
                {list.map((it, i) => (
                  <div key={i} className="flex gap-3 rounded-2xl px-2 py-2.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${A_ICON[it.kind].tint}`}>{A_ICON[it.kind].icon}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[14px] text-ink">{it.title}</b>
                      {it.text && <span className="block text-[13px] leading-snug text-ink-2">{it.text}</span>}
                      <span className="block text-[11.5px] text-muted">
                        {new Date(it.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {it.by === me.name ? 'you' : it.by}
                      </span>
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          ))
        ) : (
          <Card className="mt-2 text-center text-[13.5px] text-muted">Nothing here yet. Follow-ups, visits, new PR agents and hospitals show here.</Card>
        )
      ) : (
        <div className="mt-2 space-y-2">
          {[...m.history].reverse().map((h) => (
            <Card key={h.month} className="!p-3.5">
              <div className="flex items-center justify-between">
                <b className="text-[15px] text-ink">{monthName(h.month, true)}</b>
                <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${h.pct >= 1 ? 'bg-[#e6f8ee] text-good-ink' : h.month === m.ym ? 'bg-brand-50 text-brand-700' : 'bg-[#ffe4e4] text-[#b42318]'}`}>{h.pct >= 1 ? 'Reached' : h.month === m.ym ? 'This month' : 'Missed'}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">
                <b className="text-ink">{m.money(h.revenue)}</b> of {m.money(h.target)} ({Math.round(h.pct * 100)}%) · {formatCount(h.patients)} patients · {formatCount(h.followUps)} follow-ups
              </p>
              <GrowBar pct={h.pct} pace={h.month === m.ym ? h.pace : undefined} className="mt-2 h-2 bg-page" />
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

/* ─────────────── Report centre ─────────────── */

export function MarketerCentre() {
  const { m, me, openRegister } = useMk();
  const [f, setF] = useState<'all' | 'proposed' | 'partnered' | 'declined'>('all');
  const seen = useSeen<HTMLDivElement>(0.2);
  const mine = m.st.partners.filter((p) => p.marketerId === me.id);
  const PILL = { proposed: 'bg-[#fff1de] text-[#b45309]', partnered: 'bg-[#e6f8ee] text-good-ink', declined: 'bg-page text-muted' } as const;
  const count = (s: 'proposed' | 'partnered' | 'declined') => mine.filter((p) => p.status === s).length;
  const shown = mine.filter((p) => f === 'all' || p.status === f);
  return (
    <Page>
      <PageTitle title="Report centre" sub="Register hospitals and health centres you bring in. Once your manager takes one on, it becomes yours." />
      <button type="button" onClick={openRegister} className="press relative mb-3 flex w-full items-center gap-3 overflow-hidden rounded-[24px] bg-linear-to-br from-[#0f6b4a] via-[#16a34a] to-[#4ade80] p-4 text-left text-white shadow-[0_14px_32px_rgba(22,163,74,0.3)]">
        <span aria-hidden="true" className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <Sticker name="hospital" size={48} />
        <span className="relative min-w-0 flex-1">
          <b className="block text-[17px]">Register a new partner</b>
          <span className="block text-[12.5px] text-white/85">Hospital, health centre, clinic or maternity</span>
        </span>
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/20">
          <Plus size={22} />
        </span>
      </button>
      <div ref={seen.ref} className="grid grid-cols-3 gap-2">
        {[
          { l: 'Registered', v: mine.length, c: 'text-ink' },
          { l: 'Partners', v: count('partnered'), c: 'text-good-ink' },
          { l: 'Waiting', v: count('proposed'), c: 'text-[#b45309]' },
        ].map((x) => (
          <div key={x.l} className="rounded-[18px] bg-white p-3 text-center ring-1 ring-line/70">
            <b className={`block text-[22px] ${x.c}`}>
              <CountUp value={x.v} format={(n) => formatCount(Math.round(n))} seen={seen.seen} />
            </b>
            <span className="text-[11.5px] text-muted">{x.l}</span>
          </div>
        ))}
      </div>
      <StickyTools>
        <Chips
          value={f}
          onChange={setF}
          label="Status"
          options={[
            { value: 'all', label: 'All', count: mine.length },
            { value: 'proposed', label: 'Waiting', count: count('proposed') },
            { value: 'partnered', label: 'Partners', count: count('partnered') },
            { value: 'declined', label: 'Not taken on', count: count('declined') },
          ]}
        />
      </StickyTools>
      <div className="mt-2 space-y-2">
        {shown.length ? (
          shown.map((p) => (
            <Card key={p.id} className="!p-3.5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-tint-green text-good-ink">
                  <Hospital size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] text-ink">{p.name}</b>
                  <span className="block text-[12px] text-muted">
                    {p.code} · {p.kind}
                    {p.area ? ` · ${p.area}` : ''}
                  </span>
                  {p.contactName && (
                    <span className="block text-[12px] text-muted">
                      Contact: {p.contactName}
                      {p.contactPhone ? `, ${p.contactPhone}` : ''}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${PILL[p.status]}`}>{PARTNER_STATUS_TEXT[p.status]}</span>
              </div>
              <p className="mt-2 border-t border-line pt-2 text-[11.5px] text-muted">
                Registered {stamp(p.at)}
                {p.decidedBy ? ` · decided by ${p.decidedBy}` : ''}
              </p>
            </Card>
          ))
        ) : (
          <Card className="text-center text-[13.5px] text-muted">{mine.length ? 'Nothing in this list.' : 'Nothing registered yet.'}</Card>
        )}
      </div>
    </Page>
  );
}

/* ─────────────── Inbox ─────────────── */

export function MarketerInbox() {
  const { m, me } = useMk();
  const { navigate } = useCompany();
  const { fixed, agentConvs } = useMarketerConversations(m.branchId, me.id, m.myAgentIds);
  const fixedIds = useMemo(() => fixed.map((c) => c.id), [fixed]);
  const { inboxes, direct } = useInbox(fixedIds, marketerPrefix(me.id));
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState(false);
  const t = q.trim().toLowerCase();
  const match = (r: InboxRow) => {
    if (!t) return true;
    const c = conversationById(r.id);
    return !!c && [c.name, c.role, r.last?.text ?? ''].join(' ').toLowerCase().includes(t);
  };
  const open = (id: string) => navigate(`/branch/${m.branchId}/inbox/${id}`);
  const found = t ? agentConvs.filter((c) => !direct.some((d) => d.id === c.id) && `${c.name} ${c.role}`.toLowerCase().includes(t)).slice(0, 8) : [];
  return (
    <Page>
      <PageTitle
        title="Inbox"
        sub="Chat with the PR agents at your hospitals and with your manager"
        action={
          <button type="button" onClick={() => setPicker(true)} aria-label="New chat" className="press grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.3)]">
            <SquarePen size={19} />
          </button>
        }
      />
      <StickyTools>
        <div className="mb-2">
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats and your PR agents…" aria-label="Search chats" />
        </div>
      </StickyTools>
      {inboxes.filter(match).length > 0 && (
        <InboxSection title="Your manager">
          {inboxes.filter(match).map((r) => (
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
          {found.map((c) => {
            const id = Number(c.id.slice(marketerPrefix(me.id).length));
            return (
              <button key={c.id} type="button" onClick={() => open(c.id)} className="press flex w-full items-center gap-3.5 px-4 py-3 text-left">
                <AgentAvatar id={id} name={c.name} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">{c.role}</span>
                </span>
                <ChevronRight size={18} className="text-faint" />
              </button>
            );
          })}
        </InboxSection>
      )}
      <button type="button" onClick={() => setPicker(true)} className="press mt-1 flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-left">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
          <MessageCircle size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Start a new chat</span>
          <span className="text-[13px] text-muted">Any PR agent at your hospitals</span>
        </span>
        <ChevronRight size={19} className="text-muted" />
      </button>
      {picker && <NewChat onClose={() => setPicker(false)} onPick={(agentId) => (setPicker(false), open(marketerAgentChat(me.id, agentId)))} />}
    </Page>
  );
}

function NewChat({ onClose, onPick }: { onClose: () => void; onPick: (agentId: number) => void }) {
  const { m } = useMk();
  const [q, setQ] = useState('');
  const [hosp, setHosp] = useState('all');
  const [shown, setShown] = useState(40);
  const t = q.trim().toLowerCase();
  const list = [...m.myHealth].sort((a, b) => a.agent.name.localeCompare(b.agent.name)).filter((a) => (hosp === 'all' || a.hospital === hosp) && (!t || `${a.agent.name} ${a.hospital}`.toLowerCase().includes(t)));
  return (
    <Sheet title="New chat" subtitle="A PR agent at your hospitals" onClose={onClose} tall search={{ value: q, onChange: setQ, placeholder: 'Search PR agent or hospital' }}>
      <div className="sticky top-0 z-10 -mx-3 bg-white px-3 pb-2 pt-1">
        <Chips value={hosp} onChange={setHosp} label="Hospital" options={[{ value: 'all', label: 'All' }, ...m.mine.map((h) => ({ value: h.key, label: h.key }))]} />
      </div>
      {list.slice(0, shown).map((a) => (
        <button key={a.agent.id} type="button" onClick={() => onPick(a.agent.id)} className="press flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left hover:bg-page">
          <AgentAvatar id={a.agent.id} name={a.agent.name} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-ink">{a.agent.name}</span>
            <span className="block truncate text-[12.5px] text-muted">{a.hospital}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-faint" />
        </button>
      ))}
      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + 40)} className="press mx-auto mt-2 block rounded-full bg-page px-5 py-2.5 text-[14px] font-semibold text-brand-600">
          Show more ({list.length - shown} more)
        </button>
      )}
      {!list.length && <p className="py-8 text-center text-[14px] text-muted">{m.healthReady ? 'No PR agent matches.' : 'Working out your agents…'}</p>}
    </Sheet>
  );
}

/* ─────────────── Alerts (the bell) ─────────────── */

export interface Alert {
  key: string;
  tone: 'warn' | 'danger' | 'ok' | 'brand';
  title: string;
  text: string;
  onOpen?: () => void;
}
const ALERT_TONE = { warn: 'bg-[#fff1de] text-[#b45309]', danger: 'bg-[#ffe4e4] text-[#b42318]', ok: 'bg-[#e6f8ee] text-good-ink', brand: 'bg-brand-50 text-brand-700' } as const;

export function useAlerts(): Alert[] {
  const { m, me, openAgent, go } = useMk();
  return useMemo(() => {
    const out: Alert[] = [];
    const p = m.my;
    if (p) {
      const w = p.week;
      if (w.revenue >= w.target) out.push({ key: `week-hit-${w.from}`, tone: 'ok', title: 'Weekly target reached', text: `${m.money(w.revenue)} this week against ${m.money(w.target)}. Well done.`, onOpen: () => go('analysis') });
      else if (w.pace > 0.4 && w.pct < w.pace * 0.8) out.push({ key: `week-behind-${w.from}-${Math.round(w.pace * 7)}`, tone: 'danger', title: 'Behind on this week', text: `${m.money(w.revenue)} of ${m.money(w.target)} so far. Follow up the agents who have gone quiet.`, onOpen: () => go('analysis') });
      if (p.pct >= 1) out.push({ key: `month-hit-${p.month}`, tone: 'ok', title: 'Monthly target reached', text: `${m.money(p.revenue)} against ${m.money(p.target)}.` });
    }
    for (const a of m.myHealth.filter((x) => x.due && x.status === 'quiet').slice(0, 8)) out.push({ key: `quiet-${a.agent.id}-${a.daysSince}`, tone: 'warn', title: `${a.agent.name} has gone quiet`, text: `${a.hospital} · no referral for ${a.daysSince} days`, onOpen: () => openAgent(a) });
    for (const a of m.myHealth.filter((x) => x.due && x.status === 'slipping').slice(0, 5)) out.push({ key: `slip-${a.agent.id}-${a.last28}`, tone: 'warn', title: `${a.agent.name} is slipping`, text: `${a.hospital} · ${a.action}`, onOpen: () => openAgent(a) });
    for (const pt of m.st.partners.filter((x) => x.marketerId === me.id && x.status !== 'proposed')) out.push({ key: `partner-${pt.id}-${pt.status}`, tone: pt.status === 'partnered' ? 'ok' : 'brand', title: pt.status === 'partnered' ? `${pt.name} is now your hospital` : `${pt.name} was not taken on`, text: `Decided by ${pt.decidedBy ?? 'your manager'}`, onOpen: () => go('centre') });
    for (const h of m.st.ownerHistory.filter((x) => x.to === me.id && x.by !== 'STANLEY').slice(0, 5)) out.push({ key: `own-${h.hospital}-${h.at}`, tone: 'brand', title: `${h.hospital} is now yours`, text: h.reason });
    return out;
  }, [m, me, openAgent, go]);
}
const SEEN_KEY = (id: string) => `stanley.mk.alertsSeen.${id}`;
export const seenAlerts = (id: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY(id)) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function MarketerAlerts() {
  const { me } = useMk();
  const alerts = useAlerts();
  const [seenBefore] = useState(() => new Set(seenAlerts(me.id)));
  useEffect(() => {
    localStorage.setItem(SEEN_KEY(me.id), JSON.stringify(alerts.map((a) => a.key)));
    window.dispatchEvent(new Event('marketer:alerts'));
  }, [alerts, me.id]);
  return (
    <Page>
      <PageTitle title="Alerts" sub="Your targets, PR agents who need you, and decisions on your hospitals" />
      {alerts.length ? (
        <Card className="!p-1.5">
          {alerts.map((a) => (
            <button key={a.key} type="button" onClick={a.onOpen} disabled={!a.onOpen} className="press flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left">
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ALERT_TONE[a.tone]}`}>{a.tone === 'ok' ? <Trophy size={17} /> : a.tone === 'danger' ? <Target size={17} /> : a.tone === 'warn' ? <CalendarCheck size={17} /> : <Hospital size={17} />}</span>
              <span className="min-w-0 flex-1">
                <b className="block text-[14px] text-ink">
                  {!seenBefore.has(a.key) && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-600 align-[2px]" />}
                  {a.title}
                </b>
                <span className="block text-[12.5px] text-muted">{a.text}</span>
              </span>
              {a.onOpen && <ChevronRight size={16} className="mt-2 shrink-0 text-faint" />}
            </button>
          ))}
        </Card>
      ) : (
        <Card className="text-center text-[13.5px] text-muted">Nothing new.</Card>
      )}
    </Page>
  );
}

/* ─────────────── Settings ─────────────── */

export function MarketerSettings() {
  const { m, me } = useMk();
  return (
    <Page>
      <PageTitle title="Settings" />
      <Card className="mb-3 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-[18px] font-bold text-white">{initials(me.name)}</span>
        <span className="min-w-0">
          <b className="block text-[17px] text-ink">{me.name}</b>
          <span className="block text-[13px] text-muted">
            Marketer · {plural(m.mine.length, 'hospital')} · {plural(m.myAgentIds.size, 'PR agent')}
          </span>
          <span className="block text-[12.5px] text-muted">{me.email || 'No email on record'}</span>
        </span>
      </Card>
      <Card className="mb-3">
        <p className="mb-2 text-[14px] font-bold text-ink">What you see, and what you don't</p>
        <ul className="space-y-1.5 text-[13.5px] text-ink-2">
          <li>✓ Your hospitals: patients and the amount each one generated</li>
          <li>✓ The PR agents at your hospitals, how often they refer, and how many of their patients came</li>
          <li>✓ Your monthly and weekly targets, your progress and the branch ranking</li>
          <li>✗ What a single PR agent generated, or their commission</li>
          <li>✗ Patient names or details</li>
          <li>✗ Billing, payments and the front desk</li>
        </ul>
      </Card>
      <Card className="flex items-center gap-3">
        <Sticker name="bell" size={36} />
        <p className="text-[13px] text-muted">Sign-in, push notifications and syncing between phones arrive when the cloud database is connected. Your manager sets your hospitals and target.</p>
      </Card>
    </Page>
  );
}
