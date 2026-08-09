import { afterEach, describe, expect, it } from "vitest";
import { isInteractive, useColor } from "../src/util/tty.js";

const original = process.env["NO_COLOR"];
afterEach(() => {
  if (original === undefined) {
    delete process.env["NO_COLOR"];
  } else {
    process.env["NO_COLOR"] = original;
  }
});

function stream(isTTY: boolean): NodeJS.WriteStream {
  return { isTTY } as NodeJS.WriteStream;
}

describe("useColor", () => {
  it("is on for a terminal", () => {
    delete process.env["NO_COLOR"];
    expect(useColor(stream(true))).toBe(true);
  });

  it("is off when the output is piped", () => {
    delete process.env["NO_COLOR"];
    expect(useColor(stream(false))).toBe(false);
  });

  it("honours NO_COLOR even on a terminal", () => {
    process.env["NO_COLOR"] = "1";
    expect(useColor(stream(true))).toBe(false);
  });

  it("ignores an empty NO_COLOR", () => {
    process.env["NO_COLOR"] = "";
    expect(useColor(stream(true))).toBe(true);
  });
});

describe("isInteractive", () => {
  it("follows the stream", () => {
    expect(isInteractive(stream(true))).toBe(true);
    expect(isInteractive(stream(false))).toBe(false);
  });
});
