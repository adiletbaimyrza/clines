import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../src/cli/program.js";
import { run } from "../src/cli/run.js";
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
  it("runs the default scan command with parsed flags", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();
    const program = buildProgram(io, { runner });

    await program.parseAsync(["node", "clines", project.root, "--no-readme"]);

    expect(runner).toHaveBeenCalledTimes(1);
    const options = runner.mock.calls[0]![0] as RunOptions;
    expect(options).toEqual({ dir: project.root, json: false, readme: false });
  });

  it("passes --json and --config through", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();
    const program = buildProgram(io, { runner });

    await program.parseAsync([
      "node",
      "clines",
      "scan",
      project.root,
      "--json",
      "--stdout",
      "--config",
      "cfg.json",
    ]);

    const options = runner.mock.calls[0]![0] as RunOptions;
    expect(options).toMatchObject({ json: true, readme: true, config: "cfg.json" });
  });

  it("defaults the directory to '.'", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();
    const program = buildProgram(io, { runner });

    await program.parseAsync(["node", "clines", "--no-readme"]);

    expect((runner.mock.calls[0]![0] as RunOptions).dir).toBe(".");
  });

  it("wires the real run pipeline by default", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();
    const program = buildProgram(io);

    await program.parseAsync(["node", "clines", project.root, "--json", "--no-readme"]);

    expect(JSON.parse(out[0]!).totalCode).toBe(1);
    expect(typeof run).toBe("function");
  });
});
