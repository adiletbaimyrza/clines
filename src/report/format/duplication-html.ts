import path from "node:path";
import type { Clone, DuplicationResult } from "../../core/analyzers/duplication.js";

export interface HtmlOptions {
  title?: string;
  maxClones?: number;
  maxSnippet?: number;
}

const HLJS_VERSION = "11.9.0";
const HLJS_CSS = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}/styles/github-dark.min.css`;
const HLJS_JS = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}/highlight.min.js`;

export function renderDuplicationHtml(
  result: DuplicationResult,
  options: HtmlOptions = {},
): string {
  const title = options.title ?? "clines — duplication report";
  const maxClones = options.maxClones ?? 500;
  const maxSnippet = options.maxSnippet ?? 60;

  const filesAffected = result.perFile.length;
  const clones = result.clones.slice(0, maxClones);
  const hiddenClones = result.clones.length - clones.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<link rel="stylesheet" href="${HLJS_CSS}" />
<style>${STYLE}</style>
</head>
<body>
<header>
<h1>Duplication report</h1>
<div class="stats">
${stat(`${result.percentage.toFixed(1)}%`, "duplicated")}
${stat(fmt(result.duplicatedLines), "duplicated lines")}
${stat(fmt(result.clones.length), "clones")}
${stat(fmt(filesAffected), "files affected")}
</div>
</header>

<section>
<h2>Most duplicated files</h2>
${filesTable(result)}
</section>

<section>
<h2>Clones</h2>
<input id="filter" type="search" placeholder="Filter clones by file path or code…" />
<div id="clones">
${clones.map((clone) => cloneCard(clone, maxSnippet)).join("\n")}
</div>
${hiddenClones > 0 ? `<p class="muted">… and ${fmt(hiddenClones)} more clones not shown.</p>` : ""}
</section>

<script src="${HLJS_JS}"></script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

function filesTable(result: DuplicationResult): string {
  if (result.perFile.length === 0) {
    return `<p class="muted">No duplicate blocks of ${result.minLines}+ lines found.</p>`;
  }
  const rows = result.perFile
    .slice(0, 100)
    .map(
      (f) =>
        `<tr><td class="path">${esc(f.path)}</td><td class="n">${fmt(f.duplicatedLines)}</td><td class="n">${f.percentage.toFixed(0)}%</td></tr>`,
    )
    .join("\n");
  return `<table><thead><tr><th>File</th><th class="n">Dup lines</th><th class="n">% of file</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function cloneCard(clone: Clone, maxSnippet: number): string {
  const locations = clone.fragments
    .map((f) => `<li>${esc(f.path)}<span class="range">:${f.startLine}-${f.endLine}</span></li>`)
    .join("");
  const shown = dedent(clone.code.slice(0, maxSnippet));
  const extra = clone.code.length - shown.length;
  const language = hljsLanguage(clone.fragments[0]!.path);
  const search = esc(clone.fragments.map((f) => f.path).join(" "));
  const more = extra > 0 ? `<div class="more">… ${fmt(extra)} more lines</div>` : "";
  const codeClass = language === "" ? "" : ` class="${language}"`;
  return `<details class="clone" data-search="${search}">
<summary class="clone-head">${clone.lineCount} lines × ${clone.fragments.length} copies</summary>
<ul class="locations">${locations}</ul>
<div class="snippet-wrap">${COPY_BUTTON}<pre class="snippet"><code${codeClass}>${shown.map(esc).join("\n")}</code></pre></div>${more}
</details>`;
}

function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.length - line.trimStart().length);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(min));
}

const LANGUAGES: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".lua": "lua",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "xml",
  ".xml": "xml",
  ".vue": "xml",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "ini",
  ".json": "json",
  ".md": "markdown",
  ".coffee": "coffeescript",
  ".pl": "perl",
  ".r": "r",
};

function hljsLanguage(filePath: string): string {
  const name = LANGUAGES[path.extname(filePath).toLowerCase()];
  return name === undefined ? "" : `language-${name}`;
}

const COPY_BUTTON =
  '<button class="copy" aria-label="Copy snippet" title="Copy snippet">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>';

function stat(value: string, label: string): string {
  return `<div class="stat"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div></div>`;
}

function fmt(value: number): string {
  return value.toLocaleString("en-US");
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const STYLE = `
:root{--bg:#0a0e17;--panel:#141b2d;--border:#223049;--text:#e6ecf5;--muted:#9aa8bf;--accent:#5ed0ff;--green:#4ade80}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5}
header,section{max-width:1000px;margin:0 auto;padding:24px 20px}
h1{margin:0 0 16px}h2{border-bottom:1px solid var(--border);padding-bottom:8px}
.stats{display:flex;gap:14px;flex-wrap:wrap}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px 20px;min-width:120px}
.stat .value{font-size:26px;font-weight:700;color:var(--accent)}
.stat .label{color:var(--muted);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid var(--border);text-align:left}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
td.path{font-family:ui-monospace,Menlo,monospace}
#filter{width:100%;padding:10px 14px;margin:8px 0 18px;background:var(--panel);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px}
.clone{background:var(--panel);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden}
.clone-head{padding:10px 14px;font-weight:600;background:#0e1526;cursor:pointer;user-select:none}
.clone[open] .clone-head{border-bottom:1px solid var(--border)}
.locations{margin:0;padding:10px 14px;list-style:none;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:var(--muted)}
.locations .range{color:var(--accent)}
.snippet-wrap{position:relative;border-top:1px solid var(--border)}
.snippet{margin:0;overflow-x:auto}
.snippet code{display:block;padding:14px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;tab-size:2;white-space:pre;background:transparent}
.copy{position:absolute;top:8px;right:8px;z-index:1;background:var(--panel);border:1px solid var(--border);border-radius:6px;color:var(--muted);padding:5px 7px;cursor:pointer;line-height:0}
.copy:hover{color:var(--text);border-color:var(--accent)}
.copy.copied{color:var(--green);border-color:var(--green)}
.copy svg{width:15px;height:15px;display:block}
.more{padding:8px 14px;color:var(--muted);font-size:12px;font-style:italic}
.muted{color:var(--muted)}
`;

const SCRIPT = `
if(window.hljs){hljs.highlightAll();}
document.querySelectorAll(".copy").forEach(btn=>{
  btn.addEventListener("click",async()=>{
    const code=btn.parentElement.querySelector("code");
    try{
      await navigator.clipboard.writeText(code.innerText);
      btn.classList.add("copied");
      setTimeout(()=>btn.classList.remove("copied"),1200);
    }catch(e){}
  });
});
const input=document.getElementById("filter");
const clones=[...document.querySelectorAll(".clone")];
input.addEventListener("input",()=>{
  const q=input.value.toLowerCase();
  for(const c of clones){
    const hay=(c.dataset.search+" "+c.textContent).toLowerCase();
    c.style.display=hay.includes(q)?"":"none";
  }
});
`;
