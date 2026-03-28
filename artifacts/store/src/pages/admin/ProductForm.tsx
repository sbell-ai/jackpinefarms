import { useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetProduct, useCreateProduct, useUpdateProduct, getGetProductQueryKey } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description is too long"),
  productType: z.enum(["eggs_chicken", "eggs_duck", "meat_chicken", "meat_turkey"]),
  pricingType: z.enum(["unit", "deposit"]),
  priceInDollars: z.coerce.number().min(0, "Price must be positive"),
  unitLabel: z.string().optional(),
  depositDescription: z.string().optional(),
  availability: z.enum(["taking_orders", "preorder", "sold_out", "disabled"]),
  imageUrl: z.string().optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().default(0),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProductForm() {
  const [match, params] = useRoute("/admin/products/:id/edit");
  const isEditing = !!match;
  const id = isEditing ? parseInt(params!.id, 10) : 0;
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: product, isLoading: isLoadingProduct } = useGetProduct(id, {
    query: { queryKey: getGetProductQueryKey(id), enabled: isEditing }
  });

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, control } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productType: "eggs_chicken",
      pricingType: "unit",
      availability: "taking_orders",
      displayOrder: 0,
    }
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setValue("imageUrl", `/api/storage${response.objectPath}`, { shouldValidate: true });
    },
  });

  useEffect(() => {
    if (isEditing && product) {
      reset({
        name: product.name,
        description: product.description,
        productType: product.productType,
        pricingType: product.pricingType,
        priceInDollars: product.priceInCents / 100,
        unitLabel: product.unitLabel || "",
        depositDescription: product.depositDescription || "",
        availability: product.availability,
        imageUrl: product.imageUrl || "",
        displayOrder: product.displayOrder,
      });
    }
  }, [isEditing, product, reset]);

  const pricingType = watch("pricingType");
  const imageUrl = watch("imageUrl");

  const onSubmit = async (data: FormValues) => {
    const payload = {
      name: data.name,
      description: data.description,
      productType: data.productType,
      pricingType: data.pricingType,
      priceInCents: Math.round(data.priceInDollars * 100),
      unitLabel: data.unitLabel || null,
      depositDescription: data.pricingType === 'deposit' ? (data.depositDescription || null) : null,
      availability: data.availability,
      imageUrl: data.imageUrl || null,
      displayOrder: data.displayOrder,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id, data: payload });
      } else {
        await createMutation.mutateAsync({ data: payload });
      }
      setLocation("/admin/products");
    } catch (err) {
      console.error(err);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingProduct) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/products" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {isEditing ? "Edit Product" : "New Product"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <h2 className="text-xl font-serif font-bold border-b border-border pb-2">Basic Info</h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Product Name</label>
              <input {...register("name")} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Description</label>
              <div className="relative">
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      error={!!errors.description}
                    />
                  )}
                />
              </div>
              {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Product Type</label>
                <select {...register("productType")} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="eggs_chicken">Chicken Eggs</option>
                  <option value="eggs_duck">Duck Eggs</option>
                  <option value="meat_chicken">Meat - Chicken</option>
                  <option value="meat_turkey">Meat - Turkey</option>
                </select>
                {errors.productType && <p className="text-destructive text-sm">{errors.productType.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Availability</label>
                <select {...register("availability")} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                  <option value="taking_orders">Taking Orders (Active)</option>
                  <option value="preorder">Preorder Open</option>
                  <option value="sold_out">Sold Out</option>
                  <option value="disabled">Disabled (Hidden)</option>
                </select>
                {errors.availability && <p className="text-destructive text-sm">{errors.availability.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Product Image</label>

              {imageUrl ? (
                <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-border bg-muted">
                  <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setValue("imageUrl", "", { shouldValidate: true })}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={cn(
                    "w-40 h-40 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all",
                    isUploading && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground text-center px-2">
                    {isUploading ? "Uploading…" : "Click to upload"}
                  </span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await uploadFile(file);
                  e.target.value = "";
                }}
              />

              <input type="hidden" {...register("imageUrl")} />

              <p className="text-xs text-muted-foreground">
                Accepted: JPG, PNG, WebP. iPhone photos will be converted automatically.
              </p>

              <input
                placeholder="Or paste an image URL…"
                value={imageUrl ?? ""}
                onChange={(e) => setValue("imageUrl", e.target.value, { shouldValidate: true })}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
              {errors.imageUrl && <p className="text-destructive text-sm">{errors.imageUrl.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <h2 className="text-xl font-serif font-bold border-b border-border pb-2">Pricing & Fulfillment</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Pricing Type</label>
              <select {...register("pricingType")} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="unit">Fixed Price (Unit)</option>
                <option value="deposit">Deposit (Invoiced Later)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">
                {pricingType === 'deposit' ? 'Deposit Amount ($)' : 'Price ($)'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">$</div>
                <input type="number" step="0.01" {...register("priceInDollars")} className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
              {errors.priceInDollars && <p className="text-destructive text-sm">{errors.priceInDollars.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">Unit Label (Optional)</label>
            <input {...register("unitLabel")} placeholder="e.g. dozen, half-dozen" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            <p className="text-xs text-muted-foreground">Appears after price (e.g. "$6.00 / dozen")</p>
          </div>

          {pricingType === 'deposit' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Deposit Description</label>
              <textarea {...register("depositDescription")} rows={2} placeholder="Explain what the deposit covers..." className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" />
              <p className="text-xs text-muted-foreground">Shown in a special notice box on the product page.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/admin/products" className="px-6 py-3 rounded-xl font-medium text-foreground hover:bg-muted transition-colors">
            Cancel
          </Link>
          <button 
            type="submit" 
            disabled={isPending || isUploading}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isEditing ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
