import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Sprout, LogOut, LayoutDashboard, DollarSign, MessageSquare, ShoppingBasket, Bird, Egg, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFarmopsMe, useFarmopsLogout } from "@/hooks/useFarmopsAuth";

export function FarmOpsLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { data: session } = useFarmopsMe();
  const logout = useFarmopsLogout();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/farmops");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/farmops" className="flex items-center gap-2 font-bold text-xl text-emerald-700">
            <Sprout className="w-6 h-6" />
            JP FarmOps
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {session ? (
              <>
                <Link
                  href="/farmops/dashboard"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/dashboard")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link
                  href="/farmops/expenses"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/expenses")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <DollarSign className="w-4 h-4" />
                  Expenses
                </Link>
                <Link
                  href="/farmops/orders"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/orders")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <ShoppingBasket className="w-4 h-4" />
                  Orders
                </Link>
                <Link
                  href="/farmops/flocks"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/flocks")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <Bird className="w-4 h-4" />
                  Flocks
                </Link>
                <Link
                  href="/farmops/eggs"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/eggs")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <Egg className="w-4 h-4" />
                  Eggs
                </Link>
                <Link
                  href="/farmops/sms"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/sms")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </Link>
                <Link
                  href="/farmops/team"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/team")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <Users className="w-4 h-4" />
                  Team
                </Link>
                <Link
                  href="/farmops/settings"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium transition-colors",
                    location.startsWith("/farmops/settings")
                      ? "text-emerald-700"
                      : "text-slate-600 hover:text-emerald-700"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/farmops#pricing" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                  Pricing
                </Link>
                <Link href="/farmops/login" className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/farmops/register"
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors shadow-sm"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 flex flex-col gap-4">
            {session ? (
              <>
                <Link href="/farmops/dashboard" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/farmops/expenses" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Expenses
                </Link>
                <Link href="/farmops/orders" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Orders
                </Link>
                <Link href="/farmops/flocks" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Flocks
                </Link>
                <Link href="/farmops/eggs" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Eggs
                </Link>
                <Link href="/farmops/sms" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  SMS
                </Link>
                <Link href="/farmops/team" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Team
                </Link>
                <Link href="/farmops/settings" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Settings
                </Link>
                <button onClick={handleLogout} className="text-sm font-medium text-left text-slate-600">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/farmops#pricing" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Pricing
                </Link>
                <Link href="/farmops/login" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Sign In
                </Link>
                <Link
                  href="/farmops/register"
                  className="inline-block px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-lg mb-3">
                <Sprout className="w-5 h-5 text-emerald-400" />
                JP FarmOps
              </div>
              <p className="text-sm max-w-xs leading-relaxed">
                Farm management software built for small and mid-scale operations. Raise better, manage smarter.
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="text-white text-sm font-semibold mb-3">Product</p>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/farmops#features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="/farmops#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/farmops/register" className="hover:text-white transition-colors">Start Free Trial</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-white text-sm font-semibold mb-3">Account</p>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/farmops/login" className="hover:text-white transition-colors">Sign In</Link></li>
                  <li><Link href="/farmops/forgot-password" className="hover:text-white transition-colors">Reset Password</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-800 text-sm text-center text-slate-500">
            © {new Date().getFullYear()} Jack Pine Farm · JP FarmOps
          </div>
        </div>
      </footer>
    </div>
  );
}
