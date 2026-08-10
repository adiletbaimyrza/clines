import { describe, expect, it } from "vitest";
import {
  getComplexityChecks,
  getLanguageName,
  getLanguageSyntax,
} from "../src/core/tokenizer/languages.js";
import {
  blockComments,
  classifyContent,
  countComplexity,
  measureComplexity,
  sanitizeCode,
  tokenize,
} from "../src/core/tokenizer/tokenizer.js";

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

describe("python docstrings", () => {
  const D = String.fromCharCode(34, 34, 34);
  const S = String.fromCharCode(39, 39, 39);

  it("counts a one-line docstring as a comment", () => {
    expect(classifyContent(`${D}Doc.${D}\n`, py)).toEqual(["comment"]);
    expect(classifyContent(`${S}Doc.${S}\n`, py)).toEqual(["comment"]);
  });

  it("counts a multi-line docstring as comments and keeps blanks blank", () => {
    const src = `def f():\n    ${D}Doc.\n\n    More.\n    ${D}\n    return 1\n`;

    expect(classifyContent(src, py)).toEqual([
      "code",
      "comment",
      "blank",
      "comment",
      "comment",
      "code",
    ]);
  });

  it("treats a line that opens a docstring after code as code", () => {
    const src = `x = ${D}\nbody\n${D}\n`;

    expect(classifyContent(src, py)).toEqual(["code", "comment", "comment"]);
  });

  it("does not let one triple quote close the other", () => {
    const src = `${D}open\n${S}not the end\nstill inside\n${D}\n`;

    expect(classifyContent(src, py)).toEqual(["comment", "comment", "comment", "comment"]);
  });

  it("keeps an unterminated docstring as comments to the end", () => {
    expect(classifyContent(`${D}open\nand never closed\n`, py)).toEqual(["comment", "comment"]);
  });

  it("ignores triple quotes inside an ordinary string", () => {
    expect(classifyContent(`x = "${S}"\ny = 1\n`, py)).toEqual(["code", "code"]);
    expect(classifyContent(`x = '${D}'\ny = 1\n`, py)).toEqual(["code", "code"]);
  });

  it("ignores a hash inside a docstring", () => {
    expect(classifyContent(`${D}\n# not a separate comment\n${D}\n`, py)).toEqual([
      "comment",
      "comment",
      "comment",
    ]);
  });

  it("keeps docstring text out of the complexity count", () => {
    const src = `${D}mentions if and or for while${D}\nif a and b:\n    pass\n`;

    expect(countComplexity(sanitizeCode(src, py), getComplexityChecks(".py"))).toBe(2);
  });

  it("treats .pyi as Python", () => {
    expect(getLanguageName(".pyi")).toBe("Python");
    expect(getComplexityChecks(".pyi")).toEqual(getComplexityChecks(".py"));
    expect(classifyContent(`${D}Stub.${D}\n`, getLanguageSyntax(".pyi"))).toEqual(["comment"]);
  });
});

describe("blockComments", () => {
  it("reads the single legacy pair", () => {
    expect(blockComments({ blockCommentStart: "/*", blockCommentEnd: "*/" })).toEqual([
      { start: "/*", end: "*/" },
    ]);
  });

  it("returns nothing when a language has no block comment", () => {
    expect(blockComments({ singleComment: "#" })).toEqual([]);
    expect(blockComments({ blockCommentStart: "/*" })).toEqual([]);
    expect(blockComments({ blockCommentEnd: "*/" })).toEqual([]);
  });

  it("combines the legacy pair with extra pairs", () => {
    expect(
      blockComments({
        blockCommentStart: "/*",
        blockCommentEnd: "*/",
        blocks: [{ start: "<!--", end: "-->" }],
      }),
    ).toEqual([
      { start: "/*", end: "*/" },
      { start: "<!--", end: "-->" },
    ]);
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

  it("counts decision points as complexity", () => {
    const src = "if (a && b) {\n  for (x of y) {}\n}";
    expect(tokenize("/proj/a.js", src).complexity).toBe(3); // if + && + for
  });
});

describe("sanitizeCode", () => {
  it("strips comments and string contents but keeps code", () => {
    const code = sanitizeCode('const url = "if for while"; // if\nx && y', js);
    expect(code).toContain("const url");
    expect(code).toContain("x && y");
    expect(code).not.toContain("if for while");
    expect(code).not.toMatch(/\/\/ if/);
  });

  it("removes block comments", () => {
    expect(sanitizeCode("a /* while for */ b", js)).not.toContain("while");
  });
});

describe("countComplexity", () => {
  it("counts word-boundary keywords and operators", () => {
    const checks = { keywords: ["if", "for"], operators: ["&&", "||"] };
    expect(countComplexity("if (a) for (b) x && y || z", checks)).toBe(4);
  });

  it("does not count keywords inside identifiers", () => {
    expect(
      countComplexity("modify verify forest", { keywords: ["if", "for"], operators: [] }),
    ).toBe(0);
  });
});

describe("getComplexityChecks", () => {
  it("returns C-style for programming languages and Python/data variants", () => {
    expect(getComplexityChecks(".ts").keywords).toContain("catch");
    expect(getComplexityChecks(".py").keywords).toContain("elif");
    expect(getComplexityChecks(".rb").keywords).toContain("elsif");
    expect(getComplexityChecks(".md")).toEqual({ keywords: [], operators: [] });
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

describe("measureComplexity", () => {
  it("splits decision points into branch, loop and boolean", () => {
    const detail = measureComplexity("if (a && b) {\nfor (x) {}\n}", getComplexityChecks(".ts"));

    expect(detail).toMatchObject({ branch: 1, loop: 1, bool: 1, total: 3 });
  });

  it("treats python and/or as boolean rather than branching", () => {
    const detail = measureComplexity("if a and b or c:", getComplexityChecks(".py"));

    expect(detail).toMatchObject({ branch: 1, bool: 2, loop: 0 });
  });

  it("finds the densest window", () => {
    const dense = `if (a) {}\n`.repeat(3) + "x;\n".repeat(100) + `if (b) {}\n`.repeat(2);
    const detail = measureComplexity(dense, getComplexityChecks(".ts"));

    expect(detail.total).toBe(5);
    expect(detail.densest).toBe(3);
  });

  it("reports nothing for a language without a complexity dialect", () => {
    expect(measureComplexity("a { b: c }", getComplexityChecks(".css"))).toMatchObject({
      total: 0,
      densest: 0,
    });
  });
});
