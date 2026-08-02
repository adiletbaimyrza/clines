# clines

![clines](https://img.shields.io/badge/Code%20Lines-Counter-blue)

**clines** is a small, fast CLI that measures your codebase — counting code, comment, and blank lines per language — and can update your `README.md` with the results. It also labels your project by size, from _Meteoroid_ to _Universe_.

It is built with a layered, fully-tested architecture (100% coverage) so it can grow into deeper code-health analysis (duplication and complexity) over time.

## Installation

```sh
npm install --save-dev clines
```

## Usage

Scan the current directory:

```sh
npx clines
```

Scan a specific directory:

```sh
npx clines scan path/to/directory
```

### Options

| Flag              | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `--json`          | Print a machine-readable JSON report to stdout.      |
| `--no-readme`     | Do not update `README.md` (report to the terminal).  |
| `--config <path>` | Use a specific config file instead of `clines.json`. |
| `--version`       | Print the version.                                   |
| `--help`          | Show help.                                           |

Examples:

```sh
npx clines scan . --json --no-readme      # JSON to stdout, README untouched
npx clines scan src --config clines.json  # scan src/ with an explicit config
```

## Example output

```text
Language      Files   Lines   Code   Comments   Blank        %
──────────────────────────────────────────────────────────────
TypeScript       62   3,210  2,510        420     280    78.2%
JavaScript       18     935    720         90     125    22.4%
CSS               6     542    410         40      92    12.8%
──────────────────────────────────────────────────────────────
Total            86   4,687  3,208        550     497   100.0%

Project size: Asteroid ☄️
```

When README updating is enabled, the section between the placeholders is refreshed:

```md
<!-- LINE_COUNT_PLACEHOLDER_1 -->

**Lines of Code:** `707`  
**Project Size:** <span style="color: green;">Meteoroid 🪨</span>

| Language   | Files | Code | Comments | Blank | Total |
| ---------- | ----: | ---: | -------: | ----: | ----: |
| TypeScript |    23 |  707 |      165 |   124 |   996 |
| **Total**  |    23 |  707 |      165 |   124 |   996 |

<!-- LINE_COUNT_PLACEHOLDER_2 -->
```

Place `<!-- LINE_COUNT_PLACEHOLDER_1 -->` and `<!-- LINE_COUNT_PLACEHOLDER_2 -->` anywhere in your `README.md` and `clines` will update the content between them. If the placeholders are absent, the section is appended to the end of the file.

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

`clines` runs a small pipeline: **collect** files (honoring the default ignores, your `clines.json`, and `.gitignore`) → **tokenize** each file with a language-aware lexer that separates code, comments, and blanks → **analyze** into per-language and project totals → **report** to the console, JSON, or your README. The tokenizer and analyzers are pure and independently unit-tested.

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
