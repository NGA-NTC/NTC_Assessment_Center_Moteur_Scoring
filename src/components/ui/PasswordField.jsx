import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import Field from "./Field.jsx";

export default function PasswordField({ label = "Mot de passe", placeholder = "Votre mot de passe", ...inputProps }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      {...inputProps}
      label={label}
      placeholder={placeholder}
      icon={<Lock size={16} className="text-muted-foreground" />}
      type={show ? "text" : "password"}
      right={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="flex cursor-pointer border-none bg-none p-1 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
}