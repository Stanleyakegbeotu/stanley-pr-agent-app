// GENERATED from the STANLEY desktop app (src/features/reports/ReportPages.tsx). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Report pages: the same markup renders the in-app preview and the print
 * document. Pagination is computed from measured heights (title block, rows,
 * table headers), so a row is never split or cut, table headers repeat on
 * every page, and "continued" labels show where a table carries over.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PAGE_MARGIN, paperPx, type Cell, type Column, type Paper, type ReportDoc, type TableBlock } from "./model";

export type Frag =
  | { k: "head" }
  | { k: "block"; b: number }
  | { k: "table"; b: number; from: number; to: number; title: boolean; cont: boolean; total: boolean };

export interface Page {
  frags: Frag[];
}

/* ─────────────── Building blocks ─────────────── */

const cls = (c: Cell, col?: Column) => [col?.align === "right" ? "r" : "", c.b ? "b" : "", c.tone ?? ""].filter(Boolean).join(" ") || undefined;

function Cols({ columns }: { columns: Column[] }) {
  const total = columns.reduce((s, c) => s + (c.weight ?? 1), 0);
  return (
    <colgroup>
      {columns.map((c) => (
        <col key={c.key} style={{ width: `${((c.weight ?? 1) / total) * 100}%` }} />
      ))}
    </colgroup>
  );
}

