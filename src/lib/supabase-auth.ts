import { supabaseConfig } from "../config/supabase";

type AuthMode = "mobile" | "email";

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string; phone?: string; user_metadata?: { username?: string; display_name?: string } };
};

export type UserProfile = {
  id: string;
  role: "learner" | "mentor" | "admin";
  username?: string | null;
  display_name?: string | null;
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
    const payload = await response.json().catch(() => null) as { msg?: string; message?: string; error?: string; error_description?: string } | null;
    throw new Error(payload?.msg || payload?.message || payload?.error_description || payload?.error || "درخواست انجام نشد. دوباره تلاش کن.");
  }

  return response.json();
}

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeIdentifier(value: string, mode: AuthMode) {
  const normalized = normalizeDigits(value.trim());
  if (mode === "email") return normalized.toLowerCase();
  const digits = normalized.replace(/[\s()-]/g, "");
  if (digits.startsWith("09")) return `+98${digits.slice(1)}`;
  if (digits.startsWith("9")) return `+98${digits}`;
  return digits;
}

export function requestOtp(value: string, mode: AuthMode, username?: string) {
  const identifier = normalizeIdentifier(value, mode);
  const data = username?.trim() ? { username: username.trim(), display_name: username.trim() } : undefined;
  return request("/auth/v1/otp", mode === "mobile"
    ? { phone: identifier, create_user: true, ...(data ? { data } : {}) }
    : { email: identifier, create_user: true, ...(data ? { data } : {}) });
}

export function verifyOtp(value: string, token: string, mode: AuthMode) {
  const identifier = normalizeIdentifier(value, mode);
  const normalizedToken = normalizeDigits(token).replace(/\s/g, "");
  return request("/auth/v1/verify", mode === "mobile"
    ? { phone: identifier, token: normalizedToken, type: "sms" }
    : { email: identifier, token: normalizedToken, type: "email" });
}

export async function getUserProfile(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,role,username,display_name`), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) throw new Error("اطلاعات حساب دریافت نشد.");
  const profiles = await response.json() as UserProfile[];
  return profiles[0] || null;
}

export type PublishedLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  duration_minutes: number;
  position: number;
  course_modules: {
    title: string;
    learning_paths: { title: string; position: number };
  };
};

export async function getPublishedLessons() {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/lessons?select=id,slug,title,summary,duration_minutes,position,course_modules!inner(title,learning_paths!inner(title,position))&is_published=eq.true"), {
    headers: { apikey: anonKey },
  });
  if (!response.ok) throw new Error("دریافت درس‌ها انجام نشد.");
  const lessons = await response.json() as PublishedLesson[];
  return lessons.sort((first, second) => first.course_modules.learning_paths.position - second.course_modules.learning_paths.position || first.position - second.position);
}

function clearSession() {
  localStorage.removeItem("tarokh-auth-session");
}

export async function saveAssessment(session: AuthSession, answers: string[][], recommendedDimensions: string[]) {
  const { anonKey } = requireConfig();
  const dimensionNames: Record<string, string> = {
    C: "confidence",
    L: "listening",
    E: "expression",
    A: "awareness",
    R: "rapport",
  };
  const response = await fetch(endpoint("/rest/v1/assessments"), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      answers,
      recommended_dimensions: recommendedDimensions.map(dimension => dimensionNames[dimension] || dimension.toLowerCase()),
    }),
  });
  if (!response.ok) throw new Error("ذخیرهٔ ارزیابی انجام نشد.");
}

export async function updateUserProfile(session: AuthSession, username: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`), {
    method: "PATCH",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ username: username.trim(), display_name: username.trim() }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: string; message?: string; details?: string } | null;
    if (payload?.code === "23505") throw new Error("این نام کاربری قبلاً انتخاب شده است.");
    throw new Error(payload?.message || payload?.details || "ذخیرهٔ نام کاربری انجام نشد.");
  }
  return (await response.json().catch(() => [])) as UserProfile[];
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