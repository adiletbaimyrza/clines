function set(name: string): boolean {
  const value = process.env[name];
  return value !== undefined && value !== "" && value !== "0";
}

export function useColor(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (set("NO_COLOR")) {
    return false;
  }
  return set("FORCE_COLOR") || stream.isTTY === true;
}

export function isInteractive(stream: NodeJS.WriteStream = process.stdout): boolean {
  return stream.isTTY === true;
}
