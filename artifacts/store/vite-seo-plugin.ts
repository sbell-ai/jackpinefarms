import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const { Pool } = _require("pg") as typeof import("pg");

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

interface CmsPageRow {
  slug: string;
  title: string;
  updated_at: Date | string;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  robots: string | null;
}

interface ProductRow {
  id: number;
  name: string;
  updated_at: Date | string;
  description: string | null;
}

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMetaTags(opts: {
  title: string;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  canonical?: string;
  robots?: string | null;
  siteUrl: string;
}): string {
  const lines: string[] = [];
  const title = escape(opts.title);
  const robots = opts.robots === "noindex_nofollow" ? "noindex, nofollow" : "index, follow";

  lines.push(`  <title>${title}</title>`);
  lines.push(`  <meta name="robots" content="${robots}" />`);
  if (opts.canonical) {
    lines.push(`  <link rel="canonical" href="${escape(opts.canonical)}" />`);
  }
  if (opts.description) {
    lines.push(`  <meta name="description" content="${escape(opts.description)}" />`);
  }
  lines.push(`  <meta property="og:title" content="${escape(opts.ogTitle ?? opts.title)}" />`);
  if (opts.ogDescription ?? opts.description) {
    lines.push(`  <meta property="og:description" content="${escape((opts.ogDescription ?? opts.description)!)}" />`);
  }
  if (opts.ogImage) {
    lines.push(`  <meta property="og:image" content="${escape(opts.ogImage)}" />`);
  }
  lines.push(`  <meta property="og:type" content="website" />`);
  return lines.join("\n");
}

function injectMeta(html: string, meta: string): string {
  const oldTitle = html.match(/<title>[^<]*<\/title>/)?.[0] ?? "";
  let result = html;
  if (oldTitle) result = result.replace(oldTitle, "");
  return result.replace("</head>", `${meta}\n</head>`);
}

async function handleSitemap(req: IncomingMessage, res: ServerResponse, siteUrl: string) {
  const [pagesResult, productsResult] = await Promise.all([
    pool.query<CmsPageRow>(`
      SELECT p.slug, p.title, p.updated_at,
             s.meta_title, s.meta_description, s.og_title, s.og_description, s.og_image_url, s.robots
      FROM cms_pages p
      LEFT JOIN cms_page_seo s ON s.page_id = p.id
      WHERE p.status = 'published' AND (s.robots IS NULL OR s.robots != 'noindex_nofollow')
      ORDER BY p.updated_at DESC
    `),
    pool.query<ProductRow>(`
      SELECT id, name, updated_at FROM products WHERE availability != 'disabled' ORDER BY id
    `),
  ]);

  const coreRoutes = ["/", "/shop", "/how-we-raise-them", "/pickup-events", "/policies/sales-returns"];
  const urlSet: string[] = [];

  for (const route of coreRoutes) {
    urlSet.push(`  <url><loc>${siteUrl}${route}</loc></url>`);
  }

  const aliasedSlugs = new Set(["about", "faq", "contact"]);
  for (const page of pagesResult.rows) {
    const loc = `${siteUrl}/p/${page.slug}`;
    const lastmod = page.updated_at ? new Date(page.updated_at).toISOString().slice(0, 10) : "";
    urlSet.push(`  <url><loc>${escape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`);
    if (aliasedSlugs.has(page.slug)) {
      urlSet.push(`  <url><loc>${siteUrl}/${page.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`);
    }
  }

  for (const product of productsResult.rows) {
    const loc = `${siteUrl}/shop/${product.id}`;
    const lastmod = product.updated_at ? new Date(product.updated_at).toISOString().slice(0, 10) : "";
    urlSet.push(`  <url><loc>${escape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlSet.join("\n")}
</urlset>`;

  res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
  res.end(xml);
}

async function buildPageMeta(slug: string, siteUrl: string): Promise<string | null> {
  const result = await pool.query<CmsPageRow>(`
    SELECT p.slug, p.title, p.updated_at,
           s.meta_title, s.meta_description, s.og_title, s.og_description, s.og_image_url, s.robots
    FROM cms_pages p
    LEFT JOIN cms_page_seo s ON s.page_id = p.id
    WHERE p.slug = $1 AND p.status = 'published'
  `, [slug]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return buildMetaTags({
    title: row.meta_title ?? row.title,
    description: row.meta_description,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImage: row.og_image_url,
    canonical: `${siteUrl}/p/${row.slug}`,
    robots: row.robots,
    siteUrl,
  });
}

async function buildProductMeta(id: string, siteUrl: string): Promise<string | null> {
  const result = await pool.query<ProductRow>(`
    SELECT id, name, description FROM products WHERE id = $1 AND availability != 'disabled'
  `, [id]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return buildMetaTags({
    title: `${row.name} — Jack Pine Farm`,
    description: row.description,
    canonical: `${siteUrl}/shop/${row.id}`,
    siteUrl,
  });
}

export function seoPlugin(): Plugin {
  return {
    name: "vite-seo-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        const host = req.headers.host ?? "localhost";
        const proto = req.headers["x-forwarded-proto"] ?? "https";
        const siteUrl = `${proto}://${host}`;

        if (url === "/sitemap.xml" || url.startsWith("/sitemap.xml?")) {
          try {
            await handleSitemap(req, res, siteUrl);
          } catch (err) {
            console.error("[seo-plugin] sitemap error:", err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("sitemap error");
          }
          return;
        }

        const cmsSlugRoutes: Record<string, string> = {
          "/about": "about",
          "/faq": "faq",
          "/contact": "contact",
        };

        const cmsMatch = url.match(/^\/p\/([a-z0-9-]+)$/);
        const productMatch = url.match(/^\/shop\/(\d+)$/);
        const aliasSlug = cmsSlugRoutes[url];

        const isHtmlRequest =
          !url.includes(".") &&
          (req.headers.accept?.includes("text/html") ?? false);

        if (!isHtmlRequest) {
          next();
          return;
        }

        let slug: string | null = null;
        let productId: string | null = null;

        if (cmsMatch) slug = cmsMatch[1]!;
        else if (aliasSlug) slug = aliasSlug;
        else if (productMatch) productId = productMatch[1]!;

        if (!slug && !productId) {
          next();
          return;
        }

        try {
          const { readFileSync } = await import("fs");
          const { resolve } = await import("path");
          const indexPath = resolve(server.config.root, "index.html");
          let html = readFileSync(indexPath, "utf-8");

          let meta: string | null = null;
          if (slug) meta = await buildPageMeta(slug, siteUrl);
          else if (productId) meta = await buildProductMeta(productId, siteUrl);

          if (meta) html = injectMeta(html, meta);

          html = await server.transformIndexHtml(req.url ?? "/", html);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
          return;
        } catch (err) {
          console.error("[seo-plugin] meta injection error:", err);
        }

        next();
      });
    },
  };
}
