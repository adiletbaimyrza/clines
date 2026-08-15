import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli/program.js";
import { runMcp } from "../src/cli/run.js";
import { PROTOCOL_VERSION, respond, serve, type Request } from "../src/mcp/server.js";
import { callTool, DEFAULT_TOP, isTool, TOOLS } from "../src/mcp/tools.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

const OPTIONS = { version: "1.2.3", io: { out: () => {}, err: () => {} } };

async function* feed(...messages: unknown[]): AsyncIterable<string> {
  for (const message of messages) {
    yield typeof message === "string" ? message : JSON.stringify(message);
  }
}

function collect(): { write: (line: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { write: (line) => lines.push(line), lines };
}

describe("the MCP protocol", () => {
  it("announces the protocol version and its own name", async () => {
    const response = await respond({ jsonrpc: "2.0", id: 1, method: "initialize" }, OPTIONS);

    expect(response?.result).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "clines", version: "1.2.3" },
    });
  });

  it("lists every tool with an input schema", async () => {
    const response = await respond({ jsonrpc: "2.0", id: 2, method: "tools/list" }, OPTIONS);
    const tools = (response?.result as { tools: typeof TOOLS }).tools;

    expect(tools).toHaveLength(8);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^clines_/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });

  it("never answers a notification", async () => {
    const response = await respond(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      OPTIONS,
    );

    expect(response).toBeUndefined();
  });

  it("rejects an unknown method", async () => {
    const response = await respond({ jsonrpc: "2.0", id: 3, method: "resources/list" }, OPTIONS);

    expect(response?.error).toMatchObject({ code: -32601 });
  });

  it("rejects a message with no method", async () => {
    const response = await respond({ jsonrpc: "2.0", id: 4 }, OPTIONS);

    expect(response?.error).toMatchObject({ code: -32600 });
  });

  it("rejects an unknown tool, named or missing", async () => {
    const named = await respond(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "clines_nope" } },
      OPTIONS,
    );
    const missing = await respond({ jsonrpc: "2.0", id: 6, method: "tools/call" }, OPTIONS);

    expect(named?.error?.message).toContain("clines_nope");
    expect(missing?.error?.message).toContain("(none)");
  });

  it("reports a failed analysis as a tool error, not a protocol error", async () => {
    const response = await respond(
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "clines_count", arguments: { dir: project.path("missing") } },
      },
      OPTIONS,
    );

    expect(response?.error).toBeUndefined();
    expect(response?.result).toMatchObject({ isError: true });
    expect(JSON.stringify(response?.result)).toContain("Directory not found");
  });

  it("uses a null id when the request has none", async () => {
    const response = await respond({ jsonrpc: "2.0", method: "tools/list" } as Request, OPTIONS);

    expect(response?.id).toBeNull();
  });
});

describe("the stdio loop", () => {
  it("answers each line and skips the blank ones", async () => {
    const { write, lines } = collect();

    await serve(feed({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "", "   "), write, OPTIONS);

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).id).toBe(1);
  });

  it("answers malformed JSON with a parse error", async () => {
    const { write, lines } = collect();

    await serve(feed("{not json"), write, OPTIONS);

    expect(JSON.parse(lines[0]!)).toMatchObject({ id: null, error: { code: -32700 } });
  });

  it("writes nothing for a notification", async () => {
    const { write, lines } = collect();

    await serve(feed({ jsonrpc: "2.0", method: "notifications/initialized" }), write, OPTIONS);

    expect(lines).toEqual([]);
  });
});