function Head({ columns }: { columns: Column[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c) => (
          <th key={c.key} className={c.align === "right" ? "r" : undefined}>
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Row({ row, columns }: { row: Cell[]; columns: Column[] }) {
  return (
    <tr>
      {row.map((c, i) => (
        <td key={i} className={cls(c, columns[i])}>
          {c.t}
        </td>
      ))}
    </tr>
  );
}

export function DocHead({ doc }: { doc: ReportDoc }) {
  return (
    <div className="rp-block">
      <div className="rp-head">
        <h1>{doc.title}</h1>
        <p>{doc.subtitle}</p>
      </div>
      <dl className="rp-meta">
        {doc.meta.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BlockView({ doc, b }: { doc: ReportDoc; b: number }) {
  const block = doc.blocks[b];
  if (block.kind === "heading")
    return (
      <div className="rp-block">
        <div className="rp-h2">
          {block.text}
          {block.sub && <small>{block.sub}</small>}
        </div>
      </div>
    );
  if (block.kind === "note")
    return (
      <div className="rp-note" data-kind="note">
        {block.text}
      </div>
    );
  if (block.kind === "summary")
    return (
      <div className="rp-block">
        {block.title && <div className="rp-summary-title">{block.title}</div>}
        <div className="rp-summary">
          {block.items.map((i) => (
            <div className="rp-sum" key={i.label}>
              <span>{i.label}</span>
              <b className={i.tone === "bad" ? "bad" : undefined}>{i.value}</b>
              {i.note && <small>{i.note}</small>}
            </div>
          ))}
        </div>
      </div>
    );
  return null;
}

function TablePart({ t, from, to, title, cont, total }: { t: TableBlock; from: number; to: number; title: boolean; cont: boolean; total: boolean }) {
  return (
    <div className="rp-block">
      {title && t.title && (
        <div className="rp-tt">
          {t.title}
          {t.subtitle && <small>{t.subtitle}</small>}
        </div>
      )}
      {cont && <div className="rp-cont">{t.title ? `${t.title} — continued` : "Continued"}</div>}
      <table className="rp-table">
        <Cols columns={t.columns} />
        <Head columns={t.columns} />
        <tbody>
          {t.rows.length === 0 ? (
            <tr>
              <td colSpan={t.columns.length} className="rp-empty">
                {t.empty ?? "No records in this period."}
              </td>
            </tr>
          ) : (
            t.rows.slice(from, to).map((r, i) => <Row key={from + i} row={r} columns={t.columns} />)
          )}
        </tbody>
        {total && t.total && (
          <tfoot>
            <Row row={t.total} columns={t.columns} />
          </tfoot>
        )}
      </table>
    </div>
  );
}

function FragView({ doc, f }: { doc: ReportDoc; f: Frag }) {
  if (f.k === "head") return <DocHead doc={doc} />;
  if (f.k === "block") return <BlockView doc={doc} b={f.b} />;
  return <TablePart t={doc.blocks[f.b] as TableBlock} from={f.from} to={f.to} title={f.title} cont={f.cont} total={f.total} />;
}

export function PageView({ doc, page, index, count, paper, company }: { doc: ReportDoc; page: Page; index: number; count: number; paper: Paper; company: string }) {
  const { w, h } = paperPx(paper);
  return (
    <div className="rp-page" style={{ width: w, height: h, padding: PAGE_MARGIN }}>
      <div className="rp-run">
        <span>
          <b>{company}</b> · {doc.title}
        </span>
        <span>{doc.subtitle}</span>
      </div>
      <div className="rp-body">
        {page.frags.map((f, i) => (
          <FragView key={i} doc={doc} f={f} />
        ))}
      </div>
      <div className="rp-foot">
        <span>{doc.footnote}</span>
        <span>
          Page {index + 1} of {count}
        </span>
      </div>
    </div>
  );
}

export function AllPages({ doc, pages, paper, company }: { doc: ReportDoc; pages: Page[]; paper: Paper; company: string }) {
  return (
    <>
      {pages.map((p, i) => (
        <PageView key={i} doc={doc} page={p} index={i} count={pages.length} paper={paper} company={company} />
      ))}
    </>
  );
}

/* ─────────────── Pagination from measured heights ─────────────── */

interface Measured {
  head: number;
  run: number;
  foot: number;
  blocks: Record<number, number>;
  tables: Record<number, { title: number; cont: number; head: number; rows: number[]; total: number; empty: number; gap: number }>;
}

function paginate(doc: ReportDoc, m: Measured, paper: Paper): Page[] {
  const { h } = paperPx(paper);
  // A small safety margin absorbs sub-pixel rounding so the last row never touches the footer.
  const avail = h - 2 * PAGE_MARGIN - m.run - m.foot - 14;
  const pages: Page[] = [{ frags: [] }];
  let used = 0;
  const next = () => {
    pages.push({ frags: [] });
    used = 0;
  };
  const cur = () => pages[pages.length - 1];

  cur().frags.push({ k: "head" });
  used += m.head;

  doc.blocks.forEach((b, bi) => {
    if (b.kind !== "table") {
      const bh = m.blocks[bi] ?? 0;
      // Keep headings with what follows them.
      const keep = b.kind === "heading" ? 90 : 0;
      if (used > 0 && used + bh + keep > avail) next();
      cur().frags.push({ k: "block", b: bi });
      used += bh;
      return;
    }
    const t = m.tables[bi];
    const rows = b.rows.length;
    let i = 0;
    let first = true;
    while (first || i < rows) {
      const fixed = (first && b.title ? t.title : 0) + (!first ? t.cont : 0) + t.head + t.gap;
      const firstRow = rows ? t.rows[i] ?? 0 : t.empty;
      if (used > 0 && used + fixed + firstRow > avail) next();
      used += fixed;
      const from = i;
      if (!rows) used += t.empty;
      while (i < rows && used + t.rows[i] <= avail) used += t.rows[i++];
      if (rows && i === from) used += t.rows[i++]; // a single row taller than the page
      const done = i >= rows;
      let total = false;
      if (done && b.total && used + t.total <= avail) {
        used += t.total;
        total = true;
      }
      cur().frags.push({ k: "table", b: bi, from, to: i, title: first, cont: !first, total });
      first = false;
      if (done && b.total && !total) {
        next();
        cur().frags.push({ k: "table", b: bi, from: rows, to: rows, title: false, cont: true, total: true });
        used += t.cont + t.head + t.total + t.gap;
      }
      if (!done) next();
    }
  });
  return pages;
}

/**
 * Lays the report out on pages. Renders a hidden, page-width copy of every
 * block, measures it and packs the pieces into pages.
 */
export function usePagination(doc: ReportDoc | null, paper: Paper): { pages: Page[] | null; measurer: ReactNode } {
  const ref = useRef<HTMLDivElement>(null);
  // Pages are kept with the document and paper they were laid out for, so a
  // stale layout is never drawn against a newer report.
  const [laid, setLaid] = useState<{ doc: ReportDoc; key: string; pages: Page[] } | null>(null);
  const { w } = paperPx(paper);
  const key = `${paper.size}|${paper.orientation}`;
  const pages = laid && laid.doc === doc && laid.key === key ? laid.pages : null;

  useLayoutEffect(() => {
    const root = ref.current;
    if (!doc || !root) return;
    const hOf = (sel: string) => (root.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0);
    // Height including vertical margins (the running header has a gap below it).
    const outer = (sel: string) => {
      const el = root.querySelector<HTMLElement>(sel);
      if (!el) return 0;
      const cs = getComputedStyle(el);
      return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    };
    const m: Measured = { head: hOf("[data-m=head]"), run: outer(".rp-run"), foot: outer(".rp-foot"), blocks: {}, tables: {} };
    doc.blocks.forEach((b, bi) => {
      if (b.kind !== "table") {
        m.blocks[bi] = hOf(`[data-m=b${bi}]`);
        return;
      }
      const box = root.querySelector<HTMLElement>(`[data-m=t${bi}]`);
      const rows = box ? [...box.querySelectorAll<HTMLElement>("tbody tr")].map((r) => r.getBoundingClientRect().height) : [];
      m.tables[bi] = {
        title: box?.querySelector<HTMLElement>(".rp-tt")?.getBoundingClientRect().height ?? 0,
        cont: hOf("[data-m=cont]"),
        head: box?.querySelector<HTMLElement>("thead")?.getBoundingClientRect().height ?? 0,
        rows: b.rows.length ? rows : [],
        empty: b.rows.length ? 0 : (rows[0] ?? 24),
        total: box?.querySelector<HTMLElement>("tfoot")?.getBoundingClientRect().height ?? 0,
        gap: 12,
      };
    });
    setLaid({ doc, key: `${paper.size}|${paper.orientation}`, pages: paginate(doc, m, paper) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, paper.size, paper.orientation]);

  const measurer = doc ? (
    <div ref={ref} aria-hidden="true" className="rp-measure" style={{ position: "absolute", left: -20000, top: 0, width: w, visibility: "hidden", pointerEvents: "none" }}>
      <div className="rp-page" style={{ width: w, height: "auto", padding: `0 ${PAGE_MARGIN}px` }}>
        <div className="rp-run">
          <span>
            <b>X</b> · {doc.title}
          </span>
          <span>{doc.subtitle}</span>
        </div>
        <div data-m="head">
          <DocHead doc={doc} />
        </div>
        <div className="rp-cont" data-m="cont">
          Continued
        </div>
        {doc.blocks.map((b, bi) =>
          b.kind === "table" ? (
            <div key={bi} data-m={`t${bi}`}>
              <TablePart t={b} from={0} to={b.rows.length} title cont={false} total />
            </div>
          ) : (
            <div key={bi} data-m={`b${bi}`}>
              <BlockView doc={doc} b={bi} />
            </div>
          ),
        )}
        <div className="rp-foot">
          <span>{doc.footnote}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  ) : null;

  return { pages, measurer };
}
