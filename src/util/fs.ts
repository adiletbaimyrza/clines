import { promises as fs, type Dirent } from "node:fs";

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, "utf8");
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function readEntries(dir: string): Promise<Dirent[]> {
  return fs.readdir(dir, { withFileTypes: true });
}
