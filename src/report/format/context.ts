import type { ContextResult, FileContext } from "../../core/model.js";
import { escapeHtml, formatNumber } from "./html.js";

export const DEFAULT_WINDOW = 200000;

export interface ContextHtmlOptions {
  title?: string;
  top?: number;
  window?: number;
}

export function renderContext(
  result: ContextResult,
  window: number = DEFAULT_WINDOW,
  topFiles: number = 20,
): string {
  const out: string[] = [
    `Context: ${formatNumber(result.totalTokens)} tokens   ·   ${fill(result.totalTokens, window)} of a ${formatNumber(window)}-token window   ·   ${share(result.commentTokens, result.totalTokens)} comments`,
  ];

  if (result.files.length === 0) {
    out.push("", "No files to measure.");
    return out.join("\n");
  }

  const dirs = result.dirs
    .slice(0, topFiles)
    .map((dir) => [dir.dir, formatNumber(dir.tokens), formatNumber(dir.files)]);
  out.push("", "Largest directories", ...table(["Directory", "Tokens", "Files"], dirs));

  const files = result.files
    .slice(0, topFiles)
    .map((file) => [
      shorten(file.path),
      formatNumber(file.tokens),
      formatNumber(file.codeTokens),
      formatNumber(file.commentTokens),
    ]);
  out.push("", "Biggest files", ...table(["File", "Tokens", "Code", "Comments"], files));

  const hidden = result.files.length - files.length;
  if (hidden > 0) {
    out.push(`  … and ${formatNumber(hidden)} more files.`);
  }

  out.push("", "Run with `--html <file>` for a full browsable report.");
  return out.join("\n");
}

export function renderContextHtml(result: ContextResult, options: ContextHtmlOptions = {}): string {
  const title = options.title ?? "clines — context report";
  const top = options.top ?? 100;
  const window = options.window ?? DEFAULT_WINDOW;

  const shown = result.files.slice(0, top);
  const hidden = result.files.length - shown.length;
  const percent = window === 0 ? 0 : (result.totalTokens / window) * 100;

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
<h1>Context report</h1>
<div class="stats">
${stat(formatNumber(result.totalTokens), "estimated tokens")}
${stat(fill(result.totalTokens, window), `of a ${formatNumber(window)}-token window`)}
${stat(share(result.commentTokens, result.totalTokens), "spent on comments")}
${stat(formatNumber(result.files.length), "files")}
</div>
<div class="meter"><div class="bar" style="width:${Math.min(100, percent).toFixed(1)}%"></div></div>
</header>

<section>
<h2>Largest directories</h2>
${dirsTable(result)}
</section>

<section>
<h2>Biggest files</h2>
${filesTable(shown)}
${hidden > 0 ? `<p class="muted">… and ${formatNumber(hidden)} more files not shown.</p>` : ""}
</section>

<script>${SCRIPT}</script>
</body>
</html>
`;
}

function dirsTable(result: ContextResult): string {
  if (result.dirs.length === 0) {
    return `<p class="muted">No files to measure.</p>`;
  }
  const rows = result.dirs
    .map(
      (dir) =>
        `<tr><td class="path">${escapeHtml(dir.dir)}</td><td class="n cx">${formatNumber(
          dir.tokens,
        )}</td><td class="n">${formatNumber(dir.files)}</td><td class="n">${share(
          dir.tokens,
          result.totalTokens,
        )}</td></tr>`,
    )
    .join("\n");
  return `<table><thead><tr><th>Directory</th><th class="n">Tokens</th><th class="n">Files</th><th class="n">Share</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function filesTable(files: FileContext[]): string {
  if (files.length === 0) {
    return `<p class="muted">No files to measure.</p>`;
  }
  const rows = files
    .map(
      (file, index) =>
        `<tr data-search="${escapeHtml(file.path)}"><td class="n rank">${index + 1}</td><td class="path">${escapeHtml(
          file.path,
        )}</td><td class="lang">${escapeHtml(file.language)}</td><td class="n cx">${formatNumber(
          file.tokens,
        )}</td><td class="n">${formatNumber(file.codeTokens)}</td><td class="n">${formatNumber(
          file.commentTokens,
        )}</td><td class="n">${formatNumber(file.lines)}</td></tr>`,
    )
    .join("\n");
  return `<input id="filter" type="search" placeholder="Filter files by path…" />
<table><thead><tr><th class="n">#</th><th>File</th><th>Language</th><th class="n">Tokens</th><th class="n">Code</th><th class="n">Comments</th><th class="n">Lines</th></tr></thead>
<tbody id="rows">${rows}</tbody></table>`;
}

function table(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] as string).length)),
  );
  const line = (cells: string[]): string =>
    `  ${cells
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] as number)
          : cell.padStart(widths[column] as number),
      )
      .join("   ")}`;
  return [line(headers), ...rows.map(line)];
}

function stat(value: string, label: string): string {
  return `<div class="stat"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(
    label,
  )}</div></div>`;
}

function fill(tokens: number, window: number): string {
  return window === 0 ? "—" : `${((tokens / window) * 100).toFixed(1)}%`;
}

function share(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${((part / whole) * 100).toFixed(0)}%`;
}

function shorten(filePath: string, max: number = 68): string {
  return filePath.length <= max ? filePath : `…${filePath.slice(filePath.length - max + 1)}`;
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
.meter{margin-top:16px;height:10px;background:var(--panel);border:1px solid var(--border);border-radius:99px;overflow:hidden}
.meter .bar{height:100%;background:var(--accent)}
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
