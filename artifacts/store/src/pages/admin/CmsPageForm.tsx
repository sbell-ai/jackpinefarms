import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Loader2, ArrowLeft, CircleCheck, Eye, EyeOff, Bold, Italic, List, ListOrdered, Heading2, Undo, Redo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminGetCmsPage, getAdminGetCmsPageQueryKey,
  useAdminCreateCmsPage,
  useAdminUpdateCmsPage,
  useAdminPublishCmsPage,
  useAdminUnpublishCmsPage,
  useAdminGetCmsPageSeo, getAdminGetCmsPageSeoQueryKey,
  useAdminUpdateCmsPageSeo,
} from "@workspace/api-client-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const pageSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().min(1, "Slug is required").max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only"),
});

const seoSchema = z.object({
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  canonicalUrl: z.string().max(500).optional(),
  ogTitle: z.string().max(200).optional(),
  ogDescription: z.string().max(500).optional(),
  ogImageUrl: z.string().max(500).optional(),
  robots: z.enum(["index_follow", "noindex_nofollow"]).default("index_follow"),
});

type PageValues = z.infer<typeof pageSchema>;
type SeoValues = z.infer<typeof seoSchema>;

interface Props {
  pageId?: number;
}

export default function CmsPageForm({ pageId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = pageId != null;

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [contentHtml, setContentHtml] = useState("");

  const { data: page, isLoading: pageLoading } = useAdminGetCmsPage(
    pageId ?? 0,
    { query: { queryKey: getAdminGetCmsPageQueryKey(pageId ?? 0), enabled: isEdit } }
  );

  const { data: seoData } = useAdminGetCmsPageSeo(
    pageId ?? 0,
    { query: { queryKey: getAdminGetCmsPageSeoQueryKey(pageId ?? 0), enabled: isEdit } }
  );

  const pageForm = useForm<PageValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: { title: "", slug: "" },
  });

  const seoForm = useForm<SeoValues>({
    resolver: zodResolver(seoSchema),
    defaultValues: { robots: "index_follow" },
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor }) => setContentHtml(editor.getHTML()),
  });

  useEffect(() => {
    if (page) {
      pageForm.reset({ title: page.title, slug: page.slug });
      setSlugManuallyEdited(true);
      if (editor && page.contentHtml && editor.getHTML() !== page.contentHtml) {
        editor.commands.setContent(page.contentHtml);
        setContentHtml(page.contentHtml);
      }
    }
  }, [page, editor]);

  useEffect(() => {
    if (seoData) {
      seoForm.reset({
        metaTitle: seoData.metaTitle ?? "",
        metaDescription: seoData.metaDescription ?? "",
        canonicalUrl: seoData.canonicalUrl ?? "",
        ogTitle: seoData.ogTitle ?? "",
        ogDescription: seoData.ogDescription ?? "",
        ogImageUrl: seoData.ogImageUrl ?? "",
        robots: (seoData.robots as "index_follow" | "noindex_nofollow") ?? "index_follow",
      });
    }
  }, [seoData]);

  const createPage = useAdminCreateCmsPage({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Page created" });
        setLocation(`/admin/pages/${data.id}`);
      },
      onError: () => toast({ title: "Failed to create page", variant: "destructive" }),
    },
  });

  const updatePage = useAdminUpdateCmsPage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Page saved" });
        qc.invalidateQueries({ queryKey: getAdminGetCmsPageQueryKey(pageId ?? 0) });
      },
      onError: () => toast({ title: "Failed to save page", variant: "destructive" }),
    },
  });

  const updateSeo = useAdminUpdateCmsPageSeo({
    mutation: {
      onSuccess: () => {
        toast({ title: "SEO settings saved" });
        qc.invalidateQueries({ queryKey: getAdminGetCmsPageSeoQueryKey(pageId ?? 0) });
      },
      onError: () => toast({ title: "Failed to save SEO", variant: "destructive" }),
    },
  });

  const publishPage = useAdminPublishCmsPage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Page published" });
        qc.invalidateQueries({ queryKey: getAdminGetCmsPageQueryKey(pageId ?? 0) });
        setConfirmPublish(false);
      },
      onError: () => { toast({ title: "Failed to publish", variant: "destructive" }); setConfirmPublish(false); },
    },
  });

  const unpublishPage = useAdminUnpublishCmsPage({
    mutation: {
      onSuccess: () => {
        toast({ title: "Page unpublished" });
        qc.invalidateQueries({ queryKey: getAdminGetCmsPageQueryKey(pageId ?? 0) });
        setConfirmUnpublish(false);
      },
      onError: () => { toast({ title: "Failed to unpublish", variant: "destructive" }); setConfirmUnpublish(false); },
    },
  });

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    pageForm.setValue("title", e.target.value);
    if (!slugManuallyEdited) {
      pageForm.setValue("slug", slugify(e.target.value), { shouldValidate: true });
    }
  }, [slugManuallyEdited, pageForm]);

  const onSubmitPage = pageForm.handleSubmit((values) => {
    if (isEdit && pageId != null) {
      updatePage.mutate({ id: pageId, data: { ...values, contentHtml } });
    } else {
      createPage.mutate({ data: { ...values, contentHtml } });
    }
  });

  const onSubmitSeo = seoForm.handleSubmit((values) => {
    if (pageId == null) return;
    updateSeo.mutate({
      id: pageId,
      data: {
        metaTitle: values.metaTitle || null,
        metaDescription: values.metaDescription || null,
        canonicalUrl: values.canonicalUrl || null,
        ogTitle: values.ogTitle || null,
        ogDescription: values.ogDescription || null,
        ogImageUrl: values.ogImageUrl || null,
        robots: values.robots,
      },
    });
  });

  if (isEdit && pageLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSaving = createPage.isPending || updatePage.isPending;
  const status = page?.status ?? "draft";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/pages" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? "Edit Page" : "New Page"}</h1>
          {isEdit && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={status === "published" ? "default" : "secondary"}>{status}</Badge>
              {page?.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  Published {new Date(page.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>
        {isEdit && (
          <div className="ml-auto flex items-center gap-2">
            {status === "draft" ? (
              <button
                onClick={() => setConfirmPublish(true)}
                disabled={publishPage.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                Publish
              </button>
            ) : (
              <button
                onClick={() => setConfirmUnpublish(true)}
                disabled={unpublishPage.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <EyeOff className="w-4 h-4" />
                Unpublish
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={onSubmitPage} className="space-y-5 bg-card border border-border rounded-xl p-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
          <input
            {...pageForm.register("title")}
            onChange={handleTitleChange}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Page title"
          />
          {pageForm.formState.errors.title && (
            <p className="text-xs text-destructive mt-1">{pageForm.formState.errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/p/</span>
            <input
              {...pageForm.register("slug")}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                pageForm.setValue("slug", e.target.value, { shouldValidate: true });
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="page-slug"
            />
          </div>
          {pageForm.formState.errors.slug && (
            <p className="text-xs text-destructive mt-1">{pageForm.formState.errors.slug.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Content</label>
          <div className="border border-border rounded-lg overflow-hidden">
            {editor && (
              <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30 flex-wrap">
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded text-sm hover:bg-muted transition-colors ${editor.isActive("bold") ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Bold className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded text-sm hover:bg-muted transition-colors ${editor.isActive("italic") ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Italic className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded text-sm hover:bg-muted transition-colors ${editor.isActive("heading", { level: 2 }) ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Heading2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded text-sm hover:bg-muted transition-colors ${editor.isActive("bulletList") ? "bg-muted text-foreground" : "text-muted-foreground"}`}><List className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded text-sm hover:bg-muted transition-colors ${editor.isActive("orderedList") ? "bg-muted text-foreground" : "text-muted-foreground"}`}><ListOrdered className="w-4 h-4" /></button>
                <div className="w-px h-5 bg-border mx-1" />
                <button type="button" onClick={() => editor.chain().focus().undo().run()} className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30" disabled={!editor.can().undo()}><Undo className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().redo().run()} className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30" disabled={!editor.can().redo()}><Redo className="w-4 h-4" /></button>
              </div>
            )}
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none p-4 min-h-[240px] focus-within:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleCheck className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Create Page"}
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">SEO Settings</h2>
          <Accordion type="single" collapsible defaultValue="seo">
            <AccordionItem value="seo" className="border-none">
              <AccordionTrigger className="text-sm text-muted-foreground py-2 hover:text-foreground">
                Search Engine & Social Media Settings
              </AccordionTrigger>
              <AccordionContent>
                <form onSubmit={onSubmitSeo} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Meta Title</label>
                      <input {...seoForm.register("metaTitle")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="SEO title (defaults to page title)" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Canonical URL</label>
                      <input {...seoForm.register("canonicalUrl")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="https://..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Meta Description</label>
                    <textarea {...seoForm.register("metaDescription")} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Brief page description for search engines (max 500 chars)" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">OG Title</label>
                      <input {...seoForm.register("ogTitle")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Social share title" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">OG Image URL</label>
                      <input {...seoForm.register("ogImageUrl")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="https://..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">OG Description</label>
                    <textarea {...seoForm.register("ogDescription")} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Social share description" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Robots</label>
                    <select {...seoForm.register("robots")} className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="index_follow">Index &amp; Follow (default)</option>
                      <option value="noindex_nofollow">Noindex, Nofollow</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={updateSeo.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {updateSeo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleCheck className="w-4 h-4" />}
                      Save SEO
                    </button>
                  </div>
                </form>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this page?</AlertDialogTitle>
            <AlertDialogDescription>
              The page will be publicly visible at <strong>/p/{page?.slug}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pageId != null && publishPage.mutate({ id: pageId })}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish this page?</AlertDialogTitle>
            <AlertDialogDescription>
              The page will be hidden from the public site and return to draft status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pageId != null && unpublishPage.mutate({ id: pageId })}>
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
