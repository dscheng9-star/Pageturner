export interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    categories?: string[];
    language?: string;
    publishedDate?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    seriesInfo?: { bookDisplayNumber?: string };
  };
}

export interface GoogleBooksResponse {
  items?: GoogleBook[];
  totalItems: number;
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  subject?: string[];
  isbn?: string[];
  first_publish_year?: number;
}

interface OpenLibraryResponse {
  docs: OpenLibraryDoc[];
}

function mapOpenLibraryDoc(doc: OpenLibraryDoc): GoogleBook {
  return {
    id: doc.key,
    volumeInfo: {
      title: doc.title,
      authors: doc.author_name ? [doc.author_name[0]] : undefined,
      categories: doc.subject ? [doc.subject[0]] : undefined,
      language: 'en',
      publishedDate: doc.first_publish_year?.toString(),
      imageLinks: doc.cover_i
        ? { thumbnail: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` }
        : undefined,
      industryIdentifiers: doc.isbn
        ? [{ type: 'ISBN_13', identifier: doc.isbn[0] }]
        : undefined,
    },
  };
}

/** Returns true if the author name has the same word repeated consecutively. */
function hasRepeatedAuthorWord(author: string): boolean {
  const words = author.toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) return true;
  }
  return false;
}

/** Remove malformed entries. */
function isValidResult(book: GoogleBook): boolean {
  const info = book.volumeInfo;
  const title = info.title ?? '';
  const authors = info.authors ?? [];
  const description = info.description ?? '';

  if (title.length < 2) return false;
  if (authors.length === 0) return false;
  if (description.length < 20) return false;
  if (hasRepeatedAuthorWord(authors[0])) return false;
  return true;
}

/** Score a result for dedup "best pick" priority (higher is better). */
function dedupScore(book: GoogleBook): number {
  let score = 0;
  if (book.volumeInfo.language === 'en') score += 1000;
  if (extractCoverUrl(book)) score += 100;
  score += Math.min((book.volumeInfo.description ?? '').length, 9999);
  const dateStr = book.volumeInfo.publishedDate ?? '';
  if (dateStr) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    if (!isNaN(year)) score += year;
  }
  return score;
}

/** Group by title + primary author (case-insensitive), keep the best from each group. */
function deduplicateResults(books: GoogleBook[]): GoogleBook[] {
  const groups = new Map<string, GoogleBook[]>();
  for (const book of books) {
    const title = (book.volumeInfo.title ?? '').toLowerCase().trim();
    const author = (book.volumeInfo.authors?.[0] ?? '').toLowerCase().trim();
    const key = `${title}\0${author}`;
    const group = groups.get(key);
    if (group) group.push(book);
    else groups.set(key, [book]);
  }
  const result: GoogleBook[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => dedupScore(b) - dedupScore(a));
    result.push(group[0]);
  }
  return result;
}

/** Sort so English editions appear before non-English editions. */
function sortByLanguage(books: GoogleBook[]): GoogleBook[] {
  return books.sort((a, b) => {
    const aEn = a.volumeInfo.language === 'en' ? 0 : 1;
    const bEn = b.volumeInfo.language === 'en' ? 0 : 1;
    return aEn - bEn;
  });
}

/** Filter, deduplicate, and sort search results. */
function cleanSearchResults(books: GoogleBook[]): GoogleBook[] {
  return sortByLanguage(deduplicateResults(books.filter(isValidResult)));
}

async function searchOpenLibrary(query: string): Promise<GoogleBook[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://openlibrary.org/search.json?q=${encoded}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) {
    let errorBody: unknown;
    try { errorBody = await res.json(); } catch { errorBody = await res.text(); }
    console.error('Open Library API error', { status: res.status, statusText: res.statusText, body: errorBody });
    throw new Error(`Open Library API returned ${res.status}: ${res.statusText}`);
  }
  const data: OpenLibraryResponse = await res.json();
  return cleanSearchResults((data.docs ?? []).map(mapOpenLibraryDoc));
}

export async function searchBooks(query: string): Promise<GoogleBook[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
  const encoded = encodeURIComponent(query);
  const keyParam = apiKey ? `&key=${apiKey}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=10&printType=books${keyParam}`;
  const res = await fetch(url);
  if (!res.ok) {
    let errorBody: unknown;
    try { errorBody = await res.json(); } catch { errorBody = await res.text(); }
    console.error('Google Books API error', { status: res.status, statusText: res.statusText, body: errorBody });
    if (res.status === 429) {
      console.warn('Google Books rate limited — falling back to Open Library');
      return searchOpenLibrary(query);
    }
    throw new Error(`Google Books API returned ${res.status}: ${res.statusText}`);
  }
  const data: GoogleBooksResponse = await res.json();
  return cleanSearchResults(data.items ?? []);
}

export function extractCoverUrl(book: GoogleBook): string | null {
  const links = book.volumeInfo.imageLinks;
  if (!links) return null;
  const url = links.thumbnail ?? links.smallThumbnail ?? null;
  // Use https and zoom=1 for better quality
  return url ? url.replace('http://', 'https://').replace('zoom=1', 'zoom=2') : null;
}

export function extractIsbn(book: GoogleBook): string | null {
  const ids = book.volumeInfo.industryIdentifiers ?? [];
  const isbn13 = ids.find(i => i.type === 'ISBN_13');
  const isbn10 = ids.find(i => i.type === 'ISBN_10');
  return isbn13?.identifier ?? isbn10?.identifier ?? null;
}

export function extractGenre(book: GoogleBook): string | null {
  const cats = book.volumeInfo.categories;
  if (!cats || cats.length === 0) return null;
  return cats[0].split(' / ')[0];
}
