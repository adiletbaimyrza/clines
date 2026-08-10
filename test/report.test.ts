import { describe, expect, it } from "vitest";
import type { Report } from "../src/core/model.js";
import { consoleReporter } from "../src/report/reporters/console.js";
import {
  injectReadme,
  PLACEHOLDER_END,
  PLACEHOLDER_START,
} from "../src/report/reporters/readme.js";
import { buildReadmeSection, sortedLanguages } from "../src/report/format/table.js";

const report: Report = {
  concentration: { largestFiles: 2, share: 60, medianCode: 40, p90Code: 300 },
  roles: [
    { role: "source", files: 3, code: 100 },
    { role: "test", files: 2, code: 40 },
  ],
  totalCode: 30,
  totalComment: 10,
  totalBlank: 10,
  totalLines: 50,
  totalFiles: 3,
  totalComplexity: 12,
  languages: [
    {
      language: "CSS",
      files: 1,
      code: 5,
      comment: 2,
      blank: 3,
      total: 10,
      complexity: 0,
      medianCode: 5,
      p90Code: 5,
      maxCode: 5,
    },
    {
      language: "TypeScript",
      files: 2,
      code: 25,
      comment: 8,
      blank: 7,
      total: 40,
      complexity: 12,
      medianCode: 12,
      p90Code: 20,
      maxCode: 20,
    },
  ],
};

const empty: Report = {
  concentration: { largestFiles: 0, share: 0, medianCode: 0, p90Code: 0 },
  roles: [],
  totalCode: 0,
  totalComment: 0,
  totalBlank: 0,
  totalLines: 0,
  totalFiles: 0,
  totalComplexity: 0,
  languages: [],
};

describe("sortedLanguages", () => {
  it("sorts by code descending", () => {
    expect(sortedLanguages(report).map((l) => l.language)).toEqual(["TypeScript", "CSS"]);
  });

  it("breaks ties by language name", () => {
    const tie: Report = {
      concentration: { largestFiles: 0, share: 0, medianCode: 0, p90Code: 0 },
      roles: [],
      ...empty,
      languages: [
        {
          language: "Bash",
          files: 1,
          code: 5,
          comment: 0,
          blank: 0,
          total: 5,
          complexity: 0,
          medianCode: 0,
          p90Code: 0,
          maxCode: 0,
        },
        {
          language: "Awk",
          files: 1,
          code: 5,
          comment: 0,
          blank: 0,
          total: 5,
          complexity: 0,
          medianCode: 0,
          p90Code: 0,
          maxCode: 0,
        },
      ],
    };
    expect(sortedLanguages(tie).map((l) => l.language)).toEqual(["Awk", "Bash"]);
  });
});

describe("buildReadmeSection", () => {
  it("includes the summary, size label and per-language rows", () => {
    const section = buildReadmeSection(report);
    expect(section).toContain("**Lines of Code:** `30`");
    expect(section).toContain('<span style="color: green;">Meteoroid 🪨</span>');
    expect(section).toContain(
      "| Language | Files | Code | Comments | Blank | Complexity | Total |",
    );
    expect(section).toContain("| TypeScript | 2 | 25 | 8 | 7 | 12 | 40 |");
    expect(section).toContain("| **Total** | **3** | **30** | 10 | 10 | **12** | **50** |");
  });
});

describe("consoleReporter", () => {
  it("renders an aligned table with totals and the size label", () => {
    const output = consoleReporter.render(report);
    expect(output).toContain("Language");
    expect(output).toContain("Comments");
    expect(output).toContain("Complexity");
    expect(output).toContain("TypeScript");
    expect(output).toContain("CSS");
    expect(output).toContain("Total");
    expect(output).toContain("Project size: Meteoroid 🪨");
    expect(output).toMatch(/83\.3%/);
  });

  it("handles an empty report without throwing", () => {
    const output = consoleReporter.render(empty);
    expect(output).toContain("No files found.");
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

describe("consoleReporter with no code lines", () => {
  it("does not divide by zero when a file is all blanks", () => {
    const blanks: Report = {
      totalCode: 0,
      totalComment: 0,
      totalBlank: 3,
      totalLines: 3,
      totalFiles: 1,
      totalComplexity: 0,
      languages: [
        {
          language: "TypeScript",
          files: 1,
          code: 0,
          comment: 0,
          blank: 3,
          total: 3,
          complexity: 0,
        },
      ],
      roles: [],
      concentration: { largestFiles: 1, share: 0, medianCode: 0, p90Code: 0 },
    };

    const output = consoleReporter.render(blanks);

    expect(output).toContain("0.0%");
    expect(output).not.toContain("NaN");
  });
});

describe("consoleReporter --verbose", () => {
  it("appends distribution, density and concentration", () => {
    const output = consoleReporter.render(report, true);

    expect(output).toContain("File size in code lines");
    expect(output).toContain("Median");
    expect(output).toContain("Cx/100");
    expect(output).toContain("Concentration: the largest 2 files (5%) hold 60% of all code");
    expect(output).toContain("Median file is 40 code lines");
    expect(output.replace(/\s+/g, " ")).toContain("p90 is 300.");
  });

  it("leaves the default output untouched", () => {
    expect(consoleReporter.render(report)).not.toContain("File size in code lines");
    expect(consoleReporter.render(report)).not.toContain("Concentration:");
  });

  it("uses a dash where a language has no code", () => {
    const output = consoleReporter.render(
      {
        ...report,
        languages: [
          {
            language: "JSON",
            files: 1,
            code: 0,
            comment: 0,
            blank: 2,
            total: 2,
            complexity: 0,
            medianCode: 0,
            p90Code: 0,
            maxCode: 0,
          },
        ],
      },
      true,
    );

    expect(output).toContain("—");
  });
});
