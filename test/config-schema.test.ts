import { describe, expect, it } from "vitest";
import { defaultConfig, parseConfig, resolveConfig } from "../src/config/schema.js";
import { parseUserConfig } from "../src/config/validate.js";

describe("config schema", () => {
  it("provides working defaults with no config file", () => {
    const config = defaultConfig();
    expect(config.ignoreDirs).toContain("node_modules");
    expect(config.ignoreFiles).toContain("LICENSE");
    expect(config.ignoreExtensions).toContain(".png");
    expect(config.ignoreExtensions).toContain(".lock");
    expect(config.ignoreExtensions).toContain(".map");
    expect(config.ignoreGlobs).toEqual([]);
    expect(config.respectGitignore).toBe(true);
  });

  it("ADDS user entries to the built-in ignore lists", () => {
    const config = parseConfig({
      ignore: { dirs: ["fixtures"], files: ["notes.md"], globs: ["*.min.js"] },
    });
    expect(config.ignoreDirs).toContain("node_modules");
    expect(config.ignoreDirs).toContain("fixtures");
    expect(config.ignoreFiles).toContain("notes.md");
    expect(config.ignoreGlobs).toEqual(["*.min.js"]);
  });

  it("REMOVES entries from the defaults via unignore (start counting them)", () => {
    const config = parseConfig({ unignore: { files: ["package.json"], dirs: ["public"] } });
    expect(config.ignoreFiles).not.toContain("package.json");
    expect(config.ignoreDirs).not.toContain("public");
    expect(config.ignoreDirs).toContain("node_modules");
  });

  it("lets respectGitignore be disabled", () => {
    expect(parseConfig({ respectGitignore: false }).respectGitignore).toBe(false);
  });

  it("resolveConfig applies add then remove", () => {
    const user = parseUserConfig({
      ignore: { dirs: ["keep"] },
      unignore: { dirs: ["keep"] },
    });
    expect(resolveConfig(user).ignoreDirs).not.toContain("keep");
  });

  it("rejects unknown top-level keys", () => {
    expect(() => parseConfig({ nope: true })).toThrow();
  });

  it("rejects unknown keys inside ignore", () => {
    expect(() => parseConfig({ ignore: { folders: ["x"] } })).toThrow();
  });

  it("rejects wrong types", () => {
    expect(() => parseConfig({ ignore: { dirs: "node_modules" } })).toThrow();
  });
});
