// [apps/frontend] src/components/ProtectedRoute.tsx
import { useAuth } from "@/services/auth";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login, preserving the intended destination
      navigate({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Don't flash protected content while redirecting
  }

  return <>{children}</>;
}
