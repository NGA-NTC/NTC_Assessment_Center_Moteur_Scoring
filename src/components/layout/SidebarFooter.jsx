import { LogOut } from "lucide-react";
import Button from "../ui/Button.jsx";

export default function SidebarFooter({ onLogout, className = "" }) {
  return (
    <div className={`sidebar-footer ${className}`.trim()} style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
      <Button variant="outline" size="sm" full onClick={onLogout}>
        <LogOut size={14} /> <span className="sidebar-footer__label">Déconnexion</span>
      </Button>
    </div>
  );
}