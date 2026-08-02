import { spawn } from "node:child_process";

export function openInBrowser(target: string): void {
  let command: string;
  let args: string[];
  if (process.platform === "darwin") {
    command = "open";
    args = [target];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", target];
  } else {
    command = "xdg-open";
    args = [target];
  }
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}
