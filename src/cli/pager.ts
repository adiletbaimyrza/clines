import { spawn } from "node:child_process";
import { isInteractive } from "../util/tty.js";
import type { IO } from "./io.js";

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
}

export function fitsOnScreen(text: string, rows: number | undefined): boolean {
  if (rows === undefined || rows === 0) {
    return true;
  }
  return text.split("\n").length <= rows - 1;
}

export async function flush(text: string, io: IO, options: FlushOptions = {}): Promise<void> {
  if (text === "") {
    return;
  }
  const interactive = options.interactive ?? isInteractive();
  const rows = options.rows ?? process.stdout.rows;
  const wanted = options.paged !== false && interactive && !fitsOnScreen(text, rows);
  const pager = wanted ? pagerCommand(options.env) : undefined;

  if (pager !== undefined && (await (options.launch ?? spawnPager)(pager, text))) {
    return;
  }
  io.out(text);
}
