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

// Access Control List (ACL): Authorized emails for each app
const appAuthorizations: Record<string, string[]> = {
  pashalom: ["barbosma1@gmail.com"],
  poshalom: ["barbosma1@gmail.com"],
  gestopro: ["barbosma1@gmail.com"],
  evansh: ["barbosma1@gmail.com"],
  adoracaoshalom: ["barbosma1@gmail.com"],
  cifrash: ["barbosma1@gmail.com"],
  wopsh: ["barbosma1@gmail.com"]
};

// Helper function to check if an email is authorized for a specific app
function isUserAuthorizedForApp(email: string, appId: string): boolean {
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
  
  const authorizedList = appAuthorizations[appId] || [];
  return authorizedList.map(e => e.toLowerCase().trim()).includes(normalizedEmail);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Route: Get the configuration status of all community apps with authorization check
  app.get("/api/apps-status", async (req, res) => {
    try {
      let userEmail = "";
      
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
              userEmail = user.email;
            }
          } catch (e) {
            console.error("Erro ao verificar token em apps-status:", e);
          }
        }
      } else if (xMockEmail && typeof xMockEmail === "string") {
        userEmail = xMockEmail;
      }

      const status = Object.entries(appConfigs).map(([id, config]) => {
        const url = process.env[config.urlVar];
        const key = process.env[config.keyVar];
        const isAuthorized = userEmail ? isUserAuthorizedForApp(userEmail, id) : false;

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
      });
      res.json({ apps: status, userEmail });
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
      if (!isUserAuthorizedForApp(user.email, appId)) {
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
