import wordsData from './words.json';

export interface CardItem {
  id: string;
  word: string;
  phrase: string;
}

export const INITIAL_CARDS: CardItem[] = wordsData.words.map((item, index) => ({
  id: String(index + 1),
  word: item['1'],
  phrase: item['3']
}));
