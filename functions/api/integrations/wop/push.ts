import { createClient } from "@supabase/supabase-js";
import { wopPush, type WopPushEnv } from "../_wopsend";

// POST /api/integrations/wop/push[?dry=1]   (pasta em minúsculas: functions/api/integrations/wop/)
// Só admin do Portal (portal_admins). Exige o Bearer (access token) do Supabase do Portal; sem CORS aberto.
// ?dry=1 mostra só as contagens do que seria enviado (não chama o Wop).
// Variáveis (Cloudflare Pages do Portal): as mesmas do sync (VITE_SUPABASE_URL/SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY do PRÓPRIO Portal,
// WOP_SUPABASE_URL, WOP_SUPABASE_ANON_KEY, WOP_SYNC_KEY) e PORTAL_PUSH_TARGET=wop (liga o envio).
interface Env extends WopPushEnv {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json({ error: "Servidor não configurado." }, 500);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autenticado." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  const email = String(data?.user?.email || "").toLowerCase().trim();
  if (error || !email) return json({ error: "Sessão inválida." }, 401);

  const adm = await admin.from("portal_admins").select("id").eq("email", email).limit(1);
  const isAdmin = !adm.error && !!adm.data && adm.data.length > 0;

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const out = await wopPush({ admin, isAdmin }, env, { dry });
  return json(out.body, out.status);
};
