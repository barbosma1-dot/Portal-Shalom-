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
  AlertCircle,
  Download,
  Smartphone,
  Monitor
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { CommunityApp, UserSession } from "./types";

// List of static applications
const staticApps = [
  {
    name: "PA Shalom",
    url: "https://pa-shalom.pages.dev",
    description: "Planejamento Apostólico e células da comunidade Shalom.",
    icon: "https://pa-shalom.pages.dev/favicon.ico",
    fallbackIcon: Church,
    colorClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
    topBorder: "bg-blue-500"
  },
  {
    name: "PO Shalom",
    url: "https://poshalom.pages.dev",
    description: "Planejamento Orçamentário e finanças da comunidade Shalom.",
    icon: "https://poshalom.pages.dev/favicon.ico",
    fallbackIcon: Users,
    colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
    topBorder: "bg-amber-500"
  },
  {
    name: "Gestão Pro",
    url: "https://gest-opro.pages.dev",
    description: "Gerenciador profissional de projetos, orçamentos e missões.",
    icon: "https://gest-opro.pages.dev/favicon.ico",
    fallbackIcon: BarChart3,
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
    topBorder: "bg-emerald-500"
  },
  {
    name: "Evangelização Shalom",
    url: "https://evansh.pages.dev",
    description: "Ações de evangelização e acompanhamento de vocacionados.",
    icon: "https://evansh.pages.dev/favicon.ico",
    fallbackIcon: Flame,
    colorClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50",
    topBorder: "bg-rose-500"
  },
  {
    name: "Adoração Shalom",
    url: "https://adora-o-shalom.pages.dev",
    description: "Reserva de capela, adoração perpétua e vigílias.",
    icon: "https://adora-o-shalom.pages.dev/favicon.ico",
    fallbackIcon: Heart,
    colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50",
    topBorder: "bg-indigo-500"
  },
  {
    name: "Cifras Shalom",
    url: "https://cifras-sh.pages.dev",
    description: "Repositório litúrgico de partituras e cifras de louvores.",
    icon: "https://cifras-sh.pages.dev/favicon.ico",
    fallbackIcon: Music,
    colorClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/50",
    topBorder: "bg-violet-500"
  },
  {
    name: "WOP Shalom",
    url: "https://wopsh.pages.dev",
    description: "Portal de formação, ministérios e escalas pastorais.",
    icon: "https://wopsh.pages.dev/favicon.ico",
    fallbackIcon: Users,
    colorClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50",
    topBorder: "bg-orange-500"
  },
];

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});

  // Modals state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Escutar prompt de instalação do PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Se já estiver rodando como app autônomo (instalado), ocultar botão/indicadores
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setShowInstallPrompt(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Se não houver prompt nativo (ex: iOS Safari ou navegadores sem suporte), abriremos o modal explicativo
      setShowPWAModal(true);
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Resposta do usuário para instalação: ${outcome}`);
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

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

  useEffect(() => {
    const init = async () => {
      await checkSession();
      setLoading(false);
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
      setError("O Supabase principal não está configurado nas variáveis de ambiente.");
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (err: any) {
      setError("Falha ao iniciar o login: " + err.message);
    }
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

  const handleAccessApp = async (appUrl: string) => {
    if (!supabase) {
      const fallbackToken = session?.token || "mock_access_token";
      const fallbackRefresh = "mock_refresh_token";
      const destinationUrl = `${appUrl}#access_token=${fallbackToken}&refresh_token=${fallbackRefresh}`;
      window.open(destinationUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Erro ao obter sessão:", error);
      }
      const currentSbSession = data?.session;
      if (currentSbSession) {
        const destinationUrl = `${appUrl}#access_token=${currentSbSession.access_token}&refresh_token=${currentSbSession.refresh_token}`;
        window.open(destinationUrl, "_blank", "noopener,noreferrer");
      } else {
        const fallbackToken = session?.token || "mock_access_token";
        const fallbackRefresh = "mock_refresh_token";
        const destinationUrl = `${appUrl}#access_token=${fallbackToken}&refresh_token=${fallbackRefresh}`;
        window.open(destinationUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Erro ao redirecionar com SSO:", err);
      window.open(appUrl, "_blank", "noopener,noreferrer");
    }
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
            {/* PWA INSTALL BUTTON */}
            <button
              onClick={handleInstallClick}
              className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/50 flex items-center gap-1.5 px-3 h-9 rounded-lg border border-amber-200 dark:border-amber-900/50 transition-all cursor-pointer shadow-xs active:scale-95"
              id="pwa-install-button"
              title="Instalar Portal Shalom como Aplicativo no seu dispositivo"
            >
              <Download size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Instalar App</span>
            </button>

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
            ) : null}
          </div>
        </div>
      </header>

      {/* DETAILED MOCK CONFIG ALERT BANNER */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 py-3 px-4" id="config-alert-banner">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs">
            <Info className="shrink-0 text-amber-600" size={16} />
            <p>
              <strong>Supabase não configurado no ambiente.</strong> Ative o login de produção configurando <code className="font-mono bg-amber-500/15 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> e <code className="font-mono bg-amber-500/15 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>.
            </p>
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
                        ? "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:scale-98 dark:bg-slate-800 dark:text-white dark:border-slate-700 cursor-pointer"
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

                  {!isSupabaseConfigured && (
                    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left mt-4">
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        <span className="font-semibold block mb-1">Configuração pendente:</span>
                        As credenciais do Supabase principal para o login não foram detectadas no ambiente. Para ativar o login real com Google, configure as chaves <code className="font-mono bg-amber-500/15 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> e <code className="font-mono bg-amber-500/15 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>.
                      </p>
                    </div>
                  )}
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
                      Launcher
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Selecione um sistema para acessar imediatamente em uma nova aba. Você está conectado como <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{session.email}</span>.
                  </p>
                </div>
              </div>

              {/* STAGGERED APP GRID CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" id="apps-grid">
                {staticApps.map((app, index) => {
                  const FallbackIcon = app.fallbackIcon;
                  const hasImageFailed = failedIcons[app.name];

                  return (
                    <motion.div
                      key={app.name}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative pt-6 sm:pt-8 overflow-hidden"
                    >
                      {/* Top colored border accent */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${app.topBorder}`} />

                      <div>
                        {/* Top Indicator */}
                        <div className="flex items-center justify-between mb-4">
                          {/* App Icon / Logo Wrapper */}
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border ${app.colorClass}`}>
                            {hasImageFailed ? (
                              <FallbackIcon size={20} className="sm:w-5 sm:h-5" />
                            ) : (
                              <img
                                src={app.icon}
                                alt={app.name}
                                onError={() => setFailedIcons(prev => ({ ...prev, [app.name]: true }))}
                                className="w-8 h-8 object-contain"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>

                          {/* Connection indicator */}
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium leading-none text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Ativo</span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="font-display font-bold text-sm sm:text-lg text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                          {app.name}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs mt-1.5 leading-relaxed min-h-[44px] sm:min-h-[40px] line-clamp-2">
                          {app.description}
                        </p>
                        
                        {/* Domain text */}
                        <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 mt-2 flex items-center gap-1">
                          <ExternalLink size={10} />
                          {app.url.replace("https://", "")}
                        </p>
                      </div>

                      {/* Action Link/Button */}
                      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleAccessApp(app.url)}
                          className="w-full h-9 sm:h-10 rounded-xl bg-slate-900 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all group-hover:shadow-sm dark:bg-slate-800 dark:hover:bg-amber-600 cursor-pointer"
                        >
                          <span>Acessar App</span>
                          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
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
            <span className="font-mono">v1.1.0-secure</span>
          </div>
        </div>
      </footer>

      {/* MODAL 3: PWA INSTALLATION INSTRUCTIONS */}
      <AnimatePresence>
        {showPWAModal && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-left"
              id="pwa-modal"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-md shadow-amber-500/5">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                      Instalar Portal Shalom
                    </h3>
                    <p className="text-xs text-slate-500">
                      Adicione à tela inicial do seu dispositivo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPWAModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  O Portal Shalom é um aplicativo web completo (PWA). Você pode instalá-lo em seu celular, tablet ou computador para acessá-lo como um aplicativo nativo diretamente da sua tela inicial com carregamento instantâneo.
                </div>

                <div className="space-y-3 mt-2">
                  {/* Option 1: iOS Safari */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-start gap-3">
                    <Smartphone className="shrink-0 text-slate-500 mt-0.5" size={18} />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">No iPhone ou iPad (Safari)</p>
                      <ol className="list-decimal list-inside text-slate-500 dark:text-slate-400 mt-1 space-y-1">
                        <li>Toque no botão <span className="font-bold">Compartilhar</span> (ícone com quadrado e seta pra cima).</li>
                        <li>Role para baixo e selecione <span className="font-semibold text-slate-800 dark:text-slate-200">Adicionar à Tela de Início</span>.</li>
                        <li>Toque em <span className="font-bold text-amber-600">Adicionar</span> no canto superior direito.</li>
                      </ol>
                    </div>
                  </div>

                  {/* Option 2: Android Chrome */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-start gap-3">
                    <Smartphone className="shrink-0 text-slate-500 mt-0.5" size={18} />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">No Android (Chrome)</p>
                      <ol className="list-decimal list-inside text-slate-500 dark:text-slate-400 mt-1 space-y-1">
                        <li>Toque no menu de <span className="font-bold">3 pontos</span> no canto superior.</li>
                        <li>Selecione <span className="font-semibold text-slate-800 dark:text-slate-200">Instalar aplicativo</span> ou <span className="font-semibold text-slate-800 dark:text-slate-200">Adicionar à tela inicial</span>.</li>
                        <li>Confirme clicando em <span className="font-bold text-amber-600">Instalar</span>.</li>
                      </ol>
                    </div>
                  </div>

                  {/* Option 3: Computador */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-start gap-3">
                    <Monitor className="shrink-0 text-slate-500 mt-0.5" size={18} />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">No Computador (Chrome/Edge)</p>
                      <ol className="list-decimal list-inside text-slate-500 dark:text-slate-400 mt-1 space-y-1">
                        <li>Clique no ícone de <span className="font-bold">Instalar</span> na barra de endereços (ao lado do favoritos).</li>
                        <li>Ou clique nos 3 pontos e escolha <span className="font-semibold text-slate-800 dark:text-slate-200">Salvar e compartilhar &gt; Instalar página como app</span>.</li>
                        <li>Clique em <span className="font-bold text-amber-600">Instalar</span>.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowPWAModal(false)}
                  className="px-5 py-2 bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-xs rounded-xl transition-all"
                >
                  Entendi, Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
