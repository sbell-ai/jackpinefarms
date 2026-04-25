import { useQuery } from "@tanstack/react-query";
import { useStoreTenant, useStoreHeaders } from "./StoreTenantContext";

/**
 * Like useSiteImage, but passes X-Store-Slug when inside a StoreTenantProvider
 * so the server can return the tenant-specific logo override.
 */
export function useTenantSiteImage(key: string, fallback: string): string {
  const { slug } = useStoreTenant();
  const headers = useStoreHeaders();

  const { data } = useQuery<Record<string, string>>({
    queryKey: ["site-settings-tenant", slug ?? ""],
    queryFn: async () => {
      const res = await fetch("/api/site-settings", { headers });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const value = data?.[key];
  return value != null && value !== "" ? value : fallback;
}
