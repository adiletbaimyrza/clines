import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli/program.js";
import { runComments, runComplexity, runDup, runRefactor } from "../src/cli/run.js";
import { fakeLog } from "./helpers/history.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

const NOW = Math.floor(Date.now() / 1000);
const LONG_AGO = NOW - 10 * 365 * 24 * 60 * 60;

const CLONE = "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n";

function dupOptions(maxDuplication?: number) {
  return {
    dir: project.root,
    top: 10,
    minLines: 3,
    minCopies: 2,
    open: false,
    ...(maxDuplication === undefined ? {} : { maxDuplication }),
  };
}

describe("dup --max-duplication", () => {
  it("exits 2 when duplication is over the limit", async () => {
    project.file("a.ts", CLONE);
    project.file("b.ts", CLONE);
    const { io, err } = captureIO();

    const code = await runDup(dupOptions(10), io);

    expect(code).toBe(2);
    expect(err.join("\n")).toContain("(--max-duplication)");
  });

  it("exits 0 when duplication is within the limit", async () => {
    project.file("a.ts", CLONE);
    project.file("b.ts", CLONE);
    const { io, err } = captureIO();

    expect(await runDup(dupOptions(100), io)).toBe(0);
    expect(err.join("\n")).not.toContain("Duplication exceeded");
  });

  it("stays quiet without the flag", async () => {
    project.file("a.ts", CLONE);
    project.file("b.ts", CLONE);
    const { io } = captureIO();

    expect(await runDup(dupOptions(), io)).toBe(0);
  });
});

describe("cx --max-density", () => {
  it("names the worst file when density is over the limit", async () => {
    project.file("dense.ts", "if (a && b) { c(); }\n");
    project.file("calm.ts", `${"const x = 1;\n".repeat(20)}if (a) { b(); }\n`);
    const { io, err } = captureIO();

    const code = await runComplexity(
      {
        dir: project.root,
        sort: "raw",
        minLines: 1,
        top: 20,
        open: false,
        maxDensity: 10,
      },
      io,
      () => {},
    );

    expect(code).toBe(2);
    expect(err.join("\n")).toContain("dense.ts");
    expect(err.join("\n")).toContain("(--max-density)");
  });

  it("exits 0 when every file is under the limit", async () => {
    project.file("dense.ts", "if (a && b) { c(); }\n");
    const { io } = captureIO();

    const code = await runComplexity(
      { dir: project.root, sort: "raw", minLines: 1, top: 20, open: false, maxDensity: 1000 },
      io,
      () => {},
    );

    expect(code).toBe(0);
  });

  it("exits 0 when --min-lines leaves nothing to judge", async () => {
    project.file("dense.ts", "if (a && b) { c(); }\n");
    const { io } = captureIO();

    const code = await runComplexity(
      { dir: project.root, sort: "raw", minLines: 500, top: 20, open: false, maxDensity: 1 },
      io,
      () => {},
    );

    expect(code).toBe(0);
  });
});

describe("comments --max-drift", () => {
  it("exits 2 when too many blocks have drifted", async () => {
    project.file("a.ts", "// explains the line below\nconst a = 1;\n");
    const { io, err } = captureIO();

    const code = await runComments(
      { dir: project.root, top: 20, scan: 10, years: 3, maxDrift: 10 },
      io,
      { blamer: async () => [LONG_AGO, NOW] },
    );

    expect(code).toBe(2);
    expect(err.join("\n")).toContain("(--max-drift)");
  });

  it("exits 0 when drift is within the limit", async () => {
    project.file("a.ts", "// explains the line below\nconst a = 1;\n");
    const { io } = captureIO();

    const code = await runComments(
      { dir: project.root, top: 20, scan: 10, years: 3, maxDrift: 100 },
      io,
      { blamer: async () => [LONG_AGO, NOW] },
    );

    expect(code).toBe(0);
  });

  it("cannot fail when git is unavailable", async () => {
    project.file("a.ts", "// a comment\nconst a = 1;\n");
    const { io } = captureIO();

    const code = await runComments(
      { dir: project.root, top: 20, scan: 10, years: 3, maxDrift: 0 },
      io,
      { blamer: async () => undefined },
    );

    expect(code).toBe(0);
  });
});

