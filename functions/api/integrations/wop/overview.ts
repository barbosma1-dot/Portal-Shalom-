import { createClient } from "@supabase/supabase-js";

// GET /api/integrations/wop/overview   (pasta em minúsculas: functions/api/integrations/wop/)
// Só admin do Portal (portal_admins). Devolve a "visão" da integração para a aba Wop do Painel do Administrador:
// catálogo espelhado (pt_entity_map, com o vínculo de missões), usuários espelhados (pt_hub_users) e pedidos de nível (pt_nivel_outbox).
// Somente leitura. Também mostra, por usuário, os apps liberados em app_authorizations (tabela do PRÓPRIO Portal; nunca usa chaves de outros apps).
// O nível NUNCA concede acesso a app: o acesso vem só de app_authorizations. E-mails saem MASCARADOS; quem pede mudança de nível identifica a pessoa pelo wop_user_id (o e-mail nunca volta ao navegador).
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

function maskEmail(e: unknown): string {
  const s = String(e || "").toLowerCase().trim();
  const at = s.indexOf("@");
  if (at < 1) return "***";
  return `${s.slice(0, Math.min(3, at))}***${s.slice(at)}`;
}

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

  const [ent, usr, reg, out, pad, aut] = await Promise.all([
    admin.from("pt_entity_map").select("entity_type,wop_id,app_ref,name,area,active").order("entity_type").order("name").limit(2000),
    admin.from("pt_hub_users").select("wop_user_id,email,nivel,area,funcao,regional_id,mission_id,allowed_sectors,ativo").order("email").limit(2000),
    admin.from("mission_registry").select("id,canonical_name").limit(2000),
    admin.from("pt_nivel_outbox").select("id,email,nivel,base_nivel,status,result,requested_at").order("id", { ascending: false }).limit(30),
    admin.from("portal_admins").select("email").limit(500),
    admin.from("app_authorizations").select("email,app_id").limit(10000)
  ]);
  if (ent.error || usr.error || reg.error || out.error || pad.error || aut.error) {
    return json({ error: "Visão indisponível." }, 500);
  }

  const registryName = new Map<string, string>();
  for (const m of reg.data || []) registryName.set(String((m as any).id), String((m as any).canonical_name || ""));

  const entName = new Map<string, string>();
  for (const e of ent.data || []) {
    const r = e as any;
    if (r.wop_id) entName.set(String(r.wop_id), String(r.name || ""));
  }

  // Catálogo agrupado por tipo. "linked_to" = nome canônico quando app_ref aponta para mission_registry.id.
  const groups = new Map<string, any[]>();
  for (const e of ent.data || []) {
    const r = e as any;
    const t = String(r.entity_type || "outro");
    const linkedTo = r.app_ref ? registryName.get(String(r.app_ref)) ?? null : null;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push({
      wop_id: String(r.wop_id),
      name: r.name ?? null,
      area: r.area ?? null,
      active: r.active ?? null,
      linked_to: linkedTo
    });
  }
  const entities = Array.from(groups.entries()).map(([type, items]) => ({
    type,
    total: items.length,
    linked: items.filter(i => i.linked_to).length,
    items
  }));

  const adminEmails = new Set((pad.data || []).map((a: any) => String(a.email || "").toLowerCase().trim()));
  const pendingByEmail = new Map<string, string>();
  for (const o of out.data || []) {
    const r = o as any;
    if (r.status === "pending") {
      const k = String(r.email || "").toLowerCase();
      if (!pendingByEmail.has(k)) pendingByEmail.set(k, String(r.nivel));
    }
  }

  // Apps liberados por e-mail (somente leitura). Contagem de autorizações cujo e-mail não está no espelho: só número, sem e-mails.
  const appsByEmail = new Map<string, Set<string>>();
  for (const a of aut.data || []) {
    const r = a as any;
    const k = String(r.email || "").toLowerCase().trim();
    if (!k || !r.app_id) continue;
    if (!appsByEmail.has(k)) appsByEmail.set(k, new Set<string>());
    appsByEmail.get(k)!.add(String(r.app_id));
  }
  const mirrorEmails = new Set((usr.data || []).map((u: any) => String(u.email || "").toLowerCase().trim()));
  let authorizedOutsideMirror = 0;
  for (const k of appsByEmail.keys()) if (!mirrorEmails.has(k)) authorizedOutsideMirror++;

  const users = (usr.data || []).map((u: any) => {
    const mail = String(u.email || "").toLowerCase().trim();
    const isPortalAdmin = adminEmails.has(mail);
    const sectors: unknown[] = Array.isArray(u.allowed_sectors) ? u.allowed_sectors : [];
    return {
      id: u.wop_user_id ? String(u.wop_user_id) : null,
      email_masked: maskEmail(mail),
      nivel: u.nivel ?? null,
      area: u.area ?? null,
      funcao: u.funcao ?? null,
      ativo: u.ativo ?? null,
      regional: u.regional_id ? entName.get(String(u.regional_id)) ?? null : null,
      mission: u.mission_id ? entName.get(String(u.mission_id)) ?? registryName.get(String(u.mission_id)) ?? null : null,
      setores: sectors.length,
      apps: Array.from(appsByEmail.get(mail) ?? []).sort(),
      pending_nivel: pendingByEmail.get(mail) ?? null,
      can_request: !!u.wop_user_id && u.nivel !== "admin" && !isPortalAdmin
    };
  });

  const requests = (out.data || []).map((o: any) => ({
    id: Number(o.id),
    email_masked: maskEmail(o.email),
    nivel: String(o.nivel),
    base_nivel: o.base_nivel ?? null,
    status: o.status ?? null,
    result: o.result ?? null,
    requested_at: o.requested_at ?? null
  }));

  const authorizations = {
    total_pessoas: appsByEmail.size,
    fora_do_espelho: authorizedOutsideMirror,
    espelho_sem_app: users.filter((u: { apps: string[] }) => u.apps.length === 0).length
  };

  return json({ ok: true, entities, users, requests, authorizations });
};
