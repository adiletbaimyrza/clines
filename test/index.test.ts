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
    expect(api.parseUserConfig).toBeDefined();
    expect(api.ConfigError).toBeDefined();
  });

  it("exposes every command as a library call", () => {
    expect(typeof api.analyzeComments).toBe("function");
    expect(typeof api.analyzeRefactor).toBe("function");
    expect(typeof api.analyzeCloneChurn).toBe("function");
    expect(typeof api.collectRoledFiles).toBe("function");
    expect(typeof api.partition).toBe("function");
    expect(typeof api.summarizeRoles).toBe("function");
  });

  it("exposes the config loaders the CLI uses, so callers can match its behaviour", () => {
    expect(typeof api.loadConfig).toBe("function");
    expect(typeof api.loadGitignoreGlobs).toBe("function");
    expect(typeof api.loadGitAttributes).toBe("function");
  });

  it("exposes the two history-driven analyses", () => {
    expect(typeof api.analyzeCoupling).toBe("function");
    expect(typeof api.analyzeAgent).toBe("function");
    expect(typeof api.coupleCommits).toBe("function");
    expect(typeof api.judgeAgentRisk).toBe("function");
    expect(typeof api.parseHistory).toBe("function");
    expect(typeof api.commitsOf).toBe("function");
    expect(typeof api.fileChanges).toBe("function");
    expect(typeof api.isBot).toBe("function");
    expect(api.DEFAULT_LIMITS).toMatchObject({ minRevisions: 10 });
  });

  it("exposes the git helpers and the JSON schema", () => {
    expect(typeof api.blameFile).toBe("function");
    expect(typeof api.changeLog).toBe("function");
    expect(typeof api.changedFiles).toBe("function");
    expect(typeof api.repoState).toBe("function");
    expect(api.SCHEMA).toBe(1);
    expect(typeof api.renderCountJson).toBe("function");
    expect(typeof api.renderRefactorJson).toBe("function");
    expect(typeof api.renderCouplingJson).toBe("function");
    expect(typeof api.renderAgentJson).toBe("function");
  });
});
