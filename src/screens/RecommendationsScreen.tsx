import { Sparkles } from 'lucide-react';

export default function RecommendationsScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
        <Sparkles size={32} className="text-stone-400" />
      </div>
      <h2 className="text-xl font-semibold text-stone-900 mb-2">AI Recommendations</h2>
      <p className="text-stone-500 max-w-sm leading-relaxed">
        Personalized book recommendations powered by AI are coming soon. Once enabled, Pageturner will analyze your reading history and taste to suggest books you'll love.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
        {['Taste profile analysis', 'Genre-aware suggestions', 'Series & author discovery'].map(feat => (
          <div key={feat} className="p-4 bg-stone-50 rounded-xl border border-stone-100">
            <p className="text-sm text-stone-500">{feat}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
