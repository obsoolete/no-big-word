/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Heuristic to count syllables. Not perfect, but helpful for UI hints.
 */
export function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
}
