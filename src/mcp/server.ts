import type { IO } from "../cli/io.js";
import { errorMessage } from "../util/errors.js";
import { callTool, isTool, TOOLS, type ToolArgs } from "./tools.js";

export const PROTOCOL_VERSION = "2025-06-18";

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;

export interface Request {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: ToolArgs };
}

export interface Response {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function ok(id: number | string | null, result: unknown): Response {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: number | string | null, code: number, message: string): Response {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export interface ServerOptions {
  version: string;
  io: IO;
}

// undefined for notifications, which must not be answered.
export async function respond(
  request: Request,
  options: ServerOptions,
): Promise<Response | undefined> {
  const id = request.id ?? null;

  if (request.method === undefined) {
    return fail(id, INVALID_REQUEST, "missing method");
  }

  if (request.method === "initialize") {
    return ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "clines", version: options.version },
    });
  }

  if (request.method.startsWith("notifications/")) {
    return undefined;
  }

  if (request.method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  if (request.method === "tools/call") {
    return callToolSafely(id, request, options);
  }

  return fail(id, METHOD_NOT_FOUND, `unknown method: ${request.method}`);
}

async function callToolSafely(
  id: number | string | null,
  request: Request,
  options: ServerOptions,
): Promise<Response> {
  const name = request.params?.name;
  if (name === undefined || !isTool(name)) {
    return fail(id, METHOD_NOT_FOUND, `unknown tool: ${name ?? "(none)"}`);
  }
  try {
    const result = await callTool(name, request.params?.arguments ?? {}, options.io);
    return ok(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
  } catch (error) {
    return ok(id, {
      content: [{ type: "text", text: errorMessage(error) }],
      isError: true,
    });
  }
}

export type LineWriter = (line: string) => void;

export async function serve(
  lines: AsyncIterable<string>,
  write: LineWriter,
  options: ServerOptions,
): Promise<void> {
  for await (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    let request: Request;
    try {
      request = JSON.parse(line) as Request;
    } catch {
      write(JSON.stringify(fail(null, PARSE_ERROR, "invalid JSON")));
      continue;
    }
    const response = await respond(request, options);
    if (response !== undefined) {
      write(JSON.stringify(response));
    }
  }
}
