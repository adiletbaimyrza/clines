import { describe, expect, it } from "vitest";
import { estimateTokens } from "../src/core/tokenizer/tokens.js";

describe("estimateTokens", () => {
  it("returns zero for empty and whitespace-only text", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("   \t  ")).toBe(0);
  });

  it("splits camelCase, snake_case and letter-digit boundaries", () => {
    expect(estimateTokens("getUserName")).toBe(3);
    expect(estimateTokens("get_user_name")).toBe(3);
    expect(estimateTokens("sha256")).toBe(2);
  });

  it("charges at least one token for a word made only of separators", () => {
    expect(estimateTokens("_")).toBe(1);
    expect(estimateTokens("__")).toBe(1);
  });

  it("shreds identifiers longer than the chunk size", () => {
    expect(estimateTokens("abcdefghij")).toBe(1);
    expect(estimateTokens("abcdefghijk")).toBe(2);
  });

  it("charges symbol runs by length", () => {
    expect(estimateTokens("=")).toBe(1);
    expect(estimateTokens("=>")).toBe(1);
    expect(estimateTokens("});")).toBe(1);
    expect(estimateTokens("!@#$%^")).toBe(2);
  });

  it("charges one token per newline", () => {
    expect(estimateTokens("a\nb")).toBe(3);
  });

  it("adds up over a line of real code", () => {
    expect(estimateTokens("const userName = getUser(id);")).toBe(9);
  });
});
