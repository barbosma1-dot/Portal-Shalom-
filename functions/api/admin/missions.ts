import { getPortalClient, getUserEmailFromRequest, jsonResponse, handleOptions } from "../_shared";

export const onRequestOptions = handleOptions;

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || userEmail.toLowerCase().trim() !== "barbosma1@gmail.com") {
      return jsonResponse({ error: "Acesso negado. Área exclusiva do administrador." }, 403);
    }

    const portalClient = getPortalClient(context.env);

    // Fetch all mission registry entries
    const { data: missions, error: mError } = await portalClient
      .from("mission_registry")
      .select("*")
      .order("canonical_name", { ascending: true });

    if (mError) {
      if (mError.code === "PGRST116" || mError.message.includes("does not exist")) {
        return jsonResponse({ 
          missions: [], 
          mappings: [],
          warning: "As tabelas de registro de missão não existem ainda. Execute o script SQL no Supabase para criá-las."
        });
      }
      return jsonResponse({ error: "Erro ao buscar missões canônicas: " + mError.message }, 500);
    }

    // Fetch all mappings
    const { data: mappings, error: mapError } = await portalClient
      .from("mission_app_mapping")
      .select("*");

    if (mapError) {
      return jsonResponse({ error: "Erro ao buscar mapeamentos: " + mapError.message }, 500);
    }

    return jsonResponse({ missions: missions || [], mappings: mappings || [] });
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

    const { action, canonicalName, missionRegistryId, appId, remoteMissionName, mappingId } = body;
    const portalClient = getPortalClient(context.env);

    if (action === "create_mission") {
      if (!canonicalName) return jsonResponse({ error: "Nome canônico é obrigatório." }, 400);
      const { data, error } = await portalClient
        .from("mission_registry")
        .insert([{ canonical_name: canonicalName }])
        .select();
      if (error) return jsonResponse({ error: "Erro ao criar missão: " + error.message }, 400);
      return jsonResponse({ success: true, mission: data?.[0] });
    }

    if (action === "delete_mission") {
      if (!missionRegistryId) return jsonResponse({ error: "ID da missão canônica é obrigatório." }, 400);
      const { error } = await portalClient
        .from("mission_registry")
        .delete()
        .eq("id", missionRegistryId);
      if (error) return jsonResponse({ error: "Erro ao excluir missão canônica: " + error.message }, 400);
      return jsonResponse({ success: true });
    }

    if (action === "create_mapping") {
      if (!missionRegistryId || !appId || !remoteMissionName) {
        return jsonResponse({ error: "Todos os campos de mapeamento são obrigatórios." }, 400);
      }
      const { data, error } = await portalClient
        .from("mission_app_mapping")
        .insert([{
          mission_registry_id: missionRegistryId,
          app_id: appId,
          remote_mission_name: remoteMissionName
        }])
        .select();
      if (error) return jsonResponse({ error: "Erro ao criar mapeamento: " + error.message }, 400);
      return jsonResponse({ success: true, mapping: data?.[0] });
    }

    if (action === "delete_mapping") {
      if (!mappingId) return jsonResponse({ error: "ID do mapeamento é obrigatório." }, 400);
      const { error } = await portalClient
        .from("mission_app_mapping")
        .delete()
        .eq("id", mappingId);
      if (error) return jsonResponse({ error: "Erro ao excluir mapeamento: " + error.message }, 400);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Ação de missão desconhecida." }, 400);
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};
