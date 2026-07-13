import { getPortalClient, getUserEmailFromRequest, jsonResponse, handleOptions } from "../_shared";

export const onRequestOptions = handleOptions;

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || userEmail.toLowerCase().trim() !== "barbosma1@gmail.com") {
      return jsonResponse({ error: "Acesso negado. Área exclusiva do administrador." }, 403);
    }

    const portalClient = getPortalClient(context.env);

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
        return jsonResponse({ 
          events: [], 
          warning: "A tabela event_nps não existe ainda. Execute o script SQL no Supabase para criá-la."
        });
      }
      return jsonResponse({ error: "Erro ao buscar NPS dos eventos: " + error.message }, 500);
    }

    return jsonResponse({ events: data || [] });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};

export const onRequestPost: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || userEmail.toLowerCase().trim() !== "barbosma1@gmail.com") {
      return jsonResponse({ error: "Acesso negado. Área exclusiva do administrador." }, 403);
    }

    let body: any;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const { missionRegistryId, eventName, promotersPct, detractorsPct, id } = body;
    if (!missionRegistryId || !eventName || promotersPct === undefined || detractorsPct === undefined) {
      return jsonResponse({ error: "Todos os campos (missão, nome do evento, % promotores e % detratores) são obrigatórios." }, 400);
    }

    const portalClient = getPortalClient(context.env);

    let result;
    if (id) {
      // Update
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

      if (error) return jsonResponse({ error: "Erro ao atualizar NPS: " + error.message }, 400);
      result = data?.[0];
    } else {
      // Insert
      const { data, error } = await portalClient
        .from("event_nps")
        .insert([{
          mission_registry_id: missionRegistryId,
          event_name: eventName,
          promoters_pct: Number(promotersPct),
          detractors_pct: Number(detractorsPct)
        }])
        .select();

      if (error) return jsonResponse({ error: "Erro ao criar NPS: " + error.message }, 400);
      result = data?.[0];
    }

    return jsonResponse({ success: true, eventNps: result });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};

export const onRequestDelete: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || userEmail.toLowerCase().trim() !== "barbosma1@gmail.com") {
      return jsonResponse({ error: "Acesso negado. Área exclusiva do administrador." }, 403);
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return jsonResponse({ error: "O ID do NPS é obrigatório." }, 400);
    }

    const portalClient = getPortalClient(context.env);
    const { error } = await portalClient
      .from("event_nps")
      .delete()
      .eq("id", id);

    if (error) {
      return jsonResponse({ error: "Erro ao excluir NPS: " + error.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};
