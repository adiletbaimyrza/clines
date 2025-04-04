# clines

![clines](https://img.shields.io/badge/Code%20Lines-Counter-blue)

**clines** is a simple CLI tool that counts the number of lines of code in your project and updates your `README.md` with the results. It also categorizes your project based on its size.

Ever wondered if your project is small or big? Curious about how many lines of code your project currently has? `clines` provides an easy way to measure your codebase and keep track of its growth.

### Example Output in `README.md`

After running `clines`, your `README.md` might look like this:

  
  > Lines of Code: **6999**  
  > Project Size: **<span style="color: magenta;">Well-structured project ⚙️</span>**
  >
  >| Extension | Files | Effective LOC |
  >|-----------|--------|----------------:|
  >| `.ts`     | 62     | 3210           |
  >| `.tsx`    | 41     | 2212           |
  >| `.js`     | 18     | 935            |
  >| `.css`    | 6      | 542            |

  

## Installation

Install locally as a development dependency:

```sh
npm install --save-dev clines
```

## Usage

Run the command in your project's root directory:

```sh
npx clines
```

You can also specify a directory:

```sh
npx clines path/to/directory
```

## Configuration

To customize which files and directories should be excluded from the line count, create a `clines.json` file in the root of your project. If this file does not exist, `clines` will generate one with the following default settings:

```json
{
  "ignoreFiles": [
    ".log", ".gitignore", ".csv", ".ini", ".env", ".LICENSE", ".gitmodules"
  ],
  "ignoreDirs": [
    "node_modules", "dist", "build", "coverage", "logs", ".git", ".idea", ".vscode", "tmp", "out", "public", "static"
  ]
}
```

- `ignoreFiles`: Specifies file extensions that should be ignored.
- `ignoreDirs`: Defines directories that should be excluded from the count.

## How It Works

- Recursively counts lines of code in the specified directory.
- Ignores files and directories based on `clines.json` settings.
- Updates `README.md` with the total line count inside the placeholders:

```md
<!-- LINE_COUNT_PLACEHOLDER_1 -->

**Total Files:** `147`  
**Lines of Code:** `6999`  
**Project Size:** Well-structured project ⚙️

| Extension | Files | Effective LOC |
|-----------|--------|----------------:|
| `.ts`     | 62     | 3210           |
| `.tsx`    | 41     | 2212           |
| `.js`     | 18     | 935            |
| `.css`    | 6      | 542            |

<!-- LINE_COUNT_PLACEHOLDER_2 -->
```

- You can place `<!-- LINE_COUNT_PLACEHOLDER_1 -->` and `<!-- LINE_COUNT_PLACEHOLDER_2 -->` anywhere in your `README.md`, and `clines` will update the content inside them.
- If no placeholders are provided, `clines` will append the line count information at the end of `README.md`.

## Project Size Labels

| Lines of Code | Project Size Label         |
| ------------- | -------------------------- |
| < 500         | Tiny scriptlet 💡          |
| < 2000        | Compact utility 🛠️         |
| < 5000        | Growing codebase 🏗️        |
| < 10000       | Well-structured project ⚙️ |
| < 20000       | Robust system 🔬           |
| < 50000       | Complex software 🏢        |
| 50000+        | Massive code empire 🌌     |

## License

MIT License © 2025 Adilet Baimyrza Uulu
