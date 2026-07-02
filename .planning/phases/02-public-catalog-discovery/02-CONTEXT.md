# Phase 2: Public Catalog & Discovery - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the **public, anonymous, SEO-crawlable** discovery surface on top of Phase 1's data and taxonomy: any visitor with no account can browse the fly catalog, narrow it by taxonomy (fly type, subcategory, target fish) and difficulty, run a search, and open a full fly detail page — all rendered server-side as crawlable HTML with per-page metadata and a sitemap. Covers requirements **DISC-01…DISC-06** (MVP mode).

**In scope:** the catalog index (at `/`), crawlable per-taxonomy landing pages, combined filtering, search, the public treatment of the existing `/flies/[id]` detail page, and SEO plumbing (metadata, OG, sitemap, structured data).

**Explicitly NOT in this phase:**
- Rating submission, average/count math, Bayesian score, leaderboards, "recent/trending" ranking → **Phase 3**. The detail page keeps Phase 1's read-only "No ratings yet" star stub; default catalog sort is a temporary stand-in until ratings exist.
- Any authenticated/owner-only views, profile submission history, taxonomy suggestions, moderation → **Phase 4**.
- Editing/deleting a submitted fly.
</domain>

<decisions>
## Implementation Decisions

### Catalog landing & ordering
- **D-01:** The **catalog IS the homepage** (`/`). The root route renders the browsable fly grid directly, with search and filter controls present — no separate marketing landing page. Fastest path to core value and strongest root-domain SEO.
- **D-02:** Default catalog ordering is **newest-submitted first** (`created_at desc`). This is an explicit temporary stand-in because community ratings don't exist until Phase 3; Phase 3 replaces the default sort with a rating-based order. Rewards submitters and keeps the catalog feeling alive at launch.
- **D-03:** Fly cards lead with the submitter-chosen **primary/cover photo** (carried from Phase 1 D-04). Photo-first card grid consistent with the Phase 1 UI-SPEC (shadcn new-york / neutral, photo-forward, minimal).

