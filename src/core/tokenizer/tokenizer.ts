import path from "node:path";
import type { BlockComment, FileTokens, LanguageSyntax, LineKind } from "../model.js";
import { getComplexityChecks, getLanguageSyntax, type ComplexityChecks } from "./languages.js";

interface ScanState {
  openBlock: BlockComment | undefined;
}

export function blockComments(syntax: LanguageSyntax): BlockComment[] {
  const { blockCommentStart: start, blockCommentEnd: end } = syntax;
  const pair = start !== undefined && end !== undefined ? [{ start, end }] : [];
  return [...pair, ...(syntax.blocks ?? [])];
}

interface LineScan {
  kind: LineKind;
  code: string;
}

function scanLine(rawLine: string, syntax: LanguageSyntax, state: ScanState): LineScan {
  if (rawLine.trim() === "") {
    return { kind: "blank", code: "" };
  }

  const { singleComment } = syntax;
  const blocks = blockComments(syntax);

  let hasCode = false;
  let inString = false;
  let stringChar = "";
  let code = "";

  let i = 0;
  while (i < rawLine.length) {
    const char = rawLine[i] as string;

    const open = state.openBlock;
    if (open !== undefined) {
      if (rawLine.startsWith(open.end, i)) {
        state.openBlock = undefined;
        i += open.end.length;
      } else {
        i += 1;
      }
      continue;
    }

    if (inString) {
      hasCode = true;
      if (char === "\\") {
        i += 2;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        code += char;
      }
      i += 1;
      continue;
    }

    const starting = blocks.find((block) => rawLine.startsWith(block.start, i));
    if (starting !== undefined) {
      state.openBlock = starting;
      i += starting.start.length;
      continue;
    }

    if (singleComment !== undefined && rawLine.startsWith(singleComment, i)) {
      break;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      hasCode = true;
      code += char;
      i += 1;
      continue;
    }

    if (!isWhitespace(char)) {
      hasCode = true;
    }
    code += char;
    i += 1;
  }

  return { kind: hasCode ? "code" : "comment", code };
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r" || char === "\f" || char === "\v";
}

export function splitLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

export function classifyContent(content: string, syntax: LanguageSyntax): LineKind[] {
  const state: ScanState = { openBlock: undefined };
  return splitLines(content).map((line) => scanLine(line, syntax, state).kind);
}

export function sanitizeCode(content: string, syntax: LanguageSyntax): string {
  const state: ScanState = { openBlock: undefined };
  return splitLines(content)
    .map((line) => scanLine(line, syntax, state).code)
    .join("\n");
}

const LOOP_KEYWORDS = new Set(["for", "while", "until", "loop"]);
const BOOL_KEYWORDS = new Set(["and", "or"]);

export const DENSEST_WINDOW = 40;

export interface ComplexityDetail {
  total: number;
  branch: number;
  loop: number;
  bool: number;
  densest: number;
}

export function measureComplexity(code: string, checks: ComplexityChecks): ComplexityDetail {
  const lines = splitLines(code);
  const perLine = new Array<number>(lines.length).fill(0);
  const detail: ComplexityDetail = { total: 0, branch: 0, loop: 0, bool: 0, densest: 0 };

  for (const keyword of checks.keywords) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "g");
    const bucket = LOOP_KEYWORDS.has(keyword)
      ? "loop"
      : BOOL_KEYWORDS.has(keyword)
        ? "bool"
        : "branch";
    for (let i = 0; i < lines.length; i++) {
      const hits = (lines[i] as string).match(pattern)?.length ?? 0;
      perLine[i] = (perLine[i] as number) + hits;
      detail[bucket] += hits;
      detail.total += hits;
    }
  }

  for (const operator of checks.operators) {
    for (let i = 0; i < lines.length; i++) {
      const hits = (lines[i] as string).split(operator).length - 1;
      perLine[i] = (perLine[i] as number) + hits;
      detail.bool += hits;
      detail.total += hits;
    }
  }

  let run = 0;
  for (let i = 0; i < perLine.length; i++) {
    run += perLine[i] as number;
    if (i >= DENSEST_WINDOW) {
      run -= perLine[i - DENSEST_WINDOW] as number;
    }
    detail.densest = Math.max(detail.densest, run);
  }

  return detail;
}

export function countComplexity(code: string, checks: ComplexityChecks): number {
  return measureComplexity(code, checks).total;
}

export function tokenize(filePath: string, content: string, kinds?: LineKind[]): FileTokens {
  const ext = path.extname(filePath) || "no_ext";
  const syntax = getLanguageSyntax(ext);
  return {
    path: filePath,
    ext,
    lineKinds: kinds ?? classifyContent(content, syntax),
    complexity: countComplexity(sanitizeCode(content, syntax), getComplexityChecks(ext)),
  };
}
