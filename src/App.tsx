import { ThemeToggle, GoogleLogin, Modal, LogoMenuButton } from './kit';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Key,
  Lock,
  Unlock,
  LogOut,
  RefreshCw,
  Sparkles,
  Info,
  AlertCircle,
  Download,
  Smartphone,
  Monitor,
  Shield,
  LayoutGrid,
  Check,
  X
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { LOGOS } from "./lib/logos";
import { UserSession } from "./types";
import AdminPanel from "./components/AdminPanel";

// Lista dos aplicativos. A logo de cada um vem de LOGOS[id] (src/lib/logos.ts).
const staticApps = [
  { id: "pashalom", name: "PA Shalom", url: "https://pa-shalom.pages.dev" },
  { id: "poshalom", name: "PO Shalom", url: "https://poshalom.pages.dev" },
  { id: "gestopro", name: "Gestão Pro", url: "https://gest-opro.pages.dev" },
  { id: "evansh", name: "Evangelização Shalom", url: "https://evansh.pages.dev" },
  { id: "adoracaoshalom", name: "Adoração Shalom", url: "https://adora-o-shalom.pages.dev" },
  { id: "cifrash", name: "Cifras Shalom", url: "https://cifras-sh.pages.dev" },
  { id: "wopsh", name: "WOP Shalom", url: "https://wopsh.pages.dev" },
  { id: "benfeitorpaz", name: "Benfeitor da Paz", url: "https://benfeitor-da-paz.pages.dev" },
  { id: "inventariosh", name: "Inventário Shalom", url: "https://invent-rio-sh.pages.dev" }
];

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [appsStatus, setAppsStatus] = useState<Record<string, { id: string; name: string; url: string; hasKeys: boolean; isAuthorized?: boolean }>>({});
  const [portalView, setPortalView] = useState<"launcher" | "admin">("launcher");
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch app status configurations from local backend API
  useEffect(() => {
    const fetchAppsStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (session && !session.isMock && session.token) {
          headers["Authorization"] = `Bearer ${session.token}`;
        } else if (session?.isMock) {
          headers["X-Mock-Email"] = session.email;
        }

        const res = await fetch("/api/apps-status", { headers });
        if (res.ok) {
          const data = await res.json();
          const statusMap: Record<string, { id: string; name: string; url: string; hasKeys: boolean; isAuthorized?: boolean }> = {};
          data.apps.forEach((app: any) => {
            statusMap[app.id] = app;
          });
          setAppsStatus(statusMap);
        }
      } catch (err) {
        console.error("Erro ao carregar status dos aplicativos:", err);
      }
    };
    fetchAppsStatus();
  }, [session]);

  // Verify administrative status from backend API
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session) {
        setIsAdmin(false);
        return;
      }
      try {
        const headers: Record<string, string> = {};
        if (!session.isMock && session.token) {
          headers["Authorization"] = `Bearer ${session.token}`;
        } else if (session.isMock) {
          headers["X-Mock-Email"] = session.email;
        }

        const res = await fetch("/api/admin/whoami", { headers });
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(!!data.isAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Erro ao verificar status de admin:", err);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, [session]);

  // Quem vê o Painel Admin: administrador confirmado pelo servidor (portal_admins) ou o administrador raiz de sempre.
  // O servidor continua sendo quem autoriza de verdade cada ação do painel.
  const canAdmin = isAdmin || session?.email?.toLowerCase().trim() === "barbosma1@gmail.com";

  const handleDemoLogin = () => {
    const demoSession: UserSession = {
      email: "visitante.shalom@comunidadeshalom.org.br",
      name: "Visitante Shalom",
      token: "demo_access_token_secure_jwt_simulation",
      isMock: true
    };
    setSession(demoSession);
    localStorage.setItem("portal_shalom_demo_session", JSON.stringify(demoSession));
    setSuccess("Entrou com sucesso no Modo de Demonstração!");
    setTimeout(() => setSuccess(null), 3000);
  };

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
          avatarUrl: sbSession.user.user_metadata?.avatar_url || sbSession.user.user_metadata?.picture,
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
          avatarUrl: sbSession.user.user_metadata?.avatar_url || sbSession.user.user_metadata?.picture,
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
    setMenuOpen(false);
    setPortalView("launcher");
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

  const handleAccessApp = async (appId: string, appUrl: string) => {
    setError(null);
    
    // Enforce email authorization check
    const appInfo = appsStatus[appId];
    if (session && appInfo && !appInfo.isAuthorized) {
      setError(`Acesso Negado: O e-mail "${session.email}" não possui autorização para o aplicativo "${staticApps.find(a => a.id === appId)?.name || appId}". O acesso universal é restrito a administradores.`);
      return;
    }
    
    // If we have a real production session and keys are configured, generate a real Magic Link via API
    if (session && !session.isMock && session.token && appsStatus[appId]?.hasKeys) {
      try {
        setLoading(true);
        const response = await fetch("/api/sso/generate-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.token}`
          },
          body: JSON.stringify({ appId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.actionLink) {
          window.open(data.actionLink, "_blank", "noopener,noreferrer");
          setLoading(false);
          return;
        } else {
          console.warn("SSO real indisponível, usando fallback:", data.error || "Erro desconhecido");
          if (data.error && data.error.includes("não está conectado")) {
            setError(data.error);
            setLoading(false);
            return;
          }
        }
      } catch (err: any) {
        console.error("Erro ao solicitar SSO real:", err);
      } finally {
        setLoading(false);
      }
    }

    // Fallback Redirection Mode (Demo / Simulation hash injection)
    const fallbackToken = session?.token || "mock_access_token";
    const fallbackRefresh = "mock_refresh_token";
    const destinationUrl = `${appUrl}#access_token=${fallbackToken}&refresh_token=${fallbackRefresh}`;
    window.open(destinationUrl, "_blank", "noopener,noreferrer");
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Botão da logo Portal Sh: abre o menu (Launcher / Painel Admin) */}
          <div className="relative shrink-0">
            <LogoMenuButton
              src="/brand/portal-logo-round.png"
              alt="Portal Sh"
              label="Menu do Portal Sh"
              expanded={menuOpen}
              onClick={() => session && setMenuOpen(o => !o)}
            />

            <AnimatePresence>
              {session && menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 top-full mt-2 z-50 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2"
                    id="portal-menu"
                  >
                    <button
                      onClick={() => { setPortalView("launcher"); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                        portalView === "launcher"
                          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <LayoutGrid size={18} />
                      <span>Launcher</span>
                    </button>
                    {canAdmin && (
                      <button
                        onClick={() => { setPortalView("admin"); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                          portalView === "admin"
                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Shield size={18} className="text-amber-500" />
                        <span>Painel Admin</span>
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            {/* PWA INSTALL BUTTON (só o ícone no celular) */}
            <button
              onClick={handleInstallClick}
              className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/50 flex items-center justify-center gap-1.5 w-9 sm:w-auto h-9 sm:px-3 rounded-lg border border-amber-200 dark:border-amber-900/50 transition-all cursor-pointer shadow-xs active:scale-95"
              id="pwa-install-button"
              title="Instalar Portal Sh como aplicativo no seu dispositivo"
              aria-label="Instalar aplicativo"
            >
              <Download size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Instalar App</span>
            </button>

            {session ? (
              <div className="flex items-center gap-1 sm:gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-slate-950 dark:text-white max-w-[150px] truncate">{session.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[150px] truncate font-mono">{session.email}</p>
                </div>
                {session.avatarUrl ? (
                  <img
                    src={session.avatarUrl}
                    alt="Avatar"
                    className="w-9 h-9 rounded-full border-2 border-amber-400 bg-amber-50 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm border-2 border-amber-400 shrink-0">
                    {session.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Configurações das Chaves de SSO"
                  id="settings-button"
                >
                  <Key size={18} />
                </button>
                <ThemeToggle variant="cycle" />
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
                
                {/* Logo Portal Sh */}
                <img
                  src={LOGOS.portal_full}
                  alt="Portal Sh"
                  className="w-36 h-36 mx-auto mb-4 rounded-2xl bg-white object-contain"
                />

                <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white tracking-tight mb-2">
                  Portal de Aplicativos
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                  Acesse com SSO (Single Sign-On) todos os sistemas integrados da comunidade Shalom em um só clique.
                </p>

                {/* LOGIN OPTIONS */}
                <div className="space-y-4">
                  {/* Option A: Supabase Google OAuth (Active if configured) */}
                  {isSupabaseConfigured && (
                    <>
                      <GoogleLogin onClick={handleGoogleLogin} id="supabase-google-login-button" />

                      <div className="flex items-center my-4">
                        <div className="flex-grow border-t border-slate-250 dark:border-slate-800" />
                        <span className="px-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">ou</span>
                        <div className="flex-grow border-t border-slate-250 dark:border-slate-800" />
                      </div>
                    </>
                  )}

                  {/* Option B: Visitor / Demo Session */}
                  <button
                    onClick={handleDemoLogin}
                    className="w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white transition-all duration-200 cursor-pointer shadow-md shadow-amber-500/10 active:scale-98"
                    id="demo-login-button"
                  >
                    <Unlock size={16} />
                    Entrar como Visitante (Modo Demo)
                  </button>

                  {!isSupabaseConfigured && (
                    <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left mt-4">
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        <span className="font-semibold block mb-1 flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <Info size={14} className="shrink-0" /> Modo de Demonstração Ativo:
                        </span>
                        Você pode navegar e testar todas as interfaces do portal e simular redirecionamentos de SSO para os aplicativos. Para conectar o login real de produção, configure as chaves no painel.
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
            /* 2. MAIN LOGGED-IN PORTAL CONTAINER */
            <motion.div
              key="logged-in-portal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
              id="logged-in-panel"
            >
              {portalView === "admin" && canAdmin ? (
                <AdminPanel session={session} />
              ) : (
                /* LAUNCHER: cada app é a própria logo; só os símbolos de SSO e de liberação */
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white">
                      Seus aplicativos
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                      {session.email}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto w-full" id="apps-grid">
                    {staticApps.map((app, index) => {
                      const st = appsStatus[app.id];
                      const authorized = !!st?.isAuthorized;
                      const hasKeys = !!st?.hasKeys;
                      return (
                        <motion.button
                          key={app.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => handleAccessApp(app.id, app.url)}
                          className={`relative aspect-square w-full rounded-3xl overflow-hidden shadow-md hover:shadow-xl active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-slate-800 ${
                            authorized ? "" : "opacity-60"
                          }`}
                          aria-label={authorized ? `Abrir ${app.name}` : `Acesso restrito: ${app.name}`}
                          title={authorized ? app.name : `${app.name} (acesso restrito)`}
                        >
                          <img src={LOGOS[app.id]} alt={app.name} className="w-full h-full object-cover" draggable={false} />
                          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/95 dark:bg-slate-900/90 px-2 py-1 shadow-sm">
                            <Key size={13} className={hasKeys ? "text-emerald-600" : "text-amber-500"} aria-hidden="true" />
                            {authorized ? (
                              <Check size={14} strokeWidth={3} className="text-emerald-600" aria-hidden="true" />
                            ) : (
                              <X size={14} strokeWidth={3} className="text-red-600" aria-hidden="true" />
                            )}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
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
      <Modal
        open={showPWAModal}
        onClose={() => setShowPWAModal(false)}
        title="Instalar Portal Shalom"
        footer={
          <button type="button" className="sh-btn sh-btn-primary" onClick={() => setShowPWAModal(false)}>
            Entendi, Fechar
          </button>
        }
      >
        <div id="pwa-modal">
          <p className="text-xs text-slate-500 mb-4">Adicione à tela inicial do seu dispositivo</p>
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
        </div>
      </Modal>

    </div>
  );
}
