/**
 * Cloudflare Worker — Dynamic OG Meta Tags for Social Media Sharing
 * 
 * PURPOSE:
 * Social media crawlers (WhatsApp, LinkedIn, X, Facebook) do NOT execute JavaScript.
 * They only read raw HTML. Since bitfeed is a Firebase-hosted SPA, the OG meta tags
 * in the initial HTML always show the default favicon. This Worker intercepts bot
 * requests and injects the real article's title, summary, and image into the HTML.
 *
 * HOW IT WORKS:
 * 1. ALL requests are proxied through Cloudflare (DNS set up via Cloudflare).
 * 2. For /article?id=xxx requests, the Worker checks the User-Agent.
 * 3. If it's a human browser → pass through to Firebase Hosting unchanged.
 * 4. If it's a bot → fetch article data from Firestore REST API, inject OG tags, serve.
 *
 * SETUP:
 * - Your Firebase project ID: bai-news-9e4cf
 * - Your site domain: bitfeed.in
 * - Your Firestore collection: articles
 * - Article images are stored at paths like /assets/article-img/llm.png
 */

// ─── CONFIGURATION ──────────────────────────────────────────────
const FIREBASE_PROJECT_ID = "bai-news-9e4cf";
const SITE_DOMAIN = "https://bitfeed.in";

// Firestore REST API base URL
// Document path: projects/{projectId}/databases/(default)/documents/{collection}/{documentId}
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ─── BOT DETECTION ──────────────────────────────────────────────
// These are the User-Agent substrings used by major social media crawlers.
const BOT_USER_AGENTS = [
  // Facebook / Meta
  "facebookexternalhit",
  "Facebot",
  // Twitter / X
  "Twitterbot",
  // LinkedIn
  "LinkedInBot",
  // WhatsApp
  "WhatsApp",
  // Telegram
  "TelegramBot",
  // Discord
  "Discordbot",
  // Slack
  "Slackbot",
  // Google (for rich results / search preview)
  "Googlebot",
  // Pinterest
  "Pinterest",
  // Skype
  "SkypeUriPreview",
  // Generic link preview bots
  "bot",
  "crawler",
  "spider",
  "curl",       // useful for testing
  "wget",       // useful for testing
];

/**
 * Check if the User-Agent string belongs to a known social media bot/crawler.
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

// ─── FIRESTORE HELPERS ──────────────────────────────────────────

/**
 * Extracts a simple JS value from a Firestore REST API field value object.
 * Firestore REST returns typed wrappers like { "stringValue": "hello" }.
 */
function extractFirestoreValue(field) {
  if (!field) return "";
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return field.integerValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.nullValue !== undefined) return null;
  return "";
}

/**
 * Fetches a single article document from Firestore via the REST API.
 * Returns { title, summary, imageUrl } or null if not found.
 */
async function fetchArticleFromFirestore(articleId) {
  // Firestore REST endpoint for a single document
  const url = `${FIRESTORE_BASE}/articles/${articleId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Firestore fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const fields = data.fields;

    if (!fields) return null;

    return {
      title: extractFirestoreValue(fields.title),
      summary: extractFirestoreValue(fields.summary),
      imageUrl: extractFirestoreValue(fields.imageUrl),
    };
  } catch (err) {
    console.error("Error fetching from Firestore:", err);
    return null;
  }
}

// ─── HTML MODIFICATION ──────────────────────────────────────────

/**
 * Takes the raw article.html string and replaces the default OG/Twitter meta
 * tag values with the actual article data.
 */
function injectMetaTags(html, article) {
  // Convert relative image path to absolute URL
  let absoluteImageUrl = article.imageUrl || "";
  if (absoluteImageUrl && !absoluteImageUrl.startsWith("http")) {
    absoluteImageUrl = `${SITE_DOMAIN}${absoluteImageUrl}`;
  }

  const title = escapeHtml(article.title || "bitfeed — Business & AI Insights");
  const summary = escapeHtml(article.summary || "Read this article on bitfeed — clean, minimal insights.");

  // Replace OG meta tags
  html = html.replace(
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" id="og-title" content="${title}">`
  );
  html = html.replace(
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" id="og-description" content="${summary}">`
  );
  html = html.replace(
    /<meta\s+property="og:image"\s+id="og-image"[^>]*>/i,
    `<meta property="og:image" id="og-image" content="${absoluteImageUrl}">`
  );
  html = html.replace(
    /<meta\s+property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="${title}">`
  );

  // Replace Twitter Card meta tags
  html = html.replace(
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" id="twitter-title" content="${title}">`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" id="twitter-description" content="${summary}">`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" id="twitter-image" content="${absoluteImageUrl}">`
  );

  // Replace standard meta description
  html = html.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" id="meta-description-tag" content="${summary}">`
  );

  // Replace <title> tag
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${article.title || "bitfeed"} | bitfeed</title>`
  );

  return html;
}

/**
 * Escapes HTML special characters to prevent XSS in meta tag content attributes.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── MAIN WORKER HANDLER ────────────────────────────────────────

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("User-Agent") || "";

    // ── STEP 1: Only intercept the /article route ──
    if (url.pathname !== "/article") {
      // For everything else, pass through to Firebase origin
      return fetch(request);
    }

    // ── STEP 2: Check if visitor is a bot ──
    if (!isBot(userAgent)) {
      // Human browser — pass through unchanged
      return fetch(request);
    }

    // ── STEP 3: It's a bot on /article — extract the article ID ──
    const articleId = url.searchParams.get("id");

    if (!articleId) {
      // No article ID — just pass through
      return fetch(request);
    }

    console.log(`Bot detected: "${userAgent}" requesting article: ${articleId}`);

    // ── STEP 4: Fetch article data from Firestore REST API ──
    const article = await fetchArticleFromFirestore(articleId);

    if (!article) {
      // Article not found in Firestore — pass through to show default page
      console.log(`Article ${articleId} not found in Firestore, passing through.`);
      return fetch(request);
    }

    // ── STEP 5: Fetch the raw article.html from Firebase Hosting ──
    const originResponse = await fetch(request);
    let html = await originResponse.text();

    // ── STEP 6: Inject real meta tags into the HTML ──
    html = injectMetaTags(html, article);

    // ── STEP 7: Return the modified HTML ──
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        // Allow social media bots to cache for 1 hour
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
