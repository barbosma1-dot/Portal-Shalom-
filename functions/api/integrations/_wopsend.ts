// Portal Shalom -> Wop (hub de usuários): envia SÓ propostas, nunca altera nada direto no Wop.
// Envia: (1) mapa canônico de missões, (2) quem entrou pelo Portal e ainda não está no espelho,
// (3) mudanças de NÍVEL feitas no Portal (fila pt_nivel_outbox). No Wop tudo cai como proposta pendente
// (Vínculos / aba Níveis) e só vale depois que um admin do Wop aprovar. O nível volta ao Portal pelo feed.
// Só servidor: WOP_SYNC_KEY (chave do app "portal") nunca vai ao navegador. Nenhum e-mail é gravado em log nem devolvido ao navegador.
// Ligar: PORTAL_PUSH_TARGET=wop (sem ela só a simulação ?dry=1 funciona). Rollback: apagar a variável e publicar de novo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { wopKeysConfigured, type WopSyncEnv } from "./_wopsync";

export interface WopPushEnv extends WopSyncEnv {
  PORTAL_PUSH_TARGET?: string; // "wop" liga o envio
}
export interface WopPushContext { admin: SupabaseClient; isAdmin: boolean }
export interface WopPushOptions { dry?: boolean }

export function wopPushEnabled(env: WopPushEnv): boolean {
  return String(env.PORTAL_PUSH_TARGET || "").trim().toLowerCase() === "wop";
}

async function wopRpc(env: WopPushEnv, fn: string, args: Record<string, unknown>, fetchImpl: typeof fetch): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const base = (env.WOP_SUPABASE_URL as string).replace(/\/+$/, "");
    const anon = env.WOP_SUPABASE_ANON_KEY as string;
    const res = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ p_key: env.WOP_SYNC_KEY, ...args }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`wop_${res.status}`); // nunca repassar o corpo do Wop ao navegador
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export async function wopPush(
  ctx: WopPushContext,
  env: WopPushEnv,
  opts: WopPushOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<{ status: number; body: any }> {
  if (!ctx.isAdmin) {
    return { status: 403, body: { error: "Apenas o administrador do Portal pode enviar ao Wop." } };
  }
  if (!wopKeysConfigured(env)) {
    return { status: 503, body: { error: "Integração com o Wop não configurada.", configured: false } };
  }
  if (!opts.dry && !wopPushEnabled(env)) {
    return { status: 503, body: { error: "Envio ao Wop desligado (PORTAL_PUSH_TARGET).", configured: true, enabled: false } };
  }

  const plan = await ctx.admin.rpc("pt_push_plan");
  if (plan.error || !plan.data) return { status: 500, body: { error: "Plano de envio indisponível." } };
  const missions = asArray(plan.data.missions);
  const users = asArray(plan.data.users);
  const niveis = asArray(plan.data.niveis);
  const counts = { missions: missions.length, users: users.length, niveis: niveis.length };

  if (opts.dry) return { status: 200, body: { ok: true, dry_run: true, a_enviar: counts } };
  if (counts.missions + counts.users + counts.niveis === 0) {
    return { status: 200, body: { ok: true, nada_a_enviar: true, enviados: counts } };
  }

  let resp: any;
  try {
    resp = await wopRpc(env, "wop_portal_propose", {
      p_payload: {
        missions: missions.map(m => ({ id: m.id, name: m.name })),
        users: users.map(u => ({ external_user_id: u.id, email: u.email })),
        niveis: niveis.map(n => ({ email: n.email, nivel: n.nivel, base_nivel: n.base_nivel }))
      }
    }, fetchImpl);
  } catch {
    return { status: 502, body: { error: "Não foi possível enviar ao Wop." } };
  }

  const rm = asArray(resp?.missions);
  const ru = asArray(resp?.users);
  const rn = asArray(resp?.niveis);
  if (resp?.ok !== true || rm.length !== missions.length || ru.length !== users.length || rn.length !== niveis.length) {
    return { status: 502, body: { error: "Resposta inesperada do Wop; nada foi registrado." } };
  }

  // O Wop devolve um resultado por item, na mesma ordem enviada.
  const record = {
    missions: missions.map((m, i) => ({ id: m.id, name: m.name, ok: rm[i]?.ok === true, reason: rm[i]?.reason ?? null })),
    users: users.map((u, i) => ({ id: u.id, ok: ru[i]?.ok === true, reason: ru[i]?.reason ?? null })),
    niveis: niveis.map((n, i) => ({ id: n.id, ok: rn[i]?.ok === true, status: rn[i]?.status ?? null, reason: rn[i]?.reason ?? null }))
  };
  const saved = await ctx.admin.rpc("pt_push_record", { p_in: record });
  if (saved.error) return { status: 500, body: { error: "Enviado ao Wop, mas o registro local falhou.", enviados: counts } };

  const tally = (rows: { ok: boolean; reason?: string | null; status?: string | null }[]) => {
    const t: Record<string, number> = {};
    for (const r of rows) { const k = r.ok ? (r.status || "ok") : (r.reason || "erro"); t[k] = (t[k] || 0) + 1; }
    return t;
  };
  return {
    status: 200,
    body: {
      ok: true,
      enviados: counts,
      resultado: { missions: tally(record.missions), users: tally(record.users), niveis: tally(record.niveis) }
    }
  };
}
