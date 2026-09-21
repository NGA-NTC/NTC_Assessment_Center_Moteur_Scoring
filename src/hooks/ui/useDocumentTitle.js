import { useEffect } from "react";
import { t } from "../../i18n/index.js";
import { I18N_CONFIG } from "../../i18n/config.js";

export function useDocumentTitle(titleKey, params) {
  useEffect(() => {
    const resolved = t(titleKey, params);
    const isResolved = typeof resolved === "string" && titleKey && resolved !== titleKey;

    document.title = isResolved
      ? `${resolved}${I18N_CONFIG.documentTitleSuffix}`
      : I18N_CONFIG.defaultDocumentTitle;
  }, [titleKey, params]);
}