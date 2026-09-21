import ProtectedRoute from "./ProtectedRoute.jsx";
import SuperAdminRoute from "./SuperAdminRoute.jsx";
import UserRoute from "./UserRoute.jsx";

export { ProtectedRoute, SuperAdminRoute, UserRoute };

export const ROUTE_GUARDS = {
  user: UserRoute,
  admin: ProtectedRoute,
  superAdmin: SuperAdminRoute,
};