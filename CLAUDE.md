# Materialistic Web Reader — Project Notes

A faithful web/PWA rebuild of the Android app **Materialistic** (by hidroh) as a Hacker News reader for Carl.

## Quick reference

| Thing | Value |
|---|---|
| Production URL | https://materialistic-hn.netlify.app |
| GitHub repo | https://github.com/oujii/materialistic-hn (public) |
| Netlify project | https://app.netlify.com/projects/materialistic-hn |
| Netlify site ID | `fcfdd2ba-fd25-4628-9c2d-bab4a62e7c85` |
| HN username | `oujiii` |
| Original Android app | https://github.com/hidroh/materialistic |
| Tech | Astro 4 + Tailwind + TypeScript, Netlify SSR adapter v5 |
| Local dev | `npm run dev` (port 4321) |
| Build | `npm run build` |
| Deploy | `git push origin main` — Netlify auto-builds |

## Architecture

- **No database.** HN session cookie is encrypted (AES-GCM with `COOKIE_SECRET`) and stored in our own HttpOnly cookie.
- **HN reads**: `https://hacker-news.firebaseio.com/v0/...` (public Firebase API).
- **HN writes (favorites)**: scrape HN's HTML for per-item `auth` tokens, then GET `/fave?id=X&auth=Y`.
- **Login**: POST to `https://news.ycombinator.com/login` with form-encoded `acct`/`pw`/`goto`. Validates with a follow-up fetch of `/threads?id=USER` checking for the `logout?` link.
- **Saved articles**: synced to the user's real HN favorites — nothing stored locally on our side.

## Critical gotchas (DO NOT FORGET)

1. **HN `/fave` requires an `auth` token** unique per (user, item, session). Without it HN silently 302s back to `/favorites` without saving. You must fetch `/item?id=X` with the user's cookie first and scrape the link's `auth` parameter.
2. **HN HTML-encodes `&` as `&amp;`** in href attributes. Regex must match `(?:&|&amp;)` not literal `&`.
3. **HN login form has NO `fnid` CSRF token.** Only `acct`, `pw`, `goto`. Trying to find `fnid` will throw and break login.
4. **Use a real browser User-Agent** on HN calls. Some endpoints rate-limit / silently reject bot-looking UAs.
5. **Always send `Referer: news.ycombinator.com/item?id=X`** on `/fave` calls.
6. **Node 22 fetch**: use `headers.getSetCookie()` to parse Set-Cookie correctly — `headers.get('set-cookie')` returns a comma-joined string that breaks naive regex.
7. **Netlify SSR via `--build`**: the CLI does NOT auto-detect the runtime v2 SSR function. Either push to GitHub and let Netlify build natively (preferred) or use `[[redirects]] /* → /.netlify/functions/ssr` workaround. Streaming Lambda format from `@astrojs/netlify` v5 only works when Netlify builds natively from Git.
8. **Onclick attributes need globals**: Astro bundles `<script>` as ES modules. To use `onclick="toggleSave(123)"`, the function must be assigned to `window.toggleSave`. Or use `<script is:inline>` to keep it global (preferred — used in `item/[id].astro` and Base toast script).
9. **PWA install on Firefox Android**: `beforeinstallprompt` is Chrome-only. Show manual instructions: menu (⋮) → Install / Add to Home Screen.
10. **Astro `output: 'server'`** means `Astro.redirect()` works in frontmatter, but on Netlify the root `/` needs an explicit `[[redirects]]` in `netlify.toml` to redirect to `/top`.
11. **`define:vars` in Astro** breaks in production builds. Don't use it. Pass values via `data-*` attributes or `is:inline`.

## File map

```
src/
  lib/
    crypto.ts            AES-GCM encrypt/decrypt for the session cookie
    session.ts           Read/write the HttpOnly session cookie
    hn-read.ts           Firebase API wrapper (story lists, items, time formatting)
    hn-auth.ts           Login, favorite (with auth scraping), session validation
    hn-scrape.ts         Scrape /favorites page for IDs + full SavedStory list
  components/
    StoryRow.astro       Story row with orange rank column + comment/fire indicator
    Comment.astro        Threaded comment with depth-colored left border
    DrawerMenu.astro     Side menu (Login, Top, New, Best, Ask/Show/Jobs, Saved)
  pages/
    index.astro          302 → /top
    [section].astro      top/new/best/ask/show/jobs listing
    item/[id].astro      Story view with Comments | Article tabs
    saved.astro          User's HN favorites scraped via cookie
    login.astro          HN login form
    api/
      login.ts           POST credentials, store encrypted session cookie
      logout.ts          Clear session cookie
      save.ts            POST to toggle favorite on HN
      vote.ts            (Placeholder — needs auth scraping like /fave)
public/
  manifest.webmanifest   PWA manifest
  sw.js                  Service worker (cache shell + offline)
  sw-register.js         Service worker registration
  icons/                 Original Materialistic launcher icons (from hidroh repo)
```

## Design specs from `hidroh/materialistic`

