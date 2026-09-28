import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import Field from "./Field.jsx";
import { Button } from "./primitives/button.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./primitives/tooltip.jsx";

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
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="size-8 rounded-sm text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{show ? "Masquer le mot de passe" : "Afficher le mot de passe"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    />
  );
}