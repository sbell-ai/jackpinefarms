import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import { formatMoney, stripHtml } from "@/lib/utils";
import { useSiteImage } from "@/lib/useSiteImage";

export default function Home() {
  const { data: products } = useListProducts();
  const featuredProducts = products?.slice(0, 3) || [];
  const heroBg = useSiteImage("image.hero_bg", `${import.meta.env.BASE_URL}images/hero-bg.jpg`);
  const promisePhoto = useSiteImage("image.home_promise", `${import.meta.env.BASE_URL}images/turkeys-pasture.jpg`);
  const productFallback = useSiteImage("image.product_fallback", "https://images.unsplash.com/photo-1598965402089-897ce52e8355?w=600&q=80");

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBg}
            alt="Turkeys on pasture at sunset, Jack Pine Farm"
            className="w-full h-full object-cover"
          />
          {/* Light transparent overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/15 to-transparent"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl text-white">
            <span className="inline-block py-1 px-3 rounded-full bg-accent/90 text-white text-sm font-semibold tracking-wider mb-6 shadow-sm">
              Pasture Raised • Local Pickup
            </span>
            <h1 className="text-white text-5xl md:text-7xl font-serif font-bold leading-tight mb-6 drop-shadow-md">
              Farm-fresh goods, raised the right way.
            </h1>
            <p className="text-lg md:text-xl mb-10 text-white/90 leading-relaxed font-medium max-w-xl drop-shadow">
              Poultry raised on fresh, open pasture = the highest quality.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/shop"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-2 border-primary"
              >
                Shop Now <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/how-we-raise-them"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-bold text-lg hover:bg-white/20 transition-all duration-300"
              >
                Our Practices
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-4">Fresh from the Farm</h2>
              <p className="text-muted-foreground text-lg max-w-2xl">Browse our seasonal offerings. Everything is raised outdoors, on pasture, with non-GMO feed.</p>
            </div>
            <Link href="/shop" className="hidden md:flex items-center gap-2 text-accent font-semibold hover:text-accent/80 transition-colors">
              View all products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredProducts.map(product => (
              <Link key={product.id} href={`/shop/${product.id}`} className="group h-full flex flex-col bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <img src={productFallback} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                  {product.availability === 'sold_out' && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-foreground text-background px-4 py-2 rounded-lg font-bold tracking-wider">Sold Out</span>
                    </div>
                  )}
                  {product.availability === 'preorder' && (
                    <div className="absolute top-4 right-4 bg-accent text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                      Preorder Open
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-serif text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{product.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">{stripHtml(product.description)}</p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    <span className="font-bold text-lg text-primary">
                      {formatMoney(product.priceInCents)}
                      {product.unitLabel && <span className="text-sm font-normal text-muted-foreground"> / {product.unitLabel}</span>}
                      {product.pricingType === 'deposit' && <span className="text-sm font-normal text-muted-foreground"> dep.</span>}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="mt-8 text-center md:hidden">
            <Link href="/shop" className="inline-flex items-center gap-2 text-accent font-semibold hover:text-accent/80 transition-colors">
              View all products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quality Promise */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-8 text-white">The Jack Pine Promise</h2>
              <div className="space-y-6">
                {[
                  "100% Pasture Raised — birds roam freely outside.",
                  "Non-GMO Feed — no compromises on what they eat.",
                  "Transparent Pricing — know exactly what you pay for.",
                  "Local Community First — pickups are prearranged at local spots."
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-accent shrink-0 mt-1" />
                    <p className="text-lg text-primary-foreground/90 font-medium">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12">
                <Link 
                  href="/about"
                  className="inline-block px-8 py-4 border-2 border-accent text-accent font-bold rounded-xl hover:bg-accent hover:text-white transition-all duration-300"
                >
                  Read Our Story
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-full bg-primary-foreground/5 absolute -inset-8 blur-3xl"></div>
              {/* pasture landscape */}
              <img 
                src={promisePhoto}
                alt="Turkeys on the farm"
                className="relative rounded-2xl shadow-2xl border-4 border-primary-foreground/10 object-cover aspect-[4/3] w-full"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
