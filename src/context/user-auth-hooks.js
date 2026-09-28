import { useContext } from "react";
import { UserAuthContext } from "./user-auth-context.js";

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth doit être utilisé dans un UserAuthProvider");
  return ctx;
}
