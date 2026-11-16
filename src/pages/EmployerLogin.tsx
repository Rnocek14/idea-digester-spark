import { Navigate } from "@/lib/router-compat";

// Redirect to the main employer dashboard page
export default function EmployerLogin() {
  return <Navigate to="/employer-dashboard" replace />;
}