describe("the tools", () => {
  it("knows which names it serves", () => {
    expect(isTool("clines_ctx")).toBe(true);
    expect(isTool("ctx")).toBe(false);
  });

  it("answers every tool for a real directory", async () => {
    project.file("a.ts", "// a note\nif (a && b) { c(); }\n");
    project.file("b.ts", "// a note\nif (a && b) { c(); }\n");
    const { io } = captureIO();

    for (const tool of TOOLS) {
      const result = await callTool(tool.name, { dir: project.root }, io);
      expect(result, tool.name).toBeTypeOf("object");
    }
  });

  it("caps its rows so an agent is not made to read the whole tree", async () => {
    for (let i = 0; i < DEFAULT_TOP + 5; i++) {
      project.file(`f${i}.ts`, `if (a${i} && b) { c(); }\n`);
    }
    const { io } = captureIO();

    const capped = (await callTool("clines_cx", { dir: project.root }, io)) as {
      files: unknown[];
      totalFiles: number;
    };
    const raised = (await callTool("clines_cx", { dir: project.root, top: 100 }, io)) as {
      files: unknown[];
    };

    expect(capped.files).toHaveLength(DEFAULT_TOP);
    expect(capped.totalFiles).toBe(DEFAULT_TOP + 5);
    expect(raised.files).toHaveLength(DEFAULT_TOP + 5);
  });

  it("clamps a nonsensical row count instead of returning junk", async () => {
    project.file("a.ts", "if (a && b) { c(); }\n");
    project.file("b.ts", "if (d && e) { f(); }\n");
    const { io } = captureIO();

    // slice(0, -1) would quietly drop a row and slice(0, 0) would return none
    for (const top of [-1, 0, 0.5]) {
      const result = (await callTool("clines_cx", { dir: project.root, top }, io)) as {
        files: unknown[];
      };
      expect(result.files, `top=${top}`).toHaveLength(1);
    }
  });

  it("says so when refactor has no git history to read", async () => {
    project.file("a.ts", "if (a) { b(); }\n");
    const { io } = captureIO();

    const result = await callTool("clines_refactor", { dir: project.root }, io);

    expect(result).toEqual({ unavailable: "no-git" });
  });

  it("reports refactor verdicts inside a repository", async () => {
    const { io } = captureIO();

    const result = (await callTool("clines_refactor", { dir: process.cwd(), top: 3 }, io)) as {
      verdicts: Record<string, number>;
      candidates: unknown[];
    };

    expect(result.verdicts).toHaveProperty("refactor");
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("serves coupling from a real repository", async () => {
    const { io } = captureIO();

    const result = (await callTool("clines_coupling", { dir: process.cwd(), top: 2 }, io)) as {
      pairs: unknown[];
      totalPairs: number;
    };

    expect(result.pairs.length).toBeLessThanOrEqual(2);
    expect(result.totalPairs).toBeGreaterThanOrEqual(result.pairs.length);
  });

  it("says so when coupling has no git history to read", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io } = captureIO();

    expect(await callTool("clines_coupling", { dir: project.root }, io)).toEqual({
      unavailable: "no-git",
    });
  });

  it("serves agent risk", async () => {
    project.file("dense.ts", `${"if (a && b) { c(); }\n".repeat(30)}`);
    const { io } = captureIO();

    const result = (await callTool("clines_agent", { dir: project.root }, io)) as {
      verdicts: Record<string, number>;
    };

    expect(result.verdicts).toHaveProperty("safe");
  });

  it("says so when there are no comments to blame", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io } = captureIO();

    expect(await callTool("clines_comments", { dir: project.root }, io)).toEqual({
      unavailable: "no-comments",
    });
  });

  it("defaults the directory when no arguments are given", async () => {
    const response = await respond(
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "clines_count" } },
      OPTIONS,
    );
    const payload = JSON.parse(
      (response?.result as { content: { text: string }[] }).content[0]!.text,
    ) as { totalFiles: number };

    expect(payload.totalFiles).toBeGreaterThan(0);
  });

  it("reports comment health when there is history to read", async () => {
    const { io } = captureIO();

    const result = (await callTool("clines_comments", { dir: process.cwd(), top: 3 }, io)) as {
      blocks?: number;
    };

    expect(result).toHaveProperty("blocks");
  });

  it("scopes a tool call to a diff", async () => {
    const { io } = captureIO();
    const whole = (await callTool("clines_count", { dir: process.cwd() }, io)) as {
      totalFiles: number;
    };

    const scoped = (await callTool("clines_count", { dir: process.cwd(), diff: "HEAD~1" }, io)) as {
      totalFiles: number;
    };

    expect(scoped.totalFiles).toBeLessThan(whole.totalFiles);
  });
});

describe("clines mcp", () => {
  it("takes over stdout before the pager can buffer it", async () => {
    const { io, out } = captureIO();

    const code = await runCli(["node", "clines", "mcp"], io, {
      version: "4.5.6",
      mcpInput: feed({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });

    expect(code).toBe(0);
    // straight through, not held back by the pager until exit
    expect(JSON.parse(out[0]!).result.serverInfo.version).toBe("4.5.6");
  });

  it("explains itself instead of serving when asked for help", async () => {
    for (const flag of ["--help", "-h"]) {
      const { io, out } = captureIO();

      const code = await runCli(["node", "clines", "mcp", flag], io);

      expect(code, flag).toBe(0);
      expect(out.join("\n"), flag).toContain("Usage: clines mcp");
      expect(out.join("\n"), flag).toContain("clines_coupling");
    }
  });

  it("writes protocol responses to stdout and everything else to stderr", async () => {
    const { io, out, err } = captureIO();

    const code = await runMcp(io, "1.0.0", feed({ jsonrpc: "2.0", id: 1, method: "initialize" }));

    expect(code).toBe(0);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!).result.serverInfo.version).toBe("1.0.0");
    expect(err).toEqual([]);
  });

  it("keeps analysis chatter off stdout", async () => {
    const { io, out } = captureIO();

    await runMcp(
      io,
      "1.0.0",
      feed({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "clines_count", arguments: { dir: process.cwd(), diff: "HEAD~1" } },
      }),
    );

    expect(out).toHaveLength(1);
    expect(() => JSON.parse(out[0]!)).not.toThrow();
  });
});
