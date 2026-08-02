# Changelog

All notable changes to **clines**. Each entry links to the pull request that shipped it.

## 3.8.0

- `dup --html` now opens the report in your default browser automatically (OS-agnostic: `open`/`start`/`xdg-open`); use `--no-open` to skip. Also: duplication stats now honor `--min-copies`/`--min-lines`, and the whole-codebase "code lines" figure was dropped from the report (3.7.1–3.7.2). ([#20](https://github.com/adiletbaimyrza/clines/pull/20))

## 3.7.0

- `dup --min-copies <n>`: only report blocks duplicated at least n times. Also: HTML snippets now preserve blank lines, gained a copy button, and highlight reliably (3.6.1). ([#17](https://github.com/adiletbaimyrza/clines/pull/17))

## 3.6.0

- `dup`: collapse sliding-window noise — overlapping shifted fragments in the same file are merged into one span, and pure self-overlapping regions are no longer reported as clones. HTML clone cards are now collapsible (expand for exact lines). Snippets keep their indentation and are syntax-highlighted with highlight.js. ([#15](https://github.com/adiletbaimyrza/clines/pull/15))

## 3.5.0

- `clines dup` redesign: readable terminal summary (most-duplicated-files table) plus a browsable **HTML report** (`--html <file>`) with headline stats and a searchable list of clones showing the duplicated code snippets and every location. ([#13](https://github.com/adiletbaimyrza/clines/pull/13))

## 3.4.0

- New `clines dup` command: line-based duplicate-code detection reporting the duplication percentage and the largest clone blocks with `file:line` locations. ([#12](https://github.com/adiletbaimyrza/clines/pull/12))

## 3.3.3

- Add a static landing site (GitHub Pages) with docs and release history. ([#11](https://github.com/adiletbaimyrza/clines/pull/11))

## 3.3.2

- Replace README markers with elegant 80-char divider comments. ([#10](https://github.com/adiletbaimyrza/clines/pull/10))

## 3.3.1

- Repair `clines help` and enrich CLI help output with examples. ([#9](https://github.com/adiletbaimyrza/clines/pull/9))

## 3.3.0

- Restructure the CLI: `clines count`, colorful banner, read-only by default; `--readme` opts in to writing. Removed `--json` and `--stdout`. ([#8](https://github.com/adiletbaimyrza/clines/pull/8))

## 3.2.0

- Recalibrate the project-size scale to an 8-tier cosmic ladder (Meteoroid → Universe). ([#7](https://github.com/adiletbaimyrza/clines/pull/7))

## 3.1.1

- Split JSX/TSX into their own categories; fix trailing-newline blank overcount (validated against cloc). ([#6](https://github.com/adiletbaimyrza/clines/pull/6))

## 3.1.0

- Readable per-language table with code / comment / blank breakdown and per-language share. ([#5](https://github.com/adiletbaimyrza/clines/pull/5))

## 3.0.1

- Exclude generated files (lockfiles, source maps, snapshots); fold unknown extensions into "Other". ([#4](https://github.com/adiletbaimyrza/clines/pull/4))

## 3.0.0

- TypeScript rewrite with a layered, fully-tested architecture (100% coverage), Commander CLI, and CI/CD. ([#2](https://github.com/adiletbaimyrza/clines/pull/2))

Publishing later moved to npm trusted publishing (OIDC) with staged releases. ([#3](https://github.com/adiletbaimyrza/clines/pull/3))
