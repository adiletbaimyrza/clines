import { describe, expect, it } from "vitest";
import { renderBanner } from "../src/cli/banner.js";

describe("renderBanner", () => {
  it("includes the tool name, version and usage hint", () => {
    const banner = renderBanner("1.2.3");
    expect(banner).toContain("clines");
    expect(banner).toContain("v1.2.3");
    expect(banner).toContain("clines --help");
  });

  it("lists every command with a description", () => {
    const banner = renderBanner("1.0.0");
    for (const name of ["count", "dup", "cx", "ctx", "comments"]) {
      expect(banner).toContain(name);
    }
    expect(banner).toContain("lines, comments and blanks per language");
    expect(banner).toContain("duplicated code blocks");
    expect(banner).toContain("files ranked by complexity");
    expect(banner).toContain("estimated token cost to read the repo");
  });

  it("renders the ASCII art block", () => {
    expect(renderBanner("1.0.0")).toContain("█");
  });
});
