/**
 * The marketer's own view (owner, 2026-11-26): every marketer has their own
 * dashboard for the hospitals they are assigned to and every PR agent there.
 * Targets are money (the amount their hospitals generate), monthly and weekly.
 * Hospital-level money only; agents show referral counts and statuses.
 */
import { useEffect, useMemo } from 'react';
import { useApp as useCompany } from '@company/app/AppState';
import { useAgentHealth, useCheckUps } from '@company/services/agentMonitor';
import { staffKey, useAccountAccess } from '@company/services/accountAccess';
import { hospitalFigures, hospitalsOf, marketersOf, monthKey, monthRange, progressFor, seedOwners, shiftMonth, useMarketing } from '@company/services/marketing';
import { getBranch } from '@company/data/company';
import { LEGACY_BRANCH_ID } from '@company/data/legacy';
import { formatMoney } from '@company/shared/format';

export function useBranchMarketing(branchId: string) {
  const { staff, agents } = useCompany();
  const st = useMarketing();
  const access = useAccountAccess();
  const checkUps = useCheckUps();
  const marketers = useMemo(() => marketersOf(staff, branchId, (id) => !!access[staffKey(id)]?.off), [staff, branchId, access]);
  const ids = useMemo(() => new Set(marketers.map((m) => m.id)), [marketers]);
  const branchAgents = useMemo(() => (branchId === LEGACY_BRANCH_ID ? agents : []), [branchId, agents]);
  const hospitals = useMemo(() => hospitalsOf(st, branchId, branchAgents, ids), [st, branchId, branchAgents, ids]);
  // First run on this device: a sample split so the sample marketers have hospitals.
  useEffect(() => seedOwners(branchId, hospitals, marketers.filter((m) => m.status === 'Active').map((m) => m.id)), [branchId, hospitals, marketers]);
  const ym = monthKey();
  const progress = useMemo(() => marketers.map((m) => progressFor(st, branchId, m.id, hospitals, agents, checkUps, ym)), [marketers, st, branchId, hospitals, agents, checkUps, ym]);
  const figs = useMemo(() => hospitalFigures(branchId, monthRange(ym), agents), [branchId, ym, agents]);
  const lastFigs = useMemo(() => hospitalFigures(branchId, monthRange(shiftMonth(ym, -1)), agents), [branchId, ym, agents]);
  const currency = getBranch(branchId)?.currency ?? 'NGN';
  const money = (n: number, compact = true) => formatMoney(n, currency, compact);
  return { st, marketers, hospitals, progress, figs, lastFigs, checkUps, agents, currency, money, ym };
}

export function useMine(branchId: string, marketerId: string) {
  const all = useBranchMarketing(branchId);
  const health = useAgentHealth(branchId);
  const mine = useMemo(() => all.hospitals.filter((h) => h.owner?.marketerId === marketerId), [all.hospitals, marketerId]);
  const myAgentIds = useMemo(() => new Set(mine.flatMap((h) => h.agentIds)), [mine]);
  const myHealth = useMemo(() => health.filter((h) => myAgentIds.has(h.agent.id)), [health, myAgentIds]);
  const my = all.progress.find((p) => p.marketerId === marketerId);
  const history = useMemo(
    () => [-5, -4, -3, -2, -1, 0].map((n) => progressFor(all.st, branchId, marketerId, all.hospitals, all.agents, all.checkUps, shiftMonth(all.ym, n))),
    [all.st, branchId, marketerId, all.hospitals, all.agents, all.checkUps, all.ym],
  );
  return { ...all, mine, myAgentIds, myHealth, healthReady: health.length > 0, my, history, branchId, marketerId };
}

export type Mine = ReturnType<typeof useMine>;

export const first = (name: string) => name.split(/\s+/)[0] ?? name;
export const initials = (n: string) =>
  n
    .replace(/^(dr|nrs|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
export const daysText = (d: number | null) => (d === null ? 'No referral yet' : d === 0 ? 'Referred today' : d === 1 ? 'Referred yesterday' : `Last referral ${d} days ago`);
export const stamp = (iso: string) => `${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
export const plural = (n: number, w: string) => `${n.toLocaleString('en-NG')} ${w}${n === 1 ? '' : 's'}`;
/** A phone number for tel: and WhatsApp (Nigerian numbers to +234). */
export const dial = (phone: string) => phone.replace(/[^\d+]/g, '');
export const waLink = (phone: string) => `https://wa.me/${dial(phone).replace(/^\+/, '').replace(/^0/, '234')}`;
