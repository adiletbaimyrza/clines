import type { DuplicationResult } from "../../core/analyzers/duplication.js";

const DEFAULT_TOP = 20;

export function renderDuplication(result: DuplicationResult, topN: number = DEFAULT_TOP): string {
  const pct = result.percentage.toFixed(1);
  const lines: string[] = [
    `Duplication: ${pct}%  ·  ${num(result.duplicatedLines)} of ${num(result.totalLines)} code lines duplicated  ·  ${num(result.clones.length)} clones`,
    "",
  ];

  if (result.clones.length === 0) {
    lines.push(`No duplicate blocks of ${result.minLines}+ lines found.`);
    return lines.join("\n");
  }

  const shown = result.clones.slice(0, topN);
  for (const clone of shown) {
    lines.push(`  ${num(clone.lineCount)} lines × ${clone.fragments.length}`);
    for (const fragment of clone.fragments) {
      lines.push(`    ${fragment.path}:${fragment.startLine}-${fragment.endLine}`);
    }
    lines.push("");
  }

  const hidden = result.clones.length - shown.length;
  if (hidden > 0) {
    lines.push(`  … and ${num(hidden)} more clones.`);
  }

  return lines.join("\n").trimEnd();
}

function num(value: number): string {
  return value.toLocaleString("en-US");
}
