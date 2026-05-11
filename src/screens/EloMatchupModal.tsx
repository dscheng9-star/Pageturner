import { useState } from 'react';
import { Check, SkipForward } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import { supabase } from '../lib/supabase';
import {
  tierSeedElo,
  eloToScore,
  scoreToElo,
  selectMatchupCandidates,
  recalculateEloFromMatchups,
} from '../lib/elo';
import type { Book, MatchupResultType } from '../lib/database.types';

type Tier = 'bad' | 'okay' | 'loved';

interface EloMatchupModalProps {
  newBook: Book;
  library: Book[];
  onDone: () => void;
}

function matchupCount(librarySize: number): number {
  if (librarySize < 10) return 4;
  if (librarySize < 25) return 6;
  return 8;
}

export default function EloMatchupModal({ newBook, library, onDone }: EloMatchupModalProps) {
  const [phase, setPhase] = useState<'tier' | 'matchup' | 'saving'>('tier');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [opponents, setOpponents] = useState<Book[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleTierSelect(tier: Tier) {
    const seedElo = tierSeedElo(tier);
    const seedScore = eloToScore(seedElo);

    // Persist initial ELO seed score
    await supabase.from('books').update({ elo_score: seedScore }).eq('id', newBook.id);

    const seededBook = { ...newBook, elo_score: seedScore };
    const count = matchupCount(library.length);
    const candidates = selectMatchupCandidates(seededBook, library, count);

    if (candidates.length === 0) {
      onDone();
      return;
    }

    setOpponents(candidates);
    setPhase('matchup');
  }

  async function handleMatchupResult(result: MatchupResultType, winnerIsLeft: boolean) {
    const opponent = opponents[currentIndex];
    const isLastMatchup = currentIndex >= opponents.length - 1;

    // Record matchup: for 'win', winner/loser are meaningful; for 'too_close'/'skip',
    // we store newBook as winner_book_id and opponent as loser_book_id as a convention.
    let winnerBookId: string;
    let loserBookId: string;

    if (result === 'win') {
      winnerBookId = winnerIsLeft ? newBook.id : opponent.id;
      loserBookId = winnerIsLeft ? opponent.id : newBook.id;
    } else {
      winnerBookId = newBook.id;
      loserBookId = opponent.id;
    }

    if (result !== 'skip') {
      const { error: insertErr } = await supabase.from('matchups').insert({
        winner_book_id: winnerBookId,
        loser_book_id: loserBookId,
        result_type: result,
      });
      if (insertErr) {
        setError(insertErr.message);
        return;
      }
    }

    if (isLastMatchup) {
      setSaving(true);
      setPhase('saving');
      try {
        // Reload all books for full recalculation
        const { data: allBooks } = await supabase.from('books').select('*');
        if (allBooks) await recalculateEloFromMatchups(allBooks);
      } catch (e) {
        console.error('ELO recalc error:', e);
      } finally {
        setSaving(false);
        onDone();
      }
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
          <button
            onClick={() => handleTierSelect('bad')}
            className="w-full flex items-center gap-4 p-4 border-2 border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
          >
            <span className="text-2xl leading-none">😕</span>
            <div>
              <p className="font-medium text-stone-900 text-sm">Didn't enjoy it</p>
              <p className="text-xs text-stone-400 mt-0.5">Seeds at 2 / 10</p>
            </div>
          </button>
          <button
            onClick={() => handleTierSelect('okay')}
            className="w-full flex items-center gap-4 p-4 border-2 border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
          >
            <span className="text-2xl leading-none">😐</span>
            <div>
              <p className="font-medium text-stone-900 text-sm">It was okay</p>
              <p className="text-xs text-stone-400 mt-0.5">Seeds at 5 / 10</p>
            </div>
          </button>
          <button
            onClick={() => handleTierSelect('loved')}
            className="w-full flex items-center gap-4 p-4 border-2 border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
          >
            <span className="text-2xl leading-none">😍</span>
            <div>
              <p className="font-medium text-stone-900 text-sm">Loved it</p>
              <p className="text-xs text-stone-400 mt-0.5">Seeds at 8 / 10</p>
            </div>
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
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
          {/* Left: new book */}
          <button
            onClick={() => handleMatchupResult('win', true)}
            className="group flex flex-col items-center gap-3 p-4 border-2 border-stone-200 rounded-2xl hover:border-stone-900 hover:bg-stone-50 transition-all"
          >
            <BookCover url={newBook.cover_image_url} title={newBook.title} size="lg" />
            <div className="text-center">
              <p className="text-xs font-semibold text-stone-900 line-clamp-2 leading-snug">{newBook.title}</p>
              <p className="text-xs text-stone-400 mt-0.5 truncate">{newBook.author}</p>
              <p className="text-xs text-stone-500 mt-0.5">{eloToScore(scoreToElo(newBook.elo_score)).toFixed(1)} / 10</p>
            </div>
            <span className="text-xs text-stone-500 group-hover:text-stone-900 font-medium transition-colors">I preferred this</span>
          </button>

          {/* Right: opponent */}
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
            <span className="text-xs text-stone-500 group-hover:text-stone-900 font-medium transition-colors">I preferred this</span>
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
