import type { CommentOutcome } from "../../core/analyzers/comments.js";
import { formatNumber } from "./html.js";
import { table } from "./text.js";

export function renderComments(outcome: CommentOutcome, topFiles: number = 20): string {
  if (outcome.status === "no-comments") {
    return "No comment blocks sit above code here, so there is nothing to compare.";
  }
  if (outcome.status === "unavailable") {
    return "Comment drift needs a git repository with tracked files.";
  }

  const { health } = outcome;
  const share = (health.drifted / health.blocks) * 100;
  const out: string[] = [
    `Comment drift: ${share.toFixed(0)}% of comment blocks describe code that changed later`,
    `  ${formatNumber(health.drifted)} of ${formatNumber(health.blocks)} blocks across ${formatNumber(health.filesChecked)} files   ·   ${health.years}-year threshold`,
  ];

  const drifted = health.files.filter((file) => file.drifted > 0);
  if (drifted.length === 0) {
    out.push("", "No comment block has drifted past the threshold.");
    return out.join("\n");
  }

  const rows = drifted
    .slice(0, topFiles)
    .map((file) => [
      file.path,
      formatNumber(file.drifted),
      formatNumber(file.blocks),
      `${((file.drifted / file.blocks) * 100).toFixed(0)}%`,
    ]);

  out.push("", "Most drifted files", ...table(["File", "Drifted", "Blocks", "%"], rows));

  const hidden = drifted.length - rows.length;
  if (hidden > 0) {
    out.push(`  … and ${formatNumber(hidden)} more files.`);
  }

  return out.join("\n");
}
