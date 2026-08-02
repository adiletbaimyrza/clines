import type { DuplicationResult } from "../../core/analyzers/duplication.js";

export function renderDuplication(result: DuplicationResult, topFiles: number = 10): string {
  const out: string[] = [
    `Duplication: ${result.percentage.toFixed(1)}%   ${num(result.duplicatedLines)} duplicated lines   ·   ${num(result.clones.length)} clones`,
  ];

  if (result.clones.length === 0) {
    out.push("", `No duplicate blocks of ${result.minLines}+ lines found.`);
    return out.join("\n");
  }

  const files = result.perFile.slice(0, topFiles).map((f) => ({ ...f, path: shorten(f.path) }));
  const width = Math.max(...files.map((f) => f.path.length), "File".length);

  out.push("", "Most duplicated files", `  ${"File".padEnd(width)}   Dup lines   % of file`);
  for (const file of files) {
    out.push(
      `  ${file.path.padEnd(width)}   ${num(file.duplicatedLines).padStart(9)}   ${`${file.percentage.toFixed(0)}%`.padStart(9)}`,
    );
  }

  const hidden = result.perFile.length - files.length;
  if (hidden > 0) {
    out.push(`  … and ${num(hidden)} more files.`);
  }

  out.push("", "Run with `--html <file>` for a full browsable report with code snippets.");
  return out.join("\n");
}

function num(value: number): string {
  return value.toLocaleString("en-US");
}

function shorten(filePath: string, max: number = 68): string {
  return filePath.length <= max ? filePath : `…${filePath.slice(filePath.length - max + 1)}`;
}
