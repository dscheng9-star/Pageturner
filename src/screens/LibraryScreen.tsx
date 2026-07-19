import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, BookCheck, Loader2 } from 'lucide-react';
import BookCover from '../components/BookCover';
import ScoreBadge from '../components/ScoreBadge';
import AddBookModal from './AddBookModal';
import ReviewModal from './ReviewModal';
import BookDetailModal from './BookDetailModal';
import DuplicateBookDialog from './DuplicateBookDialog';
import { supabase } from '../lib/supabase';
import { hasCompleteScore, hasIncompleteReview } from '../components/ScoreBadge';
import type { Book, Review, ReviewStatus } from '../lib/database.types';
import type { GoogleBook } from '../lib/googleBooks';

interface BookWithReviews extends Book {
  reviews: Review[];
}

type FilterTab = 'all' | 'read' | 'backlog';

const filterLabel: Record<FilterTab, string> = {
  all: 'All',
  read: 'Read',
  backlog: 'Backlog',
};

export default function LibraryScreen() {
  const [books, setBooks] = useState<BookWithReviews[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [showAddBook, setShowAddBook] = useState(false);
  const [pendingGoogleBook, setPendingGoogleBook] = useState<GoogleBook | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookWithReviews | null>(null);
  const [completeReviewBook, setCompleteReviewBook] = useState<BookWithReviews | null>(null);
  const [rereadBook, setRereadBook] = useState<BookWithReviews | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<{
    existing: BookWithReviews;
    googleBook: GoogleBook;
  } | null>(null);

  const [reclassifyState, setReclassifyState] = useState<{
    active: boolean;
    current: number;
    total: number;
    done: boolean;
  }>({ active: false, current: 0, total: 0, done: false });
  const reclassifyRanRef = useRef(false);

  const GENERIC_GENRES = new Set(['Fiction', 'Nonfiction']);

  function needsReclassification(book: Book): boolean {
    if (!book.genres || book.genres.length === 0) return true;
    if (book.genres.length === 1 && GENERIC_GENRES.has(book.genres[0])) return true;
    // Single-word generic genres (not in any specific group)
    return book.genres.every(g => GENERIC_GENRES.has(g) || g.split(' ').length === 1);
  }

  async function handleReclassifyGenres() {
    if (reclassifyState.active) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const toReclassify = books.filter(needsReclassification);
    if (toReclassify.length === 0) {
      setReclassifyState({ active: false, current: 0, total: 0, done: true });
      return;
    }

    setReclassifyState({ active: true, current: 0, total: toReclassify.length, done: false });

    for (let i = 0; i < toReclassify.length; i++) {
      const book = toReclassify[i];
      setReclassifyState(prev => ({ ...prev, current: i }));
      try {
        const res = await fetch('/api/classify-genre', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            bookTitle: book.title,
            bookAuthor: book.author,
            bookDescription: book.description ?? '',
          }),
        });
        if (!res.ok) continue;
        const genres = await res.json();
        if (Array.isArray(genres) && genres.length > 0) {
          await supabase.from('books').update({ genres }).eq('id', book.id);
        }
      } catch (err) {
        console.error('[reclassify]', book.title, err);
      }
    }

    setReclassifyState({ active: false, current: toReclassify.length, total: toReclassify.length, done: true });
    await fetchBooks();
  }

  async function fetchBooks() {
    setLoading(true);
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('*')
      .neq('status', 'want_to_read')
      .order('created_at', { ascending: true });
    const { data: booksData } = await supabase
      .from('books')
      .select('*')
      .order('elo_score', { ascending: false });

    if (booksData) {
      const reviewsMap: Record<string, Review[]> = {};
      (reviewsData ?? []).forEach(r => {
        if (!reviewsMap[r.book_id]) reviewsMap[r.book_id] = [];
        reviewsMap[r.book_id].push(r);
      });
      // Only include books that have at least one non-want_to_read review
      const filtered = booksData.filter(b => (reviewsMap[b.id] ?? []).length > 0);
      setBooks(filtered.map(b => ({ ...b, reviews: reviewsMap[b.id] ?? [] })));
    }
    setLoading(false);
  }

  useEffect(() => { fetchBooks(); }, []);

  function getBookStatus(book: BookWithReviews): ReviewStatus | null {
    if (book.reviews.length === 0) return null;
    return book.reviews[book.reviews.length - 1].status;
  }

  function findDuplicate(gBook: GoogleBook): BookWithReviews | null {
    const inTitle  = gBook.volumeInfo.title.toLowerCase().trim();
    const inAuthor = (gBook.volumeInfo.authors?.[0] ?? '').toLowerCase().trim();
    return (
      books.find(b => {
        const bTitle  = b.title.toLowerCase().trim();
        const bAuthor = b.author.toLowerCase().trim();
        return (
          bTitle === inTitle &&
          (inAuthor === '' || bAuthor.includes(inAuthor) || inAuthor.includes(bAuthor))
        );
      }) ?? null
    );
  }

  function handleGoogleBookSelect(gBook: GoogleBook) {
    setShowAddBook(false);
    const existing = findDuplicate(gBook);
    if (existing) {
      setDuplicateCandidate({ existing, googleBook: gBook });
    } else {
      setPendingGoogleBook(gBook);
    }
  }

  const filteredBooks = books.filter(book => {
    const status = getBookStatus(book);
    if (filter === 'read'    && status !== 'read')    return false;
    if (filter === 'backlog' && status !== 'backlog') return false;
    if (search) {
      const q = search.toLowerCase();
      return book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q);
    }
    return true;
  });

  const sortedBooks = [...filteredBooks].sort((a, b) => {
    const aScored = hasCompleteScore(a.reviews) && !hasIncompleteReview(a.reviews);
    const bScored = hasCompleteScore(b.reviews) && !hasIncompleteReview(b.reviews);
    if (aScored && !bScored) return -1;
    if (!aScored && bScored) return 1;
    if (aScored && bScored) return b.elo_score - a.elo_score;
    return a.title.localeCompare(b.title);
  });
  const ratedLibrary = books.filter(b =>
    b.reviews.some(r => r.status === 'read' || r.status === 'backlog')
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-100">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-stone-900">My Library</h1>
            <button
              onClick={() => setShowAddBook(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              <Plus size={16} />
              Add Book
            </button>
          </div>

          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your library…"
              className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {(Object.keys(filterLabel) as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === tab
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {filterLabel[tab]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="w-full aspect-[2/3] bg-stone-100 rounded-lg" />
                <div className="mt-2 h-3 bg-stone-100 rounded w-3/4" />
                <div className="mt-1 h-3 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : sortedBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <Filter size={24} />
            </div>
            <p className="font-medium text-stone-600">
              {search
                ? 'No books match your search'
                : filter === 'all'
                ? 'Your library is empty'
                : `No ${filterLabel[filter].toLowerCase()} books yet`}
            </p>
            {filter === 'all' && !search && (
              <button
                onClick={() => setShowAddBook(true)}
                className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
              >
                Add your first book
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6">
            {sortedBooks.map(book => {
              const status      = getBookStatus(book);
              const needsReview = status === 'backlog';
              const displayGenres = book.genres ?? [];

              return (
                <div key={book.id} className="flex flex-col">
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="text-left group flex-1"
                  >
                    <div className="relative">
                      <BookCover
                        url={book.cover_image_url}
                        title={book.title}
                        author={book.author}
                        size="md"
                        className="w-full group-hover:shadow-md transition-shadow"
                      />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-medium text-stone-800 line-clamp-2 leading-snug">
                        {book.title}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{book.author}</p>

                      {/* Genre pills — show first tag only to keep card compact */}
                      {displayGenres.length > 0 && (
                        <span className="inline-block mt-1 text-xs bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-full leading-tight">
                          {displayGenres[0]}
                        </span>
                      )}

                      {(() => {
                        const badge = <ScoreBadge book={book} reviews={book.reviews} />;
                        if (badge) return <div className="mt-1">{badge}</div>;
                        if (status === 'backlog') return <p className="text-xs text-stone-400 mt-1">Backlog</p>;
                        return null;
                      })()}
                    </div>
                  </button>

                  {needsReview && (
                    <button
                      onClick={e => { e.stopPropagation(); setCompleteReviewBook(book); }}
                      className="mt-2 flex items-center justify-center gap-1 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all"
                    >
                      <BookCheck size={12} />
                      Complete Review
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && sortedBooks.length > 0 && (
        <p className="px-6 pb-6 text-xs text-stone-400">
          {sortedBooks.length} {sortedBooks.length === 1 ? 'book' : 'books'}
        </p>
      )}

      {!loading && books.length > 0 && !reclassifyState.done && !reclassifyState.active && (
        <div className="px-6 pb-6">
          <button
            onClick={handleReclassifyGenres}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
          >
            Reclassify book genres
          </button>
        </div>
      )}

      {reclassifyState.active && (
        <div className="px-6 pb-6 flex items-center gap-2 text-xs text-stone-500">
          <Loader2 size={12} className="animate-spin" />
          Updating genres... ({reclassifyState.current}/{reclassifyState.total} books)
        </div>
      )}

      {!reclassifyState.active && reclassifyState.done && (
        <div className="px-6 pb-6 text-xs text-stone-500">
          Genres updated. {reclassifyState.total} {reclassifyState.total === 1 ? 'book' : 'books'} reclassified.
        </div>
      )}

      {/* Modals */}
      {showAddBook && (
        <AddBookModal onClose={() => setShowAddBook(false)} onSelect={handleGoogleBookSelect} />
      )}
      {duplicateCandidate && (
        <DuplicateBookDialog
          existingBook={duplicateCandidate.existing}
          onUpdateReview={() => { setRereadBook(duplicateCandidate.existing); setDuplicateCandidate(null); }}
          onAddAsNew={() => { const g = duplicateCandidate.googleBook; setDuplicateCandidate(null); setPendingGoogleBook(g); }}
          onClose={() => setDuplicateCandidate(null)}
        />
      )}
      {pendingGoogleBook && (
        <ReviewModal
          googleBook={pendingGoogleBook}
          library={ratedLibrary}
          onClose={() => setPendingGoogleBook(null)}
          onSaved={() => { setPendingGoogleBook(null); fetchBooks(); }}
        />
      )}
      {rereadBook && (() => {
        const incompleteReview = rereadBook.reviews.find(r => r.review_status === 'incomplete');
        return (
          <ReviewModal
            existingBook={rereadBook}
            isReread={!incompleteReview}
            incompleteReview={incompleteReview}
            library={ratedLibrary}
            onClose={() => setRereadBook(null)}
            onSaved={() => { setRereadBook(null); fetchBooks(); }}
          />
        );
      })()}
      {completeReviewBook && (() => {
        const incompleteReview = completeReviewBook.reviews.find(r => r.review_status === 'incomplete');
        return incompleteReview ? (
          <ReviewModal
            existingBook={completeReviewBook}
            incompleteReview={incompleteReview}
            library={ratedLibrary}
            onClose={() => setCompleteReviewBook(null)}
            onSaved={() => { setCompleteReviewBook(null); fetchBooks(); }}
          />
        ) : (
          <ReviewModal
            existingBook={completeReviewBook}
            completeReview
            library={ratedLibrary}
            onClose={() => setCompleteReviewBook(null)}
            onSaved={() => { setCompleteReviewBook(null); fetchBooks(); }}
          />
        );
      })()}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          reviews={selectedBook.reviews}
          onClose={() => setSelectedBook(null)}
          onRefresh={() => { setSelectedBook(null); fetchBooks(); }}
          library={ratedLibrary}
          onCompleteReview={book => {
            setSelectedBook(null);
            setCompleteReviewBook(book as BookWithReviews);
          }}
        />
      )}
    </div>
  );
}
