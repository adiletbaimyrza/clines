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
        {
          path: "src/big.ts",
          complexity: 120,
          code: 400,
          language: "TypeScript",
          density: 30.0,
          concentration: 50,
          branch: 120,
          loop: 0,
          bool: 0,
        },
        {
          path: "src/small.py",
          complexity: 8,
          code: 30,
          language: "Python",
          density: 26.7,
          concentration: 50,
          branch: 8,
          loop: 0,
          bool: 0,
        },
        {
          path: "src/data.json",
          complexity: 0,
          code: 12,
          language: "JSON",
          density: 0.0,
          concentration: 50,
          branch: 0,
          loop: 0,
          bool: 0,
        },
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
    expect(output).not.toContain("--html");
  });

  it("notes when there are more files than shown", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      path: `f${i}.ts`,
      complexity: 15 - i,
      code: 10,
      language: "TypeScript",
      density: (15 - i) * 10,
      concentration: 100,
      branch: 15 - i,
      loop: 0,
      bool: 0,
    }));
    expect(renderComplexity(wrap(many), { top: 3 })).toContain("… and 12 more files.");
  });

  it("truncates long file paths", () => {
    const longPath = "a/very/deeply/nested/module.ts".padStart(90, "x");
    const output = renderComplexity(
      wrap([
        {
          path: longPath,
          complexity: 5,
          code: 10,
          language: "TypeScript",
          density: 50,
          concentration: 100,
          branch: 5,
          loop: 0,
          bool: 0,
        },
      ]),
    );
    expect(output).toContain("…");
    expect(output).not.toContain(longPath);
  });

  it("reports a clean result when nothing has complexity", () => {
    const output = renderComplexity(
      wrap([
        {
          path: "data.json",
          complexity: 0,
          code: 5,
          language: "JSON",
          density: 0.0,
          concentration: 50,
          branch: 0,
          loop: 0,
          bool: 0,
        },
      ]),
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
      wrap([
        {
          path: "src/<x>&.ts",
          complexity: 3,
          code: 5,
          language: "TypeScript",
          density: 60.0,
          concentration: 50,
          branch: 3,
          loop: 0,
          bool: 0,
        },
      ]),
    );
    expect(html).toContain("&lt;x&gt;&amp;");
  });

  it("lists every ranked file without truncating small reports", () => {
    const html = renderComplexityHtml(wrap(files()));

    expect(html).toContain("src/big.ts");
    expect(html).toContain("src/small.py");
    expect(html).not.toContain("more files not shown");
  });

  it("notes the remainder once the report exceeds its cap", () => {
    const many: FileComplexity[] = Array.from({ length: 1001 }, (_, i) => ({
      path: `src/f${i}.ts`,
      complexity: 1001 - i,
      code: 10,
      language: "TypeScript",
    }));

    expect(renderComplexityHtml(wrap(many))).toContain("… and 1 more files not shown.");
  });

  it("shows an empty state when nothing has complexity", () => {
    const html = renderComplexityHtml(
      wrap([
        {
          path: "a.json",
          complexity: 0,
          code: 4,
          language: "JSON",
          density: 0.0,
          concentration: 50,
          branch: 0,
          loop: 0,
          bool: 0,
        },
      ]),
    );
    expect(html).toContain("No complexity detected.");
  });
});

describe("complexity detail", () => {
  const detailed = wrap([
    {
      path: "src/spread.ts",
      complexity: 100,
      code: 1000,
      language: "TypeScript",
      density: 10,
      concentration: 2,
      branch: 60,
      loop: 10,
      bool: 30,
    },
    {
      path: "src/tight.ts",
      complexity: 40,
      code: 100,
      language: "TypeScript",
      density: 40,
      concentration: 80,
      branch: 10,
      loop: 0,
      bool: 30,
    },
  ]);

  it("shows density and concentration by default", () => {
    const output = renderComplexity(detailed);

    expect(output).toContain("Cx/100");
    expect(output).toContain("Densest");
    expect(output).toContain("10.0");
    expect(output).toContain("2%");
    expect(output).not.toContain("Branch");
  });

  it("adds the breakdown with explain", () => {
    const output = renderComplexity(detailed, { explain: true });

    expect(output).toContain("Branch");
    expect(output).toContain("60%");
    expect(output).toContain("30%");
  });

  it("ranks by density when asked, and retitles the section", () => {
    const output = renderComplexity(detailed, { sort: "density" });

    expect(output).toContain("Densest files");
    expect(output.indexOf("src/tight.ts")).toBeLessThan(output.indexOf("src/spread.ts"));
  });

  it("drops files below the line floor", () => {
    const output = renderComplexity(detailed, { sort: "density", minLines: 500 });

    expect(output).toContain("src/spread.ts");
    expect(output).not.toContain("src/tight.ts");
  });

  it("breaks density ties on path", () => {
    const tied = wrap([
      {
        path: "z.ts",
        complexity: 10,
        code: 100,
        language: "TypeScript",
        density: 10,
        concentration: 50,
        branch: 10,
        loop: 0,
        bool: 0,
      },
      {
        path: "a.ts",
        complexity: 10,
        code: 100,
        language: "TypeScript",
        density: 10,
        concentration: 50,
        branch: 10,
        loop: 0,
        bool: 0,
      },
    ]);

    const output = renderComplexity(tied, { sort: "density" });
    expect(output.indexOf("a.ts")).toBeLessThan(output.indexOf("z.ts"));
  });
});
