import { createInterface } from "node:readline";
import type { IO } from "../cli/io.js";
import { runMcp } from "../cli/run.js";

function stdinLines(): AsyncIterable<string> {
  return createInterface({ input: process.stdin, crlfDelay: Infinity });
}

export function serveStdio(
  io: IO,
  version: string,
  lines?: AsyncIterable<string>,
): Promise<number> {
  return runMcp(io, version, lines ?? stdinLines());
}
