// __NAME__'s rules: plain functions that don't need the screen, so tests can check them.

// How many words some text holds.
export function words(text) {
  return String(text ?? '').split(/\s+/).filter(Boolean).length;
}

// The line the Editor shows.
export const wordsLine = (n) => (n === 1 ? '1 word' : `${n} words`);
