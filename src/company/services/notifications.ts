// GENERATED from the STANLEY desktop app (src/services/notifications.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Notifications for the bell — generated from the same activity the dashboard
 * shows, one stream per branch, so every figure matches the pages it links to:
 *
 *  • Morning summary (07:00) of the previous day — patients, money in, costs, profit.
 *  • High-value bill — a single visit billed ₦300,000 or more.
 *  • Large unpaid bill — ₦100,000 or more left unpaid at the visit.
 *  • Overdue balances (Mondays) — bills unpaid for more than 14 days.
 *  • Commission payout ready (1st of the month) — last month's PR commission.
 *  • Data notices from the legacy import (unpriced services, hospital codes).
 *
 * Each carries full details and an exact destination. Read state: today's
 * notifications start unread; earlier days are filed as read (they can be
 * marked unread). Kept for the session until the database is connected.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useConfig } from "./config";
import { ACTIVE_BRANCHES, getBranch } from "@company/data/company";
import { CATALOGUE_INVENTORY } from "@company/data/catalogueRules";
import { DAILY, DATA_START, TODAY, addDays, diffDays, isoDate } from "@company/data/demo/generator";
import { openBalances, patientVisits, type PatientVisit } from "@company/data/demo/dailyLines";
import { LEGACY_META, POSSIBLE_DUPLICATE_HOSPITALS } from "@company/data/legacy";
import { dayCommission, rateFor, rateSummary, useCommission } from "./commission";

export type NoteKind = "summary" | "bill" | "unpaid" | "overdue" | "payout" | "data";

export const NOTE_KINDS: { id: NoteKind; label: string }[] = [
  { id: "summary", label: "Daily summaries" },
  { id: "bill", label: "High-value bills" },
  { id: "unpaid", label: "Unpaid bills" },
  { id: "overdue", label: "Overdue balances" },
  { id: "payout", label: "Commission payouts" },
  { id: "data", label: "Data notices" },
];

export interface Note {
  id: string;
  at: Date;
  kind: NoteKind;
  title: string;
  /** One line for lists. */
  summary: string;
  /** Full content for the details pop-up. */
  details: { label: string; value: string }[];
  /** Plain-language explanation shown under the details. */
  note?: string;
  branchId: string | null;
  priority: "high" | "normal";
  /** Exact place the notification points to. */
  route: string;
  /** Where "Go to" leads, in words. */
  target: string;
}

const HIGH_BILL = 300_000;
const BIG_UNPAID = 100_000;
const OVERDUE_DAYS = 14;
const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const dayName = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const at = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);

function visitDetails(v: PatientVisit): { label: string; value: string }[] {
  return [
    { label: "Patient", value: `${v.patientRef} · ${v.isNew ? "new patient" : "returning patient"}` },
    { label: "Visit", value: `${v.id} · ${dayName(v.at)} ${v.at.getFullYear()} · ${v.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` },
    { label: "Tests", value: v.services.map((s) => s.name).join(", ") },
    { label: "Billed", value: ngn(v.billed) },
    { label: "Paid at visit", value: `${ngn(v.paid)}${v.method ? ` · ${v.method}` : ""}` },
    { label: "Balance", value: v.billed - v.paid > 0 ? ngn(v.billed - v.paid) : "Fully paid" },
    { label: "Processed by", value: v.processedBy.name ?? v.processedBy.role },
  ];
}

