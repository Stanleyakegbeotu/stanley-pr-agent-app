// Copy the STANLEY desktop app's company logic (data, demo activity, finance,
// commission, staff, permissions, settings, audit...) into src/company/, so the
// mobile Admin / Manager / Front Desk dashboards compute every figure exactly
// like the desktop. ONE source: the desktop repo. Re-run after desktop changes:
//
//   node scripts/sync-company.mjs            (desktop repo next to this one)
//   node scripts/sync-company.mjs <desktopSrcPath>
//
// Only plain logic files are copied (no desktop screens or styles). Imports
// "@/x" become "@company/x". app/router.ts is NOT copied: the mobile app keeps
// its own adapter (src/company/app/router.ts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'src', 'company');
const SRC = process.argv[2] ?? path.join(here, '..', '..', 'Stanley Admin Dashboard Designs', 'src');

/** Entry points: the admin pages' logic. Everything they import is copied too. */
const ENTRIES = [
  'app/AppState.tsx',
  'services/analytics.ts',
  'services/finance.ts',
  'services/commission.ts',
  'services/org.ts',
  'services/settingsStore.ts',
  'services/permissions.ts',
  'services/expenses.ts',
  'services/notifications.ts',
  'services/audit.ts',
  'services/billing.ts',
  'services/insights.ts',
  'data/demo/dailyLines.ts',
  'data/demo/records.ts',
  'data/userRecords.ts',
  'data/geo/countries.ts',
  'services/config.ts',
  'services/receiptProfile.ts',
  'data/serviceGuide/index.ts',
  // Reports: the same report definitions, document model, page layout and print styles,
  // so a report made on the phone is identical to the desktop's (print, PDF, spreadsheet).
  'features/reports/specs.ts',
  'features/reports/model.ts',
  'features/reports/access.ts',
  'features/reports/ReportPages.tsx',
  'features/reports/reportCss.ts',
  // Settings: the organisation facts behind Overview, Branch management and Monitoring.
  'features/settings/admin/orgData.ts',
];
const KEEP_MOBILE = new Set(['app/router.ts']);

const exts = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.join(path.dirname(from), spec);
  else return null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const e of exts) if (fs.existsSync(base + e)) return base + e;
  throw new Error(`Can't resolve ${spec} from ${from}`);
}
const seen = new Set();
function walk(f) {
  if (seen.has(f)) return;
  seen.add(f);
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const r = resolve(f, m[1] || m[2] || m[3]);
    if (r) walk(r);
  }
}
if (!fs.existsSync(SRC)) throw new Error(`Desktop source not found: ${SRC}`);
ENTRIES.forEach((e) => walk(path.join(SRC, e)));

let copied = 0;
for (const abs of seen) {
  const rel = path.relative(SRC, abs).replace(/\\/g, '/');
  if (KEEP_MOBILE.has(rel)) continue;
  const text = fs
    .readFileSync(abs, 'utf8')
    .replace(/(from\s*['"]|import\s*\(\s*['"]|import\s*['"])@\//g, '$1@company/');
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `// GENERATED from the STANLEY desktop app (src/${rel}). Do not edit here: change the desktop file and run scripts/sync-company.mjs.\n${text}`);
  copied++;
}
console.log(`Copied ${copied} files from ${SRC} into src/company/`);
