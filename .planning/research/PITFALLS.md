# Pitfalls Research

**Domain:** Community fly-tying rating/catalog web app (React + Supabase)
**Researched:** 2026-07-01
**Confidence:** HIGH (Supabase traps verified against docs + CVE-2025-48757; rating-system pitfalls are well-established IMDb/Bayesian patterns)

> Phase names below are **suggested** — the roadmap doesn't exist yet. They map to logical capability groupings: **Foundation/Data Model**, **Auth**, **Submissions+Storage**, **Rating+Ranking**, **Discovery/SEO**, **Moderation/Admin**. Adjust to actual roadmap.

## Critical Pitfalls

### Pitfall 1: Missing or misconfigured RLS exposes the entire database via the anon key

**What goes wrong:**
The `anon` (public) key ships in every React bundle — it is *designed* to be public. If a table has no Row Level Security policy (or RLS is disabled), anyone can extract the anon key from your JS, hit the auto-generated PostgREST REST API, enumerate table names, and read/write everything. This is the single most common Supabase disaster. CVE-2025-48757 (May 2025) found 303 endpoints across 170 AI-generated Supabase apps leaking data this way — 10.3% of analyzed projects.

**Why it happens:**
RLS is **not** globally on by default. Tables created via SQL editor / migrations have RLS *disabled* unless you `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. (Dashboard-created tables enable it, which lulls people into thinking it's automatic.) Even *enabling* RLS with no policies isn't enough conceptually — an enabled-but-policyless table returns nothing, so devs "fix" it by adding an overly-broad `USING (true)` policy that re-opens writes. For Flyrate, anonymous browse *must* work, which tempts blanket public policies that accidentally cover writes too.

**How to avoid:**
- Enable RLS on **every** table in `public` at creation time (in the migration, not the dashboard).
- Separate read from write in policies: `SELECT` policy `USING (true)` for public browse tables (flies, ratings aggregates, taxonomy); `INSERT/UPDATE/DELETE` policies gated on `auth.uid()`.
- Ratings: `INSERT`/`UPDATE` policy must enforce `rater_id = auth.uid()` AND (for the self-rating rule) `fly.submitter_id <> auth.uid()`.
- Turn on the project setting "Enable RLS on new tables."
- Run Supabase's **Security Advisor** (dashboard lint) before every deploy; it flags tables without RLS.
- Wrap `auth.uid()` in policies as `(select auth.uid())` — it lets Postgres cache the value per-statement instead of per-row (major perf difference on large scans, and avoids the common RLS-perf trap).

**Warning signs:**
- Any table shows up in Security Advisor's "RLS disabled" or "policy exists but RLS disabled" lint.
- You can `curl` your REST endpoint with only the anon key and get rows from a table you thought was protected.
- A "quick fix" PR adds `USING (true)` to make something work.

**Phase to address:** Foundation/Data Model (RLS is written *with* each table, never bolted on later). Re-verified in Auth phase and every phase that adds a table.

---

### Pitfall 2: Leaking the `service_role` key into the React client

**What goes wrong:**
The `service_role` key **bypasses RLS entirely**. If it lands in the frontend bundle, in a `VITE_`/`NEXT_PUBLIC_` env var, or in a public repo, you've handed out god-mode on your database. Bots scan public bundles and GitHub for these keys.

**Why it happens:**
Devs hit an RLS wall (e.g., an admin action fails a policy), and the fastest "fix" is to swap in the service key. In Vite/CRA, *any* env var prefixed `VITE_` (or `NEXT_PUBLIC_`) is inlined into the client bundle — trivially easy to leak by naming a secret with the public prefix. Admin moderation (approve category, remove fly) genuinely needs elevated access, which creates the temptation.

**How to avoid:**
- The React client gets the **anon key only**, always.
- Admin/elevated operations run in **Supabase Edge Functions** (or a small server) where the service key lives as a *server-side* secret, never a `VITE_`/`NEXT_PUBLIC_` var.
- Model admin as a **role/claim** enforced by RLS (e.g., `is_admin` in a `profiles` table or a JWT claim), so moderation works through the normal anon-key client + policies — no service key needed for most admin UI.
- Add a CI/secret-scan (gitleaks or `git-secrets`) to block committing keys.

**Warning signs:**
- Grep the built `dist/` bundle for the string `service_role` or the key prefix — it should never appear.
- Any env var named `VITE_SUPABASE_SERVICE_*` or `NEXT_PUBLIC_..._SERVICE_*`.
- An admin feature "only works" after switching the client key.

**Phase to address:** Auth phase (define admin role + RLS), Moderation/Admin phase (route elevated ops through Edge Functions).

---

### Pitfall 3: Raw-average ratings are trivially gamed and let low-vote flies top the leaderboard

**What goes wrong:**
Ranking by `AVG(stars)` alone means a fly with a single 5-star rating (possibly from a sockpuppet) outranks a proven fly with 200 ratings averaging 4.6. Leaderboards fill with noise, new/obscure flies dominate, and the "best patterns" promise breaks. This is the core value prop of Flyrate, so getting it wrong is fatal.

**Why it happens:**
`ORDER BY avg_rating DESC` is the obvious first implementation. The statistical problem (small samples have huge variance) isn't visible in a demo with test data.

**How to avoid:**
Use a **Bayesian / weighted average** (the IMDb Top-250 formula):

```
weighted = (v / (v + m)) * R  +  (m / (v + m)) * C
  R = this fly's mean rating
  v = this fly's number of ratings
  C = mean rating across all flies (the prior)
  m = minimum-votes tuning constant (e.g. 10–20 for a small community)
