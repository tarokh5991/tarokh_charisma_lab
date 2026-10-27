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

export function requestOtp(value: string, mode: AuthMode, username?: string, createUser = true) {
  const identifier = normalizeIdentifier(value, mode);
  const data = username?.trim() ? { username: username.trim(), display_name: username.trim() } : undefined;
  return request("/auth/v1/otp", mode === "mobile"
    ? { phone: identifier, create_user: createUser, ...(data ? { data } : {}) }
    : { email: identifier, create_user: createUser, ...(data ? { data } : {}) });
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

export type ActivePlan = {
  name: string;
  starts_at: string;
  ends_at: string;
};

export async function getActivePlan(session: AuthSession): Promise<ActivePlan | null> {
  const { anonKey } = requireConfig();
  const currentTime = encodeURIComponent(new Date().toISOString());
  const response = await fetch(endpoint(`/rest/v1/entitlements?user_id=eq.${encodeURIComponent(session.user.id)}&status=eq.active&ends_at=gt.${currentTime}&select=starts_at,ends_at,plans(name)&order=starts_at.desc&limit=1`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت پلن فعال انجام نشد.");
  const entitlements = await response.json() as Array<{ starts_at: string; ends_at: string; plans: { name: string } | null }>;
  const entitlement = entitlements[0];
  return entitlement?.plans?.name ? { name: entitlement.plans.name, starts_at: entitlement.starts_at, ends_at: entitlement.ends_at } : null;
}

export async function getLatestAssessment(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/assessments?user_id=eq.${encodeURIComponent(session.user.id)}&select=recommended_dimensions&order=created_at.desc&limit=1`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت ارزیابی انجام نشد.");
  const assessments = await response.json() as Array<{ recommended_dimensions: string[] }>;
  return assessments[0]?.recommended_dimensions || [];
}

export type CoachFeedback = {
  positive: string;
  improvement: string;
  alternative: string;
};

export type CoachQuota = { allowed: boolean; remaining: number | null; daily_limit: number | null };

export type CoachReply = { content: string; feedback?: CoachFeedback; quota?: CoachQuota };

export type CoachMessage = { role: "user" | "model"; content: string; feedback?: CoachFeedback };

export type CoachLearnerContext = {
  plan: string;
  recommendedDimensions: string[];
  completedLessons: number;
  totalLessons: number;
};

export async function requestCoachReply(session: AuthSession, scenario: { title: string; context: string }, messages: CoachMessage[], learnerContext: CoachLearnerContext, mode: "practice" | "advisor" = "practice") {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/functions/v1/coach"), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scenario, messages, learnerContext, mode }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("سهمیهٔ روزانهٔ مربی تو تمام شده است.");
    throw new Error(response.status === 503 ? "مربی هنوز آماده نشده است." : "پاسخ مربی دریافت نشد. دوباره تلاش کن.");
  }
  const payload = await response.json() as CoachReply;
  if (!payload.content) throw new Error("پاسخ مربی دریافت نشد. دوباره تلاش کن.");
  return payload;
}

type CoachConversation = { id: string };

export async function getCoachQuota(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/get_coach_quota"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("دریافت سهمیهٔ مربی انجام نشد.");
  const quota = await response.json() as CoachQuota[];
  return quota[0] || { allowed: false, remaining: 0, daily_limit: 0 };
}

export async function getCoachConversation(session: AuthSession, scenarioKey: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/ai_conversations?user_id=eq.${encodeURIComponent(session.user.id)}&scenario_key=eq.${encodeURIComponent(scenarioKey)}&select=id&order=updated_at.desc&limit=1`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت گفت‌وگو انجام نشد.");
  const conversations = await response.json() as CoachConversation[];
  return conversations[0] || null;
}

export async function createCoachConversation(session: AuthSession, scenarioKey: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/ai_conversations"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: session.user.id, scenario_key: scenarioKey, title: scenarioKey }),
  });
  if (!response.ok) throw new Error("ساخت گفت‌وگو انجام نشد.");
  const conversations = await response.json() as CoachConversation[];
  return conversations[0];
}

export async function deleteCoachConversation(session: AuthSession, conversationId: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/ai_conversations?id=eq.${encodeURIComponent(conversationId)}`), {
    method: "DELETE",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("ریست گفت‌وگو انجام نشد.");
}

export async function getCoachMessages(session: AuthSession, conversationId: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/ai_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=role,content,feedback&order=created_at.asc`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت پیام‌ها انجام نشد.");
  const messages = await response.json() as Array<{ role: "user" | "assistant"; content: string; feedback: CoachFeedback | null }>;
  return messages.map(message => ({ role: message.role === "assistant" ? "model" as const : "user" as const, content: message.content, feedback: message.feedback || undefined }));
}

export async function saveCoachMessage(session: AuthSession, conversationId: string, message: CoachMessage) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/ai_messages"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, role: message.role === "model" ? "assistant" : "user", content: message.content, feedback: message.feedback || null }),
  });
  if (!response.ok) throw new Error("ذخیرهٔ پیام انجام نشد.");
  await fetch(endpoint(`/rest/v1/ai_conversations?id=eq.${encodeURIComponent(conversationId)}`), {
    method: "PATCH",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
}

export async function activateDemoPlan(session: AuthSession, planSlug: string, customerName: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/activate_demo_plan"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requested_plan_slug: planSlug, customer_full_name: customerName.trim() }),
  });
  if (!response.ok) throw new Error("ثبت پلن انجام نشد. دوباره تلاش کن.");
  const result = await response.json() as Array<{ order_id: string; plan_name: string }>;
  if (!result[0]) throw new Error("ثبت پلن انجام نشد. دوباره تلاش کن.");
  return result[0];
}

