import { describe, expect, it } from "vitest";
import type { ComplexityResult, FileComplexity } from "../src/core/model.js";
import { renderComplexity, renderComplexityHtml } from "../src/report/format/complexity.js";

function wrap(files: FileComplexity[]): ComplexityResult {
  return { files, excluded: { files: 0, roles: [] } };
}

function files(over: FileComplexity[] = []): FileComplexity[] {
  return over.length > 0
    ? over
    : [
        { path: "src/big.ts", complexity: 120, code: 400, language: "TypeScript" },
        { path: "src/small.py", complexity: 8, code: 30, language: "Python" },
        { path: "src/data.json", complexity: 0, code: 12, language: "JSON" },
      ];
}

describe("renderComplexity (terminal)", () => {
  it("summarizes total complexity and lists the most complex files", () => {
    const output = renderComplexity(wrap(files()));
    expect(output).toContain("Complexity: 128 total");
    expect(output).toContain("2 files with complexity");
    expect(output).toContain("Most complex files");
    expect(output).toContain("src/big.ts");
    expect(output).toContain("120");
    expect(output).not.toContain("src/data.json");
    expect(output).toContain("--html");
  });

  it("notes when there are more files than shown", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      path: `f${i}.ts`,
      complexity: 15 - i,
      code: 10,
      language: "TypeScript",
    }));
    expect(renderComplexity(wrap(many), 3)).toContain("… and 12 more files.");
  });

  it("truncates long file paths", () => {
    const longPath = "a/very/deeply/nested/module.ts".padStart(90, "x");
    const output = renderComplexity(
      wrap([{ path: longPath, complexity: 5, code: 10, language: "TypeScript" }]),
    );
    expect(output).toContain("…");
    expect(output).not.toContain(longPath);
  });

  it("reports a clean result when nothing has complexity", () => {
    const output = renderComplexity(
      wrap([{ path: "data.json", complexity: 0, code: 5, language: "JSON" }]),
    );
    expect(output).toContain("No complexity detected.");
  });
});

describe("renderComplexity exclusions", () => {
  it("names what was left out", () => {
    const output = renderComplexity({
      files: files(),
      excluded: { files: 4, roles: [{ role: "test", files: 4, code: 90 }] },
    });

    expect(output).toContain("Excluded 4 files: 4 test");
  });
});

describe("renderComplexityHtml", () => {
  it("builds a self-contained page with stats and a ranked table", () => {
    const html = renderComplexityHtml(wrap(files()));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).toContain("Complexity report");
    expect(html).toContain("total complexity");
    expect(html).toContain("src/big.ts");
    expect(html).toContain("TypeScript");
    expect(html).toContain('id="filter"');
    expect(html).not.toContain("more files not shown");
  });

  it("escapes HTML in file paths", () => {
    const html = renderComplexityHtml(
      wrap([{ path: "src/<x>&.ts", complexity: 3, code: 5, language: "TypeScript" }]),
    );
    expect(html).toContain("&lt;x&gt;&amp;");
  });

  it("truncates to the top-N and notes the remainder", () => {
    const html = renderComplexityHtml(wrap(files()), { top: 1 });
    expect(html).toContain("more files not shown");
  });

  it("shows an empty state when nothing has complexity", () => {
    const html = renderComplexityHtml(
      wrap([{ path: "a.json", complexity: 0, code: 4, language: "JSON" }]),
    );
    expect(html).toContain("No complexity detected.");
  });
});
