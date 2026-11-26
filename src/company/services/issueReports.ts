// GENERATED from the STANLEY desktop app (src/services/issueReports.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Reports (owner, 2026-11-26): complaints and issues sent to the branch or
 * the company, by PR agents (often passing on what a patient said) or by
 * staff. For example: the front desk spoke rudely to a patient, a result was
 * not clear or did not show what the doctor needed, a patient was charged
 * more than the quote, a long wait, no power, a problem with the app, or a
 * question about a month's payout.
 *
 * Who sees a report depends on what it is about (its "grade"), not only on
 * who it was sent to:
 *   • about the front desk           → Branch Manager and Company Admin
 *                                       (never the front desk itself),
 *   • about the Branch Manager       → Company Admin only,
 *   • a month's payout, billing, app → Branch Manager and Company Admin,
 *   • results, waiting, the building → front desk, Branch Manager, Company Admin.
 * The Company Admin sees every report. Each report has a priority (Critical,
 * High, Normal) so the critical ones get attention first.
 *
 * A report is New, then Attended (someone is looking into it), then Resolved
 * (with what was done). It can be reopened. Every step is kept in its history
 * and written to the audit log. The PR agent who sent it follows its status
 * in their app.
 *
 * Saved on this device until the cloud connection carries reports between
 * the apps; until then the pages start with sample reports.
 */
import { useSyncExternalStore } from "react";
import { ACTIVE_BRANCHES } from "@company/data/company";
import { BASELINE_AGENTS } from "@company/data/userRecords";
import { branchPrefix } from "@company/services/billing";

export type ReportTo = "admin" | "manager" | "frontdesk";
export type ReportStatus = "new" | "attended" | "resolved";
export type ReportPriority = "critical" | "high" | "normal";
export type ReportCategory = "Staff conduct" | "Results" | "Billing and prices" | "Waiting time" | "Facility" | "App problem" | "Monthly payout" | "Other";
/** What the report is about: decides who sees it. */
export type AboutKind = "frontdesk" | "manager" | "staff" | "service" | "billing" | "waiting" | "facility" | "app" | "payout" | "other";

export const REPORT_CATEGORIES: ReportCategory[] = ["Staff conduct", "Results", "Billing and prices", "Waiting time", "Facility", "App problem", "Monthly payout", "Other"];
export const TO_TEXT: Record<ReportTo, string> = { admin: "Company Admin", manager: "Branch Manager", frontdesk: "Front desk" };
export const STATUS_TEXT: Record<ReportStatus, string> = { new: "New", attended: "Attended", resolved: "Resolved" };
export const PRIORITY_TEXT: Record<ReportPriority, string> = { critical: "Critical", high: "High", normal: "Normal" };

/** The choices a person picks from ("What is it about?"), with the type and who handles it. */
export const ABOUT: { kind: AboutKind; label: string; category: ReportCategory; to: ReportTo; hint: string }[] = [
  { kind: "frontdesk", label: "The front desk (a receptionist)", category: "Staff conduct", to: "manager", hint: "Goes to the Branch Manager and the Company Admin. The front desk does not see it." },
  { kind: "staff", label: "Another staff member (lab, imaging …)", category: "Staff conduct", to: "manager", hint: "Goes to the Branch Manager and the Company Admin." },
  { kind: "manager", label: "The Branch Manager", category: "Staff conduct", to: "admin", hint: "Goes to the Company Admin only." },
  { kind: "service", label: "A result or a test", category: "Results", to: "frontdesk", hint: "The front desk, the Branch Manager and the Company Admin see it." },
  { kind: "waiting", label: "Waiting time", category: "Waiting time", to: "manager", hint: "The front desk, the Branch Manager and the Company Admin see it." },
  { kind: "billing", label: "Billing or a price", category: "Billing and prices", to: "manager", hint: "Goes to the Branch Manager and the Company Admin." },
  { kind: "facility", label: "The building, power or equipment", category: "Facility", to: "manager", hint: "The front desk, the Branch Manager and the Company Admin see it." },
  { kind: "app", label: "The app", category: "App problem", to: "admin", hint: "Goes to the Company Admin and the Branch Manager." },
  { kind: "payout", label: "A month's payout", category: "Monthly payout", to: "manager", hint: "Goes to the Branch Manager and the Company Admin." },
  { kind: "other", label: "Something else", category: "Other", to: "manager", hint: "The front desk, the Branch Manager and the Company Admin see it." },
];

/** Who may see a report about this. The Company Admin always does. */
export function audienceFor(kind: AboutKind): ReportTo[] {
  switch (kind) {
    case "frontdesk":
    case "staff":
    case "billing":
    case "payout":
    case "app":
      return ["manager", "admin"];
    case "manager":
      return ["admin"];
    default:
      return ["frontdesk", "manager", "admin"];
  }
}

