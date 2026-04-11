import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

interface StoreTenant { id: number; slug: string; name: string }

const Ctx = createContext<{ tenant: StoreTenant | null; slug: string | null }>({
  tenant: null,
  slug: null,
});

export function StoreTenantProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const { data: tenant = null, isError } = useQuery<StoreTenant>({
    queryKey: ["storefront-tenant", slug],
    queryFn: async () => {
      const res = await fetch(`/api/storefront/${slug}`);
      if (!res.ok) throw new Error("Storefront not found");
      return res.json();
    },
    retry: false,
  });

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Storefront not found.
      </div>
    );
  }

  return <Ctx.Provider value={{ tenant, slug }}>{children}</Ctx.Provider>;
}

export function useStoreTenant() {
  return useContext(Ctx);
}

/**
 * Returns the headers object to spread into any fetch() call or
 * pass as `request: { headers: storeHeaders }` in generated API hooks
 * when inside a tenant storefront context.
 * Returns an empty object on the legacy Jack Pine path (no slug active).
 */
export function useStoreHeaders(): HeadersInit {
  const { slug } = useContext(Ctx);
  return slug ? { "X-Store-Slug": slug } : {};
}
