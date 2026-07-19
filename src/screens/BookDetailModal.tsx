import { useState, useEffect } from 'react';
import { RotateCcw, Calendar, BookCheck, Trash2, AlertTriangle } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import ScoreBadge from '../components/ScoreBadge';
import ReviewModal from './ReviewModal';
import { supabase } from '../lib/supabase';
import { recalculateEloFromMatchups } from '../lib/elo';
import type { Book, Review, OpinionSignal } from '../lib/database.types';

const responseBadge: Record<string, string> = {
  agree:    'bg-emerald-100 text-emerald-700',
  disagree: 'bg-red-100 text-red-600',
  neutral:  'bg-stone-100 text-stone-500',
};

function DeleteConfirmDialog({
  canDeleteReviewEntry,
  deleting,
  error,
  onCancel,
  onDeleteReviewEntry,
  onDeleteBook,
}: {
  canDeleteReviewEntry: boolean;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onDeleteReviewEntry: () => void;
  onDeleteBook: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Delete</h3>
            <p className="text-sm text-stone-500 mt-0.5">Choose what to remove. This cannot be undone.</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Option A — delete latest review entry only */}
        <button
          onClick={onDeleteReviewEntry}
          disabled={deleting || !canDeleteReviewEntry}
          className="w-full text-left p-4 border-2 border-stone-200 rounded-xl hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors group"
        >
          <p className="font-medium text-sm text-stone-900">Delete this review entry</p>
          <p className="text-xs text-stone-400 mt-0.5">
            {canDeleteReviewEntry
              ? 'Removes the most recent review and its opinions/matchups. Keeps the book and other reviews.'
              : 'Only available when the book has more than one review entry.'}
          </p>
        </button>

        {/* Option B — delete the book entirely */}
        <button
          onClick={onDeleteBook}
          disabled={deleting}
          className="w-full text-left p-4 border-2 border-red-200 rounded-xl hover:border-red-400 bg-red-50/40 disabled:opacity-40 transition-colors"
        >
          <p className="font-medium text-sm text-red-700">Delete this book entirely</p>
          <p className="text-xs text-red-500/80 mt-0.5">
            This will permanently delete this book and all its review history.
          </p>
        </button>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface BookDetailModalProps {
  book: Book;
  reviews: Review[];
  onClose: () => void;
  onRefresh: () => void;
  library?: Book[];
  onCompleteReview?: (book: Book) => void;
}

export default function BookDetailModal({
  book,
  reviews,
  onClose,
  onRefresh,
  library = [],
  onCompleteReview,
}: BookDetailModalProps) {
  const [showReread, setShowReread] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [opinionSignals, setOpinionSignals] = useState<OpinionSignal[]>([]);
  const [loadingOpinions, setLoadingOpinions] = useState(true);

  const latestStatus = reviews.length > 0 ? reviews[reviews.length - 1].status : null;
  const isRead       = reviews.some(r => r.status === 'read' || r.status === 'backlog');
  const needsReview  = latestStatus === 'backlog' || latestStatus === 'want_to_read';

  // Find any incomplete review to resume (takes priority over starting a new re-read)
  const incompleteReview = reviews.find(r => r.review_status === 'incomplete') ?? null;
  const allReviewsDone   = reviews.length > 0 &&
    reviews.every(r => r.review_status === 'complete' || r.review_status === 'manually_locked');

  const userAddedOpinion = reviews
    .map(r => r.user_added_opinion)
    .filter(Boolean)
    .at(-1) ?? null;

  const displayGenres: string[] = book.genres ?? [];

  useEffect(() => {
    async function loadOpinions() {
      setLoadingOpinions(true);
      const { data } = await supabase
        .from('opinion_signals')
        .select('*')
        .eq('book_id', book.id)
        .order('created_at', { ascending: true });
      setOpinionSignals(data ?? []);
      setLoadingOpinions(false);
    }
    loadOpinions();
  }, [book.id]);

  const popularOpinions   = opinionSignals.filter(s => s.opinion_type === 'popular');
  const unpopularOpinions = opinionSignals.filter(s => s.opinion_type === 'unpopular');

  if (showReread) {
    return (
      <ReviewModal
        existingBook={book}
        isReread={!incompleteReview}
        incompleteReview={incompleteReview ?? undefined}
        library={library}
        onClose={() => setShowReread(false)}
        onSaved={() => { setShowReread(false); onRefresh(); }}
      />
    );
  }

  async function handleDeleteReviewEntry() {
    setDeleting(true);
    setDeleteError('');
    try {
      const latest = reviews[reviews.length - 1];
      await supabase.from('opinion_signals').delete().eq('review_id', latest.id);
      await supabase.from('reviews').delete().eq('id', latest.id);
      const { data: allBooks } = await supabase.from('books').select('*');
      if (allBooks) await recalculateEloFromMatchups(allBooks);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete review entry');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteBook() {
    setDeleting(true);
    setDeleteError('');
    try {
      const reviewIds = reviews.map(r => r.id);
      if (reviewIds.length > 0) {
        await supabase.from('opinion_signals').delete().in('review_id', reviewIds);
      }
      await supabase.from('matchups').delete().or(`winner_book_id.eq.${book.id},loser_book_id.eq.${book.id}`);
      await supabase.from('reviews').delete().eq('book_id', book.id);
      await supabase.from('books').delete().eq('id', book.id);
      const { data: allBooks } = await supabase.from('books').select('*');
      if (allBooks) await recalculateEloFromMatchups(allBooks);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete book');
    } finally {
      setDeleting(false);
    }
  }

  const canDeleteReviewEntry = reviews.length > 1;

  return (
    <>
    <Modal onClose={onClose} wide>
      <div className="p-6">
        {/* Header */}
        <div className="flex gap-5">
          <BookCover url={book.cover_image_url} title={book.title} author={book.author} size="xl" className="flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-stone-900 leading-snug">{book.title}</h2>
                <p className="text-stone-500 mt-1">{book.author}</p>
              </div>
              <button
                onClick={() => { setShowDelete(true); setDeleteError(''); }}
                title="Delete"
                className="flex-shrink-0 flex items-center gap-1 text-xs text-stone-400 hover:text-red-600 transition-colors py-1 px-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>

            {/* Genre pills */}
            {displayGenres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {displayGenres.map(g => (
                  <span key={g} className="text-xs bg-stone-100 text-stone-500 px-2.5 py-0.5 rounded-full">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Score / tier badge */}
            <div className="mt-3">
              <ScoreBadge book={book} reviews={reviews} size="lg" />
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {needsReview && onCompleteReview && (
                <button
                  onClick={() => { onClose(); onCompleteReview(book); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
                >
                  <BookCheck size={14} />
                  {latestStatus === 'want_to_read' ? "I've Finished Reading This" : 'Complete Review'}
                </button>
              )}
              {isRead && incompleteReview && (
                <button
                  onClick={() => setShowReread(true)}
                  className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-800 transition-colors font-medium"
                >
                  <RotateCcw size={14} />
                  Resume review
                </button>
              )}
              {isRead && !incompleteReview && allReviewsDone && (
                <button
                  onClick={() => setShowReread(true)}
                  className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <RotateCcw size={14} />
                  Log re-read
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {book.description && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-stone-600 leading-relaxed line-clamp-4">{book.description}</p>
          </div>
        )}

        {/* Opinion signals */}
        {!loadingOpinions && (popularOpinions.length > 0 || unpopularOpinions.length > 0 || userAddedOpinion) && (
          <div className="mt-5 pt-5 border-t border-stone-100 space-y-5">

            {popularOpinions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Popular takes</h4>
                <div className="space-y-2">
                  {popularOpinions.map(s => (
                    <div key={s.id} className="flex items-start gap-2">
                      <span className={`flex-shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${responseBadge[s.response]}`}>
                        {s.response}
                      </span>
                      <p className="text-sm text-stone-700 leading-snug">{s.statement_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unpopularOpinions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Minority opinions</h4>
                <div className="space-y-2">
                  {unpopularOpinions.map(s => (
                    <div key={s.id} className="flex items-start gap-2">
                      <span className={`flex-shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${responseBadge[s.response]}`}>
                        {s.response}
                      </span>
                      <p className="text-sm text-stone-700 leading-snug">{s.statement_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userAddedOpinion && (
              <div>
                <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Your own take</h4>
                <p className="text-sm text-stone-600 leading-relaxed italic">"{userAddedOpinion}"</p>
              </div>
            )}
          </div>
        )}

        {/* Reading history */}
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
                      {r.is_reread && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Re-read</span>
                      )}
                      <span className="text-xs text-stone-400 capitalize">{r.status.replace('_', ' ')}</span>
                      {r.date_finished && (
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(r.date_finished).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {r.review_status === 'manually_locked' && (
                        <span className="text-xs bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded">Locked</span>
                      )}
                    </div>
                    {r.review_text && (
                      <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">{r.review_text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
    {showDelete && (
      <DeleteConfirmDialog
        canDeleteReviewEntry={canDeleteReviewEntry}
        deleting={deleting}
        error={deleteError}
        onCancel={() => setShowDelete(false)}
        onDeleteReviewEntry={handleDeleteReviewEntry}
        onDeleteBook={handleDeleteBook}
      />
    )}
    </>
  );
}
