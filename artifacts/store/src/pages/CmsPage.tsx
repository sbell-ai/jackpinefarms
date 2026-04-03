import { useEffect } from "react";
import { useGetPublicCmsPage } from "@workspace/api-client-react";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  slug: string;
}

function setMeta(name: string, content: string | null | undefined) {
  if (!content) return;
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setOgMeta(property: string, content: string | null | undefined) {
  if (!content) return;
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string | null | undefined) {
  if (!url) return;
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

export default function CmsPage({ slug }: Props) {
  const { data: page, isLoading, isError } = useGetPublicCmsPage(slug);

  useEffect(() => {
    if (!page) return;

    const siteTitle = "Jack Pine Farm";
    const seo = page.seo;

    document.title = seo?.metaTitle
      ? `${seo.metaTitle} | ${siteTitle}`
      : `${page.title} | ${siteTitle}`;

    setMeta("description", seo?.metaDescription);
    setMeta("robots", seo?.robots === "noindex_nofollow" ? "noindex, nofollow" : "index, follow");

    setOgMeta("og:title", seo?.ogTitle ?? page.title);
    setOgMeta("og:description", seo?.ogDescription ?? seo?.metaDescription);
    setOgMeta("og:image", seo?.ogImageUrl);
    setOgMeta("og:type", "article");

    setCanonical(seo?.canonicalUrl);

    return () => {
      document.title = siteTitle;
    };
  }, [page]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground">
          This page does not exist or is not currently available.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-8">
        {page.title}
      </h1>
      <div
        className="prose prose-lg prose-p:text-muted-foreground prose-headings:text-primary prose-headings:font-serif max-w-none"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
    </div>
  );
}
