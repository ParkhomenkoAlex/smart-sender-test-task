import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { hasDeviceSessionToken } from "../../api/auth";
import { clearAuthSession } from "../../lib/auth-session";
import { useCurrentUser } from "./auth-query";

function AuthLoadingState() {
  return (
    <p className="p-6 text-sm text-slate-600" role="status">
      Проверяем сессию…
    </p>
  );
}

export function ProtectedRoute() {
  const hasSession = hasDeviceSessionToken();
  const userQuery = useCurrentUser();

  useEffect(() => {
    if (userQuery.isError) {
      clearAuthSession();
    }
  }, [userQuery.isError]);

  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }

  if (userQuery.isPending) {
    return <AuthLoadingState />;
  }

  if (userQuery.isError) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const hasSession = hasDeviceSessionToken();
  const userQuery = useCurrentUser();

  useEffect(() => {
    if (userQuery.isError) {
      clearAuthSession();
    }
  }, [userQuery.isError]);

  if (!hasSession || userQuery.isError) {
    return <Outlet />;
  }

  if (userQuery.isPending) {
    return <AuthLoadingState />;
  }

  return <Navigate to="/webhooks" replace />;
}
