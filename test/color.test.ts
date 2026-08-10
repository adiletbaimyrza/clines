import { afterEach, describe, expect, it, vi } from "vitest";
import type { RefactorReport } from "../src/core/analyzers/refactor.js";
import type { Report } from "../src/core/model.js";
import { painter, plainPainter, stripInk } from "../src/report/format/paint.js";
import { renderRefactor } from "../src/report/format/refactor.js";
import { heading, pushHint, table } from "../src/report/format/text.js";
import { consoleReporter } from "../src/report/reporters/console.js";
import { useColor } from "../src/util/tty.js";

const ESC = String.fromCharCode(27);

afterEach(() => {
  vi.unstubAllEnvs();
});

function coloured<T>(render: () => T): T {
  vi.stubEnv("FORCE_COLOR", "1");
  vi.stubEnv("NO_COLOR", "");
  return render();
}

function plain<T>(render: () => T): T {
  vi.stubEnv("FORCE_COLOR", "");
  vi.stubEnv("NO_COLOR", "1");
  return render();
}

describe("useColor", () => {
  it("obeys NO_COLOR even when FORCE_COLOR is set", () => {
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("FORCE_COLOR", "1");

    expect(useColor({ isTTY: true } as NodeJS.WriteStream)).toBe(false);
  });

  it("colours a pipe when FORCE_COLOR is set", () => {
    vi.stubEnv("NO_COLOR", "");
    vi.stubEnv("FORCE_COLOR", "1");

    expect(useColor({ isTTY: false } as NodeJS.WriteStream)).toBe(true);
  });

  it("treats an empty or zero FORCE_COLOR as unset", () => {
    vi.stubEnv("NO_COLOR", "");
    vi.stubEnv("FORCE_COLOR", "0");

    expect(useColor({ isTTY: false } as NodeJS.WriteStream)).toBe(false);
  });
});

describe("painter", () => {
  it("wraps text in the requested colour", () => {
    expect(painter(true)("hi", "red")).toBe(`${ESC}[31mhi${ESC}[0m`);
  });

  it("leaves text alone without an ink or without colour", () => {
    expect(painter(true)("hi", undefined)).toBe("hi");
    expect(painter(false)("hi", "red")).toBe("hi");
    expect(plainPainter("hi", "red")).toBe("hi");
  });

  it("strips what it applies", () => {
    expect(stripInk(painter(true)("hi", "cyan"))).toBe("hi");
    expect(stripInk("plain")).toBe("plain");
  });
});

describe("heading and hints", () => {
  it("bolds a heading only when colour is on", () => {
    expect(heading("Title", painter(true))).toBe(`${ESC}[1mTitle${ESC}[0m`);
    expect(heading("Title", painter(false))).toBe("Title");
  });

  it("dims a hint", () => {
    const out: string[] = [];
    pushHint(out, "run me", true, painter(true));

    expect(out).toEqual(["", `${ESC}[2mrun me${ESC}[0m`]);
  });
});

const HEADERS = ["File", "Count", "Verdict"];
const ROWS = [
  ["src/a/very/long/path/that/will/be/truncated/file.ts", "1,000", "refactor"],
  ["src/b.ts", "1", "quiet"],
];

describe("escape sequences stay out of the width maths", () => {
  it("gives a coloured table the same layout as a plain one", () => {
    const width = 60;
    const inked = table(HEADERS, ROWS, {
      width,
      paint: painter(true),
      ink: (cell, column) => (column === 2 ? "red" : undefined),
    });
    const bare = table(HEADERS, ROWS, { width, paint: painter(false) });

    expect(inked.map(stripInk)).toEqual(bare);
    expect(inked.some((line) => line.includes(ESC))).toBe(true);
  });

  it("pads inside the escape sequence rather than outside it", () => {
    const [, , row] = table(["File", "Count"], [["a.ts", "1"]], {
      width: 40,
      paint: painter(true),
      ink: (_cell, column) => (column === 1 ? "red" : undefined),
    });

    expect(row).toContain(`${ESC}[31m    1${ESC}[0m`);
  });

  it("keeps every count column aligned", () => {
    const lines = coloured(() => table(HEADERS, ROWS, { width: 60 })).map(stripInk);
    expect(new Set(lines.map((line) => line.length)).size).toBe(1);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^ {2}─+$/);
  });
});

const REFACTOR: RefactorReport = {
  candidates: [
    {
      path: "src/hot.ts",
      verdict: "refactor",
      changes: 30,
      tokens: 5000,
      complexity: 40,
      code: 200,
      density: 20,
      recurringTokens: 150000,
    },
    {
      path: "src/cool.ts",
      verdict: "quiet",
      changes: 1,
      tokens: 100,
      complexity: 2,
      code: 50,
      density: 4,
      recurringTokens: 100,
    },
  ],
  since: "2 years ago",
  commits: 500,
  inert: 3,
  measured: 5,
  limits: { busy: 3, dense: 12.5, costly: 2400 },
};

const REPORT: Report = {
  concentration: { largestFiles: 1, share: 60, medianCode: 40, p90Code: 300 },
  largestFiles: [{ path: "src/big.ts", code: 400, comment: 40, complexity: 88 }],
  roles: [{ role: "source", files: 1, code: 100 }],
  totalCode: 30,
  totalComment: 10,
  totalBlank: 10,
  totalLines: 50,
  totalFiles: 1,
  totalComplexity: 12,
  languages: [
    {
      language: "TypeScript",
      files: 1,
      code: 30,
      comment: 10,
      blank: 10,
      total: 50,
      complexity: 12,
      medianCode: 30,
      p90Code: 30,
      maxCode: 30,
    },
  ],
};

describe("whole reports survive stripping", () => {
  it("renders refactor identically once the ink is removed", () => {
    const inked = coloured(() => renderRefactor(REFACTOR, { top: 5, price: 3 }));
    const bare = plain(() => renderRefactor(REFACTOR, { top: 5, price: 3 }));

    expect(stripInk(inked)).toBe(bare);
    expect(inked).toContain(`${ESC}[31m`);
  });

  it("renders the count table identically once the ink is removed", () => {
    const inked = coloured(() => consoleReporter.render(REPORT, true));
    const bare = plain(() => consoleReporter.render(REPORT, true));

    expect(stripInk(inked)).toBe(bare);
    expect(inked).toContain(`${ESC}[2m`);
  });
});
