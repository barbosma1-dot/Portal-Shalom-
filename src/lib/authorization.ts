// Central authorization mapping: controls which authenticated email can access which app.
//
// How to use:
// - Give an email access to ALL apps: use the string "all".
// - Give an email access to SPECIFIC apps only: use an array of app ids,
//   e.g. ["pashalom", "wopsh"]. App ids are the same ones used in `staticApps`
//   (App.tsx) and `appConfigs` (server.ts): pashalom, poshalom, gestopro,
//   evansh, adoracaoshalom, cifrash, wopsh.
//
// Any email NOT listed here has NO authorization to open any app.
export const AUTHORIZED_ACCESS: Record<string, "all" | string[]> = {
  "barbosma1@gmail.com": "all",
};

function normalizeEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

// Returns true if the given email is authorized to access the given app id.
export function isEmailAuthorizedForApp(email: string | undefined | null, appId: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const access = AUTHORIZED_ACCESS[normalized];
  if (!access) return false;

  if (access === "all") return true;
  return access.includes(appId);
}

// Returns true if the given email has authorization to access at least one app.
export function isEmailAuthorized(email: string | undefined | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return Boolean(AUTHORIZED_ACCESS[normalized]);
}
