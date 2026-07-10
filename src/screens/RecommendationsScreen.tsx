import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, AlertCircle, Star, BookOpen, X, BookmarkPlus, BookCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { assembleTasteProfile } from '../lib/tasteProfile';
import { searchBooks, extractCoverUrl, extractIsbn } from '../lib/googleBooks';

interface Recommendation {
  title: string;
  author: string;
  genre: string;
  reason: string;
  confidence: 'high' | 'medium';
}

const MIN_REVIEWS_REQUIRED = 5;

const LOADING_MESSAGES = [
  'Analyzing your reading taste...',
  'Reviewing your top rated books...',
  'Finding your next favorite...',
  'Almost there...',
];

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' }) {
  const isHigh = confidence === 'high';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isHigh ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
      }`}
    >
      <Star
        size={10}
        className={isHigh ? 'fill-emerald-500 text-emerald-500' : 'text-stone-400'}
        fill={isHigh ? 'currentColor' : 'none'}
      />
      {isHigh ? 'Strong match' : 'Good match'}
    </span>
  );
}

type ActionState = { type: 'want_to_read' | 'backlog' } | null;

function RecommendationCard({
  rec,
  onAddToWantToRead,
  onAddToBacklog,
  onDismiss,
  actionState,
  successMsg,
}: {
  rec: Recommendation & { _id: string };
  onAddToWantToRead: (rec: Recommendation & { _id: string }) => void;
  onAddToBacklog: (rec: Recommendation & { _id: string }) => void;
  onDismiss: (id: string) => void;
  actionState: ActionState;
  successMsg: string | null;
}) {
  const isAddingWTR     = actionState?.type === 'want_to_read';
  const isAddingBacklog = actionState?.type === 'backlog';
  const isBusy          = actionState !== null;

  return (
    <div className="relative bg-white border border-stone-200 rounded-2xl p-5 hover:border-stone-300 hover:shadow-sm transition-all">
      <button
        onClick={() => onDismiss(rec._id)}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      <div className="flex gap-4 pr-6">
        <div className="w-10 h-14 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-stone-400" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold text-stone-900 leading-snug text-base">{rec.title}</h3>
          <p className="text-sm text-stone-500 mt-0.5">{rec.author}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full font-medium">
              {rec.genre}
            </span>
            <ConfidenceBadge confidence={rec.confidence} />
          </div>
        </div>
      </div>

      <p className="text-sm text-stone-700 leading-relaxed mt-4">{rec.reason}</p>

      {successMsg && (
        <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
          {successMsg}
        </div>
      )}

      <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
        <button
          onClick={() => onAddToWantToRead(rec)}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-60 transition-colors"
        >
          {isAddingWTR ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
          {isAddingWTR ? 'Adding...' : 'Want to Read'}
        </button>
        <button
          onClick={() => onAddToBacklog(rec)}
          disabled={isBusy}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-60 transition-colors"
        >
          {isAddingBacklog ? <Loader2 size={13} className="animate-spin" /> : <BookCheck size={13} />}
          {isAddingBacklog ? 'Adding...' : "I've Read This"}
        </button>
        <button
          onClick={() => onDismiss(rec._id)}
          disabled={isBusy}
          className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-400 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-60 transition-colors"
        >
          Not for me
        </button>
      </div>
    </div>
  );
}

function UnlockProgress({ count }: { count: number }) {
  const pct = Math.min((count / MIN_REVIEWS_REQUIRED) * 100, 100);
  return (
    <div className="max-w-xs mx-auto space-y-2 mt-4">
      <div className="flex justify-between text-xs text-stone-500">
        <span>{count} of {MIN_REVIEWS_REQUIRED} reviews</span>
        <span>{MIN_REVIEWS_REQUIRED - count} more to go</span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-stone-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function RecommendationsScreen() {
  const [recs, setRecs]               = useState<(Recommendation & { _id: string })[]>([]);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [loadingMsg, setLoadingMsg]   = useState(LOADING_MESSAGES[0]);
  const [error, setError]             = useState<string | null>(null);
  const [hasFetched, setHasFetched]   = useState(false);
  const [excludedTitles, setExcludedTitles] = useState<string[]>([]);
  // Per-card action state: rec._id → { type, successMsg }
  const [cardActions, setCardActions] = useState<Record<string, { type: 'want_to_read' | 'backlog' } | null>>({});
  const [cardSuccess, setCardSuccess] = useState<Record<string, string | null>>({});

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'complete')
      .then(({ count }) => setCompletedCount(count ?? 0));
  }, []);

  function startLoadingCycle() {
    let i = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    loadingIntervalRef.current = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 3000);
  }

  function stopLoadingCycle() {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  }

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    startLoadingCycle();

    try {
      const result = await assembleTasteProfile(supabase);
      if (!result) throw new Error('No completed reviews found. Review at least 5 books to unlock recommendations.');

      setCompletedCount(result.completedReviewCount);

      const res = await fetch('/api/get-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasteProfile: result.profile, excludedTitles }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);

      const newRecs: Recommendation[] = body.recommendations;
      const stamped = newRecs.map((r, i) => ({ ...r, _id: `${Date.now()}-${i}` }));
      setRecs(stamped);
      setHasFetched(true);
      setCardActions({});
      setCardSuccess({});
      setExcludedTitles(prev => [...new Set([...prev, ...newRecs.map(r => r.title)])]);

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id ?? null;
      supabase.from('recommendations').insert(
        newRecs.map(r => ({
          user_id: userId,
          suggested_book_title: r.title,
          suggested_author: r.author,
          reason_text: r.reason,
          was_acted_on: false,
        }))
      ).then(({ error: e }) => { if (e) console.error('[recommendations insert]', e); });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      stopLoadingCycle();
      setLoading(false);
    }
  }

  function handleDismiss(id: string) {
    setRecs(prev => prev.filter(r => r._id !== id));
  }

  async function getOrCreateBook(
    userId: string,
    title: string,
    author: string,
    genre: string
  ): Promise<string> {
    const { data: existing } = await supabase
      .from('books')
      .select('id')
      .eq('title', title)
      .eq('author', author)
      .maybeSingle();

    if (existing) return existing.id;

    // Try to find metadata via Google Books
    let coverUrl: string | null = null;
    let description: string | null = null;
    let isbn: string | null = null;
    try {
      const results = await searchBooks(`${title} ${author}`);
      const match = results[0];
      if (match) {
        coverUrl    = extractCoverUrl(match);
        description = match.volumeInfo.description ?? null;
        isbn        = extractIsbn(match);
      }
    } catch {
      // proceed with minimal data
    }

    const { data: newBook, error: bookErr } = await supabase
      .from('books')
      .insert({
        user_id: userId,
        title,
        author,
        cover_image_url: coverUrl,
        description,
        genres: genre ? [genre] : [],
        isbn,
        series_name: null,
        series_number: null,
        elo_score: 5.0,
      })
      .select('id')
      .single();
    if (bookErr) throw bookErr;
    return (newBook as { id: string }).id;
  }

  async function markActedOn(title: string, author: string) {
    await supabase
      .from('recommendations')
      .update({ was_acted_on: true })
      .eq('suggested_book_title', title)
      .eq('suggested_author', author)
      .eq('was_acted_on', false);
  }

  async function handleAddToWantToRead(rec: Recommendation & { _id: string }) {
    setCardActions(prev => ({ ...prev, [rec._id]: { type: 'want_to_read' } }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const userId = session.user.id;

      const bookId = await getOrCreateBook(userId, rec.title, rec.author, rec.genre);

      const { error: revErr } = await supabase.from('reviews').insert({
        user_id: userId,
        book_id: bookId,
        status: 'want_to_read',
        entry_type: 'backlog_lite',
        review_status: 'incomplete',
        tier_complete: false,
        opinions_complete: false,
        matchups_complete: false,
        review_text: null,
        user_added_opinion: null,
        read_count: 1,
        date_finished: null,
        is_reread: false,
      });
      if (revErr) throw revErr;

      await markActedOn(rec.title, rec.author);
      handleDismiss(rec._id);
    } catch (e) {
      console.error('[add to want to read]', e);
      setError(e instanceof Error ? e.message : 'Failed to add book');
      setCardActions(prev => ({ ...prev, [rec._id]: null }));
    }
  }

  async function handleAddToBacklog(rec: Recommendation & { _id: string }) {
    setCardActions(prev => ({ ...prev, [rec._id]: { type: 'backlog' } }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const userId = session.user.id;

      const bookId = await getOrCreateBook(userId, rec.title, rec.author, rec.genre);

      const { error: revErr } = await supabase.from('reviews').insert({
        user_id: userId,
        book_id: bookId,
        status: 'backlog',
        entry_type: 'backlog_lite',
        review_status: 'incomplete',
        tier_complete: false,
        opinions_complete: false,
        matchups_complete: false,
        review_text: null,
        user_added_opinion: null,
        read_count: 1,
        date_finished: null,
        is_reread: false,
      });
      if (revErr) throw revErr;

      await markActedOn(rec.title, rec.author);

      setCardActions(prev => ({ ...prev, [rec._id]: null }));
      setCardSuccess(prev => ({
        ...prev,
        [rec._id]: 'Added to your backlog — complete your review anytime',
      }));

      // Dismiss after a short delay so user sees the success message
      setTimeout(() => handleDismiss(rec._id), 2500);
    } catch (e) {
      console.error('[add to backlog]', e);
      setError(e instanceof Error ? e.message : 'Failed to add book');
      setCardActions(prev => ({ ...prev, [rec._id]: null }));
    }
  }

  const belowMinimum = completedCount !== null && completedCount < MIN_REVIEWS_REQUIRED;

  return (
    <div className="flex-1 overflow-y-auto relative">
      <div className="max-w-2xl mx-auto px-6 py-10 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={26} className="text-stone-500" />
          </div>
          <h2 className="text-2xl font-semibold text-stone-900 mb-2">For You</h2>
          <p className="text-stone-500 text-sm leading-relaxed max-w-sm mx-auto">
            {completedCount !== null && completedCount > 0
              ? `Based on your reading taste across ${completedCount} book${completedCount === 1 ? '' : 's'}`
              : 'AI-powered recommendations based on your reading taste'}
          </p>
        </div>

        {/* Below-minimum locked state */}
        {belowMinimum && (
          <div className="text-center py-8 px-6 border border-stone-200 rounded-2xl bg-stone-50">
            <div className="w-11 h-11 rounded-full bg-stone-200 flex items-center justify-center mx-auto mb-3">
              <Sparkles size={20} className="text-stone-400" />
            </div>
            <p className="font-medium text-stone-700 text-sm">
              Add and review at least {MIN_REVIEWS_REQUIRED} books to unlock recommendations
            </p>
            <UnlockProgress count={completedCount ?? 0} />
          </div>
        )}

        {/* Suggest / Refresh button */}
        {!belowMinimum && !loading && (
          <div className="flex justify-center mb-8">
            <button
              onClick={handleSuggest}
              className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
            >
              <Sparkles size={16} />
              {hasFetched ? 'Refresh recommendations' : 'Suggest my next read'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={28} className="animate-spin text-stone-400" />
            <p className="text-sm text-stone-500 transition-all duration-300">{loadingMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Recommendation cards */}
        {recs.length > 0 && (
          <div className="space-y-4">
            {recs.map(rec => (
              <RecommendationCard
                key={rec._id}
                rec={rec}
                onAddToWantToRead={handleAddToWantToRead}
                onAddToBacklog={handleAddToBacklog}
                onDismiss={handleDismiss}
                actionState={cardActions[rec._id] ?? null}
                successMsg={cardSuccess[rec._id] ?? null}
              />
            ))}
          </div>
        )}

        {hasFetched && !loading && recs.length === 0 && !error && (
          <div className="text-center py-10 text-stone-400">
            <p className="text-sm">All caught up! Hit refresh for new suggestions.</p>
          </div>
        )}

        {!belowMinimum && (
          <p className="text-center text-xs text-stone-400 mt-10">
            Recommendations improve as you review more books
          </p>
        )}
      </div>
    </div>
  );
}
