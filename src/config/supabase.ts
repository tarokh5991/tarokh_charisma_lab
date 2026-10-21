const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseUrl = configuredUrl
  ? configuredUrl.startsWith("http")
    ? configuredUrl.replace(/\/$/, "")
    : `https://${configuredUrl}.supabase.co`
  : undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
} as const;
