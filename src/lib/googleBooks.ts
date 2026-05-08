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

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=10&printType=books`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch from Google Books');
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
