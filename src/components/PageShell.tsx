import * as React from "react";
import { Link, NavLink } from "react-router-dom";
import { format } from "date-fns";
import { LakeLine } from "@/components/LakeLine";

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
  const shortDate = format(new Date(), "EEE, MMM d");
  const now = new Date();
  const volume = now.getFullYear() - 2024; // launched 2025 → Vol I
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const issueNo = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const toRoman = (n: number) =>
    ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n);
  const issueLine = `Vol. ${toRoman(volume)} · No. ${String(issueNo).padStart(3, "0")}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top header */}
      <header className="sticky top-0 z-30 relative bg-white/80 backdrop-blur-sm">
        {/* Top strip: date + tagline */}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-slate-500">
          <span className="flex items-baseline gap-2">
            <span className="hidden sm:inline">{today}</span>
            <span className="sm:hidden">{shortDate}</span>
            <span className="hidden md:inline text-slate-300">·</span>
            <span
              className="hidden md:inline text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--shore-terracotta))]/80"
              style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "0.14em" }}
            >
              {issueLine}
            </span>
          </span>
          <span
            className="hidden sm:inline text-[11px] uppercase tracking-[0.18em] text-slate-500"
            style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "0.14em" }}
          >
            Geneva Lake · Walworth County, Wisconsin
          </span>
        </div>

        {/* Main nav */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pb-3 pt-2">
          {/* Logo / brand */}
          <Link to="/" className="flex items-baseline gap-2 group">
            <span
              className="text-2xl tracking-tight text-slate-900 group-hover:text-[hsl(var(--lake-deep))] transition-colors leading-none"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
            >
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
        <LakeLine />
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
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Signed editor's note */}
          <div className="flex flex-col items-center text-center gap-3">
            <span
              className="text-xl text-slate-800"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
            >
              Lake Geneva Brief
            </span>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[hsl(var(--shore-terracotta))]/40" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--shore-terracotta))]/80">
                From the Shore Path
              </span>
              <span className="h-px w-8 bg-[hsl(var(--shore-terracotta))]/40" />
            </div>
            <p
              className="max-w-md text-sm italic text-slate-600 leading-relaxed"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Curated from the shore path by Gina Nocek — a daily note for the
              people who call Geneva Lake home.
            </p>
          </div>

          {/* Utility row */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link to="/selling-lake-geneva" className="hover:text-slate-900 hover:underline">
                Selling Your Home?
              </Link>
              <span className="text-slate-300">·</span>
              <Link to="/directory" className="hover:text-slate-900 hover:underline">
                Directory
              </Link>
              <span className="text-slate-300">·</span>
              <Link to="/advertise" className="hover:text-slate-900 hover:underline">
                Advertise
              </Link>
              <span className="text-slate-300">·</span>
              <Link to="/submit" className="hover:text-slate-900 hover:underline">
                Submit a Tip
              </Link>
            </div>
            <div className="text-[11px] text-slate-400">
              Lake Geneva Real Estate — Powered by Gina @properties
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PageShell;
