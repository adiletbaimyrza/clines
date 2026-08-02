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
    expect(readFileSync(project.path("README.md"), "utf8")).toContain("**Lines of Code:** `2`");
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
