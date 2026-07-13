import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const PORT = 3000;

// Configuration mapping for target community apps
const appConfigs: Record<string, { urlVar: string; keyVar: string; defaultUrl: string }> = {
  pashalom: {
    urlVar: "SUPABASE_URL_PASHALOM",
    keyVar: "SUPABASE_SERVICE_KEY_PASHALOM",
    defaultUrl: "https://pa-shalom.pages.dev"
  },
  poshalom: {
    urlVar: "SUPABASE_URL_POSHALOM",
    keyVar: "SUPABASE_SERVICE_KEY_POSHALOM",
    defaultUrl: "https://poshalom.pages.dev"
  },
  wopsh: {
    urlVar: "SUPABASE_URL_WOPSH",
    keyVar: "SUPABASE_SERVICE_KEY_WOPSH",
    defaultUrl: "https://wopsh.pages.dev"
  },
  gestopro: {
    urlVar: "SUPABASE_URL_GESTOPRO",
    keyVar: "SUPABASE_SERVICE_KEY_GESTOPRO",
    defaultUrl: "https://gest-opro.pages.dev"
  },
  evansh: {
    urlVar: "SUPABASE_URL_EVANSH",
    keyVar: "SUPABASE_SERVICE_KEY_EVANSH",
    defaultUrl: "https://evansh.pages.dev"
  },
  adoracaoshalom: {
    urlVar: "SUPABASE_URL_ADORACOOSHALOM",
    keyVar: "SUPABASE_SERVICE_KEY_ADORACOOSHALOM",
    defaultUrl: "https://adora-o-shalom.pages.dev"
  },
  cifrash: {
    urlVar: "SUPABASE_URL_CIFRASH",
    keyVar: "SUPABASE_SERVICE_KEY_CIFRASH",
    defaultUrl: "https://cifras-sh.pages.dev"
  }
};

// Access Control List (ACL): Authorized emails for each app (fallback)
const appAuthorizations: Record<string, string[]> = {
  pashalom: ["barbosma1@gmail.com"],
  poshalom: ["barbosma1@gmail.com"],
  gestopro: ["barbosma1@gmail.com"],
  evansh: ["barbosma1@gmail.com"],
  adoracaoshalom: ["barbosma1@gmail.com"],
  cifrash: ["barbosma1@gmail.com"],
  wopsh: ["barbosma1@gmail.com"]
};

// Helper to get portal Supabase client
function getPortalClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Portal Supabase configuration is missing");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Helper function to check if an email is authorized for a specific app
async function isUserAuthorizedForApp(email: string, appId: string): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  
  // barbosma1@gmail.com has universal access to all apps
  if (normalizedEmail === "barbosma1@gmail.com") {
    return true;
  }
  
  // Visitor / Demo simulation email gets demo access to specific apps
  if (normalizedEmail === "visitante.shalom@comunidadeshalom.org.br") {
    return ["adoracaoshalom", "cifrash"].includes(appId);
  }
  
  try {
    const portalClient = getPortalClient();
    const { data, error } = await portalClient
      .from("app_authorizations")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("app_id", appId);
      
    if (!error && data && data.length > 0) {
      return true;
    }
  } catch (e: any) {
    console.warn("[Local Fallback] Error reading app_authorizations table:", e.message);
  }
  
  const authorizedList = appAuthorizations[appId] || [];
  return authorizedList.map(e => e.toLowerCase().trim()).includes(normalizedEmail);
}

// Helper to check if an email is an administrator of the Portal
async function isAdminEmail(email: string): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  
  if (normalizedEmail === "visitante.shalom@comunidadeshalom.org.br") {
    return false;
  }
  
  try {
    const portalClient = getPortalClient();
    const { data, error } = await portalClient
      .from("portal_admins")
      .select("id")
      .eq("email", normalizedEmail);
      
    if (error) {
      console.warn("[Local Fallback] Error reading portal_admins table:", error.message);
      return normalizedEmail === "barbosma1@gmail.com";
    }
    
    return data && data.length > 0;
  } catch (err: any) {
    console.error("Error checking isAdminEmail:", err.message);
    return normalizedEmail === "barbosma1@gmail.com";
  }
}

