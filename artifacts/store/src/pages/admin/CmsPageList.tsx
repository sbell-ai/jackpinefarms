import { Link } from "wouter";
import { Plus, FileText, Loader2 } from "lucide-react";
import { useAdminListCmsPages, getAdminListCmsPagesQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function CmsPageList() {
  const { data: pages, isLoading, isError } = useAdminListCmsPages({
    query: { queryKey: getAdminListCmsPagesQueryKey() },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CMS Pages</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your website content pages</p>
        </div>
        <Link href="/admin/pages/new">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            New Page
          </button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load pages. Please refresh.
        </div>
      )}

      {pages && pages.length === 0 && (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No pages yet. Create your first page.</p>
        </div>
      )}

      {pages && pages.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/pages/${page.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {page.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">
                    /{page.slug}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={page.status === "published" ? "default" : "secondary"}>
                      {page.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
