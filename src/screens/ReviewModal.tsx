import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Modal from '../components/Modal';
import BookCover from '../components/BookCover';
import StarRating from '../components/StarRating';
import { supabase } from '../lib/supabase';
import type { Book, ReviewStatus, ReviewEntryType } from '../lib/database.types';
import type { GoogleBook } from '../lib/googleBooks';
import { extractCoverUrl, extractIsbn, extractGenre } from '../lib/googleBooks';

type Mode = 'choose' | 'just_finished' | 'already_read' | 'want_to_read' | 'quick' | 'deep';

interface ReviewModalProps {
  googleBook?: GoogleBook;
  existingBook?: Book;
  isReread?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReviewModal({ googleBook, existingBook, isReread = false, onClose, onSaved }: ReviewModalProps) {
  const [mode, setMode] = useState<Mode>(isReread ? 'choose' : 'choose');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [starRating, setStarRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [dateFinished, setDateFinished] = useState('');
  const [genre, setGenre] = useState(existingBook?.genre ?? (googleBook ? extractGenre(googleBook) : '') ?? '');

  const title = existingBook?.title ?? googleBook?.volumeInfo.title ?? '';
  const author = existingBook?.author ?? googleBook?.volumeInfo.authors?.join(', ') ?? '';
  const coverUrl = existingBook?.cover_image_url ?? (googleBook ? extractCoverUrl(googleBook) : null);

  async function getOrCreateBook(): Promise<string> {
    if (existingBook) return existingBook.id;

    if (!googleBook) throw new Error('No book data');

    const info = googleBook.volumeInfo;
    const { data, error } = await supabase
      .from('books')
      .insert({
        title: info.title,
        author: info.authors?.join(', ') ?? 'Unknown',
        cover_image_url: extractCoverUrl(googleBook),
        description: info.description ?? null,
        genre: genre || extractGenre(googleBook),
        isbn: extractIsbn(googleBook),
        series_name: null,
        series_number: null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async function handleSave(status: ReviewStatus, entryType: ReviewEntryType) {
    setSaving(true);
    setError('');
    try {
      const bookId = await getOrCreateBook();
      const { error: revErr } = await supabase.from('reviews').insert({
        book_id: bookId,
        status,
        entry_type: entryType,
        star_rating: starRating,
        review_text: reviewText || null,
        read_count: 1,
        date_finished: dateFinished || null,
        is_reread: isReread,
      });
      if (revErr) throw revErr;
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const bookHeader = (
    <div className="flex gap-4 p-6 border-b border-stone-100">
      <BookCover url={coverUrl} title={title} size="md" className="flex-shrink-0" />
      <div className="flex-1 min-w-0 pt-1">
        <h3 className="font-semibold text-stone-900 leading-snug">{title}</h3>
        <p className="text-sm text-stone-500 mt-0.5">{author}</p>
        {isReread && (
          <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Re-read</span>
        )}
      </div>
    </div>
  );

  if (mode === 'choose') {
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
              <p className="text-xs text-stone-400 mt-0.5">Add to backlog with a quick rating</p>
            </div>
          </button>
          <button
            onClick={() => handleSave('want_to_read', 'quick')}
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
              <p className="text-xs text-stone-400 mt-0.5">Rating + short thoughts</p>
            </button>
            <button
              onClick={() => setMode('deep')}
              className="flex-1 p-3 border-2 border-stone-200 rounded-xl hover:border-stone-900 transition-colors text-left"
            >
              <p className="font-medium text-sm text-stone-900">Deep review</p>
              <p className="text-xs text-stone-400 mt-0.5">Full breakdown</p>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (mode === 'quick') {
    return (
      <Modal title="Quick Review" onClose={onClose}>
        {bookHeader}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Your rating</label>
            <StarRating value={starRating} onChange={setStarRating} size="lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Quick thoughts <span className="text-stone-400 font-normal">(optional)</span></label>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={4}
              placeholder="What did you think?"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Date finished <span className="text-stone-400 font-normal">(optional)</span></label>
            <input
              type="date"
              value={dateFinished}
              onChange={e => setDateFinished(e.target.value)}
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={() => handleSave('read', 'quick')}
            disabled={saving || !starRating}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : <><Check size={16} /> Save Review</>}
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
            <label className="block text-sm font-medium text-stone-700 mb-2">Your rating</label>
            <StarRating value={starRating} onChange={setStarRating} size="lg" />
          </div>
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
            <label className="block text-sm font-medium text-stone-700 mb-2">Date finished <span className="text-stone-400 font-normal">(optional)</span></label>
            <input
              type="date"
              value={dateFinished}
              onChange={e => setDateFinished(e.target.value)}
              className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={() => handleSave('read', 'deep')}
            disabled={saving || !starRating}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : <><Check size={16} /> Save Review</>}
          </button>
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
            <label className="block text-sm font-medium text-stone-700 mb-2">Your rating</label>
            <StarRating value={starRating} onChange={setStarRating} size="lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Genre <span className="text-stone-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={genre}
              onChange={e => setGenre(e.target.value)}
              placeholder="e.g. Fiction, Mystery, Sci-Fi"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Notes <span className="text-stone-400 font-normal">(optional)</span></label>
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
            onClick={() => handleSave('backlog', 'backlog_lite')}
            disabled={saving || !starRating}
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : <><Check size={16} /> Add to Backlog</>}
          </button>
        </div>
      </Modal>
    );
  }

  return null;
}
