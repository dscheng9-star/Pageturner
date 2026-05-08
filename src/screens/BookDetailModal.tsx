import { useState } from 'react';
import { RotateCcw, Star, Calendar, BookOpen, X } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import StarRating from '../components/StarRating';
import ReviewModal from './ReviewModal';
import type { Book, Review } from '../lib/database.types';

interface BookDetailModalProps {
  book: Book;
  reviews: Review[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function BookDetailModal({ book, reviews, onClose, onRefresh }: BookDetailModalProps) {
  const [showReread, setShowReread] = useState(false);

  const latestReview = reviews[reviews.length - 1];
  const readReviews = reviews.filter(r => r.status === 'read' || r.status === 'backlog');
  const isRead = readReviews.length > 0;

  if (showReread) {
    return (
      <ReviewModal
        existingBook={book}
        isReread={true}
        onClose={() => setShowReread(false)}
        onSaved={() => { setShowReread(false); onRefresh(); }}
      />
    );
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="p-6">
        <div className="flex gap-5">
          <BookCover url={book.cover_image_url} title={book.title} size="xl" className="flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-xl font-semibold text-stone-900 leading-snug">{book.title}</h2>
            <p className="text-stone-500 mt-1">{book.author}</p>
            {book.genre && (
              <span className="inline-block mt-2 text-xs bg-stone-100 text-stone-500 px-2.5 py-1 rounded-full">{book.genre}</span>
            )}
            {latestReview?.star_rating && (
              <div className="mt-3">
                <StarRating value={latestReview.star_rating} readonly size="md" />
              </div>
            )}
            {isRead && (
              <button
                onClick={() => setShowReread(true)}
                className="mt-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
              >
                <RotateCcw size={14} />
                Log re-read
              </button>
            )}
          </div>
        </div>

        {book.description && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-stone-600 leading-relaxed line-clamp-4">{book.description}</p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Reading history</h4>
            <div className="space-y-3">
              {reviews.map((r, i) => (
                <div key={r.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 text-xs text-stone-500 font-medium">
                    {i + 1}
                  </div>
                  <div className="flex-1 pb-3 border-b border-stone-50 last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.is_reread && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Re-read</span>}
                      <span className="text-xs text-stone-400 capitalize">{r.status.replace('_', ' ')}</span>
                      {r.date_finished && (
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(r.date_finished).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {r.star_rating && <StarRating value={r.star_rating} readonly size="sm" />}
                    {r.review_text && <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{r.review_text}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
