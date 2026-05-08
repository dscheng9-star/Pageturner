import { useRef, useState } from 'react';
import { Search, Loader2, BookOpen } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import { searchBooks, extractCoverUrl, extractIsbn, extractGenre, type GoogleBook } from '../lib/googleBooks';

interface AddBookModalProps {
  onClose: () => void;
  onSelect: (book: GoogleBook) => void;
}

export default function AddBookModal({ onClose, onSelect }: AddBookModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const books = await searchBooks(query);
        setResults(books);
        setSearched(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Search failed. Please try again.';
        console.error('Book search error:', err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    }, 500);
  }

  return (
    <Modal title="Add a Book" onClose={onClose} wide>
      <div className="p-6 space-y-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by title or author…"
              className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {searched && results.length === 0 && (
          <div className="flex flex-col items-center py-10 text-stone-400">
            <BookOpen size={40} className="mb-3" />
            <p className="text-sm">No results found for "{query}"</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto -mx-2 px-2">
            {results.map(book => {
              const info = book.volumeInfo;
              const cover = extractCoverUrl(book);
              const author = info.authors?.join(', ') ?? 'Unknown author';
              const genre = extractGenre(book);
              return (
                <button
                  key={book.id}
                  onClick={() => onSelect(book)}
                  className="w-full flex gap-4 p-3 rounded-xl hover:bg-stone-50 transition-colors text-left group"
                >
                  <BookCover url={cover} title={info.title} size="sm" className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 text-sm leading-snug line-clamp-2">{info.title}</p>
                    <p className="text-stone-500 text-xs mt-0.5">{author}</p>
                    {genre && <span className="inline-block mt-1 text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{genre}</span>}
                    {info.description && (
                      <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">{info.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 group-hover:text-stone-600 flex-shrink-0 self-center transition-colors">Select →</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
