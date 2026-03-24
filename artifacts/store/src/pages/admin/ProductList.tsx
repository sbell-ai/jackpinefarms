import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/utils";
import { Plus, Edit2, Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductList() {
  // Pass includeDisabled: true to see everything in Admin
  const { data: products, isLoading } = useListProducts({ includeDisabled: true });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'taking_orders': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'preorder': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'sold_out': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'disabled': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'taking_orders': return 'Active';
      case 'preorder': return 'Preorder';
      case 'sold_out': return 'Sold Out';
      case 'disabled': return 'Disabled';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage public storefront products and availability.</p>
        </div>
        <Link 
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Product
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search products..." 
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading products...</td>
                </tr>
              ) : products?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Package className="w-12 h-12 mb-3 opacity-20" />
                      <p>No products found.</p>
                      <Link href="/admin/products/new" className="text-primary mt-2 hover:underline">Create your first product</Link>
                    </div>
                  </td>
                </tr>
              ) : (
                products?.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        {product.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <span className="capitalize">{product.productType.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-foreground">{formatMoney(product.priceInCents)}</span>
                      {product.pricingType === 'deposit' && <span className="text-xs text-muted-foreground ml-1">(Dep)</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", getStatusColor(product.availability))}>
                        {getStatusLabel(product.availability)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/admin/products/${product.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
