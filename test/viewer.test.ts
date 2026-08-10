import { describe, expect, it, vi } from "vitest";
import { stripInk, truncateInk } from "../src/report/format/paint.js";
import {
  decode,
  fitsOnScreen,
  frame,
  scroll,
  status,
  view,
  type Key,
  type Screen,
} from "../src/cli/viewer.js";

const ESC = String.fromCharCode(27);

describe("decode", () => {
  it("reads the arrow and paging sequences", () => {
    expect(decode(`${ESC}[A`)).toEqual(["up"]);
    expect(decode(`${ESC}[B`)).toEqual(["down"]);
    expect(decode(`${ESC}[5~`)).toEqual(["pageUp"]);
    expect(decode(`${ESC}[6~`)).toEqual(["pageDown"]);
    expect(decode(`${ESC}[H`)).toEqual(["top"]);
    expect(decode(`${ESC}[F`)).toEqual(["bottom"]);
  });

  it("reads the vim keys", () => {
    expect(decode("k")).toEqual(["up"]);
    expect(decode("j")).toEqual(["down"]);
    expect(decode("b")).toEqual(["pageUp"]);
    expect(decode(" ")).toEqual(["pageDown"]);
    expect(decode("f")).toEqual(["pageDown"]);
    expect(decode("g")).toEqual(["top"]);
    expect(decode("G")).toEqual(["bottom"]);
  });

  it("quits on q, escape, ctrl-c and ctrl-d", () => {
    expect(decode("q")).toEqual(["quit"]);
    expect(decode(ESC)).toEqual(["quit"]);
    expect(decode(String.fromCharCode(3))).toEqual(["quit"]);
    expect(decode(String.fromCharCode(4))).toEqual(["quit"]);
  });

  it("pages with ctrl-b and ctrl-f", () => {
    expect(decode(String.fromCharCode(2))).toEqual(["pageUp"]);
    expect(decode(String.fromCharCode(6))).toEqual(["pageDown"]);
  });

  it("splits a burst of keystrokes and drops what it does not know", () => {
    expect(decode("jjk")).toEqual(["down", "down", "up"]);
    expect(decode("jxk")).toEqual(["down", "up"]);
    expect(decode("xyz")).toEqual([]);
    expect(decode(`${ESC}[Z`)).toEqual([]);
    expect(decode(`${ESC}[15~`)).toEqual([]);
  });
});

describe("scroll", () => {
  const view100 = { top: 10, height: 20, total: 100 };

  it("moves by a line, a page and to the ends", () => {
    expect(scroll(view100, "up")).toBe(9);
    expect(scroll(view100, "down")).toBe(11);
    expect(scroll(view100, "pageUp")).toBe(0);
    expect(scroll(view100, "pageDown")).toBe(30);
    expect(scroll(view100, "top")).toBe(0);
    expect(scroll(view100, "bottom")).toBe(80);
  });

  it("never scrolls past either end", () => {
    expect(scroll({ top: 0, height: 20, total: 100 }, "up")).toBe(0);
    expect(scroll({ top: 0, height: 20, total: 100 }, "pageUp")).toBe(0);
    expect(scroll({ top: 80, height: 20, total: 100 }, "down")).toBe(80);
    expect(scroll({ top: 80, height: 20, total: 100 }, "pageDown")).toBe(80);
  });

  it("stays put when everything already fits", () => {
    for (const key of ["up", "down", "pageDown", "bottom"] as Key[]) {
      expect(scroll({ top: 0, height: 20, total: 5 }, key)).toBe(0);
    }
  });

  it("ignores quit", () => {
    expect(scroll(view100, "quit")).toBe(10);
  });
});

describe("status", () => {
  it("reports the visible range and how to get out", () => {
    const line = status({ top: 10, height: 20, total: 100 }, false);

    expect(line).toBe("  11–30 of 100   ↑↓ jk scroll · space page · g G ends · q quit");
  });

  it("does not run past the end or start at one when empty", () => {
    expect(status({ top: 90, height: 20, total: 100 }, false)).toContain("91–100 of 100");
    expect(status({ top: 0, height: 20, total: 0 }, false)).toContain("0–0 of 0");
  });

  it("dims itself when colour is on", () => {
    expect(status({ top: 0, height: 5, total: 9 }, true)).toContain(`${ESC}[2m`);
  });
});

const LINES = ["one", "two", "three", "four", "five"];

describe("frame", () => {
  it("shows only the visible window, then the status line", () => {
    const out = frame(LINES, { top: 1, height: 2, total: 5 }, 40, false);
    const body = out.split("\n");

    expect(body[0]).toContain("two");
    expect(body[1]).toContain("three");
    expect(body[2]).toContain("2–3 of 5");
    expect(out).not.toContain("one");
  });

  it("homes the cursor and clears what it does not overwrite", () => {
    const out = frame(LINES, { top: 0, height: 2, total: 5 }, 40, false);

    expect(out.startsWith(`${ESC}[H`)).toBe(true);
    expect(out).toContain(`${ESC}[K`);
    expect(out.endsWith(`${ESC}[J`)).toBe(true);
  });

  it("truncates lines wider than the terminal", () => {
    const out = frame(["x".repeat(200)], { top: 0, height: 1, total: 1 }, 20, false);

    expect((out.match(/x/g) ?? []).length).toBe(20);
  });
});

