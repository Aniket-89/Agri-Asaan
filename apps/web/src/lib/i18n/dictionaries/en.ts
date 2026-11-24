// English is the source dictionary: its shape defines every other locale.
// Placeholders use {name} and must appear identically in each translation.
// Add keys only as features need them.
export const en = {
  metadata: {
    description: "Drone spraying, crop monitoring, and farm service management.",
  },
  language: {
    label: "Language",
    en: "English",
    hi: "हिन्दी",
  },
  login: {
    title: "Sign in to {brand}",
    titleFallback: "Sign in",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    createAccount: "Create an account",
  },
  dashboard: {
    territoryLink: "Manage territory",
  },
  territory: {
    title: "Territory",
    intro: "Regions, villages, and who covers them.",
    backToDashboard: "Back to dashboard",
    saved: "Saved.",
    noRegions: "No regions yet.",
    addRegion: "Add region",
    regionName: "Region name",
    inactive: "Inactive",
    readOnly: "You can view this region but not change it.",
    regionalAdmins: "Regional admins",
    noRegionalAdmins: "No regional admin assigned.",
    chooseRegionalAdmin: "Choose a regional admin",
    villages: "Villages",
    noVillages: "No villages in this region yet.",
    addVillage: "Add village",
    villageName: "Village name",
    lgdCode: "LGD village code (optional)",
    latitude: "Latitude (optional)",
    longitude: "Longitude (optional)",
    noPin: "No map pin",
    mitras: "Mitras",
    noMitras: "No mitra assigned.",
    chooseMitra: "Choose a mitra",
    assign: "Assign",
    remove: "Remove",
    errors: {
      forbidden: "You don't have permission to do that.",
      duplicate: "That name or code is already in use.",
      invalid: "Please check the details and try again.",
      not_found: "That item no longer exists.",
    },
  },
};

type DeepStringShape<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]> };

export type Dictionary = DeepStringShape<typeof en>;
