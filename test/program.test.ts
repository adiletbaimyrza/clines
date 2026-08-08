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

  it("runs complexity with default top 100 via the cx alias", async () => {
    const complexityRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "cx", project.root], io, { complexityRunner });

    expect(complexityRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      top: 100,
      open: true,
    });
  });

  it("parses --top, --html, --no-open and --config for complexity", async () => {
    const complexityRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(
      [
        "node",
        "clines",
        "complexity",
        project.root,
        "--top",
        "25",
        "--html",
        "cx.html",
        "--no-open",
        "--config",
        "c.json",
      ],
      io,
      { complexityRunner },
    );

    expect(complexityRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      top: 25,
      open: false,
      html: "cx.html",
      config: "c.json",
    });
  });

  it("wires the real complexity pipeline by default", async () => {
    project.file("a.ts", "if (a) {}\n");
    const { io, out } = captureIO();

    await runCli(["node", "clines", "cx", project.root], io);

    expect(out.join("\n")).toContain("Complexity:");
  });

  it("runs context with a default 200k window via the ctx alias", async () => {
    const contextRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "ctx", project.root], io, { contextRunner });

    expect(contextRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      window: 200000,
      top: 100,
      open: true,
    });
  });

  it("parses --window, --max, --top, --html, --no-open and --config for context", async () => {
    const contextRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(
      [
        "node",
        "clines",
        "context",
        project.root,
        "--window",
        "1m",
        "--max",
        "200k",
        "--top",
        "25",
        "--html",
        "ctx.html",
        "--no-open",
        "--config",
        "c.json",
      ],
      io,
      { contextRunner },
    );

    expect(contextRunner.mock.calls[0]![0]).toEqual({
      dir: project.root,
      window: 1000000,
      max: 200000,
      top: 25,
      open: false,
      html: "ctx.html",
      config: "c.json",
    });
  });

  it("accepts a plain token count and rejects malformed budgets", async () => {
    const contextRunner = vi.fn(async (): Promise<number> => 0);
    const { io } = captureIO();

    await runCli(["node", "clines", "ctx", project.root, "--window", "50000"], io, {
      contextRunner,
    });
    expect(contextRunner.mock.calls[0]![0]).toMatchObject({ window: 50000 });

    for (const bad of ["abc", "0", "1kb"]) {
      await expect(
        runCli(["node", "clines", "ctx", project.root, "--window", bad], io, { contextRunner }),
      ).rejects.toBeTruthy();
    }
    expect(contextRunner).toHaveBeenCalledTimes(1);
  });

  it("wires the real context pipeline by default", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await runCli(["node", "clines", "ctx", project.root], io);

    expect(out.join("\n")).toContain("Context:");
  });
});
