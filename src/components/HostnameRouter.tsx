import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface HostnameRouterProps {
  children: ReactNode;
}

/**
 * Routes users based on hostname:
 * - citybrief.info (the hub domain) → /cities (find-your-city: geolocate, zip,
 *   waitlist) — the front door of the network, not a login page
 * - city domains (lakegenevabrief.com, ...) → normal routing
 * Phase 3 extends this: resolve hostname → city_config row and scope every
 * query to that city.
 */
const HostnameRouter = ({ children }: HostnameRouterProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hostname = window.location.hostname;

    if (
      (hostname === "citybrief.info" || hostname === "www.citybrief.info") &&
      location.pathname === "/"
    ) {
      navigate("/cities", { replace: true });
    }
  }, [navigate, location.pathname]);

  return <>{children}</>;
};

export default HostnameRouter;
