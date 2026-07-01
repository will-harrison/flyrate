# Feature Research

**Domain:** Community fly-tying rating/catalog web app (user-generated submissions + community rating + discovery)
**Researched:** 2026-07-01
**Confidence:** HIGH (fly-tying taxonomy and rating-algorithm findings verified against multiple industry sources; UGC moderation/discovery patterns are well-established SaaS conventions)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Anonymous browse + fly detail page | Discovery is the reason non-tyers visit; gating browse kills reach | LOW | Supabase RLS: public read on approved flies. Detail page = photos + recipe + description + rating + tyer link |
| Email/password + Google/GitHub auth | Modern baseline; social login reduces signup friction | LOW | Supabase Auth handles all three out of the box. Main work is UI + redirect/callback wiring |
| Photo upload (1+ per fly) | Flies are rated visually — "photo-centric" is core to the value prop | MEDIUM | Supabase Storage. Needs client-side resize/compress, aspect handling, thumbnail generation, and a primary/cover image. Real work is UX polish, not the upload call |
| Structured tying recipe (materials, hook, thread, bead, etc.) | Recipe is the reusable artifact tyers actually want; free-text alone isn't searchable | MEDIUM | Model as ordered component rows (see taxonomy section). Balance structure vs. friction — too many required fields kills submissions |
| Free-text description (how/when to fish, tips) | Context a structured recipe can't capture | LOW | Single rich-ish textarea; sanitize on render |
| Tying difficulty level | Buyers/learners filter by skill; universal in tying content (beginner→advanced) | LOW | Enum: Beginner / Intermediate / Advanced. Cheap, high filter value |
| Fly-type + subcategory + target fish assignment | The organizing spine of the whole catalog | MEDIUM | Predefined taxonomy tables; fly = 1 type/subcategory + 1..N fish. Junction table for fish |
| 1–5 star rating, one per user, not own fly | The core feedback loop; self-rating and multi-rating are the obvious cheats | MEDIUM | Unique constraint (fly_id, user_id); DB/RLS check rater ≠ author. Allow rating updates (upsert) |
| Display average rating + rating count | Users distrust an average with no vote count; count signals credibility | LOW | Show both. Count is also the input to weighted ranking (below) |
| Search + filter by fly type / subcategory / fish | Primary discovery path ("show me trout nymphs") | MEDIUM | Faceted filters, not just free-text. Postgres indexes on taxonomy FKs; text search on name/description |
| Global + per-category + per-fish leaderboards | Explicit product requirement; the "discover the best" half of the loop | MEDIUM | Same ranked query, different WHERE clause. **Must use weighted score, not raw average** (see differentiators) |
| Trending / recent view | New content needs a surface; raw leaderboards freeze out new flies | MEDIUM | "Recent" = order by created_at (trivial). "Trending" = recency-weighted rating velocity (harder — can start as "recent") |
| Public profile (submissions + rating history) | Recognition is a core motivator for tyers; expected on any community platform | LOW–MEDIUM | Two lists on a `/u/:handle` page. Cheap once flies/ratings exist |
| Admin: approve/reject suggested categories | Keeps taxonomy clean while letting it grow (explicit requirement) | LOW | Status enum on category rows; simple admin table view |
| Admin: remove inappropriate fly/rating | Minimum viable moderation; someone must be able to pull bad content | LOW | Soft-delete (status flag) beats hard delete — preserves rating integrity + audit trail |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Bayesian/weighted ranking** (not raw average) | A fly with one 5-star rating shouldn't outrank a fly with fifty 4.6s. This is THE credibility feature for leaderboards | MEDIUM | Formula: `(C·m + Σrᵢ) / (C + n)` where m = site-wide mean rating, C = confidence prior (e.g. 5–10 votes), n = this fly's vote count. Low-vote flies pulled toward the mean, resisting single-vote gaming. Compute in a view / materialized view / scheduled function |
| Structured, filterable recipe schema | Turns Flyrate into a searchable pattern *database* ("nymphs using tungsten bead + pheasant tail"), not just a photo gallery | MEDIUM–HIGH | Requires a materials vocabulary/taxonomy to be filterable. Start free-text-ish, add structured facets after validation |
| Rich taxonomy with real-world fly categories + subcategories | Domain credibility; anglers immediately trust a site that models their world correctly | LOW (data) | The taxonomy below is the differentiator — most generic "rating apps" get this wrong. Seed it well |
| Difficulty-based discovery ("flies I can actually tie") | Beginners self-select; strong onboarding/retention hook distinct from pure "best flies" | LOW | Just a filter on the difficulty enum — cheap differentiator |
| Copy/print-friendly recipe card | Tyers want the pattern at the vise; a clean printable recipe is a real utility | LOW | CSS print stylesheet or a formatted card view |
| "Also effective for" multi-fish tagging | Reflects reality (a Woolly Bugger catches everything); improves cross-discovery | LOW | Already implied by 1..N fish tagging — lean into it in UI |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Comments / discussion threads on flies | "Community" implies conversation | Moderation burden explodes; spam/abuse surface; dilutes the rating-as-signal model. Already Out of Scope in PROJECT.md | Rating + count is the v1 feedback signal. Add threaded comments only after volume + moderation capacity exist |
| Social following / activity feeds | Standard "community" pattern | Feed infra + follow graph is real work; distracts from the rate-and-discover core. Out of Scope per PROJECT.md | Profiles give recognition without a feed. Revisit in v2 |
| Community flagging/reporting workflow | Scales moderation | Needs a triage queue + abuse handling before there's any volume to justify it. Out of Scope per PROJECT.md | Admin-only removal for v1; add flagging once submission volume is real |
| Free-form user-typed categories | "Let users organize their own way" | Taxonomy fragments instantly (dry/Dry/dryfly/"dry fly"); leaderboards become meaningless | Predefined taxonomy + *suggestion queue* with admin approval (already the chosen design) |
| Raw average rating for ranking | Simplest to compute; "fair" | Trivially gamed — one 5-star vote tops the board; new flies with 1 vote dominate | Bayesian/weighted average with a vote-count prior (see differentiators) |
| Half-stars / 10-point / decimal ratings | "More precision" | Higher cognitive cost per rating → fewer ratings; false precision on a subjective judgment | Whole 1–5 stars. Precision comes from *volume*, not scale granularity |
| AI auto-moderation pipeline for v1 | "Scale moderation from day one" | Cost + integration complexity with near-zero volume at launch; over-engineering | Manual admin removal for v1. Add AI pre-screen (Rekognition/WebPurify-style) only if upload volume warrants |
| Marketplace / selling flies | Natural-seeming monetization | Payments, disputes, shipping, tax, liability — an entirely different product. Out of Scope per PROJECT.md | Keep Flyrate a rating catalog. Link out if commerce is ever wanted |
| Preserving EXIF/GPS in stored photos | "Keep original quality" | Leaks users' fishing-spot GPS + camera metadata (privacy + safety issue for anglers) | Strip EXIF on upload/resize; store only the derived image |

