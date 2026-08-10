import { describe, expect, it, vi } from "vitest";
import {
  collect,
  fitsOnScreen,
  flush,
  pagerCommand,
  spawnPager,
  type PagerCommand,
} from "../src/cli/pager.js";
import { captureIO } from "./helpers/tmp.js";

describe("pagerCommand", () => {
  it("defaults to less with ANSI passthrough and no clearing", () => {
    expect(pagerCommand({})).toEqual({ command: "less", args: ["-R", "-F", "-X"] });
  });

  it("prefers CLINES_PAGER over PAGER", () => {
    expect(pagerCommand({ CLINES_PAGER: "less -S", PAGER: "more" })).toEqual({
      command: "less",
      args: ["-S"],
    });
  });

  it("adds the default less flags when less is named without any", () => {
    expect(pagerCommand({ PAGER: "less" })).toEqual({
      command: "less",
      args: ["-R", "-F", "-X"],
    });
  });

  it("passes another pager through without inventing flags", () => {
    expect(pagerCommand({ PAGER: "more" })).toEqual({ command: "more", args: [] });
  });

  it("treats an empty pager or cat as a request for no pager", () => {
    expect(pagerCommand({ PAGER: "" })).toBeUndefined();
    expect(pagerCommand({ PAGER: "   " })).toBeUndefined();
    expect(pagerCommand({ PAGER: "cat" })).toBeUndefined();
  });
});

describe("collect", () => {
  it("holds stdout back and lets stderr through immediately", () => {
    const { io, out, err } = captureIO();
    const collected = collect(io);

    collected.io.out("first");
    collected.io.err("progress");
    collected.io.out("second");

    expect(out).toEqual([]);
    expect(err).toEqual(["progress"]);
    expect(collected.text()).toBe("first\nsecond");
  });
});

describe("fitsOnScreen", () => {
  it("assumes it fits when the height is unknown", () => {
    expect(fitsOnScreen("a\nb\nc", undefined)).toBe(true);
    expect(fitsOnScreen("a\nb\nc", 0)).toBe(true);
  });

  it("leaves a line for the prompt", () => {
    expect(fitsOnScreen("a\nb", 3)).toBe(true);
    expect(fitsOnScreen("a\nb\nc", 3)).toBe(false);
  });
});

const LONG = "a\nb\nc\nd";

describe("flush", () => {
  const options = { interactive: true, rows: 2, env: {} };

  it("does nothing at all for empty output", async () => {
    const { io, out } = captureIO();
    const launch = vi.fn();

    await flush("", io, { ...options, launch });

    expect(out).toEqual([]);
    expect(launch).not.toHaveBeenCalled();
  });

  it("pages long output through the pager", async () => {
    const { io, out } = captureIO();
    const launch = vi.fn(async () => true);

    await flush(LONG, io, { ...options, launch });

    expect(launch).toHaveBeenCalledWith({ command: "less", args: ["-R", "-F", "-X"] }, LONG);
    expect(out).toEqual([]);
  });

  it("prints directly when the output already fits", async () => {
    const { io, out } = captureIO();
    const launch = vi.fn(async () => true);

    await flush(LONG, io, { ...options, rows: 40, launch });

    expect(launch).not.toHaveBeenCalled();
    expect(out).toEqual([LONG]);
  });

  it("prints directly when stdout is not a terminal", async () => {
    const { io, out } = captureIO();
    const launch = vi.fn(async () => true);

    await flush(LONG, io, { ...options, interactive: false, launch });

    expect(launch).not.toHaveBeenCalled();
    expect(out).toEqual([LONG]);
  });

  it("prints directly when paging is switched off", async () => {
    const { io, out } = captureIO();
    const launch = vi.fn(async () => true);

    await flush(LONG, io, { ...options, paged: false, launch });

    expect(launch).not.toHaveBeenCalled();
    expect(out).toEqual([LONG]);
  });

  it("prints directly when the environment asks for no pager", async () => {
    const { io, out } = captureIO();
    const launch = vi.fn(async () => true);

    await flush(LONG, io, { ...options, env: { PAGER: "cat" }, launch });

    expect(launch).not.toHaveBeenCalled();
    expect(out).toEqual([LONG]);
  });

  it("falls back to printing when the pager will not run", async () => {
    const { io, out } = captureIO();

    await flush(LONG, io, { ...options, launch: async () => false });

    expect(out).toEqual([LONG]);
  });

  it("uses the real launcher when none is injected", async () => {
    const { io, out } = captureIO();

    await flush(LONG, io, { interactive: true, rows: 2, env: { CLINES_PAGER: "true" } });

    expect(out).toEqual([]);
  });

  it("reads the terminal height and TTY state when not told", async () => {
    const { io, out } = captureIO();

    await flush("short", io, { env: {}, launch: async () => true });

    expect(out).toEqual(["short"]);
  });
});

describe("spawnPager", () => {
  it("reports success once a real pager has consumed the text", async () => {
    expect(await spawnPager({ command: "cat", args: [] } as PagerCommand, "hello")).toBe(true);
  });

  it("reports failure when the pager is not installed", async () => {
    expect(await spawnPager({ command: "clines-no-such-pager", args: [] }, "hello")).toBe(false);
  });
});
