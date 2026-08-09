import type { DuplicationResult } from "../../core/analyzers/duplication.js";
import { excludedNotice } from "./html.js";
import { table, wrap } from "./text.js";

export function renderDuplication(result: DuplicationResult, topFiles: number = 10): string {
  const out: string[] = [
    `Duplication: ${result.percentage.toFixed(1)}%   ${num(result.duplicatedLines)} duplicated lines   ·   ${num(result.clones.length)} clones`,
  ];

  if (result.clones.length === 0) {
    out.push("", `No duplicate blocks of ${result.minLines}+ lines found.`);
    pushNotice(out, result);
    return out.join("\n");
  }

  const files = result.perFile.slice(0, topFiles);
  const rows = files.map((f) => [f.path, num(f.duplicatedLines), `${f.percentage.toFixed(0)}%`]);

  out.push("", "Most duplicated files", ...table(["File", "Dup lines", "% of file"], rows));

  const hidden = result.perFile.length - files.length;
  if (hidden > 0) {
    out.push(`  … and ${num(hidden)} more files.`);
  }

  pushNotice(out, result);

  out.push("", "Run with `--html <file>` for a full browsable report with code snippets.");
  return out.join("\n");
}

function pushNotice(out: string[], result: DuplicationResult): void {
  const notice = excludedNotice(result.excluded);
  if (notice !== "") {
    out.push("", ...wrap(notice));
  }
}

function num(value: number): string {
  return value.toLocaleString("en-US");
}
