import { useState } from 'react';
import { BookMarked, Chrome } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OpenBook, BookStack, Quill, ManuscriptPage } from '../components/BookDecorations';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates away — no further state update needed.
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <OpenBook style={{ top: '8%', left: '6%', width: 200, height: 150, transform: 'rotate(-10deg)' }} />
      <BookStack style={{ top: '70%', left: '8%', width: 140, height: 126, transform: 'rotate(8deg)' }} />
      <Quill style={{ top: '15%', left: '85%', width: 90, height: 112, transform: 'rotate(15deg)' }} />
      <ManuscriptPage style={{ top: '65%', left: '88%', width: 110, height: 122, transform: 'rotate(-8deg)' }} />
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 flex items-center justify-center mb-4 shadow-md">
            <BookMarked size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Pageturner</h1>
          <p className="text-stone-500 text-sm mt-1.5 text-center leading-relaxed">
            Your personal book library and ranking engine
          </p>
        </div>

        {/* Sign-in card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
          <p className="text-sm font-medium text-stone-700 text-center">Sign in to continue</p>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-stone-200 rounded-xl bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 hover:border-stone-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
            ) : (
              <Chrome size={16} className="text-stone-500" />
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}
        </div>

        <p className="text-xs text-stone-400 text-center mt-6 leading-relaxed">
          Your library is private and only visible to you.
        </p>
      </div>
    </div>
  );
}
