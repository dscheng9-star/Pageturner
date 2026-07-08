import { useState, useEffect } from 'react';
import { BookOpen, BookMarked, Bookmark, Sparkles, LogOut, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import LibraryScreen from './screens/LibraryScreen';
import WantToReadScreen from './screens/WantToReadScreen';
import RecommendationsScreen from './screens/RecommendationsScreen';
import AddBookModal from './screens/AddBookModal';
import ReviewModal from './screens/ReviewModal';
import LoginPage from './screens/LoginPage';
import type { GoogleBook } from './lib/googleBooks';

type Tab = 'library' | 'want_to_read' | 'recommendations';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'library', label: 'Library', icon: <BookOpen size={20} /> },
  { id: 'want_to_read', label: 'Want to Read', icon: <Bookmark size={20} /> },
  { id: 'recommendations', label: 'For You', icon: <Sparkles size={20} /> },
];

function AuthCallbackScreen() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-2xl bg-stone-900 flex items-center justify-center">
        <BookMarked size={20} className="text-white" />
      </div>
      <div className="flex items-center gap-2 text-stone-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Completing sign in…
      </div>
    </div>
  );
}

export default function App() {
  // undefined = not yet determined, null = no session, Session = logged in
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [showAddBook, setShowAddBook] = useState(false);
  const [pendingGoogleBook, setPendingGoogleBook] = useState<GoogleBook | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  const isAuthCallback = window.location.pathname === '/auth/callback';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // After the OAuth callback, clean the URL so users don't land on /auth/callback on refresh.
      if (s && window.location.pathname === '/auth/callback') {
        window.history.replaceState(null, '', '/');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // While auth state is still resolving, show an appropriate screen.
  if (session === undefined) {
    // If we're on the callback path, show the "Completing sign in" screen
    // instead of the generic spinner so the user sees meaningful feedback.
    return isAuthCallback ? <AuthCallbackScreen /> : (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  function handleGoogleBookSelect(book: GoogleBook) {
    setShowAddBook(false);
    setPendingGoogleBook(book);
  }

  function handleBookSaved() {
    setPendingGoogleBook(null);
    setLibraryRefreshKey(k => k + 1);
    setActiveTab('library');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Desktop header */}
      <header className="hidden sm:flex items-center justify-between px-8 py-4 border-b border-stone-100 sticky top-0 bg-white z-20">
        <div className="flex items-center gap-2.5">
          <BookMarked size={22} className="text-stone-900" />
          <span className="font-semibold text-stone-900 text-lg tracking-tight">Pageturner</span>
        </div>
        <nav className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </header>

      {/* Mobile header */}
      <header className="sm:hidden flex items-center justify-between px-5 py-4 border-b border-stone-100 sticky top-0 bg-white z-20">
        <div className="flex items-center gap-2">
          <BookMarked size={20} className="text-stone-900" />
          <span className="font-semibold text-stone-900 tracking-tight">Pageturner</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        {activeTab === 'library' && (
          <LibraryScreen key={libraryRefreshKey} />
        )}
        {activeTab === 'want_to_read' && (
          <WantToReadScreen onAddBook={() => setShowAddBook(true)} />
        )}
        {activeTab === 'recommendations' && <RecommendationsScreen />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden flex border-t border-stone-100 bg-white sticky bottom-0 z-20">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-stone-900' : 'text-stone-400'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Global add book modals */}
      {showAddBook && (
        <AddBookModal
          onClose={() => setShowAddBook(false)}
          onSelect={handleGoogleBookSelect}
        />
      )}
      {pendingGoogleBook && (
        <ReviewModal
          googleBook={pendingGoogleBook}
          onClose={() => setPendingGoogleBook(null)}
          onSaved={handleBookSaved}
        />
      )}
    </div>
  );
}
