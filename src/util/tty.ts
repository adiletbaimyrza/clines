export function useColor(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (process.env["NO_COLOR"] !== undefined && process.env["NO_COLOR"] !== "") {
    return false;
  }
  return stream.isTTY === true;
}

export function isInteractive(stream: NodeJS.WriteStream = process.stdout): boolean {
  return stream.isTTY === true;
}
