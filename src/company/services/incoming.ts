// GENERATED from the STANLEY desktop app (src/services/incoming.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Incoming referrals (owner, 2026-11-25; desktop 2026-11-26): every referral
 * PR agents send from the Referrer Portal lands in the branch's folder, on
 * the Branch Manager's and Front Desk's dashboard (desktop and mobile), with
 * a count of the ones still waiting. The Company Admin sees every branch's
 * folder to check how fast each one attends to referred patients.
 *
 *  • Attended = a saved bill carries the referral ID; Bill started = a draft
 *    carries it. Both come from Billing, never set by hand.
 *  • The branch can say Coming later (with the day), Did not come or
 *    Cancelled (services/referralStatus); the PR agent sees it.
 *  • The folder holds this week (from Monday). Older referrals stay in
 *    Referral history, never deleted; a past week's referral nobody updated
 *    closes as Not attended.
 *
 * Referrals reach the branch through the cloud connection; until it exists
 * the folder shows the branch's demo referrals (same agents, tests and prices
 * as the rest of the app). ONE source for both apps: the mobile app copies
 * this file (scripts/sync-company.mjs).
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@company/app/AppState";
import { addDays, isoDate } from "@company/data/demo/generator";
import { patientNameOf } from "@company/data/demo/dailyLines";
import { hospitalKey } from "@company/data/legacy";
import type { AgentRecord } from "@company/data/userRecords";
import { resolveRange, serviceRanking } from "@company/services/analytics";
import { branchPrefix, useBilling, type SelectedService } from "@company/services/billing";
import { useBranchUpdates, type BranchUpdate, type BranchUpdateKind } from "@company/services/referralStatus";

export type Urgency = "Routine" | "Urgent" | "Emergency";
export type IncomingStatus = "waiting" | "billing" | "attended" | BranchUpdateKind;

export interface Incoming {
  id: string;
  branchId: string;
  sentAt: Date;
  patient: { name: string; phone: string; gender: "Male" | "Female"; age: number };
  agentId: number;
  agentName: string;
  hospital: string;
  services: SelectedService[];
  urgency: Urgency;
  indication?: string;
  /** The PR agent's note for the branch, and their voice note (Referrer Portal). */
  note?: string;
  voiceNote?: { duration: number };
  /** A lower price the PR agent asked for (their price calculator); the branch manager approves it at billing. */
  priceAsk?: { amount: number; reason: string };
  status: IncomingStatus;
  /** When the patient was attended (bill saved), and by whom / which invoice. */
  attended?: { at: Date; invoiceNo?: string; by?: string };
  /** The open bill (draft) for this referral. */
  draftId?: string;
  /** What the branch said (Coming later, Did not come, Cancelled). */
  update?: BranchUpdate;
  /** From a past week and never updated: closed as Not attended. */
  closed?: boolean;
}

/** A catalogue service a referral can ask for (priced). */
export interface PoolItem {
  id: number;
  name: string;
  price: number | null;
  /** Category key; shown through `labelOf`. */
  category: string;
}

/** Still to be dealt with: waiting, bill started, or coming later. */
export const isOpen = (r: Incoming) => r.status === "waiting" || r.status === "billing" || r.status === "coming";
/** Monday 00:00 of this week: the folder resets every week. */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export const thisWeek = (list: Incoming[]) => {
  const w = weekStart().getTime();
  return list.filter((r) => r.sentAt.getTime() >= w);
};
export const STATUS_TEXT: Record<IncomingStatus, string> = { waiting: "Waiting", billing: "Bill started", attended: "Attended", coming: "Coming later", no_show: "Did not come", cancelled: "Cancelled" };
export const statusLabel = (r: Incoming) => (r.closed ? "Not attended" : STATUS_TEXT[r.status]);
/** Kept for Referral history (about two months of the demo). */
export const HISTORY_DAYS = 55;
export const DAY_MS = 86_400_000;

