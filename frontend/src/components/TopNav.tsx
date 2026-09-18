import { useLocation, useNavigate } from "react-router-dom";
import { navItems } from "./BottomNav";
import Logo from "./Logo";

/**
 * Desktop navigation (md+). The mobile bottom bar stays the only
 * navigation on small screens; this compact top bar takes over on
 * large ones so the app doesn't present a mobile pattern on desktop.
 */
export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Primary"
      className="fixed top-0 left-0 right-0 z-50 hidden md:block bg-surface-base/95 backdrop-blur border-b border-border-subtle"
    >
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40"
          aria-label="Konfequem home"
        >
          <Logo size="sm" className="h-7 w-7" alt="" />
          <span className="text-base font-bold tracking-wide text-accent-secondary">
            Konfequem
          </span>
        </button>

        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-accent-primary bg-accent-primary/10"
                    : "text-accent-secondary/70 hover:bg-surface-muted hover:text-accent-secondary"
                }`}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="w-4 h-4" aria-hidden="true">
                  <Icon />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