```

- Rank leaderboards by `weighted`, not raw `avg`.
- Still *display* the raw average + vote count on the fly page (users expect to see "4.6 ★ (212)").
- Recompute `C` periodically (nightly cron) — it's a global constant, cheap.
- Consider a hard floor for leaderboard *eligibility* (e.g., ≥5 ratings) in addition to weighting, to keep 1-vote flies off top lists entirely.

**Warning signs:**
- A brand-new fly with 1–2 ratings appears in "top rated."
- Leaderboard reshuffles wildly on every new rating.
- Per-category leaderboards where a category has only a handful of flies look absurd (everything is #1).

**Phase to address:** Rating+Ranking phase — bake the Bayesian formula into the ranking query/column from day one; retrofitting after users see a gamed board erodes trust.

---

### Pitfall 4: Rating fraud — self-rating, sockpuppets/duplicate accounts, and review bombing

**What goes wrong:**
- **Self-rating:** submitter rates their own fly 5 stars.
- **Sockpuppets:** one person makes N accounts to inflate their fly or bomb a rival's.
- **Review bombing:** coordinated 1-star dumps on a fly.
- **Duplicate votes:** same user rating a fly multiple times to move the average.

Any of these makes the leaderboard meaningless.

**Why it happens:**
v1 has minimal moderation by design, and email/password + free social signup makes account creation cheap. The self-rating rule is stated but easy to enforce only in the UI (bypassable) rather than the DB. "One rating per user per fly" is easy to forget as a constraint.

**How to avoid:**
- **DB-level uniqueness:** `UNIQUE (fly_id, rater_id)` on the ratings table — makes duplicate votes impossible, not just hidden. Rating changes become UPDATEs, not new rows.
- **Self-rating blocked in RLS**, not just React: policy requires `fly.submitter_id <> auth.uid()`.
- **Bayesian weighting (Pitfall 3) already dampens** small coordinated pushes because `m` pulls low-vote scores toward the mean.
- Require **email confirmation** before a rating counts (Supabase Auth supports confirmed-email gating) to raise sockpuppet cost.
- Log rater_id + timestamp + IP-ish signal for later abuse review even if v1 doesn't act on it (cheap to add now, painful to backfill).
- Defer heavy anti-fraud (device fingerprinting, velocity checks) — but leave the audit columns.

**Warning signs:**
- A fly's rating count jumps by many votes from accounts created minutes apart.
- Submitter and top rater share IP / signup time.
- Average swings hard right after submission.

**Phase to address:** Rating+Ranking phase (uniqueness constraint + self-rating RLS + email-confirmed gating). Audit columns added here; enforcement tooling deferred to Moderation phase.

---

### Pitfall 5: Client-only React kills SEO for public discovery pages

**What goes wrong:**
Flyrate's whole reach argument is "any visitor can find top-rated flies" — that requires Google to index fly pages, category pages, and leaderboards. A pure client-rendered SPA (Vite + React) ships an empty `<div id="root">`; crawlers and social/link-preview scrapers see no content, no per-fly titles, no meta/OG tags, no fly photo in the share card. Discovery via search never happens.

**Why it happens:**
"React + Supabase" defaults many teams to a client-only SPA (Vite/CRA). SEO isn't visible during dev because you're navigating in-app, not landing cold from Google.

**How to avoid:**
- Use a **framework with SSR/SSG** for public pages: Next.js (App Router) or Remix/React Router in framework mode, or Astro with React islands. Server-render fly detail, category, fish-type, and leaderboard pages so crawlers get real HTML.
- Per-page **`<title>`, meta description, canonical URL, and OpenGraph/Twitter tags** with the fly photo — driven by the fly's data.
- Generate a **sitemap.xml** from the flies/taxonomy tables; add `robots.txt`.
- Use stable, human-readable slugs (`/flies/elk-hair-caddis-<id>`) — decide the URL scheme *before* launch so links don't break later.
- Authenticated app shell (submit, profile, rate) can stay client-rendered; only *public* pages need SSR/SSG.

**Warning signs:**
- "View source" on a fly page shows no fly content, just a script bundle.
- Sharing a fly link in Slack/Discord shows a bare URL with no image/title.
- Google Search Console shows pages indexed with empty/duplicate titles.

**Phase to address:** This is a **stack-shape decision at Foundation** — choosing Next/Remix vs plain Vite. Retrofitting SSR onto a mature Vite SPA is a rewrite. Flag for the STACK research: the SEO requirement effectively rules out a plain client-only SPA for public pages.

---

### Pitfall 6: Unoptimized fly photos — huge uploads, no resizing, EXIF/privacy leaks, runaway cost

**What goes wrong:**
Flies are shot on modern phones (4–12MB, 12–50MP). If you store and serve originals:
- Pages load multi-MB images → slow, especially the photo-grid leaderboards.
- Storage + egress bandwidth costs climb fast (egress is a real Supabase cost line).
- **EXIF GPS coordinates** in phone photos can leak where the user tied/photographed the fly (home location) — a real privacy issue.
- No max-size check → someone uploads a 25MB image (Supabase's transform ceiling) or a huge file that fills your bucket.

**Why it happens:**
"Just upload to Storage and show the URL" is the happy-path tutorial. Resizing/stripping metadata is extra work that's invisible until the bill or a privacy complaint arrives.

**How to avoid:**
- **Resize/compress before or on serve.** Supabase Storage **Image Transformations** (Pro plan, $25/mo) can resize/optimize on the fly via `width/height/quality/resize` params — serve a thumbnail in grids and a bounded max in detail view. Note pricing: 100 origin images included, then $5 per 1,000 origin images, so cache/limit distinct transform origins. (Alternatively resize client-side with `browser-image-compression` before upload — free, and also lets you cap upload size.)
- **Strip EXIF** on upload (client-side canvas re-encode strips it; or a server/Edge step). Do this even if you don't use transforms.
- Enforce a **max file size and allowed MIME types** at upload (client check + Storage policy).
- Set a sane **image size/resolution cap** (Supabase transforms reject >25MB / >50MP anyway).
- Pick the right **bucket visibility**: fly photos → **public bucket** (browse is anonymous, and signed URLs on every image add latency/complexity for no benefit). Only user-private assets (none in v1) would be private. Getting this backwards (private bucket for public photos) breaks anonymous browse or forces signed-URL plumbing everywhere.

**Warning signs:**
- Network tab shows multi-MB image requests on grid pages.
- Storage/egress usage climbing far faster than user count.
- An uploaded photo's metadata still contains GPS.
- Anonymous visitors see broken images (private bucket, no signed URL).

**Phase to address:** Submissions+Storage phase. Bucket visibility and the upload size/EXIF pipeline must be decided when the upload feature is built, not patched after photos accumulate.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Rank by raw `AVG(stars)` | Trivial `ORDER BY` | Gamed leaderboard, broken core value, users lose trust; hard to change after launch | Never for the live leaderboard; fine in an early throwaway prototype only |
| Compute averages live with PostgREST aggregates | No extra columns | PostgREST **aggregate functions are disabled by default** for performance reasons; enabling site-wide is a footgun; N+1/full scans on every leaderboard load | Never rely on it for ranking — use a denormalized column/trigger |
| Enforce self-rating / one-vote only in React | Fast to ship | Bypassable via raw API calls with the anon key → fraud | Never — must be a DB constraint + RLS |
| Plain Vite SPA for everything | Simplest setup | No SEO on public pages → no organic discovery; SSR retrofit ≈ rewrite | Only if public pages are truly not SEO-relevant (not this project) |
| Store/serve original photos | No image pipeline | Slow pages, egress cost, EXIF privacy leak | MVP demo only; fix before real user photos land |
| Free tier, no image transforms | $0 | Transforms need Pro ($25/mo); or add client-side resize | Acceptable if you commit to client-side resize instead |
| No rate limiting on writes | Nothing to build | Bots spam submissions/ratings; DB + moderation flooded | Only pre-launch; add basic write throttling before public |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (OAuth Google/GitHub) | Redirect/callback URL not whitelisted; `Site URL` set to `localhost` in prod → OAuth loops or lands on wrong origin; magic-link/confirm emails point to localhost | Configure **Site URL** + **Additional Redirect URLs** for every environment (local, preview, prod) in Auth settings; set correct provider callback URLs in Google/GitHub consoles |
| Supabase Auth (email/password) | Not gating actions on **confirmed** email → sockpuppets; forgetting to create a `profiles` row on signup | Require confirmed email for rating/submitting; use a DB trigger (`on auth.users insert`) to auto-create the public `profiles` row |
| PostgREST (auto REST API) | **N+1**: fetching flies then a separate request per fly for its rating/category/photos | Use PostgREST **resource embedding** (`select=*,category(*),ratings_summary(*)`) to fetch related data in one request; denormalize the aggregate rating onto the fly row |
| Supabase Storage | Wrong bucket visibility (private for public photos, or public for anything sensitive); no upload size/type policy | Public bucket for fly photos; Storage RLS policies restricting who can upload/overwrite; size + MIME checks |
| Supabase realtime/aggregates | Exposing a **materialized view** to the API for leaderboards | Supabase advisor lint `0016_materialized_view_in_api` warns this **bypasses RLS** — keep MV out of the exposed schema or wrap in a security-defined function/view |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recomputing `AVG`/`COUNT` per request | Leaderboard/detail pages slow; DB CPU spikes | **Denormalize** `avg_rating`, `rating_count`, and `weighted_score` onto the fly row, maintained by a trigger on `ratings` insert/update/delete | A few thousand flies × many ratings |
| N+1 from client loops | Many small REST calls per page | PostgREST embedding + a single `ratings_summary` join | Any list page as fly count grows |
| Unindexed filter/sort columns | Slow category/fish/leaderboard queries | Indexes on `fly_type_id`, `subcategory_id`, `fish_type_id` (join table), and `weighted_score`; composite indexes for common filter+sort combos | Grows with rows; noticeable in low thousands |
| RLS policy calling `auth.uid()` per row | Queries mysteriously slow under RLS | Wrap as `(select auth.uid())` so it's evaluated once per statement | Large table scans |
| Serving original images in grids | Slow first paint, high egress | Thumbnails via transforms / pre-resized variants | First real photo-heavy leaderboard |
| Materialized view refresh cost/staleness | Stale leaderboard or heavy refresh | Trigger-maintained denormalized columns preferred over MV for a small community; if MV, refresh on a modest cron | When you adopt MV without a refresh plan |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Table without RLS reachable by anon key | Full DB read/write to anyone (CVE-2025-48757 class bug) | RLS enabled + policies on every `public` table; Security Advisor in CI |
| `service_role` key in client / `VITE_`/`NEXT_PUBLIC_` env | Total DB compromise | Service key server-side only (Edge Functions); secret-scan in CI |
| Self-rating / duplicate votes enforced only in UI | Leaderboard fraud | `UNIQUE(fly_id, rater_id)` + self-rating check in RLS |
| No write rate limiting | Spam submissions/ratings, moderation flood, cost | Basic per-user/IP throttling (Edge Function or Cloudflare in front); email-confirmed gating |
| EXIF GPS in fly photos | User home-location leak | Strip EXIF on upload |
| Admin actions via broad `USING(true)` policies | Any user performs moderation | Gate admin ops on an `is_admin` claim/role in RLS |
| User-suggested category free-text unsanitized, rendered on public pages | Stored XSS via suggestion/description fields | Escape on render (React does by default — don't `dangerouslySetInnerHTML` recipe/description); validate on write |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Rigid taxonomy with no growth path | Users can't classify a fly; submissions stall | Predefined taxonomy **plus** the "suggest a category" queue (already in scope) — but show pending suggestions so users aren't stuck |
| Suggestion queue with no moderation SLA | Backlog grows; suggested flies stuck in limbo / uncategorized | Let a fly submit with a *pending* category (visible but flagged); admin dashboard with a clear queue; cap or batch approvals |
| Deleting/merging a category orphans flies | Flies vanish or point to a dead category | Use FKs with a deliberate policy: **merge/reassign** on delete (never hard-delete a category with flies); soft-delete + `merged_into` pointer |
| Hiding the vote count | Users can't judge if "4.9★" is 1 vote or 500 | Always show `avg + count`; rank by weighted score |
| Empty leaderboards for sparse categories | New per-category boards look broken | Eligibility floor + "not enough ratings yet" empty state |
| No feedback that a rating requires login/confirmed email | Anonymous users click stars, nothing happens | Clear "sign in to rate" prompt; disabled/tooltip state |

## "Looks Done But Isn't" Checklist

- [ ] **RLS:** Every `public` table has RLS enabled *and* correct read/write policies — verify with Security Advisor and a raw anon-key `curl` probe.
- [ ] **Ranking:** Leaderboards use the **weighted/Bayesian** score, not raw average — verify a 1-vote fly does NOT top the board.
- [ ] **Rating integrity:** `UNIQUE(fly_id, rater_id)` exists and self-rating is blocked *in the DB* — verify by hitting the REST API directly, not just the UI.
- [ ] **OAuth:** Google + GitHub login works from the **production** origin (not just localhost); confirm/reset emails link to prod.
- [ ] **Images:** Grid pages serve resized thumbnails (<~150KB), EXIF stripped, upload size/type capped.
- [ ] **Bucket visibility:** Anonymous visitor can load fly photos with no auth; no sensitive bucket left public.
- [ ] **SEO:** `view-source` on a fly page shows real content + per-page title/meta/OG image; sitemap.xml exists.
- [ ] **Taxonomy safety:** Deleting a category doesn't orphan/hide flies (FK policy tested).
- [ ] **Write throttling:** Rapid repeat submissions/ratings from one account are limited.
- [ ] **N+1:** A leaderboard page issues a bounded number of requests (check network tab), not one-per-fly.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS missing in prod | HIGH | Rotate anon key won't help (it's meant to be public) — immediately enable RLS + policies on all tables, audit access logs, assume data was read |
| `service_role` key leaked | HIGH | Rotate the service key in dashboard immediately, purge from git history (BFG), audit for data changes |
| Leaderboard already gamed / raw-avg shipped | MEDIUM | Add weighted-score column + backfill; swap ranking query; announce the change; optionally purge sockpuppet ratings |
| Duplicate/self ratings in data | MEDIUM | Add `UNIQUE` constraint (dedupe existing rows first), add RLS self-rating check, recompute aggregates |
| SSR/SEO not designed in (plain Vite SPA) | HIGH | Migrate public pages to Next/Remix or add a prerender layer — effectively a partial rewrite; cheap only if caught at Foundation |
| Originals stored, no resize | MEDIUM | Enable Storage transforms or batch-reprocess existing images; strip EXIF retroactively (privacy exposure already happened) |
| Category deleted, flies orphaned | MEDIUM | Restore from backup or reassign orphans to a fallback category; add merge-not-delete policy going forward |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Missing/misconfigured RLS | Foundation/Data Model (+ every table-adding phase) | Security Advisor clean; anon-key curl probe returns only intended data |
| service_role key leak | Auth + Moderation/Admin | Built bundle has no service key; admin ops run in Edge Functions |
| Raw-average gaming / low-vote topping | Rating+Ranking | 1-vote fly not on top board; ranking query uses weighted score |
| Self-rating / sockpuppet / duplicate votes | Rating+Ranking (constraints) + Moderation (enforcement) | Direct REST API can't create dup/self rating |
| Client-only React SEO gap | Foundation (stack choice: SSR framework) | view-source shows content; sitemap + per-page meta present |
| Unoptimized images / EXIF / bucket visibility / cost | Submissions+Storage | Thumbnails served; EXIF stripped; anonymous photo load works; upload size capped |
| Rigid taxonomy / orphaned data / moderation backlog | Foundation (schema + FK policy) + Moderation (queue UI) | Category delete doesn't orphan; suggestion queue has a workflow |
| N+1 / unindexed queries | Rating+Ranking / Discovery | Bounded request count; indexes present; denormalized aggregates |
| No write rate limiting | Moderation/Admin (or pre-launch hardening) | Repeat writes throttled |
| OAuth redirect misconfig | Auth | Social login works from prod origin |

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS defaults, anon-key exposure
- [Securing your API | Supabase Docs](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Security Retro: 2025 / CVE-2025-48757](https://supabase.com/blog/supabase-security-2025-retro) — 10.3% of AI apps leaking via missing RLS
- [Enable RLS by default discussion #21747](https://github.com/orgs/supabase/discussions/21747) — RLS not on by default nuance
- [Storage Image Transformations | Supabase Docs](https://supabase.com/docs/guides/storage/serving/image-transformations) — resize on the fly, Pro plan
- [Manage Storage Image Transformations usage | Supabase Docs](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations) — 100 origin images, $5/1,000
- [PostgREST Aggregate Functions | Supabase Blog](https://supabase.com/blog/postgrest-aggregate-functions) — aggregates disabled by default, perf risk
- [Database Advisors: materialized_view_in_api lint](https://supabase.com/docs/guides/database/database-advisors?lint=0016_materialized_view_in_api) — MV in API bypasses RLS
- [Optimize Read Performance with Materialized Views (DEV)](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5)
- IMDb weighted-rating (Bayesian) formula — established ranking pattern for small-sample averages
- [Vibeappscanner: Supabase RLS common mistakes & (select auth.uid()) trap](https://vibeappscanner.com/supabase-row-level-security)

---
*Pitfalls research for: community fly-tying rating/catalog app (React + Supabase)*
*Researched: 2026-07-01*