export interface ReportStep {
  at: string;
  by: string;
  action: string;
  note?: string;
}
export interface IssueReport {
  id: string;
  branchId: string;
  at: string;
  from: { kind: "agent" | "staff"; name: string; role: string; agentId?: number };
  /** Who handles it first. */
  to: ReportTo;
  category: ReportCategory;
  aboutKind: AboutKind;
  /** Who can see it (from aboutKind). */
  seenBy: ReportTo[];
  priority: ReportPriority;
  subject: string;
  details: string;
  /** Referral or patient ID it is about, when there is one. */
  patientRef?: string;
  /** Who or what it is about, in words ("Front desk", a name, a test …). */
  about?: string;
  /** A month's payout: the month ("2026-10"). */
  month?: string;
  status: ReportStatus;
  history: ReportStep[];
  /** People who have opened it ("role|name"): it stays "new" for everyone else until they open it. */
  readBy?: string[];
  /** Older saved reports. */
  urgent?: boolean;
}

const KEY = "stanley.reports.v1";
const listeners = new Set<() => void>();
let state: IssueReport[] | null = null;

const kindFromText = (r: Partial<IssueReport>): AboutKind => {
  if (r.aboutKind) return r.aboutKind;
  const a = (r.about ?? "").toLowerCase();
  if (a.includes("front desk") || a.includes("receptionist")) return "frontdesk";
  if (a.includes("manager")) return "manager";
  const c = r.category;
  return c === "Results" ? "service" : c === "Billing and prices" ? "billing" : c === "Waiting time" ? "waiting" : c === "Facility" ? "facility" : c === "App problem" ? "app" : c === "Monthly payout" ? "payout" : c === "Staff conduct" ? "staff" : "other";
};
/** Fill in the newer fields on reports saved before them. */
function normalise(r: IssueReport): IssueReport {
  const aboutKind = kindFromText(r);
  return { ...r, aboutKind, seenBy: r.seenBy ?? audienceFor(aboutKind), priority: r.priority ?? (r.urgent ? "high" : "normal") };
}
function load(): IssueReport[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as IssueReport[]).map(normalise);
  } catch {
    /* fall back to the sample */
  }
  return sampleReports();
}
function commit(next: IssueReport[]) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
}
const current = () => (state ??= load());
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = null;
      listeners.forEach((l) => l());
    }
  });

export function useIssueReports(): IssueReport[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
  );
}

/** Which reports a person may see: by what each report is about, never a report about themselves. */
export function visibleReports(list: IssueReport[], who: { kind: "admin" | "manager" | "staff"; branchId: string | null }, scope: string[] | null): IssueReport[] {
  return list.filter((r) => {
    if (who.kind === "admin") return !scope || scope.includes(r.branchId);
    if (r.branchId !== who.branchId) return false;
    return r.seenBy.includes(who.kind === "manager" ? "manager" : "frontdesk");
  });
}
/** A PR agent's own reports. */
export const reportsOfAgent = (list: IssueReport[], agentId: number) => list.filter((r) => r.from.kind === "agent" && r.from.agentId === agentId);
/** Open (not resolved) first, critical first, then newest. */
export const byAttention = (a: IssueReport, b: IssueReport) => {
  const open = (r: IssueReport) => (r.status === "resolved" ? 1 : 0);
  const pr = (r: IssueReport) => (r.priority === "critical" ? 0 : r.priority === "high" ? 1 : 2);
  return open(a) - open(b) || pr(a) - pr(b) || b.at.localeCompare(a.at);
};

const nextId = (list: IssueReport[]) => `RPT-${String(list.reduce((n, r) => Math.max(n, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(5, "0")}`;

export function addReport(r: Omit<IssueReport, "id" | "at" | "status" | "history" | "seenBy" | "category"> & { category?: ReportCategory }, by: string): IssueReport {
  const list = current();
  const at = new Date().toISOString();
  const about = ABOUT.find((x) => x.kind === r.aboutKind);
  const rep: IssueReport = { ...r, category: r.category ?? about?.category ?? "Other", seenBy: audienceFor(r.aboutKind), id: nextId(list), at, status: "new", history: [{ at, by, action: "Report sent" }] };
  commit([rep, ...list]);
  return rep;
}

/** Who is reading, for the "new" mark. */
export const readerId = (u: { role: string; name: string }) => `${u.role}|${u.name}`;
/** New for this person: not attended yet and they haven't opened it (their own reports are never new to them). */
export const isNewFor = (r: IssueReport, me: string) => r.status === "new" && !(r.readBy ?? []).includes(me) && `${r.from.role}|${r.from.name}` !== me;
export function markReportRead(id: string, me: string) {
  const r = current().find((x) => x.id === id);
  if (!r || (r.readBy ?? []).includes(me)) return;
  commit(current().map((x) => (x.id === id ? { ...x, readBy: [...(x.readBy ?? []), me] } : x)));
}

export function setReportStatus(id: string, status: ReportStatus, by: string, note?: string) {
  const action = status === "attended" ? "Marked attended" : status === "resolved" ? "Resolved" : "Reopened";
  commit(current().map((r) => (r.id === id ? { ...r, status, history: [...r.history, { at: new Date().toISOString(), by, action, note: note?.trim() || undefined }] } : r)));
}
export function setReportPriority(id: string, priority: ReportPriority, by: string) {
  commit(current().map((r) => (r.id === id ? { ...r, priority, history: [...r.history, { at: new Date().toISOString(), by, action: `Priority set to ${PRIORITY_TEXT[priority]}` }] } : r)));
}
export function addReportNote(id: string, by: string, note: string) {
  commit(current().map((r) => (r.id === id ? { ...r, history: [...r.history, { at: new Date().toISOString(), by, action: "Note added", note: note.trim() }] } : r)));
}