interface Fake extends Screen {
  written: string[];
  press: (key: Key) => void;
  stopped: () => boolean;
}

function fakeScreen(rows = 4, columns = 40): Fake {
  const written: string[] = [];
  let handler: ((key: Key) => void) | undefined;
  let stopped = false;
  return {
    written,
    colour: false,
    write: (text) => written.push(text),
    size: () => ({ rows, columns }),
    keys: (onKey) => {
      handler = onKey;
      return () => {
        stopped = true;
      };
    },
    press: (key) => handler?.(key),
    stopped: () => stopped,
  };
}

describe("view", () => {
  it("enters and leaves the alternate screen, hiding the cursor", async () => {
    const screen = fakeScreen();
    const running = view(LINES, screen);
    screen.press("quit");
    await running;

    expect(screen.written[0]).toBe(`${ESC}[?1049h${ESC}[?25l`);
    expect(screen.written[screen.written.length - 1]).toBe(`${ESC}[?25h${ESC}[?1049l`);
  });

  it("stops listening for keys once it quits", async () => {
    const screen = fakeScreen();
    const running = view(LINES, screen);
    expect(screen.stopped()).toBe(false);

    screen.press("quit");
    await running;

    expect(screen.stopped()).toBe(true);
  });

  it("redraws as it scrolls", async () => {
    const screen = fakeScreen(4);
    const running = view(LINES, screen);

    screen.press("down");
    screen.press("down");
    screen.press("bottom");
    screen.press("quit");
    await running;

    const frames = screen.written.filter((chunk) => chunk.includes(" of 5"));
    expect(frames[0]).toContain("1–3 of 5");
    expect(frames[1]).toContain("2–4 of 5");
    expect(frames[2]).toContain("3–5 of 5");
    expect(frames[3]).toContain("3–5 of 5");
  });

  it("keeps the last page in view when the terminal grows", async () => {
    let rows = 4;
    const base = fakeScreen();
    const screen: Fake = { ...base, size: () => ({ rows, columns: 40 }) };
    const running = view(LINES, screen);

    screen.press("bottom");
    rows = 20;
    screen.press("down");
    screen.press("quit");
    await running;

    const last = screen.written.filter((chunk) => chunk.includes(" of 5")).pop();
    expect(last).toContain("1–5 of 5");
  });

  it("colours the status line unless told not to", async () => {
    const screen = fakeScreen();
    const coloured: Fake = { ...screen, colour: true };
    const running = view(LINES, coloured);
    coloured.press("quit");
    await running;

    expect(coloured.written.some((chunk) => chunk.includes(`${ESC}[2m`))).toBe(true);
  });
});

describe("fitsOnScreen", () => {
  it("assumes it fits when the height is unknown", () => {
    expect(fitsOnScreen("a\nb\nc", undefined)).toBe(true);
    expect(fitsOnScreen("a\nb\nc", 0)).toBe(true);
  });

  it("leaves a line for the prompt and ignores colour", () => {
    expect(fitsOnScreen("a\nb", 3)).toBe(true);
    expect(fitsOnScreen("a\nb\nc", 3)).toBe(false);
    expect(fitsOnScreen(`${ESC}[2ma${ESC}[0m\nb`, 3)).toBe(true);
  });
});

describe("truncateInk", () => {
  it("leaves short lines alone", () => {
    expect(truncateInk("short", 20)).toBe("short");
    expect(truncateInk("exact", 5)).toBe("exact");
  });

  it("cuts plain text to the visible width", () => {
    expect(truncateInk("abcdefgh", 3)).toBe("abc");
  });

  it("never cuts through an escape sequence, and resets what it kept", () => {
    const line = `${ESC}[31mred text here${ESC}[0m`;
    const cut = truncateInk(line, 5);

    expect(cut).toBe(`${ESC}[31mred t${ESC}[0m`);
    expect(stripInk(cut)).toBe("red t");
  });

  it("keeps every escape that precedes the cut", () => {
    const line = `${ESC}[1m${ESC}[31mabcdef`;

    expect(truncateInk(line, 2)).toBe(`${ESC}[1m${ESC}[31mab${ESC}[0m`);
  });

  it("does not add a reset to a line that had no colour", () => {
    expect(truncateInk("plain and long", 5)).toBe("plain");
  });
});

describe("view of an empty document", () => {
  it("still draws a status line", async () => {
    const screen = fakeScreen();
    const running = view([], screen);
    const drawn = screen.written.some((chunk) => chunk.includes("0–0 of 0"));
    screen.press("quit");
    await running;

    expect(drawn).toBe(true);
    expect(vi.isMockFunction(screen.write)).toBe(false);
  });
});
