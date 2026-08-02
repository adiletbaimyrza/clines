import { describe, expect, it } from "vitest";
import type { DuplicationResult } from "../src/core/analyzers/duplication.js";
import { renderDuplication } from "../src/report/format/duplication.js";
import { renderDuplicationHtml } from "../src/report/format/duplication-html.js";

function result(over: Partial<DuplicationResult> = {}): DuplicationResult {
  return {
    minLines: 5,
    totalLines: 1000,
    duplicatedLines: 120,
    percentage: 12,
    clones: [
      {
        lineCount: 40,
        fragments: [
          { path: "a.ts", startLine: 10, endLine: 49 },
          { path: "b.ts", startLine: 80, endLine: 119 },
        ],
        code: ["const x = 1;", "doThing();"],
      },
    ],
    perFile: [
      { path: "a.ts", totalLines: 100, duplicatedLines: 80, percentage: 80 },
      { path: "b.ts", totalLines: 100, duplicatedLines: 40, percentage: 40 },
    ],
    ...over,
  };
}

describe("renderDuplication (terminal)", () => {
  it("summarizes duplication and lists the most duplicated files", () => {
    const output = renderDuplication(result());
    expect(output).toContain("Duplication: 12.0%");
    expect(output).toContain("120 of 1,000 code lines");
    expect(output).toContain("Most duplicated files");
    expect(output).toContain("a.ts");
    expect(output).toContain("80%");
    expect(output).toContain("--html");
  });

  it("truncates long file paths", () => {
    const longPath = "a/very/deeply/nested/directory/structure/that/keeps/going/module.ts".padStart(
      90,
      "x",
    );
    const output = renderDuplication(
      result({
        perFile: [{ path: longPath, totalLines: 100, duplicatedLines: 50, percentage: 50 }],
      }),
    );
    expect(output).toContain("…");
    expect(output).not.toContain(longPath);
  });

  it("notes when there are more files than shown", () => {
    const perFile = Array.from({ length: 15 }, (_, i) => ({
      path: `f${i}.ts`,
      totalLines: 10,
      duplicatedLines: 5,
      percentage: 50,
    }));
    expect(renderDuplication(result({ perFile }), 10)).toContain("… and 5 more files.");
  });

  it("reports a clean result when there is no duplication", () => {
    const output = renderDuplication(result({ clones: [], perFile: [], minLines: 7 }));
    expect(output).toContain("No duplicate blocks of 7+ lines found.");
  });
});

describe("renderDuplicationHtml", () => {
  it("builds a self-contained page with stats, files and clone snippets", () => {
    const html = renderDuplicationHtml(result());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).toContain("12.0%");
    expect(html).toContain("Most duplicated files");
    expect(html).toContain("40 lines × 2 copies");
    expect(html).toContain("a.ts");
    expect(html).toContain("doThing();");
    expect(html).toContain('id="filter"');
    expect(html).toContain("highlight.min.js");
    expect(html).toContain('class="hljs language-typescript"');
  });

  it("omits a language class for unknown extensions", () => {
    const html = renderDuplicationHtml(
      result({
        clones: [
          {
            lineCount: 5,
            fragments: [
              { path: "notes.xyz", startLine: 1, endLine: 5 },
              { path: "other.xyz", startLine: 1, endLine: 5 },
            ],
            code: ["line one", "line two"],
          },
        ],
      }),
    );
    expect(html).toContain('class="hljs"');
    expect(html).not.toContain("language-");
  });

  it("escapes HTML and truncates long snippets", () => {
    const html = renderDuplicationHtml(
      result({
        clones: [
          {
            lineCount: 5,
            fragments: [
              { path: "x.ts", startLine: 1, endLine: 5 },
              { path: "y.ts", startLine: 1, endLine: 5 },
            ],
            code: ["const a = b < c && d > e;", "line2", "line3"],
          },
        ],
      }),
      { maxSnippet: 2 },
    );
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("… 1 more lines");
  });

  it("preserves indentation and dedents the common leading whitespace", () => {
    const html = renderDuplicationHtml(
      result({
        clones: [
          {
            lineCount: 2,
            fragments: [
              { path: "x.ts", startLine: 1, endLine: 2 },
              { path: "y.ts", startLine: 1, endLine: 2 },
            ],
            code: ["    if (a) {", "      run();"],
          },
        ],
      }),
    );
    // The 4-space common indent is stripped; the nested line keeps 2 extra spaces.
    expect(html).toContain('<pre class="snippet">');
    expect(html).toContain("if (a) {");
    expect(html).toContain("  run");
    expect(html).not.toContain("    if");
    expect(html).not.toContain("      run");
  });

  it("shows an empty-state and a truncation note", () => {
    const empty = renderDuplicationHtml(result({ clones: [], perFile: [], minLines: 6 }));
    expect(empty).toContain("No duplicate blocks of 6+ lines found.");

    const many = renderDuplicationHtml(result(), { maxClones: 0 });
    expect(many).toContain("more clones not shown");
  });
});
