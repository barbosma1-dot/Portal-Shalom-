import { appConfigs, getUserEmailFromRequest, isUserAuthorizedForApp, jsonResponse, handleOptions } from "./_shared";

export const onRequestOptions = handleOptions;

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    
    const apps = await Promise.all(
      Object.entries(appConfigs).map(async ([id, config]) => {
        const url = context.env[config.urlVar];
        const key = context.env[config.keyVar];
        const isAuthorized = userEmail ? await isUserAuthorizedForApp(context.env, userEmail, id) : false;

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

    return jsonResponse({ apps, userEmail: userEmail || "" });
  } catch (err: any) {
    return jsonResponse({ error: "Erro ao listar status dos aplicativos: " + err.message }, 500);
  }
};
