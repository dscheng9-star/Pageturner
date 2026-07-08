import { BookMarked } from 'lucide-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
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

        {/* Auth UI */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#1c1917',
                    brandAccent: '#44403c',
                    brandButtonText: '#ffffff',
                    defaultButtonBackground: '#f5f5f4',
                    defaultButtonBackgroundHover: '#e7e5e4',
                    inputBackground: '#ffffff',
                    inputBorder: '#e7e5e4',
                    inputBorderHover: '#a8a29e',
                    inputBorderFocus: '#1c1917',
                    inputText: '#1c1917',
                    inputLabelText: '#57534e',
                    inputPlaceholder: '#a8a29e',
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.75rem',
                  },
                  fontSizes: {
                    baseBodySize: '14px',
                    baseInputSize: '14px',
                    baseLabelSize: '13px',
                    baseButtonSize: '14px',
                  },
                  fonts: {
                    bodyFontFamily: 'inherit',
                    buttonFontFamily: 'inherit',
                    inputFontFamily: 'inherit',
                    labelFontFamily: 'inherit',
                  },
                },
              },
              style: {
                button: { fontWeight: '500', padding: '10px 16px' },
                anchor: { color: '#57534e' },
                container: { gap: '14px' },
                divider: { background: '#e7e5e4' },
                message: { color: '#57534e', fontSize: '13px' },
              },
            }}
            providers={['google']}
            onlyThirdPartyProviders
            redirectTo={window.location.origin}
          />
        </div>

        <p className="text-xs text-stone-400 text-center mt-6 leading-relaxed">
          Your library is private and only visible to you.
        </p>
      </div>
    </div>
  );
}
