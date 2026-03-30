import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { formatMoney, stripHtml } from "@/lib/utils";
import { Loader2, ArrowRight } from "lucide-react";

export default function Shop() {
  const { data: products, isLoading } = useListProducts();

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
        <p className="mt-4 text-muted-foreground font-medium">Loading catalog...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-primary mb-4">Jack Pine Farm Store</h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Grab some fresh eggs, reserve your holiday turkey, or place a deposit for our next batch of pastured chicken. All orders are for local pickup either at Jack Pine Farm or at a prearranged local pickup location.
          </p>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {products?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border border-dashed">
            <h3 className="text-xl font-serif font-bold text-foreground mb-2">No products available right now</h3>
            <p className="text-muted-foreground">Check back soon for our next season's offerings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products?.map(product => (
              <Link 
                key={product.id} 
                href={`/shop/${product.id}`} 
                className="group flex flex-col bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <img src="https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=600&q=80" alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                  
                  {/* Status Badges */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                    {product.isOnSale && product.salePriceCents != null && (
                      <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider shadow-sm">
                        Sale
                      </span>
                    )}
                    {product.availability === 'sold_out' && (
                      <span className="bg-foreground text-background px-3 py-1 rounded-full text-xs font-bold tracking-wider shadow-sm">
                        Sold Out
                      </span>
                    )}
                    {product.availability === 'preorder' && (
                      <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                        Preorder
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</h3>
                  </div>
                  
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">{stripHtml(product.description)}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    <div className="flex flex-col">
                      {product.isOnSale && product.salePriceCents != null ? (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold text-xl text-red-600 dark:text-red-400">
                            {formatMoney(product.salePriceCents)}
                            {product.unitLabel && <span className="text-sm font-normal"> / {product.unitLabel}</span>}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {formatMoney(product.priceInCents)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-xl text-primary">
                          {formatMoney(product.priceInCents)}
                          {product.unitLabel && <span className="text-sm font-normal text-muted-foreground"> / {product.unitLabel}</span>}
                        </span>
                      )}
                      {product.pricingType === 'deposit' && (
                        <span className="text-xs font-medium text-accent uppercase tracking-wider mt-1">Deposit</span>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
