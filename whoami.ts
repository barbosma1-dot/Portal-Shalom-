import { getUserEmailFromRequest, jsonResponse, handleOptions, isAdminEmail } from "../_shared";

export const onRequestOptions = handleOptions;

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail) {
      return jsonResponse({ isAdmin: false, email: null });
    }
    const isAd = await isAdminEmail(context.env, userEmail);
    return jsonResponse({ isAdmin: isAd, email: userEmail });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno: " + err.message }, 500);
  }
};
