import { createClient } from "@supabase/supabase-js";
import { wopSync, type WopSyncEnv } from "../_wopsync";

// POST /api/integrations/wop/sync[?force=1|?full=1|?dry=1]   (pasta em minúsculas: functions/api/integrations/wop/)
// Qualquer usuário logado no Portal pode disparar a sincronização normal (limitada a 1 por minuto no banco).
// force/full/dry só para admin do Portal (portal_admins). Exige o Bearer (access token) do Supabase do Portal; sem CORS aberto.
// Variáveis (Cloudflare Pages do Portal): VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY (Secret, do PRÓPRIO Portal),
// WOP_SUPABASE_URL, WOP_SUPABASE_ANON_KEY, WOP_SYNC_KEY (Secret, chave do app "portal") e PORTAL_SYNC_SOURCE=wop (liga).
interface Env extends WopSyncEnv {
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

  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autenticado." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  const email = String(data?.user?.email || "").toLowerCase().trim();
  if (error || !email) return json({ error: "Sessão inválida." }, 401);

  const adm = await admin.from("portal_admins").select("id").eq("email", email).limit(1);
  const isAdmin = !adm.error && !!adm.data && adm.data.length > 0;

  const q = new URL(request.url).searchParams;
  const out = await wopSync(
    { admin, isAdmin },
    env,
    { force: q.get("force") === "1", full: q.get("full") === "1", dry: q.get("dry") === "1" }
  );
  return json(out.body, out.status);
};
