import { describe, expect, it } from "vitest";
import { getProjectSize } from "../src/report/format/size-label.js";

describe("getProjectSize", () => {
  it("maps line counts to the expected tiers", () => {
    expect(getProjectSize(0).text).toBe("Meteoroid 🪨");
    expect(getProjectSize(999).text).toBe("Meteoroid 🪨");
    expect(getProjectSize(1_000).text).toBe("Asteroid ☄️");
    expect(getProjectSize(9_999).text).toBe("Asteroid ☄️");
    expect(getProjectSize(10_000).text).toBe("Moon 🌑");
    expect(getProjectSize(49_999).text).toBe("Moon 🌑");
    expect(getProjectSize(50_000).text).toBe("Planet 🪐");
    expect(getProjectSize(99_999).text).toBe("Planet 🪐");
    expect(getProjectSize(100_000).text).toBe("Star ⭐");
    expect(getProjectSize(499_999).text).toBe("Star ⭐");
    expect(getProjectSize(500_000).text).toBe("Solar System ☀️");
    expect(getProjectSize(999_999).text).toBe("Solar System ☀️");
    expect(getProjectSize(1_000_000).text).toBe("Galaxy 🌌");
    expect(getProjectSize(4_999_999).text).toBe("Galaxy 🌌");
  });

  it("produces well-formed HTML for the top (Universe) tier", () => {
    const size = getProjectSize(6_000_000);
    expect(size.text).toBe("Universe 🌠");
    expect(size.color).toBe("crimson");
    expect(size.html).toBe('<span style="color: crimson;">Universe 🌠</span>');
    expect(size.html.match(/<\/span>/g)).toHaveLength(1);
  });

  it("wraps every tier in a single valid span", () => {
    expect(getProjectSize(100).html).toBe('<span style="color: green;">Meteoroid 🪨</span>');
  });
});
