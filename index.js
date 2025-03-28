#!/usr/bin/env node

import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "clines.json");
let config = {
  ignoreFiles: [".json", ".lock"],
  ignoreDirs: ["node_modules", "dist"],
};

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
    console.log("README.md not found, skipping update.");
    return;
  }

  const placeholder1 = "<!-- LINE_COUNT_PLACEHOLDER_1 -->";
  const placeholder2 = "<!-- LINE_COUNT_PLACEHOLDER_2 -->";
  let readmeContent = fs.readFileSync(readmePath, "utf8");

  const newLineCountInfo = `
  Lines of Code: **${totalLines}**  
  Project Size: **${getProjectSizeLabel(totalLines)}**
  `;

  if (
    readmeContent.includes(placeholder1) &&
    readmeContent.includes(placeholder2)
  ) {
    readmeContent = readmeContent.replace(
      new RegExp(`${placeholder1}.*?${placeholder2}`, "s"),
      `${placeholder1}\n${newLineCountInfo}\n${placeholder2}`
    );
    console.log("Updated placeholders with new line count information.");
  } else {
    readmeContent += `\n\n${placeholder1}\n${newLineCountInfo}\n${placeholder2}`;
    console.log(
      "Added placeholders with new line count information at the end."
    );
  }

  fs.writeFileSync(readmePath, readmeContent);
  console.log("README.md updated.");
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
      if (config.ignoreFiles.some((ext) => file.name.endsWith(ext))) {
        continue;
      }
      totalLines += await countLines(fullPath);
    }
  }
  return totalLines;
}

async function countLines(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      lineCount += chunk.toString().split("\n").length;
    });
    stream.on("end", () => {
      resolve(lineCount);
    });
    stream.on("error", (err) => {
      console.error(`Error reading file: ${filePath}`, err);
      reject(err);
    });
  });
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