/* ─────────────── sample reports (until the cloud connection) ─────────────── */

const SAMPLES: { kind: AboutKind; priority: ReportPriority; subject: string; details: string; about?: string; ref?: boolean; resolution: string }[] = [
  { kind: "frontdesk", priority: "critical", subject: "Patient says she was spoken to rudely at the front desk", details: "My patient told me the receptionist shouted at her when she asked why the scan costs more than she expected, and would not explain. She was upset and nearly left without doing the test.", about: "Front desk", ref: true, resolution: "Spoke with the receptionist on duty and apologised to the patient by phone. Front desk reminded to explain prices calmly." },
  { kind: "service", priority: "high", subject: "Result is not clear enough for the doctor", details: "The doctor says the report does not state the liver size, which he needs for the follow up. Please ask the radiologist to add it.", ref: true, resolution: "Radiologist added the measurements and the result was resent." },
  { kind: "waiting", priority: "critical", subject: "Patient waited more than two hours", details: "Patient arrived at 9am for a fasting test and was attended to after 11am. She was weak because she had not eaten.", ref: true, resolution: "Fasting patients are now attended to first in the morning." },
  { kind: "billing", priority: "high", subject: "Patient charged more than the price in my app", details: "The app showed the thyroid test at one price but the patient was asked to pay more at the branch.", ref: true, resolution: "Branch price list corrected to match the company price; the patient was refunded the difference." },
  { kind: "facility", priority: "high", subject: "No power during the scan, patient sent home", details: "The generator was off and the patient was asked to come back tomorrow. Please let us know when power is off so we don't send patients.", resolution: "Generator fuel schedule fixed. The branch now marks itself closed in the app during outages." },
  { kind: "app", priority: "normal", subject: "My referral is not showing at the branch", details: "I sent a referral in the morning but the front desk says they cannot see it.", ref: true, resolution: "The PR agent's phone was offline; the referral synced once it reconnected." },
  { kind: "service", priority: "normal", subject: "Please send the result to the doctor, not only the patient", details: "The patient lost her copy. Kindly share the result with the referring doctor through the portal.", ref: true, resolution: "Result shared with the referring doctor." },
  { kind: "staff", priority: "high", subject: "Phlebotomist was impatient with an elderly patient", details: "The patient's daughter complained that her mother was rushed and the sample was taken roughly.", about: "Laboratory", ref: true, resolution: "Discussed with the laboratory team; elderly patients get extra time." },
  { kind: "other", priority: "normal", subject: "Patient wants to change the appointment day", details: "Patient cannot come tomorrow, she will come on Saturday instead.", ref: true, resolution: "Referral marked Coming later for Saturday." },
  { kind: "manager", priority: "high", subject: "Branch manager not answering calls", details: "I have called the branch manager several times about a patient's result with no answer.", about: "Branch Manager", resolution: "Spoke with the branch manager; calls are now returned the same day." },
];

function sampleReports(): IssueReport[] {
  const agents = BASELINE_AGENTS;
  if (!agents.length) return [];
  const out: IssueReport[] = [];
  const now = Date.now();
  let n = 0;
  for (const b of ACTIVE_BRANCHES) {
    SAMPLES.forEach((s, i) => {
      // Spread over the last four weeks: the oldest are resolved, the middle attended, the newest new.
      const ageH = 3 + i * 61 + (b.id.length % 5) * 7;
      const at = new Date(now - ageH * 3_600_000);
      const ag = agents[(i * 37 + 11) % agents.length]!;
      const status: ReportStatus = i < 3 ? "new" : i < 5 ? "attended" : "resolved";
      const about = ABOUT.find((x) => x.kind === s.kind)!;
      const who = about.to === "admin" ? "Company Administrator" : about.to === "manager" ? "Branch Manager" : "Front desk";
      const history: ReportStep[] = [{ at: at.toISOString(), by: ag.name, action: "Report sent" }];
      if (status !== "new") history.push({ at: new Date(at.getTime() + 2 * 3_600_000).toISOString(), by: who, action: "Marked attended" });
      if (status === "resolved") history.push({ at: new Date(at.getTime() + 26 * 3_600_000).toISOString(), by: who, action: "Resolved", note: s.resolution });
      n += 1;
      out.push({
        id: `RPT-${String(n).padStart(5, "0")}`,
        branchId: b.id,
        at: at.toISOString(),
        from: { kind: "agent", name: ag.name, role: "PR agent", agentId: ag.id },
        to: about.to,
        category: about.category,
        aboutKind: s.kind,
        seenBy: audienceFor(s.kind),
        priority: s.priority,
        subject: s.subject,
        details: s.details,
        patientRef: s.ref ? `${branchPrefix(b.id)}-R${String(732_300 + i * 17).padStart(6, "0")}` : undefined,
        about: s.about,
        status,
        history,
      });
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
