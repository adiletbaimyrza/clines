import { useColor } from "../util/tty.js";

interface ArtLine {
  line: string;
  color: number;
}

const ART: ArtLine[] = [
  { line: " ██████╗██╗     ██╗███╗   ██╗███████╗███████╗", color: 51 },
  { line: "██╔════╝██║     ██║████╗  ██║██╔════╝██╔════╝", color: 50 },
  { line: "██║     ██║     ██║██╔██╗ ██║█████╗  ███████╗", color: 45 },
  { line: "██║     ██║     ██║██║╚██╗██║██╔══╝  ╚════██║", color: 44 },
  { line: "╚██████╗███████╗██║██║ ╚████║███████╗███████║", color: 39 },
  { line: " ╚═════╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝", color: 38 },
];

const COMMANDS: [string, string][] = [
  ["count", "lines, comments and blanks per language"],
  ["dup", "duplicated code blocks"],
  ["cx", "files ranked by complexity"],
  ["ctx", "estimated token cost to read the repo"],
  ["comments", "comments the code has drifted away from"],
  ["refactor", "which files are worth refactoring"],
];

const ESC = String.fromCharCode(27);
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const CYAN = `${ESC}[36m`;

export function renderBanner(version: string, color: boolean = useColor()): string {
  const paint = (code: string, text: string): string => (color ? `${code}${text}${RESET}` : text);
  const art = ART.map((entry) => paint(`${BOLD}${ESC}[38;5;${entry.color}m`, entry.line)).join(
    "\n",
  );
  const width = Math.max(...COMMANDS.map(([name]) => name.length));
  const commands = COMMANDS.map(
    ([name, description]) =>
      `  ${paint(CYAN, name)}${" ".repeat(width - name.length)}   ${paint(DIM, description)}`,
  );
  return [
    "",
    art,
    "",
    `  ${paint(BOLD, "clines")} ${paint(DIM, `v${version}`)} — measure your codebase`,
    "",
    ...commands,
    "",
    `  Run ${paint(CYAN, "clines <command>")} to scan, or ${paint(CYAN, "clines --help")} for options.`,
    "",
  ].join("\n");
}
