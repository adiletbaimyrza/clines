import { describe, expect, it } from "vitest";
import { getLanguageName, getLanguageSyntax } from "../src/core/tokenizer/languages.js";
import { classifyContent, tokenize } from "../src/core/tokenizer/tokenizer.js";

const js = getLanguageSyntax(".js");
const py = getLanguageSyntax(".py");
const json = getLanguageSyntax(".json");

describe("classifyContent", () => {
  it("classifies blank, code and single-line comments", () => {
    const kinds = classifyContent("const a = 1;\n\n// note\n", js);
    expect(kinds).toEqual(["code", "blank", "comment"]);
  });

  it("does not count the trailing newline as an extra blank line", () => {
    expect(classifyContent("a\n", js)).toEqual(["code"]);
    expect(classifyContent("a", js)).toEqual(["code"]);
    expect(classifyContent("", js)).toEqual([]);
    expect(classifyContent("a\n\n", js)).toEqual(["code", "blank"]);
  });

  it("counts code that shares a line with an inline block comment (bug #1)", () => {
    expect(classifyContent("call(); /* x */ more();", js)).toEqual(["code"]);
  });

  it("counts code preceding a block-comment opener as code", () => {
    const src = "x = 1; /* note\nstill comment\n*/ y = 2;";
    expect(classifyContent(src, js)).toEqual(["code", "comment", "code"]);
  });

  it("treats a full multi-line block comment as comment lines", () => {
    const src = "/*\n line\n*/";
    expect(classifyContent(src, js)).toEqual(["comment", "comment", "comment"]);
  });

  it("ignores comment markers inside strings", () => {
    expect(classifyContent('const u = "http://example.com";', js)).toEqual(["code"]);
    expect(classifyContent("const s = '/* not a comment */';", js)).toEqual(["code"]);
  });

  it("handles escaped quotes within strings", () => {
    expect(classifyContent('const s = "a\\"b";', js)).toEqual(["code"]);
  });

  it("supports hash single-line comments", () => {
    expect(classifyContent("# comment\nvalue = 1", py)).toEqual(["comment", "code"]);
  });

  it("treats whitespace-only lines inside a block comment as blank", () => {
    const src = "/* start\n   \nend */";
    expect(classifyContent(src, js)).toEqual(["comment", "blank", "comment"]);
  });

  it("counts every non-empty line as code for languages without comment markers", () => {
    expect(classifyContent('{\n  "a": 1\n}', json)).toEqual(["code", "code", "code"]);
  });
});

describe("tokenize", () => {
  it("derives the extension and classifies lines", () => {
    const result = tokenize("/proj/a.js", "// c\ncode();");
    expect(result.ext).toBe(".js");
    expect(result.path).toBe("/proj/a.js");
    expect(result.lineKinds).toEqual(["comment", "code"]);
  });

  it("uses no_ext for files without an extension", () => {
    expect(tokenize("/proj/Makefile", "all:").ext).toBe("no_ext");
  });
});

describe("getLanguageSyntax", () => {
  it("is case-insensitive and falls back to empty syntax", () => {
    expect(getLanguageSyntax(".JS").singleComment).toBe("//");
    expect(getLanguageSyntax(".unknown")).toEqual({});
  });
});

describe("getLanguageName", () => {
  it("maps known extensions to display names (case-insensitive)", () => {
    expect(getLanguageName(".ts")).toBe("TypeScript");
    expect(getLanguageName(".TSX")).toBe("TSX");
    expect(getLanguageName(".jsx")).toBe("JSX");
    expect(getLanguageName(".py")).toBe("Python");
    expect(getLanguageName(".sh")).toBe("Bash");
    expect(getLanguageName(".coffee")).toBe("CoffeeScript");
  });

  it("folds unknown extensions and extensionless files into Other", () => {
    expect(getLanguageName("no_ext")).toBe("Other");
    expect(getLanguageName(".xyz")).toBe("Other");
    expect(getLanguageName(".invalid-rules-of-hooks-f6f37b63b2d4")).toBe("Other");
  });
});
