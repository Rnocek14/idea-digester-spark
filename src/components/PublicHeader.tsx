import { Waves, Calendar } from "lucide-react";
import { format } from "date-fns";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Today", to: "/lake-geneva" },
  { label: "Directory", to: "/directory" },
  { label: "Advertise", to: "/advertise" },
];

export const PublicHeader = () => {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      {/* Top Bar */}
      <div className="border-b border-border/40">
        <div className="container max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </div>
            <div>Your local news, simplified</div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/lake-geneva" className="flex items-center gap-3 group">
            <Waves className="h-7 w-7 text-primary group-hover:scale-110 transition-transform" />
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight">
                Lake Geneva Brief
              </h1>
            </div>
          </NavLink>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors rounded-md",
                  "hover:bg-muted/50"
                )}
                activeClassName="bg-primary/10 text-primary"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile Nav */}
          <div className="flex md:hidden gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="text-xs px-3 py-1.5 rounded-full border border-border/40 hover:bg-muted/50 transition-colors"
                activeClassName="bg-primary/10 text-primary border-primary/30"
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