describe("refactor --max-reread", () => {
  const log = fakeLog({ files: ["a.ts"] }, { files: ["a.ts"] });

  it("exits 2 and names the file when re-reading has cost too much", async () => {
    project.file("a.ts", "if (a && b) { c(); }\n");
    const { io, err } = captureIO();

    const code = await runRefactor(
      { dir: project.root, since: "2 years ago", top: 20, maxReread: 1 },
      io,
      async () => log,
    );

    expect(code).toBe(2);
    expect(err.join("\n")).toContain("a.ts");
    expect(err.join("\n")).toContain("(--max-reread)");
  });

  it("exits 0 under the limit", async () => {
    project.file("a.ts", "if (a && b) { c(); }\n");
    const { io } = captureIO();

    const code = await runRefactor(
      { dir: project.root, since: "2 years ago", top: 20, maxReread: 1000000 },
      io,
      async () => log,
    );

    expect(code).toBe(0);
  });

  it("cannot fail outside a git repository", async () => {
    project.file("a.ts", "if (a && b) { c(); }\n");
    const { io } = captureIO();

    const code = await runRefactor(
      { dir: project.root, since: "2 years ago", top: 20, maxReread: 1 },
      io,
      async () => undefined,
    );

    expect(code).toBe(0);
  });
});

describe("refactor --include-bots", () => {
  it("counts automation when asked", async () => {
    project.file("a.ts", "if (a && b) { c(); }\n");
    const log = `${fakeLog({ files: ["a.ts"] })}${fakeLog({
      files: ["a.ts"],
      name: "dependabot[bot]",
      email: "dependabot[bot]@users.noreply.github.com",
    })}`;
    const { io, out } = captureIO();

    await runRefactor(
      { dir: project.root, since: "2y", top: 20, includeBots: true, json: true },
      io,
      async () => log,
    );

    expect(JSON.parse(out.join("\n")).result.candidates[0].changes).toBe(2);
  });
});

