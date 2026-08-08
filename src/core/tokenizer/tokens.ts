const WORD = /[A-Za-z0-9_]+/g;
const SYMBOL_RUN = /[^\sA-Za-z0-9_]+/g;
const NEWLINE = /\n/g;
const SUBWORD = /_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Za-z])(?=[0-9])/;

const WORD_CHUNK = 10;
const SYMBOL_CHUNK = 3;

export function estimateTokens(text: string): number {
  let total = text.match(NEWLINE)?.length ?? 0;

  for (const run of text.match(SYMBOL_RUN) ?? []) {
    total += Math.ceil(run.length / SYMBOL_CHUNK);
  }

  for (const word of text.match(WORD) ?? []) {
    let subtotal = 0;
    for (const part of word.split(SUBWORD)) {
      subtotal += Math.ceil(part.length / WORD_CHUNK);
    }
    total += Math.max(1, subtotal);
  }

  return total;
}
