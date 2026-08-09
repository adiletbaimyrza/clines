import { describe, expect, it } from "vitest";
import type { ContextResult } from "../src/core/model.js";
import {
  budgetTiers,
  renderComments,
  renderContext,
  renderContextHtml,
} from "../src/report/format/context.js";

function result(overrides: Partial<ContextResult> = {}): ContextResult {
  return {
    excluded: { files: 0, roles: [] },
    navigability: {
      files: 2,
      ambiguousFiles: 0,
      worstNames: [],
      medianDepth: 2,
      maxDepth: 2,
    },
    files: [
      {
        path: "src/big.ts",
        language: "TypeScript",
        tokens: 900,
        codeTokens: 800,
        commentTokens: 100,
        lines: 210,
      },
      {
        path: "src/small.ts",
        language: "TypeScript",
        tokens: 100,
        codeTokens: 90,
        commentTokens: 10,
        lines: 30,
      },
    ],
    dirs: [{ dir: "src", tokens: 1000, files: 2 }],
    totalTokens: 1000,
    codeTokens: 890,
    commentTokens: 110,
    ...overrides,
  };
}

const empty: ContextResult = {
  excluded: { files: 0, roles: [] },
  navigability: { files: 0, ambiguousFiles: 0, worstNames: [], medianDepth: 0, maxDepth: 0 },
  files: [],
  dirs: [],
  totalTokens: 0,
  codeTokens: 0,
  commentTokens: 0,
};

describe("renderContext", () => {
  it("summarises tokens, window fill and comment share", () => {
    const output = renderContext(result(), 10000);

    expect(output).toContain("Context: 1,000 tokens");
    expect(output).toContain("10.0% of a 10,000-token window");
    expect(output).toContain("11% comments");
    expect(output).toContain("Largest directories");
    expect(output).toContain("Biggest files");
    expect(output).toContain("src/big.ts");
  });

  it("reports an empty project", () => {
    const output = renderContext(empty);

    expect(output).toContain("No files to measure.");
    expect(output).not.toContain("Biggest files");
  });

  it("truncates the file list", () => {
    const output = renderContext(result(), 10000, 50000, 1);

    expect(output).toContain("… and 1 more files.");
    expect(output).not.toContain("src/small.ts");
  });

  it("shortens paths that are too long for the table", () => {
    const long = `src/${"deep/".repeat(20)}file.ts`;
    const output = renderContext(
      result({
        files: [
          {
            path: long,
            language: "TypeScript",
            tokens: 5000,
            codeTokens: 5000,
            commentTokens: 0,
            lines: 10,
          },
          ...result().files,
        ],
      }),
      10000,
    );

    expect(output).toContain("…deep/");
    expect(output).toContain("deep/file.ts");
    expect(output).not.toContain(long);
    expect(output).toContain("src/small.ts");
  });

  it("renders a dash when the window is zero", () => {
    expect(renderContext(result(), 0)).toContain("— of a 0-token window");
  });
});

describe("exclusion notice", () => {
  const excluded = {
    files: 12,
    roles: [
      { role: "test" as const, files: 10, code: 300 },
      { role: "docs" as const, files: 2, code: 20 },
    ],
  };

  it("names what was left out", () => {
    const output = renderContext(result({ excluded }), 10000);

    expect(output).toContain("Excluded 12 files: 10 test · 2 docs");
    expect(output).toContain("--all to include");
  });

  it("names exclusions even when nothing was measured", () => {
    expect(renderContext({ ...empty, excluded })).toContain("Excluded 12 files");
  });

  it("says nothing when nothing was excluded", () => {
    expect(renderContext(result(), 10000)).not.toContain("Excluded");
  });
});

describe("renderContextHtml", () => {
  it("renders stat cards, a meter and both tables", () => {
    const html = renderContextHtml(result(), { window: 10000 });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("clines — context report");
    expect(html).toContain("1,000");
    expect(html).toContain('style="width:10.0%"');
    expect(html).toContain("src/big.ts");
    expect(html).toContain("Largest directories");
  });

  it("caps the meter at 100% and truncates to top", () => {
    const html = renderContextHtml(result(), { window: 100, top: 1 });

    expect(html).toContain('style="width:100.0%"');
    expect(html).toContain("… and 1 more files not shown.");
    expect(html).not.toContain("src/small.ts");
  });

  it("shows empty states for a project with no files", () => {
    const html = renderContextHtml(empty);

    expect(html).toContain("No files to measure.");
    expect(html).toContain("0%");
  });

  it("escapes paths and honours a zero window", () => {
    const html = renderContextHtml(
      result({
        files: [
          {
            path: "src/<script>.ts",
            language: "TypeScript",
            tokens: 10,
            codeTokens: 10,
            commentTokens: 0,
            lines: 1,
          },
        ],
      }),
      { window: 0 },
    );

    expect(html).toContain("src/&lt;script&gt;.ts");
    expect(html).not.toContain("<script>.ts");
    expect(html).toContain('style="width:0.0%"');
  });

  it("uses a custom title", () => {
    expect(renderContextHtml(result(), { title: "custom" })).toContain("<title>custom</title>");
  });
});

