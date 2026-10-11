import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Eye, PlayCircle, Activity, AlertCircle, CheckCircle, ChevronDown, Send, Users, Layers } from "lucide-react";
import { UserSession } from "../types";

// Aba "Wop" do Painel do Administrador. Usa o token da sessão atual; quem decide se a pessoa é admin é o
// SERVIDOR (portal_admins) — esta tela não concede nada. Nunca mostra chaves; e-mails aparecem só mascarados.
// Seções: (1) Wop -> Portal (simular / status / sincronizar), (2) Portal -> Wop (simular envio / enviar: tudo vira PROPOSTA pendente no Wop),
// (3) Catálogo espelhado e vínculo de missões, (4) Usuários espelhados com pedido de mudança de nível, (5) pedidos recentes.

interface WopSyncPanelProps {
  session: UserSession;
}

type Kind = "dry" | "status" | "sync" | "force" | "full" | "pushdry" | "push";

interface Result {
  kind: Kind;
  httpStatus: number | null; // null = falha de rede
  body: any;
  at: Date;
}

interface OvEntity { wop_id: string; name: string | null; area: string | null; active: boolean | null; linked_to: string | null }
interface OvGroup { type: string; total: number; linked: number; items: OvEntity[] }
interface OvUser {
  id: string | null; email_masked: string; nivel: string | null; area: string | null; funcao: string | null;
  ativo: boolean | null; regional: string | null; mission: string | null; setores: number;
  apps: string[]; pending_nivel: string | null; can_request: boolean;
}
interface OvRequest { id: number; email_masked: string; nivel: string; base_nivel: string | null; status: string | null; result: string | null; requested_at: string | null }
interface OvAuth { total_pessoas: number; fora_do_espelho: number; espelho_sem_app: number }
interface Overview { entities: OvGroup[]; users: OvUser[]; requests: OvRequest[]; authorizations: OvAuth | null }

const LABEL: Record<Kind, string> = {
  dry: "Simulação",
  status: "Status",
  sync: "Sincronização",
  force: "Sincronização forçada",
  full: "Ressincronização total",
  pushdry: "Simulação do envio",
  push: "Envio ao Wop"
};

const NIVEL_LABEL: Record<string, string> = {
  admin: "Admin (técnico)",
  regional_coordinator: "Coordenador regional",
  mission_coordinator: "Coordenador de missão",
  sector_coordinator: "Coordenador de setor",
  user: "Usuário"
};
const NIVEIS_PEDIDO = ["regional_coordinator", "mission_coordinator", "sector_coordinator", "user"];

const AREA_LABEL: Record<string, string> = {
  financeiro: "Financeiro",
  apostolico: "Apostólico",
  formativo: "Formativo",
  missionario: "Missionário (Comunitário)"
};

// ids de app usados em app_authorizations (iguais aos de functions/api/_shared.ts); id desconhecido aparece como está.
const APP_LABEL: Record<string, string> = {
  pashalom: "PA",
  poshalom: "PO",
  wopsh: "Wop",
  evansh: "EvanSh",
  adoracaoshalom: "Adoração Sh",
  cifrash: "Cifras",
  benfeitorpaz: "Benfeitor da Paz"
};

const TALLY_LABEL: Record<string, string> = {
  ok: "ok",
  sem_perfil: "sem perfil no Wop (esperado)"
};

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function tallyText(t: unknown): string {
  if (!t || typeof t !== "object") return "nada";
  const parts = Object.entries(t as Record<string, unknown>).map(([k, v]) => `${n(v)} ${TALLY_LABEL[k] ?? k}`);
  return parts.length ? parts.join(", ") : "nada";
}

