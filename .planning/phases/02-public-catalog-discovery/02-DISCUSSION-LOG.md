# Phase 2: Public Catalog & Discovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 2-public-catalog-discovery
**Areas discussed:** Catalog landing & sort, Filter & URL structure, Search behavior, Detail page & SEO polish

---

## Catalog landing & sort

| Option | Description | Selected |
|--------|-------------|----------|
| / IS the catalog | Homepage renders the browsable fly grid directly with search + filters | ✓ |
| Separate /flies index | '/' is a light landing page; catalog lives at /flies | |

**User's choice:** / IS the catalog

| Option | Description | Selected |
|--------|-------------|----------|
| Newest first | Most recently submitted flies lead; swaps to rating-sorted in Phase 3 | ✓ |
| Random / rotating | Shuffled/rotating featured order | |
| Alphabetical | Sorted by fly name A–Z | |

**User's choice:** Newest first
**Notes:** Explicitly a temporary stand-in — community ratings don't exist until Phase 3.

---

## Filter & URL structure

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated routes + params | Crawlable /flies/type/[slug] & /fish/[slug] pages (own title/meta) + query params for combined refinement | ✓ |
| Query params only | Single /flies page with ?type=&subcategory=&fish=&difficulty= | |

**User's choice:** Dedicated routes + params
**Notes:** Aligns with CLAUDE.md's per-category/per-fish crawlability requirement.

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar facets | Left facet panel on desktop, drawer/sheet on mobile; grouped checkboxes | ✓ |
| Top filter chips | Row of chips/pills opening popovers | |
| Toolbar dropdowns | Horizontal toolbar of dropdown selects | |

**User's choice:** Sidebar facets

---

## Search behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Name + taxonomy | Match fly name plus type/subcategory/fish names | ✓ |
| Name only | Match the fly name only | |
| Name + recipe + description | Also search material rows and description text | |

**User's choice:** Name + taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Submit → ?q= (ILIKE) | Server-side ILIKE at a crawlable ?q= URL | |
| Full-text search | Postgres tsvector with ranking + stemming | ✓ |
| Instant / type-ahead | Client-debounced results as you type | |

**User's choice:** Full-text search
**Notes:** Results remain URL-driven/SSR (?q=) so the searched view is crawlable — full-text is the matching mechanism, not a client-only instant filter.

---

## Detail page & SEO polish

| Option | Description | Selected |
|--------|-------------|----------|
| Grid + lightbox | Cover photo large, thumbnails below, click opens full-size lightbox | ✓ |
| Static grid | Cover photo + thumbnail grid, no lightbox | |
| Carousel | Swipeable/arrow carousel | |

**User's choice:** Grid + lightbox

| Option | Description | Selected |
|--------|-------------|----------|
| Full + JSON-LD | Per-page title/meta/OG + sitemap.xml + JSON-LD structured data | ✓ |
| Meta + sitemap | Per-page meta/OG + sitemap, no JSON-LD | |
| Basic meta only | Title + description meta only | |

**User's choice:** Full + JSON-LD

---

## Claude's Discretion

- Exact taxonomy route shapes/nesting; full-text index/column design + ranking config; pagination vs. load-more; breadcrumb styling; empty/zero-result copy; "related flies" heuristic and placement — all delegated to research/planning within the locked decisions and Phase 1 UI-SPEC.

## Deferred Ideas

- Sort by rating / trending / "recent" — Phase 3.
- Searching recipe materials / description text — deferred (relates to v2 SUB-08 faceted material search).
- Rating display beyond the read-only stub — Phase 3.
- User taxonomy suggestions affecting filters — Phase 4.
