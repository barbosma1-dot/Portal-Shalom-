import { createClient } from "@supabase/supabase-js";

// GET /api/integrations/wop/status — estado do espelho de usuários e do feed do Wop (só admin do Portal; sem e-mails).
interface Env {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

export const onRequestGet = async (context: { request: Request; env: Env }) => {
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
  if (adm.error || !adm.data || adm.data.length === 0) return json({ error: "Apenas o administrador do Portal." }, 403);

  const st = await admin.rpc("pt_sync_status");
  if (st.error) return json({ error: "Status indisponível." }, 500);
  return json(st.data);
};
