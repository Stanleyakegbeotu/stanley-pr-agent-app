/**
 * Marketer pages (owner, 2026-11-26): Home (target, hospitals, who to follow
 * up, the branch ranking), My hospitals, Report centre and Activity (their
 * own log and months). Hospital-level money only.
 */
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Hospital, Plus, Trophy } from 'lucide-react';
import { PARTNER_STATUS_TEXT, ENTRY_TEXT, monthName, paceWord, type HospitalInfo } from '@company/services/marketing';
import type { AgentHealth } from '@company/services/agentMonitor';
import type { StaffRecord } from '@company/data/userRecords';
import { formatCount, formatMoney } from '@company/shared/format';
import { Sticker } from '@/ui/kit';
import { NEEDS, StatusPill } from './sheets';
import { first, initials, stamp, type Mine } from './data';

type Open = { hospital: (h: HospitalInfo) => void; agent: (a: AgentHealth) => void; register: () => void };

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function Ring({ pct, pace }: { pct: number; pace: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, pct);
  const a = pace * 2 * Math.PI - Math.PI / 2;
  return (
    <svg viewBox="0 0 110 110" className="h-[110px] w-[110px] shrink-0" aria-hidden="true">
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${p * c} ${c}`} transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)' }} />
      {pace < 1 && <line x1={55 + Math.cos(a) * 38} y1={55 + Math.sin(a) * 38} x2={55 + Math.cos(a) * 54} y2={55 + Math.sin(a) * 54} stroke="#ffd166" strokeWidth="3" strokeLinecap="round" />}
      <text x="55" y="53" textAnchor="middle" className="fill-white" style={{ font: '800 24px Inter Variable, sans-serif' }}>
        {Math.round(pct * 100)}%
      </text>
      <text x="55" y="71" textAnchor="middle" className="fill-white/80" style={{ font: '600 10.5px Inter Variable, sans-serif' }}>
        of target
      </text>
    </svg>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[16px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ─────────────── Home ─────────────── */

export function MarketerHome({ m, me, open, go }: { m: Mine; me: StaffRecord; open: Open; go: (p: string) => void }) {
  const p = m.my;
  const due = m.myHealth.filter((a) => a.due).slice(0, 6);
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const left = p ? Math.max(0, p.target - p.patients) : 0;
  const pw = p ? paceWord(p) : null;
  return (
    <div className="pt-2">
      <p className="text-[13px] font-semibold text-muted">{greet()},</p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink">{first(me.name)}</h1>
      <p className="mb-4 text-[13px] text-muted">
        {formatCount(m.mine.length)} hospital{m.mine.length === 1 ? '' : 's'} · {formatCount(m.myAgentIds.size)} PR agents · {monthName(m.ym, true)}
      </p>

      {!m.mine.length ? (
        <div className="mb-5 rounded-[24px] bg-white p-5 text-center ring-1 ring-line/70">
          <Sticker name="hospital" size={56} />
          <p className="mt-3 text-[17px] font-bold text-ink">No hospitals yet</p>
          <p className="mt-1 text-[13.5px] text-muted">Your Branch Manager gives you your hospitals. Every PR agent at them becomes yours, and your target comes from them.</p>
          <button type="button" onClick={open.register} className="press mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-brand-600 px-4 text-[14.5px] font-semibold text-white">
            <Plus size={17} /> Register a new hospital
          </button>
        </div>
      ) : (
        p &&
        pw && (
          <div className="relative mb-5 overflow-hidden rounded-[26px] bg-linear-to-br from-brand-500 to-brand-700 p-5 text-white shadow-[0_16px_40px_rgba(31,111,232,0.35)]">
            <span aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <Ring pct={p.pct} pace={p.pace} />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-white/80">Patients from your hospitals</p>
                <p className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
                  {formatCount(p.patients)} <span className="text-[17px] font-semibold text-white/75">/ {formatCount(p.target)}</span>
                </p>
                <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold">{pw.text}</span>
              </div>
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/15 p-2">
                <p className="text-[18px] font-extrabold">{formatCount(left)}</p>
                <p className="text-[11px] text-white/80">{left ? 'still to go' : 'target reached'}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-2">
                <p className="text-[18px] font-extrabold">{daysLeft}</p>
                <p className="text-[11px] text-white/80">days left</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-2">
                <p className="flex items-center justify-center gap-0.5 text-[18px] font-extrabold">
                  {p.patients >= p.lastMonthSoFar ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {formatCount(Math.abs(p.patients - p.lastMonthSoFar))}
                </p>
                <p className="text-[11px] text-white/80">vs last month</p>
              </div>
            </div>
            <p className="relative mt-3 text-[12.5px] text-white/85">
              Your hospitals generated <b className="text-white">{formatMoney(p.revenue, m.currency, true)}</b> this month. The yellow mark is where an even pace would put you today.
            </p>
          </div>
        )
      )}

      {m.mine.length > 0 && (
        <Section
          title="Follow up this week"
          action={
            <button type="button" onClick={() => go('hospitals')} className="text-[13px] font-semibold text-brand-600">
              All agents
            </button>
          }
        >
          <div className="rounded-[22px] bg-white p-1.5 ring-1 ring-line/70">
            {!m.healthReady ? (
              <p className="px-3 py-3 text-[13px] text-muted">Working out who needs you…</p>
            ) : due.length ? (
              due.map((a) => (
                <button key={a.agent.id} type="button" onClick={() => open.agent(a)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff1de] text-[12.5px] font-bold text-[#b45309]">{initials(a.agent.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{a.agent.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {a.hospital} · {a.action}
                    </span>
                  </span>
                  <StatusPill s={a.status} />
                </button>
              ))
            ) : (
              <p className="flex items-center gap-2 px-3 py-3 text-[13.5px] text-good-ink">
                <Sticker name="check" size={26} /> Everyone who was slipping or quiet has been followed up.
              </p>
            )}
          </div>
        </Section>
      )}

      {m.mine.length > 0 && (
        <Section
          title="Your hospitals this month"
          action={
            <button type="button" onClick={() => go('hospitals')} className="text-[13px] font-semibold text-brand-600">
              See all
            </button>
          }
        >
          <div className="space-y-2">
            {[...m.mine]
              .sort((a, b) => (m.figs.get(b.key)?.patients ?? 0) - (m.figs.get(a.key)?.patients ?? 0))
              .slice(0, 4)
              .map((h) => (
                <HospitalRow key={h.key} h={h} m={m} onOpen={() => open.hospital(h)} />
              ))}
          </div>
        </Section>
      )}

      <Section title="Branch marketers this month">
        <div className="rounded-[22px] bg-white p-2 ring-1 ring-line/70">
          {[...m.progress]
            .sort((a, b) => b.pct - a.pct)
            .map((pr, i) => {
              const who = m.marketers.find((x) => x.id === pr.marketerId);
              const isMe = pr.marketerId === me.id;
              return (
                <div key={pr.marketerId} className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${isMe ? 'bg-brand-50' : ''}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${i === 0 ? 'bg-[#ffd166] text-[#6b4a00]' : 'bg-page text-ink-2'}`}>{i === 0 ? <Trophy size={14} /> : i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">
                      {who?.name ?? 'Marketer'}
                      {isMe ? ' (you)' : ''}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-page">
                      <i className={`block h-full rounded-full ${pr.pct >= 1 ? 'bg-[#22a06b]' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, pr.pct * 100)}%` }} />
                    </span>
                  </span>
                  <span className="w-12 text-right text-[14px] font-bold text-ink">{Math.round(pr.pct * 100)}%</span>
                </div>
              );
            })}
        </div>
        <p className="mt-2 px-1 text-[12px] text-muted">Each marketer against their own target. Your manager and the Company Admin see the same.</p>
      </Section>

      {m.history.length > 0 && m.mine.length > 0 && (
        <Section title="Your last six months">
          <div className="rounded-[22px] bg-white p-4 ring-1 ring-line/70">
            <div className="grid h-36 grid-cols-6 items-end gap-2">
              {m.history.map((h) => {
                const max = Math.max(...m.history.map((x) => Math.max(x.patients, x.target)), 1);
                return (
                  <div key={h.month} className="flex h-full flex-col items-center justify-end gap-1">
                    <span className="flex h-full w-full items-end justify-center gap-[3px]">
                      <i className="w-2.5 rounded-t bg-page ring-1 ring-line" style={{ height: `${(h.target / max) * 100}%` }} />
                      <i className={`w-2.5 rounded-t ${h.patients >= h.target ? 'bg-[#22a06b]' : 'bg-brand-500'}`} style={{ height: `${(h.patients / max) * 100}%` }} />
                    </span>
                    <span className="text-[10.5px] font-semibold text-muted">{monthName(h.month).split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-muted">Blue: patients. Outline: target. Green: target reached.</p>
          </div>
        </Section>
      )}
    </div>
  );
}

function HospitalRow({ h, m, onOpen }: { h: HospitalInfo; m: Mine; onOpen: () => void }) {
  const f = m.figs.get(h.key);
  const lf = m.lastFigs.get(h.key);
  const need = m.myHealth.filter((a) => a.hospital === h.key && NEEDS.includes(a.status)).length;
  const diff = (f?.patients ?? 0) - (lf?.patients ?? 0);
  return (
    <button type="button" onClick={onOpen} className="press flex w-full items-center gap-3 rounded-[20px] bg-white p-3 text-left ring-1 ring-line/70">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Hospital size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-ink">{h.key}</span>
        <span className="block truncate text-[12px] text-muted">
          {formatCount(h.agentIds.length)} agent{h.agentIds.length === 1 ? '' : 's'}{need ? ` · ${need} need you` : ''}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-[15px] font-bold text-ink">{formatCount(f?.patients ?? 0)} patients</span>
        <span className="block text-[11.5px] text-muted">
          {formatMoney(f?.revenue ?? 0, m.currency, true)}
          <span className={diff < 0 ? 'text-[#b42318]' : diff > 0 ? 'text-good-ink' : ''}> {diff === 0 ? '' : `${diff > 0 ? '+' : ''}${diff}`}</span>
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </button>
  );
}

/* ─────────────── My hospitals ─────────────── */

export function MarketerHospitals({ m, open }: { m: Mine; open: Open }) {
  const total = m.mine.reduce((s, h) => ({ patients: s.patients + (m.figs.get(h.key)?.patients ?? 0), revenue: s.revenue + (m.figs.get(h.key)?.revenue ?? 0) }), { patients: 0, revenue: 0 });
  return (
    <div className="pt-2">
      <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-ink">My hospitals</h1>
      <p className="mb-4 text-[13px] text-muted">Every PR agent at these hospitals is yours. Totals are per hospital only.</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] font-medium text-muted">Patients this month</p>
          <p className="text-[22px] font-extrabold text-ink">{formatCount(total.patients)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-line/70">
          <p className="text-[11.5px] font-medium text-muted">Amount generated</p>
          <p className="text-[22px] font-extrabold text-ink">{formatMoney(total.revenue, m.currency, true)}</p>
        </div>
      </div>
      {m.mine.length ? (
        <div className="space-y-2">
          {[...m.mine]
            .sort((a, b) => b.agentIds.length - a.agentIds.length)
            .map((h) => (
              <HospitalRow key={h.key} h={h} m={m} onOpen={() => open.hospital(h)} />
            ))}
        </div>
      ) : (
        <p className="rounded-[20px] bg-white p-4 text-[13.5px] text-muted ring-1 ring-line/70">No hospitals yet. Your Branch Manager gives you your hospitals.</p>
      )}
      <button type="button" onClick={open.register} className="press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14.5px] font-semibold text-brand-700 ring-1 ring-brand-200">
        <Plus size={17} /> Register a new hospital
      </button>
    </div>
  );
}

/* ─────────────── Report centre ─────────────── */

export function MarketerCentre({ m, me, open }: { m: Mine; me: StaffRecord; open: Open }) {
  const mine = m.st.partners.filter((p) => p.marketerId === me.id);
  const PILL = { proposed: 'bg-[#fff1de] text-[#b45309]', partnered: 'bg-[#e6f8ee] text-good-ink', declined: 'bg-page text-muted' } as const;
  return (
    <div className="pt-2">
      <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-ink">Report centre</h1>
      <p className="mb-4 text-[13px] text-muted">Register hospitals and health centres you bring in. Your manager takes them on, and they become yours.</p>
      <button type="button" onClick={open.register} className="press mb-5 flex w-full items-center gap-3 rounded-[22px] bg-linear-to-br from-brand-500 to-brand-700 p-4 text-left text-white">
        <Sticker name="hospital" size={44} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Register a new partner</span>
          <span className="block text-[12.5px] text-white/80">Hospital, health centre, clinic or maternity</span>
        </span>
        <Plus size={22} />
      </button>
      <Section title="What you have registered">
        {mine.length ? (
          <div className="space-y-2">
            {mine.map((p) => (
              <div key={p.id} className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-ink">{p.name}</span>
                    <span className="block text-[12px] text-muted">
                      {p.code} · {p.kind}
                      {p.area ? ` · ${p.area}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${PILL[p.status]}`}>{PARTNER_STATUS_TEXT[p.status]}</span>
                </div>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  Registered {stamp(p.at)}
                  {p.decidedBy ? ` · decided by ${p.decidedBy}` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[20px] bg-white p-4 text-[13.5px] text-muted ring-1 ring-line/70">Nothing registered yet.</p>
        )}
      </Section>
    </div>
  );
}

/* ─────────────── Activity (their own log and months) ─────────────── */

export function MarketerActivity({ m, me }: { m: Mine; me: StaffRecord }) {
  const [tab, setTab] = useState<'log' | 'months'>('log');
  const agentName = (id: number) => m.agents.find((a) => a.id === id)?.name ?? `PR agent #${id}`;
  const items = [
    ...m.st.entries.filter((e) => e.marketerId === me.id).map((e) => ({ at: e.at, title: e.hospital ? `${ENTRY_TEXT[e.kind]} · ${e.hospital}` : ENTRY_TEXT[e.kind], text: e.text, by: e.by })),
    ...m.checkUps.filter((c) => c.by.name === me.name).map((c) => ({ at: c.at, title: `${c.kind} with ${agentName(c.agentId)}`, text: `${c.outcome}${c.note ? ` · ${c.note}` : ''}`, by: c.by.name })),
    ...m.st.ownerHistory.filter((h) => h.to === me.id || h.from === me.id).map((h) => ({ at: h.at, title: h.to === me.id ? `${h.hospital} is now yours` : `${h.hospital} moved to another marketer`, text: h.reason, by: h.by })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const days = new Map<string, typeof items>();
  for (const it of items) {
    const d = new Date(it.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    days.set(d, [...(days.get(d) ?? []), it]);
  }
  return (
    <div className="pt-2">
      <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-ink">Activity</h1>
      <p className="mb-4 text-[13px] text-muted">Everything you have logged, and how each month went. Your manager sees the same.</p>
      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1 ring-1 ring-line">
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
      {tab === 'log' ? (
        items.length ? (
          [...days.entries()].slice(0, 30).map(([d, list]) => (
            <div key={d} className="mb-4">
              <p className="mb-1.5 px-1 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">{d}</p>
              <div className="space-y-1.5">
                {list.map((it, i) => (
                  <div key={i} className="rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-line/70">
                    <p className="text-[14px] font-semibold text-ink">{it.title}</p>
                    {it.text && <p className="text-[13px] text-ink-2">{it.text}</p>}
                    <p className="text-[11.5px] text-muted">
                      {new Date(it.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {it.by === me.name ? 'you' : it.by}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-[20px] bg-white p-4 text-[13.5px] text-muted ring-1 ring-line/70">Nothing logged yet. Follow-ups, visits, new PR agents and new hospitals show here.</p>
        )
      ) : (
        <div className="space-y-2">
          {[...m.history].reverse().map((h) => (
            <div key={h.month} className="rounded-[20px] bg-white p-3.5 ring-1 ring-line/70">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-bold text-ink">{monthName(h.month, true)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${h.pct >= 1 ? 'bg-[#e6f8ee] text-good-ink' : h.month === m.ym ? 'bg-brand-50 text-brand-700' : 'bg-[#ffe4e4] text-[#b42318]'}`}>{h.pct >= 1 ? 'Reached' : h.month === m.ym ? 'This month' : 'Missed'}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">
                <b className="text-ink">{formatCount(h.patients)}</b> of {formatCount(h.target)} patients ({Math.round(h.pct * 100)}%) · {formatCount(h.followUps)} follow-ups · {formatCount(h.recruits)} recruits
              </p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-page">
                <i className={`block h-full rounded-full ${h.pct >= 1 ? 'bg-[#22a06b]' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, h.pct * 100)}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
