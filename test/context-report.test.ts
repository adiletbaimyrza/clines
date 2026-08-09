import { describe, expect, it } from "vitest";
import type { ContextResult } from "../src/core/model.js";
import { renderContext, renderContextHtml } from "../src/report/format/context.js";

function result(overrides: Partial<ContextResult> = {}): ContextResult {
  return {
    excluded: { files: 0, roles: [] },
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
    const output = renderContext(result(), 10000, 1);

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
