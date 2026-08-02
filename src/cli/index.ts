#!/usr/bin/env node
import { createRequire } from "node:module";
import { buildProgram } from "./program.js";
import { consoleIO } from "./io.js";
import { ClinesError } from "../util/errors.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

async function main(): Promise<void> {
  const program = buildProgram(consoleIO, { version: pkg.version });
  program.exitOverride();
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof ClinesError) {
      consoleIO.err(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    const code = (error as { exitCode?: number }).exitCode;
    process.exitCode = typeof code === "number" ? code : 1;
  }
}

void main();
