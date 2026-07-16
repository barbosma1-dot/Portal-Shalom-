import { createClient } from "@supabase/supabase-js";
import { appConfigs, getUserEmailFromRequest, jsonResponse, handleOptions, getPortalClient, isAdminEmail } from "../_shared";

export const onRequestOptions = handleOptions;

// Helper score calculators for IIEE
function getFinancialScore(pct: number): number {
  if (pct > 15) return 100;
  if (pct >= 5) return 85;
  if (pct > 0) return 75; // Intermediate surplus
  if (pct === 0) return 70;
  if (pct >= -5) return 50;
  if (pct >= -15) return 30;
  return 10;
}

function getEngagementScore(rate: number): number {
  if (rate > 20) return 100;
  if (rate >= 15) return 85;
  if (rate >= 10) return 70;
  if (rate >= 5) return 50;
  return 20;
}

function getNpsScoreAndClass(nps: number): { score: number; label: string } {
  if (nps > 75) return { score: 100, label: "Excelente" };
  if (nps >= 50) return { score: 85, label: "Muito bom" };
  if (nps >= 0) return { score: 50, label: "Precisa melhorar" };
  return { score: 20, label: "Ruim" };
}

function getIieeClassification(iiee: number): string {
  if (iiee >= 90) return "Grande potencial evangelizador";
  if (iiee >= 75) return "Forte";
  if (iiee >= 60) return "Mediano";
  if (iiee >= 40) return "Frágil";
  return "Crítico";
}

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || !(await isAdminEmail(context.env, userEmail))) {
      return jsonResponse({ error: "Acesso negado. Área exclusiva do administrador." }, 403);
    }

    // 1. Fetch Portal database configurations (canonical missions, mappings, manual NPS)
    let missions: any[] = [];
    let mappings: any[] = [];
    let eventNps: any[] = [];
    let hasDatabase = true;

    try {
      const portalClient = getPortalClient(context.env);

      const [mRes, mapRes, npsRes] = await Promise.all([
        portalClient.from("mission_registry").select("*"),
        portalClient.from("mission_app_mapping").select("*"),
        portalClient.from("event_nps").select("*")
      ]);

      if (!mRes.error && mRes.data) missions = mRes.data;
      if (!mapRes.error && mapRes.data) mappings = mapRes.data;
      if (!npsRes.error && npsRes.data) eventNps = npsRes.data;

      if (mRes.error && mRes.error.message.includes("does not exist")) {
        hasDatabase = false;
      }
    } catch (e) {
      console.warn("Dificuldades ao carregar Portal Database:", e);
      hasDatabase = false;
    }

    // Build mapping dictionary: "appId:cleanRemoteName" -> canonical_name
    const mappingDict = new Map<string, string>();
    mappings.forEach(map => {
      const canonicalObj = missions.find(m => m.id === map.mission_registry_id);
      if (canonicalObj) {
        mappingDict.set(`${map.app_id}:${map.remote_mission_name.toLowerCase().trim()}`, canonicalObj.canonical_name);
      }
    });

    // Helper to resolve remote mission name to canonical name
    const resolveMission = (appId: string, remoteName: string): { canonicalName: string; isMapped: boolean } => {
      if (!remoteName) return { canonicalName: "Não Informado", isMapped: false };
      const key = `${appId}:${remoteName.toLowerCase().trim()}`;
      
      // Exact match check
      if (mappingDict.has(key)) {
        return { canonicalName: mappingDict.get(key)!, isMapped: true };
      }
      
      // Smart search check: if remote name matches any canonical name directly (case insensitive)
      const directMatch = missions.find(m => m.canonical_name.toLowerCase().trim() === remoteName.toLowerCase().trim());
      if (directMatch) {
        return { canonicalName: directMatch.canonical_name, isMapped: true };
      }

      return { canonicalName: remoteName, isMapped: false };
    };

    // 2. Fetch raw sub-reports from all 7 community apps in parallel
    const activeApps = ["evansh", "wopsh", "gestopro", "pashalom", "adoracaoshalom", "cifrash", "poshalom"];
    const fetchedReports: Record<string, { data: any[]; isSimulated: boolean; unavailable?: boolean; reason?: string }> = {};
    const appWarnings: string[] = [];

    await Promise.all(
      activeApps.map(async (appId) => {
        const config = appConfigs[appId];
        if (!config) return;

        const targetUrl = context.env[config.urlVar];
        const appKey = context.env[config.keyVar];

        if (!targetUrl || !appKey) {
          fetchedReports[appId] = {
            data: [],
            isSimulated: false,
            unavailable: true,
            reason: `Chaves de acesso (${config.urlVar} / ${config.keyVar}) não configuradas no ambiente.`
          };
          appWarnings.push(appId);
          return;
        }

        try {
          const apiEndpoint = `${config.defaultUrl}/api/reports/summary`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

          const res = await fetch(apiEndpoint, {
            headers: {
              "Authorization": `Bearer ${appKey}`,
              "Content-Type": "application/json"
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const result: any = await res.json();
            if (result && (result.missionData || result.branchData)) {
              fetchedReports[appId] = {
                data: result.missionData || result.branchData,
                isSimulated: false
              };
              return;
            }
          }
          
          throw new Error(`Código HTTP de erro: ${res.status}`);
        } catch (e: any) {
          console.warn(`Erro ao conectar com API do app ${appId}:`, e.message);
          fetchedReports[appId] = {
            data: [],
            isSimulated: false,
            unavailable: true,
            reason: `Erro na conexão com o sub-aplicativo: ${e.message || "Timeout de conexão"}`
          };
          appWarnings.push(appId);
        }
      })
    );

    // 3. Process and group data by canonical name
    const groupedReports: Record<string, {
      canonicalName: string;
      isMapped: boolean;
      evansh?: { contactsCount: number; engagementRate: number; isSimulated: boolean };
      wopsh?: { obra: number; cal: number; cv: number; isSimulated: boolean };
      gestopro?: { salesCount: number; revenue: number; costs: number; isSimulated: boolean };
      pashalom?: { actionsPlanned: number; actionsDone: number; budgetPlanned: number; budgetActual: number; isSimulated: boolean };
      adoracaoshalom?: { high: number; medium: number; low: number; occupancy: number; isSimulated: boolean };
      cifrash?: { totalRepertoires: number; totalCords: number; isSimulated: boolean };
      poshalom?: { financialResultPct: number; eventName: string; isSimulated: boolean };
      iiee?: {
        value: number | null;
        classification: string;
        financialScore: number | null;
        engagementScore: number | null;
        npsScore: number | null;
        npsValue: number | null;
        npsLabel: string;
        eventName: string | null;
      };
    }> = {};

    // Grouping routine
    const getGroup = (canonicalName: string, isMapped: boolean) => {
      if (!groupedReports[canonicalName]) {
        groupedReports[canonicalName] = {
          canonicalName,
          isMapped
        };
      }
      return groupedReports[canonicalName];
    };

    // A. Evansh
    if (fetchedReports.evansh && !fetchedReports.evansh.unavailable) {
      fetchedReports.evansh.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("evansh", item.mission_name);
        const group = getGroup(canonicalName, isMapped);
        group.evansh = {
          contactsCount: item.contacts_count,
          engagementRate: item.engagement_rate,
          isSimulated: false
        };
      });
    }

    // B. Wopsh
    if (fetchedReports.wopsh && !fetchedReports.wopsh.unavailable) {
      fetchedReports.wopsh.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("wopsh", item.mission_name);
        const group = getGroup(canonicalName, isMapped);
        group.wopsh = {
          obra: item.members_obra,
          cal: item.members_cal,
          cv: item.members_cv,
          isSimulated: false
        };
      });
    }

    // C. Gestão Pro
    if (fetchedReports.gestopro && !fetchedReports.gestopro.unavailable) {
      fetchedReports.gestopro.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("gestopro", item.branch_name);
        const group = getGroup(canonicalName, isMapped);
        group.gestopro = {
          salesCount: item.sales_count,
          revenue: item.revenue,
          costs: item.costs,
          isSimulated: false
        };
      });
    }

    // D. PA Shalom
    if (fetchedReports.pashalom && !fetchedReports.pashalom.unavailable) {
      fetchedReports.pashalom.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("pashalom", item.mission_name);
        const group = getGroup(canonicalName, isMapped);
        group.pashalom = {
          actionsPlanned: item.actions_planned,
          actionsDone: item.actions_done,
          budgetPlanned: item.budget_planned,
          budgetActual: item.budget_actual,
          isSimulated: false
        };
      });
    }

    // E. Adoração Shalom
    if (fetchedReports.adoracaoshalom && !fetchedReports.adoracaoshalom.unavailable) {
      fetchedReports.adoracaoshalom.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("adoracaoshalom", item.mission_name);
        const group = getGroup(canonicalName, isMapped);
        group.adoracaoshalom = {
          high: item.participants_high,
          medium: item.participants_medium,
          low: item.participants_low,
          occupancy: item.scale_occupancy_pct,
          isSimulated: false
        };
      });
    }

    // F. Cifras Shalom
    if (fetchedReports.cifrash && !fetchedReports.cifrash.unavailable) {
      fetchedReports.cifrash.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("cifrash", item.mission_name);
        const group = getGroup(canonicalName, isMapped);
        group.cifrash = {
          totalRepertoires: item.total_repertoires,
          totalCords: item.total_cords,
          isSimulated: false
        };
      });
    }

    // G. PO Shalom
    if (fetchedReports.poshalom && !fetchedReports.poshalom.unavailable) {
      fetchedReports.poshalom.data.forEach(item => {
        const { canonicalName, isMapped } = resolveMission("poshalom", item.mission_name);
        const group = getGroup(canonicalName, isMapped);
        group.poshalom = {
          financialResultPct: item.financial_result_pct,
          eventName: item.event_name,
          isSimulated: false
        };
      });
    }

    // 4. Calculate IIEE (Strategic Event Impact Index) for each mission registry entry
    missions.forEach(mission => {
      const name = mission.canonical_name;
      const group = groupedReports[name];
      if (!group) return;

      const hasFinance = group.poshalom !== undefined;
      const hasEngagement = group.evansh !== undefined;

      // Find local NPS event for this mission
      const npsRecord = eventNps.find(n => n.mission_registry_id === mission.id);
      
      let pPct = 0;
      let dPct = 0;
      let customEventName: string | null = null;
      let npsValue: number | null = null;
      let npsScore: number | null = null;
      let npsLabel = "Sem dados";

      if (npsRecord) {
        pPct = npsRecord.promoters_pct;
        dPct = npsRecord.detractors_pct;
        customEventName = npsRecord.event_name;
        npsValue = pPct - dPct;
        const rating = getNpsScoreAndClass(npsValue);
        npsScore = rating.score;
        npsLabel = rating.label;
      }

      // Calculations
      const financialResultPct = hasFinance ? group.poshalom!.financialResultPct : null;
      const financialScore = financialResultPct !== null ? getFinancialScore(financialResultPct) : null;

      const engagementRate = hasEngagement ? group.evansh!.engagementRate : null;
      const engagementScore = engagementRate !== null ? getEngagementScore(engagementRate) : null;

      // IIEE Formula weights:
      // Finance: 0.35, Engagement: 0.45, NPS: 0.20
      // Recalculated if NPS is missing: Finance: 45%, Engagement: 55%
      let iieeValue: number | null = null;
      let classification = "Sem dados";

      let totalWeight = 0;
      let weightedSum = 0;

      if (financialScore !== null) {
        const w = npsScore !== null ? 0.35 : 0.45;
        totalWeight += w;
        weightedSum += financialScore * w;
      }
      if (engagementScore !== null) {
        const w = npsScore !== null ? 0.45 : 0.55;
        totalWeight += w;
        weightedSum += engagementScore * w;
      }
      if (npsScore !== null) {
        const w = 0.20;
        totalWeight += w;
        weightedSum += npsScore * w;
      }

      if (totalWeight > 0) {
        iieeValue = Math.round(weightedSum / totalWeight);
        classification = getIieeClassification(iieeValue);
      }

      group.iiee = {
        value: iieeValue,
        classification,
        financialScore,
        engagementScore,
        npsScore,
        npsValue,
        npsLabel,
        eventName: group.poshalom?.eventName || customEventName
      };
    });

    // Assemble final output list
    const reportsList = Object.values(groupedReports);

    // Formulate appAvailability status payload
    const appAvailability: Record<string, { unavailable: boolean; reason?: string }> = {};
    activeApps.forEach(appId => {
      appAvailability[appId] = {
        unavailable: fetchedReports[appId]?.unavailable || false,
        reason: fetchedReports[appId]?.reason
      };
    });

    return jsonResponse({
      reports: reportsList,
      warnings: appWarnings,
      hasDatabase,
      appAvailability
    });
  } catch (err: any) {
    return jsonResponse({ error: "Erro ao consolidar relatórios das missões: " + err.message }, 500);
  }
};
