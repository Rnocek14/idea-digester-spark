import { Waves, Calendar } from "lucide-react";
import { format } from "date-fns";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Today", to: "/lake-geneva" },
  { label: "Directory", to: "/directory" },
  { label: "Advertise", to: "/advertise" },
];

export const PublicHeader = () => {
  const scrollToSubscribe = () => {
    const subscribeEl = document.getElementById('subscribe');
    if (subscribeEl) {
      subscribeEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Top line: date + tagline */}
        <div className="flex items-center justify-between py-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
          </div>
          <span className="hidden sm:inline">Your local news, simplified</span>
        </div>

        {/* Main nav */}
        <div className="flex items-center justify-between py-3 gap-4">
          <NavLink to="/lake-geneva" className="flex items-baseline gap-2 group">
            <span className="font-display text-xl tracking-tight text-brand group-hover:text-brand-accent transition-colors">
              Lake Geneva Brief
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.15em] text-gray-400 sm:inline">
              LOCAL EDITION
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-6 text-sm text-gray-600 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="hover:text-brand-accent transition-colors"
                activeClassName="text-brand-accent font-medium"
              >
                {item.label}
              </NavLink>
            ))}
            <Button
              size="sm"
              onClick={scrollToSubscribe}
              className="rounded-full bg-brand-accent px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Get the Brief
            </Button>
          </div>

          {/* Mobile Nav */}
          <div className="flex sm:hidden items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:border-brand-accent hover:text-brand-accent transition-colors"
                activeClassName="border-brand-accent text-brand-accent"
              >
                {item.label}
              </NavLink>
            ))}
            <Button
              size="sm"
              onClick={scrollToSubscribe}
              className="rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Subscribe
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
