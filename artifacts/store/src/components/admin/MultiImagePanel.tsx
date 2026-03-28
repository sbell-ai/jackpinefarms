import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Loader2, Upload, X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@workspace/api-client-react";

interface MultiImagePanelProps {
  productId: number;
  images: ProductImage[];
  onImagesChange: () => void;
}

export function MultiImagePanel({ productId, images, onImagesChange }: MultiImagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canAddMore = images.length < 5;

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      setUploadError(null);
      try {
        const res = await fetch(`/api/admin/products/${productId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectPath: response.objectPath,
            contentType: response.metadata?.contentType,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setUploadError((body as { error?: string }).error ?? "Failed to save image.");
          return;
        }
        onImagesChange();
      } catch {
        setUploadError("Failed to save image.");
      }
    },
  });

  const handleDelete = async (imageId: number) => {
    setDeletingId(imageId);
    try {
      await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
        method: "DELETE",
      });
      onImagesChange();
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newImages = [...images];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newImages.length) return;
    [newImages[index], newImages[swapIndex]] = [newImages[swapIndex], newImages[index]];
    setIsReordering(true);
    try {
      await fetch(`/api/admin/products/${productId}/images/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: newImages.map((img) => img.id) }),
      });
      onImagesChange();
    } catch {
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-foreground">
          Product Images
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({images.length}/5)
          </span>
        </label>
        {canAddMore && (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-all",
              isUploading && "opacity-60 cursor-not-allowed"
            )}
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {isUploading ? "Uploading…" : "Add Image"}
          </button>
        )}
      </div>

      {!canAddMore && (
        <p className="text-xs text-amber-600 font-medium">
          Maximum of 5 images reached. Remove one to add another.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await uploadFile(file);
          e.target.value = "";
        }}
      />

      {uploadError && (
        <p className="text-destructive text-sm">{uploadError}</p>
      )}

      {images.length === 0 ? (
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all",
            isUploading && "opacity-60 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          ) : (
            <Upload className="w-6 h-6 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {isUploading ? "Uploading…" : "Click to upload the first image"}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {images.map((img, index) => (
            <div key={img.id} className="relative group w-32 h-32">
              <img
                src={img.url}
                alt={img.altText ?? "Product image"}
                className="w-full h-full object-cover rounded-xl border border-border bg-muted"
              />
              {index === 0 && (
                <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                  Main
                </span>
              )}
              <div className="absolute inset-0 flex items-start justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  disabled={deletingId === img.id}
                  onClick={() => handleDelete(img.id)}
                  className="w-6 h-6 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors"
                  title="Remove image"
                >
                  {deletingId === img.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="absolute bottom-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                  <button
                    type="button"
                    disabled={isReordering}
                    onClick={() => handleMove(index, "up")}
                    className="w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded flex items-center justify-center transition-colors"
                    title="Move left"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
                {index < images.length - 1 && (
                  <button
                    type="button"
                    disabled={isReordering}
                    onClick={() => handleMove(index, "down")}
                    className="w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded flex items-center justify-center transition-colors"
                    title="Move right"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {isUploading && (
            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Up to 5 images. JPG, PNG, WebP accepted. The first image is shown as the main product image.
      </p>
    </div>
  );
}
