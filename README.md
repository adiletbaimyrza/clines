# clines

[![npm version](https://img.shields.io/npm/v/clines.svg)](https://www.npmjs.com/package/clines)
[![npm downloads](https://img.shields.io/npm/dm/clines.svg)](https://www.npmjs.com/package/clines)
[![CI](https://github.com/adiletbaimyrza/clines/actions/workflows/ci.yml/badge.svg)](https://github.com/adiletbaimyrza/clines/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/clines.svg)](./LICENSE)

`clines` counts lines of code, comments and blanks per language, finds duplicate code, ranks files
by complexity, estimates what a repository costs a language model to read, and finds comments the
code has drifted away from. It is a `cloc` alternative with four additional analyses built in.

It has five commands:

| Command    | Output                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| `count`    | Code, comment and blank lines per language, plus a project size label. |
| `dup`      | Duplicated code blocks and a duplication percentage.                   |
| `cx`       | Files ranked by decision-point complexity.                             |
| `ctx`      | Estimated token cost, with an optional budget check for CI.            |
| `comments` | Comment blocks the code has drifted away from.                         |

Runtime dependencies are `commander` and `zod`. Test coverage is 100%.

**[📖 Website & docs](https://adiletbaimyrza.github.io/clines/)**

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

| Flag              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `--readme`        | Also write the report into `README.md` (see below).  |
| `--all`           | Include test, generated, vendored and docs files.    |
| `--config <path>` | Use a specific config file instead of `clines.json`. |
| `--help`          | Show help.                                           |

Global: `clines --version`, `clines --help`.

Examples:

```sh
npx clines count                      # report to the terminal
npx clines count src --config c.json  # count src/ with an explicit config
npx clines count --readme             # report + update README.md
```

### What gets counted

By default `clines` reports on **source files only**. Every file is classified into one role:

| Role        | Detected by                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `source`    | anything not matched below                                                                                   |
| `test`      | `__tests__/`, `test/`, `spec/`, `fixtures/`, `benchmarks/`, `*.test.*`, `*.spec.*`                           |
| `generated` | `linguist-generated` in `.gitattributes`, a `@generated` or `DO NOT EDIT` header, `*.min.*`, `*.generated.*` |
| `vendored`  | `linguist-vendored`, `vendor/`, `third_party/`, `flow-typed/`                                                |
| `docs`      | `linguist-documentation`, `docs/`, `.md`, `.txt`, `.rst`                                                     |

Non-source files are excluded from headline figures and named underneath:

```text
Excluded 4,892 files: 4,699 test · 20 generated · 13 vendored · 160 docs   (--all to include)
```

`--all` restores the pre-4.0 behaviour of counting everything. `count` always prints a per-role
breakdown and a test-to-source ratio regardless.

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
npx clines dup --top 25                 # list more files in the terminal
npx clines dup --html dup-report.html   # + an HTML report
npx clines dup --html d.html --open     # write it and open it in a browser
```

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
