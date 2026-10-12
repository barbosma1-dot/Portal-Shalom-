import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

/** Inicia o login com Google pelo Supabase Auth. Depois do retorno, o app deve conferir se o e-mail está autorizado. */
export async function signInWithGoogle(supabase: SupabaseClient, redirectTo: string = window.location.origin) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

export function GoogleLogin({
  supabase, label = 'Entrar com Google', redirectTo, onError,
}: { supabase: SupabaseClient; label?: string; redirectTo?: string; onError?: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      className="sh-btn sh-btn-secondary sh-btn-block sh-google-btn"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try { await signInWithGoogle(supabase, redirectTo); }
        catch (e: any) { onError?.(e?.message ?? 'Não foi possível entrar com o Google.'); setLoading(false); }
      }}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/>
          <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.4-5.7c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
      )}
      {label}
    </button>
  );
}
