import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export default function useFocusReset(selector = "main, [role='main'], h1") {
  const location = useLocation();
  const prevPath = useRef(null);

  useEffect(() => {
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    const target = document.querySelector(selector);
    if (!target) return;

    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    const isMain = target.tagName === "MAIN" || target.getAttribute("role") === "main";
    if (isMain && !target.getAttribute("role")) {
      target.setAttribute("role", "main");
    }
    target.focus({ preventScroll: true });
  }, [location.pathname, selector]);
}