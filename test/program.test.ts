import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli/program.js";
import type { RunOptions } from "../src/cli/run.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

describe("runCli", () => {
  it("runs count read-only by default", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "count", project.root], io, { runner });

    const options = runner.mock.calls[0]![0] as RunOptions;
    expect(options).toEqual({ dir: project.root, readme: false });
  });

  it("passes --readme and --config through", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(
      ["node", "clines", "count", project.root, "--readme", "--config", "cfg.json"],
      io,
      { runner },
    );

    const options = runner.mock.calls[0]![0] as RunOptions;
    expect(options).toMatchObject({ readme: true, config: "cfg.json" });
  });

  it("defaults the directory to '.'", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "count"], io, { runner });

    expect((runner.mock.calls[0]![0] as RunOptions).dir).toBe(".");
  });

  it("prints the banner for the bare command", async () => {
    const runner = vi.fn(async (): Promise<number> => 0);
    const { io, out } = captureIO();

    await runCli(["node", "clines"], io, { runner, version: "9.9.9" });

    expect(runner).not.toHaveBeenCalled();
    expect(out.join("\n")).toContain("clines");
    expect(out.join("\n")).toContain("9.9.9");
  });

  it("wires the real run pipeline by default", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await runCli(["node", "clines", "count", project.root], io);

    expect(out.join("\n")).toContain("Total");
  });

  it("runs dup with default min-lines 5 and min-copies 2", async () => {
    const dupRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "dup", project.root], io, { dupRunner });

    expect(dupRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      minLines: 5,
      minCopies: 2,
      open: true,
    });
  });

  it("parses --min-lines, --min-copies and --config for dup", async () => {
    const dupRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(
      [
        "node",
        "clines",
        "dup",
        project.root,
        "--min-lines",
        "8",
        "--min-copies",
        "3",
        "--config",
        "c.json",
      ],
      io,
      { dupRunner },
    );

    expect(dupRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      minLines: 8,
      minCopies: 3,
      open: true,
      config: "c.json",
    });
  });

  it("passes --html through to dup and opens by default", async () => {
    const dupRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "dup", project.root, "--html", "report.html"], io, {
      dupRunner,
    });

    expect(dupRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      minLines: 5,
      minCopies: 2,
      open: true,
      html: "report.html",
    });
  });

  it("disables opening with --no-open", async () => {
    const dupRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(
      ["node", "clines", "dup", project.root, "--html", "report.html", "--no-open"],
      io,
      {
        dupRunner,
      },
    );

    expect(dupRunner.mock.calls[0]![0]).toMatchObject({ open: false, html: "report.html" });
  });

  it("rejects a non-positive --min-lines", async () => {
    const dupRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await expect(
      runCli(["node", "clines", "dup", project.root, "--min-lines", "0"], io, { dupRunner }),
    ).rejects.toBeTruthy();
    expect(dupRunner).not.toHaveBeenCalled();
  });

  it("wires the real dup pipeline by default", async () => {
    const block = "a1();\na2();\na3();\na4();\na5();\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const { io, out } = captureIO();

    await runCli(["node", "clines", "dup", project.root], io);

    expect(out.join("\n")).toContain("Duplication:");
  });
});
