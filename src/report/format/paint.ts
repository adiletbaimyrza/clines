import { useColor } from "../../util/tty.js";

const ESC = String.fromCharCode(27);
const RESET = `${ESC}[0m`;

const CODES = {
  bold: "1",
  dim: "2",
  red: "31",
  green: "32",
  yellow: "33",
  magenta: "35",
  cyan: "36",
} as const;

export type Ink = keyof typeof CODES;

export type Painter = (text: string, ink: Ink | undefined) => string;

export const plainPainter: Painter = (text) => text;

export function painter(color: boolean = useColor()): Painter {
  if (!color) {
    return plainPainter;
  }
  return (text, ink) => (ink === undefined ? text : `${ESC}[${CODES[ink]}m${text}${RESET}`);
}

const SGR = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

export function stripInk(text: string): string {
  return text.replace(SGR, "");
}
