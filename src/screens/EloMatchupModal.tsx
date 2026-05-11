import { useState, useEffect } from 'react';
import { SkipForward } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import OpinionReviewStep from './OpinionReviewStep';
import { supabase } from '../lib/supabase';
import {
  tierSeedElo,
  eloToScore,
  scoreToElo,
  selectMatchupCandidates,
  recalculateEloFromMatchups,
} from '../lib/elo';
import { fetchBookOpinions } from '../lib/claudeOpinions';
import type { Book, MatchupResultType } from '../lib/database.types';
import type { BookOpinions } from '../lib/claudeOpinions';

type Tier = 'bad' | 'okay' | 'loved';
type Phase = 'tier' | 'opinions' | 'matchup' | 'saving';

interface EloMatchupModalProps {
  newBook: Book;
  library: Book[];
  reviewId: string;
  onDone: () => void;
}

function matchupCount(librarySize: number): number {
  if (librarySize < 10) return 4;
  if (librarySize < 25) return 6;
  return 8;
}

export default function EloMatchupModal({ newBook, library, reviewId, onDone }: EloMatchupModalProps) {
  const [phase, setPhase] = useState<Phase>('tier');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [opponents, setOpponents] = useState<Book[]>([]);
  const [seededBook, setSeededBook] = useState<Book>(newBook);
  const [error, setError] = useState('');

  // Opinion fetching — starts immediately on mount
  const [opinions, setOpinions] = useState<BookOpinions | null>(null);
  const [opinionsFetching, setOpinionsFetching] = useState(true);
  const [opinionsError, setOpinionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOpinionsFetching(true);
    fetchBookOpinions(newBook.title, newBook.author)
      .then(result => {
        if (!cancelled) setOpinions(result);
      })
      .catch(err => {
        if (!cancelled) setOpinionsError(err instanceof Error ? err.message : 'Failed');
      })
      .finally(() => {
        if (!cancelled) setOpinionsFetching(false);
      });
    return () => { cancelled = true; };
  }, [newBook.title, newBook.author]);

  async function handleTierSelect(tier: Tier) {
    const seedElo = tierSeedElo(tier);
    const seedScore = eloToScore(seedElo);
    await supabase.from('books').update({ elo_score: seedScore }).eq('id', newBook.id);
    const seeded = { ...newBook, elo_score: seedScore };
    setSeededBook(seeded);

    const count = matchupCount(library.length);
    const candidates = selectMatchupCandidates(seeded, library, count);
    setOpponents(candidates);
    setPhase('opinions');
  }

  async function handleOpinionsDone(userAddedOpinion: string) {
    if (userAddedOpinion.trim()) {
      await supabase
        .from('reviews')
        .update({ user_added_opinion: userAddedOpinion.trim() })
        .eq('id', reviewId);
    }
    if (opponents.length === 0) {
      onDone();
    } else {
      setPhase('matchup');
    }
  }

  async function handleMatchupResult(result: MatchupResultType, winnerIsLeft: boolean) {
    const opponent = opponents[currentIndex];
    const isLast = currentIndex >= opponents.length - 1;

    if (result !== 'skip') {
      let winnerBookId: string;
      let loserBookId: string;
      if (result === 'win') {
        winnerBookId = winnerIsLeft ? seededBook.id : opponent.id;
        loserBookId = winnerIsLeft ? opponent.id : seededBook.id;
      } else {
        winnerBookId = seededBook.id;
        loserBookId = opponent.id;
      }
      const { error: insertErr } = await supabase.from('matchups').insert({
        winner_book_id: winnerBookId,
        loser_book_id: loserBookId,
        result_type: result,
      });
      if (insertErr) { setError(insertErr.message); return; }
    }

    if (isLast) {
      setPhase('saving');
      try {
        const { data: allBooks } = await supabase.from('books').select('*');
        if (allBooks) await recalculateEloFromMatchups(allBooks);
      } catch (e) {
        console.error('ELO recalc error:', e);
      }
      onDone();
    } else {
      setCurrentIndex(i => i + 1);
    }
  }

  if (phase === 'tier') {
    return (
      <Modal title="Rate this book" onClose={onDone}>
        <div className="p-6 space-y-3">
          <div className="flex gap-4 pb-4 border-b border-stone-100">
            <BookCover url={newBook.cover_image_url} title={newBook.title} size="md" className="flex-shrink-0" />
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-semibold text-stone-900 leading-snug">{newBook.title}</h3>
              <p className="text-sm text-stone-500 mt-0.5">{newBook.author}</p>
            </div>
          </div>
          <p className="text-sm text-stone-600 pt-1">How did you feel about this book overall?</p>
          {(['bad', 'okay', 'loved'] as Tier[]).map(tier => (
            <button
              key={tier}
              onClick={() => handleTierSelect(tier)}
              className="w-full flex items-center gap-4 p-4 border-2 border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
            >
              <span className="text-2xl leading-none">
                {tier === 'bad' ? '😕' : tier === 'okay' ? '😐' : '😍'}
              </span>
              <div>
                <p className="font-medium text-stone-900 text-sm">
                  {tier === 'bad' ? "Didn't enjoy it" : tier === 'okay' ? 'It was okay' : 'Loved it'}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Seeds at {tier === 'bad' ? '2' : tier === 'okay' ? '5' : '8'} / 10
                </p>
              </div>
            </button>
          ))}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </Modal>
    );
  }

  if (phase === 'opinions') {
    return (
      <Modal title="What readers are saying" onClose={onDone} wide>
        <OpinionReviewStep
          reviewId={reviewId}
          bookId={newBook.id}
          opinions={opinions}
          fetchError={opinionsError}
          fetching={opinionsFetching}
          onDone={handleOpinionsDone}
        />
      </Modal>
    );
  }

  if (phase === 'saving') {
    return (
      <Modal title="Updating rankings…" onClose={() => {}}>
        <div className="p-10 flex flex-col items-center gap-3 text-stone-500">
          <span className="animate-spin text-2xl">⟳</span>
          <p className="text-sm">Recalculating scores across your library…</p>
        </div>
      </Modal>
    );
  }

  const opponent = opponents[currentIndex];
  const progress = currentIndex + 1;
  const total = opponents.length;

  return (
    <Modal title="Head-to-head" onClose={onDone} wide>
      <div className="p-6 space-y-5">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 rounded-full transition-all duration-300"
              style={{ width: `${(currentIndex / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-stone-400 tabular-nums">{progress} / {total}</span>
        </div>

        <p className="text-sm text-stone-600 text-center">Which did you prefer?</p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleMatchupResult('win', true)}
            className="group flex flex-col items-center gap-3 p-4 border-2 border-stone-200 rounded-2xl hover:border-stone-900 hover:bg-stone-50 transition-all"
          >
            <BookCover url={seededBook.cover_image_url} title={seededBook.title} size="lg" />
            <div className="text-center">
              <p className="text-xs font-semibold text-stone-900 line-clamp-2 leading-snug">{seededBook.title}</p>
              <p className="text-xs text-stone-400 mt-0.5 truncate">{seededBook.author}</p>
              <p className="text-xs text-stone-500 mt-0.5">{seededBook.elo_score.toFixed(1)} / 10</p>
            </div>
            <span className="text-xs text-stone-500 group-hover:text-stone-900 font-medium transition-colors">
              I preferred this
            </span>
          </button>

          <button
            onClick={() => handleMatchupResult('win', false)}
            className="group flex flex-col items-center gap-3 p-4 border-2 border-stone-200 rounded-2xl hover:border-stone-900 hover:bg-stone-50 transition-all"
          >
            <BookCover url={opponent.cover_image_url} title={opponent.title} size="lg" />
            <div className="text-center">
              <p className="text-xs font-semibold text-stone-900 line-clamp-2 leading-snug">{opponent.title}</p>
              <p className="text-xs text-stone-400 mt-0.5 truncate">{opponent.author}</p>
              <p className="text-xs text-stone-500 mt-0.5">{opponent.elo_score.toFixed(1)} / 10</p>
            </div>
            <span className="text-xs text-stone-500 group-hover:text-stone-900 font-medium transition-colors">
              I preferred this
            </span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleMatchupResult('too_close', true)}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Too close to call
          </button>
          <button
            onClick={() => handleMatchupResult('skip', true)}
            className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-400 hover:bg-stone-50 transition-colors flex items-center gap-1.5"
          >
            <SkipForward size={14} />
            Skip
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
