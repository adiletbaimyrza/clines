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

export interface Report {
  totalCode: number;
  totalComment: number;
  totalBlank: number;
  totalLines: number;
  totalFiles: number;
  totalComplexity: number;
  languages: LanguageStat[];
}
