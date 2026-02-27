# bitfeed 🔴⚪

**Clean. Minimal. Insights.**

A community-driven news platform built by **custmr.team**. bitfeed delivers curated news articles with a clean, minimal reading experience featuring a striking **White & Red** aesthetic — powered by Firebase and vanilla HTML/CSS/JS.

> **Live URL**: [bitfeed.in](https://bitfeed.in)

---

## Table of Contents

1. [Theme & Design](#-theme--design-white--red)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Core Features](#core-features)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Page-by-Page Breakdown](#page-by-page-breakdown)
8. [Firebase Configuration](#firebase-configuration)
9. [Authentication Flow](#authentication-flow)
10. [Article Lifecycle (Author → Reader)](#article-lifecycle-author--reader)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [How to Run Locally](#how-to-run-locally)
13. [Deployment](#deployment)
14. [Contributing Guidelines](#contributing-guidelines)

---

## 🎨 Theme & Design (White & Red)

bitfeed is designed with a signature **White & Red** aesthetic. 
- ⚪ **White (Base)**: Provides a clean, minimalist canvas that prioritizes readability and content focus.
- 🔴 **Red (Accent)**: Used strategically for branding, interactive elements, highlights, and primary actions (e.g., buttons, links, active states).

This high-contrast typography and color scheme ensures a striking, modern, and highly legible user experience across all devices.

---

## Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| **Frontend**   | Vanilla HTML5, CSS3, JavaScript (ES Modules)                  |
| **Backend**    | Firebase (Firestore, Auth, Analytics, Hosting)                |
| **Auth**       | Google Sign-In, Twitter/X Sign-In, Email OTP (custom flow)    |
| **Hosting**    | Firebase Hosting                                              |
| **Automation** | n8n (webhook-triggered bulk article generation)               |
| **Email**      | Google Apps Script (approval emails, author applications)     |
| **Offline**    | IndexedDB persistence via Firestore SDK                       |
| **SEO**        | JSON-LD structured data, Open Graph, canonical tags           |

---

## Project Structure

```
bitfeed.in/
│
├── index.html                 # Root redirect → /main/index.html
├── firebase.json              # Firebase Hosting config (rewrites, redirects, headers)
│
├── Article/                   # Firebase SDK initialization
│   └── firebase-db.js         # ⭐ Central Firebase config + all Firestore query functions
│
├── layout/                    # Global shared UI (injected into every page)
│   ├── layout.js              # Header, sidebar, footer injection + search + newsletter
│   ├── layout.css             # Global styles, sidebar, footer, responsive breakpoints
│   ├── layout.html            # HTML template for header/sidebar/footer
│   └── auth.js                # ⭐ Full auth system (Google, Twitter, OTP, profile popup)
│
├── main/                      # Homepage
│   ├── index.html             # Landing page (hero, featured, latest, top news)
│   ├── index.css              # Homepage-specific styles + skeleton loaders
│   ├── index.js               # Typewriter, featured/latest news loaders, promo system
│   └── 404.html               # Custom 404 error page
│
├── articles/                  # Article display
│   ├── article.html           # Single article view
│   ├── article.css            # Article page styles (content, author card, related)
│   ├── article.js             # ⭐ Article rendering, likes, saves, follows, inline edit, meta tags
│   ├── multi-article.html     # Paginated article listing ("Read More")
│   ├── multi-article.css      # Listing page grid styles
│   └── multi-article.js       # Pagination logic with serial number system
│
├── admin/                     # Admin-only tools
│   ├── dashboard.html         # Admin dashboard (links to all admin tools)
│   ├── panel.html             # Reporter application review (approve/reject)
│   ├── post-article.html      # Article submission form (for authors)
│   ├── post-article.css       # Post form styles
│   ├── post-article.js        # Form logic, image cropper, tags, submit to Firestore
│   ├── article-requests.html  # Article moderation queue (approve/reject/edit)
│   ├── article-requests.css   # Moderation page styles
│   ├── article-requests.js    # Moderation logic, serial number assignment, image editing
│   ├── bulk-upload.html       # Bulk article upload via JSON
│   ├── bulk-upload.js         # JSON parser, queue renderer, n8n webhook, batch upload
│   ├── migrate-tool.html      # Data migration utility
│   └── user-db.js             # ⭐ User DB operations (save user, newsletter, author applications)
│
├── profile pages/             # User & author profiles
│   ├── user.html              # Logged-in user's profile page
│   ├── user.css               # User profile styles
│   ├── user-profile.js        # User profile data, saved articles, settings
│   ├── author.html            # Public author profile page
│   ├── author.css             # Author profile styles
│   ├── author.js              # Author profile data, article list, follow button
│   ├── apply.html             # "Become a Reporter" application form
│   ├── apply.css              # Application form styles
│   └── apply.js               # Form validation, photo upload, submit via user-db.js
│
├── students/                  # Student resources section
│   ├── Students.html          # AI learning hub + free resource table
│   ├── students.css           # Student page styles
│   ├── students.js            # Dynamic resource table rendering
│   └── resources/             # Extended resources sub-section
│       ├── resources.html     # Detailed resource listing page
│       ├── resources.css      # Resource page styles
│       ├── resources.js       # Resource filtering and rendering
│       └── resources-data.json# Resource data (credits, discounts, courses)
│
├── others/                    # Static / informational pages
│   ├── about.html             # About bitfeed
│   ├── privacy-policy.html    # Privacy policy & editorial guidelines
│   └── x-error.html           # Custom error / "internet down" page
│
└── assets/                    # Static assets (images, icons)
    ├── favicon.png            # Site favicon
    ├── google.svg             # Google login icon
    ├── default-user.png       # Default avatar
    └── ...                    # Various UI icons and images
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Homepage │  │ Articles │  │  Admin   │  │ Profile │  │
│  │  main/   │  │ articles/│  │  admin/  │  │ profile │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │             │              │      │
│       └──────────────┴─────────────┴──────────────┘      │
│                          │                               │
│            ┌─────────────┴────────────┐                  │
│            │    layout/ (Global UI)   │                  │
│            │  layout.js + auth.js     │                  │
│            └─────────────┬────────────┘                  │
│                          │                               │
│            ┌─────────────┴────────────┐                  │
│            │  Article/firebase-db.js  │                  │
│            │  (Central Firebase SDK)  │                  │
│            └─────────────┬────────────┘                  │
└──────────────────────────┼──────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │   FIREBASE SERVICES     │
              │                         │
              │  ┌───────────────────┐  │
              │  │    Firestore DB   │  │
              │  │  - articles       │  │
              │  │  - users          │  │
              │  │  - authors        │  │
              │  └───────────────────┘  │
              │                         │
              │  ┌───────────────────┐  │
              │  │  Firebase Auth    │  │
              │  │  Google / Twitter │  │
              │  └───────────────────┘  │
              │                         │
              │  ┌───────────────────┐  │
              │  │  Firebase Hosting │  │
              │  └───────────────────┘  │
              │                         │
              │  ┌───────────────────┐  │
              │  │    Analytics      │  │
              │  └───────────────────┘  │
              └─────────────────────────┘
```

**Key design principle**: There is **no backend server**. Every page directly communicates with Firebase services via the JS SDK loaded from CDN. The central `Article/firebase-db.js` initializes the Firebase app and exports shared instances (`auth`, `db`, `app`, `analytics`) that every other module imports.

---

## Core Features

### 🏠 Homepage (`main/`)
- **Typewriter hero animation** — cycles through taglines on first login (per-session), highlighted with striking red text.
- **Featured News** — top 2 articles marked as `isFeatured: true`, displayed in an alternating left/right layout with bold visual accents.
- **Latest News Ticker** — real-time Firestore subscription (`onSnapshot`) showing the 5 most recent articles in a timeline view with mobile accordion tap-to-expand.
- **Top News** — editorially curated static highlight section (e.g., Budget 2026).
- **Skeleton loaders** — shimmer placeholders shown while Firestore data loads, then swapped with a fade-in.
- **Promo system** — banner + popup shown to readers (not authors/admins) to encourage reporter applications.
- **Stepped scroll** — arrow keys navigate between page sections smoothly.

### 📰 Articles (`articles/`)
- **Single article view** — full article page with cover image, title, date, author card, tags, content body, and related articles.
- **Content versioning** — articles can have `beginner`, `intermediate`, and `pro` content versions (expandable).
- **Social meta tags** — dynamically updated `og:title`, `og:description`, `og:image` for sharing.
- **Like / Save / Share** — interactive buttons with Firestore persistence per user.
- **Follow author** — readers can follow authors (stored in user's `following[]` array).
- **Inline editing** — admins and original authors see an "Edit" button that toggles inline editing mode with a full image re-cropper.
- **Related articles** — client-side tag matching via local search cache (zero extra Firestore reads).
- **Read count** — `views` counter incremented on each article load.
- **Multi-article listing** — paginated view using a custom serial number formula (`Total - 7*(Page-1)`), loads 7 articles per page.

### 🔐 Authentication (`layout/auth.js`)
- **Google Sign-In** — via `signInWithPopup`.
- **Twitter/X Sign-In** — via `TwitterAuthProvider`.
- **Email OTP** — custom flow using `signInAnonymously` → `linkWithCredential` with email verification through Google Apps Script.
- **Profile popup** — desktop popup and mobile sidebar integration with user avatar, role display, and logout.
- **Session management** — typewriter plays only once per session, promo popups respect `sessionStorage`.

### 🛠️ Admin Panel (`admin/`)
- **Dashboard** (`dashboard.html`) — central hub linking to all admin tools.
- **Post Article** (`post-article.html`) — rich form with image upload + drag-and-drop, built-in cropper (800×500), dynamic tag suggestions, target audience level selector. Submits with `status: "pending"`.
- **Article Requests** (`article-requests.html`) — moderation queue showing pending articles sorted by date. Admins can:
  - **Approve** → assigns next `serialNumber`, sets `status: "approved"`, image re-crop option.
  - **Reject** → deletes the article document.
  - 3-day auto-highlight for freshly approved articles.
- **Bulk Upload** (`bulk-upload.html`) — paste JSON or upload a `.json` file, preview queue with per-article image cropper, batch upload to Firestore. Also has an n8n webhook trigger button for automated news generation.
- **Reporter Applications** (`panel.html`) — view pending reporter applications with profile details, approve (sends welcome email via Google Apps Script) or reject.
- **User DB** (`user-db.js`) — handles user creation/update in Firestore (readers, guests, newsletter subscribers, author applications to Google Sheets).

### 👤 Profile Pages (`profile pages/`)
- **User Profile** (`user.html`) — displays saved articles, account info, and settings.
- **Author Profile** (`author.html`) — public-facing author page with bio, article list, follower count, and follow button.
- **Apply to Report** (`apply.html`) — application form for becoming a bitfeed reporter. Fields: name, email, DOB, specialization, location, portfolio link, profile photo, and writing sample. Sends both to Firestore and via email to admins.

### 🎓 Students Section (`students/`)
- **AI Learning Hub** — educational content about AI (what, why, when, how).
- **Free Resources Table** — dynamically rendered from `resources-data.json`, showing credits, discounts, and courses available to students.
- **Extended Resources Page** — detailed listing with filtering capabilities.
- **Full SEO** — JSON-LD structured data, canonical tags, Open Graph, breadcrumbs, `<noscript>` fallbacks.

### 📄 Static Pages (`others/`)
- **About** (`about.html`) — team and mission information.
- **Privacy Policy** (`privacy-policy.html`) — legal and editorial guidelines.
- **Error Page** (`x-error.html`) — custom error/offline state page (accessible via `i` shortcut).

---

## User Roles & Permissions

| Role                  | Can Read | Can Post | Can Edit Own | Can Approve | Can Bulk Upload | Sees Promo |
| --------------------- | -------- | -------- | ------------ | ----------- | --------------- | ---------- |
| **Guest**             | ✅       | ❌       | ❌           | ❌          | ❌              | ❌         |
| **Reader**            | ✅       | ❌       | ❌           | ❌          | ❌              | ✅         |
| **Reporter Candidate**| ✅       | ❌       | ❌           | ❌          | ❌              | ❌         |
| **Author**            | ✅       | ✅       | ✅           | ❌          | ❌              | ❌         |
| **Admin**             | ✅       | ✅       | ✅ (all)     | ✅          | ✅              | ❌         |

Roles are stored in the Firestore `users` collection, keyed by the user's email address. Role transitions:
- **New sign-up** → `reader`
- **Newsletter-only subscriber** → `guest`
- **Apply as reporter** → `reporter_candidate`
- **Admin approves** → `author`

---

## Page-by-Page Breakdown

### Homepage Flow
```
User visits bitfeed.in
    │
    ├── / (root index.html) ──redirect──→ /main/index.html
    │
    ├── layout.js injects global header + sidebar + footer
    │
    ├── auth.js checks login state
    │   ├── Logged in? → Typewriter animation plays (once per session)
    │   └── Guest? → Static tagline shown
    │
    ├── index.js fetches featured articles (getFeaturedNews)
    │   └── Skeleton → fade-in real content
    │
    ├── index.js subscribes to latest news (subscribeLatestNews)
    │   └── Real-time onSnapshot → timeline ticker
    │
    └── Promo check: if reader (not author/admin) → show banner + popup
```

### Article Submission Flow
```
Author clicks "Post Article" (from their profile)
    │
    ├── Fills form: title, summary, content, tags, cover image
    │   └── Image goes through built-in crop tool (800×500 canvas)
    │
    ├── Selects target audience level (beginner / intermediate / pro)
    │
    ├── Clicks "Send for Approval"
    │   └── Article saved to Firestore with status: "pending"
    │
    ├── Admin opens Article Requests page
    │   ├── Reviews pending articles (sorted: pending first)
    │   ├── Can re-crop the cover image
    │   ├── Clicks "Approve"
    │   │   ├── Auto-assigns next serialNumber
    │   │   ├── Sets status: "approved"
    │   │   └── Article goes live immediately
    │   └── Clicks "Reject"
    │       └── Document deleted from Firestore
    │
    └── Article appears on homepage (if featured) and in listing
```

### Bulk Upload Flow
```
Admin opens Bulk Upload page
    │
    ├── Option A: Paste raw JSON into text area
    ├── Option B: Upload .json file
    │
    ├── JSON parsed → queue rendered as editable cards
    │   └── Each card has individual image upload + cropper
    │
    ├── "Upload All" button
    │   └── Each article saved to Firestore as "approved"
    │       with auto-assigned serialNumber
    │
    └── Optional: "Generate News" button
        └── Triggers n8n webhook → automated article generation
```

### Reporter Application Flow
```
Reader clicks "Apply to Become a Reporter"
    │
    ├── Fills application: name, DOB, specialization, location,
    │   portfolio link, profile photo, writing sample
    │
    ├── Submit
    │   ├── Saved to Firestore "authors" collection (status: "pending")
    │   ├── User role updated to "reporter_candidate"
    │   └── Email sent to admin via Google Apps Script
    │
    ├── Admin opens Reporter Applications (panel.html)
    │   ├── Reviews application details in modal
    │   ├── "Approve" → role updated to "author" + welcome email sent
    │   └── "Reject" → application deleted from Firestore
    │
    └── Approved author can now post articles
```

---

## Firebase Configuration

### `firebase.json`

```json
{
  "hosting": {
    "public": ".",
    "redirects": [
      { "source": "/", "destination": "/main/index.html", "type": 301 }
    ],
    "rewrites": [
      { "source": "**", "destination": "/main/index.html" }
    ],
    "headers": [
      {
        "source": "/articles/**",
        "headers": [
          { "key": "X-Prerender-Token", "value": "..." }
        ]
      }
    ]
  }
}
```

- **Root redirect**: `/` → `/main/index.html` (301 permanent).
- **SPA rewrite**: all unmatched routes fall back to `/main/index.html`.
- **Prerender header**: added for article pages to support SEO crawlers.

### Firestore Collections

| Collection   | Doc Key           | Purpose                                              |
| ------------ | ----------------- | ---------------------------------------------------- |
| `articles`   | Auto-generated ID | All news articles (pending + approved)                |
| `users`      | User email        | Reader/author profiles, roles, saved articles         |
| `authors`    | User email        | Reporter applications and approved author profiles    |

### Key Article Document Fields
```
{
  title: string,
  summary: string,
  content: string,                // Main article body
  contentVersions: {              // Optional multi-level content
    beginner: string,
    intermediate: string,
    pro: string
  },
  imageUrl: string,               // Base64 cover image (from cropper)
  tags: string[],                 // e.g., ["Tech", "AI", "India"]
  targetLevel: string,            // "beginner" | "intermediate" | "pro"
  authorName: string,
  authorEmail: string,
  authorImage: string,
  datePosted: Timestamp,
  serialNumber: number,           // Auto-assigned on approval
  isFeatured: boolean,
  status: "pending" | "approved",
  stats: {
    views: number,
    likes: number,
    saves: number
  }
}
```

---

## Authentication Flow

```
User clicks Login button
    │
    ├── Google → signInWithPopup(GoogleAuthProvider)
    │
    ├── Twitter → signInWithPopup(TwitterAuthProvider)
    │
    └── Email OTP (custom)
        ├── Enter email → OTP generated by Google Apps Script
        ├── User verifies OTP
        ├── signInAnonymously() → linkWithCredential(EmailAuthCredential)
        └── Account created / linked

→ onAuthStateChanged fires
    ├── User exists in Firestore? → Update lastLogin
    └── New user? → Create reader profile in "users" collection

→ UI updates (avatar, sidebar, profile popup, subscribe button)
```

---

## Keyboard Shortcuts

These shortcuts work on the homepage when not typing in an input field:

| Key   | Action                                   |
| ----- | ---------------------------------------- |
| `s`   | Navigate to Students section             |
| `i`   | Navigate to Error/Info page              |
| `m`   | Navigate to Multi-article listing        |
| `↑/↓` | Step through homepage sections smoothly  |

---

## How to Run Locally

### Prerequisites
- [Firebase CLI](https://firebase.google.com/docs/cli) installed (`npm install -g firebase-tools`)
- Access to the bitfeed Firebase project

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Ranjan-111/bai-news-testing.git
cd bai-news-testing

# 2. Login to Firebase
firebase login

# 3. Start the local dev server
firebase serve

# 4. Open in browser
# → http://localhost:5000
```

> **Note**: Since this is a purely static project with no build step, you can also use any static file server (e.g., `npx serve .`, VS Code Live Server, Python `http.server`). However, Firebase-specific redirects and rewrites will only work with `firebase serve`.

---

## Deployment

Deployment is handled via Firebase Hosting:

```bash
# Deploy to production
firebase deploy --only hosting
```

This deploys the entire root directory (excluding files in `.gitignore` and patterns in `firebase.json` ignore list).

---

## Contributing Guidelines

### File Naming Convention
- HTML/CSS/JS files: `kebab-case` (e.g., `post-article.js`)
- Directories: lowercase, spaces allowed for legacy folders (e.g., `profile pages/`)

### Module System
- All JavaScript uses **ES Modules** (`import`/`export`) loaded via `<script type="module">`.
- Firebase SDK is loaded from CDN (`https://www.gstatic.com/firebasejs/10.7.1/...`).
- Always import Firebase instances from `Article/firebase-db.js` — never initialize the app elsewhere.

### Styling Rules
- Each page has its own CSS file for page-specific styles.
- Global styles live in `layout/layout.css`.
- Use CSS variables for our core **White & Red** theme colors to maintain consistency.
- All pages must be responsive (breakpoints: 550px mobile, 1000px tablet, 1399px desktop).

### Adding a New Page
1. Create `your-page.html` in the appropriate directory.
2. Include the global layout:
   ```html
   <link rel="stylesheet" href="/layout/layout.css">
   <div id="global-header"></div>
   <!-- your content -->
   <div id="global-footer"></div>
   <script defer type="module" src="/layout/layout.js"></script>
   ```
3. Import Firebase if needed:
   ```javascript
   import { db, auth } from '/Article/firebase-db.js';
   ```

### Skeleton Loader Pattern
When loading data from Firestore, always:
1. Show a skeleton placeholder on initial render.
2. Fetch data asynchronously.
3. Hide skeleton, show real content with a `fade-in` class.

```javascript
// Example pattern
const skeleton = document.getElementById('skeleton-view');
const real = document.getElementById('real-view');

const data = await fetchData();

skeleton.classList.add('hidden');
real.classList.remove('hidden');
real.classList.add('fade-in');
```

---

## Team

Built and maintained by **custmr.team**.

---

*Last updated: February 2026*
