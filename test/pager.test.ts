import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import {
  collect,
  flush,
  pagerCommand,
  spawnPager,
  ttyScreen,
  type PagerCommand,
} from "../src/cli/pager.js";
import type { Key } from "../src/cli/viewer.js";
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

  it("shows long output in the built-in viewer when no pager is configured", async () => {
    const { io, out } = captureIO();
    const keys: ((key: Key) => void)[] = [];
    const written: string[] = [];
    const screen = {
      colour: false,
      write: (text: string) => written.push(text),
      size: () => ({ rows: 3, columns: 40 }),
      keys: (onKey: (key: Key) => void) => {
        keys.push(onKey);
        return () => undefined;
      },
    };

    const running = flush(LONG, io, { interactive: true, rows: 2, env: {}, screen });
    keys[0]?.("quit");
    await running;

    expect(out).toEqual([]);
    expect(written.some((chunk) => chunk.includes("of 4"))).toBe(true);
  });

  it("hands over to a configured pager instead of the viewer", async () => {
    const { io } = captureIO();
    const launch = vi.fn(async () => true);
    const screen = {
      write: () => undefined,
      size: () => ({ rows: 3, columns: 40 }),
      keys: () => () => undefined,
    };

    await flush(LONG, io, {
      interactive: true,
      rows: 2,
      env: { PAGER: "less" },
      launch,
      screen,
    });

    expect(launch).toHaveBeenCalled();
  });

  it("falls back to the pager when there is no terminal to draw on", async () => {
    const { io, out } = captureIO();

    await flush(LONG, io, {
      interactive: true,
      rows: 2,
      env: { PAGER: "cat" },
      launch: async () => false,
    });

    expect(out).toEqual([LONG]);
  });

  it("uses the real launcher when none is injected", async () => {
    const { io, out } = captureIO();

    await flush(LONG, io, {
      interactive: true,
      rows: 2,
      env: { CLINES_PAGER: "true" },
    });

    expect(out).toEqual([]);
  });

  it("reads the environment when not given one", async () => {
    const { io, out } = captureIO();
    vi.stubEnv("CLINES_PAGER", "cat");

    await flush(LONG, io, { interactive: true, rows: 2 });
    vi.unstubAllEnvs();

    expect(out).toEqual([LONG]);
  });

  it("reads the terminal height and TTY state when not told", async () => {
    const { io, out } = captureIO();

    await flush("short", io, { env: {}, launch: async () => true });

    expect(out).toEqual(["short"]);
  });
});

function fakeTty() {
  const stream = new EventEmitter() as unknown as NodeJS.ReadStream & {
    raw: boolean[];
    paused: boolean;
    encoding: string | undefined;
  };
  const state = { raw: [] as boolean[], paused: false, encoding: undefined as string | undefined };
  Object.assign(stream, state, {
    isTTY: true,
    setRawMode: (on: boolean) => {
      state.raw.push(on);
      return stream;
    },
    resume: () => stream,
    pause: () => {
      state.paused = true;
      return stream;
    },
    setEncoding: (enc: string) => {
      state.encoding = enc;
      return stream;
    },
  });
  return { stream, state };
}

const OUTPUT = {
  rows: 30,
  columns: 100,
  isTTY: true,
  write: () => true,
} as unknown as NodeJS.WriteStream;

describe("ttyScreen", () => {
  it("declines when stdin is not a terminal", () => {
    const notATty = new EventEmitter() as unknown as NodeJS.ReadStream;

    expect(ttyScreen(notATty, OUTPUT)).toBeUndefined();
  });

  it("reports the terminal size, with a fallback", () => {
    const { stream } = fakeTty();

    expect(ttyScreen(stream, OUTPUT)?.size()).toEqual({ rows: 30, columns: 100 });
    expect(
      ttyScreen(stream, { write: () => true } as unknown as NodeJS.WriteStream)?.size(),
    ).toEqual({ rows: 24, columns: 80 });
  });

  it("turns raw mode on while reading keys and off again afterwards", () => {
    const { stream, state } = fakeTty();
    const screen = ttyScreen(stream, OUTPUT);
    const seen: Key[] = [];

    const stop = screen?.keys((key) => seen.push(key));
    expect(state.raw).toEqual([true]);
    expect(state.encoding).toBe("utf8");

    stream.emit("data", "jjq");
    expect(seen).toEqual(["down", "down", "quit"]);

    stop?.();
    expect(state.raw).toEqual([true, false]);
    expect(state.paused).toBe(true);

    stream.emit("data", "j");
    expect(seen).toHaveLength(3);
  });

  it("writes to the output stream", () => {
    const written: string[] = [];
    const output = {
      rows: 10,
      columns: 20,
      write: (text: string) => {
        written.push(text);
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    ttyScreen(fakeTty().stream, output)?.write("hello");

    expect(written).toEqual(["hello"]);
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
