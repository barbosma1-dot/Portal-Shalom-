import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Users, 
  Key, 
  Map, 
  Smile, 
  BarChart3, 
  Plus, 
  Trash2, 
  Search, 
  AlertTriangle, 
  Check, 
  RefreshCw,
  PlusCircle,
  TrendingUp,
  MapPin,
  Calendar,
  AlertCircle,
  Sliders,
  DollarSign,
  Heart,
  Music,
  Flame,
  Church,
  Info,
  CheckCircle,
  ChevronDown,
  Edit2
} from "lucide-react";
import { UserSession } from "../types";

interface AdminPanelProps {
  session: UserSession;
}

export default function AdminPanel({ session }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"iiee" | "perms" | "users" | "missions" | "nps" | "admins">("iiee");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data states
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [eventNps, setEventNps] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasDatabase, setHasDatabase] = useState(true);
  const [admins, setAdmins] = useState<any[]>([]);

  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [appFilter, setAppFilter] = useState("all");

  // Form states - SSO Authorizations
  const [newPermEmail, setNewPermEmail] = useState("");
  const [newPermAppId, setNewPermAppId] = useState("pashalom");

  // Form states - Portal Administrators
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // Form states - Missions
  const [newMissionName, setNewMissionName] = useState("");
  const [newMapRegistryId, setNewMapRegistryId] = useState("");
  const [newMapAppId, setNewMapAppId] = useState("evansh");
  const [newMapRemoteName, setNewMapRemoteName] = useState("");

  // Form states - NPS
  const [editingNpsId, setEditingNpsId] = useState<string | null>(null);
  const [npsMissionId, setNpsMissionId] = useState("");
  const [npsEventName, setNpsEventName] = useState("");
  const [npsPromoters, setNpsPromoters] = useState("");
  const [npsDetractors, setNpsDetractors] = useState("");

  // Get common API request headers
  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (session.isMock) {
      headers["X-Mock-Email"] = session.email;
    } else if (session.token) {
      headers["Authorization"] = `Bearer ${session.token}`;
    }
    return headers;
  };

  // 1. Fetch SSO Authorizations
  const fetchAuthorizations = async () => {
    try {
      const res = await fetch("/api/admin/authorizations", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuthorizations(data.authorizations || []);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao carregar permissões.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 2. Fetch Consolidated Users Directory
  const fetchAllUsers = async () => {
    try {
      const res = await fetch("/api/admin/all-users", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao carregar diretório consolidado de usuários.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 3. Fetch Canonical Missions and Mappings
  const fetchMissions = async () => {
    try {
      const res = await fetch("/api/admin/missions", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
        setMappings(data.mappings || []);
        if (data.missions && data.missions.length > 0 && !npsMissionId) {
          setNpsMissionId(data.missions[0].id);
          setNewMapRegistryId(data.missions[0].id);
        }
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao carregar missões canônicas.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 4. Fetch Event NPS Records
  const fetchEventNps = async () => {
    try {
      const res = await fetch("/api/admin/nps", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEventNps(data.events || []);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao carregar registros de NPS.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 5. Fetch Integrated Reports & IIEE Dashboard
  const fetchReportsSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports-summary", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setWarnings(data.warnings || []);
        setHasDatabase(data.hasDatabase !== false);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao carregar relatórios e indicadores.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Fetch Portal Administrators
  const fetchAdmins = async () => {
    try {
      const res = await fetch("/api/admin/admins", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao carregar administradores.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Load active tab data
  useEffect(() => {
    setError(null);
    if (activeTab === "iiee") {
      fetchReportsSummary();
      fetchMissions(); // need canonical names for comparison
    } else if (activeTab === "perms") {
      fetchAuthorizations();
    } else if (activeTab === "users") {
      fetchAllUsers();
    } else if (activeTab === "missions") {
      fetchMissions();
    } else if (activeTab === "nps") {
      fetchEventNps();
      fetchMissions();
    } else if (activeTab === "admins") {
      fetchAdmins();
    }
  }, [activeTab]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ email: newAdminEmail })
      });
      if (res.ok) {
        setSuccess("Novo administrador adicionado com sucesso!");
        setNewAdminEmail("");
        fetchAdmins();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao adicionar administrador.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm("Tem certeza de que deseja remover este administrador do Portal?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins?id=${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setSuccess("Administrador removido com sucesso!");
        fetchAdmins();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir administrador.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // SSO Form Submissions
  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPermEmail) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/authorizations", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ email: newPermEmail, appId: newPermAppId })
      });
      if (res.ok) {
        setSuccess("Nova permissão adicionada com sucesso!");
        setNewPermEmail("");
        fetchAuthorizations();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar permissão.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeletePermission = async (id: string) => {
    if (!confirm("Tem certeza de que deseja excluir esta permissão de acesso?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/authorizations?id=${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setSuccess("Permissão removida com sucesso!");
        fetchAuthorizations();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir permissão.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Mission & Mappings Form Submissions
  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMissionName) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/missions", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ action: "create_mission", canonicalName: newMissionName })
      });
      if (res.ok) {
        setSuccess(`Missão canônica '${newMissionName}' registrada!`);
        setNewMissionName("");
        fetchMissions();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao registrar missão.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!confirm("Tem certeza? Excluir a missão canônica irá invalidar seus mapeamentos e dados agregados de NPS.")) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/missions", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ action: "delete_mission", missionRegistryId: id })
      });
      if (res.ok) {
        setSuccess("Missão canônica excluída com sucesso.");
        fetchMissions();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir missão canônica.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapRegistryId || !newMapAppId || !newMapRemoteName) return;
    setError(null);
    try {
      const res = await fetch("/api/admin/missions", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          action: "create_mapping",
          missionRegistryId: newMapRegistryId,
          appId: newMapAppId,
          remoteMissionName: newMapRemoteName
        })
      });
      if (res.ok) {
        setSuccess("Mapeamento De-Para cadastrado com sucesso!");
        setNewMapRemoteName("");
        fetchMissions();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao cadastrar mapeamento.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/missions", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ action: "delete_mapping", mappingId: id })
      });
      if (res.ok) {
        setSuccess("Mapeamento De-Para excluído.");
        fetchMissions();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir mapeamento.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // NPS Form Submissions
  const handleSaveNps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npsMissionId || !npsEventName || npsPromoters === "" || npsDetractors === "") return;
    setError(null);
    try {
      const res = await fetch("/api/admin/nps", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          id: editingNpsId,
          missionRegistryId: npsMissionId,
          eventName: npsEventName,
          promotersPct: Number(npsPromoters),
          detractorsPct: Number(npsDetractors)
        })
      });
      if (res.ok) {
        setSuccess(editingNpsId ? "Registro de NPS atualizado com sucesso!" : "Novo registro de NPS criado com sucesso!");
        setEditingNpsId(null);
        setNpsEventName("");
        setNpsPromoters("");
        setNpsDetractors("");
        fetchEventNps();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar NPS.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEditNps = (nps: any) => {
    setEditingNpsId(nps.id);
    setNpsMissionId(nps.mission_registry_id);
    setNpsEventName(nps.event_name);
    setNpsPromoters(String(nps.promoters_pct));
    setNpsDetractors(String(nps.detractors_pct));
  };

  const handleDeleteNps = async (id: string) => {
    if (!confirm("Excluir permanentemente este registro de NPS?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/nps?id=${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setSuccess("Registro de NPS excluído.");
        fetchEventNps();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir NPS.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Filter lists based on search states
  const filteredPerms = authorizations.filter(item => {
    const matchesSearch = item.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesApp = appFilter === "all" || item.app_id === appFilter;
    return matchesSearch && matchesApp;
  });

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const participatingApps = Object.keys(user.apps || {});
    const matchesApp = appFilter === "all" || participatingApps.includes(appFilter);
    return matchesSearch && matchesApp;
  });

  const getAppName = (appId: string) => {
    const names: Record<string, string> = {
      pashalom: "PA Shalom",
      poshalom: "PO Shalom",
      gestopro: "Gestão Pro",
      evansh: "Evangelização Shalom",
      adoracaoshalom: "Adorador Shalom",
      cifrash: "Cifras Shalom",
      wopsh: "WOP Shalom",
      benfeitorpaz: "Benfeitor da Paz"
    };
    return names[appId] || appId;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all" id="admin-panel-container">
      {/* Admin Panel Header Banner */}
      <div className="bg-slate-950 text-white p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Shield size={24} className="text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-xl sm:text-2xl tracking-tight">Painel do Administrador</h2>
              <span className="bg-red-500/25 border border-red-500/35 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Root</span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Console centralizado para gerenciar permissões, integrar missões canônicas e auditar os aplicativos Shalom.</p>
          </div>
        </div>
        <div className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono self-start md:self-center">
          Administrador: <span className="text-amber-400 font-semibold">{session.email}</span>
        </div>
      </div>

      {/* Internal Notification Alerts */}
      {error && (
        <div className="mx-6 sm:mx-8 mt-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={16} />
          <div className="text-xs text-red-800 dark:text-red-300">
            <p className="font-semibold mb-0.5">Falha de Operação</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mx-6 sm:mx-8 mt-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl flex items-start gap-3">
          <CheckCircle className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={16} />
          <div className="text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-semibold mb-0.5">Sucesso</p>
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* Main Tabs Selection Row */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 sm:px-6">
        <button
          onClick={() => setActiveTab("iiee")}
          className={`flex items-center gap-2 px-4 py-4 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "iiee"
              ? "border-amber-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <BarChart3 size={15} />
          <span>Dashboard & IIEE</span>
        </button>
        <button
          onClick={() => setActiveTab("perms")}
          className={`flex items-center gap-2 px-4 py-4 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "perms"
              ? "border-amber-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Key size={15} />
          <span>Autorizações SSO</span>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-4 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "users"
              ? "border-amber-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users size={15} />
          <span>Diretório Consolidado</span>
        </button>
        <button
          onClick={() => setActiveTab("missions")}
          className={`flex items-center gap-2 px-4 py-4 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "missions"
              ? "border-amber-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Map size={15} />
          <span>Mapeamento Missões</span>
        </button>
        <button
          onClick={() => setActiveTab("nps")}
          className={`flex items-center gap-2 px-4 py-4 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "nps"
              ? "border-amber-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Smile size={15} />
          <span>Lançamento NPS</span>
        </button>
        <button
          onClick={() => setActiveTab("admins")}
          className={`flex items-center gap-2 px-4 py-4 border-b-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "admins"
              ? "border-amber-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          id="tab-button-admins"
        >
          <Shield size={15} className="text-amber-500" />
          <span>Administradores</span>
        </button>
      </div>

      <div className="p-6 sm:p-8" id="admin-panel-tabs-content">
        
        {/* ==================== TAB 1: IIEE CONSOLIDATED REPORTS ==================== */}
        {activeTab === "iiee" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="text-amber-500" size={18} />
                  Dashboard Estratégico: Índice IIEE
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidação automática de relatórios dos 7 sistemas para calcular o impacto evangelizador global por missão canônica.
                </p>
              </div>
              <button 
                onClick={fetchReportsSummary} 
                disabled={loading}
                className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer flex items-center gap-1 hover:shadow-xs active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                Atualizar Dados
              </button>
            </div>

            {/* Offline and Simulation Database Warning Indicator */}
            {!hasDatabase && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-xs leading-relaxed">
                <div className="flex gap-2 font-semibold text-amber-900 dark:text-amber-400 mb-1 items-center">
                  <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                  Base de dados do Portal indisponível ou offline
                </div>
                O backend está processando os dados através do gerador de relatórios analíticos de simulação. As tabelas do Portal no Supabase (como <code className="font-mono bg-amber-500/15 px-1 rounded">mission_registry</code>, <code className="font-mono bg-amber-500/15 px-1 rounded">mission_app_mapping</code> e <code className="font-mono bg-amber-500/15 px-1 rounded">event_nps</code>) não foram identificadas. Execute a migração do banco no Supabase ou configure sua credencial <code className="font-mono bg-amber-500/15 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>.
              </div>
            )}

            {/* Simulated Apps Flag Indicator */}
            {warnings.length > 0 && (
              <div className="p-3.5 bg-sky-50 dark:bg-sky-950/20 border border-sky-150 dark:border-sky-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-sky-800 dark:text-sky-300">
                <Info size={14} className="shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Bypass de Integração de Relatórios Ativo</p>
                  <p className="opacity-90 mt-0.5">Os seguintes aplicativos estão offline, sem URLs mapeadas ou inacessíveis, utilizando geradores locais de dados consolidados em fallback automático: <span className="font-semibold text-sky-900 dark:text-sky-200">{warnings.map(w => getAppName(w)).join(", ")}</span>.</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-24 text-center">
                <RefreshCw className="animate-spin text-amber-500 mx-auto mb-3" size={32} />
                <p className="text-sm font-medium text-slate-600">Buscando e agrupando relatórios dos aplicativos de célula, finanças, adoração e cifras...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <AlertTriangle size={32} className="text-amber-500 mx-auto mb-2" />
                <p className="font-medium text-slate-800 dark:text-white">Nenhum dado consolidado</p>
                <p className="text-xs text-slate-500 mt-1">Nenhuma missão canônica foi cadastrada ou identificada nos mapeamentos de relatórios.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Visual Cards Overview of IIEE formula */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">📊 Peso Financeiro (35%)</span>
                    <p className="text-slate-500 leading-relaxed">Calculado a partir do superávit ou déficit financeiro reportado no <span className="font-semibold text-amber-600">PO Shalom</span> ou <span className="font-semibold">Gestão Pro</span>.</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">🔥 Peso de Engajamento (45%)</span>
                    <p className="text-slate-500 leading-relaxed">Calculado a partir do índice de participação, novos contatos e atividade nas células do <span className="font-semibold text-rose-600">Evangelização Shalom</span>.</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">❤️ Peso de Experiência (20%)</span>
                    <p className="text-slate-500 leading-relaxed">Calculado a partir da nota NPS (Net Promoter Score) de eventos locais registradas manualmente no Portal.</p>
                  </div>
                </div>

                {/* Main IIEE Comparative Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold font-display">
                          <th className="p-4">Missão Canônica</th>
                          <th className="p-4">Índice IIEE</th>
                          <th className="p-4 text-center">Aproveit. Financeiro</th>
                          <th className="p-4 text-center">Taxa Engajamento</th>
                          <th className="p-4 text-center">Event NPS</th>
                          <th className="p-4 text-right">Classificação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {reports.map((report) => {
                          const hasIiee = report.iiee && report.iiee.value !== null && report.iiee.value !== undefined;
                          const iieeVal = hasIiee ? report.iiee.value : null;
                          const hasNps = report.iiee && report.iiee.npsValue !== null && report.iiee.npsValue !== undefined;
                          const npsValue = hasNps ? report.iiee.npsValue : null;
                          
                          // IIEE color tags
                          let iieeBg = "bg-slate-50 text-slate-400 dark:bg-slate-900/50 dark:text-slate-500 border-slate-200";
                          if (iieeVal !== null) {
                            if (iieeVal >= 85) iieeBg = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200";
                            else if (iieeVal >= 70) iieeBg = "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200";
                            else if (iieeVal >= 50) iieeBg = "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200";
                            else iieeBg = "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200";
                          }

                          return (
                            <tr key={report.canonicalName} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              {/* Mission Name & Mapping Check */}
                              <td className="p-4">
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {report.canonicalName}
                                  {!report.isMapped && (
                                    <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[9px] px-1.5 py-0.5 rounded font-normal" title="Esta missão foi encontrada em apps remotos mas não possui de-para explícito no Portal">Automapeado</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Mapeado em {Object.keys(report).filter(k => k !== "canonicalName" && k !== "isMapped" && k !== "iiee").length} sistemas
                                </div>
                              </td>

                              {/* Unified IIEE Gauge */}
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className={`px-2.5 py-1 text-sm font-bold border rounded-lg ${iieeBg}`}>
                                    {iieeVal !== null ? `${iieeVal}%` : "Sem dados"}
                                  </div>
                                  <div className="w-20 bg-slate-100 dark:bg-slate-850 h-2 rounded-full overflow-hidden shrink-0">
                                    {iieeVal !== null ? (
                                      <div 
                                        className={`h-full ${
                                          iieeVal >= 85 ? "bg-emerald-500" :
                                          iieeVal >= 70 ? "bg-blue-500" :
                                          iieeVal >= 50 ? "bg-amber-500" : "bg-rose-500"
                                        }`}
                                        style={{ width: `${iieeVal}%` }}
                                      />
                                    ) : (
                                      <div className="h-full bg-slate-200 dark:bg-slate-800" style={{ width: "0%" }} />
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* App Finance Output */}
                              <td className="p-4 text-center">
                                {report.poshalom ? (
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {report.poshalom.financialResultPct > 0 ? "+" : ""}{report.poshalom.financialResultPct}%
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide font-mono">PO Shalom</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">Sem dados</span>
                                )}
                              </td>

                              {/* App Evansh Output */}
                              <td className="p-4 text-center">
                                {report.evansh ? (
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {report.evansh.engagementRate}%
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide font-mono">{report.evansh.contactsCount} contatos</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">Sem dados</span>
                                )}
                              </td>

                              {/* Unified Event NPS Output */}
                              <td className="p-4 text-center">
                                {npsValue !== null ? (
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {npsValue}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase truncate max-w-[120px] mx-auto" title={report.iiee?.eventName}>
                                      {report.iiee?.eventName || "Geral"}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">Sem dados</span>
                                )}
                              </td>

                              {/* Final Classification Title */}
                              <td className="p-4 text-right">
                                <span className={`inline-block px-2 py-0.5 font-semibold rounded-full text-[10px] ${
                                  iieeVal === null ? "bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400" :
                                  iieeVal >= 90 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                                  iieeVal >= 75 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                                  iieeVal >= 60 ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400" :
                                  iieeVal >= 40 ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                                  "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-red-400"
                                }`}>
                                  {report.iiee?.classification || "Sem dados"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detailed Bento Grid of Sub-App Metrics per Mission */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider col-span-full border-b border-slate-200 dark:border-slate-800 pb-2">Detalhes de Métricas Consolidadas</h4>
                  
                  {reports.map((report) => (
                    <div key={`details-${report.canonicalName}`} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-250/50 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                      <div className="flex justify-between items-start">
                        <h5 className="font-display font-bold text-base text-slate-900 dark:text-white">{report.canonicalName}</h5>
                        <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded text-[11px] font-mono">IIEE: {report.iiee?.value || 0}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* WOP SHALOM */}
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850">
                          <p className="font-mono text-[9px] text-orange-600 dark:text-orange-400 font-bold uppercase">WOP Shalom</p>
                          {report.wopsh ? (
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                              {report.wopsh.obra} Obra | {report.wopsh.cal} CAL | {report.wopsh.cv} CV
                            </p>
                          ) : (
                            <p className="text-slate-400 mt-1">Sem Relatório</p>
                          )}
                        </div>

                        {/* GESTÃO PRO */}
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850">
                          <p className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Gestão Pro</p>
                          {report.gestopro ? (
                            <div className="mt-1">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{report.gestopro.salesCount} Vendas</p>
                              <p className="text-[10px] text-slate-400">Receita: R$ {report.gestopro.revenue.toLocaleString()}</p>
                            </div>
                          ) : (
                            <p className="text-slate-400 mt-1">Sem Relatório</p>
                          )}
                        </div>

                        {/* PA SHALOM */}
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850">
                          <p className="font-mono text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase">PA Shalom</p>
                          {report.pashalom ? (
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                              {report.pashalom.actionsDone}/{report.pashalom.actionsPlanned} Metas cumpridas
                            </p>
                          ) : (
                            <p className="text-slate-400 mt-1">Sem Relatório</p>
                          )}
                        </div>

                        {/* ADORAÇÃO SHALOM */}
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850">
                          <p className="font-mono text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">Adoração Shalom</p>
                          {report.adoracaoshalom ? (
                            <div className="mt-1">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{report.adoracaoshalom.occupancy}% Ocupação escala</p>
                              <p className="text-[10px] text-slate-400">{report.adoracaoshalom.high} Adoradores</p>
                            </div>
                          ) : (
                            <p className="text-slate-400 mt-1">Sem Relatório</p>
                          )}
                        </div>

                        {/* CIFRAS SHALOM */}
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 col-span-2">
                          <p className="font-mono text-[9px] text-violet-600 dark:text-violet-400 font-bold uppercase">Cifras Shalom</p>
                          {report.cifrash ? (
                            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                              {report.cifrash.totalRepertoires} Repertórios criados • {report.cifrash.totalCords} Cifras impressas
                            </p>
                          ) : (
                            <p className="text-slate-400 mt-1">Sem Relatório</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: SSO PERMISSIONS ==================== */}
        {activeTab === "perms" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Controle de Acesso SSO (ACL)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina quais e-mails têm permissão para acessar cada um dos 7 sistemas integrados do Portal. O administrador principal possui acesso universal garantido.
              </p>
            </div>

            {/* Insertion Form */}
            <form onSubmit={handleAddPermission} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">E-mail do Membro</label>
                <input
                  type="email"
                  required
                  placeholder="ex: vocacionado@shalom.org.br"
                  value={newPermEmail}
                  onChange={(e) => setNewPermEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-850 dark:text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Selecione o Aplicativo</label>
                <select
                  value={newPermAppId}
                  onChange={(e) => setNewPermAppId(e.target.value)}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-850 dark:text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="pashalom">PA Shalom</option>
                  <option value="poshalom">PO Shalom</option>
                  <option value="gestopro">Gestão Pro</option>
                  <option value="evansh">Evangelização Shalom</option>
                  <option value="adoracaoshalom">Adoração Shalom</option>
                  <option value="cifrash">Cifras Shalom</option>
                  <option value="wopsh">WOP Shalom</option>
                  <option value="benfeitorpaz">Benfeitor da Paz</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer hover:shadow-sm active:scale-98 transition-all"
              >
                <Plus size={16} />
                <span>Autorizar E-mail</span>
              </button>
            </form>

            {/* Quick Filters */}
            <div className="flex flex-col sm:flex-row gap-3 text-xs items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar permissão por e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-slate-450 shrink-0">Filtrar por app:</span>
                <select
                  value={appFilter}
                  onChange={(e) => setAppFilter(e.target.value)}
                  className="h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="all">Todos os Apps</option>
                  <option value="pashalom">PA Shalom</option>
                  <option value="poshalom">PO Shalom</option>
                  <option value="gestopro">Gestão Pro</option>
                  <option value="evansh">Evangelização Shalom</option>
                  <option value="adoracaoshalom">Adoração Shalom</option>
                  <option value="cifrash">Cifras Shalom</option>
                  <option value="wopsh">WOP Shalom</option>
                  <option value="benfeitorpaz">Benfeitor da Paz</option>
                </select>
              </div>
            </div>

            {/* Permissions List Table */}
            {filteredPerms.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhuma permissão específica registrada para este filtro.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold font-display">
                        <th className="p-4">E-mail Autorizado</th>
                        <th className="p-4">Aplicativo Shalom</th>
                        <th className="p-4">Data Registro</th>
                        <th className="p-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredPerms.map((perm) => (
                        <tr key={perm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-mono font-semibold text-slate-800 dark:text-slate-200">{perm.email}</td>
                          <td className="p-4">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-semibold border border-slate-200 dark:border-slate-750">
                              {getAppName(perm.app_id)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-[10px]">
                            {perm.created_at ? new Date(perm.created_at).toLocaleDateString() : "Não informado"}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeletePermission(perm.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Excluir permissão de acesso"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: CONSOLIDATED USER DIRECTORY ==================== */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Diretório Consolidado de Usuários
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mapeamento integrado de todas as contas cadastradas e seus perfis/cargos remotos em cada um dos 7 sub-aplicativos integrados.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 text-xs items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Filtrar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-slate-450 shrink-0">Filtrar por participação em app:</span>
                <select
                  value={appFilter}
                  onChange={(e) => setAppFilter(e.target.value)}
                  className="h-9 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="all">Qualquer App</option>
                  <option value="pashalom">PA Shalom</option>
                  <option value="poshalom">PO Shalom</option>
                  <option value="gestopro">Gestão Pro</option>
                  <option value="evansh">Evangelização Shalom</option>
                  <option value="adoracaoshalom">Adoração Shalom</option>
                  <option value="cifrash">Cifras Shalom</option>
                  <option value="wopsh">WOP Shalom</option>
                  <option value="benfeitorpaz">Benfeitor da Paz</option>
                </select>
              </div>
            </div>

            {/* Unified User Directory List */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum usuário correspondente encontrado nas contas integradas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map((user) => (
                  <div key={user.email} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between text-xs gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold font-display shrink-0 text-xs uppercase border border-amber-200">
                        {user.name.substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-950 dark:text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-2.5">
                      <p className="text-[10px] text-slate-450 font-semibold mb-1 uppercase tracking-wider">Acessos & Cargos:</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {Object.entries(user.apps || {}).map(([appId, details]: any) => (
                          <div key={appId} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-2 py-0.5 rounded-md flex items-center gap-1.5 text-[10px]">
                            <span className="font-semibold text-slate-800 dark:text-slate-300">{getAppName(appId)}</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded font-mono uppercase tracking-tight">
                              {details.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: MISSIONS & DE-PARA MAPPING ==================== */}
        {activeTab === "missions" && (
          <div className="space-y-8">
            {/* Split Grid for Mission Registry & Mapping Registers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Mission Registry List & Creation */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin size={18} className="text-amber-500" />
                    Missões Canônicas de Referência
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registre os nomes oficiais das missões da Comunidade Católica Shalom. Elas servirão como o indexador padrão de consolidação de relatórios.
                  </p>
                </div>

                <form onSubmit={handleCreateMission} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex gap-3 text-xs items-end">
                  <div className="flex-1">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nova Missão Canônica</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Rio de Janeiro Centro"
                      value={newMissionName}
                      onChange={(e) => setNewMissionName(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-9 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold px-4 rounded-xl cursor-pointer active:scale-95 transition-all text-xs shrink-0"
                  >
                    Cadastrar
                  </button>
                </form>

                {missions.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                    Nenhuma missão canônica registrada.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          <th className="p-3">Missão Canônica</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {missions.map((mission) => (
                          <tr key={mission.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{mission.canonical_name}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteMission(mission.id)}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-2 rounded-lg cursor-pointer"
                                title="Excluir missão canônica"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* App De-Para Mission Mapping Registers */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Map size={18} className="text-amber-500" />
                    Mapeamento De-Para Remoto
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Associe grafias e variações de nomes de missões encontrados nos aplicativos externos com os nomes canônicos oficiais cadastrados ao lado.
                  </p>
                </div>

                <form onSubmit={handleCreateMapping} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Missão Canônica</label>
                      <select
                        value={newMapRegistryId}
                        onChange={(e) => setNewMapRegistryId(e.target.value)}
                        className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl focus:outline-none"
                      >
                        {missions.map(m => (
                          <option key={m.id} value={m.id}>{m.canonical_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">App Shalom Origem</label>
                      <select
                        value={newMapAppId}
                        onChange={(e) => setNewMapAppId(e.target.value)}
                        className="w-full h-9 px-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl focus:outline-none"
                      >
                        <option value="evansh">Evangelização Shalom</option>
                        <option value="wopsh">WOP Shalom</option>
                  <option value="benfeitorpaz">Benfeitor da Paz</option>
                        <option value="poshalom">PO Shalom</option>
                        <option value="pashalom">PA Shalom</option>
                        <option value="gestopro">Gestão Pro</option>
                        <option value="adoracaoshalom">Adoração Shalom</option>
                        <option value="cifrash">Cifras Shalom</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nome no App Externo (Exato/Variação)</label>
                    <div className="flex gap-3 items-end">
                      <input
                        type="text"
                        required
                        placeholder="ex: 'SP Centro', 'Guarulhos-Centro'"
                        value={newMapRemoteName}
                        onChange={(e) => setNewMapRemoteName(e.target.value)}
                        className="flex-grow h-9 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="h-9 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 rounded-xl cursor-pointer text-xs shrink-0 active:scale-95 transition-all"
                      >
                        Mapear De-Para
                      </button>
                    </div>
                  </div>
                </form>

                {mappings.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                    Nenhum mapeamento De-Para ativo.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          <th className="p-3">Remoto & App</th>
                          <th className="p-3">Destino Canônico</th>
                          <th className="p-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {mappings.map((map) => {
                          const canonicalObj = missions.find(m => m.id === map.mission_registry_id);
                          return (
                            <tr key={map.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-3">
                                <div className="font-mono font-semibold text-slate-950 dark:text-white">'{map.remote_mission_name}'</div>
                                <div className="text-[10px] text-slate-450 uppercase tracking-tight mt-0.5">{getAppName(map.app_id)}</div>
                              </td>
                              <td className="p-3 font-semibold text-amber-600 dark:text-amber-400">
                                {canonicalObj ? canonicalObj.canonical_name : `ID: ${map.mission_registry_id}`}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteMapping(map.id)}
                                  className="text-slate-450 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                                  title="Remover mapeamento"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 5: MANUAL NPS INJECTOR ==================== */}
        {activeTab === "nps" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Smile className="text-amber-500" size={18} />
                Lançamento Manual de NPS de Eventos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure os índices de satisfação dos principais eventos locais de cada missão (como Renascer ou Acampamentos de Jovens). Este indicador compõe 20% do cálculo final do Índice IIEE.
              </p>
            </div>

            {/* Event NPS Entry Form */}
            <form onSubmit={handleSaveNps} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 text-xs">
              <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] border-b border-slate-200/50 dark:border-slate-800 pb-1">
                {editingNpsId ? "Atualizar Registro NPS" : "Lançar Novo Índice NPS"}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Missão Canônica</label>
                  <select
                    value={npsMissionId}
                    onChange={(e) => setNpsMissionId(e.target.value)}
                    className="w-full h-10 px-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl focus:outline-none"
                  >
                    {missions.map(m => (
                      <option key={m.id} value={m.id}>{m.canonical_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Nome do Evento</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Renascer 2026, Acamp'S"
                    value={npsEventName}
                    onChange={(e) => setNpsEventName(e.target.value)}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">% Promotores (0 a 100)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    placeholder="ex: 80"
                    value={npsPromoters}
                    onChange={(e) => setNpsPromoters(e.target.value)}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">% Detratores (0 a 100)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    placeholder="ex: 10"
                    value={npsDetractors}
                    onChange={(e) => setNpsDetractors(e.target.value)}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-xl text-slate-850 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-1.5">
                {editingNpsId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNpsId(null);
                      setNpsEventName("");
                      setNpsPromoters("");
                      setNpsDetractors("");
                    }}
                    className="h-10 px-4 bg-slate-200 hover:bg-slate-300 text-slate-750 font-semibold rounded-xl cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
                <button
                  type="submit"
                  className="h-10 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl cursor-pointer active:scale-95 transition-all flex items-center gap-1 hover:shadow-xs"
                >
                  <CheckCircle size={15} />
                  <span>{editingNpsId ? "Salvar Alterações" : "Gravar Notas NPS"}</span>
                </button>
              </div>
            </form>

            {/* List of Registered NPS Indexes */}
            {eventNps.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                Nenhum registro de NPS cadastrado no sistema.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      <th className="p-3">Missão Canônica</th>
                      <th className="p-3">Evento Registrado</th>
                      <th className="p-3 text-center">Promotores / Detratores</th>
                      <th className="p-3 text-center">Score NPS Calculado</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {eventNps.map((nps) => {
                      const npsScore = nps.promoters_pct - nps.detractors_pct;
                      
                      // Color rating class
                      let badgeColor = "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-250";
                      if (npsScore > 75) badgeColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-250";
                      else if (npsScore >= 50) badgeColor = "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-250";
                      else if (npsScore >= 0) badgeColor = "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-250";

                      return (
                        <tr key={nps.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">
                            {nps.mission_registry?.canonical_name || "Mapeamento Pendente"}
                          </td>
                          <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{nps.event_name}</td>
                          <td className="p-3 text-center font-mono text-[11px] text-slate-500">
                            {nps.promoters_pct}% / {nps.detractors_pct}%
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-1 font-bold border rounded-lg ${badgeColor}`}>
                              {npsScore > 0 ? "+" : ""}{npsScore}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditNps(nps)}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 p-2 rounded-lg cursor-pointer transition-colors"
                                title="Editar notas"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteNps(nps.id)}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-2 rounded-lg cursor-pointer transition-colors"
                                title="Excluir NPS"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
