import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDup } from "../src/cli/run.js";
import {
  detectDuplication,
  locationOf,
  normalizeRenamed,
  rankClones,
  shapeOf,
  toDupFile,
  type Clone,
} from "../src/core/analyzers/duplication.js";
import { defaultConfig } from "../src/config/schema.js";
import { analyzeCloneChurn, analyzeDuplication } from "../src/core/pipeline.js";
import { renderDuplicationInsight } from "../src/report/format/duplication.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;
beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

const BLOCK = "a1();\na2();\na3();\na4();\na5();\n";

function clone(lineCount: number, paths: string[]): Clone {
  return {
    lineCount,
    code: [],
    fragments: paths.map((path, i) => ({ path, startLine: i + 1, endLine: i + lineCount })),
  };
}

describe("locationOf", () => {
  it("recognises every scope", () => {
    expect(locationOf(["a/b/c.ts"])).toBe("within-file");
    expect(locationOf(["a/b/c.ts", "a/b/d.ts"])).toBe("same-directory");
    expect(locationOf(["p/q/r/x/a.ts", "p/q/r/y/b.ts"])).toBe("same-package");
    expect(locationOf(["p/q/r/a.ts", "x/y/z/b.ts"])).toBe("cross-package");
  });
});

describe("rankClones", () => {
  it("ranks by removable lines, then size, then path", () => {
    const ranked = rankClones([
      clone(10, ["a.ts", "b.ts"]),
      clone(5, ["c.ts", "d.ts", "e.ts", "f.ts"]),
      clone(10, ["z.ts", "y.ts"]),
    ]);

    expect(ranked[0]).toMatchObject({ removable: 15, lineCount: 5 });
    expect(ranked[1]).toMatchObject({ removable: 10, copies: 2 });
    expect(ranked.map((c) => c.removable)).toEqual([15, 10, 10]);
  });
});

describe("shapeOf", () => {
  it("describes an empty result", () => {
    expect(shapeOf([])).toMatchObject({ groups: 0, removable: 0, medianLines: 0, underTen: 0 });
  });

  it("summarises size, location and spread", () => {
    const shape = shapeOf([clone(6, ["a/b.ts"]), clone(40, ["a/x.ts", "c/y.ts"])]);

    expect(shape.groups).toBe(2);
    expect(shape.removable).toBe(40);
    expect(shape.maxLines).toBe(40);
    expect(shape.underTen).toBe(50);
    expect(shape.byLocation["within-file"]).toBe(1);
    expect(shape.byLocation["cross-package"]).toBe(1);
    expect(shape.topTenShare).toBe(100);
  });
});

describe("normalizeRenamed", () => {
  it("masks identifiers but keeps keywords", () => {
    expect(normalizeRenamed("const alpha = beta(gamma);")).toBe("const $ = $($);");
    expect(normalizeRenamed("const delta = epsilon(zeta);")).toBe("const $ = $($);");
  });

  it("still collapses whitespace", () => {
    expect(normalizeRenamed("  if   (x)  ")).toBe("if ($)");
  });
});

describe("detectDuplication options", () => {
  it("drops duplication that sits inside one file when asked", () => {
    const files = [toDupFile("a.ts", BLOCK + "b();\n" + BLOCK)];

    expect(detectDuplication(files, 5, 2).clones).toHaveLength(1);
    expect(detectDuplication(files, 5, 2, { crossFileOnly: true }).clones).toHaveLength(0);
  });

  it("finds renamed clones only with the renaming normalizer", () => {
    const files = [
      toDupFile("a.ts", "const one = f(1);\nconst two = f(2);\nconst three = f(3);\n"),
      toDupFile("b.ts", "const alpha = f(1);\nconst beta = f(2);\nconst gamma = f(3);\n"),
    ];

    expect(detectDuplication(files, 3, 2).clones).toHaveLength(0);
    expect(detectDuplication(files, 3, 2, { normalizer: normalizeRenamed }).clones).toHaveLength(1);
  });
});

describe("analyzeDuplication reporting", () => {
  it("counts additional renamed groups only when asked", async () => {
    project.file("a.ts", "const one = f(1);\nconst two = f(2);\nconst three = f(3);\n");
    project.file("b.ts", "const alpha = f(1);\nconst beta = f(2);\nconst gamma = f(3);\n");

    const plain = await analyzeDuplication(project.root, defaultConfig(), [], 3, 2);
    expect(plain.renamedGroups).toBe(0);

    const renamed = await analyzeDuplication(project.root, defaultConfig(), [], 3, 2, {
      renamed: true,
    });
    expect(renamed.renamedGroups).toBe(1);
  });

  it("honours cross-file only", async () => {
    project.file("a.ts", BLOCK + "b();\n" + BLOCK);

    const all = await analyzeDuplication(project.root, defaultConfig(), [], 5, 2);
    const cross = await analyzeDuplication(project.root, defaultConfig(), [], 5, 2, {
      crossFileOnly: true,
    });

    expect(all.clones.length).toBeGreaterThan(0);
    expect(cross.clones).toHaveLength(0);
  });
});

