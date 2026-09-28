import { useContext } from "react";
import { AdminAuthContext } from "./admin-auth-context.js";

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth doit être utilisé dans un AdminAuthProvider");
  return ctx;
}
