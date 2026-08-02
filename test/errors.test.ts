import { describe, expect, it } from "vitest";
import { ClinesError, errorMessage } from "../src/util/errors.js";

describe("ClinesError", () => {
  it("defaults the exit code to 1", () => {
    const error = new ClinesError("boom");
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe("ClinesError");
    expect(error).toBeInstanceOf(Error);
  });

  it("accepts a custom exit code", () => {
    expect(new ClinesError("boom", 2).exitCode).toBe(2);
  });
});

describe("errorMessage", () => {
  it("returns the message of an Error", () => {
    expect(errorMessage(new Error("nope"))).toBe("nope");
  });

  it("stringifies non-Error values", () => {
    expect(errorMessage("bad")).toBe("bad");
    expect(errorMessage(42)).toBe("42");
  });
});
