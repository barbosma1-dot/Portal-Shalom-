import { createClient } from "@supabase/supabase-js";
import { appConfigs, getUserEmailFromRequest, jsonResponse, handleOptions, isAdminEmail } from "../_shared";

export const onRequestOptions = handleOptions;

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Apenas administradores do Portal podem acessar o diretório de usuários." }, 403);
    }

    const consolidatedUsers: Record<string, {
      email: string;
      name: string;
      apps: Record<string, {
        participates: boolean;
        role: string;
      }>;
    }> = {};

    const errors: string[] = [];

    // Process all configured sub-apps in parallel
    await Promise.all(
      Object.entries(appConfigs).map(async ([appId, config]) => {
        const targetUrl = context.env[config.urlVar];
        const targetServiceKey = context.env[config.keyVar];

        if (!targetUrl || !targetServiceKey) {
          errors.push(`Chaves de ambiente não configuradas para o app '${appId}' no Portal.`);
          return;
        }

        try {
          const targetSupabase = createClient(targetUrl, targetServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });

          // 1. Try to list users from target app's Auth Admin API (guaranteed if Service Role is valid)
          let authUsers: any[] = [];
          try {
            const { data, error } = await targetSupabase.auth.admin.listUsers();
            if (error) {
              console.warn(`[Sub-App Auth Error] ${appId}:`, error.message);
            } else if (data && data.users) {
              authUsers = data.users;
            }
          } catch (e: any) {
            console.warn(`[Sub-App Auth Exception] ${appId}:`, e.message);
          }

          // 2. Also try to query public profiles or users table for custom metadata and roles
          let publicProfiles: any[] = [];
          try {
            const { data, error } = await targetSupabase.from("profiles").select("*");
            if (!error && data) {
              publicProfiles = data;
            } else {
              const { data: uData, error: uError } = await targetSupabase.from("users").select("*");
              if (!uError && uData) {
                publicProfiles = uData;
              }
            }
          } catch (e: any) {
            console.warn(`[Sub-App public schema fallback] ${appId}:`, e.message);
          }

          const profileMap = new Map<string, any>();
          publicProfiles.forEach(p => {
            const emailKey = (p.email || "").toLowerCase().trim();
            if (emailKey) {
              profileMap.set(emailKey, p);
            }
          });

          // Unique list of emails in this sub-app
          const appEmails = new Set<string>();
          authUsers.forEach(u => {
            if (u.email) appEmails.add(u.email.toLowerCase().trim());
          });
          publicProfiles.forEach(p => {
            if (p.email) appEmails.add(p.email.toLowerCase().trim());
          });

          // Add to consolidated record
          appEmails.forEach(email => {
            const authUser = authUsers.find(u => (u.email || "").toLowerCase().trim() === email);
            const pubProfile = profileMap.get(email);

            let name = "";
            if (pubProfile) {
              name = pubProfile.nome || pubProfile.name || pubProfile.full_name || pubProfile.nome_completo || "";
            }
            if (!name && authUser) {
              const meta = authUser.user_metadata || {};
              name = meta.nome || meta.name || meta.full_name || meta.nome_completo || "";
            }
            if (!name && authUser) {
              name = authUser.email.split("@")[0];
            }

            let role = "usuário comum";
            if (pubProfile) {
              role = pubProfile.role || pubProfile.permissao || pubProfile.perfil || pubProfile.tipo || "usuário comum";
            } else if (authUser) {
              const meta = authUser.user_metadata || {};
              role = meta.role || meta.permissao || meta.perfil || "usuário comum";
            }

            // Capitalize / Beautify roles
            if (role === "admin" || role === "administrator") role = "Administrador";
            else if (role === "coordinator" || role === "coordenador") role = "Coordenador";
            else if (role === "user" || role === "membro") role = "Membro";
            else role = role.charAt(0).toUpperCase() + role.slice(1);

            if (!consolidatedUsers[email]) {
              consolidatedUsers[email] = {
                email,
                name: name || email,
                apps: {}
              };
            } else if (name && consolidatedUsers[email].name === email) {
              consolidatedUsers[email].name = name;
            }

            consolidatedUsers[email].apps[appId] = {
              participates: true,
              role
            };
          });

        } catch (err: any) {
          console.error(`Erro ao carregar usuários de '${appId}':`, err);
          errors.push(`Não foi possível estabelecer contato com '${appId}': ${err.message || err}`);
        }
      })
    );

    const usersList = Object.values(consolidatedUsers);

    return jsonResponse({
      users: usersList,
      errors
    });
  } catch (err: any) {
    return jsonResponse({ error: "Erro interno ao processar diretório de usuários: " + err.message }, 500);
  }
};
