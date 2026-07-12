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
    defaultUrl: "https://pashalom.pages.dev"
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
    defaultUrl: "https://cifra-sh.pages.dev"
  }
};

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Route: Get the configuration status of all community apps
  app.get("/api/apps-status", (req, res) => {
    try {
      const status = Object.entries(appConfigs).map(([id, config]) => {
        const url = process.env[config.urlVar];
        const key = process.env[config.keyVar];
        return {
          id,
          name: id === "pashalom" ? "PA Shalom" :
                id === "wopsh" ? "Wopsh" :
                id === "gestopro" ? "Gest-o-pro" :
                id === "evansh" ? "Evansh" :
                id === "adoracaoshalom" ? "Adoração Shalom" :
                id === "cifrash" ? "Cifra Sh" : id,
          url: config.defaultUrl,
          hasKeys: Boolean(url && key)
        };
      });
      res.json({ apps: status });
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

      // 1. Fetch user profile from Portal Shalom database
      const { data: profile, error: profileErr } = await portalClient
        .from("profiles")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (profileErr) {
        console.error("Erro ao carregar perfil do Portal Shalom:", profileErr);
      }

      if (!profile) {
        return res.status(400).json({ error: "Você ainda não possui cadastro no Portal Shalom. Por favor, registre-se primeiro." });
      }

      // Extract name and role from Portal's profiles
      const parts = profile.full_name.split(" | ");
      const name = parts[0] || user.email.split("@")[0];
      const role = parts[1] || "Membro";

      // 2. Enforce server-side authorization checks based on Portal role
      const appRoleRequired = 
        (appId === "pashalom" || appId === "poshalom" || appId === "gestopro" || appId === "evansh") 
          ? "Coordenador" 
          : "Membro";

      if (role !== "Administrador" && appRoleRequired === "Coordenador" && role !== "Coordenador") {
        return res.status(403).json({ error: `Acesso Negado: Este aplicativo requer nível de acesso Coordenador ou Administrador. Seu cargo atual é: ${role}.` });
      }

      // Initialize Target App's Supabase with its Service Role Key
      const targetSupabase = createClient(targetUrl, targetServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // 3. Synchronize user and role to target Supabase Auth and database
      try {
        // Find if user already exists in target Supabase Auth
        const { data: userListData } = await targetSupabase.auth.admin.listUsers() as any;
        const userData = userListData?.users?.find((u: any) => u.email?.toLowerCase() === user.email?.toLowerCase());
        
        if (userData) {
          // Update existing user metadata with their correct full_name (Name | Role)
          await targetSupabase.auth.admin.updateUserById(userData.id, {
            user_metadata: { 
              full_name: profile.full_name,
              name: name,
              role: role
            }
          });
        } else {
          // Create new user with verified email and correct metadata in target Supabase Auth
          await targetSupabase.auth.admin.createUser({
            email: user.email,
            email_confirm: true,
            user_metadata: { 
              full_name: profile.full_name,
              name: name,
              role: role
            }
          });
        }

        // Also synchronize target database "profiles" table if it exists
        await targetSupabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email,
            full_name: profile.full_name,
            cargo: role,
            role: role,
            name: name,
            updated_at: new Date().toISOString()
          }, { onConflict: "email" })
          .then(async ({ error }) => {
            if (error) {
              // Try fallback upsert with fewer columns in case of schema difference
              await targetSupabase.from("profiles").upsert({
                id: user.id,
                email: user.email,
                full_name: profile.full_name
              }, { onConflict: "email" });
            }
          });
      } catch (syncErr: any) {
        console.error(`Erro ao sincronizar perfil para o app ${appId}:`, syncErr.message);
      }

      // Generate a magiclink login link for the user's verified email
      const { data: linkData, error: linkError } = await targetSupabase.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
        options: {
          redirectTo: config.defaultUrl,
          data: {
            full_name: profile.full_name
          }
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
