import type { Report } from "../../core/model.js";
import { buildReadmeSection } from "../format/table.js";

export const PLACEHOLDER_START = "<!-- LINE_COUNT_PLACEHOLDER_1 -->";
export const PLACEHOLDER_END = "<!-- LINE_COUNT_PLACEHOLDER_2 -->";

export function injectReadme(content: string, report: Report): string {
  const section = buildReadmeSection(report);
  const block = `${PLACEHOLDER_START}\n${section}\n${PLACEHOLDER_END}`;

  if (content.includes(PLACEHOLDER_START) && content.includes(PLACEHOLDER_END)) {
    const pattern = new RegExp(
      `${escapeRegExp(PLACEHOLDER_START)}[\\s\\S]*?${escapeRegExp(PLACEHOLDER_END)}`,
    );
    return content.replace(pattern, block);
  }

  const separator = content.endsWith("\n") ? "\n" : "\n\n";
  return `${content}${separator}${block}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
