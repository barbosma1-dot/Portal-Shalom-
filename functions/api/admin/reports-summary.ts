import { createClient } from "@supabase/supabase-js";
import { appConfigs, getUserEmailFromRequest, jsonResponse, handleOptions, getPortalClient } from "../_shared";

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

// Beautiful simulated reports to use as fallbacks for offline or unconfigured apps
const mockSubReports: Record<string, any[]> = {
  evansh: [
    { mission_name: "Guarulhos Centro", contacts_count: 1420, engagement_rate: 22 },
    { mission_name: "Fortaleza Centro", contacts_count: 3100, engagement_rate: 18 },
    { mission_name: "São Paulo Centro", contacts_count: 2400, engagement_rate: 14 }
  ],
  wopsh: [
    { mission_name: "Guarulhos Centro", members_obra: 120, members_cal: 45, members_cv: 15 },
    { mission_name: "Fortaleza Centro", members_obra: 340, members_cal: 110, members_cv: 55 },
    { mission_name: "São Paulo Centro", members_obra: 210, members_cal: 85, members_cv: 30 }
  ],
  gestopro: [
    { branch_name: "Guarulhos Centro", sales_count: 85, revenue: 15800, costs: 8200 },
    { branch_name: "Fortaleza Centro", sales_count: 210, revenue: 45000, costs: 22000 },
    { branch_name: "São Paulo Centro", sales_count: 150, revenue: 32000, costs: 18500 }
  ],
  pashalom: [
    { mission_name: "Guarulhos Centro", actions_planned: 12, actions_done: 9, budget_planned: 5000, budget_actual: 4800 },
    { mission_name: "Fortaleza Centro", actions_planned: 25, actions_done: 22, budget_planned: 12000, budget_actual: 11500 },
    { mission_name: "São Paulo Centro", actions_planned: 18, actions_done: 12, budget_planned: 8500, budget_actual: 9100 }
  ],
  adoracaoshalom: [
    { mission_name: "Guarulhos Centro", participants_high: 45, participants_medium: 25, participants_low: 10, scale_occupancy_pct: 88 },
    { mission_name: "Fortaleza Centro", participants_high: 120, participants_medium: 60, participants_low: 25, scale_occupancy_pct: 94 },
    { mission_name: "São Paulo Centro", participants_high: 75, participants_medium: 40, participants_low: 15, scale_occupancy_pct: 82 }
  ],
  cifrash: [
    { mission_name: "Guarulhos Centro", total_repertoires: 35, total_cords: 140 },
    { mission_name: "Fortaleza Centro", total_repertoires: 72, total_cords: 285 },
    { mission_name: "São Paulo Centro", total_repertoires: 48, total_cords: 190 }
  ],
  poshalom: [
    { mission_name: "Guarulhos Centro", financial_result_pct: 18, event_name: "Acampamento de Jovens" },
    { mission_name: "Fortaleza Centro", financial_result_pct: 8, event_name: "Renascer" },
    { mission_name: "São Paulo Centro", financial_result_pct: -12, event_name: "Seminário de Vida no Espírito" }
  ]
};

