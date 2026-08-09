# clines

[![npm version](https://img.shields.io/npm/v/clines.svg)](https://www.npmjs.com/package/clines)
[![npm downloads](https://img.shields.io/npm/dm/clines.svg)](https://www.npmjs.com/package/clines)
[![CI](https://github.com/adiletbaimyrza/clines/actions/workflows/ci.yml/badge.svg)](https://github.com/adiletbaimyrza/clines/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/clines.svg)](./LICENSE)

`clines` counts lines of code, comments and blanks per language, finds duplicate code, ranks files
by complexity, and estimates what a repository costs a language model to read. It is a `cloc`
alternative with three additional analyses built in.

It has four commands:

| Command | Output                                                                 |
| ------- | ---------------------------------------------------------------------- |
| `count` | Code, comment and blank lines per language, plus a project size label. |
| `dup`   | Duplicated code blocks and a duplication percentage.                   |
| `cx`    | Files ranked by decision-point complexity.                             |
| `ctx`   | Estimated token cost, with an optional budget check for CI.            |

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
| `--config <path>` | Use a specific config file instead of `clines.json`. |
| `--help`          | Show help.                                           |

Global: `clines --version`, `clines --help`.

Examples:

```sh
npx clines count                      # report to the terminal
npx clines count src --config c.json  # count src/ with an explicit config
npx clines count --readme             # report + update README.md
```

### Finding duplicate code

`clines dup` reports a duplication percentage and the most duplicated files. Detection uses maximal-block clone matching over code lines and ignores whitespace differences.

```sh
npx clines dup                          # terminal summary
npx clines dup --min-lines 8            # only flag larger clones
npx clines dup --min-copies 3           # only blocks duplicated 3+ times
npx clines dup --html dup-report.html   # + an HTML report (opens in your browser)
npx clines dup --html dup-report.html --no-open   # write it without opening
```

```text
Duplication: 4.2%   1,240 of 29,500 code lines   ·   12 clones

Most duplicated files
  File                 Dup lines   % of file
  src/legacy/api.ts          220         64%
  src/legacy/api.old.ts      220         71%

Run with `--html <file>` for a full browsable report with code snippets.
```

`--html` writes a self-contained report with headline stats, a most-duplicated-files table, and a searchable list of clones showing each snippet and every location.

### Ranking files by complexity

`clines complexity` (alias `cx`) ranks files by decision-point count. The terminal output lists the top 20; `--html` writes the top 100, adjustable with `--top`. The HTML report contains the ranking only, without code snippets.

```sh
npx clines cx                           # terminal summary (top 20)
npx clines cx --html cx-report.html     # + an HTML report of the top 100 (opens in your browser)
npx clines cx --top 250 --html cx-report.html   # rank more files in the report
npx clines cx --html cx-report.html --no-open    # write it without opening
```

```text
Complexity: 51,082 total   ·   2,303 files with complexity

Most complex files
  File                                              Complexity   Code
  packages/react-devtools-shared/.../renderer.js         1,292   6,487
  packages/react-dom-bindings/.../ReactFizzConfigDOM.js  1,102   5,929

Run with `--html <file>` for a full browsable report.
```

### Measuring context cost

`clines context` (alias `ctx`) estimates how many tokens a language model reads for the whole tree. It reports the total against a context window, the split between code and comment tokens, and a breakdown per file and per top-level directory.

```sh
npx clines ctx                          # terminal summary against a 200k window
npx clines ctx --window 1m              # compare against a 1M-token window
npx clines ctx --max 200k               # exit non-zero if the total exceeds the budget
npx clines ctx --html ctx-report.html   # + an HTML report (opens in your browser)
```

```text
Context: 8,776,571 tokens   ·   877.7% of a 1,000,000-token window   ·   11% comments

Largest directories
  Directory     Tokens   Files
  packages   4,230,792   2,068
  compiler   2,370,068   4,169
  fixtures     538,565     421

Biggest files
  File                                                       Tokens        Code   Comments
  report.html                                             1,131,404   1,131,404          0
  fixtures/attribute-behavior/AttributeTableSnapshot.md     227,209     227,209          0
  packages/react-dom/src/__tests__/ReactDOMFloat-test.js     74,455      71,003      3,452

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

Every field is optional. The file is validated on load; unknown keys and wrong types are rejected with an error.

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
