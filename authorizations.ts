import { getPortalClient, getUserEmailFromRequest, jsonResponse, handleOptions, isAdminEmail } from "../_shared";

export const onRequestOptions = handleOptions;

// GET: list all app authorizations
export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem gerenciar autorizações." }, 403);
    }

    const portalClient = getPortalClient(context.env);
    const { data, error } = await portalClient
      .from("app_authorizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // If table doesn't exist yet, return a structured warning to guide user to create it
      if (error.code === "PGRST116" || error.message.includes("does not exist")) {
        return jsonResponse({ 
          authorizations: [], 
          warning: "A tabela app_authorizations não existe ainda no Supabase. Execute o script SQL no editor do Supabase para criá-la."
        });
      }
      return jsonResponse({ error: "Erro ao buscar autorizações: " + error.message }, 500);
    }

    return jsonResponse({ authorizations: data || [] });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};

// POST: create a new authorization
export const onRequestPost: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem gerenciar autorizações." }, 403);
    }

    let body: any;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const { email, appId } = body;
    if (!email || !appId) {
      return jsonResponse({ error: "E-mail e ID do aplicativo são obrigatórios." }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const portalClient = getPortalClient(context.env);
    const { data, error } = await portalClient
      .from("app_authorizations")
      .insert([{ email: normalizedEmail, app_id: appId }])
      .select();

    if (error) {
      return jsonResponse({ error: "Erro ao criar autorização: " + error.message }, 500);
    }

    return jsonResponse({ success: true, authorization: data?.[0] });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};

// DELETE: remove an authorization
export const onRequestDelete: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem gerenciar autorizações." }, 403);
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return jsonResponse({ error: "O ID da autorização é obrigatório." }, 400);
    }

    const portalClient = getPortalClient(context.env);
    const { error } = await portalClient
      .from("app_authorizations")
      .delete()
      .eq("id", id);

    if (error) {
      return jsonResponse({ error: "Erro ao remover autorização: " + error.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};
