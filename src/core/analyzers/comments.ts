import type { LineKind } from "../model.js";

export const LOOKAHEAD = 10;

export interface FileDrift {
  path: string;
  blocks: number;
  drifted: number;
}

export interface CommentHealth {
  filesChecked: number;
  blocks: number;
  drifted: number;
  years: number;
  worst: FileDrift[];
}

export function measureDrift(
  kinds: LineKind[],
  times: number[],
  threshold: number,
): { blocks: number; drifted: number } {
  let blocks = 0;
  let drifted = 0;
  let i = 0;

  while (i < kinds.length) {
    if (kinds[i] !== "comment") {
      i += 1;
      continue;
    }

    let commentTime = 0;
    let j = i;
    while (j < kinds.length && kinds[j] === "comment") {
      commentTime = Math.max(commentTime, times[j] ?? 0);
      j += 1;
    }

    let codeTime = 0;
    let seen = 0;
    for (let k = j; k < kinds.length && seen < LOOKAHEAD; k++) {
      if (kinds[k] === "code") {
        codeTime = Math.max(codeTime, times[k] ?? 0);
        seen += 1;
      }
    }

    if (seen > 0) {
      blocks += 1;
      if (codeTime - commentTime > threshold) {
        drifted += 1;
      }
    }
    i = j;
  }

  return { blocks, drifted };
}

export function summarizeDrift(files: FileDrift[], years: number): CommentHealth {
  const withBlocks = files.filter((file) => file.blocks > 0);
  return {
    filesChecked: withBlocks.length,
    blocks: withBlocks.reduce((sum, file) => sum + file.blocks, 0),
    drifted: withBlocks.reduce((sum, file) => sum + file.drifted, 0),
    years,
    worst: [...withBlocks]
      .filter((file) => file.drifted > 0)
      .sort(
        (a, b) =>
          b.drifted / b.blocks - a.drifted / a.blocks ||
          b.drifted - a.drifted ||
          a.path.localeCompare(b.path),
      )
      .slice(0, 3),
  };
}
