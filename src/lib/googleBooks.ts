export interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    categories?: string[];
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
      imageLinks: doc.cover_i
        ? { thumbnail: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` }
        : undefined,
      industryIdentifiers: doc.isbn
        ? [{ type: 'ISBN_13', identifier: doc.isbn[0] }]
        : undefined,
    },
  };
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
  return (data.docs ?? []).map(mapOpenLibraryDoc);
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
  return data.items ?? [];
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
