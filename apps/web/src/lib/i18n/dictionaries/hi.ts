import type { Dictionary } from "./en";

// Typed against the English shape: a missing or extra key fails typecheck.
// Translations need review by a native Hindi speaker before production.
export const hi: Dictionary = {
  metadata: {
    description: "ड्रोन छिड़काव, फसल निगरानी और कृषि सेवा प्रबंधन।",
  },
  language: {
    label: "भाषा",
    en: "English",
    hi: "हिन्दी",
  },
  login: {
    title: "{brand} में साइन इन करें",
    titleFallback: "साइन इन करें",
    email: "ईमेल",
    password: "पासवर्ड",
    submit: "साइन इन करें",
    createAccount: "नया खाता बनाएँ",
  },
};
