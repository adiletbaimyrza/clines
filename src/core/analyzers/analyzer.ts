import type { FileTokens } from "../model.js";

export interface Analyzer<TResult> {
  readonly name: string;
  analyze(files: FileTokens[]): TResult;
}
