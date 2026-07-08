import { useState } from 'react';
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BookOpinions } from '../lib/claudeOpinions';
import type { OpinionResponse } from '../lib/database.types';

interface OpinionCard {
  text: string;
  type: 'popular' | 'unpopular';
  response: OpinionResponse | null;
}

interface OpinionReviewStepProps {
  reviewId: string;
  bookId: string;
  opinions: BookOpinions | null;
  fetchError: string | null;
  fetching: boolean;
  onDone: (userAddedOpinion: string) => void;
}

export default function OpinionReviewStep({
  reviewId,
  bookId,
  opinions,
  fetchError,
  fetching,
  onDone,
}: OpinionReviewStepProps) {
  const [cards, setCards] = useState<OpinionCard[] | null>(null);
  const [userTake, setUserTake] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialise cards once opinions arrive
  if (opinions && !cards) {
    setCards([
      ...opinions.popular_opinions.map(text => ({ text, type: 'popular' as const, response: null })),
      ...opinions.unpopular_opinions.map(text => ({ text, type: 'unpopular' as const, response: null })),
    ]);
  }

  function setResponse(index: number, response: OpinionResponse) {
    setCards(prev => prev!.map((c, i) => (i === index ? { ...c, response } : c)));
  }

  async function handleContinue() {
    if (!cards) {
      onDone(userTake);
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;

    const inserts = cards
      .filter(c => c.response !== null)
      .map(c => ({
        review_id: reviewId,
        book_id: bookId,
        user_id: userId,
        statement_text: c.text,
        opinion_type: c.type,
        response: c.response!,
      }));

    if (inserts.length > 0) {
      await supabase.from('opinion_signals').insert(inserts);
    }
    setSaving(false);
    onDone(userTake);
  }

  if (fetching) {
    return (
      <div className="p-8 flex flex-col items-center gap-3 text-stone-500">
        <Loader2 size={22} className="animate-spin text-stone-400" />
        <p className="text-sm">Fetching what readers are saying…</p>
      </div>
    );
  }

  if (fetchError && !opinions) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">Couldn't fetch opinions right now — you can still complete your review.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Anything the reviews missed? Add your own take.{' '}
            <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={userTake}
            onChange={e => setUserTake(e.target.value)}
            rows={3}
            placeholder="Your own perspective…"
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
        <button
          onClick={handleContinue}
          className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
        >
          Continue to ranking <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  if (!cards) return null;

  const allAnswered = cards.every(c => c.response !== null);

  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-stone-600">Here's what other readers think. Do you agree?</p>

      <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
        {cards.map((card, i) => (
          <div key={i} className="border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              {card.type === 'unpopular' && (
                <span className="flex-shrink-0 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium mt-0.5">
                  minority opinion
                </span>
              )}
              <p className="text-sm text-stone-800 leading-snug flex-1">{card.text}</p>
            </div>
            <div className="flex gap-2">
              {(['agree', 'neutral', 'disagree'] as OpinionResponse[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setResponse(i, opt)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                    card.response === opt
                      ? opt === 'agree'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : opt === 'disagree'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-stone-700 text-white border-stone-700'
                      : 'border-stone-200 text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Anything the reviews missed? Add your own take.{' '}
          <span className="text-stone-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={userTake}
          onChange={e => setUserTake(e.target.value)}
          rows={3}
          placeholder="Your own perspective…"
          className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <button
        onClick={handleContinue}
        disabled={saving}
        className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <><Loader2 size={16} className="animate-spin" /> Saving…</>
        ) : (
          <>Continue to ranking <ChevronRight size={16} /></>
        )}
      </button>

      {!allAnswered && (
        <p className="text-xs text-stone-400 text-center">You can skip any opinions you're unsure about</p>
      )}
    </div>
  );
}
