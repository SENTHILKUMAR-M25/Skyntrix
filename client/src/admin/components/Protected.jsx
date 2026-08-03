import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Loading } from "./Ui";

export default function Protected() {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base">
        <Loading label="Checking session..." />
      </div>
    );
  }

  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}