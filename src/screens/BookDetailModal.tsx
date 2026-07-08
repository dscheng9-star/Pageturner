import { useState, useEffect } from 'react';
import { RotateCcw, Calendar, BookCheck } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import ReviewModal from './ReviewModal';
import { supabase } from '../lib/supabase';
import type { Book, Review, OpinionSignal } from '../lib/database.types';

const responseBadge: Record<string, string> = {
  agree:    'bg-emerald-100 text-emerald-700',
  disagree: 'bg-red-100 text-red-600',
  neutral:  'bg-stone-100 text-stone-500',
};

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
  const [opinionSignals, setOpinionSignals] = useState<OpinionSignal[]>([]);
  const [loadingOpinions, setLoadingOpinions] = useState(true);

  const latestStatus = reviews.length > 0 ? reviews[reviews.length - 1].status : null;
  const isRead       = reviews.some(r => r.status === 'read' || r.status === 'backlog');
  const needsReview  = latestStatus === 'backlog' || latestStatus === 'want_to_read';

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
        isReread
        library={library}
        onClose={() => setShowReread(false)}
        onSaved={() => { setShowReread(false); onRefresh(); }}
      />
    );
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="p-6">
        {/* Header */}
        <div className="flex gap-5">
          <BookCover url={book.cover_image_url} title={book.title} size="xl" className="flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-xl font-semibold text-stone-900 leading-snug">{book.title}</h2>
            <p className="text-stone-500 mt-1">{book.author}</p>

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

            {/* ELO score */}
            {isRead && (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-stone-900 tabular-nums">
                  {book.elo_score.toFixed(1)}
                </span>
                <span className="text-base text-stone-400 font-normal">/ 10</span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {needsReview && onCompleteReview && (
                <button
                  onClick={() => { onClose(); onCompleteReview(book); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
                >
                  <BookCheck size={14} />
                  Complete Review
                </button>
              )}
              {isRead && (
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
  );
}