describe("analyzeCloneChurn", () => {
  it("keeps the newest timestamp per file and skips unblamable ones", async () => {
    const churn = await analyzeCloneChurn(project.root, ["a.ts", "b.ts"], async (_root, file) =>
      file === "a.ts" ? [100, 900, 300] : undefined,
    );

    expect(churn.get("a.ts")).toBe(900);
    expect(churn.has("b.ts")).toBe(false);
  });
});

describe("renderDuplicationInsight", () => {
  const result = {
    minLines: 5,
    totalLines: 100,
    duplicatedLines: 40,
    percentage: 40,
    clones: [clone(6, ["a/b.ts"]), clone(40, ["a/x.ts", "c/y.ts"])],
    perFile: [],
    shape: shapeOf([clone(6, ["a/b.ts"]), clone(40, ["a/x.ts", "c/y.ts"])]),
    ranked: rankClones([clone(6, ["a/b.ts"]), clone(40, ["a/x.ts", "c/y.ts"])]),
    renamedGroups: 0,
    excluded: { files: 0, roles: [] },
  };

  it("says nothing when there is no duplication", () => {
    expect(renderDuplicationInsight({ ...result, shape: shapeOf([]) })).toEqual([]);
  });

  it("reports shape and the biggest opportunities", () => {
    const out = renderDuplicationInsight(result).join("\n");

    expect(out).toContain("Duplication shape");
    expect(out).toContain("2 clone groups");
    expect(out).toContain("40 lines removable");
    expect(out).toContain("within one file");
    expect(out).toContain("Biggest refactor opportunities");
    expect(out).toContain("a/x.ts");
  });

  it("calls out diffuse duplication only when the top groups hold little", () => {
    const many = Array.from({ length: 60 }, (_, i) => clone(5, [`a/f${i}.ts`, `b/f${i}.ts`]));
    const diffuse = renderDuplicationInsight({
      ...result,
      clones: many,
      shape: shapeOf(many),
      ranked: rankClones(many),
    }).join("\n");

    expect(diffuse).toContain("duplication is diffuse");
    expect(renderDuplicationInsight(result).join("\n")).not.toContain("duplication is diffuse");
  });

  it("mentions renamed groups when there are any", () => {
    expect(renderDuplicationInsight({ ...result, renamedGroups: 7 }).join("\n")).toContain(
      "7 further groups",
    );
  });

  it("adds an age column when churn is supplied", () => {
    const recent = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 20;
    const old = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365 * 4;
    const out = renderDuplicationInsight(
      result,
      10,
      new Map([
        ["a/x.ts", recent],
        ["a/b.ts", old],
      ]),
    ).join("\n");

    expect(out).toContain("Last touched");
    expect(out).toContain("mo");
    expect(out).toContain("4.0y");
  });

  it("shows a dash when a clone has no blame data", () => {
    expect(renderDuplicationInsight(result, 10, new Map()).join("\n")).toContain("—");
  });
});

describe("runDup with the new flags", () => {
  it("prints the shape above the report", async () => {
    project.file("a.ts", BLOCK);
    project.file("b.ts", BLOCK);
    const { io, out } = captureIO();

    await runDup(
      { dir: project.root, top: 10, minLines: 5, minCopies: 2, open: false, renamed: true },
      io,
      () => {},
    );

    const text = out.join("\n");
    expect(text.indexOf("Duplication shape")).toBeLessThan(text.indexOf("Duplication:"));
  });

  it("passes --cross-file through, including to the renamed pass", async () => {
    project.file("a.ts", BLOCK + "b();\n" + BLOCK);
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 5,
        minCopies: 2,
        open: false,
        crossFile: true,
        renamed: true,
      },
      io,
      () => {},
    );

    expect(out.join("\n")).toContain("Duplication: 0.0%");
    expect(out.join("\n")).not.toContain("Duplication shape");
  });

  it("blames files when --churn is set", async () => {
    project.file("a.ts", BLOCK);
    project.file("b.ts", BLOCK);
    const { io, out, err } = captureIO();

    await runDup(
      { dir: project.root, top: 10, minLines: 5, minCopies: 2, open: false, churn: true },
      io,
      () => {},
      { blamer: async () => [1_700_000_000] },
    );

    expect(err.join("\n")).toContain("Blaming");
    expect(out.join("\n")).toContain("Last touched");
  });
});
