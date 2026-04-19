import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

function resolveHref(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

function NavLink({ href, label, className }: { href: string; label: string; className: string }) {
  const resolved = resolveHref(href);
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return (
      <a href={resolved} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return <Link href={resolved} className={className}>{label}</Link>;
}
import { Menu, X, ShoppingCart, Leaf, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useGetCart, getGetCartQueryKey, useAuthMe, getAuthMeQueryKey } from "@workspace/api-client-react";
import { useStoreTenant, useStoreHeaders } from "@/lib/StoreTenantContext";
import { useTenantSiteImage } from "@/lib/useTenantSiteImage";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logoUrl = useTenantSiteImage("image.logo", `${import.meta.env.BASE_URL}images/logo.png`);
  const [location] = useLocation();
  const { tenant, slug } = useStoreTenant();
  const storeHeaders = useStoreHeaders();
  const farmName = tenant?.name ?? "Jack Pine Farm";

  const { data: cart } = useGetCart({
    query: { queryKey: getGetCartQueryKey() }
  });

  const { data: session } = useAuthMe({
    query: { queryKey: getAuthMeQueryKey(), retry: false }
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const fallbackNavLinks = [
    { href: "/shop", label: "Shop" },
    { href: "/pickup-events", label: "Pickup Dates" },
    { href: "/how-we-raise-them", label: "How We Raise Them" },
    { href: "/about", label: "Our Story" },
    { href: "/faq", label: "FAQ" },
    { href: "/popup-market", label: "Pop-Up Market" },
    { href: "/contact", label: "Contact" },
  ];

  const { data: headerMenu } = useQuery<{ items: { url: string; label: string }[] } | null>({
    queryKey: ["cms-menu-header", slug ?? ""],
    queryFn: async () => {
      const res = await fetch("/api/cms/menus/header", { headers: storeHeaders });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const navLinks =
    headerMenu && headerMenu.items.length > 0
      ? headerMenu.items.map((item) => ({ href: item.url, label: item.label }))
      : fallbackNavLinks;

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b border-transparent",
          isScrolled 
            ? "bg-background/90 backdrop-blur-md border-border/50 shadow-sm py-3" 
            : "bg-transparent py-5"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform">
                <img 
                  src={logoUrl} 
                  alt={`${farmName} Logo`}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-sans text-xl text-primary tracking-tight hidden sm:block">
                {farmName}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-accent",
                    location === link.href ? "text-accent" : "text-foreground/80"
                  )}
                />
              ))}
            </nav>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-4">
              {session?.id ? (
                <Link href="/account" className="flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                  <User className="w-4 h-4" />
                  My Account
                </Link>
              ) : (
                <Link href="/auth/login" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                  Log In
                </Link>
              )}
              
              <div className="w-px h-6 bg-border mx-2" />
              
              <Link 
                href="/cart"
                className="relative flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-sm text-primary hover:bg-primary hover:text-white transition-all duration-200 group"
              >
                <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                    {cart.itemCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center gap-4 lg:hidden">
              <Link href="/cart" className="relative text-primary p-2">
                <ShoppingCart className="w-6 h-6" />
                {cart && cart.itemCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                    {cart.itemCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-foreground p-2 -mr-2"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background pt-24 px-6 lg:hidden overflow-y-auto"
          >
            <nav className="flex flex-col gap-6 text-center">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  className={cn(
                    "text-2xl font-serif font-medium transition-colors",
                    location === link.href ? "text-accent" : "text-primary"
                  )}
                />
              ))}
              <div className="w-12 h-px bg-border mx-auto my-4" />
              
              {session?.id ? (
                <Link href="/account" className="text-xl font-medium text-foreground">
                  My Account
                </Link>
              ) : (
                <Link href="/auth/login" className="text-xl font-medium text-foreground">
                  Log In
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col pt-20">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col"
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground pt-16 pb-8 mt-auto border-t-4 border-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img
                  src={logoUrl}
                  alt={`${farmName} Logo`}
                  className="w-10 h-10 object-contain brightness-0 invert"
                />
                <span className="font-serif text-2xl font-bold">{farmName}</span>
              </div>
              <p className="text-primary-foreground/80 max-w-sm leading-relaxed">
                Pastured poultry and farm-fresh eggs from our farm to your table. Raised right, with care.
              </p>
            </div>
            
            <div>
              <h3 className="font-serif text-lg font-bold mb-6 text-accent">Quick Links</h3>
              <ul className="space-y-3">
                <li><Link href="/shop" className="text-primary-foreground/80 hover:text-white transition-colors">Shop Products</Link></li>
                <li><Link href="/how-we-raise-them" className="text-primary-foreground/80 hover:text-white transition-colors">How We Raise Them</Link></li>
                <li><Link href="/about" className="text-primary-foreground/80 hover:text-white transition-colors">Our Story</Link></li>
                <li><Link href="/faq" className="text-primary-foreground/80 hover:text-white transition-colors">FAQ</Link></li>
                <li><Link href="/pickup-events" className="text-primary-foreground/80 hover:text-white transition-colors">Pickup Dates</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-serif text-lg font-bold mb-6 text-accent">Visit Us</h3>
              <p className="text-primary-foreground/80 mb-2">Local Pickup Only</p>
              <p className="text-primary-foreground/80 mb-6">Open by appointment or during scheduled preorder batches.</p>
              <Link 
                href="/contact"
                className="inline-block px-6 py-2 border-2 border-accent text-accent font-semibold rounded-lg hover:bg-accent hover:text-white transition-all duration-300"
              >
                Contact Us
              </Link>
            </div>
          </div>
          
          <div className="pt-8 border-t border-primary-foreground/10 text-center md:text-left text-sm text-primary-foreground/60 flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} {farmName}. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/policies/sales-returns" className="hover:text-white transition-colors">Sales &amp; Returns Policy</Link>
              <span className="text-primary-foreground/30">·</span>
              <Link href="/admin/login" className="hover:text-white transition-colors">JP FarmOps Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
