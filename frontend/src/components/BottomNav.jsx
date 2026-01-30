import { HomeIcon, BuildingOfficeIcon, CalendarIcon, UserIcon } from "@heroicons/react/24/outline";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { path: "/", label: "Home", icon: HomeIcon },
  { path: "/rooms", label: "Rooms", icon: BuildingOfficeIcon },
  { path: "/calendar", label: "Calendar", icon: CalendarIcon },
  { path: "/profile", label: "Profile", icon: UserIcon },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-base border-t border-border-subtle safe-area-inset-bottom z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors relative ${
                isActive
                  ? "text-accent-primary"
                  : "text-accent-secondary/60"
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-6 h-6 mb-1" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-accent-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
