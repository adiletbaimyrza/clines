import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/schema.js";
import { analyze, analyzeDuplication } from "../src/core/pipeline.js";
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

describe("analyzeDuplication", () => {
  it("detects a duplicated block across collected files", async () => {
    const block = "a1();\na2();\na3();\na4();\na5();\n";
    project.file("a.ts", block);
    project.file("b.ts", block);

    const result = await analyzeDuplication(project.root, defaultConfig(), [], 5);

    expect(result.percentage).toBeGreaterThan(0);
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0]!.fragments).toHaveLength(2);
  });
});
