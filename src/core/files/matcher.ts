import path from "node:path";
import type { Config } from "../../config/schema.js";

export function globToRegExp(glob: string): RegExp {
  let out = "";
  let i = 0;
  while (i < glob.length) {
    const char = glob[i] as string;
    if (char === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 2;
        continue;
      }
      out += "[^/]*";
      i += 1;
      continue;
    }
    if (char === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }
    out += escapeRegExp(char);
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

function escapeRegExp(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

export function isIgnoredDir(name: string, config: Config): boolean {
  return config.ignoreDirs.includes(name);
}

export function isIgnoredFile(
  relativePath: string,
  config: Config,
  extraGlobs: string[] = [],
): boolean {
  const posixPath = toPosix(relativePath);
  const base = posixPath.slice(posixPath.lastIndexOf("/") + 1);

  if (config.ignoreFiles.includes(base)) {
    return true;
  }

  const ext = path.extname(base).toLowerCase();
  if (ext !== "" && config.ignoreExtensions.some((e) => e.toLowerCase() === ext)) {
    return true;
  }

  const globs = [...config.ignoreGlobs, ...extraGlobs];
  return globs.some((glob) => {
    const re = globToRegExp(glob);
    return re.test(posixPath) || re.test(base);
  });
}
