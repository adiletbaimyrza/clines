import type { FileTokens, LanguageStat, Report } from "../model.js";
import { getLanguageName } from "../tokenizer/languages.js";
import type { Analyzer } from "./analyzer.js";

export const linesAnalyzer: Analyzer<Report> = {
  name: "lines",
  analyze(files: FileTokens[]): Report {
    const byLanguage = new Map<string, LanguageStat>();
    let totalCode = 0;
    let totalComment = 0;
    let totalBlank = 0;
    let totalLines = 0;

    for (const file of files) {
      const language = getLanguageName(file.ext);
      const stat = byLanguage.get(language) ?? emptyStat(language);
      stat.files += 1;

      for (const kind of file.lineKinds) {
        stat.total += 1;
        totalLines += 1;
        if (kind === "code") {
          stat.code += 1;
          totalCode += 1;
        } else if (kind === "comment") {
          stat.comment += 1;
          totalComment += 1;
        } else {
          stat.blank += 1;
          totalBlank += 1;
        }
      }

      byLanguage.set(language, stat);
    }

    return {
      totalCode,
      totalComment,
      totalBlank,
      totalLines,
      totalFiles: files.length,
      languages: [...byLanguage.values()],
    };
  },
};

function emptyStat(language: string): LanguageStat {
  return { language, files: 0, code: 0, comment: 0, blank: 0, total: 0 };
}
