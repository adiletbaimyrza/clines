import path from "node:path";
import type { FileTokens, LanguageSyntax, LineKind } from "../model.js";
import { getComplexityChecks, getLanguageSyntax, type ComplexityChecks } from "./languages.js";

interface ScanState {
  inBlock: boolean;
}

interface LineScan {
  kind: LineKind;
  code: string;
}

function scanLine(rawLine: string, syntax: LanguageSyntax, state: ScanState): LineScan {
  if (rawLine.trim() === "") {
    return { kind: "blank", code: "" };
  }

  const { singleComment, blockCommentStart, blockCommentEnd } = syntax;
  const hasBlock = Boolean(blockCommentStart) && Boolean(blockCommentEnd);

  let hasCode = false;
  let inString = false;
  let stringChar = "";
  let code = "";

  let i = 0;
  while (i < rawLine.length) {
    const char = rawLine[i] as string;

    if (state.inBlock) {
      const end = blockCommentEnd as string;
      if (rawLine.startsWith(end, i)) {
        state.inBlock = false;
        i += end.length;
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

    if (hasBlock && rawLine.startsWith(blockCommentStart as string, i)) {
      state.inBlock = true;
      i += (blockCommentStart as string).length;
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
  const state: ScanState = { inBlock: false };
  return splitLines(content).map((line) => scanLine(line, syntax, state).kind);
}

export function sanitizeCode(content: string, syntax: LanguageSyntax): string {
  const state: ScanState = { inBlock: false };
  return splitLines(content)
    .map((line) => scanLine(line, syntax, state).code)
    .join("\n");
}

export function countComplexity(code: string, checks: ComplexityChecks): number {
  let total = 0;
  for (const keyword of checks.keywords) {
    total += code.match(new RegExp(`\\b${keyword}\\b`, "g"))?.length ?? 0;
  }
  for (const operator of checks.operators) {
    total += code.split(operator).length - 1;
  }
  return total;
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
