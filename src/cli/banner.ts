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
  ["cx", "complexity hotspots"],
  ["ctx", "what the repo costs an AI agent to read"],
];

const ESC = String.fromCharCode(27);
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const CYAN = `${ESC}[36m`;

export function renderBanner(version: string): string {
  const art = ART.map(({ line, color }) => `${BOLD}${ESC}[38;5;${color}m${line}${RESET}`).join(
    "\n",
  );
  const width = Math.max(...COMMANDS.map(([name]) => name.length));
  const commands = COMMANDS.map(
    ([name, description]) =>
      `  ${CYAN}${name}${RESET}${" ".repeat(width - name.length)}   ${DIM}${description}${RESET}`,
  );
  return [
    "",
    art,
    "",
    `  ${BOLD}clines${RESET} ${DIM}v${version}${RESET} — measure your codebase`,
    "",
    ...commands,
    "",
    `  Run ${CYAN}clines <command>${RESET} to scan, or ${CYAN}clines --help${RESET} for options.`,
    "",
  ].join("\n");
}
