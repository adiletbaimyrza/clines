const MIN_WIDTH = 60;
const MAX_WIDTH = 120;
const DEFAULT_WIDTH = 100;

export function terminalWidth(): number {
  const columns = process.stdout.columns;
  if (columns === undefined || Number.isNaN(columns)) {
    return DEFAULT_WIDTH;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, columns));
}

export function shorten(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  if (max <= 1) {
    return "…";
  }
  const tail = Math.ceil((max - 1) * 0.6);
  const head = max - 1 - tail;
  return head <= 0
    ? `…${value.slice(value.length - max + 1)}`
    : `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

export function multiple(value: number, of: number): string {
  if (of === 0) {
    return "—";
  }
  const ratio = value / of;
  return ratio >= 10 ? `${ratio.toFixed(1)}×` : `${(ratio * 100).toFixed(1)}%`;
}

export function wrap(text: string, indent: string = "", width: number = terminalWidth()): string[] {
  const limit = Math.max(20, width - indent.length);
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(" ")) {
    if (current === "") {
      current = word;
    } else if (current.length + 1 + word.length <= limit) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);

  return lines.map((line, index) => (index === 0 ? line : `${indent}${line}`));
}

export function table(
  headers: string[],
  rows: string[][],
  width: number = terminalWidth(),
): string[] {
  const natural = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] as string).length)),
  );
  const gaps = 3 * (headers.length - 1) + 2;
  const overflow = natural.reduce((sum, w) => sum + w, 0) + gaps - width;
  const widths = [...natural];
  if (overflow > 0) {
    widths[0] = Math.max(12, (natural[0] as number) - overflow);
  }

  const line = (cells: string[]): string =>
    `  ${cells
      .map((cell, column) => {
        const w = widths[column] as number;
        return column === 0 ? shorten(cell, w).padEnd(w) : cell.padStart(w);
      })
      .join("   ")}`;
  return [line(headers), ...rows.map(line)];
}
