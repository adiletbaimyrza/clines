#!/usr/bin/env node
import { createRequire } from "node:module";
import { runCli } from "./program.js";
import { consoleIO } from "./io.js";
import { ClinesError, errorMessage } from "../util/errors.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

async function main(): Promise<void> {
  try {
    process.exitCode = await runCli(process.argv, consoleIO, { version: pkg.version });
  } catch (error) {
    if (error instanceof ClinesError) {
      consoleIO.err(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    const code = (error as { exitCode?: number }).exitCode;
    if (typeof code !== "number") {
      consoleIO.err(`clines failed unexpectedly: ${errorMessage(error)}`);
    }
    process.exitCode = typeof code === "number" ? code : 1;
  }
}

void main();
