import { createClient } from "@supabase/supabase-js";
import { appConfigs, isUserAuthorizedForApp, jsonResponse, handleOptions } from "../_shared";

export const onRequestOptions = handleOptions;

export const onRequestPost: PagesFunction<any> = async (context) => {
  try {
    const authHeader = context.request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Sessão inválida ou não fornecida. Por favor, faça login novamente." }, 401);
    }
    const token = authHeader.split(" ")[1];

    let body: any;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const { appId } = body;
    if (!appId) {
      return jsonResponse({ error: "O ID do aplicativo é obrigatório." }, 400);
    }

    const config = appConfigs[appId];
    if (!config) {
      return jsonResponse({ error: "Aplicativo não encontrado." }, 404);
    }

    const targetUrl = context.env[config.urlVar];
    const targetServiceKey = context.env[config.keyVar];

    if (!targetUrl || !targetServiceKey) {
      return jsonResponse({ error: `Este aplicativo (${appId}) ainda não está conectado no Portal Shalom.` }, 400);
    }

    const portalUrl = context.env.VITE_SUPABASE_URL;
    const portalAnonKey = context.env.VITE_SUPABASE_ANON_KEY;

    if (!portalUrl || !portalAnonKey) {
      return jsonResponse({ error: "O Portal Shalom não está totalmente configurado. Chaves do Portal ausentes no servidor." }, 500);
    }

    // Verify user JWT token with Portal Supabase
    const portalClient = createClient(portalUrl, portalAnonKey);
    const { data: { user }, error: authError } = await portalClient.auth.getUser(token);

    if (authError || !user || !user.email) {
      return jsonResponse({ error: "Usuário não autenticado ou sessão expirada no Portal Shalom." }, 401);
    }

    // Strict Authorization Check
    const isAuthorized = await isUserAuthorizedForApp(context.env, user.email, appId);
    if (!isAuthorized) {
      return jsonResponse({ 
        error: `Acesso negado. O e-mail '${user.email}' não possui autorização de acesso para este aplicativo. Entre em contato com o administrador barbosma1@gmail.com para solicitar acesso.` 
      }, 403);
    }

    // Initialize Target App's Supabase with its Service Role Key
    const targetSupabase = createClient(targetUrl, targetServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Generate magiclink login link for the user's verified email
    const { data: linkData, error: linkError } = await targetSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: {
        redirectTo: config.defaultUrl
      }
    });

    if (linkError || !linkData) {
      console.error(`Erro ao gerar link para ${appId}:`, linkError);
      return jsonResponse({ error: `Não foi possível gerar acesso ao aplicativo: ${linkError?.message || "Erro desconhecido"}` }, 500);
    }

    const actionLink = linkData.properties?.action_link || (linkData as any).action_link;
    if (!actionLink) {
      return jsonResponse({ error: "O link de login gerado é inválido." }, 500);
    }

    return jsonResponse({ actionLink });
  } catch (err: any) {
    console.error("Erro interno no SSO:", err);
    return jsonResponse({ error: `Erro interno no servidor: ${err.message}` }, 500);
  }
};
