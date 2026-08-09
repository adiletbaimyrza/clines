import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/schema.js";
import {
  analyze,
  analyzeComplexity,
  analyzeComments,
  analyzeContext,
  analyzeDuplication,
} from "../src/core/pipeline.js";
import { TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

describe("analyze", () => {
  it("tokenizes collected files and aggregates a report", async () => {
    project.file("a.ts", "const a = 1;\n\n// note\n");
    project.file("b.py", "x = 1\n# c\n");
    project.file("skip.log", "ignored");

    const report = await analyze(project.root, defaultConfig());

    expect(report.totalFiles).toBe(2);
    expect(report.totalCode).toBe(2);
    const ts = report.languages.find((l) => l.language === "TypeScript");
    expect(ts).toMatchObject({ code: 1, comment: 1, blank: 1 });
  });
});

describe("analyzeComplexity", () => {
  it("ranks files by complexity, high to low, with language and code counts", async () => {
    project.file("hot.ts", "if (a) {}\nif (b) {}\nwhile (c) {}\n");
    project.file("cool.ts", "if (a) {}\n");
    project.file("also.ts", "if (a) {}\n");
    project.file("data.json", '{ "a": 1 }\n');

    const { files } = await analyzeComplexity(project.root, defaultConfig());

    expect(files.map((f) => f.path)).toEqual(["hot.ts", "also.ts", "cool.ts", "data.json"]);
    expect(files[0]).toMatchObject({ complexity: 3, language: "TypeScript" });
    expect(files[3]!.complexity).toBe(0);
    expect(files[0]!.code).toBe(3);
  });
});

describe("analyzeContext", () => {
  it("ranks files by tokens and splits code from comment tokens", async () => {
    project.file("src/big.ts", "// explain\nconst userName = getUser(id);\nconst other = 2;\n");
    project.file("src/small.ts", "const a = 1;\n");

    const result = await analyzeContext(project.root, defaultConfig());

    expect(result.files.map((f) => f.path)).toEqual(["src/big.ts", "src/small.ts"]);
    expect(result.files[0]!.language).toBe("TypeScript");
    expect(result.files[0]!.lines).toBe(3);
    expect(result.files[0]!.commentTokens).toBeGreaterThan(0);
    expect(result.files[0]!.tokens).toBe(
      result.files[0]!.codeTokens + result.files[0]!.commentTokens,
    );
    expect(result.totalTokens).toBe(result.codeTokens + result.commentTokens);
  });

  it("breaks ties on path and rolls files up per top-level directory", async () => {
    project.file("src/b.ts", "const a = 1;\n");
    project.file("src/a.ts", "const a = 1;\n");
    project.file("lib/a.ts", "const a = 1;\n");
    project.file("root.ts", "const a = 1;\n");

    const result = await analyzeContext(project.root, defaultConfig());

    expect(result.files.map((f) => f.path)).toEqual([
      "lib/a.ts",
      "root.ts",
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(result.dirs.map((d) => d.dir)).toEqual(["src", ".", "lib"]);
    expect(result.dirs[0]).toMatchObject({ files: 2 });
  });

  it("measures files without an extension", async () => {
    project.file("Makefile", "build:\n\tnpm run build\n");

    const result = await analyzeContext(project.root, defaultConfig());

    expect(result.files[0]!.path).toBe("Makefile");
    expect(result.files[0]!.tokens).toBeGreaterThan(0);
  });

  it("returns empty totals for an empty project", async () => {
    const result = await analyzeContext(project.root, defaultConfig());

    expect(result).toMatchObject({ files: [], dirs: [], totalTokens: 0 });
  });
});

describe("file roles", () => {
  it("excludes non-source files by default and reports what was excluded", async () => {
    project.file("src/app.ts", "const a = 1;\n");
    project.file("src/__tests__/app.test.ts", "const b = 2;\n");
    project.file("README.md", "# hi\n");

    const result = await analyzeContext(project.root, defaultConfig());

    expect(result.files.map((f) => f.path)).toEqual(["src/app.ts"]);
    expect(result.excluded.files).toBe(2);
    expect(result.excluded.roles.map((r) => r.role).sort()).toEqual(["docs", "test"]);
  });

  it("includes every role when includeAll is set", async () => {
    project.file("src/app.ts", "const a = 1;\n");
    project.file("src/__tests__/app.test.ts", "const b = 2;\n");

    const result = await analyzeContext(project.root, defaultConfig(), [], { includeAll: true });

    expect(result.files).toHaveLength(2);
    expect(result.excluded).toEqual({ files: 0, roles: [] });
  });

  it("reports per-role totals from count and honours includeAll", async () => {
    project.file("src/app.ts", "const a = 1;\n");
    project.file("src/__tests__/app.test.ts", "const b = 2;\n");

    const report = await analyze(project.root, defaultConfig());
    expect(report.totalFiles).toBe(1);
    expect(report.roles).toEqual([
      { role: "source", files: 1, code: 1 },
      { role: "test", files: 1, code: 1 },
    ]);

    const all = await analyze(project.root, defaultConfig(), [], { includeAll: true });
    expect(all.totalFiles).toBe(2);
  });

  it("excludes non-source files from duplication and complexity", async () => {
    const block = "a1();\na2();\na3();\na4();\na5();\n";
    project.file("a.ts", block);
    project.file("__tests__/b.ts", block);

    const dup = await analyzeDuplication(project.root, defaultConfig(), [], 5, 2);
    expect(dup.clones).toHaveLength(0);
    expect(dup.excluded.files).toBe(1);

    const cx = await analyzeComplexity(project.root, defaultConfig());
    expect(cx.files.map((f) => f.path)).toEqual(["a.ts"]);
    expect(cx.excluded.files).toBe(1);
  });
});

describe("analyzeDuplication", () => {
  it("detects a duplicated block across collected files", async () => {
    const block = "a1();\na2();\na3();\na4();\na5();\n";
    project.file("a.ts", block);
    project.file("b.ts", block);

    const result = await analyzeDuplication(project.root, defaultConfig(), [], 5, 2);

    expect(result.percentage).toBeGreaterThan(0);
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0]!.fragments).toHaveLength(2);
  });
});

describe("analyzeComments", () => {
  const YEAR = 365 * 24 * 60 * 60;

  it("reports drift using blame times", async () => {
    project.file("a.ts", "// old note\nconst a = 1;\n");
    const ctx = await analyzeContext(project.root, defaultConfig());

    const health = await analyzeComments(project.root, ctx.files, {
      years: 3,
      blamer: async () => [0, 9 * YEAR],
    });

    expect(health).toMatchObject({ filesChecked: 1, blocks: 1, drifted: 1, years: 3 });
    expect(health!.worst[0]).toMatchObject({ path: "a.ts", drifted: 1 });
  });

  it("returns undefined when nothing can be blamed", async () => {
    project.file("a.ts", "// note\nconst a = 1;\n");
    const ctx = await analyzeContext(project.root, defaultConfig());

    expect(
      await analyzeComments(project.root, ctx.files, { blamer: async () => undefined }),
    ).toBeUndefined();
  });

  it("returns undefined when no file has comments", async () => {
    project.file("a.ts", "const a = 1;\n");
    const ctx = await analyzeContext(project.root, defaultConfig());

    expect(
      await analyzeComments(project.root, ctx.files, { blamer: async () => [0] }),
    ).toBeUndefined();
  });

  it("checks only the most commented files up to the cap", async () => {
    project.file("a.ts", "// one\n// two\n// three\nconst a = 1;\n");
    project.file("b.ts", "// x\nconst b = 2;\n");
    const ctx = await analyzeContext(project.root, defaultConfig());
    const seen: string[] = [];

    await analyzeComments(project.root, ctx.files, {
      maxFiles: 1,
      blamer: async (_root, file) => {
        seen.push(file);
        return [0, 0, 0, 0];
      },
    });

    expect(seen).toEqual(["a.ts"]);
  });

  it("uses real git blame when no blamer is injected", async () => {
    const health = await analyzeComments(process.cwd(), [
      {
        path: "package.json",
        language: "JSON",
        tokens: 10,
        codeTokens: 9,
        commentTokens: 1,
        lines: 5,
      },
    ]);

    expect(health).toBeDefined();
  });

  it("breaks candidate ties on path", async () => {
    project.file("b.ts", "// note\nconst a = 1;\n");
    project.file("a.ts", "// note\nconst a = 1;\n");
    const ctx = await analyzeContext(project.root, defaultConfig());
    const seen: string[] = [];

    await analyzeComments(project.root, ctx.files, {
      maxFiles: 1,
      blamer: async (_root, file) => {
        seen.push(file);
        return [0, 0];
      },
    });

    expect(seen).toEqual(["a.ts"]);
  });

  it("defaults to a three-year threshold", async () => {
    project.file("a.ts", "// note\nconst a = 1;\n");
    const ctx = await analyzeContext(project.root, defaultConfig());

    const health = await analyzeComments(project.root, ctx.files, {
      blamer: async () => [0, 2 * YEAR],
    });

    expect(health).toMatchObject({ years: 3, drifted: 0 });
  });
});
