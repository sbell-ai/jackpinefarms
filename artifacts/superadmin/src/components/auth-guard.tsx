import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMe } from "@/hooks/use-me";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !data) {
      navigate("/login");
    } else if (data.mustChangePassword && location !== "/change-password") {
      navigate("/change-password");
    }
  }, [isLoading, isError, data, location, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  return <>{children}</>;
}
