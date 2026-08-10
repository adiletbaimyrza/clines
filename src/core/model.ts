import type { FileRole } from "./files/roles.js";

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
  medianCode: number;
  p90Code: number;
  maxCode: number;
}

export interface Concentration {
  largestFiles: number;
  share: number;
  medianCode: number;
  p90Code: number;
}

export interface RoleSummary {
  role: FileRole;
  files: number;
  code: number;
}

export interface Exclusions {
  files: number;
  roles: RoleSummary[];
}

export interface FileComplexity {
  path: string;
  complexity: number;
  code: number;
  language: string;
}

export interface ComplexityResult {
  files: FileComplexity[];
  excluded: Exclusions;
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

export interface AmbiguousName {
  name: string;
  count: number;
}

export interface Navigability {
  files: number;
  ambiguousFiles: number;
  worstNames: AmbiguousName[];
  medianDepth: number;
  maxDepth: number;
}

export interface ContextResult {
  files: FileContext[];
  dirs: DirContext[];
  totalTokens: number;
  codeTokens: number;
  commentTokens: number;
  navigability: Navigability;
  excluded: Exclusions;
}

export interface Report {
  totalCode: number;
  totalComment: number;
  totalBlank: number;
  totalLines: number;
  totalFiles: number;
  totalComplexity: number;
  languages: LanguageStat[];
  concentration: Concentration;
  roles: RoleSummary[];
}
