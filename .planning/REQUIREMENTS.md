# Requirements: Flyrate

**Defined:** 2026-07-01
**Core Value:** A user can submit a fly and have it rated by the community, and any visitor can find the top-rated flies for a given fly type or target fish.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup and must confirm before rating/submitting
- [ ] **AUTH-03**: User can sign in with Google (OAuth)
- [ ] **AUTH-04**: User can sign in with GitHub (OAuth)
- [x] **AUTH-05**: User session persists across browser refresh
- [ ] **AUTH-06**: User can sign out from any page

### Profiles

- [x] **PROF-01**: Every registered user has a public profile page
- [ ] **PROF-02**: A profile shows the user's submission history
- [ ] **PROF-03**: A profile shows the user's rating history

### Submission

- [x] **SUB-01**: A signed-in user can submit a fly with one or more photos
- [x] **SUB-02**: A submission includes a structured tying recipe (ordered material rows plus hook size and thread)
- [x] **SUB-03**: A submission includes a free-text description
- [x] **SUB-04**: A submission includes a tying difficulty level (beginner/intermediate/advanced)
- [x] **SUB-05**: A submission is assigned one fly type and subcategory
- [x] **SUB-06**: A submission is assigned one or more target fish types
- [x] **SUB-07**: Fly photos are compressed and have EXIF/GPS metadata stripped before upload

### Taxonomy

- [x] **TAX-01**: Fly types, subcategories, and fish types come from a predefined, admin-managed taxonomy
- [ ] **TAX-02**: A signed-in user can suggest a new fly category or fish type
- [ ] **TAX-03**: Category suggestions are queued as pending until an admin acts on them

### Rating

- [ ] **RATE-01**: A signed-in user can rate another user's fly from 1 to 5 stars
- [ ] **RATE-02**: A user cannot rate their own fly
- [ ] **RATE-03**: A user has at most one rating per fly, and can change it
- [ ] **RATE-04**: A fly displays its average star rating and number of ratings
- [ ] **RATE-05**: Each fly has a weighted (Bayesian) ranking score used for ordering, resistant to low-vote and self-rating gaming

### Discovery

- [ ] **DISC-01**: Anyone can browse and search flies without an account
- [ ] **DISC-02**: A visitor can filter flies by fly type
- [ ] **DISC-03**: A visitor can filter flies by subcategory
- [ ] **DISC-04**: A visitor can filter flies by target fish type
- [ ] **DISC-05**: A visitor can filter flies by difficulty level
- [ ] **DISC-06**: A visitor can open a fly detail page showing photos, recipe, description, taxonomy, and rating

### Leaderboards

- [ ] **LEAD-01**: A global leaderboard shows the highest-ranked flies site-wide (by weighted score)
- [ ] **LEAD-02**: Per-category leaderboards show the top-ranked flies within each fly type/subcategory
- [ ] **LEAD-03**: Per-fish-type leaderboards show the top-ranked flies for each target fish
- [ ] **LEAD-04**: A "recent" view surfaces newly submitted flies

### Moderation

- [ ] **MOD-01**: An admin can approve or reject a user-suggested category/fish type
- [ ] **MOD-02**: An admin can remove (unpublish) an inappropriate fly
- [ ] **MOD-03**: An admin can remove an inappropriate rating

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Leaderboards

- **LEAD-05**: Velocity-based "Trending" view weighting recency and rating momentum (v1 ships "Recent" only)

### Submission

- **SUB-08**: Faceted search over structured recipe materials (search flies by material/technique)

### Moderation

- **MOD-04**: AI-assisted image pre-moderation for submissions

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Comments / discussion threads on flies | Ratings are the primary feedback signal for v1; comments add moderation burden |
| Social following / activity feeds | Keep v1 focused on the submit → rate → discover loop; revisit once there's a community |
| Community flagging/reporting workflow | v1 moderation is admin-driven only; add community flagging once there's volume |
| Marketplace / selling flies or gear | Flyrate is a rating catalog, not commerce |
| Native mobile apps | Responsive web only for v1 |
| Free-form user-defined categories | Predefined + admin-approved taxonomy keeps leaderboard data clean |
| Half-star / fractional rating scale | Whole-star 1–5 keeps rating semantics and aggregation simple |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Pending |
| PROF-01 | Phase 1 | Complete |
| SUB-01 | Phase 1 | Complete |
| SUB-02 | Phase 1 | Complete |
| SUB-03 | Phase 1 | Complete |
| SUB-04 | Phase 1 | Complete |
| SUB-05 | Phase 1 | Complete |
| SUB-06 | Phase 1 | Complete |
| SUB-07 | Phase 1 | Complete |
| TAX-01 | Phase 1 | Complete |
| DISC-01 | Phase 2 | Pending |
| DISC-02 | Phase 2 | Pending |
| DISC-03 | Phase 2 | Pending |
| DISC-04 | Phase 2 | Pending |
| DISC-05 | Phase 2 | Pending |
| DISC-06 | Phase 2 | Pending |
| RATE-01 | Phase 3 | Pending |
| RATE-02 | Phase 3 | Pending |
| RATE-03 | Phase 3 | Pending |
| RATE-04 | Phase 3 | Pending |
| RATE-05 | Phase 3 | Pending |
| LEAD-01 | Phase 3 | Pending |
| LEAD-02 | Phase 3 | Pending |
| LEAD-03 | Phase 3 | Pending |
| LEAD-04 | Phase 3 | Pending |
| PROF-02 | Phase 4 | Pending |
| PROF-03 | Phase 4 | Pending |
| TAX-02 | Phase 4 | Pending |
| TAX-03 | Phase 4 | Pending |
| MOD-01 | Phase 4 | Pending |
| MOD-02 | Phase 4 | Pending |
| MOD-03 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 34 total
- Mapped to phases: 34 ✓
- Unmapped: 0 ✓

**By phase:**

- Phase 1 — Foundation & Submit: 15 (AUTH-01..06, PROF-01, SUB-01..07, TAX-01)
- Phase 2 — Public Catalog & Discovery: 6 (DISC-01..06)
- Phase 3 — Rate, Rank & Leaderboards: 9 (RATE-01..05, LEAD-01..04)
- Phase 4 — Community & Moderation: 7 (PROF-02, PROF-03, TAX-02, TAX-03, MOD-01..03)

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-01 after roadmap creation*