### Filtering & URL structure
- **D-04:** **Dedicated crawlable taxonomy routes** are the primary SEO surface: per-fly-type and per-subcategory pages (e.g. `/flies/type/[slug]`, and subcategory under it) and per-fish pages (e.g. `/fish/[slug]`), each server-rendered with its own title/meta/OG so each category and fish has a distinct crawlable landing page (per CLAUDE.md's per-category/per-fish crawlability requirement). *(Exact route shapes/nesting are an implementation detail for research/planning — the decision is "dedicated routes per taxonomy dimension exist and are SSR/crawlable.")*
- **D-05:** **Combined refinement uses query params** layered on top of those routes (e.g. `?difficulty=&fish=` on a type page, `?difficulty=` etc.). Filters are combinable across dimensions (type/subcategory + fish + difficulty). The canonical crawlable entities are the taxonomy landing pages; param-refined views are the interactive combination layer.
- **D-06:** Filter controls are a **left sidebar facet panel** on desktop that collapses to a **drawer/sheet on mobile**, with grouped controls for fly type, subcategory, target fish, and difficulty. Subcategory options are constrained to the selected fly type (mirrors the Phase 1 submit cascade).

### Search
- **D-07:** Search matches **fly name + taxonomy names** (fly type, subcategory, target fish) — so both `caddis` (name) and `trout`/`nymph` (taxonomy) return relevant flies. It does **not** search recipe material rows or description text in this phase.
- **D-08:** Search is implemented with **Postgres full-text search** (a `tsvector` over name + associated taxonomy names, with ranking/stemming so `nymphs` matches `nymph`). Results are **URL-driven and server-rendered** (e.g. `?q=`) so the searched view is itself crawlable/shareable — not a client-only instant filter. *(Index/column mechanics are for research/planning.)*

### Fly detail page & SEO
- **D-09:** Public `/flies/[id]` presents photos as a **large cover photo + thumbnail grid, with a click-to-open lightbox** (full-size dialog). Photo-first showcase befitting hand-tied flies.
- **D-10:** **Full SEO treatment:** dynamic per-page `title`/`meta`/OG tags for the catalog, every taxonomy landing page, and every fly detail page; a `sitemap.xml`; **and JSON-LD structured data** (schema.org) on fly detail pages (and images) for rich-result eligibility.
- **D-11 (discovery internal-linking):** Detail and taxonomy pages should cross-link for discovery + SEO — e.g. a fly's type/subcategory/fish badges link to their taxonomy pages, and detail pages surface "related flies" (same type or shared fish). Treated as expected behavior; exact placement is Claude's discretion within the UI-SPEC.

### Claude's Discretion
- Exact route path shapes and nesting for taxonomy pages (D-04), the full-text index/column design and ranking config (D-08), pagination vs. load-more on the grid, breadcrumb styling, empty/zero-result copy for catalog/search/filter-combos, and "related flies" selection heuristic and placement (D-11) — all delegated to research/planning within the locked decisions and the Phase 1 UI-SPEC.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & scope
- `.planning/PROJECT.md` — product definition, personas, core value (submit → rate → discover), Key Decisions table, constraints.
- `.planning/ROADMAP.md` §"Phase 2: Public Catalog & Discovery" — goal, success criteria, DISC-01…06 mapping, `Mode: mvp`, `UI hint: yes`.
- `.planning/REQUIREMENTS.md` — DISC-01…06 definitions and traceability.
- `.claude/CLAUDE.md` — LOCKED stack + the load-bearing guidance for this phase: **public SEO-critical catalog → RSC/SSR/SSG (not SPA)**, anon-key public reads via RLS `USING (true)`, "Computing average ratings in the client" anti-pattern (relevant boundary with Phase 3), Storage `getPublicUrl` for photos.

### Phase 1 foundation this phase builds on
- `.planning/phases/01-foundation-submit/01-UI-SPEC.md` — design contract (spacing/type/color tokens, shadcn new-york/neutral, component inventory, copywriting). Catalog + detail UI MUST conform.
- `.planning/phases/01-foundation-submit/01-SKELETON.md` — architectural decisions (SSR/RSC, `@supabase/ssr` clients, feature-folder layout, taxonomy = lookup tables).
- `.planning/phases/01-foundation-submit/01-04-SUMMARY.md` and migrations `supabase/migrations/0003_taxonomy.sql`, `0004_taxonomy_seed.sql`, `0005_flies_photos_and_rls.sql`, `0006_storage_bucket.sql` — the actual flies/photos/materials/junction schema, taxonomy seed, public-read RLS, and photo storage this phase queries.

*(No external ADRs/specs beyond the planning docs above — requirements fully captured in decisions here + ROADMAP/REQUIREMENTS.)*
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/flies/[id]/page.tsx` — the fly detail page ALREADY EXISTS (author-visible, SSR). Phase 2 extends it: make it publicly reachable, add the lightbox gallery (D-09), metadata/OG/JSON-LD (D-10), and discovery links (D-11). The joined `FLY_SELECT` query (type/subcategory/materials/photos/fish embed) is a strong starting point.
- `src/features/submit/taxonomy.ts` (`fetchTaxonomy`) — server-side taxonomy fetch with `subcategoriesByFlyType` pre-grouping; directly reusable to populate the filter sidebar (D-06) and taxonomy routes (D-04).
- `src/lib/supabase/server.ts` — anon server client for SSR reads (public-read RLS already allows anonymous SELECT on flies/taxonomy/photos).
- shadcn components vendored in `src/components/ui/*` (Badge, Card, Alert, etc.) + the UI-SPEC — reuse for cards, facet controls, lightbox dialog.
- Storage `fly-photos` public bucket + `getPublicUrl` pattern — reuse for card/detail image URLs.

### Established Patterns
- RLS public-read (`USING (true)`) on flies, taxonomy, photos, materials, junction — anonymous SSR reads work with the anon key; no new policies needed for reads.
- Taxonomy = lookup tables with slugs (`fly_types.slug`, `fly_subcategories.slug`, `fish_types.slug`) — slugs already exist, enabling the D-04 taxonomy routes without a schema change.
- Hand-authored `src/types/database.types.ts` (regenerated locally via `supabase gen types`) — extend/consume for new query shapes.

### Integration Points
- Full-text search (D-08) likely needs a migration (generated `tsvector` column + GIN index over name + taxonomy names) — new SQL migration continuing the `000N` sequence.
- Home route `src/app/page.tsx` (currently a placeholder) becomes the catalog grid (D-01).
- New routes: catalog filtering/search on `/`, taxonomy landing pages (`/flies/type/[slug]`, `/fish/[slug]`), `sitemap.ts`, and metadata via App Router `generateMetadata`.
</code_context>

<specifics>
## Specific Ideas

- Anglers search by concept as much as by name ("nymph", "trout", "caddis") — the name+taxonomy search scope (D-07) is deliberately tuned to that behavior.
- Each fly type and each fish should own a distinct, shareable, crawlable URL (D-04) — this is both an SEO lever and the natural "browse by what I fish for" entry point from the product vision.
</specifics>

<deferred>
## Deferred Ideas

- **Sort by rating / trending / "recent" ranking** — depends on ratings; Phase 3. (Phase 2 default sort is newest-first as a stand-in — D-02.)
- **Searching recipe materials / description text** (e.g. "flies using pheasant tail") — considered for search scope but deferred to keep the index focused; revisit as a v2 discovery enhancement (relates to SUB-08 faceted material search noted in Phase 1's out-of-scope).
- **Rating display beyond the stub** (stars, counts, distribution on cards/detail) — Phase 3.
- **User taxonomy suggestions affecting available filters** — Phase 4.

*Discussion otherwise stayed within phase scope.*
</deferred>

---

*Phase: 2-public-catalog-discovery*
*Context gathered: 2026-07-02*