## Feature Dependencies

```
Auth (accounts)
    └──requires──> Public Profiles
    └──requires──> Fly Submission
                       └──requires──> Photo Upload (Storage)
                       └──requires──> Taxonomy (fly types / subcategories / fish)
                                          └──requires──> Category Suggestion + Admin Approval
    └──requires──> Rating (1–5, one-per-user, not-own)
                       └──requires──> Fly Submission
                       └──requires──> Weighted/Bayesian Ranking
                                          └──requires──> Leaderboards (global / per-category / per-fish)
                                          └──enhances──> Trending view

Taxonomy ──requires──> Search & Faceted Filter
Fly Submission + Rating ──feed──> Public Profile (submission + rating history)
Admin Moderation (remove) ──enhances──> all public surfaces (keeps them clean)
Rating raw-average ──conflicts──> Weighted ranking (do NOT ship raw average for leaderboards)
```

### Dependency Notes

- **Taxonomy is foundational.** Submission, search, filters, and every leaderboard depend on it. Seed and lock the schema early — it is the spine of the data model (PROJECT.md calls it "first-class, evolving").
- **Ranking depends on Rating, and Leaderboards depend on Ranking.** Build the weighted-score computation *before* leaderboards, or leaderboards will be wrong and gameable from day one.
- **Category suggestion depends on Taxonomy existing + Admin approval flow.** It's a write path into the taxonomy; sequence it after the read/browse taxonomy works.
- **Profiles are cheap but depend on Submissions + Ratings existing** to have anything to show. Sequence them after the core loop.
- **Photo upload is on the submission critical path** and carries the most hidden UX work (resize, thumbnails, EXIF strip, primary image). Don't underestimate it.
- **Trending enhances but does not require** a separate algorithm at launch — ship "Recent" first, upgrade to velocity-based "Trending" later.

## MVP Definition

### Launch With (v1) — the submit → rate → discover loop

