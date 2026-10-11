import { createClient } from "@supabase/supabase-js";

// POST /api/integrations/wop/nivel   corpo: { "wop_user_id": "<uuid>", "nivel": "<nível>" }
// (pasta em minúsculas: functions/api/integrations/wop/)
// Só admin do Portal (portal_admins). Registra um PEDIDO de mudança de nível na fila pt_nivel_outbox (via pt_nivel_request).
// Não altera o nível no Portal nem no Wop: o pedido só vai ao Wop em "Enviar ao Wop" e só vale quando um admin do Wop aprovar
// e o nível voltar pelo feed. O e-mail é resolvido aqui no servidor pelo wop_user_id; nunca vai ao navegador.
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

const NIVEIS = ["regional_coordinator", "mission_coordinator", "sector_coordinator", "user"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOTIVOS: Record<string, { status: number; error: string }> = {
  parametro_invalido: { status: 400, error: "Dados inválidos." },
  admin_tecnico_fora: { status: 403, error: "Administrador técnico do Portal não tem o nível alterado por aqui." },
  usuario_fora_do_espelho: { status: 404, error: "Usuário não encontrado no espelho do Portal." },
  sem_mudanca: { status: 409, error: "Esta pessoa já está nesse nível." }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json({ error: "Servidor não configurado." }, 500);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autenticado." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  const adminEmail = String(data?.user?.email || "").toLowerCase().trim();
  if (error || !adminEmail) return json({ error: "Sessão inválida." }, 401);

  const adm = await admin.from("portal_admins").select("id").eq("email", adminEmail).limit(1);
  if (adm.error || !adm.data || adm.data.length === 0) return json({ error: "Apenas o administrador do Portal." }, 403);

  let body: any = null;
  try { body = await request.json(); } catch { body = null; }
  const wopUserId = String(body?.wop_user_id || "").trim();
  const nivel = String(body?.nivel || "").trim();
  if (!UUID.test(wopUserId) || !NIVEIS.includes(nivel)) return json({ error: "Dados inválidos." }, 400);

  const found = await admin.from("pt_hub_users").select("email").eq("wop_user_id", wopUserId).limit(1);
  if (found.error) return json({ error: "Não foi possível consultar o espelho." }, 500);
  const targetEmail = String((found.data?.[0] as any)?.email || "").trim();
  if (!targetEmail) return json({ error: MOTIVOS.usuario_fora_do_espelho.error }, 404);

  const r = await admin.rpc("pt_nivel_request", { p_email: targetEmail, p_nivel: nivel, p_by: adminEmail });
  if (r.error) {
    const msg = String(r.error.message || "");
    const code = Object.keys(MOTIVOS).find(k => msg.includes(k));
    if (code) return json({ error: MOTIVOS[code].error, reason: code }, MOTIVOS[code].status);
    return json({ error: "Não foi possível registrar o pedido." }, 500);
  }
  return json({ ok: true, id: (r.data as any)?.id ?? null });
};
