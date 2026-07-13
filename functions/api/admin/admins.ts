import { getPortalClient, getUserEmailFromRequest, jsonResponse, handleOptions, isAdminEmail } from "../_shared";

export const onRequestOptions = handleOptions;

// GET: list all portal administrators
export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem listar administradores." }, 403);
    }

    const portalClient = getPortalClient(context.env);
    const { data, error } = await portalClient
      .from("portal_admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST116" || error.message.includes("does not exist")) {
        return jsonResponse({ admins: [] });
      }
      return jsonResponse({ error: "Erro ao buscar administradores: " + error.message }, 500);
    }

    return jsonResponse({ admins: data || [] });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};

// POST: add a new administrator
export const onRequestPost: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem adicionar administradores." }, 403);
    }

    let body: any;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const { email } = body;
    if (!email) {
      return jsonResponse({ error: "O e-mail do administrador é obrigatório." }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const portalClient = getPortalClient(context.env);
    const { data, error } = await portalClient
      .from("portal_admins")
      .insert([{ email: normalizedEmail, added_by: userEmail }])
      .select();

    if (error) {
      return jsonResponse({ error: "Erro ao adicionar administrador: " + error.message }, 500);
    }

    return jsonResponse({ success: true, admin: data?.[0] });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};

// DELETE: remove an administrator
export const onRequestDelete: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem remover administradores." }, 403);
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return jsonResponse({ error: "O ID do administrador é obrigatório." }, 400);
    }

    const portalClient = getPortalClient(context.env);

    // Fetch record to check self-deletion limit
    const { data: targetAdmin, error: findError } = await portalClient
      .from("portal_admins")
      .select("email")
      .eq("id", id)
      .single();

    if (findError) {
      return jsonResponse({ error: "Erro ao localizar administrador: " + findError.message }, 400);
    }
    if (!targetAdmin) {
      return jsonResponse({ error: "Administrador não encontrado." }, 404);
    }

    if (targetAdmin.email.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
      const { count, error: countError } = await portalClient
        .from("portal_admins")
        .select("id", { count: "exact", head: true });

      if (countError) {
        return jsonResponse({ error: "Erro ao contar administradores: " + countError.message }, 400);
      }
      if (count !== null && count <= 1) {
        return jsonResponse({ error: "Você não pode remover a si mesmo pois você é o único administrador restante do Portal." }, 400);
      }
    }

    const { error: deleteError } = await portalClient
      .from("portal_admins")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return jsonResponse({ error: "Erro ao remover administrador: " + deleteError.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};
