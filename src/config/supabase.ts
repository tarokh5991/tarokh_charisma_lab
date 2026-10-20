const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
} as const;
