import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export class TempProject {
  readonly root: string;

  constructor() {
    this.root = mkdtempSync(path.join(tmpdir(), "clines-test-"));
  }

  file(relativePath: string, content: string): string {
    const abs = path.join(this.root, relativePath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
    return abs;
  }

  symlink(relativePath: string, target: string): void {
    const abs = path.join(this.root, relativePath);
    mkdirSync(path.dirname(abs), { recursive: true });
    symlinkSync(target, abs);
  }

  path(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  cleanup(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

export function captureIO() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (m: string) => out.push(m), err: (m: string) => err.push(m) },
    out,
    err,
  };
}