describe("working set and navigability", () => {
  it("counts files that dominate a single read", () => {
    const big = result({
      files: [
        {
          path: "a.ts",
          language: "TS",
          tokens: 30000,
          codeTokens: 30000,
          commentTokens: 0,
          lines: 1,
        },
        {
          path: "b.ts",
          language: "TS",
          tokens: 13000,
          codeTokens: 13000,
          commentTokens: 0,
          lines: 1,
        },
        {
          path: "c.ts",
          language: "TS",
          tokens: 6000,
          codeTokens: 6000,
          commentTokens: 0,
          lines: 1,
        },
        { path: "d.ts", language: "TS", tokens: 100, codeTokens: 100, commentTokens: 0, lines: 1 },
      ],
    });

    expect(budgetTiers(big, 50000)).toEqual([
      { share: 0.5, threshold: 25000, files: 1 },
      { share: 0.25, threshold: 12500, files: 2 },
      { share: 0.1, threshold: 5000, files: 3 },
    ]);

    const output = renderContext(big, 200000, 50000);
    expect(output).toContain("Working set (50,000 tokens)");
    expect(output).toContain("1 files exceed 50%");
    expect(output).toContain("(> 25,000 tokens)");
  });

  it("reports ambiguous basenames and depth", () => {
    const output = renderContext(
      result({
        navigability: {
          files: 10,
          ambiguousFiles: 4,
          worstNames: [{ name: "index.ts", count: 3 }],
          medianDepth: 3,
          maxDepth: 7,
        },
      }),
      200000,
      50000,
    );

    expect(output).toContain("4 of 10 files (40%) share a basename");
    expect(output).toContain("worst: index.ts \u00d73");
    expect(output).toContain("median 3, max 7");
  });

  it("omits the worst-name list when nothing repeats", () => {
    const output = renderContext(result(), 200000, 50000);
    expect(output).toContain("0 of 2 files (0%) share a basename");
    expect(output).not.toContain("worst:");
  });

  it("renders both sections in the HTML report", () => {
    const html = renderContextHtml(result(), { budget: 40000 });
    expect(html).toContain("Working set");
    expect(html).toContain("40,000 tokens");
    expect(html).toContain("Navigability");
  });

  it("omits the navigability table when there are no files", () => {
    expect(renderContextHtml(empty)).not.toContain("Files sharing a basename");
  });

  it("names repeated basenames in the HTML report, escaped", () => {
    const html = renderContextHtml(
      result({
        navigability: {
          files: 4,
          ambiguousFiles: 2,
          worstNames: [{ name: "<index>.ts", count: 2 }],
          medianDepth: 2,
          maxDepth: 3,
        },
      }),
    );

    expect(html).toContain("&lt;index&gt;.ts &times;2");
    expect(html).not.toContain("&mdash;");
  });
});

describe("renderComments", () => {
  it("summarises drift and names the worst files", () => {
    const output = renderComments({
      filesChecked: 2,
      blocks: 100,
      drifted: 25,
      years: 3,
      worst: [{ path: "src/a.ts", blocks: 40, drifted: 20 }],
    });

    expect(output).toContain("2 most commented files, 3-year threshold");
    expect(output).toContain("25 of 100 comment blocks (25%)");
    expect(output).toContain("src/a.ts 20/40");
  });

  it("omits the worst line when nothing drifted", () => {
    const output = renderComments({
      filesChecked: 1,
      blocks: 10,
      drifted: 0,
      years: 3,
      worst: [],
    });

    expect(output).toContain("0 of 10 comment blocks (0%)");
    expect(output).not.toContain("Worst:");
  });

  it("says so when there is nothing to compare", () => {
    const output = renderComments({
      filesChecked: 0,
      blocks: 0,
      drifted: 0,
      years: 3,
      worst: [],
    });

    expect(output).toContain("nothing to compare");
  });
});
