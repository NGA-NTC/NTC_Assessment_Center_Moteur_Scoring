import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import Field from "./Field.jsx";
import { MUTED } from "../../lib/theme.js";

export default function PasswordField({ label = "Mot de passe", placeholder = "Votre mot de passe", ...inputProps }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      {...inputProps}
      label={label}
      placeholder={placeholder}
      icon={<Lock size={16} color={MUTED} />}
      type={show ? "text" : "password"}
      right={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
        >
          {show ? <EyeOff size={16} color={MUTED} /> : <Eye size={16} color={MUTED} />}
        </button>
      }
    />
  );
}