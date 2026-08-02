import type { Report } from "../../core/model.js";
import type { Reporter } from "../reporter.js";
import { getProjectSize } from "../format/size-label.js";
import { sortedLanguages } from "../format/table.js";

export const consoleReporter: Reporter = {
  name: "console",
  render(report: Report): string {
    const size = getProjectSize(report.totalCode);
    const lines: string[] = [];

    lines.push(`Lines of Code: ${report.totalCode}`);
    lines.push(`Files:         ${report.totalFiles}`);
    lines.push(`Total lines:   ${report.totalLines}`);
    lines.push(`Project size:  ${size.text}`);

    const languages = sortedLanguages(report);
    if (languages.length > 0) {
      const nameWidth = Math.max(...languages.map((l) => l.language.length));
      lines.push("");
      for (const l of languages) {
        lines.push(`  ${l.language.padEnd(nameWidth)}  ${String(l.code).padStart(7)} code`);
      }
    }

    return lines.join("\n");
  },
};