| Element | Value | Source |
|---|---|---|
| Header amber | `#FFB74D` (orange300) | colors.xml |
| Orange rank column | `#FFE0B2` (orange100) | colors.xml |
| Fire icon | `#FF9800` (orange500) | colors.xml |
| Comment red | `#F44336` (red500) | colors.xml |
| Primary text | `rgba(0,0,0,0.87)` (blackT87) | colors.xml |
| Saved bookmark tint | `#FF6600` (HN orange) | drawable tint |
| Font | Roboto (Android default) | (no custom font) |
| Title size | 18sp = `text-[18px]` | text_size_medium |
| Subtitle size | 14sp = `text-[14px]` | text_size_small |
| Rank column width | 64dp = `w-16` | cardview_min_height |
| Padding inside card | 8dp = `p-2` | padding |

## Layout principles

- **Story row (StoryRow.astro)**: orange rank column (w-16) on left; title spans full width; domain italic; bottom row has `time - username` on left and comment icon + count + 3-dots on right.
- **Article view (item/[id].astro)**: top action bar (back, text-size, open-external, share); title section spans full width with bookmark + thumb-up absolutely positioned bottom-right; tabs (COMMENTS | ARTICLE); content.
- **Comment.astro**: depth-colored left border (orange → purple → blue → green → pink → yellow), white card with shadow, expandable nested replies.
- **Visited stories**: title text turns `gray-400` via `:visited` selector. Background stays white.

## Auth flow

1. User submits `/login` form (HN username + password).
2. `/api/login` POSTs to `news.ycombinator.com/login`, extracts the `user=...` Set-Cookie.
3. Validates by fetching `/threads?id=USER` with the cookie; checks for `logout?` link.
4. Wraps the HN cookie in JSON `{ username, cookie }`, encrypts (AES-GCM), sets as HttpOnly `hn_session` cookie on our domain.
5. Subsequent API routes decrypt the session cookie and use the embedded HN cookie for requests.

## Save flow

1. Client POSTs `/api/save` with `{ id, unsave: bool }` + the session cookie.
2. Server decrypts session, calls `hnFave(id, cookie, save)`.
3. `hnFave` fetches `/item?id=X` with the user's cookie to get the HTML.
4. Scrapes for `fave?id=X(?:&|&amp;)(un=t(?:&|&amp;))?auth=([a-f0-9]+)`.
5. Compares "current state" (un=t link present means already saved) with desired state.
6. If different, calls `/fave?id=X[&un=t]&auth=Y` to toggle.
7. Returns `{ ok, saved }` to client.

## Iteration log

A rough record of what was changed in this conversation so future me knows what's been polished:

- Initial scaffold (Astro + Tailwind + Netlify adapter + PWA).
- HN API layer: `hn-read.ts` (Firebase), `hn-auth.ts` (login proxy), `hn-scrape.ts` (favorites scraping).
- Login/logout/save API routes; session cookie crypto.
- StoryRow / Comment / DrawerMenu / Base layout.
- PWA install: `<install>` element + `beforeinstallprompt` fallback. Later replaced for Firefox with manual instructions.
- Color palette and font tuned via the original repo's `colors.xml`, `dimens.xml`, `styles.xml`.
- Material Design icons replaced emojis. Specific original SVGs imported for comment, bookmark, bookmark-border, thumb-up.
- Story row layout: title full-width, comment icon + count + 3-dots on right; bottom-right alignment with `min-w-[3ch]` to keep bubble in fixed position regardless of count length.
- Visited links: title text grays out, background stays white.
- Removed dark mode (locked to light only).
- Article view: top action bar, big title, italic domain, action icons absolute bottom-right.
- Comment: bigger text (16px), 1rem paragraph spacing, wider depth border (border-l-4).
- Reply FAB (red round button bottom-right) opens HN thread.
- Pull-to-refresh on listing pages.
- Original launcher icon (from `mipmap-xxxhdpi/ic_launcher.png`) replaces placeholder.
- HN login fix: removed bogus `fnid` requirement, robust `getSetCookie()` parsing, session validation.
- **The big bug**: HN `/fave` was silently failing because we didn't send the per-item `auth` token. Fixed by scraping the item page first.
- Saved indicator on /top + bookmark initialized to filled in article view if already saved.
- Article header layout: title full-width, action icons absolutely positioned bottom-right with right inset.

## Open / not-yet-done

- **Voting**: `hnVote` is a placeholder. Needs the same auth-token-scraping approach as `hnFave`.
- **Commenting**: not implemented. HN comment form has `hmac` field that needs to be scraped from the item page.
- **Submit to HN**: stub in drawer menu; no implementation.
- **Catch Up view**: needs local read-tracking (IndexedDB) + diff with current top stories.
- **Settings page**: not built.
- **Streaming/incremental comment loading**: currently fetches comment tree eagerly to depth 2. Deeper threads are lazy via `<details>`.
- **Service worker**: caches static assets + index but doesn't intelligently cache HN API responses.

## Environment

```
COOKIE_SECRET=<32 byte base64>  # generated with: openssl rand -base64 32
```

Locally: in `.env`.
Production: set on Netlify under Site → Configuration → Environment variables.
