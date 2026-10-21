const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const dashboardProject = configuredUrl?.match(/supabase\.com\/dashboard\/project\/([^/?#]+)/)?.[1];
const projectRef = dashboardProject || configuredUrl?.replace(/^https?:\/\//, "").split(".")[0];
const supabaseUrl = projectRef
  ? `https://${projectRef}.supabase.co`
  : undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
} as const;
