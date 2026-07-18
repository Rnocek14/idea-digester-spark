import { NavLink } from "@/components/NavLink";
import { SuggestionBoxModal } from "@/components/SuggestionBox";

export const PublicFooter = () => {
  return (
    <footer className="border-t mt-16 py-8 bg-muted/20">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <NavLink to="/" className="hover:text-primary transition-colors">
              Lake Geneva Brief
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/events" className="hover:text-primary transition-colors">
              Events
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/incidents" className="hover:text-primary transition-colors">
              Incidents
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/guides" className="hover:text-primary transition-colors">
              Guides
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/jobs" className="hover:text-primary transition-colors">
              Jobs
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/deals" className="hover:text-primary transition-colors">
              Deals
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/directory" className="hover:text-primary transition-colors">
              Business Directory
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <NavLink to="/advertise" className="hover:text-primary transition-colors">
              Advertise
            </NavLink>
            <span className="text-muted-foreground">•</span>
            <SuggestionBoxModal
              trigger={
                <button type="button" className="hover:text-primary transition-colors">
                  Tell us what you think
                </button>
              }
            />
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} Lake Geneva Brief. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
