import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ShieldCheck,
  ClipboardList,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/tenants",    label: "Tenants",    icon: Users },
  { href: "/billing",    label: "Billing",    icon: CreditCard },
  { href: "/admins",     label: "Admins",     icon: ShieldCheck },
  { href: "/audit-logs", label: "Audit Logs", icon: ClipboardList },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      window.location.replace("/login");
    },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <p className="text-white font-semibold text-base leading-tight">FarmOps</p>
          <p className="text-sidebar-foreground/50 text-xs mt-0.5 uppercase tracking-wider">Super Admin</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          {me && (
            <div className="mb-2">
              <p className="text-xs text-sidebar-foreground/50 truncate">{me.email}</p>
              <p className="text-xs text-sidebar-foreground/40 capitalize">{me.role}</p>
            </div>
          )}
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-2 text-sm text-sidebar-foreground hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
