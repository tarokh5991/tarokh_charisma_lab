import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  scenario: { title: string; context: string };
  messages: Array<{ role: "user" | "model"; content: string }>;
};

type CoachFeedback = {
  positive: string;
  improvement: string;
  alternative: string;
};

type CoachQuota = {
  allowed: boolean;
  remaining: number | null;
  daily_limit: number | null;
};

type CoachResponse = {
  content: string;
  feedback?: CoachFeedback;
  quota?: CoachQuota;
};

function parseCoachResponse(value: string): CoachResponse {
  const normalized = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const payload = JSON.parse(normalized) as Partial<CoachResponse>;
    if (typeof payload.content === "string" && payload.feedback && typeof payload.feedback.positive === "string" && typeof payload.feedback.improvement === "string" && typeof payload.feedback.alternative === "string") {
      return { content: payload.content, feedback: payload.feedback };
    }
  } catch {
  }
  return { content: value };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { scenario, messages } = await request.json() as RequestBody;
  if (!scenario?.title || !scenario?.context || !Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return new Response("Invalid request", { status: 400, headers: corsHeaders });
  }

  const { data: quota, error: quotaError } = await supabase.rpc("consume_coach_message");
  if (quotaError || !quota?.[0]) {
    console.error("Coach quota lookup failed", quotaError?.message);
    return new Response("Coach quota check failed", { status: 500, headers: corsHeaders });
  }
  const currentQuota = quota[0] as CoachQuota;
  if (!currentQuota.allowed) {
    return Response.json({ quota: currentQuota }, { status: 429, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) return new Response("Coach is not configured", { status: 503, headers: corsHeaders });

  const systemInstruction = `تو مربی تمرین مهارت ارتباطی TAROKH هستی. پاسخ‌ها فقط فارسی، محترمانه، کوتاه و عملی باشند. در سناریوی «${scenario.title}» نقش طرف مقابل را بازی کن و پس از پاسخ کاربر، یک بازخورد مشخص و کوتاه بده؛ سپس گفت‌وگو را طبیعی ادامه بده. از فریب، فشار، تحقیر، نقض رضایت یا توصیه درمانی پرهیز کن. زمینه: ${scenario.context}\n\nفقط JSON معتبر و بدون markdown برگردان: {"content":"پاسخ کوتاه در نقش طرف مقابل","feedback":{"positive":"یک نکتهٔ مثبت مشخص","improvement":"یک پیشنهاد اصلاح مشخص","alternative":"یک پاسخ جایگزین کوتاه"}}.`;
  const contents = messages.map(message => ({
    role: message.role,
    parts: [{ text: message.content.slice(0, 2000) }],
  }));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemInstruction }] }, contents }),
  });
  if (!response.ok) {
    console.error("AI provider request failed", response.status, await response.text());
    return new Response("Coach response failed", { status: 502, headers: corsHeaders });
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const rawContent = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!rawContent) return new Response("Coach response failed", { status: 502, headers: corsHeaders });

  return Response.json({ ...parseCoachResponse(rawContent), quota: currentQuota }, { headers: corsHeaders });
});
