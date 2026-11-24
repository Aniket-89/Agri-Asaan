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
  dashboard: {
    territoryLink: "क्षेत्र प्रबंधित करें",
  },
  territory: {
    title: "क्षेत्र",
    intro: "क्षेत्र, गाँव, और उनकी ज़िम्मेदारी किसके पास है।",
    backToDashboard: "डैशबोर्ड पर वापस जाएँ",
    saved: "सहेज लिया गया।",
    noRegions: "अभी कोई क्षेत्र नहीं है।",
    addRegion: "क्षेत्र जोड़ें",
    regionName: "क्षेत्र का नाम",
    inactive: "निष्क्रिय",
    readOnly: "आप यह क्षेत्र देख सकते हैं, लेकिन बदल नहीं सकते।",
    regionalAdmins: "क्षेत्रीय एडमिन",
    noRegionalAdmins: "कोई क्षेत्रीय एडमिन नियुक्त नहीं है।",
    chooseRegionalAdmin: "क्षेत्रीय एडमिन चुनें",
    villages: "गाँव",
    noVillages: "इस क्षेत्र में अभी कोई गाँव नहीं है।",
    addVillage: "गाँव जोड़ें",
    villageName: "गाँव का नाम",
    lgdCode: "LGD गाँव कोड (वैकल्पिक)",
    latitude: "अक्षांश (वैकल्पिक)",
    longitude: "देशांतर (वैकल्पिक)",
    noPin: "नक्शे पर स्थान नहीं",
    mitras: "मित्र",
    noMitras: "कोई मित्र नियुक्त नहीं है।",
    chooseMitra: "मित्र चुनें",
    assign: "नियुक्त करें",
    remove: "हटाएँ",
    errors: {
      forbidden: "आपको यह करने की अनुमति नहीं है।",
      duplicate: "यह नाम या कोड पहले से उपयोग में है।",
      invalid: "कृपया जानकारी जाँचें और फिर से प्रयास करें।",
      not_found: "यह आइटम अब मौजूद नहीं है।",
    },
  },
};
