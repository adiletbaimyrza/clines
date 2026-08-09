import { describe, expect, it } from "vitest";
import type { CommentOutcome, FileDrift } from "../src/core/analyzers/comments.js";
import { renderComments } from "../src/report/format/comments.js";

function ok(files: FileDrift[], years = 3): CommentOutcome {
  const withBlocks = files.filter((f) => f.blocks > 0);
  return {
    status: "ok",
    health: {
      filesChecked: withBlocks.length,
      blocks: withBlocks.reduce((s, f) => s + f.blocks, 0),
      drifted: withBlocks.reduce((s, f) => s + f.drifted, 0),
      years,
      files: withBlocks,
    },
  };
}

describe("renderComments", () => {
  it("explains when there are no comments to compare", () => {
    expect(renderComments({ status: "no-comments" })).toContain("nothing to compare");
  });

  it("explains when git is unavailable", () => {
    expect(renderComments({ status: "unavailable" })).toContain("needs a git repository");
  });

  it("summarises drift and lists the worst files", () => {
    const output = renderComments(
      ok([
        { path: "src/a.ts", blocks: 100, drifted: 40 },
        { path: "src/b.ts", blocks: 50, drifted: 5 },
      ]),
    );

    expect(output).toContain("Comment drift: 30% of comment blocks");
    expect(output).toContain("45 of 150 blocks across 2 files");
    expect(output).toContain("3-year threshold");
    expect(output).toContain("Most drifted files");
    expect(output).toContain("src/a.ts");
    expect(output).toContain("40%");
  });

  it("reports a clean result when nothing drifted", () => {
    const output = renderComments(ok([{ path: "src/a.ts", blocks: 20, drifted: 0 }]));

    expect(output).toContain("0% of comment blocks");
    expect(output).toContain("No comment block has drifted past the threshold.");
    expect(output).not.toContain("Most drifted files");
  });

  it("truncates the file list and shortens long paths", () => {
    const long = `src/${"deep/".repeat(20)}file.ts`;
    const output = renderComments(
      ok([
        { path: long, blocks: 10, drifted: 9 },
        { path: "src/b.ts", blocks: 10, drifted: 5 },
        { path: "src/c.ts", blocks: 10, drifted: 1 },
      ]),
      1,
    );

    expect(output).toContain("…deep/");
    expect(output).not.toContain(long);
    expect(output).toContain("… and 2 more files.");
  });
});
