import { supabaseConfig } from "../config/supabase";

type AuthMode = "mobile" | "email";

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string; phone?: string };
};

function requireConfig() {
  if (!supabaseConfig.isConfigured || !supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error("اتصال به سرویس احراز هویت هنوز تنظیم نشده است.");
  }
  return supabaseConfig;
}

function endpoint(path: string) {
  const { url } = requireConfig();
  return `${url}${path}`;
}

async function request(path: string, body: Record<string, unknown>) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { msg?: string; error_description?: string } | null;
    throw new Error(payload?.msg || payload?.error_description || "درخواست انجام نشد. دوباره تلاش کن.");
  }

  return response.json();
}

export function requestOtp(value: string, mode: AuthMode) {
  return request("/auth/v1/otp", mode === "mobile" ? { phone: value, create_user: true } : { email: value, create_user: true });
}

export function verifyOtp(value: string, token: string, mode: AuthMode) {
  return request("/auth/v1/verify", mode === "mobile"
    ? { phone: value, token, type: "sms" }
    : { email: value, token, type: "email" });
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem("tarokh-auth-session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem("tarokh-auth-session");
    return null;
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem("tarokh-auth-session", JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem("tarokh-auth-session");
}
