import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../src/cli/program.js";
import type { RunOptions } from "../src/cli/run.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

describe("buildProgram", () => {
  it("runs count read-only by default", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();
    const program = buildProgram(io, { runner });

    await program.parseAsync(["node", "clines", "count", project.root]);

    const options = runner.mock.calls[0]![0] as RunOptions;
    expect(options).toEqual({ dir: project.root, readme: false });
  });

  it("passes --readme and --config through", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();
    const program = buildProgram(io, { runner });

    await program.parseAsync([
      "node",
      "clines",
      "count",
      project.root,
      "--readme",
      "--config",
      "cfg.json",
    ]);

    const options = runner.mock.calls[0]![0] as RunOptions;
    expect(options).toMatchObject({ readme: true, config: "cfg.json" });
  });

  it("defaults the directory to '.'", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();
    const program = buildProgram(io, { runner });

    await program.parseAsync(["node", "clines", "count"]);

    expect((runner.mock.calls[0]![0] as RunOptions).dir).toBe(".");
  });

  it("prints the banner for the bare command", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io, out } = captureIO();
    const program = buildProgram(io, { runner, version: "9.9.9" });

    await program.parseAsync(["node", "clines"]);

    expect(runner).not.toHaveBeenCalled();
    expect(out.join("\n")).toContain("clines");
    expect(out.join("\n")).toContain("9.9.9");
  });

  it("wires the real run pipeline by default", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();
    const program = buildProgram(io);

    await program.parseAsync(["node", "clines", "count", project.root]);

    expect(out.join("\n")).toContain("Total");
  });
});
