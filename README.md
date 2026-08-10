# clines

[![npm version](https://img.shields.io/npm/v/clines.svg)](https://www.npmjs.com/package/clines)
[![npm downloads](https://img.shields.io/npm/dm/clines.svg)](https://www.npmjs.com/package/clines)
[![CI](https://github.com/adiletbaimyrza/clines/actions/workflows/ci.yml/badge.svg)](https://github.com/adiletbaimyrza/clines/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/clines.svg)](./LICENSE)

`clines` counts lines of code, comments and blanks per language, finds duplicate code, ranks files
by complexity, estimates what a repository costs a language model to read, finds comments the code
has drifted away from, and says which files are worth refactoring. It is a `cloc` alternative with
five additional analyses built in.

It has six commands:

| Command    | Output                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| `count`    | Code, comment and blank lines per language, plus a project size label. |
| `dup`      | Duplicated code blocks and a duplication percentage.                   |
| `cx`       | Files ranked by decision-point complexity.                             |
| `ctx`      | Estimated token cost, with an optional budget check for CI.            |
| `comments` | Comment blocks the code has drifted away from.                         |
| `refactor` | A verdict per file, from how complex it is and how often it changes.   |

`commander` is the only runtime dependency. Test coverage is 100%.

**[📖 Website & docs](https://adiletbaimyrza.github.io/clines/)** · **[clines vs cloc](https://adiletbaimyrza.github.io/clines/compare/cloc.html)**

## Installation

```sh
npm install --save-dev clines
```

## Usage

Count the current directory and print the report to the terminal:

```sh
npx clines count
```

Count a specific directory:

```sh
npx clines count path/to/directory
```

Running `clines` on its own prints a banner with the version and available commands.

### `count` options

`clines count` is read-only by default: it prints the report and does not modify any file.

| Flag              | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `--readme`        | Also write the report into `README.md` (see below).        |
| `--all`           | Include test, generated, vendored and docs files.          |
| `--distribution`  | Add file-size distribution, density and the largest files. |
| `--config <path>` | Use a specific config file instead of `clines.json`.       |
| `--help`          | Show help.                                                 |

Global: `clines -v` (or `-V`, `--version`), `clines --help`.

Output is coloured when it is going to a terminal: bold headings, dim table headers, and
`refactor` verdicts by severity. Set `NO_COLOR` to turn it off, or `FORCE_COLOR` to keep colour
through a pipe. Piped and redirected output is plain by default, so `clines … > file` is unchanged.

Examples:

```sh
npx clines count                      # report to the terminal
npx clines count src --config c.json  # count src/ with an explicit config
npx clines count --readme             # report + update README.md
npx clines count --distribution       # + distribution and the largest files
```

### What gets counted

By default `clines` reports on **source files only**. Every file is classified into one role:

| Role        | Detected by                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `source`    | anything not matched below                                                                                                                 |
| `test`      | `__tests__/`, `test/`, `spec/`, `fixtures/`, `benchmarks/`, `*.test.*`, `*.spec.*`                                                         |
| `generated` | `linguist-generated` in `.gitattributes`, a `@generated` or `DO NOT EDIT` header, `*.min.*`, `*.generated.*`, and clines' own HTML reports |
| `vendored`  | `linguist-vendored`, `vendor/`, `third_party/`, `flow-typed/`                                                                              |
| `docs`      | `linguist-documentation`, `docs/`, `.md`, `.txt`, `.rst`                                                                                   |

Comments are recognised per language, including block comments that span lines. In Python,
`"""` and `'''` blocks count as comments, which is what `cloc` does and what PEP 257 docstrings
are for — on `pallets/flask` that is 3,662 comment lines rather than 784.

Non-source files are excluded from headline figures and named underneath:

```text
Excluded 4,892 files: 4,699 test · 20 generated · 13 vendored · 160 docs   (--all to include)
```

`--all` restores the pre-4.0 behaviour of counting everything. `count` always prints a per-role
breakdown and a test-to-source ratio regardless.

clines recognises its own HTML reports, so writing one into the repository you are measuring does
not change the next measurement. Left unhandled this is a real trap: a `dup --html dup.html` report
of the react repository is 1.2 MB, which added 11,403 phantom code lines to the following run.

Roles can be overridden in `clines.json`, which takes precedence over every heuristic:

```json
{
  "roles": {
    "source": ["fixtures/golden/**"],
    "test": ["e2e/**"],
    "generated": ["src/schema.ts"]
  }
}
```

This matters more than it sounds. On `facebook/react`, tests, fixtures and generated files account
for 59% of the estimated token cost and 72% of all duplicated lines — so the pre-4.0 headline
duplication figure of 43.5% was mostly test code.

### Finding duplicate code

`clines dup` reports a duplication percentage and the most duplicated files. Detection uses maximal-block clone matching over code lines and ignores whitespace differences.

```sh
npx clines dup                          # terminal summary
npx clines dup --min-lines 8            # only flag larger clones
npx clines dup --min-copies 3           # only blocks duplicated 3+ times
npx clines dup --cross-file             # ignore duplication inside a single file
npx clines dup --renamed                # also count clones that differ only in names
npx clines dup --churn                  # show when each clone was last touched
npx clines dup --top 25                 # list more groups and files
npx clines dup --html dup-report.html   # + an HTML report
```

Every run opens with the shape of the duplication and the groups worth refactoring:

```text
Duplication shape
  5,397 clone groups   ·   91,157 lines removable if each were deduped once
  Size       81% under 10 lines   ·   median 6   ·   largest 350
  Location   60% within one file   ·   20% across packages   ·   14% same directory
  Spread     top 10 groups hold 5% of what is removable — duplication is diffuse

Biggest refactor opportunities
  Where                                                          Lines   Copies   Removable
  compiler/crates/react_compiler_ast/src/visitor.rs  +82             5      147         730
  packages/react-server-dom-esm/src/ReactFlightESMNodeLoader.js  +2  350        3         700
```

A single percentage implies a fixable problem. On react the top ten groups account for 5% of what
could be removed, so no small set of refactors moves the number — that is worth knowing before
anyone is asked to act on 28.4%. Equally, 60% of the clones sit inside one file, which is repeated
branches rather than a missing module. `--cross-file` drops those.

The ranking is by **removable lines** (`lines × (copies − 1)`), which is the actionable unit. It
separates two very different findings that a file-based ranking blurs together: a 5-line pattern
repeated 147 times across 83 files is a missing abstraction, while a 350-line block copied three
times is a missing module.

`--renamed` runs a second pass with identifiers masked, catching clones that differ only in naming
(type-2). `--churn` uses `git blame` to show when each clone was last touched — research finds
clones are [not universally harmful](https://link.springer.com/article/10.1007/s10664-008-9076-6)
and that under 15% of defects relate to cloned code; the ones that cost you are those whose copies
keep being edited together.

```text
Duplication: 4.2%   1,240 duplicated lines   ·   12 clones

Most duplicated files
  File                 Dup lines   % of file
  src/legacy/api.ts          220         64%
  src/legacy/api.old.ts      220         71%

Excluded 128 files: 121 test · 7 docs   (--all to include)

Run with `--html <file>` for a full browsable report with code snippets.
```

`--html` writes a self-contained report with headline stats, a most-duplicated-files table, and a searchable list of clones showing each snippet and every location.

### Ranking files by complexity

`clines complexity` (alias `cx`) ranks files by decision-point count. The terminal output lists the top 20; `--html` writes the top 100, adjustable with `--top`. The HTML report contains the ranking only, without code snippets.

```sh
npx clines cx                                 # terminal summary (top 20)
npx clines cx --explain                       # + the branch/loop/boolean breakdown
npx clines cx --sort density --min-lines 200  # rank by density, ignoring small files
npx clines cx --html cx-report.html           # + an HTML report of the full ranking
```

```text
Complexity: 40,872 total   ·   1,159 files with complexity

Most complex files
  File                                            Complexity   Cx/100   Densest    Code
  packages/react-devtools-shared/…/renderer.js         1,292     19.9        2%   6,487
  packages/react-dom-bindings/…/ReactFizzConfigDOM.js  1,102     18.6        3%   5,929
```

Raw complexity mostly tracks file size, so two extra columns give it meaning.

**`Cx/100`** is complexity per 100 code lines — whether a file is complex or merely large. In
bootstrap `dropdown.js` and `tooltip.js` both score 59, but one runs at 17.9 and the other at 12.5.

**`Densest`** is the share of the file's complexity that falls in its worst 40 lines, which
separates two situations needing opposite responses. `renderer.js` concentrates 2% of its
complexity in any one stretch — it is uniformly complex across 6,487 lines and wants decomposition,
not a local fix. `dropdown.js` concentrates 29%, so there is somewhere specific to look.

`--explain` adds the split between branching, loops and boolean operators:

```text
  File                          Complexity   Cx/100   Densest   Code   Branch   Loop   Bool
  js/src/dropdown.js                    59     17.9       29%    329      58%     5%    37%
  js/src/dom/event-handler.js           47     19.5       26%    241      45%    13%    43%
  js/src/carousel.js                    45     13.4       20%    335      73%     4%    22%
```

Files with similar scores can be hard for different reasons. A 73%-branch file often wants a lookup
table; a 43%-boolean file usually wants its predicates named. The columns are deliberately raw
numbers rather than a one-word verdict — see below.

**On what this cannot tell you.** For files above a few thousand lines the honest answer to "why is
this complex" is "all of it, everywhere": react's largest files are deep, branchy, loopy and dense
at once, and no single 40-line stretch holds more than 4% of the total. Attributing complexity to a
cause needs function boundaries, which needs a parser clines does not have. `cx` will tell you that
such a file needs splitting, not where to cut it.

### Measuring context cost

`clines context` (alias `ctx`) estimates how many tokens a language model reads for the whole tree. It reports the total against a context window, the split between code and comment tokens, and a breakdown per file and per top-level directory.

```sh
npx clines ctx                          # terminal summary against a 200k window
npx clines ctx --window 1m              # compare against a 1M-token window
npx clines ctx --max 200k               # exit non-zero if the total exceeds the budget
npx clines ctx --html ctx-report.html   # + an HTML report of the full ranking
```

```text
Context: 3,303,084 tokens   ·   330.3% of a 1,000,000-token window   ·   19% comments

Largest directories
  Directory     Tokens   Files
  packages   1,904,551     893
  compiler   1,201,364   1,003

Biggest files
  File                                                        Tokens     Code   Comments
  packages/react-devtools-shared/src/backend/fiber/renderer.js 64,222   48,348     15,874
  compiler/crates/react_compiler_lowering/src/build_hir.rs      59,223   52,970      6,253

Run with `--html <file>` for a full browsable report.
```

`--max` sets a budget. The command exits with status 1 once the total exceeds it, which makes it usable as a CI check.

### Accuracy of the token estimate

`clines` has no tokenizer dependency, so token counts are an estimate rather than a `tiktoken` call. Measured against GPT-4o's tokenizer:

| Corpus                                           | Total error | Per-file median |
| ------------------------------------------------ | ----------: | --------------: |
| Mixed calibration set (2,943 files, 5.1M tokens) |       +0.3% |           10.3% |
| `facebook/react` (6,915 files, 8.3M tokens)      |       +5.2% |               — |

The estimate runs a few percent high on JavaScript and TypeScript, and low on Markdown and JSON. The near-zero figure on the mixed set is those two biases cancelling out, not a general guarantee. Generated and minified files are the worst case: react's 3.7 MB `report.html` is +17.9% on its own. Treat totals as accurate to within about ±10%, suitable for ranking and budgeting rather than billing.

### Finding comments the code moved away from

`clines comments` (alias `cm`) compares, per comment block, when the comment was last touched
against when the code beneath it was last touched, using `git blame`.

```sh
npx clines comments             # the 50 most commented files, 3-year threshold
npx clines comments --years 1   # treat a one-year gap as suspect
npx clines comments --scan 200  # blame more files (slower)
npx clines comments --top 50    # list more files in the terminal
```

```text
Comment drift: 13% of comment blocks describe code that changed later
  1,027 of 8,066 blocks across 50 files   ·   3-year threshold

Most drifted files
  File                                                            Drifted   Blocks     %
  packages/eslint-plugin-react-hooks/src/rules/ExhaustiveDeps.ts       94      150   63%
  packages/eslint-plugin-react-hooks/src/rules/RulesOfHooks.ts         36       73   49%
```

This matters because language models
[treat comments as authoritative](https://arxiv.org/pdf/2512.16790) and do not separate them from
the code. Incorrect comments measurably degrade model output, while _missing_ comments barely
matter — so a stale comment is worse than no comment.

It is a suspicion signal, not proof: a comment describing unchanged intent can legitimately outlive
edits below it. Only the most-commented files are checked, because `git blame` is slow — react
takes about eight seconds. Requires a git repository with tracked files.

### Deciding what to refactor

Complexity on its own is a poor priority list: it ranks a file you never open above one you edit
every week. `clines refactor` (alias `rf`) reads `git log --name-only` once, joins the change count
to complexity density and token cost, and returns a verdict per file.

```sh
npx clines refactor                      # last 2 years
npx clines refactor --since '6 months'   # a shorter window
npx clines refactor --price 3            # cost the re-reads at $3 per million tokens
npx clines refactor --top 50             # list more files
```

```text
Refactor: 1,113 files weighed against 2,367 commits since 2 years ago

Judged against this repo: changed often means 3+ changes, dense means 16.7 cx per 100 lines, costly
means 2,420 tokens.

  refactor     122 files   complex and changed often — you pay for this repeatedly
  split        162 files   expensive to read and changed often, though the logic is simple
  watch        257 files   changed often but cheap to read
  quiet        322 files   rarely touched
  inert        250 files   untouched in this window — leave it alone

Ranked by what re-reading them has cost, in tokens
  File                                        Verdict   Changes   Cx/100   Tokens   Re-read     Cost
  packages/react-…ackend/fiber/renderer.js   refactor       151     20.0      64k      9.6M   $28.83
  packages/react-…src/ReactFlightServer.js   refactor       134     17.3      56k      7.5M   $22.41
  packages/react-…t/ReactFiberConfigDOM.js   refactor       114     16.7      54k      6.1M   $18.39
```

`Re-read` is tokens × changes: what reading that file for every change to it has cost so far, and
what it will keep costing. On react, 250 of the 1,113 files with any complexity did not change at
all in two years — a complexity ranking puts many of them near the top, and this one drops them to
the bottom where they belong.

The thresholds are quantiles of the repository itself, not fixed numbers: `dense` and `costly` are
the 75th percentile of density and tokens, and `changed often` is the median change count among
files that changed, floored at 2. Verdicts are therefore relative — every repository has a top
quartile. Requires a git repository.

## Example output

```text
Language      Files   Lines   Code   Comments   Blank   Complexity        %
──────────────────────────────────────────────────────────────────────────
TypeScript       62   3,210  2,510        420     280          312    78.2%
JavaScript       18     935    720         90     125           88    22.4%
CSS               6     542    410         40      92            0    12.8%
──────────────────────────────────────────────────────────────────────────
Total            86   4,687  3,208        550     497          400   100.0%

Project size: Asteroid ☄️
```

#### `--distribution`

The table reports totals, which answer "how much" and nothing else. `--distribution` (or `--dist`)
adds the shape of the codebase underneath, without changing the table:

```text
File size in code lines, and density per language
  Language     Median     p90     Max   Cx/100   Comments
  JavaScript       33     292   6,487     13.2        15%
  Rust            257   1,417   6,662      7.9         9%
  TypeScript      118     666   4,176     13.9        15%

Largest files
  File                                                            Code   Comments   Cx/100
  compiler/crates/react_compiler_lowering/src/build_hir.rs       6,662        436      5.0
  packages/react-devtools-shared/src/backend/fiber/renderer.js   6,487      1,078     19.9
  packages/react-dom-bindings/src/server/ReactFizzConfigDOM.js   5,929        812     18.6

Concentration: the largest 101 files (5%) hold 49% of all code. Median file is 40 code lines,
  p90 is 355.
```

The file list is the actionable half. `Cx/100` separates files that are merely long from files that
are hard: `build_hir.rs` is the biggest file in react at 6,662 lines but scores 5.0, while
`ReactFiberCommitWork.js` is smaller at 4,457 lines and scores 21.9.

That is a different picture of react than `Total 341,054`: the median source file is 40 lines, and
5% of the files hold half the code. Research on defect rates points at
[file size distribution rather than totals](https://codescene.com/blog/code-biomarkers/), and notes
that averages hide exactly the large files that carry the risk.

`Cx/100` is complexity per 100 code lines. The raw Complexity column is not comparable between
languages, because it mostly tracks volume — normalised, JavaScript runs at 13.2 and Rust at 7.9.

The Complexity column is a decision-point count, following the approach used by `scc`: occurrences of branch and loop keywords (`if`, `for`, `while`, `case`, `catch`, …) and logical operators (`&&`, `||`), counted per language with comments and string contents excluded.

When README updating is enabled, the section between the placeholders is refreshed:

```md
<!-- clines · code metrics · auto-generated, do not edit ─────────────────── -->

**Lines of Code:** `707`  
**Project Size:** <span style="color: green;">Meteoroid 🪨</span>

| Language   | Files | Code | Comments | Blank | Complexity | Total |
| ---------- | ----: | ---: | -------: | ----: | ---------: | ----: |
| TypeScript |    23 |  707 |      165 |   124 |         96 |   996 |
| **Total**  |    23 |  707 |      165 |   124 |         96 |   996 |

<!-- clines · end ────────────────────────────────────────────────────────── -->
```

Place the `clines · code metrics` and `clines · end` marker comments anywhere in `README.md`, and `clines count --readme` updates the content between them. If the markers are absent, the section is appended to the end of the file.

## Configuration

Configuration is optional and `clines` never writes a config file to the repo. By default it:

- ignores common non-code directories (`node_modules`, `dist`, `build`, `coverage`, `.git`, `.idea`, `.vscode`, `public`, `static`, …),
- ignores lockfiles, manifests, and binary and asset extensions (`.png`, `.jpg`, `.log`, `.csv`, …), and
- respects `.gitignore`, so anything git ignores is not counted.

To change the defaults, add `clines.json` to the project root. Entries are layered onto the defaults as additions (`ignore`) or removals (`unignore`):

```json
{
  "ignore": {
    "dirs": ["fixtures", "vendor"],
    "files": ["CHANGELOG.md"],
    "extensions": [".snap"],
    "globs": ["**/*.min.js"]
  },
  "unignore": {
    "dirs": ["public"],
    "files": ["package.json"]
  },
  "respectGitignore": true
}
```

- `ignore` adds entries to skip. `dirs` and `files` match by exact name, `extensions` include the leading dot, and `globs` are matched against the path (for example `"*.min.js"` or `"test/fixtures/**"`).
- `unignore` removes entries from the defaults so they are counted, for example `package.json` or a `public/` directory.
- `respectGitignore` defaults to `true`. Set it to `false` to stop honoring `.gitignore`.

Every field is optional. The file is validated on load, and mistakes are reported in place:

```text
Invalid config in /repo/clines.json:
  Unknown key "ignor" — did you mean "ignore"?
```

## How it works

The pipeline has four stages. It collects files, applying the default ignores, `clines.json`, and `.gitignore`; tokenizes each file with a language-aware lexer that classifies every line as code, comment, or blank; analyzes the result into per-language and project totals; and reports to the console, and to the README when asked. The tokenizer and analyzers are pure functions and are unit-tested separately.

## Project size labels

| Lines of Code   | Project Size Label |
| --------------- | ------------------ |
| < 1,000         | Meteoroid 🪨       |
| 1,000–10,000    | Asteroid ☄️        |
| 10,000–50,000   | Moon 🌑            |
| 50,000–100,000  | Planet 🪐          |
| 100,000–500,000 | Star ⭐            |
| 500,000–1M      | Solar System ☀️    |
| 1M–5M           | Galaxy 🌌          |
| 5M+             | Universe 🌠        |

## Development

```sh
npm install
npm test            # run the test suite
npm run coverage    # enforce 100% coverage
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
```

## Releasing

Publishing uses npm trusted publishing (OIDC, tokenless) together with staged publishing:

1. Bump the version in `package.json` and merge to `master`. CI stages the version to npm's staging queue, where it is not yet public.
2. Test the staged artifact: `npm run stage:list`, then `npm stage download <stage-id>`, then install the `.tgz` and run it.
3. Deploy manually, which requires 2FA: approve on npmjs.com, or run `npm run deploy -- <stage-id>` (equivalent to `npm stage approve`).

## License

MIT License © 2025 Adilet Baimyrza Uulu
