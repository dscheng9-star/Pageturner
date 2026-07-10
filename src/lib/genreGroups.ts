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

const GENERIC_GENRES = new Set(['Fiction', 'Nonfiction']);

/** Find which group has the most books in the library (ties → FICTION). */
export function getLargestGenreGroup(libraryBooks: Pick<Book, 'genres'>[]): GenreGroupName {
  const counts: Record<GenreGroupName, number> = {
    SPECULATIVE_FICTION: 0,
    FICTION: 0,
    NONFICTION_AND_RELIGIOUS: 0,
  };

  for (const book of libraryBooks) {
    if (!book.genres || book.genres.length === 0) continue;
    for (const [groupName, genres] of Object.entries(GENRE_GROUPS) as [GenreGroupName, string[]][]) {
      if (book.genres.some(g => genres.includes(g))) {
        counts[groupName]++;
        break;
      }
    }
  }

  let best: GenreGroupName = 'FICTION';
  let bestCount = -1;
  for (const [name, count] of Object.entries(counts) as [GenreGroupName, number][]) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export function getBookGenreGroup(
  book: Pick<Book, 'genres'>,
  libraryBooks: Pick<Book, 'genres'>[] = [],
): GenreGroupName {
  if (!book.genres || book.genres.length === 0) {
    return getLargestGenreGroup(libraryBooks);
  }

  // Generic single-genre fallbacks
  if (book.genres.length === 1) {
    if (book.genres[0] === 'Fiction') return 'FICTION';
    if (book.genres[0] === 'Nonfiction') return 'NONFICTION_AND_RELIGIOUS';
  }

  // Check specific genre list membership
  for (const [groupName, genres] of Object.entries(GENRE_GROUPS) as [GenreGroupName, string[]][]) {
    if (book.genres.some(g => genres.includes(g))) {
      return groupName;
    }
  }

  // Only generic genres that didn't match above, or unrecognized genres
  if (book.genres.every(g => GENERIC_GENRES.has(g))) {
    return getLargestGenreGroup(libraryBooks);
  }

  return getLargestGenreGroup(libraryBooks);
}

export function canBooksMatch(
  bookA: Pick<Book, 'genres'>,
  bookB: Pick<Book, 'genres'>,
  libraryBooks: Pick<Book, 'genres'>[] = [],
): boolean {
  const groupA = getBookGenreGroup(bookA, libraryBooks);
  const groupB = getBookGenreGroup(bookB, libraryBooks);

  if (groupA === groupB) return true;

  return ALLOWED_CROSS_GROUP_MATCHES.some(
    ([g1, g2]) =>
      (groupA === g1 && groupB === g2) || (groupA === g2 && groupB === g1),
  );
}
