import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMe } from "@/hooks/use-me";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      navigate("/login");
    }
  }, [isLoading, isError, data, navigate]);

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
