import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/schema.js";
import { collectFiles } from "../src/core/files/collector.js";
import { TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

describe("collectFiles", () => {
  it("walks recursively, skipping ignored dirs and files", async () => {
    project.file("src/a.ts", "code");
    project.file("src/nested/b.ts", "code");
    project.file("node_modules/pkg/index.js", "code");
    project.file("LICENSE", "text");
    project.file("logo.png", "binary");

    const files = await collectFiles(project.root, defaultConfig());
    const relative = files.map((f) => f.replace(`${project.root}/`, ""));

    expect(relative).toEqual(["src/a.ts", "src/nested/b.ts"]);
  });

  it("applies extra globs", async () => {
    project.file("src/a.ts", "code");
    project.file("src/a.min.ts", "code");

    const files = await collectFiles(project.root, defaultConfig(), ["*.min.ts"]);
    const relative = files.map((f) => f.replace(`${project.root}/`, ""));

    expect(relative).toEqual(["src/a.ts"]);
  });

  it("ignores symlink entries (neither file nor directory)", async () => {
    project.file("real.ts", "code");
    project.symlink("link.ts", project.path("real.ts"));

    const files = await collectFiles(project.root, defaultConfig());
    const relative = files.map((f) => f.replace(`${project.root}/`, ""));

    expect(relative).toEqual(["real.ts"]);
  });
});
