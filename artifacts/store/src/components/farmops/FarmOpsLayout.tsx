import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Sprout, LogOut, LayoutDashboard, DollarSign, MessageSquare, ShoppingBasket, Bird, Egg, Settings, Users, Package, Calendar, Tag, FileText, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFarmopsMe, useFarmopsLogout } from "@/hooks/useFarmopsAuth";
import FerndeskWidget from "./FernDeskWidget";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/farmops/dashboard",     label: "Dashboard",     icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/farmops/expenses",      label: "Expenses",      icon: <DollarSign className="w-4 h-4" /> },
  { href: "/farmops/orders",        label: "Orders",        icon: <ShoppingBasket className="w-4 h-4" /> },
  { href: "/farmops/products",      label: "Products",      icon: <Package className="w-4 h-4" /> },
  { href: "/farmops/pickup-events", label: "Pickup Events", icon: <Calendar className="w-4 h-4" /> },
  { href: "/farmops/coupons",       label: "Coupons",       icon: <Tag className="w-4 h-4" /> },
  { href: "/farmops/cms-pages",     label: "Pages",         icon: <FileText className="w-4 h-4" /> },
  { href: "/farmops/cms-menus",     label: "Navigation",    icon: <Navigation className="w-4 h-4" /> },
  { href: "/farmops/flocks",        label: "Flocks",        icon: <Bird className="w-4 h-4" /> },
  { href: "/farmops/eggs",          label: "Eggs",          icon: <Egg className="w-4 h-4" /> },
  { href: "/farmops/sms",           label: "SMS",           icon: <MessageSquare className="w-4 h-4" /> },
  { href: "/farmops/team",          label: "Team",          icon: <Users className="w-4 h-4" /> },
  { href: "/farmops/settings",      label: "Settings",      icon: <Settings className="w-4 h-4" /> },
];

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

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <FerndeskWidget />
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
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-medium transition-colors",
                      location.startsWith(item.href)
                        ? "text-emerald-700"
                        : "text-slate-600 hover:text-emerald-700"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
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
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu — full-screen overlay with animation and tap-outside-to-close */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="farmops-mobile-menu"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-white/95 backdrop-blur-sm pt-16 md:hidden overflow-y-auto"
            onClick={() => setMobileOpen(false)}
          >
            <nav
              className="px-6 py-4 flex flex-col gap-1 border-t border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {session ? (
                <>
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        location.startsWith(item.href)
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                  <div className="my-2 h-px bg-slate-100" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-700 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/farmops#pricing" className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Pricing
                  </Link>
                  <Link href="/farmops/login" className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Sign In
                  </Link>
                  <div className="pt-2">
                    <Link
                      href="/farmops/register"
                      className="block px-4 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold text-center hover:bg-emerald-800 transition-colors"
                    >
                      Start Free Trial
                    </Link>
                  </div>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

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
