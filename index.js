#!/usr/bin/env node

import fs from "fs";
import path from "path";

const extensionStats = {};

const configPath = path.join(process.cwd(), "clines.json");
let config = {
  ignoreFiles: [
    ".log",
    ".gitignore",
    ".csv",
    ".ini",
    ".LICENSE",
    ".gitmodules",
  ],
  ignoreDirs: [
    "node_modules",
    "dist",
    "build",
    "coverage",
    "logs",
    ".git",
    ".idea",
    ".vscode",
    "tmp",
    "out",
    "public",
    "static",
  ],
};

const nonCodeExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".mp3",
  ".mp4",
  ".avi",
  ".mpg",
  ".mov",
  ".svg",
  ".webp",
  ".ico",
];

if (!fs.existsSync(configPath)) {
  console.log(`Config file not found, creating a new one at ${configPath}`);
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Default config file created.");
  } catch (err) {
    console.error(`Error creating config file: ${err}`);
  }
} else {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error(`Error reading config file: ${configPath}`, err);
  }
}

function getProjectSizeLabel(lineCount) {
  const colors = {
    green: '<span style="color: green;">Tiny scriptlet 💡</span>',
    yellow: '<span style="color: yellow;">Compact utility 🛠️</span>',
    blue: '<span style="color: blue;">Growing codebase 🏗️</span>',
    magenta: '<span style="color: magenta;">Well-structured project ⚙️</span>',
    cyan: '<span style="color: cyan;">Robust system 🔬</span>',
    red: '<span style="color: red;">Complex software 🏢</span>',
  };

  if (lineCount < 500) return colors.green;
  if (lineCount < 2000) return colors.yellow;
  if (lineCount < 5000) return colors.blue;
  if (lineCount < 10000) return colors.magenta;
  if (lineCount < 20000) return colors.cyan;
  if (lineCount < 50000) return colors.red;
  return `${colors.red.replace("red", "red")}Massive code empire 🌌</span>`;
}

function updateReadme(totalLines) {
  const readmePath = path.join(process.cwd(), "README.md");
  if (!fs.existsSync(readmePath)) {
    console.log("README.md not found in the root folder, skipping update.");
    return;
  }

  const placeholder1 = "<!-- LINE_COUNT_PLACEHOLDER_1 -->";
  const placeholder2 = "<!-- LINE_COUNT_PLACEHOLDER_2 -->";
  let readmeContent = fs.readFileSync(readmePath, "utf8");

  const projectSize = getProjectSizeLabel(totalLines).replace(/<[^>]+>/g, "");

  const totalFiles = Object.values(extensionStats).reduce(
    (sum, stat) => sum + stat.files,
    0
  );

  const totalLOC = Object.values(extensionStats).reduce(
    (sum, stat) => sum + stat.lines,
    0
  );

  const tableHeader = `| Extension | Files | Effective LOC |
|-----------|--------|----------------:|`;

  const tableBody = Object.entries(extensionStats)
    .sort((a, b) => b[1].lines - a[1].lines)
    .map(([ext, { files, lines }]) => `| \`${ext}\` | ${files} | ${lines} |`)
    .join("\n");

  const totalRow = `| **Total** | **${totalFiles}** | **${totalLOC}** |`;

  const fullTable = `
**Lines of Code:** \`${totalLines}\`  
**Project Size:** ${projectSize}

${tableHeader}
${tableBody}
${totalRow}
`;

  if (
    readmeContent.includes(placeholder1) &&
    readmeContent.includes(placeholder2)
  ) {
    readmeContent = readmeContent.replace(
      new RegExp(`${placeholder1}.*?${placeholder2}`, "s"),
      `${placeholder1}\n${fullTable}\n${placeholder2}`
    );
    console.log("Updated README.md with new line count and extension table.");
  } else {
    readmeContent += `\n\n${placeholder1}\n${fullTable}\n${placeholder2}`;
    console.log("Added line count section with table to README.md.");
  }

  fs.writeFileSync(readmePath, readmeContent);
  console.log("README.md written successfully.");
}

async function traverseAndCountLines(directory) {
  let totalLines = 0;

  if (config.ignoreDirs.includes(path.basename(directory))) {
    return 0;
  }

  const files = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);

    if (file.isDirectory()) {
      totalLines += await traverseAndCountLines(fullPath);
    } else {
      if (
        config.ignoreFiles.some((ext) => file.name.endsWith(ext)) ||
        nonCodeExtensions.some((ext) => file.name.endsWith(ext))
      ) {
        continue;
      }
      const lineCount = await countLines(fullPath);
      totalLines += lineCount;

      const ext = path.extname(file.name) || "no_ext";
      if (!extensionStats[ext]) {
        extensionStats[ext] = { files: 0, lines: 0 };
      }
      extensionStats[ext].files++;
      extensionStats[ext].lines += lineCount;
    }
  }
  return totalLines;
}

async function countLines(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    const ext = path.extname(filePath);
    const lines = content.split(/\r?\n/);
    const lang = getFileLanguage(ext);

    let inBlockComment = false;
    let relevantLines = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (lang.blockCommentStart && line.includes(lang.blockCommentStart)) {
        inBlockComment = true;
      }
      if (inBlockComment) {
        if (line.includes(lang.blockCommentEnd)) {
          inBlockComment = false;
        }
        continue;
      }

      if (lang.singleComment && line.startsWith(lang.singleComment)) continue;

      relevantLines++;
    }

    return relevantLines;
  } catch (err) {
    console.error(`Error processing file: ${filePath}`, err);
    return 0;
  }
}

function getFileLanguage(ext) {
  const commentStyles = {
    ".js": {
      singleComment: "//",
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
    },
    ".ts": {
      singleComment: "//",
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
    },
    ".jsx": {
      singleComment: "//",
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
    },
    ".tsx": {
      singleComment: "//",
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
    },
    ".py": { singleComment: "#" },
    ".sh": { singleComment: "#" },
    ".html": { blockCommentStart: "<!--", blockCommentEnd: "-->" },
    ".css": { blockCommentStart: "/*", blockCommentEnd: "*/" },
    ".json": {},
    ".yml": { singleComment: "#" },
    ".yaml": { singleComment: "#" },
  };

  return commentStyles[ext] || {};
}

(async () => {
  const rootDir = process.argv[2] || ".";
  try {
    const totalLines = await traverseAndCountLines(rootDir);
    const projectSize = getProjectSizeLabel(totalLines);
    updateReadme(totalLines);
  } catch (err) {
    console.error("Error:", err);
  }
})();
