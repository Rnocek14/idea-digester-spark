import * as React from "react";
import { Link, NavLink } from "react-router-dom";
import { format } from "date-fns";

const navItems = [
  { label: "Today", to: "/lake-geneva" },
  { label: "Events", to: "/events" },
  { label: "Local Love", to: "/community/local-love" },
  { label: "Eats", to: "/eats" },
  { label: "Directory", to: "/directory" },
  { label: "Submit", to: "/submit" },
];

type PageShellProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
};

const PageShell: React.FC<PageShellProps> = ({
  children,
  fullWidth = false,
}) => {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        {/* Top strip: date + tagline */}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-slate-500">
          <span>{today}</span>
          <span className="hidden sm:inline">Your local news, simplified</span>
        </div>

        {/* Main nav */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-3 pt-2">
          {/* Logo / brand */}
          <Link to="/" className="flex items-baseline gap-2 group">
            <span className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              Lake Geneva Brief
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:inline">
              Local Edition
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-4 text-xs font-medium text-slate-600 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-1 transition-colors",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("subscribe");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-500 hover:text-blue-700"
            >
              Get the Brief
            </button>
          </nav>

          {/* Mobile nav – horizontally scrollable so all items remain reachable */}
          <nav className="flex items-center gap-2 overflow-x-auto text-xs font-medium text-slate-600 sm:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "whitespace-nowrap rounded-full px-2 py-1",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className={fullWidth 
        ? "pb-10 pt-6" 
        : "mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 lg:px-8"
      }>
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700">
              Lake Geneva Brief
            </span>
            <span>•</span>
            <Link
              to="/selling-lake-geneva"
              className="hover:text-slate-900 hover:underline"
            >
              Selling Your Home?
            </Link>
            <span>•</span>
            <Link
              to="/directory"
              className="hover:text-slate-900 hover:underline"
            >
              Directory
            </Link>
            <span>•</span>
            <Link
              to="/advertise"
              className="hover:text-slate-900 hover:underline"
            >
              Advertise
            </Link>
          </div>
          <div className="text-[11px]">
            Lake Geneva Real Estate — Powered by Gina @properties
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PageShell;
