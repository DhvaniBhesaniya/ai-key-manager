import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Key, MessageSquare, Code2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/keys", icon: Key, label: "Key Management" },
  { to: "/chat", icon: MessageSquare, label: "Demo Chat" },
  { to: "/playground", icon: Code2, label: "API Playground" },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar flex flex-col z-30">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center">
          <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-base font-semibold text-sidebar-accent-foreground tracking-tight">
          AI KeyVault
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/60">v1.0.0 • Secure API Key Manager</p>
      </div>
    </aside>
  );
}
