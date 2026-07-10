import { useState, useEffect } from 'react';
import { Bookmark, Plus, BookCheck, Loader2 } from 'lucide-react';
import BookCover from '../components/BookCover';
import ReviewModal from './ReviewModal';
import BookDetailModal from './BookDetailModal';
import { supabase } from '../lib/supabase';
import type { Book, Review } from '../lib/database.types';

interface BookWithReviews extends Book {
  reviews: Review[];
}

interface WantToReadScreenProps {
  onAddBook: () => void;
}

export default function WantToReadScreen({ onAddBook }: WantToReadScreenProps) {
  const [books, setBooks] = useState<BookWithReviews[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookWithReviews | null>(null);
  // book whose "I've Finished Reading This" flow is in progress
  const [finishingBook, setFinishingBook] = useState<BookWithReviews | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  async function fetchBooks() {
    setLoading(true);
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('status', 'want_to_read');
    if (!reviews || reviews.length === 0) {
      setBooks([]);
      setLoading(false);
      return;
    }

    const bookIds = [...new Set(reviews.map(r => r.book_id))];
    const { data: booksData } = await supabase
      .from('books')
      .select('*')
      .in('id', bookIds)
      .order('created_at', { ascending: false });

    if (booksData) {
      const reviewsMap: Record<string, Review[]> = {};
      reviews.forEach(r => {
        if (!reviewsMap[r.book_id]) reviewsMap[r.book_id] = [];
        reviewsMap[r.book_id].push(r);
      });
      setBooks(booksData.map(b => ({ ...b, reviews: reviewsMap[b.id] ?? [] })));
    }
    setLoading(false);
  }

  useEffect(() => { fetchBooks(); }, []);

  // Immediately flip the want_to_read review → status: read, then open the review flow
  async function handleFinishReading(book: BookWithReviews) {
    setPromotingId(book.id);
    try {
      const wtrReview = book.reviews.find(r => r.status === 'want_to_read');
      if (!wtrReview) return;

      // Update status to 'read' immediately so the book leaves the Want to Read tab
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'read' })
        .eq('id', wtrReview.id);
      if (error) throw error;

      // Remove from local state instantly
      setBooks(prev => prev.filter(b => b.id !== book.id));

      // Open the review completion flow
      setFinishingBook(book);
    } catch (e) {
      console.error('[finish reading]', e);
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-stone-100 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">Want to Read</h1>
          <button
            onClick={onAddBook}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            <Plus size={16} />
            Add Book
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="w-full aspect-[2/3] bg-stone-100 rounded-lg" />
                <div className="mt-2 h-3 bg-stone-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <Bookmark size={24} />
            </div>
            <p className="font-medium text-stone-600">No books saved yet</p>
            <p className="text-sm mt-1">Search for a book and choose "I want to read this"</p>
            <button
              onClick={onAddBook}
              className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              Find a book
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6">
            {books.map(book => (
              <div key={book.id} className="flex flex-col">
                <button
                  onClick={() => setSelectedBook(book)}
                  className="text-left group flex-1"
                >
                  <BookCover
                    url={book.cover_image_url}
                    title={book.title}
                    author={book.author}
                    size="md"
                    className="w-full group-hover:shadow-md transition-shadow"
                  />
                  <div className="mt-2">
                    <p className="text-xs font-medium text-stone-800 line-clamp-2 leading-snug">{book.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5 truncate">{book.author}</p>
                  </div>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleFinishReading(book); }}
                  disabled={promotingId === book.id}
                  className="mt-2 flex items-center justify-center gap-1 py-1.5 border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all disabled:opacity-50"
                >
                  {promotingId === book.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <BookCheck size={12} />
                  }
                  I've Finished Reading This
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          reviews={selectedBook.reviews}
          onClose={() => setSelectedBook(null)}
          onRefresh={() => { setSelectedBook(null); fetchBooks(); }}
        />
      )}

      {finishingBook && (
        <ReviewModal
          existingBook={finishingBook}
          completeReview
          onClose={() => setFinishingBook(null)}
          onSaved={() => setFinishingBook(null)}
        />
      )}
    </div>
  );
}
