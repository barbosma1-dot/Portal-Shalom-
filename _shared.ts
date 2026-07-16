import { createClient } from "@supabase/supabase-js";

// Configuration mapping for target community apps
export const appConfigs: Record<string, { urlVar: string; keyVar: string; defaultUrl: string }> = {
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
  },
  benfeitor: {
    urlVar: "SUPABASE_URL_BENFEITOR",
    keyVar: "SUPABASE_SERVICE_KEY_BENFEITOR",
    // Ajuste esta URL para o domínio final publicado do CRM Benfeitor da Paz, caso seja diferente.
    defaultUrl: "https://benfeitor-da-paz.pages.dev"
  }
};

// Hardcoded fallback list for app authorizations (used when table doesn't exist or during migration)
export const fallbackAuthorizations: Record<string, string[]> = {
  pashalom: ["barbosma1@gmail.com"],
  poshalom: ["barbosma1@gmail.com"],
  gestopro: ["barbosma1@gmail.com"],
  evansh: ["barbosma1@gmail.com"],
  adoracaoshalom: ["barbosma1@gmail.com"],
  cifrash: ["barbosma1@gmail.com"],
  wopsh: ["barbosma1@gmail.com"],
  benfeitor: ["barbosma1@gmail.com"]
};

// Helper to get the main Portal Supabase Client
export function getPortalClient(env: any) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Configurações do Supabase do Portal (VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY) ausentes no ambiente.");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Helper to verify user JWT token and extract email
export async function verifyUserToken(env: any, token: string): Promise<string | null> {
  try {
    const portalClient = getPortalClient(env);
    const { data: { user }, error } = await portalClient.auth.getUser(token);
    if (error || !user) return null;
    return user.email || null;
  } catch (err) {
    console.error("Erro ao verificar token do usuário:", err);
    return null;
  }
}

// Helper to extract verified email from standard Request headers (Authorization or X-Mock-Email for simulation)
export async function getUserEmailFromRequest(env: any, request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return await verifyUserToken(env, token);
  }
  
  const xMockEmail = request.headers.get("x-mock-email");
  if (xMockEmail === "visitante.shalom@comunidadeshalom.org.br") {
    return xMockEmail;
  }
  
  return null;
}

// Helper to verify if an email is authorized for a specific app
export async function isUserAuthorizedForApp(env: any, email: string, appId: string): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  
  // barbosma1@gmail.com is the universal admin
  if (normalizedEmail === "barbosma1@gmail.com") {
    return true;
  }
  
  // Visitor / Demo simulation email gets demo access to specific apps
  if (normalizedEmail === "visitante.shalom@comunidadeshalom.org.br") {
    return ["adoracaoshalom", "cifrash"].includes(appId);
  }
  
  try {
    const portalClient = getPortalClient(env);
    const { data, error } = await portalClient
      .from("app_authorizations")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("app_id", appId);
      
    if (error) {
      console.warn(`[Supabase Fallback] Erro ao ler tabela app_authorizations, usando lista offline. Detalhe:`, error.message);
      // Fallback to hardcoded list if database table is not created yet
      const fallbackList = fallbackAuthorizations[appId] || [];
      return fallbackList.map(e => e.toLowerCase().trim()).includes(normalizedEmail);
    }
    
    return data && data.length > 0;
  } catch (err) {
    console.error("Erro ao verificar autorização:", err);
    const fallbackList = fallbackAuthorizations[appId] || [];
    return fallbackList.map(e => e.toLowerCase().trim()).includes(normalizedEmail);
  }
}

// Helper to verify if an email is an administrator of the Portal
export async function isAdminEmail(env: any, email: string): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  
  if (normalizedEmail === "visitante.shalom@comunidadeshalom.org.br") {
    return false;
  }
  
  try {
    const portalClient = getPortalClient(env);
    const { data, error } = await portalClient
      .from("portal_admins")
      .select("id")
      .eq("email", normalizedEmail);
      
    if (error) {
      console.warn(`[Supabase Fallback] Erro ao ler tabela portal_admins:`, error.message);
      return normalizedEmail === "barbosma1@gmail.com";
    }
    
    return data && data.length > 0;
  } catch (err) {
    console.error("Erro ao verificar admin:", err);
    return normalizedEmail === "barbosma1@gmail.com";
  }
}

// JSON Helper Response for Pages Functions
export function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mock-email",
      ...headers
    }
  });
}

// Standard options preflight handler
export const handleOptions = () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mock-email"
    }
  });
};
