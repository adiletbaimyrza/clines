import { afterEach, describe, expect, it } from "vitest";
import {
  multiple,
  pushHint,
  shorten,
  table,
  terminalWidth,
  wrap,
} from "../src/report/format/text.js";

const original = process.stdout.columns;
afterEach(() => {
  process.stdout.columns = original;
});

describe("terminalWidth", () => {
  it("falls back when the terminal reports no width", () => {
    process.stdout.columns = undefined as unknown as number;
    expect(terminalWidth()).toBe(100);
  });

  it("clamps narrow and wide terminals", () => {
    process.stdout.columns = 20;
    expect(terminalWidth()).toBe(60);
    process.stdout.columns = 500;
    expect(terminalWidth()).toBe(120);
    process.stdout.columns = 90;
    expect(terminalWidth()).toBe(90);
  });
});

describe("shorten", () => {
  it("leaves short values alone", () => {
    expect(shorten("src/a.ts", 20)).toBe("src/a.ts");
  });

  it("keeps both ends of a long path", () => {
    const result = shorten("packages/react-dom/src/server/ReactFizzConfigDOM.js", 30);

    expect(result).toHaveLength(30);
    expect(result.startsWith("packages/")).toBe(true);
    expect(result.endsWith("ConfigDOM.js")).toBe(true);
    expect(result).toContain("…");
  });

  it("degrades to a bare ellipsis at tiny widths", () => {
    expect(shorten("abcdef", 1)).toBe("…");
    expect(shorten("abcdef", 0)).toBe("…");
  });

  it("falls back to a leading ellipsis when there is no room for a head", () => {
    expect(shorten("abcdefghij", 2)).toBe("…j");
  });
});

describe("multiple", () => {
  it("uses a percentage below ten times", () => {
    expect(multiple(50, 200)).toBe("25.0%");
    expect(multiple(1990, 200)).toBe("995.0%");
  });

  it("switches to a multiplier at ten times and above", () => {
    expect(multiple(2000, 200)).toBe("10.0×");
    expect(multiple(3303084, 200000)).toBe("16.5×");
  });

  it("returns a dash when there is nothing to compare against", () => {
    expect(multiple(10, 0)).toBe("—");
  });
});

describe("wrap", () => {
  it("leaves a short line alone", () => {
    expect(wrap("short enough", "", 40)).toEqual(["short enough"]);
  });

  it("breaks on words and indents continuations", () => {
    const lines = wrap("alpha bravo charlie delta echo foxtrot", "  ", 20);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]?.startsWith(" ")).toBe(false);
    for (const line of lines.slice(1)) {
      expect(line.startsWith("  ")).toBe(true);
    }
    expect(lines.join(" ").replace(/\s+/g, " ").trim()).toBe(
      "alpha bravo charlie delta echo foxtrot",
    );
  });

  it("keeps a word that is longer than the limit on its own line", () => {
    const long = "x".repeat(50);
    expect(wrap(`a ${long}`, "", 20)).toEqual(["a", long]);
  });
});

describe("table", () => {
  it("aligns the first column left and the rest right", () => {
    const lines = table(
      ["File", "N"],
      [
        ["a.ts", "1"],
        ["bb.ts", "22"],
      ],
      { width: 40 },
    );

    expect(lines[0]).toBe("  File     N");
    expect(lines[1]).toBe(`  ${"─".repeat(10)}`);
    expect(lines[2]).toBe("  a.ts     1");
    expect(lines[3]).toBe("  bb.ts   22");
  });

  it("shrinks the first column to fit the width", () => {
    const long = "packages/react-dom/src/server/ReactFizzConfigDOM.js";
    const lines = table(["File", "Tokens"], [[long, "1,000"]], { width: 40 });

    for (const line of lines) {
      expect([...line].length).toBeLessThanOrEqual(40);
    }
    expect(lines[2]).toContain("…");
  });

  it("never shrinks the first column below a readable floor", () => {
    const long = "a".repeat(200);
    const lines = table(["File", "Tokens"], [[long, "1"]], { width: 20 });

    expect((lines[2] as string).trim().split(/\s+/)[0]).toHaveLength(12);
  });
});

describe("pushHint", () => {
  it("adds advice for a human at a terminal", () => {
    const out: string[] = ["report"];
    pushHint(out, "Run with --html", true);
    expect(out).toEqual(["report", "", "Run with --html"]);
  });

  it("stays quiet when the output is being piped", () => {
    const out: string[] = ["report"];
    pushHint(out, "Run with --html", false);
    expect(out).toEqual(["report"]);
  });
});
