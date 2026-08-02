import type { Report } from "../../core/model.js";
import type { Reporter } from "../reporter.js";
import { getProjectSize } from "../format/size-label.js";

export const jsonReporter: Reporter = {
  name: "json",
  render(report: Report): string {
    const size = getProjectSize(report.totalCode);
    return JSON.stringify(
      {
        totalCode: report.totalCode,
        totalComment: report.totalComment,
        totalBlank: report.totalBlank,
        totalLines: report.totalLines,
        totalFiles: report.totalFiles,
        projectSize: size.text,
        languages: report.languages,
      },
      null,
      2,
    );
  },
};
