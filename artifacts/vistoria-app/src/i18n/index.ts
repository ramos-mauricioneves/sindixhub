import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pt from "./locales/pt";
import en from "./locales/en";

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
  },
  lng: localStorage.getItem("lang") || "pt",
  fallbackLng: "pt",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
