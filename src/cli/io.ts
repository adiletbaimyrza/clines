export interface IO {
  out(message: string): void;
  err(message: string): void;
}

export const consoleIO: IO = {
  out: (message) => console.log(message),
  err: (message) => console.error(message),
};