describe("exit codes through the CLI", () => {
  it("returns the gate code from the command that raised it", async () => {
    const { io } = captureIO();
    const contextRunner = vi.fn(async () => 2);

    const code = await runCli(["node", "clines", "ctx", "--max", "1"], io, {
      contextRunner,
      flush: { paged: false },
    });

    expect(code).toBe(2);
  });

  it("returns 0 when the command is happy", async () => {
    const { io } = captureIO();
    const contextRunner = vi.fn(async () => 0);

    const code = await runCli(["node", "clines", "ctx"], io, {
      contextRunner,
      flush: { paged: false },
    });

    expect(code).toBe(0);
  });

  it("passes --diff through on every command", async () => {
    const { io } = captureIO();
    const runners = {
      runner: vi.fn(async () => 0),
      dupRunner: vi.fn(async () => 0),
      complexityRunner: vi.fn(async () => 0),
      contextRunner: vi.fn(async () => 0),
      refactorRunner: vi.fn(async () => 0),
      commentsRunner: vi.fn(async () => 0),
    };

    for (const command of ["count", "dup", "cx", "ctx", "refactor", "comments"]) {
      await runCli(["node", "clines", command, "--diff", "main"], io, {
        ...runners,
        flush: { paged: false },
      });
    }

    for (const runner of Object.values(runners)) {
      expect(runner.mock.calls[0]![0]).toMatchObject({ diff: "main" });
    }
  });

  it("wires the coupling command", async () => {
    const { io } = captureIO();
    const couplingRunner = vi.fn(async () => 0);

    await runCli(
      ["node", "clines", "coupling", "--min-revisions", "3", "--min-shared", "4", "--include-bots"],
      io,
      { couplingRunner, flush: { paged: false } },
    );

    expect(couplingRunner.mock.calls[0]![0]).toMatchObject({
      since: "2 years ago",
      top: 20,
      minRevisions: 3,
      minShared: 4,
      minStrength: 50,
      maxCommitSize: 30,
      includeBots: true,
    });
  });

  it("wires the agent command through its alias", async () => {
    const { io } = captureIO();
    const agentRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "ai", "--top", "5", "--all", "--config", "c.json"], io, {
      agentRunner,
      flush: { paged: false },
    });

    expect(agentRunner.mock.calls[0]![0]).toMatchObject({
      top: 5,
      minLines: 5,
      all: true,
      config: "c.json",
    });
  });

  it("passes --diff and --config to the agent command", async () => {
    const { io } = captureIO();
    const agentRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "agent", "--diff", "main"], io, {
      agentRunner,
      flush: { paged: false },
    });

    expect(agentRunner.mock.calls[0]![0]).toMatchObject({ diff: "main" });
  });

  it("passes --config to the coupling command", async () => {
    const { io } = captureIO();
    const couplingRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "co", "--config", "c.json"], io, {
      couplingRunner,
      flush: { paged: false },
    });

    expect(couplingRunner.mock.calls[0]![0]).toMatchObject({ config: "c.json" });
  });

  it("passes --sort and --explain to refactor", async () => {
    const { io } = captureIO();
    const refactorRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "refactor", "--sort", "churn", "--explain"], io, {
      refactorRunner,
      flush: { paged: false },
    });

    expect(refactorRunner.mock.calls[0]![0]).toMatchObject({ sort: "churn", explain: true });
  });

  it("returns 0 for the bare banner", async () => {
    const { io } = captureIO();

    expect(await runCli(["node", "clines"], io)).toBe(0);
  });

  it("rejects a --max-duplication outside 0-100", async () => {
    const { io } = captureIO();
    const dupRunner = vi.fn(async () => 0);

    await expect(
      runCli(["node", "clines", "dup", "--max-duplication", "150"], io, {
        dupRunner,
        flush: { paged: false },
      }),
    ).rejects.toBeTruthy();
    expect(dupRunner).not.toHaveBeenCalled();
  });

  it("passes a valid --max-density through", async () => {
    const { io } = captureIO();
    const complexityRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "cx", "--max-density", "12.5"], io, {
      complexityRunner,
      flush: { paged: false },
    });

    expect(complexityRunner.mock.calls[0]![0]).toMatchObject({ maxDensity: 12.5 });
  });

  it("passes --max-reread and --max-drift through", async () => {
    const { io } = captureIO();
    const refactorRunner = vi.fn(async () => 0);
    const commentsRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "refactor", "--max-reread", "5m"], io, {
      refactorRunner,
      flush: { paged: false },
    });
    await runCli(["node", "clines", "comments", "--max-drift", "10"], io, {
      commentsRunner,
      flush: { paged: false },
    });

    expect(refactorRunner.mock.calls[0]![0]).toMatchObject({ maxReread: 5000000 });
    expect(commentsRunner.mock.calls[0]![0]).toMatchObject({ maxDrift: 10 });
  });

  it("accepts a percentage written with a trailing sign", async () => {
    const { io } = captureIO();
    const dupRunner = vi.fn(async () => 0);

    await runCli(["node", "clines", "dup", "--max-duplication", "12.5%"], io, {
      dupRunner,
      flush: { paged: false },
    });

    expect(dupRunner.mock.calls[0]![0]).toMatchObject({ maxDuplication: 12.5 });
  });

  it("rejects a non-positive --max-density", async () => {
    const { io } = captureIO();
    const complexityRunner = vi.fn(async () => 0);

    await expect(
      runCli(["node", "clines", "cx", "--max-density", "0"], io, {
        complexityRunner,
        flush: { paged: false },
      }),
    ).rejects.toBeTruthy();
    expect(complexityRunner).not.toHaveBeenCalled();
  });
});
