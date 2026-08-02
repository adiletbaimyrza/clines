import { describe, expect, it } from "vitest";
import type { Report } from "../src/core/model.js";
import { consoleReporter } from "../src/report/reporters/console.js";
import { jsonReporter } from "../src/report/reporters/json.js";
import {
  injectReadme,
  PLACEHOLDER_END,
  PLACEHOLDER_START,
} from "../src/report/reporters/readme.js";
import { buildReadmeSection, sortedLanguages } from "../src/report/format/table.js";

const report: Report = {
  totalCode: 30,
  totalLines: 50,
  totalFiles: 3,
  languages: [
    { language: "CSS", files: 1, code: 5, comment: 2, blank: 3, total: 10 },
    { language: "TypeScript", files: 2, code: 25, comment: 8, blank: 7, total: 40 },
  ],
};

const empty: Report = { totalCode: 0, totalLines: 0, totalFiles: 0, languages: [] };

describe("sortedLanguages", () => {
  it("sorts by code descending", () => {
    expect(sortedLanguages(report).map((l) => l.language)).toEqual(["TypeScript", "CSS"]);
  });

  it("breaks ties by language name", () => {
    const tie: Report = {
      ...empty,
      languages: [
        { language: "Bash", files: 1, code: 5, comment: 0, blank: 0, total: 5 },
        { language: "Awk", files: 1, code: 5, comment: 0, blank: 0, total: 5 },
      ],
    };
    expect(sortedLanguages(tie).map((l) => l.language)).toEqual(["Awk", "Bash"]);
  });
});

describe("buildReadmeSection", () => {
  it("includes the summary, size label and per-language rows", () => {
    const section = buildReadmeSection(report);
    expect(section).toContain("**Lines of Code:** `30`");
    expect(section).toContain('<span style="color: green;">Tiny scriptlet 💡</span>');
    expect(section).toContain("| Language | Files | Code | Comments | Blank | Total |");
    expect(section).toContain("| TypeScript | 2 | 25 | 8 | 7 | 40 |");
    expect(section).toContain("| **Total** | **3** | **30** | 10 | 10 | **50** |");
  });
});

describe("consoleReporter", () => {
  it("prints the project-size label (bug #3) and language lines", () => {
    const output = consoleReporter.render(report);
    expect(output).toContain("Project size:  Tiny scriptlet 💡");
    expect(output).toContain("TypeScript");
  });

  it("omits the language block when there are no files", () => {
    const output = consoleReporter.render(empty);
    expect(output).toContain("Lines of Code: 0");
    expect(output).not.toContain("code\n  ");
  });
});

describe("jsonReporter", () => {
  it("emits the report as JSON with the size label and languages", () => {
    const parsed = JSON.parse(jsonReporter.render(report));
    expect(parsed).toMatchObject({
      totalCode: 30,
      totalLines: 50,
      totalFiles: 3,
      projectSize: "Tiny scriptlet 💡",
    });
    expect(parsed.languages).toHaveLength(2);
    expect(parsed.languages[0].language).toBeDefined();
  });
});

describe("injectReadme", () => {
  it("replaces content between existing placeholders", () => {
    const original = `# Title\n${PLACEHOLDER_START}\nSTALEBODY\n${PLACEHOLDER_END}\nfooter\n`;
    const updated = injectReadme(original, report);
    expect(updated).not.toContain("STALEBODY");
    expect(updated).toContain("**Lines of Code:** `30`");
    expect(updated).toContain("footer");
    expect(updated.match(new RegExp(PLACEHOLDER_START, "g"))).toHaveLength(1);
  });

  it("appends a section (with trailing newline) when placeholders are absent", () => {
    const updated = injectReadme("# Title\n", report);
    expect(updated).toContain(PLACEHOLDER_START);
    expect(updated).toContain(PLACEHOLDER_END);
  });

  it("appends with a blank-line separator when content lacks a trailing newline", () => {
    const updated = injectReadme("# Title", report);
    expect(updated).toContain(`# Title\n\n${PLACEHOLDER_START}`);
  });
});
