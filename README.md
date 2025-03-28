# clines

![clines](https://img.shields.io/badge/Code%20Lines-Counter-blue)

**clines** is a simple CLI tool that counts the number of lines of code in your project and updates your `README.md` with the results. It also categorizes your project based on its size.

## Installation

Install globally via npm:

```sh
npm install -g clines
```

Or use it locally in a project:

```sh
npm install --save-dev clines
```

## Usage

Run the command in your project's root directory:

```sh
npx clines
```

Or if installed globally:

```sh
clines
```

You can also specify a directory:

```sh
clines path/to/directory
```

## Configuration

You can create a `clines.json` file in the root of your project to exclude specific files or directories:

```json
{
  "ignoreFiles": [".json", ".lock"],
  "ignoreDirs": ["node_modules", "dist"]
}
```

## How It Works

- Recursively counts lines of code in the specified directory.
- Ignores files and directories defined in `clines.json`.
- Updates `README.md` with the total line count inside the placeholders:

  ```md
  <!-- LINE_COUNT_PLACEHOLDER_1 -->

  Lines of Code: **12345**  
  Project Size: **Well-structured project ⚙️**

  <!-- LINE_COUNT_PLACEHOLDER_2 -->
  ```

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

MIT License © 2025 Adilet
