// GENERATED from the STANLEY desktop app (src/shared/format.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
import type { Currency, Money } from "@company/data/types";

const LOCALE: Record<Currency, string> = { NGN: "en-NG", GHS: "en-GH" };

/** Formats one amount in its own currency. Never converts between currencies. */
export function formatMoney(amount: number, currency: Currency, compact = false): string {
  const abs = Math.abs(amount);
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: compact && abs >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: compact && abs >= 10_000 ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Returns the currency entries of a Money value in a stable order (NGN first). */
export function moneyEntries(money: Money): [Currency, number][] {
  const order: Currency[] = ["NGN", "GHS"];
  return order.filter((c) => money[c] !== undefined).map((c) => [c, money[c] as number]);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-NG").format(Math.round(n));
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fullFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

export const formatDay = (d: Date) => dayFmt.format(d);
export const formatFullDate = (d: Date) => fullFmt.format(d);
export const formatShortDate = (d: Date) => shortFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d).replace(" ", " ").toLowerCase();

export function formatRelative(date: Date, now = new Date()): string {
  const mins = Math.round((now.getTime() - date.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatShortDate(date);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
