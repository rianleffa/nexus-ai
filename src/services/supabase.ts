import { createClient } from '@supabase/supabase-js';

// No frontend Vite, usamos estritamente as variáveis públicas (VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY)
const configuredSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
// Accept both the documented project URL and an accidentally pasted REST endpoint.
// Supabase Auth requires the project origin so it can build `/auth/v1/...` URLs.
const supabaseUrl = configuredSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('http')
);

export const supabaseProjectUrl = supabaseUrl;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        detectSessionInUrl: true,
      },
    })
  : null;
