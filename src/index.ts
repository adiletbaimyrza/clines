export {
  analyze,
  analyzeAgent,
  analyzeCloneChurn,
  analyzeCoupling,
  analyzeComments,
  analyzeComplexity,
  analyzeContext,
  analyzeDuplication,
  analyzeRefactor,
  collectRoledFiles,
  partition,
  summarizeRoles,
} from "./core/pipeline.js";
export type {
  AnalyzeOptions,
  CommentOptions,
  CouplingOptions,
  RefactorOptions,
  RoledFile,
} from "./core/pipeline.js";
export { commitsOf, fileChanges, isBot, parseHistory } from "./core/history.js";
export type { Change, Commit, FileChanges, History } from "./core/history.js";
export { judgeAgentRisk } from "./core/analyzers/agent.js";
export type {
  AgentCandidate,
  AgentInput,
  AgentLimits,
  AgentReport,
  AgentRisk,
  AgentVerdict,
} from "./core/analyzers/agent.js";
export { analyzeCoupling as coupleCommits, DEFAULT_LIMITS } from "./core/analyzers/coupling.js";
export type {
  CoupledFile,
  CouplePair,
  CouplingLimits,
  CouplingResult,
} from "./core/analyzers/coupling.js";
export { estimateTokens } from "./core/tokenizer/tokens.js";
export { linesAnalyzer } from "./core/analyzers/lines.js";
export type { Analyzer } from "./core/analyzers/analyzer.js";
export { tokenize, classifyContent } from "./core/tokenizer/tokenizer.js";
export { getLanguageSyntax, getLanguageName } from "./core/tokenizer/languages.js";
export { collectFiles } from "./core/files/collector.js";
export { getProjectSize } from "./report/format/size-label.js";
export { buildReadmeSection } from "./report/format/table.js";
export { injectReadme } from "./report/reporters/readme.js";
export type { Reporter } from "./report/reporter.js";
export { defaultConfig, parseConfig, resolveConfig, userConfigSchema } from "./config/schema.js";
export { loadConfig, loadGitAttributes, loadGitignoreGlobs } from "./config/load.js";
export { parseUserConfig, ConfigError } from "./config/validate.js";
export type { ConfigIssue } from "./config/validate.js";
export type { Config, UserConfig } from "./config/schema.js";
export { SCHEMA } from "./report/format/json.js";
export {
  renderAgentJson,
  renderCommentsJson,
  renderCouplingJson,
  renderComplexityJson,
  renderContextJson,
  renderCountJson,
  renderDuplicationJson,
  renderRefactorJson,
} from "./report/format/json.js";
export type { Envelope, JsonCommand, JsonMeta } from "./report/format/json.js";
export { blameFile, changedFiles, changeLog, repoState } from "./util/git.js";
export type { Blamer, ChangeReader, DiffReader, RepoState, StateReader } from "./util/git.js";
export type { CommentHealth, CommentOutcome, FileDrift } from "./core/analyzers/comments.js";
export type {
  Clone,
  CloneShape,
  DuplicationResult,
  FileDuplication,
  RankedClone,
} from "./core/analyzers/duplication.js";
export type {
  Limits,
  RefactorCandidate,
  RefactorReport,
  Verdict,
} from "./core/analyzers/refactor.js";
export type {
  ComplexityResult,
  Report,
  LanguageStat,
  FileTokens,
  LineKind,
  LanguageSyntax,
  FileComplexity,
  FileContext,
  DirContext,
  ContextResult,
  Exclusions,
  RoleSummary,
} from "./core/model.js";
