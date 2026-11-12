import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLoader from "./PageLoader";

/**
 * Route guard. Usage in App.jsx:
 *   <Route element={<ProtectedRoute />}>                    any signed-in user
 *   <Route element={<ProtectedRoute roles={["hr"]} />}>     HR only
 * This only hides screens. The API checks the role again on every request.
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
