export type LineKind = "code" | "comment" | "blank";

export interface LanguageSyntax {
  singleComment?: string;
  blockCommentStart?: string;
  blockCommentEnd?: string;
}

export interface FileTokens {
  path: string;
  ext: string;
  lineKinds: LineKind[];
  complexity: number;
}

export interface LineCounts {
  code: number;
  comment: number;
  blank: number;
  total: number;
}

export interface LanguageStat extends LineCounts {
  language: string;
  files: number;
  complexity: number;
}

export interface FileComplexity {
  path: string;
  complexity: number;
  code: number;
  language: string;
}

export interface FileContext {
  path: string;
  language: string;
  tokens: number;
  codeTokens: number;
  commentTokens: number;
  lines: number;
}

export interface DirContext {
  dir: string;
  tokens: number;
  files: number;
}

export interface ContextResult {
  files: FileContext[];
  dirs: DirContext[];
  totalTokens: number;
  codeTokens: number;
  commentTokens: number;
}

export interface Report {
  totalCode: number;
  totalComment: number;
  totalBlank: number;
  totalLines: number;
  totalFiles: number;
  totalComplexity: number;
  languages: LanguageStat[];
}
