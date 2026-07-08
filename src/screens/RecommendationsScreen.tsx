import { useState } from 'react';
import { Sparkles, Loader2, BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Recommendation {
  title: string;
  author: string;
  reason: string;
}

async function fetchRecommendations(): Promise<Recommendation[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key configured');

  // Fetch top 5 books by ELO score that have been read/backlogged
  const { data: books } = await supabase
    .from('books')
    .select('title, author, elo_score, genre')
    .order('elo_score', { ascending: false })
    .limit(5);

  if (!books || books.length === 0) {
    throw new Error('No rated books in your library yet. Add and rate some books first.');
  }

  const bookList = books
    .map((b, i) => `${i + 1}. "${b.title}" by ${b.author} (score: ${b.elo_score.toFixed(1)}/10${b.genre ? `, genre: ${b.genre}` : ''})`)
    .join('\n');

  const prompt = `Based on this reader's top-rated books:\n${bookList}\n\nRecommend 3 books they would likely enjoy. Respond with ONLY valid JSON (no markdown, no backticks) in exactly this format:\n[\n  {\n    "title": "Book Title",\n    "author": "Author Name",\n    "reason": "One sentence explaining why they'd enjoy this based on their taste."\n  }\n]`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API error ${response.status}`);

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Empty response from Gemini');

  // Strip possible markdown fences
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned) as Recommendation[];
  if (!Array.isArray(parsed)) throw new Error('Unexpected response shape');
  return parsed;
}

export default function RecommendationsScreen() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchRecommendations();
      setRecommendations(results);
      setHasFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={26} className="text-stone-500" />
          </div>
          <h2 className="text-2xl font-semibold text-stone-900 mb-2">For You</h2>
          <p className="text-stone-500 text-sm leading-relaxed max-w-sm mx-auto">
            AI-powered recommendations based on your highest-rated books.
          </p>
        </div>

        {/* Suggest button */}
        {!hasFetched && !loading && (
          <div className="flex justify-center mb-8">
            <button
              onClick={handleSuggest}
              className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
            >
              <Sparkles size={16} />
              Suggest my next read
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-stone-500">
            <Loader2 size={24} className="animate-spin text-stone-400" />
            <p className="text-sm">Analysing your taste…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {hasFetched && recommendations.length > 0 && (
          <div className="space-y-4">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex gap-4 p-5 border border-stone-200 rounded-2xl hover:border-stone-300 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-16 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen size={20} className="text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 leading-snug">{rec.title}</p>
                  <p className="text-sm text-stone-500 mt-0.5">{rec.author}</p>
                  <p className="text-sm text-stone-600 mt-2 leading-relaxed">{rec.reason}</p>
                </div>
              </div>
            ))}

            <div className="pt-2 flex justify-center">
              <button
                onClick={handleSuggest}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                Refresh suggestions
              </button>
            </div>
          </div>
        )}

        {/* Empty state after fetch with no results */}
        {hasFetched && !loading && recommendations.length === 0 && !error && (
          <div className="text-center py-10 text-stone-400">
            <p className="text-sm">No recommendations returned. Try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
