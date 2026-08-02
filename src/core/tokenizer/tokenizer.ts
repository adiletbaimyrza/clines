import path from "node:path";
import type { FileTokens, LanguageSyntax, LineKind } from "../model.js";
import { getLanguageSyntax } from "./languages.js";

interface ScanState {
  inBlock: boolean;
}

export function classifyLine(rawLine: string, syntax: LanguageSyntax, state: ScanState): LineKind {
  if (rawLine.trim() === "") {
    return "blank";
  }

  const { singleComment, blockCommentStart, blockCommentEnd } = syntax;
  const hasBlock = Boolean(blockCommentStart) && Boolean(blockCommentEnd);

  let hasCode = false;
  let inString = false;
  let stringChar = "";

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
      i += 1;
      continue;
    }

    if (!isWhitespace(char)) {
      hasCode = true;
    }
    i += 1;
  }

  if (hasCode) return "code";
  return "comment";
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r" || char === "\f" || char === "\v";
}

export function classifyContent(content: string, syntax: LanguageSyntax): LineKind[] {
  const state: ScanState = { inBlock: false };
  return content.split(/\r?\n/).map((line) => classifyLine(line, syntax, state));
}

export function tokenize(filePath: string, content: string): FileTokens {
  const ext = path.extname(filePath) || "no_ext";
  const syntax = getLanguageSyntax(ext);
  return { path: filePath, ext, lineKinds: classifyContent(content, syntax) };
}
