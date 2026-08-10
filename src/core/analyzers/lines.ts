import type { Concentration, FileTokens, LanguageStat, LargestFile, Report } from "../model.js";
import { getLanguageName } from "../tokenizer/languages.js";
import type { Analyzer } from "./analyzer.js";

const LARGEST_FILES = 25;

export const linesAnalyzer: Analyzer<Report> = {
  name: "lines",
  analyze(files: FileTokens[]): Report {
    const byLanguage = new Map<string, LanguageStat>();
    const codePerLanguage = new Map<string, number[]>();
    const allCode: number[] = [];
    const perFile: LargestFile[] = [];
    let totalCode = 0;
    let totalComment = 0;
    let totalBlank = 0;
    let totalLines = 0;
    let totalComplexity = 0;

    for (const file of files) {
      const language = getLanguageName(file.ext);
      const stat = byLanguage.get(language) ?? emptyStat(language);
      const fileCode = file.lineKinds.filter((kind) => kind === "code").length;
      allCode.push(fileCode);
      perFile.push({
        path: file.path,
        code: fileCode,
        comment: file.lineKinds.filter((kind) => kind === "comment").length,
        complexity: file.complexity,
      });
      const sizes = codePerLanguage.get(language) ?? [];
      sizes.push(fileCode);
      codePerLanguage.set(language, sizes);
      stat.files += 1;
      stat.complexity += file.complexity;
      totalComplexity += file.complexity;

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
      totalComplexity,
      languages: [...byLanguage.values()].map((stat) => ({
        ...stat,
        ...sizeStats(codePerLanguage.get(stat.language) as number[]),
      })),
      concentration: concentrationOf(allCode),
      largestFiles: perFile
        .sort((a, b) => b.code - a.code || a.path.localeCompare(b.path))
        .slice(0, LARGEST_FILES),
      roles: [],
    };
  },
};

function emptyStat(language: string): LanguageStat {
  return {
    language,
    files: 0,
    code: 0,
    comment: 0,
    blank: 0,
    total: 0,
    complexity: 0,
    medianCode: 0,
    p90Code: 0,
    maxCode: 0,
  };
}

export function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] as number;
}

function sizeStats(sizes: number[]): { medianCode: number; p90Code: number; maxCode: number } {
  const sorted = [...sizes].sort((a, b) => a - b);
  return {
    medianCode: quantile(sorted, 0.5),
    p90Code: quantile(sorted, 0.9),
    maxCode: sorted[sorted.length - 1] as number,
  };
}

export function concentrationOf(sizes: number[]): Concentration {
  const sorted = [...sizes].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const largestFiles = Math.max(1, Math.round(sorted.length * 0.05));
  const largest = sorted.slice(-largestFiles).reduce((sum, value) => sum + value, 0);
  return {
    largestFiles: sorted.length === 0 ? 0 : largestFiles,
    share: total === 0 ? 0 : (largest / total) * 100,
    medianCode: quantile(sorted, 0.5),
    p90Code: quantile(sorted, 0.9),
  };
}
