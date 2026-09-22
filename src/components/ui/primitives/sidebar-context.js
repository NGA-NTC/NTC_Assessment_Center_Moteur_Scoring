import { createContext, useContext, useSyncExternalStore } from "react";

export const SidebarReactContext = createContext(null);

export const SIDEBAR_MOBILE_BREAKPOINT = 768;

export function useSidebar() {
  const context = useContext(SidebarReactContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

export function useIsMobile() {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(
        `(max-width: ${SIDEBAR_MOBILE_BREAKPOINT - 1}px)`
      );
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.innerWidth < SIDEBAR_MOBILE_BREAKPOINT,
    () => false
  );
}