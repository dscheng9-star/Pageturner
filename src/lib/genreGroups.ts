import type { Book } from './database.types';

export const GENRE_GROUPS = {
  SPECULATIVE_FICTION: [
    'High Fantasy', 'Epic Fantasy', 'Dark Fantasy', 'Urban Fantasy',
    'Grimdark', 'Fairy Tale Retelling', 'Mythic Fantasy', 'Romantasy',
    'Young Adult', 'Middle Grade', "Children's", 'Hard Sci-Fi',
    'Space Opera', 'Cyberpunk', 'Dystopian', 'Military Sci-Fi',
    'Biopunk', 'Time Travel', 'Media Tie-In Fiction',
    'Star Wars Expanded Universe', 'Supernatural Horror',
    'Psychological Horror', 'Gothic Horror', 'Cosmic Horror',
  ],
  FICTION: [
    'Literary Fiction', 'Historical Fiction', 'Magical Realism',
    'Satire', 'Short Stories', 'Psychological Thriller',
    'Crime Thriller', 'Legal Thriller', 'Cozy Mystery',
    'Detective Fiction', 'Espionage', 'Contemporary Romance',
    'Historical Romance', 'Paranormal Romance', 'Graphic Novel',
  ],
  NONFICTION_AND_RELIGIOUS: [
    'Memoir', 'Biography', 'History', 'Popular Science',
    'Philosophy', 'Self-Help', 'True Crime', 'Essay Collection',
    'Bible', 'Biblical Commentary', 'Christian Living',
    'Christian Theology', 'Devotional', 'Church History',
    'Apologetics', 'Spiritual Memoir', 'Religious History',
  ],
} as const;

export type GenreGroupName = keyof typeof GENRE_GROUPS;

export const ALLOWED_CROSS_GROUP_MATCHES: [GenreGroupName, GenreGroupName][] = [
  ['SPECULATIVE_FICTION', 'FICTION'],
];

export function getBookGenreGroup(book: Pick<Book, 'genres'>): GenreGroupName | null {
  if (!book.genres || book.genres.length === 0) return null;

  for (const [groupName, genres] of Object.entries(GENRE_GROUPS) as [GenreGroupName, string[]][]) {
    if (book.genres.some(g => genres.includes(g))) {
      return groupName;
    }
  }
  return null;
}

export function canBooksMatch(
  bookA: Pick<Book, 'genres'>,
  bookB: Pick<Book, 'genres'>,
): boolean {
  const groupA = getBookGenreGroup(bookA);
  const groupB = getBookGenreGroup(bookB);

  if (!groupA || !groupB) return true;
  if (groupA === groupB) return true;

  return ALLOWED_CROSS_GROUP_MATCHES.some(
    ([g1, g2]) =>
      (groupA === g1 && groupB === g2) || (groupA === g2 && groupB === g1),
  );
}
