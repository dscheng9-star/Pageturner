import { useState, useEffect } from 'react';
import { RotateCcw, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import ReviewModal from './ReviewModal';
import { supabase } from '../lib/supabase';
import { eloToScore, scoreToElo } from '../lib/elo';
import type { Book, Review, Matchup } from '../lib/database.types';

interface ScoreEvent {
  date: string;
  score: number;
  delta: number | null;
  label: string;
}

interface BookDetailModalProps {
  book: Book;
  reviews: Review[];
  onClose: () => void;
  onRefresh: () => void;
  library?: Book[];
}

export default function BookDetailModal({
  book,
  reviews,
  onClose,
  onRefresh,
  library = [],
}: BookDetailModalProps) {
  const [showReread, setShowReread] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<ScoreEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const latestReview = reviews[reviews.length - 1];
  const readReviews = reviews.filter(r => r.status === 'read' || r.status === 'backlog');
  const isRead = readReviews.length > 0;

  useEffect(() => {
    async function buildScoreHistory() {
      setLoadingHistory(true);
      const { data: matchups } = await supabase
        .from('matchups')
        .select('*')
        .or(`winner_book_id.eq.${book.id},loser_book_id.eq.${book.id}`)
        .order('created_at', { ascending: true });

      if (!matchups || matchups.length === 0) {
        setLoadingHistory(false);
        return;
      }

      // Replay ELO for this book's full matchup history to show score progression
      const { data: allMatchups } = await supabase
        .from('matchups')
        .select('*')
        .order('created_at', { ascending: true });

      const { data: allBooks } = await supabase.from('books').select('id, elo_score');
      if (!allBooks || !allMatchups) {
        setLoadingHistory(false);
        return;
      }

      const scores: Record<string, number> = {};
      for (const b of allBooks) {
        scores[b.id] = scoreToElo(5);
      }

      const K = 32;
      const SCALE = 400;
      const events: ScoreEvent[] = [];
      let lastScore: number | null = null;

      for (const m of allMatchups as Matchup[]) {
        if (m.result_type === 'skip') continue;
        const wa = scores[m.winner_book_id];
        const la = scores[m.loser_book_id];
        if (wa === undefined || la === undefined) continue;

        const expW = 1 / (1 + Math.pow(10, (la - wa) / SCALE));
        const expL = 1 - expW;
        const scoreW = m.result_type === 'win' ? 1 : 0.5;
        const scoreL = 1 - scoreW;

        scores[m.winner_book_id] = wa + K * (scoreW - expW);
        scores[m.loser_book_id] = la + K * (scoreL - expL);

        if (m.winner_book_id === book.id || m.loser_book_id === book.id) {
          const newElo = m.winner_book_id === book.id ? scores[m.winner_book_id] : scores[m.loser_book_id];
          const newScore = eloToScore(newElo);
          const delta = lastScore !== null ? Math.round((newScore - lastScore) * 10) / 10 : null;
          const opponentId = m.winner_book_id === book.id ? m.loser_book_id : m.winner_book_id;
          const opponentBook = allBooks.find(b => b.id === opponentId);

          let label: string;
          if (m.result_type === 'too_close') {
            label = 'Near-tie matchup';
          } else if (m.winner_book_id === book.id) {
            label = 'Won a matchup';
          } else {
            label = 'Lost a matchup';
          }

          events.push({
            date: m.created_at,
            score: newScore,
            delta,
            label,
          });
          lastScore = newScore;
        }
      }

      setScoreHistory(events);
      setLoadingHistory(false);
    }

    buildScoreHistory();
  }, [book.id]);

  if (showReread) {
    return (
      <ReviewModal
        existingBook={book}
        isReread={true}
        library={library}
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
              <span className="inline-block mt-2 text-xs bg-stone-100 text-stone-500 px-2.5 py-1 rounded-full">
                {book.genre}
              </span>
            )}
            {isRead && (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-stone-900 tabular-nums">
                  {book.elo_score.toFixed(1)}
                </span>
                <span className="text-base text-stone-400 font-normal">/ 10</span>
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

        {/* Score history */}
        {isRead && !loadingHistory && scoreHistory.length > 0 && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Score history</h4>
            <div className="space-y-2">
              {scoreHistory.map((event, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-300 flex-shrink-0" />
                  <span className="text-xs text-stone-400 w-24 flex-shrink-0">
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-stone-600 flex-1">{event.label}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-semibold tabular-nums text-stone-900">
                      {event.score.toFixed(1)}
                    </span>
                    {event.delta !== null && event.delta !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs tabular-nums font-medium ${
                        event.delta > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {event.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {event.delta > 0 ? '+' : ''}{event.delta.toFixed(1)}
                      </span>
                    )}
                    {event.delta === 0 && (
                      <span className="flex items-center text-xs text-stone-400">
                        <Minus size={11} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                          {new Date(r.date_finished).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
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
