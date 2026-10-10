import React, { useState } from "react";
import { RefreshCw, Eye, PlayCircle, Activity, AlertCircle, CheckCircle, ChevronDown } from "lucide-react";
import { UserSession } from "../types";

// Aba "Wop" do Painel do Administrador: mesma coisa que a página /wop-sync.html (Simular / Ver status /
// Sincronizar agora), mas direto no app. Usa o token da sessão atual; quem decide se a pessoa é admin é o
// SERVIDOR (portal_admins) — esta tela não concede nada. Nunca mostra e-mails nem chaves.

interface WopSyncPanelProps {
  session: UserSession;
}

type Kind = "dry" | "status" | "sync" | "force" | "full";

interface Result {
  kind: Kind;
  httpStatus: number | null; // null = falha de rede
  body: any;
  at: Date;
}

const LABEL: Record<Kind, string> = {
  dry: "Simulação",
  status: "Status",
  sync: "Sincronização",
  force: "Sincronização forçada",
  full: "Ressincronização total"
};

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Resumo em português, só com campos conhecidos do retorno (sem inventar nada).
function summarize(r: Result): { tone: "ok" | "warn" | "err"; text: string } {
  const b = r.body ?? {};
  if (r.httpStatus === null) return { tone: "err", text: "Falha de rede. Verifique a internet e tente de novo." };
  if (r.httpStatus === 401) return { tone: "err", text: "Sessão expirada. Saia e entre de novo no Portal." };
  if (r.httpStatus === 403) return { tone: "err", text: "Apenas o administrador do Portal pode fazer isso." };
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

export default function WopSyncPanel({ session }: WopSyncPanelProps) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canCall = !!session.token && !session.isMock;

  const run = async (kind: Kind) => {
    if (!canCall) return;
    if (kind === "full" && !window.confirm("Ressincronizar tudo agora? Reaplica o retrato completo do Wop no espelho do Portal (não apaga nada).")) return;

    const request: { method: "GET" | "POST"; path: string } =
      kind === "dry" ? { method: "POST", path: "/api/integrations/wop/sync?dry=1" }
      : kind === "status" ? { method: "GET", path: "/api/integrations/wop/status" }
      : kind === "force" ? { method: "POST", path: "/api/integrations/wop/sync?force=1" }
      : kind === "full" ? { method: "POST", path: "/api/integrations/wop/sync?full=1" }
      : { method: "POST", path: "/api/integrations/wop/sync" };

    setBusy(kind);
    setShowRaw(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch(request.path, {
        method: request.method,
        headers: { Authorization: `Bearer ${session.token}` },
        signal: ctrl.signal
      });
      const text = await res.text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { body = text ? { raw: text.slice(0, 500) } : null; }
      setResult({ kind, httpStatus: res.status, body, at: new Date() });
    } catch {
      setResult({ kind, httpStatus: null, body: null, at: new Date() });
    } finally {
      clearTimeout(timer);
      setBusy(null);
    }
  };

  const summary = result ? summarize(result) : null;
  const toneClasses = {
    ok: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300",
    warn: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300",
    err: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
  };

  const mainBtn =
    "w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
          <RefreshCw className="text-amber-500" size={18} />
          Integração com o Wop (usuários)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Traz do Wop os usuários, níveis, missões e regionais para o espelho do Portal. Simular não grava nada; sincronizar só funciona depois de ligado.
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

      <div className="grid gap-3 max-w-xl">
        <button
          onClick={() => run("dry")}
          disabled={!canCall || busy !== null}
          className={`${mainBtn} bg-slate-950 text-white hover:bg-slate-800`}
        >
          <PlayCircle size={16} />
          {busy === "dry" ? "Simulando…" : "Simular (não grava nada)"}
        </button>
        <button
          onClick={() => run("status")}
          disabled={!canCall || busy !== null}
          className={`${mainBtn} bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800`}
        >
          <Activity size={16} />
          {busy === "status" ? "Carregando…" : "Ver status"}
        </button>
        <button
          onClick={() => run("sync")}
          disabled={!canCall || busy !== null}
          className={`${mainBtn} bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800`}
        >
          <RefreshCw size={16} className={busy === "sync" ? "animate-spin" : ""} />
          {busy === "sync" ? "Sincronizando…" : "Sincronizar agora"}
        </button>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer self-start"
        >
          <ChevronDown size={14} className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"} />
          Avançado
        </button>
        {showAdvanced && (
          <div className="grid gap-2">
            <button
              onClick={() => run("force")}
              disabled={!canCall || busy !== null}
              className={`${mainBtn} bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`}
            >
              {busy === "force" ? "Forçando…" : "Forçar agora (ignora o limite de 1 minuto)"}
            </button>
            <button
              onClick={() => run("full")}
              disabled={!canCall || busy !== null}
              className={`${mainBtn} bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`}
            >
              {busy === "full" ? "Ressincronizando…" : "Ressincronizar tudo (carga completa)"}
            </button>
          </div>
        )}
      </div>

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
    </div>
  );
}