// Resumo em português, só com campos conhecidos do retorno (sem inventar nada).
function summarize(r: Result): { tone: "ok" | "warn" | "err"; text: string } {
  const b = r.body ?? {};
  if (r.httpStatus === null) return { tone: "err", text: "Falha de rede. Verifique a internet e tente de novo." };
  if (r.httpStatus === 401) return { tone: "err", text: "Sessão expirada. Saia e entre de novo no Portal." };
  if (r.httpStatus === 403) return { tone: "err", text: "Apenas o administrador do Portal pode fazer isso." };

  if (r.kind === "pushdry" || r.kind === "push") {
    if (r.httpStatus === 503 && b.enabled === false) {
      return { tone: "warn", text: "Envio ao Wop desligado. Falta criar o Secret PORTAL_PUSH_TARGET=wop no Cloudflare (a simulação funciona mesmo desligada)." };
    }
    if (r.httpStatus === 503) return { tone: "warn", text: "Integração ainda não configurada (faltam os Secrets WOP_* no Cloudflare)." };
    if (r.httpStatus >= 400) return { tone: "err", text: String(b.error || `Erro ${r.httpStatus}.`) };
    if (r.kind === "pushdry") {
      const a = b.a_enviar ?? {};
      return {
        tone: "ok",
        text: `Simulação OK (nada foi enviado). Seriam enviados: ${n(a.missions)} missões, ${n(a.users)} usuários e ${n(a.niveis)} mudanças de nível.`
      };
    }
    if (b.nada_a_enviar) return { tone: "ok", text: "Nada a enviar." };
    const e = b.enviados ?? {};
    const res = b.resultado ?? {};
    return {
      tone: "ok",
      text:
        `Enviado ao Wop como propostas pendentes (um admin do Wop precisa aprovar). ` +
        `Missões ${n(e.missions)}: ${tallyText(res.missions)}. Usuários ${n(e.users)}: ${tallyText(res.users)}. Níveis ${n(e.niveis)}: ${tallyText(res.niveis)}.`
    };
  }

  if (r.httpStatus === 503 && b.enabled === false) {
    return { tone: "warn", text: "Sincronização desligada. Falta criar o Secret PORTAL_SYNC_SOURCE=wop no Cloudflare (a simulação funciona mesmo desligada)." };
  }
  if (r.httpStatus === 503) return { tone: "warn", text: "Integração ainda não configurada (faltam os Secrets WOP_* no Cloudflare)." };
  if (r.httpStatus >= 400) return { tone: "err", text: String(b.error || `Erro ${r.httpStatus}.`) };

  if (r.kind === "dry") {
    const u = b.users ?? {};
    const c = b.catalog ?? {};
    return {
      tone: "ok",
      text:
        `Simulação OK (nada foi gravado). Usuários: ${n(u.new)} novos, ${n(u.changed)} alterados, ` +
        `${n(u.promoted)} promovidos, ${n(u.demoted)} rebaixados, ${n(u.deactivated)} desativados. ` +
        `Catálogo: ${n(c.regional)} regionais, ${n(c.setores)} setores, ` +
        `${n(c.mission_mapeadas)} missões vinculadas e ${n(c.mission_sem_vinculo)} sem vínculo.`
    };
  }
  if (r.kind === "status") return { tone: "ok", text: "Status carregado. Detalhes abaixo." };

  if (b.skipped) {
    const why = b.skipped === "running" ? "já tem uma sincronização em andamento" : "rodou há menos de 1 minuto";
    return { tone: "warn", text: `Nada feito: ${why}. Use "Forçar agora" se precisar.` };
  }
  const base =
    `${b.ok ? "Concluído" : "Concluído com avisos"} (${b.mode === "snapshot" ? "carga completa" : "mudanças"}): ` +
    `${n(b.events)} eventos, ${n(b.users_changed)} usuários e ${n(b.catalog_changed)} item(ns) de catálogo alterados`;
  return { tone: b.ok ? "ok" : "warn", text: `${base}${n(b.errors) > 0 ? `, ${n(b.errors)} erros` : ""}.` };
}

async function callApi(path: string, method: "GET" | "POST", token: string, body?: unknown): Promise<{ status: number | null; body: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = text ? { raw: text.slice(0, 500) } : null; }
    return { status: res.status, body: parsed };
  } catch {
    return { status: null, body: null };
  } finally {
    clearTimeout(timer);
  }
}

const USERS_PAGE = 30;

