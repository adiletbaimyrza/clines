import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseConfig } from "../src/config/schema.js";
import {
  describeIssues,
  loadConfig,
  loadGitAttributes,
  loadGitignoreGlobs,
  parseGitignore,
} from "../src/config/load.js";
import { ClinesError } from "../src/util/errors.js";
import { pathExists } from "../src/util/fs.js";
import { TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

describe("loadConfig", () => {
  it("uses defaults and does NOT create a clines.json when none exists", async () => {
    const config = await loadConfig(project.root);
    expect(config.ignoreDirs).toContain("node_modules");
    expect(await pathExists(project.path("clines.json"))).toBe(false);
  });

  it("reads and resolves an existing config file (add/remove)", async () => {
    project.file(
      "clines.json",
      JSON.stringify({ ignore: { globs: ["*.snap"] }, unignore: { files: ["LICENSE"] } }),
    );
    const config = await loadConfig(project.root);
    expect(config.ignoreGlobs).toEqual(["*.snap"]);
    expect(config.ignoreFiles).not.toContain("LICENSE");
  });

  it("loads an explicit config path", async () => {
    const explicit = project.file("custom.json", JSON.stringify({ respectGitignore: false }));
    const config = await loadConfig(project.root, explicit);
    expect(config.respectGitignore).toBe(false);
  });

  it("throws when an explicit config path is missing", async () => {
    await expect(loadConfig(project.root, project.path("nope.json"))).rejects.toBeInstanceOf(
      ClinesError,
    );
  });

  it("throws on invalid JSON", async () => {
    project.file("clines.json", "{ not json");
    await expect(loadConfig(project.root)).rejects.toThrow(/Invalid JSON/);
  });

  it("throws on schema-invalid config", async () => {
    project.file("clines.json", JSON.stringify({ ignore: { dirs: "oops" } }));
    await expect(loadConfig(project.root)).rejects.toThrow(/Invalid config/);
  });
});

describe("loadGitignoreGlobs", () => {
  it("returns [] when disabled", async () => {
    project.file(".gitignore", "dist/");
    expect(await loadGitignoreGlobs(project.root, false)).toEqual([]);
  });

  it("returns [] when no .gitignore exists", async () => {
    expect(await loadGitignoreGlobs(project.root, true)).toEqual([]);
  });

  it("parses patterns from .gitignore", async () => {
    project.file(".gitignore", "# comment\n\n/dist/\n*.log\n!keep.log\n");
    expect(await loadGitignoreGlobs(project.root, true)).toEqual(["dist/**", "*.log"]);
  });
});

describe("parseGitignore", () => {
  it("strips anchors and expands directory patterns", () => {
    expect(parseGitignore("/build/\nsrc\n")).toEqual(["build/**", "src"]);
  });
});

describe("loadGitAttributes", () => {
  it("returns empty buckets when the file is absent", async () => {
    expect(await loadGitAttributes(project.root)).toEqual({
      generated: [],
      vendored: [],
      docs: [],
    });
  });

  it("reads linguist markers from .gitattributes", async () => {
    project.file(".gitattributes", "dist/** linguist-generated\n");

    expect(await loadGitAttributes(project.root)).toEqual({
      generated: ["dist/**"],
      vendored: [],
      docs: [],
    });
  });
});

describe("describeIssues", () => {
  it("names an unknown key and suggests the closest real one", () => {
    let caught: unknown;
    try {
      parseConfig({ ignor: {} });
    } catch (error) {
      caught = error;
    }

    const described = describeIssues(caught);
    expect(described).toContain('Unknown key "ignor"');
    expect(described).toContain('did you mean "ignore"?');
  });

  it("omits a suggestion when nothing is close", () => {
    let caught: unknown;
    try {
      parseConfig({ zzzzz: {} });
    } catch (error) {
      caught = error;
    }

    expect(describeIssues(caught)).toContain('Unknown key "zzzzz"');
    expect(describeIssues(caught)).not.toContain("did you mean");
  });

  it("names the path for a wrong type", () => {
    let caught: unknown;
    try {
      parseConfig({ ignore: { dirs: "nope" } });
    } catch (error) {
      caught = error;
    }

    expect(describeIssues(caught)).toContain("ignore.dirs:");
  });

  it("falls back to the raw message for a non-validation error", () => {
    expect(describeIssues(new Error("boom"))).toContain("boom");
  });
});
