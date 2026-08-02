import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../src/cli/run.js";
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
  it("prints a console summary and updates an existing README", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("README.md", "# Demo\n");
    const { io, out, err } = captureIO();

    const code = await run({ dir: project.root, json: false, readme: true }, io);

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Lines of Code: 2");
    expect(err.join("\n")).toContain("Updated");
    expect(readFileSync(project.path("README.md"), "utf8")).toContain("**Lines of Code:** `2`");
  });

  it("emits JSON and warns when README is missing (readme enabled)", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io, out, err } = captureIO();

    await run({ dir: project.root, json: true, readme: true }, io);

    expect(JSON.parse(out[0]!).totalCode).toBe(1);
    expect(err.join("\n")).toContain("README.md not found");
    expect(await pathExists(project.path("clines.json"))).toBe(false);
  });

  it("skips README updates when readme is false", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("README.md", "# Demo\n");
    const { io, err } = captureIO();

    await run({ dir: project.root, json: false, readme: false }, io);

    expect(err.join("\n")).not.toContain("Updated");
    expect(readFileSync(project.path("README.md"), "utf8")).toBe("# Demo\n");
  });

  it("throws for a missing directory", async () => {
    const { io } = captureIO();
    await expect(
      run({ dir: project.path("nope"), json: false, readme: false }, io),
    ).rejects.toBeInstanceOf(ClinesError);
  });
});
