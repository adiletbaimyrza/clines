# clines

![clines](https://img.shields.io/badge/Code%20Lines-Counter-blue)

**clines** is a small, fast CLI that measures your codebase — counting code, comment, and blank lines per language — and can update your `README.md` with the results. It also labels your project by size, from _Meteoroid_ to _Universe_.

Beyond counting, it finds **duplicate code** (`dup`), ranks your **complexity hotspots** (`cx`), and estimates what the repo costs an **AI agent to read** (`ctx`) — with a CI gate for the token budget. Zero runtime dependencies beyond the CLI parser, 100% test coverage.

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

`clines count` is **read-only by default** — it prints the report and touches nothing.

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

`clines dup` reports the duplication percentage and the most duplicated files, and can write a **browsable HTML report** with the actual duplicated code snippets. It uses maximal-block clone detection over your code lines (whitespace-insensitive).

```sh
npx clines dup                          # terminal summary
npx clines dup --min-lines 8            # only flag larger clones
npx clines dup --min-copies 3           # only blocks duplicated 3+ times
npx clines dup --html dup-report.html   # + a browsable HTML report (opens in your browser)
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

The HTML report shows headline stats, a most-duplicated-files table, and a searchable list of clones with their code snippets and every location.

### Ranking files by complexity

`clines complexity` (alias `cx`) ranks every file by its decision-point count — your complexity hotspots. It prints the worst offenders and can write a **browsable HTML report** listing the top files (no code snippets, just the ranking).

```sh
npx clines cx                           # terminal summary (top 20)
npx clines cx --html cx-report.html     # + a browsable HTML report of the top 100 (opens in your browser)
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

`clines context` (alias `ctx`) estimates what your codebase costs an **AI agent** to read: how many tokens it is, how much of a model's context window that fills, and which files eat the budget. Unhealthy, oversized code is measurably more expensive for agents to work on — this is the number you pay for.

```sh
npx clines ctx                          # terminal summary against a 200k window
npx clines ctx --window 1m              # compare against a 1M-token window
npx clines ctx --max 200k               # exit non-zero if the repo blows the budget (CI gate)
npx clines ctx --html ctx-report.html   # + a browsable HTML report (opens in your browser)
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

`--max` makes this a CI gate: `clines ctx --max 200k` fails the build once the repo no longer fits a 200k-token window.

**On accuracy.** clines ships with zero runtime tokenizer dependencies, so token counts are an _estimate_, not a `tiktoken` call. The estimator was calibrated against GPT-4o's tokenizer over 2,943 files / 5.1M real tokens: repo-level totals land within **~1%**, and individual files have a **median error of ~10%** (p90 ~20%). Prose-heavy Markdown and JSON skew low; source files are the most accurate. Use it for ranking and budgeting, not for billing.

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

The **Complexity** column is a fast decision-point count (à la `scc`): occurrences of branch/loop keywords (`if`, `for`, `while`, `case`, `catch`, …) and logical operators (`&&`, `||`), counted per language while ignoring comments and strings.

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

Place the `clines · code metrics` and `clines · end` marker comments anywhere in your `README.md` and `clines count --readme` will update the content between them. If the markers are absent, the section is appended to the end of the file.

## Configuration

**No configuration is required** — `clines` works out of the box and never writes a file to your repo. By default it:

- ignores common non-code directories (`node_modules`, `dist`, `build`, `coverage`, `.git`, `.idea`, `.vscode`, `public`, `static`, …),
- ignores lockfiles/manifests and binary/asset extensions (`.png`, `.jpg`, `.log`, `.csv`, …), and
- **respects your `.gitignore`** — anything git ignores is not counted.

To customize, add an optional `clines.json` to your project root. It uses an **add / remove** model layered on the defaults, so you only specify your changes — for both directories and files:

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

- **`ignore`** — add more things to skip. `dirs` and `files` match by exact name; `extensions` include the leading dot; `globs` are matched against the path (e.g. `"*.min.js"`, `"test/fixtures/**"`).
- **`unignore`** — remove entries from the defaults so they _are_ counted (e.g. start counting `package.json` or your `public/` directory).
- **`respectGitignore`** — set to `false` to stop honoring `.gitignore` (default `true`).

Every field is optional. The file is validated on load; unknown keys or wrong types produce a clear error.

## How it works

`clines` runs a small pipeline: **collect** files (honoring the default ignores, your `clines.json`, and `.gitignore`) → **tokenize** each file with a language-aware lexer that separates code, comments, and blanks → **analyze** into per-language and project totals → **report** to the console (and optionally your README). The tokenizer and analyzers are pure and independently unit-tested.

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

Publishing uses npm **trusted publishing** (OIDC, tokenless) with **staged publishing**:

1. Bump the version in `package.json` and merge to `master`. CI **stages** the version to npm's staging queue — it is not public yet.
2. Test the exact staged artifact: `npm run stage:list` → `npm stage download <stage-id>` → install the `.tgz` and run it.
3. Deploy manually (requires your 2FA): approve on npmjs.com, or `npm run deploy -- <stage-id>` (= `npm stage approve`).

## License

MIT License © 2025 Adilet Baimyrza Uulu
