import { useState, useEffect } from 'react';
import { SkipForward, Check, Lock } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import OpinionReviewStep from './OpinionReviewStep';
import { supabase } from '../lib/supabase';
import {
  tierBucket,
  tierSeedScore,
  getMatchupConfig,
  evaluateStreak,
  shouldContinueSession,
  selectNextOpponent,
  getKFactor,
  recalculateEloFromMatchups,
  calcEloUpdate,
  bucketForScore,
} from '../lib/elo';
import { fetchBookOpinions } from '../lib/claudeOpinions';
import { getBookGenreGroup } from '../lib/genreGroups';
import type { Book, Review, MatchupResultType } from '../lib/database.types';
import type { BookOpinions } from '../lib/claudeOpinions';
import type { MatchupRecord, StreakState } from '../lib/elo';

type Tier = 'bad' | 'okay' | 'loved';
type Phase = 'tier' | 'opinions' | 'matchup' | 'saving';

interface EloMatchupModalProps {
  newBook: Book;
  library: Book[];
  review: Review;
  isResuming?: boolean;
  onDone: () => void;
}

// --- Step progress indicator ---
function StepProgress({
  tierDone,
  opinionsDone,
  matchupsDone,
}: {
  tierDone: boolean;
  opinionsDone: boolean;
  matchupsDone: boolean;
}) {
  const steps = [
    { label: 'Rate', done: tierDone },
    { label: 'Opinions', done: opinionsDone },
    { label: 'Rank', done: matchupsDone },
  ];
  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b border-stone-100 bg-stone-50">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step.done
                  ? 'bg-emerald-500 text-white'
                  : 'bg-stone-200 text-stone-500'
              }`}
            >
              {step.done ? <Check size={11} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${step.done ? 'text-emerald-600' : 'text-stone-400'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px mx-2 ${step.done ? 'bg-emerald-300' : 'bg-stone-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Resume banner ---
function ResumeBanner({
  dateSet,
  tierDone,
  opinionsDone,
  matchupsDone,
}: {
  dateSet: boolean;
  tierDone: boolean;
  opinionsDone: boolean;
  matchupsDone: boolean;
}) {
  const steps = [
    { label: 'Date', done: dateSet },
    { label: 'Tier placement', done: tierDone },
    { label: 'Opinions', done: opinionsDone },
    { label: 'Head to head', done: matchupsDone },
  ];
  return (
    <div className="mx-6 mt-4 mb-1 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <p className="text-xs font-semibold text-amber-800 mb-2">Continuing your review</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {steps.map(step => (
          <span key={step.label} className="flex items-center gap-1 text-xs text-amber-700">
            {step.done
              ? <Check size={11} className="text-emerald-500" />
              : <span className="w-2.5 h-2.5 rounded-full border border-amber-400 inline-block" />}
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Lock review confirmation ---
function LockConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 className="font-semibold text-stone-900">Lock this review?</h3>
        <p className="text-sm text-stone-600 leading-relaxed">
          Lock this review without completing it? You won't be able to edit it but can still add a new review entry for this book.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Lock it
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Adaptive status label ---
function adaptiveStatusLabel(streak: StreakState, count: number, wrappingUp: boolean): string {
  if (wrappingUp) return 'Range found — wrapping up';
  if (streak === 'winning_streak') return 'On a winning streak — finding the ceiling...';
  if (streak === 'losing_streak')  return 'Finding the floor...';
  return `Finding your book's ranking... (${count} comparison${count === 1 ? '' : 's'} so far)`;
}

