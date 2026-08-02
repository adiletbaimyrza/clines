import { describe, expect, it } from "vitest";
import { getProjectSize } from "../src/report/format/size-label.js";

describe("getProjectSize", () => {
  it("maps line counts to the expected tiers", () => {
    expect(getProjectSize(0).text).toBe("Tiny scriptlet 💡");
    expect(getProjectSize(499).text).toBe("Tiny scriptlet 💡");
    expect(getProjectSize(500).text).toBe("Compact utility 🛠️");
    expect(getProjectSize(1999).text).toBe("Compact utility 🛠️");
    expect(getProjectSize(4999).text).toBe("Growing codebase 🏗️");
    expect(getProjectSize(9999).text).toBe("Well-structured project ⚙️");
    expect(getProjectSize(19999).text).toBe("Robust system 🔬");
    expect(getProjectSize(49999).text).toBe("Complex software 🏢");
  });

  it("produces well-formed HTML for the top tier (bug #2)", () => {
    const size = getProjectSize(120000);
    expect(size.text).toBe("Massive code empire 🌌");
    expect(size.color).toBe("red");
    expect(size.html).toBe('<span style="color: red;">Massive code empire 🌌</span>');
    expect(size.html.match(/<\/span>/g)).toHaveLength(1);
  });

  it("wraps every tier in a single valid span", () => {
    const size = getProjectSize(100);
    expect(size.html).toBe('<span style="color: green;">Tiny scriptlet 💡</span>');
  });
});