export function hash(n: number) {
  let h = (n * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}
const FEMALE = new Set(["Adaeze", "Aisha", "Amaka", "Amina", "Bola", "Chiamaka", "Chioma", "Esther", "Fatima", "Funke", "Grace", "Halima", "Ifeoma", "Joy", "Kemi", "Ladi", "Maryam", "Nkechi", "Ngozi", "Nneka", "Ronke", "Yetunde", "Zainab", "Blessing", "Hauwa", "Rukayat", "Hadiza"]);
const INDICATIONS = ["Persistent cough for three weeks", "Abdominal pain, right upper side", "Follow up after treatment", "Fever and body weakness for five days", "Antenatal check, second trimester", "Routine screening before surgery", "Headache and dizziness", "Painful swelling of the right knee", "Suspected urinary tract infection", "High blood pressure review"];
const ASK_REASONS = ["The patient is short of money for all the tests.", "Pensioner, cannot pay the full price.", "Student, the family is paying."];
const NOTES = ["Patient is fasting since last night.", "Please call me when the results are ready.", "Elderly patient, comes with a relative.", "Patient has an HMO card.", "Repeat test after two weeks of treatment."];

/** Age in words, "12 min ago". */
export function ago(d: Date, now = new Date()) {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** The tests a branch's referrals ask for: its most done priced services (last 60 days), else any priced ones. */
export function rankedPool(branchId: string, items: PoolItem[]): PoolItem[] {
  const range = resolveRange({ key: "custom", from: isoDate(addDays(new Date(), -59)), to: isoDate(new Date()) });
  const byId = new Map(items.map((i) => [i.id, i]));
  const ranked = serviceRanking([branchId], range)
    .map((r) => byId.get(r.id))
    .filter((i): i is PoolItem => !!i && i.price !== null)
    .slice(0, 60);
  return ranked.length ? ranked : items.filter((i) => i.price !== null).slice(0, 60);
}

type Base = Omit<Incoming, "status" | "attended" | "draftId">;

/** The demo referrals PR agents sent to these branches (stable for a given minute). */
export function generateIncoming(branchIds: string[], agents: readonly AgentRecord[], pools: Map<string, PoolItem[]>, labelOf: (key: string) => string, now: Date): Base[] {
  const out: Base[] = [];
  if (!agents.length) return out;
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const branchId of branchIds) {
    const pool = pools.get(branchId) ?? [];
    if (!pool.length) continue;
    const prefix = branchPrefix(branchId);
    const salt = [...branchId].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 9973;
    for (let d = HISTORY_DAYS; d >= 0; d--) {
      const dayStart = today0 - d * DAY_MS;
      const dayNo = Math.floor(dayStart / DAY_MS);
      const n = 4 + (hash(dayNo + salt) % 4);
      for (let k = 0; k < n; k++) {
        const seed = dayNo * 16 + k;
        const h = hash(seed + salt * 1_000_003);
        // Sent between 07:30 and 18:30, spread through the day.
        const sentAt = new Date(dayStart + (7.5 * 60 + Math.floor((k + (h % 100) / 100) * (660 / n))) * 60_000);
        if (sentAt.getTime() > now.getTime()) continue;
        const ag = agents[h % agents.length]!;
        const count = 1 + (h % 3 === 0 ? 1 : 0) + (h % 7 === 0 ? 1 : 0);
        const services: SelectedService[] = [];
        for (let j = 0; j < count; j++) {
          const it = pool[hash(h + j * 7919) % pool.length]!;
          if (!services.some((x) => x.id === it.id)) services.push({ id: it.id, name: it.name, category: labelOf(it.category), price: it.price!, overridePrice: null });
        }
        const name = patientNameOf(700_000 + (h % 900_000));
        const imaging = services.some((x) => !/lab/i.test(x.category));
        out.push({
          id: `${prefix}-R${String(400_000 + (seed % 500_000)).padStart(6, "0")}`,
          branchId,
          sentAt,
          patient: { name, phone: `080${String(hash(h * 5) % 100_000_000).padStart(8, "0")}`, gender: FEMALE.has(name.split(" ")[0]!) ? "Female" : "Male", age: 18 + (h % 58) },
          agentId: ag.id,
          agentName: ag.name,
          hospital: hospitalKey(ag.hospital) || ag.hospital,
          services,
          urgency: h % 23 === 0 ? "Emergency" : h % 6 === 0 ? "Urgent" : "Routine",
          indication: imaging || h % 4 === 0 ? INDICATIONS[h % INDICATIONS.length] : undefined,
          note: h % 5 === 0 || h % 3 === 0 ? NOTES[h % NOTES.length] : undefined,
          voiceNote: h % 3 === 0 ? { duration: 7 + (h % 38) } : undefined,
          priceAsk: h % 7 === 2 && services.reduce((n2, x) => n2 + x.price, 0) > 8000 ? { amount: 1000 * (1 + (h % 3)), reason: ASK_REASONS[h % ASK_REASONS.length]! } : undefined,
        });
      }
    }
  }
  return out;
}

/** Each referral's live status: from the bill (attended / bill started), the branch's update, or its age. */
export function resolveIncoming(base: Base[], billing: ReturnType<typeof useBilling>, updates: Record<string, BranchUpdate>, now: Date): Incoming[] {
  const nowT = now.getTime();
  const week = weekStart(now).getTime();
  return base
    .map((r): Incoming => {
      const order = billing.orders.find((o) => o.branchId === r.branchId && o.referral.referralId === r.id);
      if (order) return { ...r, status: "attended", attended: { at: new Date(order.createdAt), invoiceNo: order.invoiceNo, by: order.createdBy.name } };
      const draft = billing.drafts.find((x) => x.branchId === r.branchId && x.referralId === r.id);
      if (draft) return { ...r, status: "billing", draftId: draft.id };
      const u = updates[r.id.toUpperCase()];
      if (u) return { ...r, status: u.status, update: u };
      // Demo: most patients arrive within a few hours of the referral (the older ones are already attended).
      const h = hash(Number(r.id.replace(/\D/g, "")) + r.branchId.length);
      const arrive = r.sentAt.getTime() + (40 + (h % 200)) * 60_000;
      const age = nowT - r.sentAt.getTime();
      if (age > 150 * 60_000 && h % 4 !== 0 && arrive <= nowT) return { ...r, status: "attended", attended: { at: new Date(arrive) } };
      // A past week's referral that nobody updated is closed as Not attended (it moves to Referral history).
      if (r.sentAt.getTime() < week) return { ...r, status: "no_show", closed: true };
      return { ...r, status: "waiting" };
    })
    .sort((x, y) => y.sentAt.getTime() - x.sentAt.getTime());
}

/**
 * Incoming referrals for these branches, newest first, with their live status.
 * `itemsOf` gives each branch's catalogue (memoise it); `labelOf` a category's name.
 */
export function useIncomingFrom(branchIds: string[], itemsOf: (branchId: string) => PoolItem[], labelOf: (key: string) => string): Incoming[] {
  const { agents } = useApp();
  const billing = useBilling();
  const updates = useBranchUpdates();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const minute = Math.floor(now.getTime() / 60_000);
  const key = branchIds.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pools = useMemo(() => new Map(branchIds.map((id) => [id, rankedPool(id, itemsOf(id))] as const)), [key, itemsOf]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => generateIncoming(branchIds, agents, pools, labelOf, new Date(minute * 60_000)), [agents, pools, labelOf, key, minute]);
  return useMemo(() => resolveIncoming(base, billing, updates, new Date(minute * 60_000)), [base, billing, updates, minute]);
}

export const findIncoming = (list: Incoming[], id: string) => list.find((r) => r.id.toUpperCase() === id.trim().toUpperCase()) ?? null;
