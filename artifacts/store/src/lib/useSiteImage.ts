import { useGetSiteSettings } from "@workspace/api-client-react";

export function useSiteImage(key: string, fallback: string): string {
  const { data } = useGetSiteSettings();
  return (data && data[key]) ? data[key] : fallback;
}
