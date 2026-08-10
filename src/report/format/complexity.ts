import type { ComplexityResult, FileComplexity } from "../../core/model.js";
import { escapeHtml, excludedNotice, formatNumber } from "./html.js";
import { pushHint, table, wrap } from "./text.js";

export interface ComplexityHtmlOptions {
  title?: string;
}

const HTML_CAP = 1000;

export type ComplexitySort = "raw" | "density";

export interface ComplexityOptions {
  top?: number;
  sort?: ComplexitySort;
  minLines?: number;
  explain?: boolean;
}

export function rankComplexity(
  files: FileComplexity[],
  sort: ComplexitySort,
  minLines: number,
): FileComplexity[] {
  const ranked = files.filter((file) => file.complexity > 0 && file.code >= minLines);
  return sort === "density"
    ? [...ranked].sort((a, b) => b.density - a.density || a.path.localeCompare(b.path))
    : ranked;
}

export function renderComplexity(
  result: ComplexityResult,
  options: ComplexityOptions = {},
): string {
  const topFiles = options.top ?? 20;
  const sort = options.sort ?? "raw";
  const minLines = options.minLines ?? 0;
  const explain = options.explain === true;
  const files = result.files;
  const total = files.reduce((sum, file) => sum + file.complexity, 0);
  const ranked = rankComplexity(files, sort, minLines);

  const out: string[] = [
    `Complexity: ${formatNumber(total)} total   ·   ${formatNumber(ranked.length)} files with complexity`,
  ];

  if (ranked.length === 0) {
    out.push("", "No complexity detected.");
    return out.join("\n");
  }

  const shown = ranked.slice(0, topFiles);
  const share = (part: number, whole: number): string => `${Math.round((part / whole) * 100)}%`;

  const rows = shown.map((file) => [
    file.path,
    formatNumber(file.complexity),
    file.density.toFixed(1),
    `${Math.round(file.concentration)}%`,
    formatNumber(file.code),
    ...(explain
      ? [
          share(file.branch, file.complexity),
          share(file.loop, file.complexity),
          share(file.bool, file.complexity),
        ]
      : []),
  ]);

  const headers = ["File", "Complexity", "Cx/100", "Densest", "Code"];
  out.push(
    "",
    sort === "density" ? "Densest files" : "Most complex files",
    ...table(explain ? [...headers, "Branch", "Loop", "Bool"] : headers, rows),
  );

  const hidden = ranked.length - shown.length;
  if (hidden > 0) {
    out.push(`  … and ${formatNumber(hidden)} more files.`);
  }

  const notice = excludedNotice(result.excluded);
  if (notice !== "") {
    out.push("", ...wrap(notice));
  }

  pushHint(out, "Run with `--html <file>` for a full browsable report.");
  return out.join("\n");
}

export function renderComplexityHtml(
  result: ComplexityResult,
  options: ComplexityHtmlOptions = {},
): string {
  const files = result.files;
  const title = options.title ?? "clines — complexity report";
  const top = HTML_CAP;

  const total = files.reduce((sum, file) => sum + file.complexity, 0);
  const ranked = files.filter((file) => file.complexity > 0);
  const shown = ranked.slice(0, top);
  const hidden = ranked.length - shown.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<h1>Complexity report</h1>
<div class="stats">
${stat(formatNumber(total), "total complexity")}
${stat(formatNumber(ranked.length), "files with complexity")}
${stat(formatNumber(shown.length), `shown (top ${formatNumber(top)})`)}
</div>
</header>

<section>
<h2>Most complex files</h2>
${filesTable(shown)}
${hidden > 0 ? `<p class="muted">… and ${formatNumber(hidden)} more files not shown.</p>` : ""}
</section>

<script>${SCRIPT}</script>
</body>
</html>
`;
}

function filesTable(files: FileComplexity[]): string {
  if (files.length === 0) {
    return `<p class="muted">No complexity detected.</p>`;
  }
  const rows = files
    .map(
      (file, index) =>
        `<tr data-search="${escapeHtml(file.path)}"><td class="n rank">${index + 1}</td><td class="path">${escapeHtml(
          file.path,
        )}</td><td class="lang">${escapeHtml(file.language)}</td><td class="n cx">${formatNumber(
          file.complexity,
        )}</td><td class="n">${formatNumber(file.code)}</td></tr>`,
    )
    .join("\n");
  return `<input id="filter" type="search" placeholder="Filter files by path…" />
<table><thead><tr><th class="n">#</th><th>File</th><th>Language</th><th class="n">Complexity</th><th class="n">Code</th></tr></thead>
<tbody id="rows">${rows}</tbody></table>`;
}

function stat(value: string, label: string): string {
  return `<div class="stat"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(
    label,
  )}</div></div>`;
}

const STYLE = `
:root{--bg:#0a0e17;--panel:#141b2d;--border:#223049;--text:#e6ecf5;--muted:#9aa8bf;--accent:#5ed0ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5}
header,section{max-width:1000px;margin:0 auto;padding:24px 20px}
h1{margin:0 0 16px}h2{border-bottom:1px solid var(--border);padding-bottom:8px}
.stats{display:flex;gap:14px;flex-wrap:wrap}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 20px;min-width:120px}
.stat .value{font-size:26px;font-weight:700;color:var(--accent)}
.stat .label{color:var(--muted);font-size:13px}
#filter{width:100%;padding:10px 14px;margin:8px 0 18px;background:var(--panel);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid var(--border);text-align:left}
th{position:sticky;top:0;background:var(--bg)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
td.rank{color:var(--muted)}
td.cx{color:var(--accent);font-weight:600}
td.path{font-family:ui-monospace,Menlo,monospace}
td.lang{color:var(--muted)}
tbody tr:hover{background:#0e1526}
.muted{color:var(--muted)}
`;

const SCRIPT = `
const input=document.getElementById("filter");
if(input){
  const rows=[...document.querySelectorAll("#rows tr")];
  input.addEventListener("input",()=>{
    const q=input.value.toLowerCase();
    for(const r of rows){
      r.style.display=r.dataset.search.toLowerCase().includes(q)?"":"none";
    }
  });
}
`;