- [ ] Auth: email/password + Google/GitHub — gate for submit/rate
- [ ] Predefined taxonomy (fly types + subcategories + fish), seeded (see below)
- [ ] Fly submission: photo(s) + structured recipe + description + difficulty + taxonomy assignment
- [ ] Photo upload/display with resize + EXIF strip + primary image
- [ ] 1–5 star rating, one-per-user, cannot rate own fly; show average + count
- [ ] **Weighted/Bayesian ranking** feeding all leaderboards
- [ ] Leaderboards: global, per-category, per-fish
- [ ] Recent view (trending deferred to velocity later)
- [ ] Anonymous browse + faceted search/filter by fly type / subcategory / fish (+ difficulty)
- [ ] Public profile: submission + rating history
- [ ] Category suggestion → admin approval queue
- [ ] Admin: approve/reject categories; remove fly/rating (soft-delete)

### Add After Validation (v1.x)

- [ ] Velocity-based "Trending" — trigger: enough submission volume that "Recent" feels noisy
- [ ] Structured/faceted recipe search (materials vocabulary) — trigger: recipes are rich enough to be worth querying
- [ ] Printable/copyable recipe card — trigger: user requests to "use it at the vise"
- [ ] AI image pre-moderation — trigger: upload volume exceeds manual admin capacity

### Future Consideration (v2+)

- [ ] Comments/discussion — defer: moderation cost; rating is the v1 signal (Out of Scope)
- [ ] Social following / activity feed — defer: not core to rate-and-discover (Out of Scope)
- [ ] Community flagging/reporting — defer: needs volume to justify triage tooling (Out of Scope)
- [ ] Native mobile apps — defer: responsive web only for v1 (Out of Scope)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth (email + social) | HIGH | LOW | P1 |
| Taxonomy (seeded) | HIGH | LOW | P1 |
| Fly submission + structured recipe | HIGH | MEDIUM | P1 |
| Photo upload/display (+EXIF strip) | HIGH | MEDIUM | P1 |
| Rating (1–5, one-per-user, not-own) | HIGH | MEDIUM | P1 |
| Weighted/Bayesian ranking | HIGH | MEDIUM | P1 |
| Leaderboards (global/category/fish) | HIGH | MEDIUM | P1 |
| Faceted search/filter | HIGH | MEDIUM | P1 |
| Anonymous browse + detail page | HIGH | LOW | P1 |
| Public profiles | MEDIUM | LOW | P1 |
| Category suggestion + admin approval | MEDIUM | LOW | P1 |
| Admin moderation (remove) | MEDIUM | LOW | P1 |
| Recent view | MEDIUM | LOW | P1 |
| Difficulty filter | MEDIUM | LOW | P1 |
| Trending (velocity) | MEDIUM | MEDIUM | P2 |
| Structured recipe search | MEDIUM | HIGH | P2 |
| Printable recipe card | LOW–MEDIUM | LOW | P2 |
| AI image pre-moderation | MEDIUM | MEDIUM | P2 |
| Comments / following / flagging | LOW (v1) | HIGH | P3 |

## Proposed Starter Taxonomy

Seed this on day one; it is the differentiating domain model. Categories are widely standardized across fly-fishing sources (Orvis, TCO, Jackson Hole Fly Co, Peaks Fly Fishing).

### Fly Types → Subcategories

| Fly Type | Description | Suggested Subcategories |
|----------|-------------|-------------------------|
| **Dry Fly** | Floats on the surface; imitates hatching/adult insects | Mayfly, Caddis, Stonefly, Terrestrial (hopper/ant/beetle), Attractor, Midge Adult |
| **Nymph** | Subsurface immature insect stage (most productive for trout) | Mayfly Nymph, Caddis (Larva/Pupa), Stonefly Nymph, Midge/Zebra, Attractor (e.g. Prince), Euro/Jig |
| **Emerger** | Insect transitioning nymph→adult in the surface film | Mayfly Emerger, Caddis Emerger, Midge Emerger, Cripple/Stillborn |
| **Wet Fly** | Subsurface, fished swung across current | Soft Hackle, Winged Wet, Flymph, Spider |
| **Streamer** | Imitates baitfish/leeches/sculpins; larger swimming prey | Woolly Bugger, Baitfish/Minnow, Sculpin, Leech, Articulated |
| **Terrestrial** | Land insects that fall to the water (can overlap with dry) | Hopper, Ant, Beetle, Cricket |
| **Saltwater** | Patterns for saltwater species | Clouser/Baitfish, Shrimp/Crab, Popper/Diver, Deceiver |
| **Warmwater/Bass** | Bass & panfish patterns | Popper, Diver, Frog, Bass Streamer |
| **Salmon/Steelhead** | Anadromous-species patterns | Classic/Spey, Intruder, Egg, Steelhead Nymph |

