import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/schema.js";
import { globToRegExp, isIgnoredDir, isIgnoredFile, toPosix } from "../src/core/files/matcher.js";

const config = defaultConfig();

describe("globToRegExp", () => {
  it("matches * within a segment but not across separators", () => {
    expect(globToRegExp("*.min.js").test("app.min.js")).toBe(true);
    expect(globToRegExp("*.min.js").test("src/app.min.js")).toBe(false);
  });

  it("matches ** across separators", () => {
    expect(globToRegExp("test/**").test("test/a/b.ts")).toBe(true);
  });

  it("matches ? as a single non-separator char", () => {
    expect(globToRegExp("a?c").test("abc")).toBe(true);
    expect(globToRegExp("a?c").test("a/c")).toBe(false);
  });

  it("escapes regex metacharacters", () => {
    expect(globToRegExp("a.b+c").test("a.b+c")).toBe(true);
    expect(globToRegExp("a.b+c").test("axbxc")).toBe(false);
  });
});

describe("isIgnoredDir", () => {
  it("skips configured directories", () => {
    expect(isIgnoredDir("node_modules", config)).toBe(true);
    expect(isIgnoredDir("src", config)).toBe(false);
  });
});

describe("isIgnoredFile", () => {
  it("ignores exact basenames including bare LICENSE (bug #4)", () => {
    expect(isIgnoredFile("LICENSE", config)).toBe(true);
    expect(isIgnoredFile("sub/package-lock.json", config)).toBe(true);
  });

  it("ignores configured extensions case-insensitively", () => {
    expect(isIgnoredFile("logo.PNG", config)).toBe(true);
    expect(isIgnoredFile("data.csv", config)).toBe(true);
  });

  it("does not ignore source files", () => {
    expect(isIgnoredFile("src/index.ts", config)).toBe(false);
  });

  it("applies config globs and extra globs against path and basename", () => {
    const withGlob = { ...config, ignoreGlobs: ["*.min.js"] };
    expect(isIgnoredFile("dist/app.min.js", withGlob)).toBe(true);
    expect(isIgnoredFile("src/index.ts", config, ["src/**"])).toBe(true);
  });
});

describe("toPosix", () => {
  it("returns the path unchanged on posix separators", () => {
    expect(toPosix("a/b/c")).toBe("a/b/c");
  });
});