export default function EloMatchupModal({ newBook, library, review, isResuming = false, onDone }: EloMatchupModalProps) {
  const resumePhase = (): Phase => {
    if (!review.tier_complete)     return 'tier';
    if (!review.opinions_complete) return 'opinions';
    if (!review.matchups_complete) return 'matchup';
    return 'matchup';
  };

  const [phase, setPhase] = useState<Phase>(resumePhase);
  const [seededBook, setSeededBook] = useState<Book>(newBook);
  const [error, setError] = useState('');
  const [showLockConfirm, setShowLockConfirm] = useState(false);

  // Step completion state (start from review's current values)
  const [tierDone, setTierDone]         = useState(review.tier_complete);
  const [opinionsDone, setOpinionsDone] = useState(review.opinions_complete);
  const [matchupsDone, setMatchupsDone] = useState(review.matchups_complete);

  // Adaptive session state
  const config = getMatchupConfig(library.length);
  const [results, setResults]       = useState<MatchupRecord[]>([]);
  const [opponent, setOpponent]     = useState<Book | null>(null);
  const [wrappingUp, setWrappingUp] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  // Opinion fetching — starts on mount
  const [opinions, setOpinions]             = useState<BookOpinions | null>(null);
  const [opinionsFetching, setOpinionsFetching] = useState(true);
  const [opinionsError, setOpinionsError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOpinionsFetching(true);
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token ?? '';
      return fetchBookOpinions(newBook.title, newBook.author, token);
    })
      .then(result => { if (!cancelled) setOpinions(result); })
      .catch(err   => { if (!cancelled) setOpinionsError(err instanceof Error ? err.message : 'Failed'); })
      .finally(()  => { if (!cancelled) setOpinionsFetching(false); });
    return () => { cancelled = true; };
  }, [newBook.title, newBook.author]);

  // When entering matchup phase, pick the first opponent
  useEffect(() => {
    if (phase !== 'matchup' || sessionDone) return;
    const next = selectNextOpponent(seededBook, library, [], library);
    setOpponent(next);
    if (!next) setSessionDone(true);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markReviewComplete(updates: {
    tier_complete?: boolean;
    opinions_complete?: boolean;
    matchups_complete?: boolean;
    review_status?: string;
  }) {
    await supabase.from('reviews').update(updates).eq('id', review.id);
  }

  async function handleTierSelect(tier: Tier) {
    const bucket    = tierBucket(tier);
    const seedScore = tierSeedScore(tier);
    await supabase
      .from('books')
      .update({ elo_score: seedScore, tier: bucket })
      .eq('id', newBook.id);

    const seeded = { ...newBook, elo_score: seedScore, tier: bucket };
    setSeededBook(seeded);
    setTierDone(true);
    await markReviewComplete({ tier_complete: true });
    setPhase('opinions');
  }

  async function handleOpinionsDone(userAddedOpinion: string) {
    if (userAddedOpinion.trim()) {
      await supabase
        .from('reviews')
        .update({ user_added_opinion: userAddedOpinion.trim() })
        .eq('id', review.id);
    }
    setOpinionsDone(true);
    await markReviewComplete({ opinions_complete: true });

    // Check if there are any eligible opponents before entering matchup phase
    const firstOpponent = selectNextOpponent(seededBook, library, [], library);
    if (!firstOpponent) {
      setMatchupsDone(true);
      await markReviewComplete({ matchups_complete: true, review_status: 'complete' });
      onDone();
    } else {
      setOpponent(firstOpponent);
      setPhase('matchup');
    }
  }

  async function handleMatchupResult(result: MatchupResultType, winnerIsLeft: boolean) {
    if (!opponent) return;

    const isSkip  = result === 'skip';
    const outcome = isSkip ? null : (winnerIsLeft ? 'win' : 'loss') as 'win' | 'loss';

    if (!isSkip) {
      const winnerId = winnerIsLeft ? seededBook.id : opponent.id;
      const loserId  = winnerIsLeft ? opponent.id   : seededBook.id;

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;

      const { error: insertErr } = await supabase.from('matchups').insert({
        winner_book_id: winnerId,
        loser_book_id:  loserId,
        result_type:    result,
        user_id:        userId,
      });
      if (insertErr) { setError(insertErr.message); return; }

      // Streak-aware K factor for faster convergence
      const streak  = evaluateStreak(results);
      const wBucket = seededBook.tier ?? bucketForScore(seededBook.elo_score);
      const oBucket = opponent.tier   ?? bucketForScore(opponent.elo_score);
      const k       = getKFactor(wBucket, oBucket, streak, results.length + 1);

      // Always update seededBook's in-memory score so adaptive targeting stays accurate.
      // calcEloUpdate(A=seeded, B=opponent, result='win') means A won.
      if (winnerIsLeft) {
        // seededBook won
        const { newA } = calcEloUpdate(seededBook.elo_score, opponent.elo_score, wBucket, oBucket, result, k);
        setSeededBook(b => ({ ...b, elo_score: newA }));
      } else {
        // opponent won — compute from opponent's perspective, take newB as seeded's new score
        const { newB } = calcEloUpdate(opponent.elo_score, seededBook.elo_score, oBucket, wBucket, result, k);
        setSeededBook(b => ({ ...b, elo_score: newB }));
      }
    }

    // Build new results array
    const newRecord: MatchupRecord = { outcome: outcome ?? 'draw', opponentId: opponent.id };
    const newResults = isSkip ? results : [...results, newRecord];

    if (!isSkip) {
      setResults(newResults);
    }

    // Decide whether session continues
    const continueSession = isSkip
      ? shouldContinueSession(results, config)
      : shouldContinueSession(newResults, config);

    if (!continueSession) {
      // Wrap up
      setWrappingUp(true);
      setPhase('saving');
      setMatchupsDone(true);
      try {
        const { data: allBooks } = await supabase.from('books').select('*');
        if (allBooks) await recalculateEloFromMatchups(allBooks);
      } catch (e) {
        console.error('ELO recalc error:', e);
      }
      await markReviewComplete({ matchups_complete: true, review_status: 'complete' });
      onDone();
    } else {
      // Pick the next opponent adaptively
      const updatedResults = isSkip ? results : newResults;
      const nextOpponent = selectNextOpponent(
        seededBook,
        library,
        updatedResults,
        library,
      );
      if (!nextOpponent) {
        // No more eligible opponents — finish
        setPhase('saving');
        setMatchupsDone(true);
        try {
          const { data: allBooks } = await supabase.from('books').select('*');
          if (allBooks) await recalculateEloFromMatchups(allBooks);
        } catch (e) {
          console.error('ELO recalc error:', e);
        }
        await markReviewComplete({ matchups_complete: true, review_status: 'complete' });
        onDone();
      } else {
        setOpponent(nextOpponent);
      }
    }
  }

  async function handleLockConfirm() {
    await markReviewComplete({ review_status: 'manually_locked' });
    setShowLockConfirm(false);
    onDone();
  }

  const lockButton = (
    <button
      onClick={() => setShowLockConfirm(true)}
      className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors py-1 px-2"
    >
      <Lock size={12} />
      Lock this review
    </button>
  );

  if (phase === 'tier') {
    return (
      <>
        <Modal title="Rate this book" onClose={onDone}>
          <StepProgress tierDone={tierDone} opinionsDone={opinionsDone} matchupsDone={matchupsDone} />
          {isResuming && (
            <ResumeBanner
              dateSet
              tierDone={tierDone}
              opinionsDone={opinionsDone}
              matchupsDone={matchupsDone}
            />
          )}
          <div className="p-6 space-y-3">
            <div className="flex gap-4 pb-4 border-b border-stone-100">
              <BookCover url={newBook.cover_image_url} title={newBook.title} author={newBook.author} size="md" className="flex-shrink-0" />
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
                    {tier === 'bad' ? 'Scores 0–3.9' : tier === 'okay' ? 'Scores 3.0–6.9' : 'Scores 6.0–10.0'}
                  </p>
                </div>
              </button>
            ))}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-center pt-2">{lockButton}</div>
          </div>
        </Modal>
        {showLockConfirm && (
          <LockConfirmDialog onConfirm={handleLockConfirm} onCancel={() => setShowLockConfirm(false)} />
        )}
      </>
    );
  }

  if (phase === 'opinions') {
    return (
      <>
        <Modal title="What readers are saying" onClose={onDone} wide>
          <StepProgress tierDone={tierDone} opinionsDone={opinionsDone} matchupsDone={matchupsDone} />
          {isResuming && (
            <ResumeBanner
              dateSet
              tierDone={tierDone}
              opinionsDone={opinionsDone}
              matchupsDone={matchupsDone}
            />
          )}
          <OpinionReviewStep
            reviewId={review.id}
            bookId={newBook.id}
            opinions={opinions}
            fetchError={opinionsError}
            fetching={opinionsFetching}
            onDone={handleOpinionsDone}
          />
          <div className="flex justify-center pb-4">{lockButton}</div>
        </Modal>
        {showLockConfirm && (
          <LockConfirmDialog onConfirm={handleLockConfirm} onCancel={() => setShowLockConfirm(false)} />
        )}
      </>
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

  // matchup phase — no eligible opponent
  if (!opponent) {
    return (
      <Modal title="All done" onClose={onDone}>
        <div className="p-8 text-center space-y-4">
          <p className="text-stone-600 text-sm">No eligible books to compare yet. Your score has been saved.</p>
          <button
            onClick={onDone}
            className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  // matchup phase
  const streak       = evaluateStreak(results);
  const statusLabel  = adaptiveStatusLabel(streak, results.length, wrappingUp);
  const progressPct  = Math.min((results.length / config.max) * 100, 100);

  const newGroup      = getBookGenreGroup(newBook, library);
  const opponentGroup = getBookGenreGroup(opponent, library);
  const isCrossGroup  = newGroup !== opponentGroup;
  const contextLabel  = isCrossGroup
    ? 'Cross-genre comparison'
    : `Comparing within ${newGroup.replace(/_/g, ' ').toLowerCase()}`;

  return (
    <>
      <Modal title="Head-to-head" onClose={onDone} wide>
        <StepProgress tierDone={tierDone} opinionsDone={opinionsDone} matchupsDone={matchupsDone} />
        {isResuming && (
          <ResumeBanner
            dateSet
            tierDone={tierDone}
            opinionsDone={opinionsDone}
            matchupsDone={matchupsDone}
          />
        )}
        <div className="p-6 space-y-5">
          {/* Adaptive progress header */}
          <div className="space-y-1.5">
            <p className="text-xs text-stone-500 text-center">{statusLabel}</p>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  streak === 'winning_streak' ? 'bg-emerald-500' :
                  streak === 'losing_streak'  ? 'bg-amber-500'   :
                  'bg-stone-900'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-stone-600 text-center">Which did you prefer?</p>
          <p className="text-xs text-stone-400 text-center -mt-2">{contextLabel}</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleMatchupResult('win', true)}
              className="group flex flex-col items-center gap-3 p-4 border-2 border-stone-200 rounded-2xl hover:border-stone-900 hover:bg-stone-50 transition-all"
            >
              <BookCover url={seededBook.cover_image_url} title={seededBook.title} author={seededBook.author} size="lg" />
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
              <BookCover url={opponent.cover_image_url} title={opponent.title} author={opponent.author} size="lg" />
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
          <div className="flex justify-center">{lockButton}</div>
        </div>
      </Modal>
      {showLockConfirm && (
        <LockConfirmDialog onConfirm={handleLockConfirm} onCancel={() => setShowLockConfirm(false)} />
      )}
    </>
  );
}
