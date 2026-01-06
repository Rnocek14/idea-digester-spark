import { Navigate } from "react-router-dom";

// Redirect to the main employer dashboard page
export default function EmployerLogin() {
  return <Navigate to="/employer-dashboard" replace />;
}
