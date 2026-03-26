import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAdminMe, useAdminLogout, getAdminMeQueryKey } from "@workspace/api-client-react";
import { Store, Package, LogOut, Loader2, Home, ShoppingBag, Layers, CalendarDays, Users, LayoutDashboard, Egg, Bird, Rabbit } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading, isFetching, isError } = useAdminMe({
    query: {
      queryKey: getAdminMeQueryKey(),
      retry: false,
    }
  });
  
  const logout = useAdminLogout({
    mutation: {
      onSuccess: () => {
        setLocation('/admin/login');
      }
    }
  });

  // Do not redirect while loading or actively refetching — a stale unauthenticated
  // cache entry after login would otherwise bounce the user back to the login page
  // before the fresh /admin/me response arrives.
  const isSettling = isLoading || isFetching;
  const shouldRedirect = !isSettling && (isError || !session?.authenticated);

  useEffect(() => {
    if (shouldRedirect) {
      setLocation('/admin/login');
    }
  }, [shouldRedirect, setLocation]);

  if (isSettling || shouldRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/batches", label: "Batches", icon: Layers },
    { href: "/admin/pickup-events", label: "Pickup Events", icon: CalendarDays },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/eggs", label: "Egg Inventory", icon: Egg },
    { href: "/admin/flocks", label: "Flocks", icon: Bird },
    { href: "/admin/animals", label: "Animals", icon: Rabbit },
  ];

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col shadow-sm z-10 hidden md:flex">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-lg text-primary">FarmOps</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location === item.href
              : location.startsWith(item.href) && item.href !== "/admin";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border space-y-2">
          <Link 
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-all"
          >
            <Home className="w-5 h-5" />
            Back to Store
          </Link>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all text-left"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            <span className="font-serif font-bold text-primary">FarmOps</span>
          </div>
          <Link href="/" className="text-sm font-medium text-muted-foreground">Store</Link>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
