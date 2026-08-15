import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  run,
  runComments,
  runComplexity,
  runContext,
  runDup,
  runRefactor,
} from "../src/cli/run.js";
import { SCHEMA } from "../src/report/format/json.js";
import { fakeLog } from "./helpers/history.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

function parse(out: string[]): Record<string, unknown> {
  return JSON.parse(out.join("\n")) as Record<string, unknown>;
}

const NOW = Math.floor(Date.now() / 1000);
const LONG_AGO = NOW - 10 * 365 * 24 * 60 * 60;

describe("--json", () => {
  it("wraps count in the envelope and reports the version it was told", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await run({ dir: project.root, readme: false, json: true, version: "9.9.9" }, io);
    const payload = parse(out);

    expect(payload).toMatchObject({
      schema: SCHEMA,
      tool: "clines",
      version: "9.9.9",
      command: "count",
      root: project.root,
    });
    expect(payload["result"]).toMatchObject({ totalCode: 1, totalFiles: 1 });
  });

  it("falls back to 0.0.0 when no version is supplied", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await run({ dir: project.root, readme: false, json: true }, io);

    expect(parse(out)["version"]).toBe("0.0.0");
  });

  it("still writes the README while printing JSON", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("README.md", "# Demo\n");
    const { io, out } = captureIO();

    await run({ dir: project.root, readme: true, json: true }, io);

    expect(parse(out)["command"]).toBe("count");
    expect(out.join("\n")).not.toContain("Project size:");
  });

  it("keeps clone fragments but drops the snippets", async () => {
    const block = "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        json: true,
      },
      io,
    );
    const result = parse(out)["result"] as { clones: Record<string, unknown>[] };

    expect(result.clones.length).toBeGreaterThan(0);
    expect(result.clones[0]).toHaveProperty("fragments");
    expect(result.clones[0]).not.toHaveProperty("code");
  });

  it("carries the churn it was asked to collect", async () => {
    const block = "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        churn: true,
        json: true,
      },
      io,
      undefined,
      { blamer: async () => [1700000000] },
    );
    const result = parse(out)["result"] as { churn: Record<string, number> };

    // --churn used to run git blame and then throw the answer away under --json
    expect(result.churn).toEqual({ "a.ts": 1700000000, "b.ts": 1700000000 });
  });

  it("omits churn when it was not asked for", async () => {
    const block = "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const { io, out } = captureIO();

    await runDup(
      { dir: project.root, top: 10, minLines: 3, minCopies: 2, open: false, json: true },
      io,
    );

    expect(parse(out)["result"]).not.toHaveProperty("churn");
  });

  it("applies --sort and --min-lines to the complexity payload", async () => {
    project.file("small.ts", "if (a) { b(); }\n");
    project.file("big.ts", `${"const x = 1;\n".repeat(40)}if (a && b) { c(); }\n`);
    const { io, out } = captureIO();

    await runComplexity(
      { dir: project.root, sort: "density", minLines: 10, top: 20, open: false, json: true },
      io,
    );
    const result = parse(out)["result"] as { files: { path: string }[] };

    expect(result.files.map((file) => file.path)).toEqual(["big.ts"]);
  });

  it("echoes the window and budget and includes the tiers", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await runContext(
      { dir: project.root, window: 1000, budget: 400, top: 20, open: false, json: true },
      io,
    );
    const result = parse(out)["result"] as Record<string, unknown>;

    expect(result["window"]).toBe(1000);
    expect(result["budget"]).toBe(400);
    expect(result["tiers"]).toEqual([
      { share: 0.5, threshold: 200, files: 0 },
      { share: 0.25, threshold: 100, files: 0 },
      { share: 0.1, threshold: 40, files: 0 },
    ]);
  });

  it("reports comment health when blame is available", async () => {
    project.file("a.ts", "// explains the line below\nconst a = 1;\n");
    const { io, out } = captureIO();

    await runComments({ dir: project.root, top: 20, scan: 10, years: 3, json: true }, io, {
      blamer: async () => [LONG_AGO, NOW],
    });
    const payload = parse(out);

    expect(payload["command"]).toBe("comments");
    expect(payload["result"]).toMatchObject({ blocks: 1, drifted: 1 });
  });

  it("marks comments unavailable when git cannot blame", async () => {
    project.file("a.ts", "// a comment\nconst a = 1;\n");
    const { io, out } = captureIO();

    await runComments({ dir: project.root, top: 20, scan: 10, years: 3, json: true }, io, {
      blamer: async () => undefined,
    });
    const payload = parse(out);

    expect(payload["result"]).toBeNull();
    expect(payload["unavailable"]).toBe("no-git");
  });

  it("marks comments unavailable when there are none to check", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await runComments({ dir: project.root, top: 20, scan: 10, years: 3, json: true }, io, {
      blamer: async () => [NOW],
    });

    expect(parse(out)["unavailable"]).toBe("no-comments");
  });

  it("returns refactor verdict counts alongside the candidates", async () => {
    project.file("a.ts", "if (a && b) { c(); }\n");
    const { io, out } = captureIO();

    await runRefactor(
      { dir: project.root, since: "2 years ago", top: 20, json: true },
      io,
      async () => fakeLog({ files: ["a.ts"] }),
    );
    const result = parse(out)["result"] as Record<string, unknown>;

    expect(result["verdicts"]).toMatchObject({ refactor: 0, split: 0, watch: 0, quiet: 1 });
    expect(result["measured"]).toBe(1);
  });

  it("marks refactor unavailable outside a git repository", async () => {
    project.file("a.ts", "if (a) { b(); }\n");
    const { io, out } = captureIO();

    await runRefactor(
      { dir: project.root, since: "2 years ago", top: 20, json: true },
      io,
      async () => undefined,
    );
    const payload = parse(out);

    expect(payload["result"]).toBeNull();
    expect(payload["unavailable"]).toBe("no-git");
  });
});
