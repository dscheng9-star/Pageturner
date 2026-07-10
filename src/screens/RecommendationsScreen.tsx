import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { assembleTasteProfile } from '../lib/tasteProfile';
import { Bookshelf, Quill } from '../components/BookDecorations';

interface Recommendation {
  title: string;
  author: string;
  genre: string;
  reason: string;
  confidence: 'high' | 'medium';
}

export default function RecommendationsScreen() {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    setRawJson(null);
    setRecommendations(null);

    try {
      setLoadingMsg('Analyzing your reading taste...');
      const tasteProfile = await assembleTasteProfile(supabase);

      if (!tasteProfile) {
        throw new Error('No completed reviews found yet. Finish rating a few books first.');
      }

      setLoadingMsg('Generating recommendations...');
      const res = await fetch('/api/get-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasteProfile }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const recs: Recommendation[] = body.recommendations;
      setRawJson(JSON.stringify(body, null, 2));
      setRecommendations(recs);
      setHasFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto relative">
      <Bookshelf style={{ top: '5%', left: '3%', width: 140, height: 101, transform: 'rotate(-6deg)' }} />
      <Quill style={{ top: '55%', left: '88%', width: 70, height: 87, transform: 'rotate(12deg)' }} />
      <div className="max-w-2xl mx-auto px-6 py-10 relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={26} className="text-stone-500" />
          </div>
          <h2 className="text-2xl font-semibold text-stone-900 mb-2">For You</h2>
          <p className="text-stone-500 text-sm leading-relaxed max-w-sm mx-auto">
            AI-powered recommendations based on your full reading taste profile.
          </p>
        </div>

        {/* Suggest button */}
        {!loading && (
          <div className="flex justify-center mb-8">
            <button
              onClick={handleSuggest}
              className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
            >
              <Sparkles size={16} />
              {hasFetched ? 'Refresh suggestions' : 'Suggest my next read'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-stone-500">
            <Loader2 size={24} className="animate-spin text-stone-400" />
            <p className="text-sm">{loadingMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 font-mono break-all">{error}</p>
          </div>
        )}

        {/* Raw JSON debug output */}
        {rawJson && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Raw API response (debug)
            </p>
            <pre className="text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
              {rawJson}
            </pre>
          </div>
        )}

        {/* Empty state after fetch with no results */}
        {hasFetched && !loading && (!recommendations || recommendations.length === 0) && !error && (
          <div className="text-center py-10 text-stone-400">
            <p className="text-sm">No recommendations returned. Try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
