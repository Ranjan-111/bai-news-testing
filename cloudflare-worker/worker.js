/**
 * Cloudflare Worker — Full Edge SSR for bitfeed.in
 * 
 * PURPOSE:
 * 1. ORIGINAL: Inject OG meta tags for social media bots (WhatsApp, LinkedIn, etc.)
 * 2. NEW (Phase 2): Pre-render article content into HTML for ALL visitors,
 *    eliminating FOUC and skeleton flashes. The browser receives a fully
 *    populated page; client-side JS then "hydrates" it (attaches listeners).
 *
 * HOW IT WORKS:
 * 1. ALL requests are proxied through Cloudflare (DNS set up via Cloudflare).
 * 2. For /article?id=xxx → fetch article from Firestore REST API, inject content.
 * 3. For / (homepage) → fetch featured + latest articles, inject into HTML.
 * 4. Responses are cached at the edge (10 min TTL) to minimize Firestore reads.
 * 5. Client-side JS detects pre-rendered content and skips re-fetching.
 *
 * CACHE STRATEGY:
 * - Cache TTL: 10 minutes (fresh enough for 2-5 daily articles)
 * - Cache key: URL pathname + search params
 * - Cache is per-PoP (each Cloudflare edge location has its own cache)
 * - Stale responses are served while revalidating in background
 *
 * SETUP:
 * - Firebase project ID: bai-news-9e4cf
 * - Site domain: bitfeed.in
 * - Firestore collection: articles
 */

// ─── CONFIGURATION ──────────────────────────────────────────────
const FIREBASE_PROJECT_ID = "bai-news-9e4cf";
const SITE_DOMAIN = "https://bitfeed.in";
const CACHE_TTL_SECONDS = 600; // 10 minutes

// Firestore REST API base URL
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ─── BOT DETECTION ──────────────────────────────────────────────
const BOT_USER_AGENTS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot",
  "WhatsApp", "TelegramBot", "Discordbot", "Slackbot", "Googlebot",
  "Pinterest", "SkypeUriPreview", "bot", "crawler", "spider",
  "curl", "wget",
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

// ─── FIRESTORE HELPERS ──────────────────────────────────────────

/**
 * Extracts a simple JS value from a Firestore REST API field value object.
 */
function extractFirestoreValue(field) {
  if (!field) return "";
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.arrayValue) {
    return (field.arrayValue.values || []).map(v => extractFirestoreValue(v));
  }
  if (field.mapValue) {
    const result = {};
    const fields = field.mapValue.fields || {};
    for (const key in fields) {
      result[key] = extractFirestoreValue(fields[key]);
    }
    return result;
  }
  if (field.nullValue !== undefined) return null;
  return "";
}

/**
 * Extracts all fields from a Firestore document into a flat JS object.
 */
function extractDocument(doc) {
  if (!doc || !doc.fields) return null;
  const result = {};
  for (const key in doc.fields) {
    result[key] = extractFirestoreValue(doc.fields[key]);
  }
  // Extract document ID from the name path
  if (doc.name) {
    const parts = doc.name.split("/");
    result.id = parts[parts.length - 1];
  }
  return result;
}

/**
 * Fetches a single article document from Firestore via the REST API.
 */
