// GENERATED from the STANLEY desktop app (src/features/settings/admin/orgData.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Real organisation facts for the Settings Center (Overview, Monitoring,
 * Managers). Everything is read from the live stores — branches, staff, bills,
 * drafts, expenses, the audit log — nothing is estimated or invented.
 */
import { useMemo } from "react";
import { useApp } from "@company/app/AppState";
import type { Branch } from "@company/data/types";
import { managerOf, type StaffRecord } from "@company/data/userRecords";
import { useAuditLog, type AuditEntry } from "@company/services/audit";
import { syncQueue, useBilling } from "@company/services/billing";
import { backupOverdue, useConfig } from "@company/services/config";
import { expenseSyncQueue, useExpenses } from "@company/services/expenses";
import { branchGaps, enabledMethods, useBranches } from "@company/services/org";
import { useReceiptProfile } from "@company/services/receiptProfile";
import { useCompanyProfile } from "@company/services/settingsStore";

export interface BranchFacts {
  branch: Branch;
  manager: StaffRecord | undefined;
  staff: StaffRecord[];
  activeStaff: number;
  pendingExpenses: number;
  drafts: number;
  billsToday: number;
  queued: number;
  lastActivity: AuditEntry | undefined;
  gaps: string[];
  paymentMethods: number;
  health: { label: string; tone: "ok" | "attention" | "incomplete" | "disabled" };
}

export function useOrgFacts() {
  const { staff } = useApp();
  const branches = useBranches();
  const billing = useBilling();
  const expenses = useExpenses();
  const audit = useAuditLog();
  const receipt = useReceiptProfile();
  const company = useCompanyProfile();
  const cfg = useConfig();

  return useMemo(() => {
    const today = new Date().toDateString();
    const perBranch: BranchFacts[] = branches.map((b) => {
      const people = staff.filter((s) => s.branchId === b.id && s.status !== "Left");
      const manager = managerOf(staff, b.id);
      const contact = receipt.branches[b.id] ?? { address: "", phone: "" };
      const gaps = branchGaps(b, !!manager, contact);
      const health: BranchFacts["health"] =
        b.status === "Inactive" || b.status === "Suspended"
          ? { label: b.status, tone: "disabled" }
          : b.status === "Pending setup"
            ? { label: "Configuration incomplete", tone: "incomplete" }
            : gaps.length
              ? { label: "Needs attention", tone: "attention" }
              : { label: "Operational", tone: "ok" };
      return {
        branch: b,
        manager,
        staff: people,
        activeStaff: people.filter((s) => s.status === "Active").length,
        pendingExpenses: expenses.filter((e) => e.branchId === b.id && e.status === "Pending").length,
        drafts: billing.drafts.filter((d) => d.branchId === b.id).length,
        billsToday: billing.orders.filter((o) => o.branchId === b.id && new Date(o.createdAt).toDateString() === today).length,
        queued: syncQueue(billing).filter((o) => o.branchId === b.id).length + expenseSyncQueue(expenses).filter((e) => e.branchId === b.id).length,
        lastActivity: audit.find((e) => e.branchId === b.id && e.user !== "System"),
        gaps,
        paymentMethods: enabledMethods(b.id).length,
        health,
      };
    });

    const companyGaps = [
      !receipt.email ? "Company email" : "",
      !company.phone ? "Company phone" : "",
      !company.address ? "Registered address" : "",
      !company.rcNumber ? "CAC (RC) number" : "",
      !company.logo ? "Company logo" : "",
    ].filter(Boolean);

    const managers = staff.filter((s) => s.role === "Branch Manager" && s.status !== "Left");
    return {
      branches,
      perBranch,
      active: branches.filter((b) => b.status === "Active").length,
      inactive: branches.filter((b) => b.status === "Inactive" || b.status === "Suspended").length,
      pendingSetup: branches.filter((b) => b.status === "Pending setup").length,
      managers,
      activeStaff: staff.filter((s) => s.status === "Active").length,
      pendingApprovals: expenses.filter((e) => e.status === "Pending").length,
      queued: syncQueue(billing).length + expenseSyncQueue(expenses).length,
      companyGaps,
      backupOverdue: backupOverdue(cfg),
      lastBackup: cfg.backup.lastAt,
      paymentsOff: perBranch.filter((f) => f.paymentMethods === 0 && f.branch.status === "Active").map((f) => f.branch.name),
    };
  }, [staff, branches, billing, expenses, audit, receipt, company, cfg]);
}