export default function WopSyncPanel({ session }: WopSyncPanelProps) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovError, setOvError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(USERS_PAGE);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [reqBusy, setReqBusy] = useState<string | null>(null);
  const [reqMsg, setReqMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const canCall = !!session.token && !session.isMock;

  const loadOverview = useCallback(async () => {
    if (!session.token || session.isMock) return;
    setOvLoading(true);
    setOvError(null);
    const r = await callApi("/api/integrations/wop/overview", "GET", session.token);
    if (r.status === 200 && r.body?.ok) {
      setOverview({
        entities: Array.isArray(r.body.entities) ? r.body.entities : [],
        users: Array.isArray(r.body.users) ? r.body.users : [],
        requests: Array.isArray(r.body.requests) ? r.body.requests : [],
        authorizations: r.body.authorizations ?? null
      });
    } else if (r.status === null) {
      setOvError("Falha de rede ao carregar a visão.");
    } else if (r.status === 401 || r.status === 403) {
      setOvError("Apenas o administrador do Portal pode ver isto.");
    } else {
      setOvError(String(r.body?.error || `Erro ${r.status}.`));
    }
    setOvLoading(false);
  }, [session.token, session.isMock]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const run = async (kind: Kind) => {
    if (!canCall || !session.token) return;
    if (kind === "full" && !window.confirm("Ressincronizar tudo agora? Reaplica o retrato completo do Wop no espelho do Portal (não apaga nada).")) return;
    if (kind === "push" && !window.confirm("Enviar ao Wop agora? Tudo chega lá como PROPOSTA pendente; um admin do Wop precisa aprovar. Nada muda direto no Wop.")) return;

    const request: { method: "GET" | "POST"; path: string } =
      kind === "dry" ? { method: "POST", path: "/api/integrations/wop/sync?dry=1" }
      : kind === "status" ? { method: "GET", path: "/api/integrations/wop/status" }
      : kind === "force" ? { method: "POST", path: "/api/integrations/wop/sync?force=1" }
      : kind === "full" ? { method: "POST", path: "/api/integrations/wop/sync?full=1" }
      : kind === "pushdry" ? { method: "POST", path: "/api/integrations/wop/push?dry=1" }
      : kind === "push" ? { method: "POST", path: "/api/integrations/wop/push" }
      : { method: "POST", path: "/api/integrations/wop/sync" };

    setBusy(kind);
    setShowRaw(false);
    const r = await callApi(request.path, request.method, session.token);
    setResult({ kind, httpStatus: r.status, body: r.body, at: new Date() });
    setBusy(null);
    if (kind === "sync" || kind === "force" || kind === "full" || kind === "push") loadOverview();
  };

  const requestNivel = async (u: OvUser) => {
    if (!session.token || !u.id) return;
    const nivel = pick[u.id];
    if (!nivel || nivel === u.nivel) return;
    if (!window.confirm(`Pedir mudança de nível de ${u.email_masked} para "${NIVEL_LABEL[nivel] ?? nivel}"? Isto só cria um pedido; o nível só muda quando o Wop aprovar.`)) return;
    setReqBusy(u.id);
    setReqMsg(null);
    const r = await callApi("/api/integrations/wop/nivel", "POST", session.token, { wop_user_id: u.id, nivel });
    if (r.status === 200 && r.body?.ok) {
      setReqMsg({ tone: "ok", text: `Pedido registrado para ${u.email_masked}. Toque em "Enviar ao Wop" para levá-lo ao Wop.` });
      setPick(p => { const c = { ...p }; delete c[u.id as string]; return c; });
      loadOverview();
    } else if (r.status === null) {
      setReqMsg({ tone: "err", text: "Falha de rede. Tente de novo." });
    } else {
      setReqMsg({ tone: "err", text: String(r.body?.error || `Erro ${r.status}.`) });
    }
    setReqBusy(null);
  };

  const filteredUsers = useMemo(() => {
    const list = overview?.users ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(u =>
      [u.email_masked, u.funcao, u.regional, u.mission, u.nivel ? NIVEL_LABEL[u.nivel] : null]
        .some(x => (x || "").toLowerCase().includes(q))
    );
  }, [overview, filter]);

  const summary = result ? summarize(result) : null;
  const toneClasses = {
    ok: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300",
    warn: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300",
    err: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
  };

  const mainBtn =
    "w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const lightBtn = `${mainBtn} bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800`;
  const card = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4";
  const sectionTitle = "font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-2";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="text-amber-500" size={18} />
          Integração com o Wop (usuários)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          O Wop é dono do cadastro. Aqui o Portal recebe usuários, níveis, missões e regionais, e envia ao Wop só propostas.
        </p>
      </div>

      {!canCall && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Esta sessão é de demonstração. Entre com a sua conta real de administrador para usar a integração.
          </p>
        </div>
      )}

      {/* 1) Wop -> Portal */}
      <section className="space-y-3 max-w-xl">
        <h4 className={sectionTitle}>Receber do Wop</h4>
        <p className="text-xs text-slate-500">Simular não grava nada; sincronizar só funciona depois de ligado.</p>
        <button onClick={() => run("dry")} disabled={!canCall || busy !== null} className={`${mainBtn} bg-slate-950 text-white hover:bg-slate-800`}>
          <PlayCircle size={16} />
          {busy === "dry" ? "Simulando…" : "Simular (não grava nada)"}
        </button>
        <button onClick={() => run("status")} disabled={!canCall || busy !== null} className={lightBtn}>
          <Activity size={16} />
          {busy === "status" ? "Carregando…" : "Ver status"}
        </button>
        <button onClick={() => run("sync")} disabled={!canCall || busy !== null} className={lightBtn}>
          <RefreshCw size={16} className={busy === "sync" ? "animate-spin" : ""} />
          {busy === "sync" ? "Sincronizando…" : "Sincronizar agora"}
        </button>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
        >
          <ChevronDown size={14} className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"} />
          Avançado
        </button>
        {showAdvanced && (
          <div className="grid gap-2">
            <button onClick={() => run("force")} disabled={!canCall || busy !== null} className={lightBtn}>
              {busy === "force" ? "Forçando…" : "Forçar agora (ignora o limite de 1 minuto)"}
            </button>
            <button onClick={() => run("full")} disabled={!canCall || busy !== null} className={lightBtn}>
              {busy === "full" ? "Ressincronizando…" : "Ressincronizar tudo (carga completa)"}
            </button>
          </div>
        )}
      </section>

      {/* 2) Portal -> Wop */}
      <section className="space-y-3 max-w-xl">
        <h4 className={sectionTitle}>
          <Send size={16} className="text-amber-500" />
          Enviar ao Wop
        </h4>
        <p className="text-xs text-slate-500">
          Leva missões, pessoas que entraram pelo Portal e pedidos de nível. No Wop tudo vira proposta pendente; só vale quando um admin do Wop aprovar.
        </p>
        <button onClick={() => run("pushdry")} disabled={!canCall || busy !== null} className={lightBtn}>
          <PlayCircle size={16} />
          {busy === "pushdry" ? "Simulando…" : "Simular envio (não envia nada)"}
        </button>
        <button onClick={() => run("push")} disabled={!canCall || busy !== null} className={`${mainBtn} bg-slate-950 text-white hover:bg-slate-800`}>
          <Send size={16} />
          {busy === "push" ? "Enviando…" : "Enviar ao Wop"}
        </button>
      </section>

      {result && summary && (
        <div className="max-w-xl space-y-3">
          <div className={`border p-4 rounded-2xl flex items-start gap-3 ${toneClasses[summary.tone]}`}>
            {summary.tone === "ok" ? <CheckCircle className="shrink-0 mt-0.5" size={16} /> : <AlertCircle className="shrink-0 mt-0.5" size={16} />}
            <div className="text-xs">
              <p className="font-semibold mb-0.5">
                {LABEL[result.kind]} · {result.httpStatus === null ? "sem resposta" : `HTTP ${result.httpStatus}`} · {result.at.toLocaleTimeString("pt-BR")}
              </p>
              <p>{summary.text}</p>
            </div>
          </div>

          <button
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <Eye size={14} />
            {showRaw ? "Esconder resposta completa" : "Ver resposta completa"}
          </button>
          {showRaw && (
            <pre className="bg-slate-950 text-emerald-200 p-4 rounded-xl text-xs whitespace-pre-wrap break-words max-h-96 overflow-auto">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* 3) Visão: catálogo, usuários, pedidos */}
      <section className="space-y-4 max-w-xl">
        <div className="flex items-center justify-between gap-2">
          <h4 className={sectionTitle}>
            <Layers size={16} className="text-amber-500" />
            Espelho do Portal
          </h4>
          <button
            onClick={loadOverview}
            disabled={!canCall || ovLoading}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            {ovLoading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>

        {ovError && (
          <div className={`border p-3 rounded-2xl text-xs ${toneClasses.err}`}>{ovError}</div>
        )}

        {overview && (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Catálogo e vínculo de missões</p>
              {overview.entities.length === 0 && <p className="text-xs text-slate-500">Catálogo vazio. Rode "Sincronizar agora".</p>}
              {overview.entities.map(g => {
                const isMission = /miss/i.test(g.type);
                const open = !!openGroups[g.type];
                return (
                  <div key={g.type} className={card}>
                    <button
                      onClick={() => setOpenGroups(o => ({ ...o, [g.type]: !o[g.type] }))}
                      className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {g.type} · {g.total}
                        {g.linked > 0 && <span className="ml-2 text-xs font-normal text-slate-500">{g.linked} vinculada(s) ao cadastro canônico</span>}
                      </span>
                      <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
                    </button>
                    {open && (
                      <ul className="mt-3 space-y-2">
                        {g.items.map(it => (
                          <li key={it.wop_id} className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-medium">{it.name || "(sem nome)"}</span>
                            {it.area ? ` · ${AREA_LABEL[it.area] ?? it.area}` : ""}
                            {it.active === false ? " · inativo" : ""}
                            {it.linked_to
                              ? <span className="text-emerald-700 dark:text-emerald-400"> → {it.linked_to}</span>
                              : isMission ? <span className="text-amber-700 dark:text-amber-400"> · sem vínculo</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users size={14} />
                Usuários espelhados ({filteredUsers.length}{filter ? ` de ${overview.users.length}` : ""})
              </p>
              <p className="text-xs text-slate-500">
                Nível, área, missão e regional vêm do Wop e aqui são só leitura. "Pedir mudança" cria um pedido; ele vai ao Wop em "Enviar ao Wop".
                Os apps liberados vêm da aba "Autorizações SSO": o nível não concede acesso a nenhum app.
              </p>
              {overview.authorizations && (
                <p className="text-xs text-slate-500">
                  {overview.authorizations.total_pessoas} pessoa(s) com app liberado · {overview.authorizations.fora_do_espelho} liberada(s) que não estão no espelho do Wop · {overview.authorizations.espelho_sem_app} do espelho sem nenhum app liberado.
                </p>
              )}
              <input
                value={filter}
                onChange={e => { setFilter(e.target.value); setShown(USERS_PAGE); }}
                placeholder="Filtrar por e-mail (mascarado), função, missão, regional…"
                className="w-full px-3 py-2.5 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />

              {reqMsg && (
                <div className={`border p-3 rounded-2xl text-xs ${toneClasses[reqMsg.tone]}`}>{reqMsg.text}</div>
              )}

              {filteredUsers.length === 0 && <p className="text-xs text-slate-500">Nenhum usuário.</p>}
              {filteredUsers.slice(0, shown).map((u, idx) => {
                const key = u.id ?? `${u.email_masked}-${idx}`;
                const chosen = u.id ? pick[u.id] : undefined;
                return (
                  <div key={key} className={card}>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                      {u.email_masked}
                      {u.ativo === false && <span className="ml-2 text-xs font-normal text-red-600">inativo</span>}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {u.nivel ? NIVEL_LABEL[u.nivel] ?? u.nivel : "sem nível"}
                      {u.area ? ` · ${AREA_LABEL[u.area] ?? u.area}` : ""}
                      {u.funcao ? ` · ${u.funcao}` : ""}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {u.regional ? `Regional: ${u.regional}` : "Sem regional"} · {u.mission ? `Missão: ${u.mission}` : "Sem missão"} · {u.setores} setor(es)
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Apps liberados: {u.apps.length ? u.apps.map(a => APP_LABEL[a] ?? a).join(", ") : "nenhum"}
                    </p>
                    {u.pending_nivel && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Pedido pendente: {NIVEL_LABEL[u.pending_nivel] ?? u.pending_nivel}
                      </p>
                    )}
                    {u.can_request ? (
                      <div className="mt-3 flex gap-2">
                        <select
                          value={chosen ?? ""}
                          onChange={e => setPick(p => ({ ...p, [u.id as string]: e.target.value }))}
                          className="flex-1 min-w-0 px-2 py-2 rounded-xl text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value="">Novo nível…</option>
                          {NIVEIS_PEDIDO.filter(v => v !== u.nivel).map(v => (
                            <option key={v} value={v}>{NIVEL_LABEL[v]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => requestNivel(u)}
                          disabled={!canCall || !chosen || reqBusy !== null}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reqBusy === u.id ? "Enviando…" : "Pedir mudança"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-2">Nível não pode ser pedido por aqui (admin técnico ou sem vínculo com o Wop).</p>
                    )}
                  </div>
                );
              })}
              {filteredUsers.length > shown && (
                <button onClick={() => setShown(s => s + USERS_PAGE)} className={lightBtn}>
                  Mostrar mais
                </button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pedidos de nível recentes</p>
              {overview.requests.length === 0 && <p className="text-xs text-slate-500">Nenhum pedido ainda.</p>}
              {overview.requests.map(q => (
                <div key={q.id} className={card}>
                  <p className="text-xs text-slate-900 dark:text-white break-all">
                    {q.email_masked}: {q.base_nivel ? NIVEL_LABEL[q.base_nivel] ?? q.base_nivel : "?"} → {NIVEL_LABEL[q.nivel] ?? q.nivel}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {q.status ?? "sem status"}
                    {q.result ? ` · ${q.result}` : ""}
                    {q.requested_at ? ` · ${new Date(q.requested_at).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
