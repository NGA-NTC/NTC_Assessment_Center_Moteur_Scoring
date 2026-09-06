import { LogOut } from "lucide-react";
import Button from "../ui/Button.jsx";

export default function SidebarFooter({ onLogout }) {
  return (
    <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
      <Button variant="outline" size="sm" full onClick={onLogout}>
        <LogOut size={14} /> Déconnexion
      </Button>
    </div>
  );
}