import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NPM = ["--yes", "npm@latest", "stage"];

const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));

function firstUuid(node) {
  if (typeof node === "string") {
    return UUID.test(node) ? node : undefined;
  }
  if (node === null || typeof node !== "object") {
    return undefined;
  }
  for (const value of Object.values(node)) {
    const found = firstUuid(value);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function findStageId(data, version) {
  const found = [];
  const walk = (node) => {
    if (node === null || typeof node !== "object") {
      return;
    }
    if (!Array.isArray(node) && Object.values(node).includes(version)) {
      const id = firstUuid(node);
      if (id !== undefined) {
        found.push(id);
      }
    }
    for (const value of Object.values(node)) {
      walk(value);
    }
  };
  walk(data);
  return found[0];
}

export function parseStageText(text, version) {
  for (const block of text.split(/\n\s*\n/)) {
    const id = /^\s*(?:stage[- ]?)?id:\s*(\S+)/im.exec(block);
    const ver = /^\s*version:\s*(\S+)/im.exec(block);
    if (id !== null && ver !== null && ver[1] === version && UUID.test(id[1])) {
      return id[1];
    }
  }
  return undefined;
}

function run(args) {
  return execFileSync("npx", [...NPM, ...args], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
}

function main() {
  const explicit = process.argv[2];
  if (explicit !== undefined) {
    if (!UUID.test(explicit)) {
      console.error(`Not a stage id: ${explicit}`);
      process.exitCode = 1;
      return;
    }
    console.error(`Approving ${name}@${version} as ${explicit}`);
    execFileSync("npx", [...NPM, "approve", explicit], { stdio: "inherit" });
    return;
  }

  let id;
  try {
    id = findStageId(JSON.parse(run(["list", name, "--json"])), version);
  } catch {
    id = undefined;
  }
  if (id === undefined) {
    try {
      id = parseStageText(run(["list", name]), version);
    } catch {
      id = undefined;
    }
  }

  if (id === undefined) {
    console.error(
      `No staged ${name}@${version} found. Run \`npm run stage:list\` and pass the id:\n` +
        `  npm run deploy -- <stage-id>`,
    );
    process.exitCode = 1;
    return;
  }

  console.error(`Approving ${name}@${version} as ${id}`);
  execFileSync("npx", [...NPM, "approve", id], { stdio: "inherit" });
}

if (process.argv[1]?.endsWith("approve.mjs")) {
  main();
}