export type PurchaseRecord = {
  id: string;
  amount_toman: number;
  status: "pending" | "paid" | "failed" | "refunded";
  gateway: string | null;
  created_at: string;
  plans: { name: string } | null;
};

export async function getPurchaseHistory(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/orders?user_id=eq.${encodeURIComponent(session.user.id)}&select=id,amount_toman,status,gateway,created_at,plans(name)&order=created_at.desc`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت سوابق خرید انجام نشد.");
  return await response.json() as PurchaseRecord[];
}

export async function deleteAccount(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/delete_my_account"), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error("حذف حساب انجام نشد.");
  clearSession();
}

export type PublishedLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: {
    quote: string;
    goal: string;
    idea: string[];
    example: string;
    exercise: { title: string; steps: string[] };
    mistake: string;
    summary: string[];
    ai?: { scenario: string; goal: string };
  };
  duration_minutes: number;
  position: number;
  course_modules: {
    title: string;
    learning_paths: { title: string; dimension: string; position: number };
  };
};

export async function getPublishedLessons() {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/lessons?select=id,slug,title,summary,body,duration_minutes,position,course_modules!inner(title,learning_paths!inner(title,dimension,position))&is_published=eq.true"), {
    headers: { apikey: anonKey },
  });
  if (!response.ok) throw new Error("دریافت درس‌ها انجام نشد.");
  const lessons = await response.json() as PublishedLesson[];
  return lessons.sort((first, second) => first.course_modules.learning_paths.position - second.course_modules.learning_paths.position || first.position - second.position);
}

export type LessonProgress = {
  lesson_id: string;
  completed_at: string | null;
  exercise_completed_at: string | null;
};

export async function getLessonProgress(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/lesson_progress?user_id=eq.${encodeURIComponent(session.user.id)}&select=lesson_id,completed_at,exercise_completed_at`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت وضعیت مطالعه انجام نشد.");
  return await response.json() as LessonProgress[];
}

export async function completeLesson(session: AuthSession, lessonId: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/lesson_progress?on_conflict=user_id,lesson_id"), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: session.user.id, lesson_id: lessonId, completed_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("ثبت تکمیل مطالعه انجام نشد.");
}

export async function completeExercise(session: AuthSession, lessonId: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/lesson_progress?on_conflict=user_id,lesson_id"), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: session.user.id, lesson_id: lessonId, exercise_completed_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("ثبت انجام تمرین انجام نشد.");
}

export type MonthlyChallengeProgress = { challenge_key: string; completed_at: string | null };

export async function getMonthlyChallengeProgress(session: AuthSession, monthStart: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint(`/rest/v1/monthly_challenge_progress?user_id=eq.${encodeURIComponent(session.user.id)}&month_start=eq.${monthStart}&select=challenge_key,completed_at`), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت وضعیت چالش ماهانه انجام نشد.");
  return await response.json() as MonthlyChallengeProgress[];
}

