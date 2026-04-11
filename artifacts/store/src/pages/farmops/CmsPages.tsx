import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { FileText, Plus, Trash2, Edit2, Globe, EyeOff, ArrowLeft, Bold, Italic, List, ListOrdered, Heading2, Heading3, Quote, Undo, Redo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";
import { useLocation } from "wouter";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";
const btnPrimary =
  "px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary =
  "px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors";

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  contentHtml: string;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
}

// ─── Tiptap Toolbar ───────────────────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnCls = (active: boolean) =>
    `p-1.5 rounded text-sm transition-colors ${active ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnCls(editor.isActive("bold"))} title="Bold">
        <Bold className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnCls(editor.isActive("italic"))} title="Italic">
        <Italic className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-slate-200 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnCls(editor.isActive("heading", { level: 2 }))} title="Heading 2">
        <Heading2 className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnCls(editor.isActive("heading", { level: 3 }))} title="Heading 3">
        <Heading3 className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-slate-200 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnCls(editor.isActive("bulletList"))} title="Bullet List">
        <List className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnCls(editor.isActive("orderedList"))} title="Ordered List">
        <ListOrdered className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnCls(editor.isActive("blockquote"))} title="Blockquote">
        <Quote className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-slate-200 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={btnCls(false) + " disabled:opacity-30"} title="Undo">
        <Undo className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={btnCls(false) + " disabled:opacity-30"} title="Redo">
        <Redo className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Page Form (create/edit) ──────────────────────────────────────────────────

function PageForm({
  page,
  onSaved,
  onCancel,
}: {
  page: CmsPage | null;
  onSaved: (p: CmsPage) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: page?.contentHtml ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      const contentHtml = editor?.getHTML() ?? "";
      const url = page ? `/api/farmops/cms/pages/${page.id}` : "/api/farmops/cms/pages";
      const method = page ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: slug.trim(), title: title.trim(), contentHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: page ? "Page updated" : "Page created" });
      onSaved(data as CmsPage);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate slug from title when creating
  useEffect(() => {
    if (!page && title) {
      setSlug(
        title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 100)
      );
    }
  }, [title, page]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Page title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Page" className={inputCls} required />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">URL slug</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">/p/</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="my-page" className={inputCls} required />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Content</label>
        <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
          <EditorToolbar editor={editor} />
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none min-h-[220px] px-4 py-3 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !title.trim() || !slug.trim()} className={btnPrimary}>
          {saving ? "Saving…" : page ? "Save Changes" : "Create Page"}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FarmOpsCmsPages() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  useEffect(() => {
    if (!sessionLoading && !session) setLocation("/farmops/login");
  }, [session, sessionLoading, setLocation]);

  const isAdmin = session?.user?.role === "owner" || session?.user?.role === "admin";

  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<CmsPage | null | "new">(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/farmops/cms/pages", { credentials: "include" });
      if (res.ok) setPages(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPages(); }, []);

  const handlePublishToggle = async (page: CmsPage) => {
    const action = page.status === "published" ? "unpublish" : "publish";
    try {
      const res = await fetch(`/api/farmops/cms/pages/${page.id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json() as CmsPage;
      setPages((prev) => prev.map((p) => (p.id === page.id ? updated : p)));
      toast({ title: action === "publish" ? "Page published" : "Page unpublished" });
    } catch {
      toast({ title: "Error", description: "Could not update status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/farmops/cms/pages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      setPages((prev) => prev.filter((p) => p.id !== id));
      setDeletingId(null);
      toast({ title: "Page deleted" });
    } catch {
      toast({ title: "Error", description: "Could not delete page", variant: "destructive" });
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Pages
          </h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage your storefront pages.</p>
        </div>
        {isAdmin && editingPage === null && (
          <button onClick={() => setEditingPage("new")} className={btnPrimary + " flex items-center gap-2"}>
            <Plus className="w-4 h-4" />
            New Page
          </button>
        )}
      </div>

      {/* Create/Edit form */}
      {editingPage !== null && isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            {editingPage !== "new" && (
              <button onClick={() => setEditingPage(null)} className="text-slate-400 hover:text-slate-600">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-slate-900">
              {editingPage === "new" ? "New Page" : `Edit: ${editingPage.title}`}
            </h2>
          </div>
          <PageForm
            page={editingPage === "new" ? null : editingPage}
            onSaved={(saved) => {
              setPages((prev) => {
                const idx = prev.findIndex((p) => p.id === saved.id);
                return idx >= 0 ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
              });
              setEditingPage(null);
            }}
            onCancel={() => setEditingPage(null)}
          />
        </div>
      )}

      {/* Pages list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No pages yet.{isAdmin ? " Create your first page above." : ""}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Title</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Slug</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Updated</th>
                {isAdmin && <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{page.title}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">/p/{page.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      page.status === "published"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {page.status === "published" ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {page.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePublishToggle(page)}
                          className="text-xs text-slate-500 hover:text-emerald-700 transition-colors"
                          title={page.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {page.status === "published" ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingPage(page)}
                          className="text-xs text-slate-500 hover:text-emerald-700 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deletingId === page.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => handleDelete(page.id)} className="text-xs text-red-600 font-medium hover:text-red-800">Yes</button>
                            <span className="text-slate-300">/</span>
                            <button onClick={() => setDeletingId(null)} className="text-xs text-slate-500">No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeletingId(page.id)}
                            className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
