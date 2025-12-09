import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface HostnameRouterProps {
  children: ReactNode;
}

/**
 * Routes users based on hostname:
 * - citybrief.info (root domain) → /auth page
 * - lakegeneva.citybrief.info → normal routing (Lake Geneva site)
 */
const HostnameRouter = ({ children }: HostnameRouterProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const hostname = window.location.hostname;
    
    // If visiting citybrief.info (root domain) and not already on auth/dashboard
    if (
      (hostname === "citybrief.info" || hostname === "www.citybrief.info") &&
      location.pathname === "/"
    ) {
      navigate("/auth", { replace: true });
    }
  }, [navigate, location.pathname]);

  return <>{children}</>;
};

export default HostnameRouter;