async function fetchArticleById(articleId) {
  const url = `${FIRESTORE_BASE}/articles/${articleId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return extractDocument(data);
  } catch (err) {
    console.error("Error fetching article:", err);
    return null;
  }
}

/**
 * Runs a Firestore structured query via the REST API.
 * Used for fetching featured articles, latest articles, and related articles.
 */
async function firestoreQuery(structuredQuery) {
  const url = `${FIRESTORE_BASE}:runQuery`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!response.ok) {
      console.error(`Firestore query failed: ${response.status}`);
      return [];
    }
    const results = await response.json();
    return results
      .filter(r => r.document) // Filter out empty results
      .map(r => extractDocument(r.document));
  } catch (err) {
    console.error("Error querying Firestore:", err);
    return [];
  }
}

/**
 * Fetches the 2 featured articles (isFeatured == true, status == active).
 */
async function fetchFeaturedArticles() {
  return firestoreQuery({
    from: [{ collectionId: "articles" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
          { fieldFilter: { field: { fieldPath: "isFeatured" }, op: "EQUAL", value: { booleanValue: true } } },
        ],
      },
    },
    limit: 2,
  });
}

/**
 * Fetches the 5 latest articles (status == active, ordered by datePosted desc).
 */
async function fetchLatestArticles() {
  return firestoreQuery({
    from: [{ collectionId: "articles" }],
    where: {
      fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } },
    },
    orderBy: [{ field: { fieldPath: "datePosted" }, direction: "DESCENDING" }],
    limit: 5,
  });
}

/**
 * Fetches up to 4 related articles by matching the first tag.
 */
async function fetchRelatedArticles(tag) {
  if (!tag) return [];
  return firestoreQuery({
    from: [{ collectionId: "articles" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
          { fieldFilter: { field: { fieldPath: "tags" }, op: "ARRAY_CONTAINS", value: { stringValue: tag } } },
        ],
      },
    },
    limit: 4,
  });
}


// ─── HTML HELPERS ───────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function capitalizeWords(str) {
  if (!str) return "";
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/**
 * Formats a Firestore timestamp string or epoch into a readable date.
 */
function formatDate(dateValue) {
  try {
    let d;
    if (typeof dateValue === "string") {
      d = new Date(dateValue);
    } else if (dateValue && dateValue.seconds) {
      d = new Date(dateValue.seconds * 1000);
    } else {
      d = new Date(dateValue);
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Calculates a human-readable "time ago" string.
 */
function getTimeAgo(dateValue) {
  try {
    let d;
    if (typeof dateValue === "string") {
      d = new Date(dateValue);
    } else if (dateValue && dateValue.seconds) {
      d = new Date(dateValue.seconds * 1000);
    } else {
      d = new Date(dateValue);
    }
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    const hours = seconds / 3600;
    if (hours > 24) return Math.floor(hours / 24) + " days";
    if (hours > 1) return Math.floor(hours) + " hours";
    const mins = seconds / 60;
    if (mins > 1) return Math.floor(mins) + " mins";
    return "Just now";
  } catch {
    return "";
  }
}


// ─── ARTICLE PAGE SSR ───────────────────────────────────────────

/**
 * Injects article data into the article.html page.
 * Replaces skeleton view with real content, meta tags, and structured data.
 */
function injectArticlePage(html, article, relatedArticles) {
  // ── 1. META TAGS (same as original worker) ──
  let absoluteImageUrl = article.imageUrl || "";
  if (absoluteImageUrl && !absoluteImageUrl.startsWith("http")) {
    absoluteImageUrl = `${SITE_DOMAIN}${absoluteImageUrl}`;
  }

  const title = escapeHtml(article.title || "bitfeed — Business & AI Insights");
  const summary = escapeHtml(article.summary || "Read this article on bitfeed — clean, minimal insights.");
  const authorName = escapeHtml(article.authorName || article.authorId || "bitfeed");
  const dateStr = formatDate(article.datePosted);

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(article.title || "bitfeed")} | bitfeed</title>`);

  // Replace meta tags
  html = html.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" id="meta-description-tag" content="${summary}">`);
  html = html.replace(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" id="og-title" content="${title}">`);
  html = html.replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" id="og-description" content="${summary}">`);
  html = html.replace(/<meta\s+property="og:image"\s+id="og-image"[^>]*>/i, `<meta property="og:image" id="og-image" content="${absoluteImageUrl}">`);
  html = html.replace(/<meta\s+property="og:image:alt"[^>]*>/i, `<meta property="og:image:alt" content="${title}">`);
  html = html.replace(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" id="twitter-title" content="${title}">`);
  html = html.replace(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" id="twitter-description" content="${summary}">`);
  html = html.replace(/<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" id="twitter-image" content="${absoluteImageUrl}">`);

  // ── 2. INJECT SSR MARKER ──
  // Client-side JS checks for this to know content is pre-rendered
  html = html.replace("</head>", `<meta name="ssr-rendered" content="true">\n</head>`);

  // ── 3. INJECT ARTICLE CONTENT ──
  // Note: We deliberately leave the skeleton-view visible and the real-view hidden.
  // The client-side JS will handle hiding the skeleton and showing the real-view
  // once the markdown content is fully rendered to avoid empty content flashes.

  // Inject headline
  html = html.replace('<h1 id="news-headline"></h1>', `<h1 id="news-headline">${escapeHtml(capitalizeWords(article.title))}</h1>`);

  // Inject date
  html = html.replace('<p id="news-date" class="date"></p>', `<p id="news-date" class="date">${dateStr}</p>`);

  // Inject author name
  html = html.replace('<span class="author-name" id="author-name"></span>', `<span class="author-name" id="author-name">${authorName}</span>`);

  // Inject image
  if (article.imageUrl) {
    html = html.replace(
      '<img src="" alt="Article Image" id="news-img" loading="lazy">',
      `<img src="${escapeHtml(article.imageUrl)}" alt="${title}" id="news-img" loading="lazy">`
    );
  }

  // Inject author avatar if available
  if (article.authorImage) {
    html = html.replace(
      '<img src="" alt="Author" class="author-avatar" id="author-img" loading="lazy">',
      `<img src="${escapeHtml(article.authorImage)}" alt="${authorName}" class="author-avatar" id="author-img" loading="lazy">`
    );
  }

  // ── 4. INJECT ARTICLE BODY (Markdown content) ──
  // The article content is stored as markdown. We embed it as hidden JSON
  // so client-side JS can render it with the existing markdown-renderer.
  // We do NOT inject visible placeholder text to avoid a summary→content flash.
  const articleContent = article.intermediate || article.concise || article.content || "";
  if (articleContent) {
    // Embed article data as hidden JSON for instant client-side hydration (no Firestore fetch needed)
    html = html.replace(
      '<div id="article-content"></div>',
      `<div id="article-content"></div>\n<script type="application/json" id="ssr-article-data">${JSON.stringify({
        id: article.id,
        title: article.title,
        summary: article.summary,
        imageUrl: article.imageUrl,
        authorName: article.authorName,
        authorId: article.authorId,
        authorImage: article.authorImage,
        authorEmail: article.authorEmail,
        datePosted: article.datePosted,
        tags: article.tags,
        intermediate: article.intermediate,
        concise: article.concise,
        content: article.content,
        stats: article.stats,
        isFeatured: article.isFeatured,
      })}</script>`
    );
  }

  // ── 5. INJECT TAGS ──
  if (article.tags && article.tags.length > 0) {
    const tagsHtml = article.tags.map(tag =>
      `<span style="display:inline-block; padding:4px 12px; background:#f0f0f0; border-radius:16px; font-size:0.8rem; margin:4px;">${escapeHtml(tag)}</span>`
    ).join("");
    html = html.replace('<section class="tags"></section>', `<section class="tags">${tagsHtml}</section>`);
  }

  // ── 6. INJECT RELATED ARTICLES ──
  if (relatedArticles && relatedArticles.length > 0) {
    // Filter out current article and take max 3
    const filtered = relatedArticles.filter(a => a.id !== article.id).slice(0, 3);
    if (filtered.length > 0) {
      // We intentionally do not hide related-skeleton-view or show related-real-view here
      // so the skeleton effect remains while client-side JS loads.

      const relatedHtml = filtered.map(a => {
        let imgUrl = a.imageUrl || "/assets/favicon.png";
        return `<a href="/article?id=${escapeHtml(a.id)}" class="related-card" style="text-decoration:none; color:inherit;">
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(a.title)}" loading="lazy">
          <h3>${escapeHtml(capitalizeWords(a.title || ""))}</h3>
        </a>`;
      }).join("");

      html = html.replace('<div id="related-container" class="related-articles"></div>',
        `<div id="related-container" class="related-articles">${relatedHtml}</div>`);
    }
  }

  return html;
}


// ─── HOMEPAGE SSR ───────────────────────────────────────────────

/**
 * Injects featured + latest articles into the homepage HTML.
 */
function injectHomePage(html, featuredArticles, latestArticles) {
  // ── SSR MARKER ──
  html = html.replace("</head>", `<meta name="ssr-rendered" content="true">\n</head>`);

  // ── 1. FEATURED ARTICLES ──
  if (featuredArticles && featuredArticles.length > 0) {
    // We intentionally do not hide featured-skeleton or show featured-real here
    // so the skeleton effect remains while client-side JS loads.

    // Inject LEFT featured card
    if (featuredArticles[0]) {
      const a = featuredArticles[0];
      const dateStr = formatDate(a.datePosted);
      html = html.replace(
        '<article class="Article LEFT">',
        `<article class="Article LEFT" style="cursor:pointer" onclick="window.location.href='/article?id=${escapeHtml(a.id)}'">`
      );
      // Inject image into LEFT card
      html = html.replace(
        /<figure>\s*<img src="" alt="Featured article image" class="img" loading="lazy">/,
        `<figure><img src="${escapeHtml(a.imageUrl || "")}" alt="${escapeHtml(a.title || "Featured article")}" class="img" loading="lazy">`
      );
      // Inject title, date, summary into LEFT card's info section
      html = html.replace(
        '<section class="info1 info">\n                        <h3></h3>\n                        <p class="date"></p>\n                        <p id="summary"></p>',
        `<section class="info1 info">\n                        <h3>${escapeHtml(capitalizeWords(a.title))}</h3>\n                        <p class="date">${dateStr}</p>\n                        <p id="summary">${escapeHtml(a.summary || "")}</p>`
      );
    }

    // Inject RIGHT featured card
    if (featuredArticles[1]) {
      const a = featuredArticles[1];
      const dateStr = formatDate(a.datePosted);
      html = html.replace(
        '<article class="Article RIGHT">',
        `<article class="Article RIGHT" style="cursor:pointer" onclick="window.location.href='/article?id=${escapeHtml(a.id)}'">`
      );
      // Inject image into RIGHT card
      html = html.replace(
        /<figure>\s*<img src="" alt="Featured article image" class="img img2" loading="lazy">/,
        `<figure><img src="${escapeHtml(a.imageUrl || "")}" alt="${escapeHtml(a.title || "Featured article")}" class="img img2" loading="lazy">`
      );
      html = html.replace(
        '<section class="info2 info">\n                        <h3></h3>\n                        <p class="date"></p>\n                        <p id="summary"></p>',
        `<section class="info2 info">\n                        <h3>${escapeHtml(capitalizeWords(a.title))}</h3>\n                        <p class="date">${dateStr}</p>\n                        <p id="summary">${escapeHtml(a.summary || "")}</p>`
      );
    }
  }

  // ── 2. LATEST ARTICLES ──
  if (latestArticles && latestArticles.length > 0) {
    // We intentionally do not hide latest-skeleton-view or show latest-real-view here
    // so the skeleton effect remains while client-side JS loads.

    const timelineHtml = latestArticles.map(a => {
      const timeAgo = getTimeAgo(a.datePosted);
      const dateString = formatDate(a.datePosted);
      return `<section class="timeline-item">
        <section class="time">${timeAgo}</section>
        <section class="news-card">
          <a href="/article?id=${escapeHtml(a.id)}" style="text-decoration:none; color:inherit;">
            <h3>${escapeHtml(capitalizeWords(a.title))}</h3>
          </a>
          <section class="details">
            <p><em>Reported: ${dateString}</em></p>
            <p><em>${escapeHtml(a.summary || "")}</em></p>
          </section>
        </section>
      </section>`;
    }).join("\n");

    html = html.replace(
      '<article id="latest-news-container" class="timeline">\n                </article>',
      `<article id="latest-news-container" class="timeline">\n${timelineHtml}\n                </article>`
    );
  }

  return html;
}


// ─── CACHE HELPERS ──────────────────────────────────────────────

/**
 * Creates a cache key from the request URL.
 * We strip user-specific headers so all visitors share the same cached response.
 */
function getCacheKey(url) {
  return new Request(url.toString(), { method: "GET" });
}


// ─── MAIN WORKER HANDLER ────────────────────────────────────────

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cache = caches.default;

    // ═══════════════════════════════════════════════════════
    // ROUTE: /article?id=xxx  — Article Page SSR
    // ═══════════════════════════════════════════════════════
    if (url.pathname === "/article") {
      const articleId = url.searchParams.get("id");

      // No article ID → pass through
      if (!articleId) {
        return fetch(request);
      }

      // ── Check edge cache first ──
      const cacheKey = getCacheKey(url);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        console.log(`Cache HIT for article: ${articleId}`);
        return cachedResponse;
      }

      console.log(`Cache MISS for article: ${articleId} — fetching from Firestore`);

      // ── Fetch article data + origin HTML in parallel ──
      const [article, originResponse] = await Promise.all([
        fetchArticleById(articleId),
        fetch(request),
      ]);

      // If article not found in Firestore, pass through the origin response
      if (!article) {
        return originResponse;
      }

      // Fetch related articles (non-blocking, don't fail if this errors)
      let relatedArticles = [];
      try {
        const firstTag = article.tags && article.tags.length > 0 ? article.tags[0] : null;
        if (firstTag) {
          relatedArticles = await fetchRelatedArticles(firstTag);
        }
      } catch (e) {
        console.error("Related articles fetch failed:", e);
      }

      // ── Inject content into HTML ──
      let html = await originResponse.text();
      html = injectArticlePage(html, article, relatedArticles);

      // ── Build response with cache headers ──
      const response = new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
          "X-SSR": "cloudflare-worker",
        },
      });

      // ── Store in edge cache (non-blocking) ──
      // Using waitUntil would be ideal but we don't have the event context here.
      // cache.put runs async and doesn't block the response.
      cache.put(cacheKey, response.clone());

      return response;
    }

    // ═══════════════════════════════════════════════════════
    // ROUTE: / or /home  — Homepage SSR
    // ═══════════════════════════════════════════════════════
    if (url.pathname === "/" || url.pathname === "/home") {
      // ── Check edge cache ──
      const cacheKey = getCacheKey(url);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        console.log("Cache HIT for homepage");
        return cachedResponse;
      }

      console.log("Cache MISS for homepage — fetching from Firestore");

      // ── Fetch data + origin HTML in parallel ──
      const [featuredArticles, latestArticles, originResponse] = await Promise.all([
        fetchFeaturedArticles(),
        fetchLatestArticles(),
        fetch(request),
      ]);

      // ── Inject content into HTML ──
      let html = await originResponse.text();
      html = injectHomePage(html, featuredArticles, latestArticles);

      // ── Build response ──
      const response = new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
          "X-SSR": "cloudflare-worker",
        },
      });

      cache.put(cacheKey, response.clone());
      return response;
    }

    // ═══════════════════════════════════════════════════════
    // ALL OTHER ROUTES — Pass through to Firebase origin
    // ═══════════════════════════════════════════════════════
    return fetch(request);
  },
};
