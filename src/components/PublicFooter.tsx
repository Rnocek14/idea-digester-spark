import { NavLink } from "@/components/NavLink";

export const PublicFooter = () => {
  return (
    <footer className="border-t mt-16 py-8 bg-muted/20">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <NavLink to="/lake-geneva" className="hover:text-primary transition-colors">
              Lake Geneva Brief
            </NavLink>
            <span className="text-muted-foreground/50">•</span>
            <NavLink to="/directory" className="hover:text-primary transition-colors">
              Business Directory
            </NavLink>
            <span className="text-muted-foreground/50">•</span>
            <NavLink to="/advertise" className="hover:text-primary transition-colors">
              Advertise
            </NavLink>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} Lake Geneva Brief. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
