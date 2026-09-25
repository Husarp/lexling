// Slurs and vulgar words: Connect never puts one on its board or accepts one as a bonus word (owner,
// 2026-09-25: "slurs shouldn't be in crosswords - in bonus too"), and Letters never hides one or takes
// one as a guess (owner, the same day). Not the data's stoplist
// (NEVER_SECRET in tools/seeds.mjs): that one also holds everyday words that must not be *hidden* -
// "then", "here", "jak" - which are perfectly good bonus words.
//
// An inflected form is caught through its base word (resolve), so the lists hold base forms. Where a
// word has an innocent meaning too (cock, pussy, suka) it is on the list anyway: a missed bonus word
// costs nothing, a slur celebrated as a find does.
import { resolve } from './engine.js';

const WORDS = {
  en: 'fuck fucker fucking motherfucker shit bullshit shitty bitch bitchy cunt dick dickhead cock pussy ass asshole arse '
    + 'arsehole bastard slut whore twat wank wanker prick bollocks crap piss tits boob boobs nigger nigga negro coon spic '
    + 'chink gook kike wetback faggot fag dyke tranny retard retarded spaz cripple jap paki raghead towelhead gypsy clit',
  pl: 'kurwa chuj huj pizda cipa cipka kutas fiut dupa dupek gówno dziwka suka skurwysyn ciota pedał pedzio cwel szmata '
    + 'jebać pierdolić mineta ruchać obciąganie srać zasraniec sraczka czarnuch murzyn ciapaty żółtek kacap szwab '
    + 'cyganka cygan zajebisty zajebiście chujowy chujowo jebany pierdolony zjebany kurewski '
    + 'kurewsko pojebany wkurwiony spierdolony zasrany gówniany wyjebany',
};
// the roots Polish vulgar words are built from, and English ones that turn up inside compounds
// (nigg without the innocent niggle and niggard)
const ROOTS = {
  en: /fuck|shit|cunt|nigg(?!l|ard)|fagg|bitch|whore|slut|twat|wank/,
  pl: /kurw|jeb|pierdol|chuj|pizd|skurw/,
};
const sets = {};

// the word itself, as written: on the list or built on a vulgar root (enough for base words - the pools)
export function offensiveWord(lang, word) {
  const set = sets[lang] ??= new Set(WORDS[lang].split(' '));
  return set.has(word) || ROOTS[lang].test(word);
}

// anything typed: also an inflected form of a word on the list (BITCHES -> BITCH), through its base word
export function offensive(m, word) {
  const lang = m.lang === 'pl' ? 'pl' : 'en';
  if (offensiveWord(lang, word)) return true;
  const base = resolve(m, word);
  return base !== null && offensiveWord(lang, m.words[base.idx]);
}
