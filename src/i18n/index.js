import { I18N_CONFIG } from "./config.js";
import frPages from "./locales/fr/pages.json" with { type: "json" };
import enPages from "./locales/en/pages.json" with { type: "json" };

const dictionaries = {
  fr: { pages: frPages },
  en: { pages: enPages },
};

let currentLocale = I18N_CONFIG.defaultLocale;

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (I18N_CONFIG.supportedLocales.includes(locale)) {
    currentLocale = locale;
  }
  return currentLocale;
}

export function t(key, params) {
  if (!key) return "";

  const [namespace, ...keyParts] = key.split(".");
  const localeDict = dictionaries[currentLocale]?.[namespace];
  const fallbackDict = dictionaries[I18N_CONFIG.fallbackLocale]?.[namespace];
  const resolve = (dict) => dict && keyParts.reduce(
    (acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined),
    dict
  );
  const value = resolve(localeDict) ?? resolve(fallbackDict) ?? key;

  if (typeof value !== "string" || !params) return value;

  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) => acc.replaceAll(`{${paramKey}}`, String(paramValue)),
    value
  );
}