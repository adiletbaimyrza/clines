import { painter, stripInk, truncateInk } from "../report/format/paint.js";

const ESC = String.fromCharCode(27);
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const CTRL_B = String.fromCharCode(2);
const CTRL_F = String.fromCharCode(6);

export type Key = "up" | "down" | "pageUp" | "pageDown" | "top" | "bottom" | "quit";

const KEYS: Record<string, Key> = {
  [`${ESC}[A`]: "up",
  [`${ESC}[B`]: "down",
  [`${ESC}[5~`]: "pageUp",
  [`${ESC}[6~`]: "pageDown",
  [`${ESC}[H`]: "top",
  [`${ESC}[F`]: "bottom",
  [ESC]: "quit",
  k: "up",
  j: "down",
  b: "pageUp",
  " ": "pageDown",
  f: "pageDown",
  g: "top",
  G: "bottom",
  q: "quit",
  [CTRL_C]: "quit",
  [CTRL_D]: "quit",
  [CTRL_B]: "pageUp",
  [CTRL_F]: "pageDown",
};

export function decode(chunk: string): Key[] {
  const direct = KEYS[chunk];
  if (direct !== undefined) {
    return [direct];
  }
  if (chunk.startsWith(ESC)) {
    return [];
  }
  return [...chunk].map((char) => KEYS[char]).filter((key): key is Key => key !== undefined);
}

export interface Viewport {
  top: number;
  height: number;
  total: number;
}

export function scroll(view: Viewport, key: Key): number {
  const last = Math.max(0, view.total - view.height);
  const next =
    key === "up"
      ? view.top - 1
      : key === "down"
        ? view.top + 1
        : key === "pageUp"
          ? view.top - view.height
          : key === "pageDown"
            ? view.top + view.height
            : key === "top"
              ? 0
              : key === "bottom"
                ? last
                : view.top;
  return Math.min(last, Math.max(0, next));
}

const ENTER = `${ESC}[?1049h${ESC}[?25l`;
const LEAVE = `${ESC}[?25h${ESC}[?1049l`;
const HOME = `${ESC}[H`;
const CLEAR_LINE = `${ESC}[K`;
const CLEAR_BELOW = `${ESC}[J`;

const HELP = "↑↓ jk scroll · space page · g G ends · q quit";

export function status(view: Viewport, colour: boolean): string {
  const first = view.total === 0 ? 0 : view.top + 1;
  const last = Math.min(view.total, view.top + view.height);
  return painter(colour)(`  ${first}–${last} of ${view.total}   ${HELP}`, "dim");
}

export function frame(lines: string[], view: Viewport, columns: number, colour = true): string {
  const shown = lines
    .slice(view.top, view.top + view.height)
    .map((line) => `${truncateInk(line, columns)}${CLEAR_LINE}`);
  return `${HOME}${[...shown, status(view, colour)].join("\n")}${CLEAR_LINE}${CLEAR_BELOW}`;
}

export interface Screen {
  write(text: string): void;
  size(): { rows: number; columns: number };
  keys(onKey: (key: Key) => void): () => void;
  colour?: boolean;
}

function heightOf(rows: number): number {
  return Math.max(1, rows - 1);
}

export async function view(lines: string[], screen: Screen): Promise<void> {
  const colour = screen.colour !== false;
  let top = 0;

  const draw = (): void => {
    const { rows, columns } = screen.size();
    const height = heightOf(rows);
    top = Math.min(top, Math.max(0, lines.length - height));
    screen.write(frame(lines, { top, height, total: lines.length }, columns, colour));
  };

  screen.write(ENTER);
  try {
    await new Promise<void>((resolve) => {
      const stop = screen.keys((key) => {
        if (key === "quit") {
          stop();
          resolve();
          return;
        }
        top = scroll({ top, height: heightOf(screen.size().rows), total: lines.length }, key);
        draw();
      });
      draw();
    });
  } finally {
    screen.write(LEAVE);
  }
}

export function fitsOnScreen(text: string, rows: number | undefined): boolean {
  if (rows === undefined || rows === 0) {
    return true;
  }
  return stripInk(text).split("\n").length <= rows - 1;
}
