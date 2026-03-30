import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSiteSettingsQueryKey } from "@workspace/api-client-react";

interface SiteImageUploaderProps {
  settingKey: string;
  label: string;
  description: string;
  currentUrl: string;
  fallbackUrl: string;
}

export function SiteImageUploader({
  settingKey,
  label,
  description,
  currentUrl,
  fallbackUrl,
}: SiteImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const queryClient = useQueryClient();

  const hasCustomImage = Boolean(currentUrl);
  const displayUrl = currentUrl || fallbackUrl;

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      setError(null);
      try {
        const objectUrl = `/api/storage${response.objectPath}`;
        const res = await fetch(`/api/admin/site-settings/${settingKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: objectUrl }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? "Failed to save image.");
          return;
        }
        queryClient.invalidateQueries({ queryKey: getGetSiteSettingsQueryKey() });
      } catch {
        setError("Failed to save image.");
      }
    },
  });

  const handleClear = async () => {
    setIsClearing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/site-settings/${settingKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to reset image.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: getGetSiteSettingsQueryKey() });
    } catch {
      setError("Failed to reset image.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-foreground text-sm">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="relative group w-full aspect-video rounded-xl overflow-hidden bg-muted border border-border">
        <img
          src={displayUrl}
          alt={label}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackUrl;
          }}
        />
        {hasCustomImage && !isClearing && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-7 h-7 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            title="Reset to default"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {isClearing && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {hasCustomImage && (
          <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            Custom
          </span>
        )}
      </div>

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

      {error && <p className="text-destructive text-xs">{error}</p>}

      <button
        type="button"
        disabled={isUploading || isClearing}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-all w-full justify-center",
          (isUploading || isClearing) && "opacity-60 cursor-not-allowed"
        )}
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {isUploading ? "Uploading…" : "Replace Image"}
      </button>
    </div>
  );
}
