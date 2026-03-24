import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ShoppingCart, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { href: "/shop", label: "Shop" },
    { href: "/how-we-raise-them", label: "How We Raise Them" },
    { href: "/about", label: "Our Story" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ];

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
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform">
                <img 
                  src={`${import.meta.env.BASE_URL}images/logo.png`} 
                  alt="Jack Pine Farm Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-serif text-xl font-bold text-primary tracking-tight">
                Jack Pine Farm
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-accent",
                    location === link.href ? "text-accent" : "text-foreground/80"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/admin/login" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
                Admin
              </Link>
              <button className="flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-sm text-primary hover:bg-primary hover:text-white transition-all duration-200">
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center gap-4 md:hidden">
              <button className="text-primary">
                <ShoppingCart className="w-6 h-6" />
              </button>
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
            className="fixed inset-0 z-40 bg-background pt-24 px-6 md:hidden"
          >
            <nav className="flex flex-col gap-6 text-center">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-2xl font-serif font-medium transition-colors",
                    location === link.href ? "text-accent" : "text-primary"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="w-12 h-px bg-border mx-auto my-4" />
              <Link href="/admin/login" className="text-lg font-medium text-muted-foreground">
                Admin Login
              </Link>
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
                <Leaf className="w-6 h-6 text-accent" />
                <span className="font-serif text-2xl font-bold">Jack Pine Farm</span>
              </div>
              <p className="text-primary-foreground/80 max-w-sm leading-relaxed">
                Pastured poultry and farm-fresh eggs from our 70 acres to your table. Raised right, with care.
              </p>
            </div>
            
            <div>
              <h3 className="font-serif text-lg font-bold mb-6 text-accent">Quick Links</h3>
              <ul className="space-y-3">
                <li><Link href="/shop" className="text-primary-foreground/80 hover:text-white transition-colors">Shop Products</Link></li>
                <li><Link href="/how-we-raise-them" className="text-primary-foreground/80 hover:text-white transition-colors">How We Raise Them</Link></li>
                <li><Link href="/about" className="text-primary-foreground/80 hover:text-white transition-colors">Our Story</Link></li>
                <li><Link href="/faq" className="text-primary-foreground/80 hover:text-white transition-colors">FAQ</Link></li>
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
          
          <div className="pt-8 border-t border-primary-foreground/10 text-center md:text-left text-sm text-primary-foreground/60 flex flex-col md:flex-row justify-between items-center">
            <p>© {new Date().getFullYear()} Jack Pine Farm. All rights reserved.</p>
            <p className="mt-2 md:mt-0">Powered by FarmOps</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
