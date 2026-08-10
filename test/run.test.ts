import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  run,
  runComments,
  runComplexity,
  runContext,
  runDup,
  runRefactor,
} from "../src/cli/run.js";
import { ClinesError } from "../src/util/errors.js";
import { pathExists } from "../src/util/fs.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

describe("run", () => {
  it("prints the table and leaves the README untouched by default", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("README.md", "# Demo\n");
    const { io, out, err } = captureIO();

    const code = await run({ dir: project.root, readme: false }, io);

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Total");
    expect(out.join("\n")).toContain("Project size:");
    expect(err.join("\n")).not.toContain("Updated");
    expect(readFileSync(project.path("README.md"), "utf8")).toBe("# Demo\n");
  });

  it("updates the README when readme is true", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("README.md", "# Demo\n");
    const { io, err } = captureIO();

    await run({ dir: project.root, readme: true }, io);

    expect(err.join("\n")).toContain("Updated");
    expect(readFileSync(project.path("README.md"), "utf8")).toContain("**Lines of Code:** `1`");
  });

  it("warns when README is missing and readme is true", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, err } = captureIO();

    await run({ dir: project.root, readme: true }, io);

    expect(err.join("\n")).toContain("README.md not found");
    expect(await pathExists(project.path("clines.json"))).toBe(false);
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(run({ dir: project.path("nope"), readme: false }, io)).rejects.toBeInstanceOf(
      ClinesError,
    );
  });
});

describe("runDup", () => {
  it("prints a duplication summary", async () => {
    const block = "a1();\na2();\na3();\na4();\na5();\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const { io, out } = captureIO();
    const opened: string[] = [];

    const code = await runDup(
      { dir: project.root, top: 10, minLines: 5, minCopies: 2, open: true },
      io,
      (p) => opened.push(p),
    );

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Duplication:");
    expect(out.join("\n")).toContain("Most duplicated files");
    expect(opened).toEqual([]); // nothing to open without --html
  });

  it("writes an HTML report and opens it", async () => {
    const block = "a1();\na2();\na3();\na4();\na5();\n";
    project.file("a.ts", block);
    project.file("b.ts", block);
    const htmlPath = project.path("dup.html");
    const { io, err } = captureIO();
    const opened: string[] = [];

    await runDup(
      { dir: project.root, top: 10, minLines: 5, minCopies: 2, open: true, html: htmlPath },
      io,
      (p) => opened.push(p),
    );

    expect(err.join("\n")).toContain("Wrote duplication report");
    expect(readFileSync(htmlPath, "utf8")).toContain("<!doctype html>");
    expect(opened).toEqual([htmlPath]);
  });

  it("does not open the report when open is false", async () => {
    project.file("a.ts", "a1();\na2();\na3();\na4();\na5();\n");
    project.file("b.ts", "a1();\na2();\na3();\na4();\na5();\n");
    const htmlPath = project.path("dup.html");
    const { io } = captureIO();
    const opened: string[] = [];

    await runDup(
      { dir: project.root, top: 10, minLines: 5, minCopies: 2, open: false, html: htmlPath },
      io,
      (p) => opened.push(p),
    );

    expect(opened).toEqual([]);
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(
      runDup(
        { dir: project.path("nope"), top: 10, minLines: 5, minCopies: 2, open: true },
        io,
        () => {},
      ),
    ).rejects.toBeInstanceOf(ClinesError);
  });
});

describe("runContext", () => {
  it("prints a context summary and opens nothing without --html", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();
    const opened: string[] = [];

    const code = await runContext(
      { dir: project.root, window: 200000, top: 100, open: true },
      io,
      (p) => opened.push(p),
    );

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Context:");
    expect(out.join("\n")).toContain("Biggest files");
    expect(opened).toEqual([]);
  });

  it("writes an HTML report and opens it", async () => {
    project.file("a.ts", "const a = 1;\n");
    const htmlPath = project.path("ctx.html");
    const { io, err } = captureIO();
    const opened: string[] = [];

    await runContext(
      { dir: project.root, window: 200000, top: 50, open: true, html: htmlPath },
      io,
      (p) => opened.push(p),
    );

    expect(err.join("\n")).toContain("Wrote context report");
    expect(readFileSync(htmlPath, "utf8")).toContain("<!doctype html>");
    expect(opened).toEqual([htmlPath]);
  });

  it("does not open the report when open is false", async () => {
    project.file("a.ts", "const a = 1;\n");
    const htmlPath = project.path("ctx.html");
    const { io } = captureIO();
    const opened: string[] = [];

    await runContext(
      { dir: project.root, window: 200000, top: 50, open: false, html: htmlPath },
      io,
      (p) => opened.push(p),
    );

    expect(opened).toEqual([]);
  });

  it("stays quiet when the total is within --max", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io } = captureIO();

    const code = await runContext(
      { dir: project.root, window: 200000, top: 100, open: false, max: 1000 },
      io,
      () => {},
    );

    expect(code).toBe(0);
  });

  it("throws once the total exceeds --max", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await expect(
      runContext(
        { dir: project.root, window: 200000, top: 100, open: false, max: 1 },
        io,
        () => {},
      ),
    ).rejects.toThrow(/Context budget exceeded/);
    expect(out.join("\n")).toContain("Context:");
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(
      runContext({ dir: project.path("nope"), window: 200000, top: 100, open: true }, io, () => {}),
    ).rejects.toBeInstanceOf(ClinesError);
  });
});

