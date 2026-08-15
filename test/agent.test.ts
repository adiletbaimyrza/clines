import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "../src/cli/run.js";
import { judgeAgentRisk, type AgentInput } from "../src/core/analyzers/agent.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

function file(path: string, over: Partial<AgentInput> = {}): AgentInput {
  return {
    path,
    code: 100,
    density: 5,
    concentration: 50,
    tokens: 500,
    duplication: 0,
    ...over,
  };
}

function verdicts(files: AgentInput[]): Record<string, string> {
  return Object.fromEntries(
    judgeAgentRisk(files).candidates.map((file) => [file.path, file.verdict]),
  );
}

describe("judgeAgentRisk", () => {
  it("ignores empty files", () => {
    const report = judgeAgentRisk([file("empty.ts", { code: 0 })]);

    expect(report.measured).toBe(0);
    expect(report.candidates).toEqual([]);
  });

  it("calls a quiet file safe", () => {
    const rows = [
      file("calm.ts"),
      file("busy.ts", { density: 90, tokens: 9000 }),
      file("other.ts"),
      file("more.ts"),
    ];

    expect(verdicts(rows)["calm.ts"]).toBe("safe");
  });

  it("needs two signals before it asks for a human", () => {
    const rows = [
      file("dense.ts", { density: 90 }),
      file("both.ts", { density: 90, tokens: 9000 }),
      file("a.ts"),
      file("b.ts"),
    ];
    const result = verdicts(rows);

    expect(result["dense.ts"]).toBe("review");
    expect(result["both.ts"]).toBe("human");
  });

  it("needs an absolute floor, not just the top quartile", () => {
    // in a tidy repo something is always at p75; that must not make it risky
    const rows = [file("a.ts"), file("b.ts"), file("c.ts"), file("d.ts")];
    const report = judgeAgentRisk(rows);

    expect(report.limits).toMatchObject({ dense: 10, large: 2000 });
    expect(report.candidates.every((file) => file.risks.length === 0)).toBe(true);
  });

  it("flags duplication on an absolute share, not a quantile", () => {
    const report = judgeAgentRisk([
      file("copied.ts", { duplication: 25 }),
      file("a.ts"),
      file("b.ts"),
      file("c.ts"),
    ]);
    const copied = report.candidates.find((file) => file.path === "copied.ts");

    expect(copied!.risks).toContain("duplicated");
    expect(report.limits.duplicated).toBe(20);
  });

  it("calls a dense file with no local hotspot diffuse", () => {
    const rows = [
      file("diffuse.ts", { density: 90, concentration: 4 }),
      file("focused.ts", { density: 90, concentration: 60 }),
      file("a.ts"),
      file("b.ts"),
    ];
    const report = judgeAgentRisk(rows);
    const risks = (path: string) =>
      report.candidates.find((file) => file.path === path)!.risks.join();

    expect(risks("diffuse.ts")).toContain("diffuse");
    expect(risks("focused.ts")).not.toContain("diffuse");
  });

  it("does not call a simple file diffuse just because it has no hotspot", () => {
    const rows = [
      file("simple.ts", { density: 0, concentration: 1 }),
      file("a.ts", { density: 9 }),
    ];
    const report = judgeAgentRisk(rows);

    expect(report.candidates.find((file) => file.path === "simple.ts")!.risks).toEqual([]);
  });

  it("counts the verdicts", () => {
    const report = judgeAgentRisk([
      file("a.ts", { density: 90, tokens: 9000 }),
      file("b.ts"),
      file("c.ts"),
      file("d.ts"),
    ]);

    expect(report.verdicts.human + report.verdicts.review + report.verdicts.safe).toBe(4);
  });

  it("sorts the riskiest first and breaks ties on path", () => {
    const report = judgeAgentRisk([
      file("z.ts"),
      file("a.ts"),
      file("risky.ts", { density: 90, tokens: 9000 }),
    ]);

    expect(report.candidates[0]!.path).toBe("risky.ts");
    expect(report.candidates.slice(1).map((file) => file.path)).toEqual(["a.ts", "z.ts"]);
  });
});

describe("runAgent", () => {
  it("rates the files in a project", async () => {
    project.file("calm.ts", "const a = 1;\n");
    project.file("dense.ts", `${"if (a && b) { c(); }\n".repeat(30)}`);
    const { io, out } = captureIO();

    const code = await runAgent({ dir: project.root, top: 20, minLines: 5 }, io);

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Agent risk:");
    expect(out.join("\n")).toContain("What the signals mean");
  });

  it("says so when nothing carries a risk", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 20, minLines: 5 }, io);

    expect(out.join("\n")).toContain("Nothing here carries a risk signal.");
  });

  it("reports an empty project without crashing", async () => {
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 20, minLines: 5 }, io);

    expect(out.join("\n")).toContain("No files found.");
  });

  it("picks up duplication between files", async () => {
    const block = "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 20, minLines: 3, json: true }, io);
    const result = JSON.parse(out.join("\n")).result as {
      candidates: { path: string; duplication: number }[];
    };

    expect(result.candidates.every((file) => file.duplication === 100)).toBe(true);
  });

  it("rates a file with no extension and one with no code", async () => {
    project.file("Makefile", "all:\n\tls\n");
    project.file("notes.ts", "// only a comment\n");
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 20, minLines: 5, json: true }, io);
    const result = JSON.parse(out.join("\n")).result as { measured: number };

    expect(result.measured).toBeGreaterThan(0);
  });

  it("emits JSON under the shared envelope", async () => {
    project.file("dense.ts", `${"if (a && b) { c(); }\n".repeat(30)}`);
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 20, minLines: 5, json: true }, io);
    const payload = JSON.parse(out.join("\n"));

    expect(payload.command).toBe("agent");
    expect(payload.result.verdicts).toHaveProperty("safe");
  });

  it("shows small token counts in full and large ones in thousands", async () => {
    project.file("small.ts", `${"if (a && b) { c(); }\n".repeat(4)}`);
    project.file("big.ts", `${"if (a && b) { c(); }\n".repeat(400)}`);
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 20, minLines: 5 }, io);

    const output = out.join("\n");
    expect(output).toMatch(/small\.ts\s+\w+\s+[\d.]+\s+44\b/);
    expect(output).toMatch(/big\.ts\s+\w+\s+[\d.]+\s+\dk\b/);
  });

  it("truncates the list and says how much is left", async () => {
    for (let i = 0; i < 8; i++) {
      project.file(`f${i}.ts`, `${"if (a && b) { c(); }\n".repeat(10)}`);
    }
    const { io, out } = captureIO();

    await runAgent({ dir: project.root, top: 1, minLines: 5 }, io);

    expect(out.join("\n")).toMatch(/… and \d+ more files\./);
  });
});
