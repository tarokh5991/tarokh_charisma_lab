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

  const { data: entitlements, error: entitlementError } = await supabase
    .from("entitlements")
    .select("plans!inner(ai_message_limit)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false })
    .limit(1);
  if (entitlementError) {
    console.error("Coach entitlement lookup failed", entitlementError.message);
    return new Response("Coach access check failed", { status: 500, headers: corsHeaders });
  }
  const entitlement = entitlements?.[0] as { plans: { ai_message_limit: number | null } | null } | undefined;
  if (!entitlement?.plans || entitlement.plans.ai_message_limit === 0) {
    return new Response("Coach access is unavailable for this plan", { status: 403, headers: corsHeaders });
  }

  const { scenario, messages } = await request.json() as RequestBody;
  if (!scenario?.title || !scenario?.context || !Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return new Response("Invalid request", { status: 400, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) return new Response("Coach is not configured", { status: 503, headers: corsHeaders });

  const systemInstruction = `تو مربی تمرین مهارت ارتباطی TAROKH هستی. پاسخ‌ها فقط فارسی، محترمانه، کوتاه و عملی باشند. در سناریوی «${scenario.title}» نقش طرف مقابل را بازی کن و پس از پاسخ کاربر، یک بازخورد مشخص و کوتاه بده؛ سپس گفت‌وگو را طبیعی ادامه بده. از فریب، فشار، تحقیر، نقض رضایت یا توصیه درمانی پرهیز کن. زمینه: ${scenario.context}`;
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
  const content = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
  if (!content) return new Response("Coach response failed", { status: 502, headers: corsHeaders });

  return Response.json({ content }, { headers: corsHeaders });
});