export async function completeMonthlyChallenge(session: AuthSession, challengeKey: string, monthStart: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/monthly_challenge_progress?on_conflict=user_id,month_start,challenge_key"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: session.user.id, challenge_key: challengeKey, month_start: monthStart, completed_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("ثبت چالش ماهانه انجام نشد.");
}

export type AdminOverview = {
  totals: {
    users: number;
    learners: number;
    active_entitlements: number;
    paid_orders: number;
    revenue_toman: number;
    ai_messages_today: number;
    ai_messages_all_time: number;
    lesson_completions: number;
    exercise_completions: number;
    lessons_published: number;
  };
  plans: Array<{ name: string; count: number }>;
  usage: Array<{ date: string; count: number }>;
  orders: Array<{ id: string; customer_name: string | null; username: string | null; plan: string; amount_toman: number; status: string; created_at: string }>;
  users: Array<{ id: string; username: string | null; display_name: string | null; role: string; created_at: string; plan: string | null; plan_ends_at: string | null; completed_lessons: number; ai_messages: number }>;
};

export async function getAdminOverview(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/admin_overview"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("دریافت گزارش مدیریتی انجام نشد.");
  return await response.json() as AdminOverview;
}

export type AdminLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  position: number;
  is_published: boolean;
  duration_minutes: number;
  body: PublishedLesson["body"];
  course_modules: { title: string; learning_paths: { title: string; position: number } };
};

export type AdminPlan = { id: string; slug: string; name: string; price_toman: number; ai_message_limit: number | null; is_active: boolean };

export async function getAdminPlans(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/plans?select=id,slug,name,price_toman,ai_message_limit,is_active&order=price_toman.asc"), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت پلن‌ها انجام نشد.");
  return await response.json() as AdminPlan[];
}

export type AdminUserDetail = {
  profile: { id: string; username: string | null; display_name: string | null; role: string; created_at: string; email: string | null; phone: string | null };
  assessment: { recommended_dimensions?: string[]; created_at?: string };
  entitlements: Array<{ plan: string; status: string; starts_at: string; ends_at: string | null }>;
  orders: Array<{ plan: string; amount_toman: number; status: string; customer_name: string | null; created_at: string; paid_at: string | null }>;
  lessons: Array<{ title: string; path: string; completed_at: string | null; exercise_completed_at: string | null }>;
  challenges: Array<{ key: string; month_start: string; completed_at: string | null }>;
  ai_usage: Array<{ date: string; message_count: number }>;
  conversations: Array<{ title: string; scenario_key: string; created_at: string; updated_at: string; messages: Array<{ role: string; content: string; feedback: CoachFeedback | null; created_at: string }> }>;
};

export async function getAdminUserDetail(session: AuthSession, userId: string) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/admin_user_detail"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: userId }),
  });
  if (!response.ok) throw new Error("دریافت جزئیات کاربر انجام نشد.");
  return await response.json() as AdminUserDetail;
}

export async function getAdminLessons(session: AuthSession) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/lessons?select=id,slug,title,summary,position,is_published,duration_minutes,body,course_modules!inner(title,learning_paths!inner(title,position))"), {
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("دریافت فهرست درس‌ها انجام نشد.");
  const lessons = await response.json() as AdminLesson[];
  return lessons.sort((first, second) => first.course_modules.learning_paths.position - second.course_modules.learning_paths.position || first.position - second.position);
}

export async function updateAdminLesson(session: AuthSession, lesson: AdminLesson) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/admin_update_lesson"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_lesson_id: lesson.id, next_title: lesson.title, next_summary: lesson.summary, next_duration_minutes: lesson.duration_minutes, next_body: lesson.body }),
  });
  if (!response.ok) throw new Error("ذخیرهٔ درس انجام نشد.");
}

export async function setLessonPublished(session: AuthSession, lessonId: string, published: boolean) {
  const { anonKey } = requireConfig();
  const response = await fetch(endpoint("/rest/v1/rpc/admin_set_lesson_published"), {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_lesson_id: lessonId, published }),
  });
  if (!response.ok) throw new Error("تغییر وضعیت انتشار درس انجام نشد.");
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