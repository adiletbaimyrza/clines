import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

describe("public API", () => {
  it("exposes the documented surface", () => {
    expect(typeof api.analyze).toBe("function");
    expect(typeof api.analyzeComplexity).toBe("function");
    expect(typeof api.analyzeContext).toBe("function");
    expect(typeof api.analyzeDuplication).toBe("function");
    expect(typeof api.estimateTokens).toBe("function");
    expect(typeof api.tokenize).toBe("function");
    expect(typeof api.classifyContent).toBe("function");
    expect(typeof api.getLanguageSyntax).toBe("function");
    expect(typeof api.getLanguageName).toBe("function");
    expect(typeof api.collectFiles).toBe("function");
    expect(typeof api.getProjectSize).toBe("function");
    expect(typeof api.buildReadmeSection).toBe("function");
    expect(typeof api.injectReadme).toBe("function");
    expect(typeof api.defaultConfig).toBe("function");
    expect(typeof api.parseConfig).toBe("function");
    expect(typeof api.resolveConfig).toBe("function");
    expect(api.linesAnalyzer.name).toBe("lines");
    expect(api.userConfigSchema).toBeDefined();
  });
});
