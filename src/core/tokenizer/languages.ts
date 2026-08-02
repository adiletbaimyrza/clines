import type { LanguageSyntax } from "../model.js";

const LANGUAGES: Record<string, LanguageSyntax> = {
  ".js": cStyle(),
  ".jsx": cStyle(),
  ".mjs": cStyle(),
  ".cjs": cStyle(),
  ".ts": cStyle(),
  ".tsx": cStyle(),
  ".mts": cStyle(),
  ".cts": cStyle(),
  ".java": cStyle(),
  ".c": cStyle(),
  ".h": cStyle(),
  ".cpp": cStyle(),
  ".cc": cStyle(),
  ".hpp": cStyle(),
  ".cs": cStyle(),
  ".go": cStyle(),
  ".rs": cStyle(),
  ".swift": cStyle(),
  ".kt": cStyle(),
  ".kts": cStyle(),
  ".scala": cStyle(),
  ".php": { singleComment: "//", blockCommentStart: "/*", blockCommentEnd: "*/" },
  ".css": { blockCommentStart: "/*", blockCommentEnd: "*/" },
  ".scss": cStyle(),
  ".less": cStyle(),
  ".py": hashStyle(),
  ".rb": hashStyle(),
  ".coffee": hashStyle(),
  ".sh": hashStyle(),
  ".bash": hashStyle(),
  ".zsh": hashStyle(),
  ".yml": hashStyle(),
  ".yaml": hashStyle(),
  ".toml": hashStyle(),
  ".pl": hashStyle(),
  ".r": hashStyle(),
  ".sql": { singleComment: "--", blockCommentStart: "/*", blockCommentEnd: "*/" },
  ".lua": { singleComment: "--", blockCommentStart: "--[[", blockCommentEnd: "]]" },
  ".html": { blockCommentStart: "<!--", blockCommentEnd: "-->" },
  ".xml": { blockCommentStart: "<!--", blockCommentEnd: "-->" },
  ".vue": { blockCommentStart: "<!--", blockCommentEnd: "-->" },
  ".json": {},
};

function cStyle(): LanguageSyntax {
  return { singleComment: "//", blockCommentStart: "/*", blockCommentEnd: "*/" };
}

function hashStyle(): LanguageSyntax {
  return { singleComment: "#" };
}

const LANGUAGE_NAMES: Record<string, string> = {
  ".js": "JavaScript",
  ".jsx": "JSX",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TSX",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
  ".java": "Java",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".go": "Go",
  ".rs": "Rust",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".scala": "Scala",
  ".php": "PHP",
  ".css": "CSS",
  ".scss": "SCSS",
  ".less": "Less",
  ".py": "Python",
  ".rb": "Ruby",
  ".coffee": "CoffeeScript",
  ".sh": "Bash",
  ".bash": "Bash",
  ".zsh": "Zsh",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".toml": "TOML",
  ".pl": "Perl",
  ".r": "R",
  ".sql": "SQL",
  ".lua": "Lua",
  ".html": "HTML",
  ".xml": "XML",
  ".vue": "Vue",
  ".json": "JSON",
  ".md": "Markdown",
  ".markdown": "Markdown",
  ".txt": "Plain Text",
};

export function getLanguageSyntax(ext: string): LanguageSyntax {
  return LANGUAGES[ext.toLowerCase()] ?? {};
}

export function getLanguageName(ext: string): string {
  return LANGUAGE_NAMES[ext.toLowerCase()] ?? "Other";
}
