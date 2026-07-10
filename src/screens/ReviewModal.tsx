import { useState } from 'react';
import { Check } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import EloMatchupModal from './EloMatchupModal';
import { supabase } from '../lib/supabase';
import type { Book, Review, ReviewStatus, ReviewEntryType } from '../lib/database.types';
import type { GoogleBook } from '../lib/googleBooks';
import { extractCoverUrl, extractIsbn } from '../lib/googleBooks';

type Mode = 'choose' | 'just_finished' | 'already_read' | 'quick' | 'deep' | 'complete_review';

interface ReviewModalProps {
  googleBook?: GoogleBook;
  existingBook?: Book;
  completeReview?: boolean;
  isReread?: boolean;
  onClose: () => void;
  onSaved: () => void;
  library?: Book[];
}

interface SavedState {
  book: Book;
  review: Review;
}

async function classifyGenre(
  bookTitle: string,
  bookAuthor: string,
  bookDescription: string,
  token: string
): Promise<string[]> {
  const res = await fetch('/.netlify/functions/classify-genre', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bookTitle, bookAuthor, bookDescription }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `classify-genre failed (${res.status})`);
  if (!Array.isArray(body)) throw new Error(`Unexpected response: ${JSON.stringify(body)}`);
  return body;
}

export default function ReviewModal({
  googleBook,
  existingBook,
  completeReview = false,
  isReread = false,
  onClose,
  onSaved,
  library = [],
}: ReviewModalProps) {
  const initialMode: Mode = completeReview ? 'complete_review' : 'choose';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedState, setSavedState] = useState<SavedState | null>(null);

  const [reviewText, setReviewText] = useState('');
  const [dateFinished, setDateFinished] = useState('');

  const title       = existingBook?.title  ?? googleBook?.volumeInfo.title ?? '';
  const author      = existingBook?.author ?? googleBook?.volumeInfo.authors?.join(', ') ?? '';
  const coverUrl    = existingBook?.cover_image_url ?? (googleBook ? extractCoverUrl(googleBook) : null);
  const description = existingBook?.description ?? googleBook?.volumeInfo.description ?? '';

  async function getOrCreateBook(userId: string, accessToken: string): Promise<Book> {
    if (existingBook) return existingBook;
    if (!googleBook) throw new Error('No book data');

    const info = googleBook.volumeInfo;
    const rawGenre = null;
    const payload = {
      user_id: userId,
      title: info.title,
      author: info.authors?.join(', ') ?? 'Unknown',
      cover_image_url: extractCoverUrl(googleBook),
      description: info.description ?? null,
      genres: rawGenre ? [rawGenre] : [],
      isbn: extractIsbn(googleBook) ?? null,
      series_name: null,
      series_number: null,
      elo_score: 5.0,
    };

    console.log('[books insert payload]', payload);

    const { data, error } = await supabase
      .from('books')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[books insert error]', error);
      throw error;
    }

    // Fire-and-forget genre classification
    classifyGenre(info.title, info.authors?.join(', ') ?? '', info.description ?? '', accessToken)
      .then(genres => supabase.from('books').update({ genres }).eq('id', (data as Book).id))
      .catch(err => console.error('[classify-genre]', err));

    return data as Book;
  }

  async function handleSave(status: ReviewStatus, entryType: ReviewEntryType, triggerElo: boolean) {
    setSaving(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated — please sign in again');
      const { id: userId, } = session.user;

      const book = await getOrCreateBook(userId, session.access_token);
      const { data: rev, error: revErr } = await supabase
        .from('reviews')
        .insert({
          user_id: userId,
          book_id: book.id,
          status,
          entry_type: entryType,
          review_status: 'incomplete',
          tier_complete: false,
          opinions_complete: false,
          matchups_complete: false,
          review_text: reviewText || null,
          user_added_opinion: null,
          read_count: 1,
          date_finished: dateFinished || null,
          is_reread: isReread,
        })
        .select('*')
        .single();
      if (revErr) throw revErr;

      if (triggerElo) {
        setSavedState({ book, review: rev as Review });
      } else {
        onSaved();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (savedState) {
    return (
      <EloMatchupModal
        newBook={savedState.book}
        library={library}
        review={savedState.review}
        onDone={onSaved}
      />
    );
  }

  const bookHeader = (
    <div className="flex gap-4 p-6 border-b border-stone-100">
      <BookCover url={coverUrl} title={title} author={author} size="md" className="flex-shrink-0" />
      <div className="flex-1 min-w-0 pt-1">
        <h3 className="font-semibold text-stone-900 leading-snug">{title}</h3>
        <p className="text-sm text-stone-500 mt-0.5">{author}</p>
        {isReread && (
          <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Re-read
          </span>
        )}
        {completeReview && !isReread && (
          <span className="inline-block mt-2 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
            Completing review
          </span>
        )}
      </div>
    </div>
  );

  if (mode === 'quick' || mode === 'complete_review') {
    return (
      <Modal title={mode === 'complete_review' ? 'Complete Review' : 'Quick Review'} onClose={onClose}>
        {bookHeader}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Quick thoughts <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={4}
              placeholder="What did you think?"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Date finished <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dateFinished}
              onChange={e => setDateFinished(e.target.value)}
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={() => handleSave('read', 'quick', true)}
            disabled={saving}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : <><Check size={16} /> Save &amp; Rank</>}
          </button>
        </div>
      </Modal>
    );
  }

  if (mode === 'deep') {
    return (
      <Modal title="Deep Review" onClose={onClose} wide>
        {bookHeader}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Your review</label>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={8}
              placeholder="Share your full thoughts on this book…"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Date finished <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dateFinished}
              onChange={e => setDateFinished(e.target.value)}
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={() => handleSave('read', 'deep', true)}
            disabled={saving}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : <><Check size={16} /> Save &amp; Rank</>}
          </button>
        </div>
      </Modal>
    );
  }

  if (mode === 'just_finished') {
    return (
      <Modal title="I just finished this" onClose={onClose}>
        {bookHeader}
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => setMode('quick')}
              className="flex-1 p-3 border-2 border-stone-200 rounded-xl hover:border-stone-900 transition-colors text-left"
            >
              <p className="font-medium text-sm text-stone-900">Quick review</p>
              <p className="text-xs text-stone-400 mt-0.5">Short thoughts + ELO ranking</p>
            </button>
            <button
              onClick={() => setMode('deep')}
              className="flex-1 p-3 border-2 border-stone-200 rounded-xl hover:border-stone-900 transition-colors text-left"
            >
              <p className="font-medium text-sm text-stone-900">Deep review</p>
              <p className="text-xs text-stone-400 mt-0.5">Full breakdown + ELO ranking</p>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (mode === 'already_read') {
    return (
      <Modal title="Backlog Entry" onClose={onClose}>
        {bookHeader}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Notes <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={3}
              placeholder="Brief notes…"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={() => handleSave('backlog', 'backlog_lite', true)}
            disabled={saving}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : <><Check size={16} /> Add &amp; Rank</>}
          </button>
        </div>
      </Modal>
    );
  }

  // choose (default)
  return (
    <Modal title="Log this book" onClose={onClose}>
      {bookHeader}
      <div className="p-6 space-y-3">
        <p className="text-sm text-stone-500 mb-4">How would you like to add this book?</p>
        <button
          onClick={() => setMode('just_finished')}
          className="w-full flex items-start gap-3 p-4 border border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
        >
          <span className="text-2xl">📖</span>
          <div>
            <p className="font-medium text-stone-900 text-sm">I just finished this</p>
            <p className="text-xs text-stone-400 mt-0.5">Write a quick or deep review</p>
          </div>
        </button>
        <button
          onClick={() => setMode('already_read')}
          className="w-full flex items-start gap-3 p-4 border border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left"
        >
          <span className="text-2xl">📚</span>
          <div>
            <p className="font-medium text-stone-900 text-sm">I've already read this</p>
            <p className="text-xs text-stone-400 mt-0.5">Add to backlog with a quick note</p>
          </div>
        </button>
        <button
          onClick={() => handleSave('want_to_read', 'quick', false)}
          disabled={saving}
          className="w-full flex items-start gap-3 p-4 border border-stone-200 rounded-xl hover:border-stone-400 hover:bg-stone-50 transition-all text-left disabled:opacity-50"
        >
          <span className="text-2xl">🔖</span>
          <div>
            <p className="font-medium text-stone-900 text-sm">I want to read this</p>
            <p className="text-xs text-stone-400 mt-0.5">Save to your reading list</p>
          </div>
        </button>
      </div>
    </Modal>
  );
}