// Helper to retrieve verified user email from request
async function getUserEmail(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const xMockEmail = req.headers["x-mock-email"];
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const portalUrl = process.env.VITE_SUPABASE_URL;
    const portalAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (portalUrl && portalAnonKey) {
      try {
        const portalClient = createClient(portalUrl, portalAnonKey);
        const { data: { user } } = await portalClient.auth.getUser(token);
        if (user && user.email) {
          return user.email;
        }
      } catch (e) {
        console.error("Error reading email from token:", e);
      }
    }
  } else if (xMockEmail && typeof xMockEmail === "string" && xMockEmail === "visitante.shalom@comunidadeshalom.org.br") {
    return xMockEmail;
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Route: Get the configuration status of all community apps with authorization check
  app.get("/api/apps-status", async (req, res) => {
    try {
      const userEmail = await getUserEmail(req);

      const status = await Promise.all(
        Object.entries(appConfigs).map(async ([id, config]) => {
          const url = process.env[config.urlVar];
          const key = process.env[config.keyVar];
          const isAuthorized = userEmail ? await isUserAuthorizedForApp(userEmail, id) : false;

          return {
            id,
            name: id === "pashalom" ? "PA Shalom" :
                  id === "poshalom" ? "PO Shalom" :
                  id === "wopsh" ? "WOP Shalom" :
                  id === "gestopro" ? "Gestão Pro" :
                  id === "evansh" ? "Evangelização Shalom" :
                  id === "adoracaoshalom" ? "Adoração Shalom" :
                  id === "cifrash" ? "Cifras Shalom" : id,
            url: config.defaultUrl,
            hasKeys: Boolean(url && key),
            isAuthorized
          };
        })
      );
      res.json({ apps: status, userEmail: userEmail || "" });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao listar status dos aplicativos: " + err.message });
    }
  });

  // API Route: Securely generate an SSO Magic Link for a target community app
  app.post("/api/sso/generate-link", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Sessão inválida ou não fornecida. Por favor, faça login novamente." });
      }
      const token = authHeader.split(" ")[1];

      const { appId } = req.body;
      if (!appId) {
        return res.status(400).json({ error: "O ID do aplicativo é obrigatório." });
      }

      const config = appConfigs[appId];
      if (!config) {
        return res.status(404).json({ error: "Aplicativo não encontrado." });
      }

      const targetUrl = process.env[config.urlVar];
      const targetServiceKey = process.env[config.keyVar];

      if (!targetUrl || !targetServiceKey) {
        return res.status(400).json({ error: `Este aplicativo (${appId}) ainda não está conectado no Portal Shalom.` });
      }

      // Main Portal Supabase configuration (lazy validation)
      const portalUrl = process.env.VITE_SUPABASE_URL;
      const portalAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!portalUrl || !portalAnonKey) {
        return res.status(500).json({ error: "O Portal Shalom não está totalmente configurado. Chaves do Portal ausentes no servidor." });
      }

      // Initialize Portal Supabase client to securely verify the active user's JWT
      const portalClient = createClient(portalUrl, portalAnonKey);
      const { data: { user }, error: authError } = await portalClient.auth.getUser(token);

      if (authError || !user || !user.email) {
        return res.status(401).json({ error: "Usuário não autenticado ou sessão expirada no Portal Shalom." });
      }

      // Strict Authorization Check
      const isAuthorized = await isUserAuthorizedForApp(user.email, appId);
      if (!isAuthorized) {
        return res.status(403).json({ 
          error: `Acesso negado. O e-mail '${user.email}' não possui autorização de acesso para este aplicativo. Entre em contato com o administrador barbosma1@gmail.com para solicitar acesso.` 
        });
      }

      // Initialize Target App's Supabase with its Service Role Key
      const targetSupabase = createClient(targetUrl, targetServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Generate a magiclink login link for the user's verified email
      const { data: linkData, error: linkError } = await targetSupabase.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
        options: {
          redirectTo: config.defaultUrl
        }
      });

      if (linkError || !linkData) {
        console.error(`Erro ao gerar link para ${appId}:`, linkError);
        return res.status(500).json({ error: `Não foi possível gerar acesso ao aplicativo: ${linkError?.message || "Erro desconhecido"}` });
      }

      // Handle properties.action_link or flat action_link
      const actionLink = linkData.properties?.action_link || (linkData as any).action_link;
      if (!actionLink) {
        return res.status(500).json({ error: "O link de login gerado é inválido." });
      }

      res.json({ actionLink });
    } catch (err: any) {
      console.error("Erro interno no SSO:", err);
      res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
    }
  });

  // API Route: Admin permissions CRUD (GET, POST, DELETE)
  app.get("/api/admin/authorizations", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const portalClient = getPortalClient();
      const { data, error } = await portalClient
        .from("app_authorizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          return res.json({ authorizations: [] });
        }
        return res.status(500).json({ error: error.message });
      }
      res.json({ authorizations: data || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/authorizations", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const { email: authEmail, appId } = req.body;
      if (!authEmail || !appId) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes" });
      }

      const portalClient = getPortalClient();
      const { data, error } = await portalClient
        .from("app_authorizations")
        .insert([{ email: authEmail.toLowerCase().trim(), app_id: appId }])
        .select();

      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true, authorization: data?.[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/authorizations", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });

      const portalClient = getPortalClient();
      const { error } = await portalClient
        .from("app_authorizations")
        .delete()
        .eq("id", id);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Portal Admins CRUD (GET, POST, DELETE)
  app.get("/api/admin/admins", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito a administradores." });
      }

      const portalClient = getPortalClient();
      const { data, error } = await portalClient
        .from("portal_admins")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          return res.json({ admins: [] });
        }
        return res.status(500).json({ error: error.message });
      }
      res.json({ admins: data || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/admins", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito a administradores." });
      }

      const { email: adminEmail } = req.body;
      if (!adminEmail) {
        return res.status(400).json({ error: "E-mail do administrador é obrigatório." });
      }

      const portalClient = getPortalClient();
      const { data, error } = await portalClient
        .from("portal_admins")
        .insert([{ email: adminEmail.toLowerCase().trim(), added_by: email }])
        .select();

      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true, admin: data?.[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/admins", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito a administradores." });
      }

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID do administrador obrigatório." });

      const portalClient = getPortalClient();
      
      // Fetch the record to delete
      const { data: targetAdmin, error: findError } = await portalClient
        .from("portal_admins")
        .select("email")
        .eq("id", id)
        .single();

      if (findError) return res.status(400).json({ error: findError.message });
      if (!targetAdmin) return res.status(404).json({ error: "Administrador não encontrado." });

      if (targetAdmin.email.toLowerCase().trim() === email.toLowerCase().trim()) {
        const { count, error: countError } = await portalClient
          .from("portal_admins")
          .select("id", { count: "exact", head: true });

        if (countError) return res.status(400).json({ error: countError.message });
        if (count !== null && count <= 1) {
          return res.status(400).json({ error: "Você não pode remover a si mesmo pois você é o único administrador restante do Portal." });
        }
      }

      const { error: deleteError } = await portalClient
        .from("portal_admins")
        .delete()
        .eq("id", id);

      if (deleteError) return res.status(400).json({ error: deleteError.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Admin Whoami check
  app.get("/api/admin/whoami", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email) {
        return res.json({ isAdmin: false, email: null });
      }
      const isAd = await isAdminEmail(email);
      res.json({ isAdmin: isAd, email });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Unified user directory across all apps
  app.get("/api/admin/all-users", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const consolidatedUsers: Record<string, any> = {};
      const errors: string[] = [];

      await Promise.all(
        Object.entries(appConfigs).map(async ([appId, config]) => {
          const targetUrl = process.env[config.urlVar];
          const targetServiceKey = process.env[config.keyVar];

          if (!targetUrl || !targetServiceKey) {
            errors.push(`Configurações de chaves ausentes para o app ${appId}`);
            return;
          }

          try {
            const targetSupabase = createClient(targetUrl, targetServiceKey, {
              auth: { autoRefreshToken: false, persistSession: false }
            });

            let authUsers: any[] = [];
            try {
              const { data, error } = await targetSupabase.auth.admin.listUsers();
              if (!error && data && data.users) {
                authUsers = data.users;
              }
            } catch (e: any) {
              console.warn(`Auth API bypass trigger in ${appId}`);
            }

            let publicProfiles: any[] = [];
            try {
              const { data, error } = await targetSupabase.from("profiles").select("*");
              if (!error && data) {
                publicProfiles = data;
              } else {
                const { data: uData, error: uError } = await targetSupabase.from("users").select("*");
                if (!uError && uData) {
                  publicProfiles = uData;
                }
              }
            } catch (e: any) {
              console.warn(`Profiles schema bypass in ${appId}`);
            }

            const appEmails = new Set<string>();
            authUsers.forEach(u => u.email && appEmails.add(u.email.toLowerCase().trim()));
            publicProfiles.forEach(p => p.email && appEmails.add(p.email.toLowerCase().trim()));

            appEmails.forEach(emailKey => {
              const authUser = authUsers.find(u => (u.email || "").toLowerCase().trim() === emailKey);
              const pubProfile = publicProfiles.find(p => (p.email || "").toLowerCase().trim() === emailKey);

              let name = "";
              if (pubProfile) name = pubProfile.nome || pubProfile.name || pubProfile.full_name || pubProfile.nome_completo || "";
              if (!name && authUser) {
                const meta = authUser.user_metadata || {};
                name = meta.nome || meta.name || meta.full_name || meta.nome_completo || "";
              }
              if (!name) name = emailKey.split("@")[0];

              let role = "usuário comum";
              if (pubProfile) {
                role = pubProfile.role || pubProfile.permissao || pubProfile.perfil || pubProfile.tipo || "usuário comum";
              } else if (authUser) {
                const meta = authUser.user_metadata || {};
                role = meta.role || meta.permissao || meta.perfil || "usuário comum";
              }

              if (role === "admin" || role === "administrator") role = "Administrador";
              else if (role === "coordinator" || role === "coordenador") role = "Coordenador";
              else if (role === "user" || role === "membro") role = "Membro";
              else role = role.charAt(0).toUpperCase() + role.slice(1);

              if (!consolidatedUsers[emailKey]) {
                consolidatedUsers[emailKey] = {
                  email: emailKey,
                  name: name || emailKey,
                  apps: {}
                };
              } else if (name && consolidatedUsers[emailKey].name === emailKey) {
                consolidatedUsers[emailKey].name = name;
              }

              consolidatedUsers[emailKey].apps[appId] = {
                participates: true,
                role
              };
            });

          } catch (err: any) {
            console.error(`Error loading users for ${appId}:`, err);
            errors.push(`Erro no app ${appId}: ${err.message}`);
          }
        })
      );

      res.json({ users: Object.values(consolidatedUsers), errors });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Canonical missions configuration
  app.get("/api/admin/missions", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const portalClient = getPortalClient();
      const { data: missions, error: mError } = await portalClient
        .from("mission_registry")
        .select("*")
        .order("canonical_name", { ascending: true });

      if (mError) {
        if (mError.code === "PGRST116" || mError.message.includes("does not exist")) {
          return res.json({ missions: [], mappings: [] });
        }
        return res.status(500).json({ error: mError.message });
      }

      const { data: mappings } = await portalClient.from("mission_app_mapping").select("*");
      res.json({ missions: missions || [], mappings: mappings || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/missions", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const { action, canonicalName, missionRegistryId, appId, remoteMissionName, mappingId } = req.body;
      const portalClient = getPortalClient();

      if (action === "create_mission") {
        const { data, error } = await portalClient
          .from("mission_registry")
          .insert([{ canonical_name: canonicalName }])
          .select();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, mission: data?.[0] });
      }

      if (action === "delete_mission") {
        const { error } = await portalClient.from("mission_registry").delete().eq("id", missionRegistryId);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }

      if (action === "create_mapping") {
        const { data, error } = await portalClient
          .from("mission_app_mapping")
          .insert([{
            mission_registry_id: missionRegistryId,
            app_id: appId,
            remote_mission_name: remoteMissionName
          }])
          .select();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, mapping: data?.[0] });
      }

      if (action === "delete_mapping") {
        const { error } = await portalClient.from("mission_app_mapping").delete().eq("id", mappingId);
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true });
      }

      res.status(400).json({ error: "Ação inválida" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route: Manual Event NPS
  app.get("/api/admin/nps", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const portalClient = getPortalClient();
      const { data, error } = await portalClient
        .from("event_nps")
        .select(`
          *,
          mission_registry:mission_registry_id (
            canonical_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          return res.json({ events: [] });
        }
        return res.status(500).json({ error: error.message });
      }
      res.json({ events: data || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/nps", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const { missionRegistryId, eventName, promotersPct, detractorsPct, id } = req.body;
      const portalClient = getPortalClient();

      let result;
      if (id) {
        const { data, error } = await portalClient
          .from("event_nps")
          .update({
            mission_registry_id: missionRegistryId,
            event_name: eventName,
            promoters_pct: Number(promotersPct),
            detractors_pct: Number(detractorsPct)
          })
          .eq("id", id)
          .select();
        if (error) return res.status(400).json({ error: error.message });
        result = data?.[0];
      } else {
        const { data, error } = await portalClient
          .from("event_nps")
          .insert([{
            mission_registry_id: missionRegistryId,
            event_name: eventName,
            promoters_pct: Number(promotersPct),
            detractors_pct: Number(detractorsPct)
          }])
          .select();
        if (error) return res.status(400).json({ error: error.message });
        result = data?.[0];
      }

      res.json({ success: true, eventNps: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/nps", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID obrigatório" });

      const portalClient = getPortalClient();
      const { error } = await portalClient.from("event_nps").delete().eq("id", id);
      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper score calculators for IIEE
  function getFinancialScore(pct: number): number {
    if (pct > 15) return 100;
    if (pct >= 5) return 85;
    if (pct > 0) return 75; // Intermediate surplus
    if (pct === 0) return 70;
    if (pct >= -5) return 50;
    if (pct >= -15) return 30;
    return 10;
  }

  function getEngagementScore(rate: number): number {
    if (rate > 20) return 100;
    if (rate >= 15) return 85;
    if (rate >= 10) return 70;
    if (rate >= 5) return 50;
    return 20;
  }

  function getNpsScoreAndClass(nps: number): { score: number; label: string } {
    if (nps > 75) return { score: 100, label: "Excelente" };
    if (nps >= 50) return { score: 85, label: "Muito bom" };
    if (nps >= 0) return { score: 50, label: "Precisa melhorar" };
    return { score: 20, label: "Ruim" };
  }

  function getIieeClassification(iiee: number): string {
    if (iiee >= 90) return "Grande potencial evangelizador";
    if (iiee >= 75) return "Forte";
    if (iiee >= 60) return "Mediano";
    if (iiee >= 40) return "Frágil";
    return "Crítico";
  }

  // API Route: Consolidated Reports Aggregator
  app.get("/api/admin/reports-summary", async (req, res) => {
    try {
      const email = await getUserEmail(req);
      if (!email || !(await isAdminEmail(email))) {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }

      const authHeader = req.headers.authorization || "";

      let missions: any[] = [];
      let mappings: any[] = [];
      let eventNps: any[] = [];
      let hasDatabase = true;

      try {
        const portalClient = getPortalClient();
        const [mRes, mapRes, npsRes] = await Promise.all([
          portalClient.from("mission_registry").select("*"),
          portalClient.from("mission_app_mapping").select("*"),
          portalClient.from("event_nps").select("*")
        ]);
        if (mRes.data) missions = mRes.data;
        if (mapRes.data) mappings = mapRes.data;
        if (npsRes.data) eventNps = npsRes.data;

        if (mRes.error && mRes.error.message.includes("does not exist")) {
          hasDatabase = false;
        }
      } catch (e) {
        console.warn("Dificuldades ao carregar Portal Database em Express:", e);
        hasDatabase = false;
      }

      const mappingDict = new Map<string, string>();
      mappings.forEach(map => {
        const canonicalObj = missions.find(m => m.id === map.mission_registry_id);
        if (canonicalObj) {
          mappingDict.set(`${map.app_id}:${map.remote_mission_name.toLowerCase().trim()}`, canonicalObj.canonical_name);
        }
      });

      const resolveMission = (appId: string, remoteName: string) => {
        if (!remoteName) return { canonicalName: "Não Informado", isMapped: false };
        const key = `${appId}:${remoteName.toLowerCase().trim()}`;
        if (mappingDict.has(key)) {
          return { canonicalName: mappingDict.get(key)!, isMapped: true };
        }
        const directMatch = missions.find(m => m.canonical_name.toLowerCase().trim() === remoteName.toLowerCase().trim());
        if (directMatch) {
          return { canonicalName: directMatch.canonical_name, isMapped: true };
        }
        return { canonicalName: remoteName, isMapped: false };
      };

      const activeApps = ["evansh", "wopsh", "gestopro", "pashalom", "adoracaoshalom", "cifrash", "poshalom"];
      const fetchedReports: Record<string, { data: any[]; isSimulated: boolean; unavailable?: boolean; reason?: string }> = {};
      const appWarnings: string[] = [];

      await Promise.all(
        activeApps.map(async (appId) => {
          const config = appConfigs[appId];
          if (!config) return;

          const targetUrl = process.env[config.urlVar];
          const appKey = process.env[config.keyVar];

          if (!targetUrl || !appKey) {
            fetchedReports[appId] = {
              data: [],
              isSimulated: false,
              unavailable: true,
              reason: `Chaves de acesso (${config.urlVar} / ${config.keyVar}) não configuradas no ambiente.`
            };
            appWarnings.push(appId);
            return;
          }

          try {
            const apiEndpoint = `${config.defaultUrl}/api/reports/summary`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

            const fetchRes = await fetch(apiEndpoint, {
              headers: {
                "Authorization": `Bearer ${appKey}`,
                "Content-Type": "application/json"
              },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (fetchRes.ok) {
              const result: any = await fetchRes.json();
              if (result && (result.missionData || result.branchData)) {
                fetchedReports[appId] = {
                  data: result.missionData || result.branchData,
                  isSimulated: false
                };
                return;
              }
            }
            throw new Error(`Código HTTP de erro: ${fetchRes.status}`);
          } catch (e: any) {
            console.warn(`Erro ao conectar com API do app ${appId} em Express:`, e.message);
            fetchedReports[appId] = {
              data: [],
              isSimulated: false,
              unavailable: true,
              reason: `Erro na conexão com o sub-aplicativo: ${e.message || "Timeout de conexão"}`
            };
            appWarnings.push(appId);
          }
        })
      );

      const groupedReports: Record<string, any> = {};
      const getGroup = (canonicalName: string, isMapped: boolean) => {
        if (!groupedReports[canonicalName]) {
          groupedReports[canonicalName] = { canonicalName, isMapped };
        }
        return groupedReports[canonicalName];
      };

      // A. Evansh
      if (fetchedReports.evansh && !fetchedReports.evansh.unavailable) {
        fetchedReports.evansh.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("evansh", item.mission_name);
          const group = getGroup(canonicalName, isMapped);
          group.evansh = {
            contactsCount: item.contacts_count,
            engagementRate: item.engagement_rate,
            isSimulated: false
          };
        });
      }

      // B. Wopsh
      if (fetchedReports.wopsh && !fetchedReports.wopsh.unavailable) {
        fetchedReports.wopsh.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("wopsh", item.mission_name);
          const group = getGroup(canonicalName, isMapped);
          group.wopsh = {
            obra: item.members_obra,
            cal: item.members_cal,
            cv: item.members_cv,
            isSimulated: false
          };
        });
      }

      // C. Gestão Pro
      if (fetchedReports.gestopro && !fetchedReports.gestopro.unavailable) {
        fetchedReports.gestopro.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("gestopro", item.branch_name);
          const group = getGroup(canonicalName, isMapped);
          group.gestopro = {
            salesCount: item.sales_count,
            revenue: item.revenue,
            costs: item.costs,
            isSimulated: false
          };
        });
      }

      // D. PA Shalom
      if (fetchedReports.pashalom && !fetchedReports.pashalom.unavailable) {
        fetchedReports.pashalom.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("pashalom", item.mission_name);
          const group = getGroup(canonicalName, isMapped);
          group.pashalom = {
            actionsPlanned: item.actions_planned,
            actionsDone: item.actions_done,
            budgetPlanned: item.budget_planned,
            budgetActual: item.budget_actual,
            isSimulated: false
          };
        });
      }

      // E. Adoração Shalom
      if (fetchedReports.adoracaoshalom && !fetchedReports.adoracaoshalom.unavailable) {
        fetchedReports.adoracaoshalom.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("adoracaoshalom", item.mission_name);
          const group = getGroup(canonicalName, isMapped);
          group.adoracaoshalom = {
            high: item.participants_high,
            medium: item.participants_medium,
            low: item.participants_low,
            occupancy: item.scale_occupancy_pct,
            isSimulated: false
          };
        });
      }

      // F. Cifras Shalom
      if (fetchedReports.cifrash && !fetchedReports.cifrash.unavailable) {
        fetchedReports.cifrash.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("cifrash", item.mission_name);
          const group = getGroup(canonicalName, isMapped);
          group.cifrash = {
            totalRepertoires: item.total_repertoires,
            totalCords: item.total_cords,
            isSimulated: false
          };
        });
      }

      // G. PO Shalom
      if (fetchedReports.poshalom && !fetchedReports.poshalom.unavailable) {
        fetchedReports.poshalom.data.forEach(item => {
          const { canonicalName, isMapped } = resolveMission("poshalom", item.mission_name);
          const group = getGroup(canonicalName, isMapped);
          group.poshalom = {
            financialResultPct: item.financial_result_pct,
            eventName: item.event_name,
            isSimulated: false
          };
        });
      }

      missions.forEach(mission => {
        const name = mission.canonical_name;
        const group = groupedReports[name];
        if (!group) return;

        const hasFinance = group.poshalom !== undefined;
        const hasEngagement = group.evansh !== undefined;

        const npsRecord = eventNps.find(n => n.mission_registry_id === mission.id);
        
        let pPct = 0;
        let dPct = 0;
        let customEventName: string | null = null;
        let npsValue: number | null = null;
        let npsScore: number | null = null;
        let npsLabel = "Sem dados";

        if (npsRecord) {
          pPct = npsRecord.promoters_pct;
          dPct = npsRecord.detractors_pct;
          customEventName = npsRecord.event_name;
          npsValue = pPct - dPct;
          const rating = getNpsScoreAndClass(npsValue);
          npsScore = rating.score;
          npsLabel = rating.label;
        }

        const financialResultPct = hasFinance ? group.poshalom!.financialResultPct : null;
        const financialScore = financialResultPct !== null ? getFinancialScore(financialResultPct) : null;

        const engagementRate = hasEngagement ? group.evansh!.engagementRate : null;
        const engagementScore = engagementRate !== null ? getEngagementScore(engagementRate) : null;

        let iieeValue: number | null = null;
        let classification = "Sem dados";

        let totalWeight = 0;
        let weightedSum = 0;

        if (financialScore !== null) {
          const w = npsScore !== null ? 0.35 : 0.45;
          totalWeight += w;
          weightedSum += financialScore * w;
        }
        if (engagementScore !== null) {
          const w = npsScore !== null ? 0.45 : 0.55;
          totalWeight += w;
          weightedSum += engagementScore * w;
        }
        if (npsScore !== null) {
          const w = 0.20;
          totalWeight += w;
          weightedSum += npsScore * w;
        }

        if (totalWeight > 0) {
          iieeValue = Math.round(weightedSum / totalWeight);
          classification = getIieeClassification(iieeValue);
        }

        group.iiee = {
          value: iieeValue,
          classification,
          financialScore,
          engagementScore,
          npsScore,
          npsValue,
          npsLabel,
          eventName: group.poshalom?.eventName || customEventName
        };
      });

      const appAvailability: Record<string, { unavailable: boolean; reason?: string }> = {};
      activeApps.forEach(appId => {
        appAvailability[appId] = {
          unavailable: fetchedReports[appId]?.unavailable || false,
          reason: fetchedReports[appId]?.reason
        };
      });

      res.json({
        reports: Object.values(groupedReports),
        warnings: appWarnings,
        hasDatabase,
        appAvailability
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite development middleware or static production delivery
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Portal Shalom Backend] Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
