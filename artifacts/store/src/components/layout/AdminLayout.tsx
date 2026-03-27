import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdminMe, useAdminLogout, getAdminMeQueryKey } from "@workspace/api-client-react";
import {
  Store, Package, LogOut, Loader2, Home, ShoppingBag, Layers,
  CalendarDays, Users, LayoutDashboard, Egg, Bird, Rabbit, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [navOpen, setNavOpen] = useState(false);

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

  const isSettling = isLoading || isFetching;
  const shouldRedirect = !isSettling && (isError || !session?.authenticated);

  useEffect(() => {
    if (shouldRedirect) {
      setLocation('/admin/login');
    }
  }, [shouldRedirect, setLocation]);

  // Close nav drawer on route change
  useEffect(() => {
    setNavOpen(false);
  }, [location]);

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

  const isActive = (item: typeof navItems[0]) =>
    item.exact
      ? location === item.href
      : location.startsWith(item.href) && item.href !== "/admin";

  const currentPage = navItems.find(i => isActive(i))?.label ?? "FarmOps";

  function NavLinks({ onClick }: { onClick?: () => void }) {
    return (
      <>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Link
            href="/"
            onClick={onClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-all"
          >
            <Home className="w-5 h-5 shrink-0" />
            Back to Store
          </Link>
          <button
            onClick={() => { onClick?.(); logout.mutate(); }}
            disabled={logout.isPending}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all text-left"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Sign Out
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex-col shadow-sm z-10 hidden md:flex">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-lg text-primary">FarmOps</span>
        </div>
        <NavLinks />
      </aside>

      {/* Mobile Nav Sheet */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <span className="font-serif font-bold text-lg text-primary">FarmOps</span>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col flex-1 overflow-y-auto">
            <NavLinks onClick={() => setNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="text-muted-foreground hover:text-foreground -ml-1 p-1"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-serif font-semibold text-primary">{currentPage}</span>
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
