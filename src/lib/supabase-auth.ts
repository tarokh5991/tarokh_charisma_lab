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

export async function refreshSession(session: AuthSession) {
  const response = await request("/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token });
  const nextSession = response as AuthSession;
  saveSession(nextSession);
  return nextSession;
}

export async function restoreSession() {
  const session = getStoredSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 > Date.now() + 60_000) return session;
  try {
    return await refreshSession(session);
  } catch {
    clearSession();
    return null;
  }
}

export async function signOut(session: AuthSession | null) {
  try {
    if (session && supabaseConfig.isConfigured && supabaseConfig.anonKey) {
      await fetch(endpoint("/auth/v1/logout"), {
        method: "POST",
        headers: {
          apikey: supabaseConfig.anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }
  } finally {
    clearSession();
  }
}