> Note the deliberate overlap (e.g. Terrestrial appears as both a dry-fly subcategory and a top-level type). Pick one canonical placement per subcategory in the data model to keep leaderboards unambiguous; the suggestion queue lets the taxonomy evolve.

### Target Fish Types (seed set)

Trout (Rainbow / Brown / Brook / Cutthroat can be one "Trout" or split later), Steelhead, Salmon, Largemouth Bass, Smallmouth Bass, Panfish (Bluegill/Crappie), Pike/Musky, Carp, Redfish, Bonefish, Tarpon, Striped Bass, Grayling.

### Difficulty (enum)

Beginner · Intermediate · Advanced.

### Structured Recipe Schema (component-based)

Model a recipe as **fly-level fields** plus **ordered material rows** — this matches how patterns are actually written (tail → body/abdomen → thorax → hackle → wing → head).

- **Fly-level fields:** `hook_type`, `hook_size` (range, e.g. #12–#16), `thread` (color/size), `weight` (bead/wire — optional).
- **Material rows (ordered):** `position` (Tail, Rib, Abdomen/Body, Thorax, Hackle, Wing, Head, Legs, Bead — enum) + `material` (free-text or, later, controlled vocabulary) + optional `color`/`notes`.

Start `material` as free-text to minimize submission friction; promote to a controlled, filterable vocabulary in v1.x once there's data to structure (this is the path to "search by material").

## Competitor / Reference Feature Analysis

| Feature | IMDb / rating sites | UGC catalogs (recipe/pattern sites, Global FlyFisher) | Flyrate Approach |
|---------|---------------------|-------------------------------------------------------|------------------|
| Ranking algorithm | Weighted/Bayesian average; extra weighting on unusual activity | Often raw average or curated editorial | **Bayesian weighted average** with vote-count prior |
| Rating scale | 1–10 (IMDb) | 5-star common | **1–5 whole stars** (lower friction) |
| Taxonomy | Genre tags | Fly-type + species categories | **Rich predefined fly-type/subcategory + fish taxonomy** with suggestion queue |
| Moderation | Automated + human review at scale | Editorial / admin approval | **Admin-only removal + category approval** for v1; AI pre-screen later |
| Content structure | Metadata + media | Step-by-step recipe + photos | **Structured recipe rows + photos + description + difficulty** |

## Sources

- [Peaks Fly Fishing — Difference Between Dry, Wet, Nymph, Streamer, Emerger](https://www.peaksflyfishing.com/the-difference-between-dry-flies-wet-flies-nymphs-streamers-and-emergers/)
- [TCO Fly Shop — Understanding the Different Types of Fly Patterns](https://www.tcoflyfishing.com/blogs/flies-fly-tying/understanding-the-different-types-of-fly-patterns)
- [Jackson Hole Fly Company — 6 Key Fly Categories & Effective Patterns](https://jacksonholeflycompany.com/blogs/fly-fishing-tips/exploring-6-key-fly-categories-effective-patterns)
- [Orvis — Nymph Fly Patterns (fly-tying videos)](https://howtoflyfish.orvis.com/fly-tying-videos/nymph-flies)
- [Hatch Magazine — 12 flies that catch trout and more anywhere](https://www.hatchmag.com/articles/dirtier-dozen-12-flies-will-catch-trout-and-more-anywhere/7714954)
- [Trout & Feather — Fly Tying Techniques (recipe structure: tail/abdomen/thorax/hackle)](https://www.troutandfeather.com/fly-tying-techniques)
- [IMDb Help — Weighted Average Ratings](https://help.imdb.com/article/imdb/track-movies-tv/weighted-average-ratings/GWT2DSBYVT2F25SK)
- [Arpit Bhayani — Building Better Ratings with Bayesian Averages](https://arpitbhayani.me/blogs/bayesian-average/)
- [Asgard AI — Bayesian Average Rating (formula + gaming resistance)](https://vault.asgard-ai.com/skills/skill-algo-rank-bayesian/)
- [Cloudinary — Automating Image Moderation (upload→moderate→store workflow)](https://cloudinary.com/blog/how_to_automate_image_moderation_with_amazon_rekognition)
- [Higher Logic — Manage Your Site's Moderation Queue](https://support.higherlogic.com/hc/en-us/articles/360032694632-Manage-Your-Site-s-Moderation-Queue)

---
*Feature research for: community fly-tying rating/catalog web app*
*Researched: 2026-07-01*
