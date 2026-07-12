import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Church, 
  Music, 
  Users, 
  Flame, 
  Heart, 
  BarChart3, 
  HelpCircle, 
  Key, 
  Lock, 
  Unlock, 
  LogOut, 
  ArrowRight, 
  ExternalLink, 
  RefreshCw, 
  Copy, 
  Check, 
  Sparkles, 
  Info,
  AlertCircle
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { CommunityApp, UserSession } from "./types";

// Map string keys to Lucide Icon components
const IconMap: Record<string, React.ComponentType<any>> = {
  Church,
  Music,
  Users,
  Flame,
  Heart,
  BarChart3,
};

// Frontend-only styling metadata for each app
const localMetadata: Record<string, { description: string; iconName: string; colorClass: string; accentColor: string }> = {
  pashalom: {
    description: "Planejamento Apostólico e células da comunidade Shalom.",
    iconName: "Church",
    colorClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
    accentColor: "#1d4ed8"
  },
  wopsh: {
    description: "Portal de formação, ministérios e escalas pastorais.",
    iconName: "Users",
    colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
    accentColor: "#b45309"
  },
  gestopro: {
    description: "Gerenciador profissional de projetos, orçamentos e missões.",
    iconName: "BarChart3",
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
    accentColor: "#047857"
  },
  evansh: {
    description: "Ações de evangelização e acompanhamento de vocacionados.",
    iconName: "Flame",
    colorClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50",
    accentColor: "#be123c"
  },
  adoracaoshalom: {
    description: "Reserva de capela, adoração perpétua e vigílias.",
    iconName: "Heart",
    colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50",
    accentColor: "#4338ca"
  },
  cifrash: {
    description: "Repositório litúrgico de partituras e cifras de louvores.",
    iconName: "Music",
    colorClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/50",
    accentColor: "#6d28d9"
  }
};

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [apps, setApps] = useState<CommunityApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Modals state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState<CommunityApp | null>(null);

  // Verify and fetch active sessions on mount
  const checkSession = async () => {
    if (!supabase) {
      // Check localStorage for saved simulation session
      const saved = localStorage.getItem("portal_shalom_demo_session");
      if (saved) {
        setSession(JSON.parse(saved));
      }
      return;
    }
    try {
      const { data: { session: sbSession }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (sbSession?.user) {
        setSession({
          email: sbSession.user.email || "",
          name: sbSession.user.user_metadata?.full_name || sbSession.user.user_metadata?.name || sbSession.user.email?.split("@")[0] || "Membro Shalom",
          avatarUrl: sbSession.user.user_metadata?.avatar_url,
          token: sbSession.access_token,
          isMock: false
        });
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error("Erro ao validar sessão Supabase:", err);
    }
  };

  // Fetch target apps configuration status from the Express backend
  const fetchAppsStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/apps-status");
      if (res.ok) {
        const data = await res.json();
        // Enrich backend configuration status with frontend aesthetics
        const richerApps = data.apps.map((app: any) => {
          const meta = localMetadata[app.id] || {
            description: "Aplicativo oficial da comunidade Shalom.",
            iconName: "Church",
            colorClass: "bg-slate-50 text-slate-700 border-slate-200",
            accentColor: "#475569"
          };
          return {
            ...app,
            ...meta
          };
        });
        setApps(richerApps);
      } else {
        throw new Error("Resposta inválida do servidor.");
      }
    } catch (err: any) {
      console.error("Falha ao obter status dos apps:", err);
      setError("Não foi possível conectar com o servidor para buscar a configuração dos aplicativos.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await checkSession();
      await fetchAppsStatus();
    };
    init();

    // Listen to oauth-integration callback events (postMessage) from the login popup
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // Allow current origin
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('supabase.co')) {
        return;
      }
      if (event.data?.type === "SUPABASE_AUTH_SUCCESS") {
        checkSession().then(() => {
          setSuccess("Login efetuado com sucesso via Supabase!");
          setTimeout(() => setSuccess(null), 4000);
        });
      }
    };

    window.addEventListener("message", handleOAuthMessage);

    // Also check if URL hash parameters exist (if this frame itself handled the redirect)
    const hasHash = window.location.hash && (
      window.location.hash.includes("access_token=") || 
      window.location.hash.includes("error=")
    );
    if (hasHash && window.opener) {
      setTimeout(() => {
        window.opener.postMessage({ type: "SUPABASE_AUTH_SUCCESS" }, "*");
        window.close();
      }, 800);
    }

    return () => {
      window.removeEventListener("message", handleOAuthMessage);
    };
  }, []);

  // Set up Supabase Auth state listener if configured
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (sbSession?.user) {
        setSession({
          email: sbSession.user.email || "",
          name: sbSession.user.user_metadata?.full_name || sbSession.user.user_metadata?.name || sbSession.user.email?.split("@")[0] || "Membro Shalom",
          avatarUrl: sbSession.user.user_metadata?.avatar_url,
          token: sbSession.access_token,
          isMock: false
        });
      } else {
        setSession(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não está configurado. Use o modo de demonstração abaixo.");
      return;
    }

    try {
      // Prompt popup flow as outlined in the oauth-integration skill
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;

      if (data?.url) {
        const width = 550;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
          data.url, 
          "portal_shalom_oauth", 
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
      } else {
        throw new Error("Não foi possível gerar a URL de autorização.");
      }
    } catch (err: any) {
      setError("Falha ao iniciar o login: " + err.message);
    }
  };

  const handleDemoLogin = () => {
    setError(null);
    const demoUser: UserSession = {
      email: "barbosma1@gmail.com",
      name: "Marcus Barbosa",
      avatarUrl: `https://api.dicebear.com/7.x/micah/svg?seed=Marcus&backgroundColor=f59e0b`,
      token: "demo-jwt-portal-shalom-token-verify",
      isMock: true
    };
    setSession(demoUser);
    localStorage.setItem("portal_shalom_demo_session", JSON.stringify(demoUser));
    setSuccess("Entrou no Modo de Demonstração como barbosma1@gmail.com!");
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleLogout = async () => {
    setError(null);
    if (session?.isMock) {
      setSession(null);
      localStorage.removeItem("portal_shalom_demo_session");
      setSuccess("Sessão de demonstração encerrada.");
      setTimeout(() => setSuccess(null), 3500);
      return;
    }

    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
        setSuccess("Sessão encerrada com sucesso.");
        setTimeout(() => setSuccess(null), 3500);
      } catch (err: any) {
        setError("Erro ao deslogar: " + err.message);
      }
    }
  };

  const handleOpenApp = async (app: CommunityApp) => {
    if (!session) return;

    // If target app is not connected (hasKeys: false) or we are in mock mode, open the interactive simulation modal!
    if (session.isMock || !app.hasKeys) {
      setShowSimulationModal(app);
      return;
    }

    setSsoLoading(app.id);
    setError(null);

    try {
      const response = await fetch("/api/sso/generate-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`
        },
        body: JSON.stringify({ appId: app.id })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro no servidor ao gerar o link.");
      }

      if (data.actionLink) {
        setSuccess(`Redirecionando com SSO para ${app.name}...`);
        setTimeout(() => {
          window.location.href = data.actionLink;
        }, 1200);
      } else {
        throw new Error("O link retornado pelo servidor é inválido.");
      }
    } catch (err: any) {
      console.error("Erro no fluxo SSO:", err);
      // Fallback: If it fails, open simulation to show them exactly what was happening
      setError(`Falha ao abrir ${app.name}: ${err.message}. Exibindo o simulador.`);
      setTimeout(() => {
        setError(null);
        setShowSimulationModal(app);
      }, 2500);
    } finally {
      setSsoLoading(null);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" id="loading-screen">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="text-amber-500 mb-4"
        >
          <RefreshCw size={44} />
        </motion.div>
        <p className="font-display text-lg text-slate-700 font-medium">Carregando o Portal Shalom...</p>
        <p className="text-xs text-slate-400 mt-1 font-mono">Verificando conexões do servidor</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300" id="portal-app">
      
      {/* GLOBAL TOAST NOTIFICATIONS */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 z-50 bg-red-600 text-white p-4 rounded-xl shadow-lg flex items-start gap-3 max-w-md"
            id="error-toast"
          >
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Ocorreu um erro</p>
              <p className="opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-white hover:opacity-80 text-xs font-mono">Fechar</button>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 z-50 bg-emerald-600 text-white p-4 rounded-xl shadow-lg flex items-start gap-3 max-w-md"
            id="success-toast"
          >
            <Sparkles className="shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Sucesso</p>
              <p className="opacity-90">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-white hover:opacity-80 text-xs font-mono">Fechar</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-md shadow-amber-500/10">
              <Church className="text-white" size={20} />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                Portal Shalom
              </h1>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono tracking-wider uppercase font-semibold">Comunidade Católica</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {session ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-950 dark:text-white max-w-[150px] truncate">{session.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[150px] truncate font-mono">{session.email}</p>
                </div>
                {session.avatarUrl ? (
                  <img 
                    src={session.avatarUrl} 
                    alt="Avatar" 
                    className="w-9 h-9 rounded-full border-2 border-amber-400 bg-amber-50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm border-2 border-amber-400">
                    {session.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Sair"
                  id="logout-button"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfigModal(true)}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 h-9 rounded-lg transition-all"
              >
                <Key size={14} />
                Como Configurar?
              </button>
            )}
          </div>
        </div>
      </header>

      {/* DETAILED MOCK CONFIG ALERT BANNER */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 py-3 px-4" id="config-alert-banner">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Info className="shrink-0 text-amber-600" size={16} />
              <p>
                <strong>Supabase Principal não configurado!</strong> O portal está rodando em <strong>Modo Sandbox</strong>. Configurações reais de login e SSO de produção usarão as chaves configuradas em seus secrets.
              </p>
            </div>
            <button 
              onClick={() => setShowConfigModal(true)}
              className="underline font-bold hover:text-amber-600 text-left shrink-0"
            >
              Ver instruções de configuração →
            </button>
          </div>
        </div>
      )}

      {/* MAIN BODY AREA */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!session ? (
            /* 1. AUTHENTICATION / LOGIN SCREEN */
            <motion.div
              key="login-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-md w-full mx-auto text-center py-6"
              id="login-card-container"
            >
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500" />
                
                {/* Logo and Greeting */}
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Church size={32} />
                </div>
                
                <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white tracking-tight mb-2">
                  Portal de Aplicativos
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                  Acesse com SSO (Single Sign-On) todos os sistemas integrados da comunidade Shalom em um só clique.
                </p>

                {/* LOGIN OPTIONS */}
                <div className="space-y-4">
                  {/* Option A: Supabase Google OAuth (Active if configured) */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={!isSupabaseConfigured}
                    className={`w-full h-12 rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-200 shadow-sm ${
                      isSupabaseConfigured
                        ? "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:scale-98 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                        : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600"
                    }`}
                    id="supabase-google-login-button"
                  >
                    {/* Google SVG Icon */}
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Entrar com Google
                  </button>

                  {/* Option B: Mock Admin Demo Mode (Enabled for out-of-the-box experience) */}
                  <div className="relative py-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                    <span className="relative px-3 bg-white dark:bg-slate-900 text-xs text-slate-400 uppercase font-mono">Ou Teste Instantâneo</span>
                  </div>

                  <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left">
                    <p className="text-xs text-amber-800 dark:text-amber-300 mb-3 flex items-start gap-1.5 leading-relaxed">
                      <Sparkles className="shrink-0 mt-0.5" size={14} />
                      <span>
                        Seja bem-vindo, <strong>Marcus</strong>! Clique abaixo para simular o login com seu e-mail do formulário e testar todos os 6 aplicativos agora.
                      </span>
                    </p>
                    <button
                      onClick={handleDemoLogin}
                      className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium text-sm rounded-xl shadow-md shadow-amber-500/10 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      id="demo-login-button"
                    >
                      <ArrowRight size={16} />
                      Simular como barbosma1@gmail.com
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <Lock size={12} />
                  Ambiente de segurança robusto com Supabase Auth
                </div>
              </div>
            </motion.div>
          ) : (
            /* 2. THE MAIN PORTAL LAUNCHER GRID */
            <motion.div
              key="main-portal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
              id="launcher-panel"
            >
              {/* Launcher Header Title */}
              <div className="text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                    <h2 className="font-display font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
                      Seus Aplicativos Integrados
                    </h2>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase dark:bg-amber-950/50 dark:text-amber-300">
                      SSO Launcher
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Selecione um sistema para acessar imediatamente. Você entrará autenticado com o e-mail <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{session.email}</span>.
                  </p>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={fetchAppsStatus}
                    disabled={refreshing}
                    className="p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Atualizar conexões do servidor"
                  >
                    <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
                  </button>
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Key size={14} />
                    Configurar Chaves
                  </button>
                </div>
              </div>

              {/* STAGGERED APP GRID CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="apps-grid">
                {apps.map((app, index) => {
                  const IconComponent = IconMap[app.iconName] || Church;
                  const isConfigured = app.hasKeys && !session.isMock;

                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative"
                    >
                      <div>
                        {/* Top Indicator */}
                        <div className="flex items-center justify-between mb-4">
                          {/* App Icon Wrapper */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${app.colorClass}`}>
                            <IconComponent size={22} />
                          </div>

                          {/* SSO Connection Status badge */}
                          <div className="flex items-center gap-1.5 text-[11px] font-medium leading-none">
                            {isConfigured ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                                SSO Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
                                Sandbox
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                          {app.name}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-relaxed min-h-[40px]">
                          {app.description}
                        </p>
                        
                        {/* Domain text */}
                        <p className="text-[10px] font-mono text-slate-400 mt-2 flex items-center gap-1">
                          <ExternalLink size={10} />
                          {app.url.replace("https://", "")}
                        </p>
                      </div>

                      {/* Action Button */}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {ssoLoading === app.id ? (
                          <button
                            disabled
                            className="w-full h-10 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold flex items-center justify-center gap-2 dark:bg-slate-800"
                          >
                            <RefreshCw className="animate-spin text-amber-500" size={14} />
                            Iniciando SSO...
                          </button>
                        ) : isConfigured ? (
                          <button
                            onClick={() => handleOpenApp(app)}
                            className="w-full h-10 rounded-xl bg-slate-900 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-1 transition-all group-hover:shadow-sm dark:bg-slate-800 dark:hover:bg-amber-600 cursor-pointer"
                          >
                            Abrir Aplicativo
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenApp(app)}
                            className="w-full h-10 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/80 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Unlock size={13} className="mr-0.5" />
                            Simular SSO Mágico
                            <HelpCircle size={13} className="opacity-60" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER BAR */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-400 mt-12" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p>© 2026 Portal Shalom. Desenvolvido para unificação de sistemas comunitários.</p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setShowConfigModal(true)} 
              className="hover:text-amber-500 underline"
            >
              Arquitetura de Variáveis
            </button>
            <span>•</span>
            <span className="font-mono">v1.1.0-secure</span>
          </div>
        </div>
      </footer>

      {/* MODAL 1: HOW TO CONFIGURE KEYS / ARCHITECTURE INSTRUCTION */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800"
              id="config-modal"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="font-display font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                    <Key className="text-amber-500" />
                    Configuração de Chaves & SSO
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Como conectar os aplicativos de destino de forma 100% segura.
                  </p>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {/* Visual Architecture Path */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl p-4">
                  <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">
                    Fluxo Seguro de Autenticação (SSO)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs mt-3">
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-150">
                      <p className="font-bold text-amber-600">1. Portal Frontend</p>
                      <p className="text-[10px] mt-1 text-slate-500 leading-tight">Faz login com Google e envia o JWT seguro ao servidor.</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-150 relative">
                      <p className="font-bold text-emerald-600">2. Portal Server</p>
                      <p className="text-[10px] mt-1 text-slate-500 leading-tight">Valida o token. Usa a Service Key do destino para gerar o link.</p>
                      <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10 text-slate-400">→</div>
                      <div className="hidden md:block absolute top-1/2 -left-2 transform -translate-y-1/2 z-10 text-slate-400">→</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-150">
                      <p className="font-bold text-blue-600">3. App de Destino</p>
                      <p className="text-[10px] mt-1 text-slate-500 leading-tight">Usuário é redirecionado e já entra logado sem senha.</p>
                    </div>
                  </div>
                </div>

                {/* Environment variables list */}
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Lock size={15} className="text-amber-600" />
                    Variáveis Próprias dos Aplicativos (Secrets de Servidor)
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Configure estas chaves na aba <strong>Secrets</strong> no painel lateral do AI Studio. Elas ficarão guardadas no servidor de forma oculta do navegador.
                  </p>

                  <div className="space-y-3 font-mono text-xs">
                    {[
                      { name: "PASHALOM", app: "PA Shalom" },
                      { name: "WOPSH", app: "Wopsh" },
                      { name: "GESTOPRO", app: "Gest-o-pro" },
                      { name: "EVANSH", app: "Evansh" },
                      { name: "ADORACOOSHALOM", app: "Adoração Shalom" },
                      { name: "CIFRASH", app: "Cifra Sh" }
                    ].map((env) => (
                      <div key={env.name} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{env.app}</span>
                          <span className="text-[10px] text-slate-400 font-sans">Váriaveis requeridas:</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-amber-700 dark:text-amber-400 font-bold">SUPABASE_URL_{env.name}</span>
                            <button 
                              onClick={() => handleCopyText(`SUPABASE_URL_${env.name}`, `u-${env.name}`)}
                              className="text-[10px] font-sans hover:text-amber-600 underline flex items-center gap-0.5 shrink-0"
                            >
                              {copiedText === `u-${env.name}` ? <Check size={10} /> : <Copy size={10} />}
                              Copiar
                            </button>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">SUPABASE_SERVICE_KEY_{env.name}</span>
                            <button 
                              onClick={() => handleCopyText(`SUPABASE_SERVICE_KEY_${env.name}`, `k-${env.name}`)}
                              className="text-[10px] font-sans hover:text-emerald-600 underline flex items-center gap-0.5 shrink-0"
                            >
                              {copiedText === `k-${env.name}` ? <Check size={10} /> : <Copy size={10} />}
                              Copiar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-semibold text-xs uppercase text-slate-700 dark:text-slate-400 font-mono mb-1">
                    Exemplo de Código Server-side no arquivo server.ts:
                  </h4>
                  <pre className="text-[10px] font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`const targetSupabase = createClient(targetUrl, targetServiceKey);

const { data, error } = await targetSupabase.auth.admin.generateLink({
  type: 'magiclink',
  email: userEmail,
  options: { redirectTo: 'https://pa-shalom.pages.dev' }
});`}
                  </pre>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-5 py-2 bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-sm rounded-xl transition-all"
                >
                  Entendi, Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: INTERACTIVE SSO ARCHITECTURE SIMULATOR */}
      <AnimatePresence>
        {showSimulationModal && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-left"
              id="simulation-modal"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showSimulationModal.colorClass}`}>
                    {React.createElement(IconMap[showSimulationModal.iconName] || Church, { size: 20 })}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
                      Simulação do SSO Magic Link
                    </h3>
                    <p className="text-xs text-slate-500">
                      Visualizando o fluxo de segurança do aplicativo <strong>{showSimulationModal.name}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSimulationModal(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5">
                {/* Banner explaining sandbox */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info className="shrink-0 mt-0.5" size={14} />
                  <div>
                    <p className="font-semibold">Este aplicativo está rodando em modo sandbox ou simulação.</p>
                    <p className="opacity-90 mt-0.5">
                      Para ativação em produção real, configure as variáveis <code className="font-mono bg-amber-500/10 px-1 py-0.5 rounded">SUPABASE_URL_{showSimulationModal.id.toUpperCase()}</code> e <code className="font-mono bg-amber-500/10 px-1 py-0.5 rounded">SUPABASE_SERVICE_KEY_{showSimulationModal.id.toUpperCase()}</code> no servidor.
                    </p>
                  </div>
                </div>

                {/* Interactive Console Visual Flow */}
                <div className="bg-slate-900 rounded-2xl p-5 text-xs text-slate-300 font-mono space-y-3 shadow-inner relative overflow-hidden border border-slate-800">
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CONSOLE DO SERVIDOR
                  </div>
                  
                  <div className="space-y-2 border-l-2 border-amber-500/40 pl-3">
                    <p className="text-slate-500">[{new Date().toLocaleTimeString()}] SSO Request Iniciado para: <span className="text-yellow-400">{showSimulationModal.id}</span></p>
                    <p><span className="text-blue-400">POST</span> /api/sso/generate-link</p>
                    <p className="text-slate-400">Header: <span className="text-emerald-400">Authorization: Bearer [portal-user-jwt-token]</span></p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-emerald-500/40 pl-3">
                    <p className="text-slate-400">➔ Verificando validade do token no Supabase do Portal...</p>
                    <p className="text-emerald-400">✔ Token verificado com sucesso!</p>
                    <p className="text-slate-300">Email extraído: <span className="text-white font-bold">{session.email}</span></p>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-blue-500/40 pl-3">
                    <p className="text-slate-400">➔ Carregando credenciais de serviço para {showSimulationModal.name}...</p>
                    {showSimulationModal.hasKeys ? (
                      <p className="text-emerald-400">✔ Credenciais encontradas na configuração do servidor.</p>
                    ) : (
                      <p className="text-amber-400">⚠ Chaves ausentes nos secrets. Simulando chaves fictícias...</p>
                    )}
                    <p className="text-slate-400">➔ Executando: <span className="text-violet-400">supabase.auth.admin.generateLink(...)</span></p>
                    <p className="text-emerald-400">✔ Link de login mágico criado com sucesso!</p>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-850 break-all leading-normal text-[10px]">
                    <span className="text-amber-500 font-bold">Link SSO Mágico de Redirecionamento:</span>
                    <p className="text-slate-400 select-all mt-1">
                      {showSimulationModal.url}/#access_token=mock_sso_jwt_token_for_{session.email.split("@")[0]}&refresh_token=mock_refresh_sso_token_123&type=magiclink&redirectTo={encodeURIComponent(showSimulationModal.url)}
                    </p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-900">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Como o aplicativo de destino recebe esse link?</p>
                  O aplicativo de destino ({showSimulationModal.name}) carrega o Supabase Client em seu frontend. O SDK do Supabase detecta automaticamente os parâmetros do hash (token) contidos na URL gerada, autologando o usuário instantaneamente na comunidade e liberando o painel correspondente de forma invisível.
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Unlock size={12} />
                  Simulador de redirecionamento ativo
                </span>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowSimulationModal(null)}
                    className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Fechar
                  </button>
                  <a
                    href={showSimulationModal.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setShowSimulationModal(null)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    Abrir App em Nova Aba
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
