import { spawn } from "node:child_process";
import { isInteractive, useColor } from "../util/tty.js";
import type { IO } from "./io.js";
import { decode, fitsOnScreen, view, type Screen } from "./viewer.js";

export interface PagerCommand {
  command: string;
  args: string[];
}

export type PagerLauncher = (pager: PagerCommand, text: string) => Promise<boolean>;

const LESS_ARGS = ["-R", "-F", "-X"];

export function pagerCommand(env: NodeJS.ProcessEnv = process.env): PagerCommand | undefined {
  const configured = env["CLINES_PAGER"] ?? env["PAGER"];
  if (configured === undefined) {
    return { command: "less", args: LESS_ARGS };
  }
  const [command, ...args] = configured.trim().split(/\s+/);
  if (command === undefined || command === "" || command === "cat") {
    return undefined;
  }
  if (args.length > 0) {
    return { command, args };
  }
  return { command, args: command === "less" ? LESS_ARGS : [] };
}

export function collect(io: IO): { io: IO; text: () => string } {
  const chunks: string[] = [];
  return {
    io: { out: (message) => chunks.push(message), err: (message) => io.err(message) },
    text: () => chunks.join("\n"),
  };
}

export const spawnPager: PagerLauncher = async (pager, text) =>
  new Promise((resolve) => {
    const child = spawn(pager.command, pager.args, {
      stdio: ["pipe", "inherit", "inherit"],
    });
    let settled = false;
    const done = (ran: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(ran);
      }
    };
    child.on("error", () => done(false));
    child.on("close", () => done(true));
    child.stdin.on("error", () => done(true));
    child.stdin.end(`${text}\n`);
  });

export interface FlushOptions {
  paged?: boolean;
  rows?: number;
  interactive?: boolean;
  env?: NodeJS.ProcessEnv;
  launch?: PagerLauncher;
  screen?: Screen;
}

export async function flush(text: string, io: IO, options: FlushOptions = {}): Promise<void> {
  if (text === "") {
    return;
  }
  const interactive = options.interactive ?? isInteractive();
  const rows = options.rows ?? process.stdout.rows;
  if (options.paged === false || !interactive || fitsOnScreen(text, rows)) {
    io.out(text);
    return;
  }

  const env = options.env ?? process.env;
  const chosen = env["CLINES_PAGER"] ?? env["PAGER"];
  if (chosen === undefined) {
    const screen = options.screen ?? ttyScreen();
    if (screen !== undefined) {
      await view(text.split("\n"), screen);
      return;
    }
  }

  const pager = pagerCommand(env);
  if (pager !== undefined && (await (options.launch ?? spawnPager)(pager, text))) {
    return;
  }
  io.out(text);
}

export function ttyScreen(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stdout,
): Screen | undefined {
  if (input.isTTY !== true || typeof input.setRawMode !== "function") {
    return undefined;
  }
  return {
    colour: useColor(output),
    write: (text) => void output.write(text),
    size: () => ({ rows: output.rows ?? 24, columns: output.columns ?? 80 }),
    keys: (onKey) => {
      const listener = (chunk: string): void => {
        for (const key of decode(chunk)) {
          onKey(key);
        }
      };
      input.setRawMode(true);
      input.resume();
      input.setEncoding("utf8");
      input.on("data", listener);
      return () => {
        input.off("data", listener);
        input.setRawMode(false);
        input.pause();
      };
    },
  };
}
