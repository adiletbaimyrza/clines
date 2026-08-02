import { describe, expect, it } from "vitest";
import { renderBanner } from "../src/cli/banner.js";

describe("renderBanner", () => {
  it("includes the tool name, version and usage hint", () => {
    const banner = renderBanner("1.2.3");
    expect(banner).toContain("clines");
    expect(banner).toContain("v1.2.3");
    expect(banner).toContain("clines count");
  });

  it("renders the ASCII art block", () => {
    expect(renderBanner("1.0.0")).toContain("█");
  });
});
