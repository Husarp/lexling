// Letters mode - the rules, with no screen attached (PLAN.md M12).

// Polish letters with marks are separate letters here: ó is not o, so `zolw` is simply wrong for
// `żółw`. When the player allows them they are worth two in the score.
const MARKED = /[ąćęłńóśźż]/;

// How each letter of a guess compares with the answer: 'green' (right letter, right place),
// 'yellow' (in the word, elsewhere) or 'grey' (not in it).
//
// Repeated letters follow Wordle exactly, which is the part that is easy to get wrong. Greens are
// settled first and use up their letter; only what is left over can turn a guessed letter yellow,
// and each leftover letter can do that once. So against `crane`, the guess `eerie` gets its last
// `e` green, and both other `e`s grey - the answer has only the one.
export function feedback(guess, answer) {
  const g = [...guess.toLowerCase()], a = [...answer.toLowerCase()];
  const out = g.map(() => 'grey');
  const left = new Map();
  g.forEach((ch, i) => {
    if (ch === a[i]) out[i] = 'green';
    else left.set(a[i], (left.get(a[i]) || 0) + 1);
  });
  g.forEach((ch, i) => {
    if (out[i] === 'green' || !left.get(ch)) return;
    out[i] = 'yellow';
    left.set(ch, left.get(ch) - 1);
  });
  return out;
}

export const MULTIPLIER = { relaxed: 0.75, easy: 1, normal: 1.25, hard: 1.5 };

// letters ÷ guesses actually used × 100 × difficulty, with a marked Polish letter counting as two.
// Tries left unused never enter the sum - that is the reward for finishing early, and it is why the
// score still means something when tries are unlimited. A loss scores nothing.
export function score(answer, guessesUsed, won, diff) {
  if (!won || guessesUsed < 1) return 0;
  const letters = [...answer.toLowerCase()].reduce((n, ch) => n + (MARKED.test(ch) ? 2 : 1), 0);
  return Math.round(letters / guessesUsed * 100 * (MULTIPLIER[diff] ?? 1));
}