function generate(): Note[] {
  const notes: Note[] = [];
  const now = new Date();
  const imported = new Date(LEGACY_META.exportedAt);
  const unpriced = CATALOGUE_INVENTORY.filter((i) => i.price === null);
  notes.push(
    {
      id: "N-import",
      at: imported,
      kind: "data",
      title: "Legacy data loaded",
      summary: `${LEGACY_META.counts.inventoryItems} services, ${LEGACY_META.counts.prAgents} PR agents and ${LEGACY_META.counts.distinctHospitals} hospitals are available.`,
      details: [
        { label: "Services", value: String(LEGACY_META.counts.inventoryItems) },
        { label: "PR agents", value: String(LEGACY_META.counts.prAgents) },
        { label: "Hospitals", value: String(LEGACY_META.counts.distinctHospitals) },
        { label: "Source", value: LEGACY_META.sourceDatabase },
      ],
      note: "The legacy records are the read-only baseline. Changes made in STANLEY are kept separately and never overwrite them.",
      branchId: null,
      priority: "normal",
      route: "/inventory",
      target: "Inventory",
    },
    {
      id: "N-unpriced",
      at: imported,
      kind: "data",
      title: `${unpriced.length} services have no price`,
      summary: `${unpriced.map((i) => i.name).join(" and ")} cannot be billed until a price is set.`,
      details: unpriced.map((i) => ({ label: `#${i.id}`, value: `${i.name} · ${i.catalogueCategory}` })),
      note: "Set a price on each service in Inventory before it can be billed.",
      branchId: null,
      priority: "high",
      route: "/inventory?filter=noprice",
      target: "Inventory · services without a price",
    },
    {
      id: "N-hospitals",
      at: imported,
      kind: "data",
      title: "Hospital codes need review",
      summary: `${POSSIBLE_DUPLICATE_HOSPITALS.length} groups of hospital codes look like spelling variants.`,
      details: POSSIBLE_DUPLICATE_HOSPITALS.slice(0, 8).map((g, i) => ({ label: `Group ${i + 1}`, value: g.join(" · ") })),
      note: "Codes are never merged automatically. Confirm each group before changing agent assignments.",
      branchId: null,
      priority: "normal",
      route: "/pr?tab=hospitals",
      target: "PR Management · hospitals",
    },
  );

  for (const b of ACTIVE_BRANCHES) {
    const days = DAILY[b.id] ?? [];
    const yearVisits = patientVisits([b.id], { from: DATA_START, to: TODAY, days: diffDays(DATA_START, TODAY) + 1 });
    // Bills
    for (const v of yearVisits) {
      if (v.at > now) continue;
      if (v.billed >= HIGH_BILL)
        notes.push({
          id: `N-bill-${v.id}`,
          at: v.at,
          kind: "bill",
          title: `High-value bill · ${ngn(v.billed)}`,
          summary: `${v.patientRef} · ${v.services.length} test${v.services.length === 1 ? "" : "s"} · ${v.payment} · ${b.name}`,
          details: visitDetails(v),
          branchId: b.id,
          priority: "normal",
          route: `/patients?branch=${b.id}&visit=${v.id}`,
          target: `Patients · ${b.name} · visit record ${v.id}`,
        });
      else if (v.billed - v.paid >= BIG_UNPAID)
        notes.push({
          id: `N-unpaid-${v.id}`,
          at: v.at,
          kind: "unpaid",
          title: `Large unpaid bill · ${ngn(v.billed - v.paid)}`,
          summary: `${v.patientRef} left ${ngn(v.billed - v.paid)} unpaid of ${ngn(v.billed)} · ${b.name}`,
          details: visitDetails(v),
          note: "Follow up with the patient. Balances are recovered oldest first and show on the Finance page until cleared.",
          branchId: b.id,
          priority: "high",
          route: `/patients?branch=${b.id}&visit=${v.id}`,
          target: `Patients · ${b.name} · visit record ${v.id}`,
        });
    }
    days.forEach((rec, i) => {
      const day = addDays(DATA_START, i);
      // Morning summary of the previous day.
      const deliver = at(addDays(day, 1), 7);
      if (deliver <= now) {
        const income = rec.payments;
        const commission = dayCommission(rec);
        const net = income - rec.expenses - commission;
        notes.push({
          id: `N-sum-${b.id}-${isoDate(day)}`,
          at: deliver,
          kind: "summary",
          title: `${b.name} daily summary · ${dayName(day)}`,
          summary: `${rec.patients} patients · ${ngn(income)} in · net ${ngn(net)}`,
          details: [
            { label: "Patients", value: `${rec.patients} (${rec.newPatients} new, ${rec.referrals} referred)` },
            { label: "Revenue billed", value: ngn(rec.revenue) },
            { label: "Money in", value: `${ngn(income)} (${ngn(rec.paidAtVisit)} at visits · ${ngn(rec.recovered)} recovered)` },
            { label: "Expenses", value: ngn(rec.expenses) },
            { label: "PR commission", value: `${ngn(commission)} · ${rateSummary()}` },
            { label: "Net profit", value: ngn(net) },
            { label: "Outstanding at close", value: ngn(rec.outstanding) },
          ],
          branchId: b.id,
          priority: net < 0 ? "high" : "normal",
          route: `/finance?branch=${b.id}&day=${isoDate(day)}`,
          target: `Finance & Expenses · ${b.name} · ${dayName(day)}`,
        });
      }
      // Overdue balances every Monday at 08:00.
      if (day.getDay() === 1 && at(day, 8) <= now) {
        const old = openBalances(b.id, addDays(day, -1)).filter((x) => x.ageDays > OVERDUE_DAYS);
        if (old.length)
          notes.push({
            id: `N-overdue-${b.id}-${isoDate(day)}`,
            at: at(day, 8),
            kind: "overdue",
            title: `${old.length} bills overdue at ${b.name}`,
            summary: `${ngn(old.reduce((s, x) => s + x.remaining, 0))} owed on bills unpaid for more than ${OVERDUE_DAYS} days`,
            details: [
              { label: `Bills unpaid over ${OVERDUE_DAYS} days`, value: String(old.length) },
              { label: "Still owed", value: ngn(old.reduce((s, x) => s + x.remaining, 0)) },
              { label: "Oldest", value: `${Math.max(...old.map((x) => x.ageDays))} days · ${old[0].visit.patientRef}` },
              { label: "Largest", value: ngn(Math.max(...old.map((x) => x.remaining))) },
            ],
            note: "Open the outstanding balances list to follow up — it shows each patient, visit and amount.",
            branchId: b.id,
            priority: "high",
            route: `/finance?branch=${b.id}&tab=outstanding`,
            target: `Finance & Expenses · ${b.name} · outstanding balances`,
          });
      }
      // Commission payout ready on the 1st (for the previous month).
      if (day.getDate() === 1 && i > 0 && at(day, 9) <= now) {
        const prevStart = new Date(day.getFullYear(), day.getMonth() - 1, 1);
        const month = patientVisits([b.id], { from: prevStart, to: addDays(day, -1), days: diffDays(prevStart, addDays(day, -1)) + 1 }).filter((v) => v.agentId !== null);
        const byAgent = new Map<number, number>();
        for (const v of month) byAgent.set(v.agentId!, (byAgent.get(v.agentId!) ?? 0) + v.billed * rateFor(v.agentId!));
        const total = [...byAgent.values()].reduce((s, x) => s + x, 0);
        const name = prevStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        notes.push({
          id: `N-payout-${b.id}-${isoDate(day)}`,
          at: at(day, 9),
          kind: "payout",
          title: `${name} commission payout ready`,
          summary: `${ngn(total)} to pay ${byAgent.size} PR agents · ${b.name}`,
          details: [
            { label: "Month", value: name },
            { label: "PR agents to pay", value: String(byAgent.size) },
            { label: "Total commission", value: ngn(total) },
            { label: "Referred patients", value: String(month.length) },
            { label: "Rates", value: rateSummary() },
          ],
          note: "Print the monthly payout report — agents are grouped by bank with account details, ready for payment.",
          branchId: b.id,
          priority: "normal",
          route: `/reports?report=agents&variant=payout&month=${isoDate(prevStart).slice(0, 7)}&branch=${b.id}`,
          target: "Reports · PR agents · monthly commission payout",
        });
      }
    });
  }
  return notes.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/* ─────────────── Read state ─────────────── */

let readIds = new Set<string>();
let unreadIds = new Set<string>();
let stateVersion = 0;
const listeners = new Set<() => void>();
const emit = () => {
  stateVersion += 1;
  listeners.forEach((l) => l());
};

const startOfToday = () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
/** Today's notifications (and data notices) start unread; earlier days are filed as read. */
export function isRead(n: Note): boolean {
  if (readIds.has(n.id)) return true;
  if (unreadIds.has(n.id)) return false;
  return n.kind !== "data" && n.at < startOfToday();
}
export function markRead(id: string) {
  unreadIds.delete(id);
  readIds = new Set(readIds).add(id);
  emit();
}
export function markUnread(id: string) {
  readIds.delete(id);
  unreadIds = new Set(unreadIds).add(id);
  emit();
}
export function markAllRead(ids: string[]) {
  const next = new Set(readIds);
  for (const id of ids) {
    next.add(id);
    unreadIds.delete(id);
  }
  readIds = next;
  emit();
}

/* Generated once and shared; rebuilt every few minutes (new arrivals, and "today" rolls over at midnight) or when a commission rate changes. */
const REFRESH_MS = 5 * 60_000;
let cache: { key: string; notes: Note[] } | null = null;
function notesFor(rates: number, bucket: number): Note[] {
  const key = `${rates}|${bucket}|${startOfToday().getTime()}`;
  if (cache?.key !== key) cache = { key, notes: generate() };
  return cache.notes;
}

function useRefreshBucket(): number {
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / REFRESH_MS));
  useEffect(() => {
    const id = window.setInterval(() => setBucket(Math.floor(Date.now() / REFRESH_MS)), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return bucket;
}

/** All notifications (newest first) plus a version that changes when read state changes. */
export function useNotifications(): { notes: Note[]; version: number } {
  const { version: rates } = useCommission();
  const bucket = useRefreshBucket();
  const version = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => stateVersion,
  );
  // Settings → Notifications: only the categories switched on are shown.
  const kinds = useConfig().notifications.kinds;
  const notes = useMemo(() => notesFor(rates, bucket).filter((n) => kinds[n.kind] !== false), [rates, bucket, kinds]);
  return { notes, version };
}

export { startOfToday };

export const branchLabel = (id: string | null) => (id ? `${getBranch(id)?.name ?? id} branch` : "Company-wide");