describe("runComplexity", () => {
  it("prints a complexity summary and opens nothing without --html", async () => {
    project.file("a.ts", "if (a) {}\nif (b) {}\n");
    const { io, out } = captureIO();
    const opened: string[] = [];

    const code = await runComplexity({ dir: project.root, top: 100, open: true }, io, (p) =>
      opened.push(p),
    );

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Complexity:");
    expect(out.join("\n")).toContain("Most complex files");
    expect(opened).toEqual([]);
  });

  it("writes an HTML report and opens it", async () => {
    project.file("a.ts", "if (a) {}\n");
    const htmlPath = project.path("cx.html");
    const { io, err } = captureIO();
    const opened: string[] = [];

    await runComplexity({ dir: project.root, top: 50, open: true, html: htmlPath }, io, (p) =>
      opened.push(p),
    );

    expect(err.join("\n")).toContain("Wrote complexity report");
    expect(readFileSync(htmlPath, "utf8")).toContain("<!doctype html>");
    expect(opened).toEqual([htmlPath]);
  });

  it("does not open the report when open is false", async () => {
    project.file("a.ts", "if (a) {}\n");
    const htmlPath = project.path("cx.html");
    const { io } = captureIO();
    const opened: string[] = [];

    await runComplexity({ dir: project.root, top: 50, open: false, html: htmlPath }, io, (p) =>
      opened.push(p),
    );

    expect(opened).toEqual([]);
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(
      runComplexity({ dir: project.path("nope"), top: 100, open: true }, io, () => {}),
    ).rejects.toBeInstanceOf(ClinesError);
  });
});

describe("runRefactor", () => {
  const options = { dir: "", since: "2 years ago", top: 20 };

  it("weighs complexity against the change log", async () => {
    project.file("hot.ts", `${"if (a) { b(); }\n".repeat(40)}`);
    project.file("cold.ts", "if (a) { b(); }\n");
    const { io, out, err } = captureIO();

    const code = await runRefactor({ ...options, dir: project.root, price: 3 }, io, async () =>
      ["a".repeat(40), "hot.ts", "", "b".repeat(40), "hot.ts"].join("\n"),
    );

    expect(code).toBe(0);
    expect(err.join("\n")).toContain("Reading git history since 2 years ago…");
    expect(out.join("\n")).toContain("2 commits since 2 years ago");
    expect(out.join("\n")).toContain("hot.ts");
    expect(out.join("\n")).toContain("Cost");
  });

  it("says so when git history cannot be read", async () => {
    project.file("a.ts", "if (a) { b(); }\n");
    const { io, out } = captureIO();

    await runRefactor({ ...options, dir: project.root }, io, async () => undefined);

    expect(out.join("\n")).toContain("need git history");
  });

  it("reads git itself when no reader is injected", async () => {
    project.file("a.ts", "if (a) { b(); }\n");
    const { io, out } = captureIO();

    expect(await runRefactor({ ...options, dir: project.root }, io)).toBe(0);
    expect(out.join("\n")).toContain("need git history");
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(runRefactor({ ...options, dir: project.path("nope") }, io)).rejects.toBeInstanceOf(
      ClinesError,
    );
  });
});

describe("runComments", () => {
  it("prints drift when blame is available", async () => {
    project.file("a.ts", "// note\nconst a = 1;\n");
    const { io, out } = captureIO();

    const code = await runComments({ dir: project.root, years: 3, top: 20, scan: 50 }, io, {
      blamer: async () => [0, 9 * 365 * 24 * 60 * 60],
    });

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Comment drift:");
    expect(out.join("\n")).toContain("Most drifted files");
  });

  it("says so when git cannot blame", async () => {
    project.file("a.ts", "// note\nconst a = 1;\n");
    const { io, out } = captureIO();

    await runComments({ dir: project.root, years: 3, top: 20, scan: 50 }, io, {
      blamer: async () => undefined,
    });

    expect(out.join("\n")).toContain("needs a git repository");
  });

  it("says so when there are no comments", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out } = captureIO();

    await runComments({ dir: project.root, years: 3, top: 20, scan: 50 }, io, {
      blamer: async () => [0],
    });

    expect(out.join("\n")).toContain("nothing to compare");
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(
      runComments({ dir: project.path("nope"), years: 3, top: 20, scan: 50 }, io),
    ).rejects.toBeInstanceOf(ClinesError);
  });
});