export const onRequestGet: PagesFunction<any> = async (context) => {
  try {
    const userEmail = await getUserEmailFromRequest(context.env, context.request);
    if (!userEmail || userEmail.toLowerCase().trim() !== "barbosma1@gmail.com") {
      return jsonResponse({ error: "Acesso negado. Área exclusiva do administrador." }, 403);
    }

    const authHeader = context.request.headers.get("authorization") || "";

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
      console.warn("Dificuldades ao carregar Portal Database, usando simulador canônico:", e);
      hasDatabase = false;
    }

    // Fallback static mission registry if db has no records
    if (missions.length === 0) {
      missions = [
        { id: "m1", canonical_name: "Guarulhos Centro" },
        { id: "m2", canonical_name: "Fortaleza Centro" },
        { id: "m3", canonical_name: "São Paulo Centro" }
      ];
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
    const fetchedReports: Record<string, { data: any[]; isSimulated: boolean }> = {};
    const appWarnings: string[] = [];

    await Promise.all(
      activeApps.map(async (appId) => {
        const config = appConfigs[appId];
        if (!config) return;

        try {
          // If env has target url and key, attempt real API fetch, else fallback to mock
          const targetUrl = context.env[config.urlVar];
          const appKey = context.env[config.keyVar];
          
          if (targetUrl && appKey) {
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
          }
        } catch (e: any) {
          console.warn(`Erro ao conectar com API do app ${appId}, usando dados simulados:`, e.message);
        }

        // Fallback simulation
        fetchedReports[appId] = {
          data: mockSubReports[appId] || [],
          isSimulated: true
        };
        appWarnings.push(appId);
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
        value: number;
        classification: string;
        financialScore: number;
        engagementScore: number;
        npsScore: number;
        npsValue: number;
        npsLabel: string;
        eventName: string;
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
    fetchedReports.evansh.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("evansh", item.mission_name);
      const group = getGroup(canonicalName, isMapped);
      group.evansh = {
        contactsCount: item.contacts_count,
        engagementRate: item.engagement_rate,
        isSimulated: fetchedReports.evansh.isSimulated
      };
    });

    // B. Wopsh
    fetchedReports.wopsh.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("wopsh", item.mission_name);
      const group = getGroup(canonicalName, isMapped);
      group.wopsh = {
        obra: item.members_obra,
        cal: item.members_cal,
        cv: item.members_cv,
        isSimulated: fetchedReports.wopsh.isSimulated
      };
    });

    // C. Gestão Pro
    fetchedReports.gestopro.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("gestopro", item.branch_name);
      const group = getGroup(canonicalName, isMapped);
      group.gestopro = {
        salesCount: item.sales_count,
        revenue: item.revenue,
        costs: item.costs,
        isSimulated: fetchedReports.gestopro.isSimulated
      };
    });

    // D. PA Shalom
    fetchedReports.pashalom.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("pashalom", item.mission_name);
      const group = getGroup(canonicalName, isMapped);
      group.pashalom = {
        actionsPlanned: item.actions_planned,
        actionsDone: item.actions_done,
        budgetPlanned: item.budget_planned,
        budgetActual: item.budget_actual,
        isSimulated: fetchedReports.pashalom.isSimulated
      };
    });

    // E. Adoração Shalom
    fetchedReports.adoracaoshalom.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("adoracaoshalom", item.mission_name);
      const group = getGroup(canonicalName, isMapped);
      group.adoracaoshalom = {
        high: item.participants_high,
        medium: item.participants_medium,
        low: item.participants_low,
        occupancy: item.scale_occupancy_pct,
        isSimulated: fetchedReports.adoracaoshalom.isSimulated
      };
    });

    // F. Cifras Shalom
    fetchedReports.cifrash.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("cifrash", item.mission_name);
      const group = getGroup(canonicalName, isMapped);
      group.cifrash = {
        totalRepertoires: item.total_repertoires,
        totalCords: item.total_cords,
        isSimulated: fetchedReports.cifrash.isSimulated
      };
    });

    // G. PO Shalom
    fetchedReports.poshalom.data.forEach(item => {
      const { canonicalName, isMapped } = resolveMission("poshalom", item.mission_name);
      const group = getGroup(canonicalName, isMapped);
      group.poshalom = {
        financialResultPct: item.financial_result_pct,
        eventName: item.event_name,
        isSimulated: fetchedReports.poshalom.isSimulated
      };
    });

    // 4. Calculate IIEE (Strategic Event Impact Index) for each mission registry entry
    missions.forEach(mission => {
      const name = mission.canonical_name;
      const group = groupedReports[name];
      if (!group) return;

      const hasFinance = group.poshalom !== undefined;
      const hasEngagement = group.evansh !== undefined;

      // Find local NPS event for this mission
      const npsRecord = eventNps.find(n => n.mission_registry_id === mission.id);
      
      // Default NPS metrics if none found in db
      let pPct = 65;
      let dPct = 15;
      let customEventName = "Evento Geral";

      if (npsRecord) {
        pPct = npsRecord.promoters_pct;
        dPct = npsRecord.detractors_pct;
        customEventName = npsRecord.event_name;
      } else {
        // Fallback simulated NPS parameters based on mission name
        if (name === "Guarulhos Centro") { pPct = 78; dPct = 8; customEventName = "Acampamento de Jovens"; }
        if (name === "Fortaleza Centro") { pPct = 84; dPct = 4; customEventName = "Renascer"; }
        if (name === "São Paulo Centro") { pPct = 52; dPct = 28; customEventName = "Seminário de Vida no Espírito"; }
      }

      const npsValue = pPct - dPct;
      const { score: npsScore, label: npsLabel } = getNpsScoreAndClass(npsValue);

      // Calculations
      const financialResultPct = hasFinance ? group.poshalom!.financialResultPct : 0;
      const financialScore = getFinancialScore(financialResultPct);

      const engagementRate = hasEngagement ? group.evansh!.engagementRate : 0;
      const engagementScore = getEngagementScore(engagementRate);

      // IIEE Formula
      const iieeValue = Math.round((financialScore * 0.35) + (engagementScore * 0.45) + (npsScore * 0.20));
      const classification = getIieeClassification(iieeValue);

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

    return jsonResponse({
      reports: reportsList,
      warnings: appWarnings,
      hasDatabase
    });
  } catch (err: any) {
    return jsonResponse({ error: "Erro ao consolidar relatórios das missões: " + err.message }, 500);
  }
};
