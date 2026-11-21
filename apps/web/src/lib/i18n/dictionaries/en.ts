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
};

type DeepStringShape<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]> };

export type Dictionary = DeepStringShape<typeof en>;
