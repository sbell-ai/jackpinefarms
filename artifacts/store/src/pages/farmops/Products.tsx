import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Upload,
  Image as ImageIcon,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";

// ─── Constants ─────────────────────────────────────────────────────────────────

const inputCls =
  "px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

const AVAILABILITY_OPTIONS = [
  { value: "taking_orders", label: "Taking Orders" },
  { value: "preorder", label: "Pre-order" },
  { value: "sold_out", label: "Sold Out" },
  { value: "disabled", label: "Disabled" },
];

const PRODUCT_TYPE_OPTIONS = [
  { value: "eggs_chicken", label: "Chicken Eggs" },
  { value: "eggs_duck", label: "Duck Eggs" },
  { value: "meat_chicken", label: "Chicken Meat" },
  { value: "meat_turkey", label: "Turkey Meat" },
];

const AVAILABILITY_COLORS: Record<string, string> = {
  taking_orders: "bg-green-100 text-green-800",
  preorder: "bg-blue-100 text-blue-800",
  sold_out: "bg-red-100 text-red-800",
  disabled: "bg-slate-100 text-slate-500",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProductImage {
  id: number;
  productId: number;
  objectKey: string;
  url: string;
  sortOrder: number;
  altText: string | null;
}

interface Product {
  id: number;
  name: string;
  productType: string;
  pricingType: string;
  priceInCents: number;
  unitLabel: string | null;
  isOnSale: boolean;
  salePriceCents: number | null;
  availability: string;
  displayOrder: number;
  imageCount: number;
  createdAt: string;
}

interface ProductDetail extends Product {
  description: string;
  depositDescription: string | null;
}

interface ProductForm {
  name: string;
  description: string;
  productType: string;
  pricingType: string;
  priceInCents: string;
  unitLabel: string;
  depositDescription: string;
  isOnSale: boolean;
  salePriceCents: string;
  availability: string;
  displayOrder: string;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  productType: "meat_chicken",
  pricingType: "unit",
  priceInCents: "",
  unitLabel: "",
  depositDescription: "",
  isOnSale: false,
  salePriceCents: "",
  availability: "taking_orders",
  displayOrder: "0",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formToApi(f: ProductForm) {
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    productType: f.productType,
    pricingType: f.pricingType,
    priceInCents: Math.round(parseFloat(f.priceInCents) * 100),
    unitLabel: f.unitLabel.trim() || null,
    depositDescription: f.pricingType === "deposit" ? (f.depositDescription.trim() || null) : null,
    isOnSale: f.isOnSale,
    salePriceCents: f.isOnSale && f.salePriceCents
      ? Math.round(parseFloat(f.salePriceCents) * 100)
      : null,
    availability: f.availability,
    displayOrder: parseInt(f.displayOrder) || 0,
  };
}

// ─── Image Upload Section ──────────────────────────────────────────────────────

function ProductImageSection({
  productId,
  isAdmin,
}: {
  productId: number;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: images = [], isLoading } = useQuery<ProductImage[]>({
    queryKey: ["farmops-product-images", productId],
    queryFn: async () => {
      const res = await fetch(`/api/farmops/products/${productId}/images`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load images");
      return res.json();
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      // Step 1: Get presigned upload URL
      const urlRes = await fetch("/api/farmops/storage/request-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload directly to GCS
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      // Step 3: Register image with API
      const regRes = await fetch(`/api/farmops/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath, contentType: file.type }),
      });
      if (!regRes.ok) {
        const err = await regRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save image");
      }

      queryClient.invalidateQueries({ queryKey: ["farmops-product-images", productId] });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    setDeletingId(imageId);
    try {
      await fetch(`/api/farmops/products/${productId}/images/${imageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["farmops-product-images", productId] });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading images…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          Images <span className="font-normal text-slate-400">({images.length}/5)</span>
        </p>
        {isAdmin && images.length < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Uploading…" : "Add Image"}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await handleUpload(file);
          e.target.value = "";
        }}
      />

      {uploadError && (
        <p className="text-red-600 text-xs">{uploadError}</p>
      )}

      {images.length === 0 ? (
        <div
          onClick={() => isAdmin && !uploading && fileInputRef.current?.click()}
          className={`w-full h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5 text-slate-400 text-sm ${isAdmin ? "cursor-pointer hover:border-emerald-400 hover:text-emerald-500 transition-colors" : ""}`}
        >
          <ImageIcon className="w-5 h-5" />
          {isAdmin ? "Click to upload the first image" : "No images yet"}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {images.map((img, idx) => (
            <div key={img.id} className="relative group w-24 h-24">
              <img
                src={img.url}
                alt={img.altText ?? "Product image"}
                className="w-full h-full object-cover rounded-xl border border-slate-200 bg-slate-50"
              />
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                  Main
                </span>
              )}
              {isAdmin && (
                <button
                  type="button"
                  disabled={deletingId === img.id}
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {deletingId === img.id ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <X className="w-2.5 h-2.5" />
                  )}
                </button>
              )}
            </div>
          ))}
          {uploading && (
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-slate-400">JPG, PNG, WebP. Max 10 MB. First image shown on storefront.</p>
    </div>
  );
}

// ─── Product Form ──────────────────────────────────────────────────────────────

function ProductFormPanel({
  initial,
  productId,
  onSave,
  onCancel,
  onDelete,
  isAdmin,
  saving,
  error,
}: {
  initial: ProductForm;
  productId: number | null;
  onSave: (form: ProductForm) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isAdmin: boolean;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<ProductForm>(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const set = (k: keyof ProductForm, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name *</label>
        <input
          className={`${inputCls} w-full`}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          placeholder="e.g. Whole Chicken"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
        <textarea
          className={`${inputCls} w-full resize-none`}
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Product description for customers"
        />
      </div>

      {/* Type + Pricing Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Product Type *</label>
          <select className={`${inputCls} w-full`} value={form.productType} onChange={(e) => set("productType", e.target.value)}>
            {PRODUCT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Pricing Type *</label>
          <select className={`${inputCls} w-full`} value={form.pricingType} onChange={(e) => set("pricingType", e.target.value)}>
            <option value="unit">Unit (fixed price)</option>
            <option value="deposit">Deposit (weight-based)</option>
          </select>
        </div>
      </div>

      {/* Price + Unit Label */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {form.pricingType === "deposit" ? "Deposit Amount ($) *" : "Price ($) *"}
          </label>
          <input
            className={`${inputCls} w-full`}
            type="number"
            min="0.01"
            step="0.01"
            value={form.priceInCents}
            onChange={(e) => set("priceInCents", e.target.value)}
            required
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Label</label>
          <input
            className={`${inputCls} w-full`}
            value={form.unitLabel}
            onChange={(e) => set("unitLabel", e.target.value)}
            placeholder="e.g. lb, dozen, each"
          />
        </div>
      </div>

      {/* Deposit Description */}
      {form.pricingType === "deposit" && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Deposit Description</label>
          <textarea
            className={`${inputCls} w-full resize-none`}
            rows={2}
            value={form.depositDescription}
            onChange={(e) => set("depositDescription", e.target.value)}
            placeholder="Explain what the deposit covers"
          />
        </div>
      )}

      {/* On Sale */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isOnSale}
            onChange={(e) => set("isOnSale", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-700">On Sale</span>
        </label>
        {form.isOnSale && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sale Price ($) *</label>
            <input
              className={`${inputCls}`}
              type="number"
              min="0.01"
              step="0.01"
              value={form.salePriceCents}
              onChange={(e) => set("salePriceCents", e.target.value)}
              required={form.isOnSale}
              placeholder="0.00"
            />
          </div>
        )}
      </div>

      {/* Availability + Display Order */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Availability *</label>
          <select className={`${inputCls} w-full`} value={form.availability} onChange={(e) => set("availability", e.target.value)}>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Display Order</label>
          <input
            className={`${inputCls} w-full`}
            type="number"
            step="1"
            value={form.displayOrder}
            onChange={(e) => set("displayOrder", e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !isAdmin}
            className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : productId ? "Save Changes" : "Create Product"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
        {productId && onDelete && isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>

      {/* Image management — edit mode only */}
      {productId && (
        <div className="pt-4 border-t border-slate-100">
          <ProductImageSection productId={productId} isAdmin={isAdmin} />
        </div>
      )}
    </form>
  );
}

// ─── Product Detail View ───────────────────────────────────────────────────────

function ProductDetailView({
  productId,
  isAdmin,
  onBack,
  onSaved,
}: {
  productId: number;
  isAdmin: boolean;
  onBack: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: product, isLoading } = useQuery<ProductDetail>({
    queryKey: ["farmops-product-detail", productId],
    queryFn: async () => {
      const res = await fetch(`/api/farmops/products/${productId}/images`, { credentials: "include" });
      // Use the list endpoint to get current product; fetch product from the list
      // Actually we need product details — fetch from PATCH which returns full record.
      // Use GET /farmops/products with a filter isn't available, so we use the products list
      // and find the product, or rely on the state passed in.
      // For simplicity: rely on the parent component passing initial form data
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: false, // images handled separately by ProductImageSection
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["farmops-products"],
  });

  const found = allProducts?.find((p) => p.id === productId);

  const formFromProduct = (p: Product & { description?: string; depositDescription?: string | null }): ProductForm => ({
    name: p.name,
    description: p.description ?? "",
    productType: p.productType,
    pricingType: p.pricingType,
    priceInCents: (p.priceInCents / 100).toFixed(2),
    unitLabel: p.unitLabel ?? "",
    depositDescription: p.depositDescription ?? "",
    isOnSale: p.isOnSale,
    salePriceCents: p.salePriceCents ? (p.salePriceCents / 100).toFixed(2) : "",
    availability: p.availability,
    displayOrder: String(p.displayOrder),
  });

  const handleSave = async (form: ProductForm) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/farmops/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formToApi(form)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-products"] });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/farmops/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to delete");
      }
      queryClient.invalidateQueries({ queryKey: ["farmops-products"] });
      onBack();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (!found) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to products
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-5">{found.name}</h2>

        {confirmDelete && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between gap-4">
            <p className="text-sm text-red-700 font-medium">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ProductFormPanel
          initial={formFromProduct(found as Product & { description?: string; depositDescription?: string | null })}
          productId={productId}
          onSave={handleSave}
          onCancel={onBack}
          onDelete={() => setConfirmDelete(true)}
          isAdmin={isAdmin}
          saving={saving}
          error={error}
        />
      </div>
    </div>
  );
}

// ─── Products List ─────────────────────────────────────────────────────────────

function ProductsListView({
  isAdmin,
  onSelect,
}: {
  isAdmin: boolean;
  onSelect: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProductId, setNewProductId] = useState<number | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["farmops-products"],
    queryFn: async () => {
      const res = await fetch("/api/farmops/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const handleCreate = async (form: ProductForm) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/farmops/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formToApi(form)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create");
      }
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: ["farmops-products"] });
      setShowForm(false);
      onSelect(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your storefront product catalog</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Product"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-5">New Product</h2>
          <ProductFormPanel
            initial={emptyForm}
            productId={null}
            onSave={handleCreate}
            onCancel={() => { setShowForm(false); setError(null); }}
            isAdmin={isAdmin}
            saving={saving}
            error={error}
          />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No products yet.</p>
            {isAdmin && (
              <p className="text-sm text-slate-400 mt-1">
                Click "Add Product" to create your first product.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Availability</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Images</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{p.pricingType === "deposit" ? "Deposit" : "Fixed price"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {PRODUCT_TYPE_OPTIONS.find((o) => o.value === p.productType)?.label ?? p.productType}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(p.priceInCents)}
                      {p.unitLabel && <span className="font-normal text-slate-400 ml-1">/{p.unitLabel}</span>}
                      {p.isOnSale && p.salePriceCents && (
                        <div className="text-xs text-red-600 font-bold">
                          Sale: {formatMoney(p.salePriceCents)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${AVAILABILITY_COLORS[p.availability] ?? "bg-slate-100 text-slate-500"}`}>
                        {AVAILABILITY_OPTIONS.find((o) => o.value === p.availability)?.label ?? p.availability}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {p.imageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
              {products.length} product{products.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Root ─────────────────────────────────────────────────────────────────

export default function FarmOpsProducts() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      setLocation("/farmops/login");
    }
  }, [session, sessionLoading, setLocation]);

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const isAdmin = session.user.role === "owner" || session.user.role === "admin";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {selectedProductId !== null ? (
        <ProductDetailView
          productId={selectedProductId}
          isAdmin={isAdmin}
          onBack={() => setSelectedProductId(null)}
          onSaved={() => setSelectedProductId(null)}
        />
      ) : (
        <ProductsListView isAdmin={isAdmin} onSelect={setSelectedProductId} />
      )}
    </div>
  );
}
