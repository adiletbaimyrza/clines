import type { CommentOutcome, CommentHealth } from "../../core/analyzers/comments.js";
import type { Clone, DuplicationResult } from "../../core/analyzers/duplication.js";
import type { AgentReport } from "../../core/analyzers/agent.js";
import type { CouplingResult } from "../../core/analyzers/coupling.js";
import type { RefactorReport } from "../../core/analyzers/refactor.js";
import type { ComplexityResult, ContextResult, Report } from "../../core/model.js";
import { budgetTiers, type BudgetTier } from "./context.js";
import { rankComplexity, type ComplexitySort } from "./complexity.js";

export const SCHEMA = 1;

export type JsonCommand =
  "count" | "dup" | "cx" | "ctx" | "comments" | "refactor" | "coupling" | "agent";

export type Unavailable = "no-git" | "no-comments";

export interface Envelope<T> {
  schema: number;
  tool: "clines";
  version: string;
  command: JsonCommand;
  root: string;
  result: T | null;
  unavailable?: Unavailable;
}

export interface JsonContext extends ContextResult {
  window: number;
  budget: number;
  tiers: BudgetTier[];
}

export type JsonClone = Omit<Clone, "code">;

export interface JsonDuplication extends Omit<DuplicationResult, "clones"> {
  clones: JsonClone[];
  churn?: Record<string, number>;
}

export interface JsonMeta {
  version?: string;
  root: string;
}

function envelope<T>(
  command: JsonCommand,
  meta: JsonMeta,
  result: T | null,
  unavailable?: Unavailable,
): string {
  const payload: Envelope<T> = {
    schema: SCHEMA,
    tool: "clines",
    version: meta.version ?? "0.0.0",
    command,
    root: meta.root,
    result,
    ...(unavailable === undefined ? {} : { unavailable }),
  };
  return JSON.stringify(payload, null, 2);
}

export function renderCountJson(result: Report, meta: JsonMeta): string {
  return envelope("count", meta, result);
}

// Snippets are dropped: fragments carry the location, and --html still has them.
export function renderDuplicationJson(
  result: DuplicationResult,
  meta: JsonMeta,
  churn?: Map<string, number>,
): string {
  const clones = result.clones.map(({ lineCount, fragments }) => ({ lineCount, fragments }));
  return envelope<JsonDuplication>("dup", meta, {
    ...result,
    clones,
    ...(churn === undefined ? {} : { churn: Object.fromEntries(churn) }),
  });
}

export interface ComplexityJsonOptions {
  sort: ComplexitySort;
  minLines: number;
}

export function renderComplexityJson(
  result: ComplexityResult,
  meta: JsonMeta,
  options: ComplexityJsonOptions,
): string {
  const files = rankComplexity(result.files, options.sort, options.minLines);
  return envelope("cx", meta, { ...result, files });
}

export interface ContextJsonOptions {
  window: number;
  budget: number;
}

export function renderContextJson(
  result: ContextResult,
  meta: JsonMeta,
  options: ContextJsonOptions,
): string {
  return envelope<JsonContext>("ctx", meta, {
    ...result,
    window: options.window,
    budget: options.budget,
    tiers: budgetTiers(result, options.budget),
  });
}

export function renderCommentsJson(outcome: CommentOutcome, meta: JsonMeta): string {
  if (outcome.status === "ok") {
    return envelope<CommentHealth>("comments", meta, outcome.health);
  }
  return envelope<CommentHealth>(
    "comments",
    meta,
    null,
    outcome.status === "no-comments" ? "no-comments" : "no-git",
  );
}

export function renderAgentJson(result: AgentReport, meta: JsonMeta): string {
  return envelope("agent", meta, result);
}

export function renderCouplingJson(result: CouplingResult | undefined, meta: JsonMeta): string {
  if (result === undefined) {
    return envelope<CouplingResult>("coupling", meta, null, "no-git");
  }
  return envelope("coupling", meta, result);
}

export function renderRefactorJson(report: RefactorReport | undefined, meta: JsonMeta): string {
  if (report === undefined) {
    return envelope<RefactorReport>("refactor", meta, null, "no-git");
  }
  return envelope("refactor", meta, report);
}
