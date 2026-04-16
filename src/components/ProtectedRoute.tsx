import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, isAdmin } from "@/hooks/useAuth";

export function ProtectedRoute({
  children,
  require,
}: {
  children: React.ReactNode;
  require: "auth" | "student" | "admin";
}) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[40vh] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (require === "admin" && !isAdmin(roles)) {
    return <Navigate to="/student" replace />;
  }

  if (require === "student" && isAdmin(roles)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
