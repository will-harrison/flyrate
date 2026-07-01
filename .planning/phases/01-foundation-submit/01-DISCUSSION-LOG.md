# Phase 1: Foundation & Submit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 1-Foundation & Submit
**Areas discussed:** Submit flow & payoff, Taxonomy seed

---

## Gray-area selection

Offered: Taxonomy seed, Submit flow & payoff, Recipe structure, Signup & verify UX.
**User selected:** Submit flow & payoff, Taxonomy seed.

---

## Submit flow & payoff

### Form layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single scrollable page | Everything on one sectioned page; simplest, whole scope visible, easy to review | ✓ |
| Multi-step wizard | Photos → recipe → taxonomy → review; less per screen, more state/nav | |
| Hybrid | One page with add-as-you-go widgets for repeating parts | |

**User's choice:** Single scrollable page.

### Post-submit landing ("see it exist")

| Option | Description | Selected |
|--------|-------------|----------|
| The fly's own page | Redirect to `/flies/[id]`; strongest proof; seeds Phase 2's public page | ✓ |
| Their profile page | Redirect to profile submission list; weaker "it exists" moment | |
| Confirmation + choice | Success screen with View/Submit-another links; extra click | |

**User's choice:** The fly's detail page.
**Notes:** In answering, the user surfaced a data-model rule: flies are per-submission and
never deduplicated — the same design by different users, or the same user twice, are separate
independently-rateable records. No uniqueness constraint / dedup. Reflected back and confirmed;
captured as D-03.

### Photos

| Option | Description | Selected |
|--------|-------------|----------|
| Multi + pick primary | Upload several; user chooses the cover photo | ✓ |
| Multi, first = primary | Upload order sets the cover | |
| Single photo only | One photo; under-delivers vs "one or more" requirement | |

**User's choice:** Multi + pick primary.
**Notes:** Photo cap left to Claude's discretion, default ~6.

---

## Taxonomy seed

### Trout granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Split by species | Rainbow, Brown, Brook, Cutthroat as separate fish types | ✓ |
| Single 'Trout' | One entry; loses species-level discovery | |
| Both: Trout + species | General + species; risks inconsistent tagging | |

**User's choice:** Split by species (sets the species-level pattern for all fish).

### Fly type set / Terrestrial placement

| Option | Description | Selected |
|--------|-------------|----------|
| 6 top-level types | Dry, Nymph, Streamer, Wet, Emerger, Terrestrial (own type) | ✓ |
| 5 types, Terrestrial under Dry | Terrestrial as a Dry Fly subcategory | |
| Let me specify | User dictates the list | |

**User's choice:** 6 top-level types.

### Seed breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Lean & curated | Few common subcategories per type + ~10-12 popular gamefish | ✓ |
| Comprehensive | Deep subcategories + 20+ fish incl. saltwater | |
| I'll provide the list | User hands over exact rows | |

**User's choice:** Lean & curated. Concrete proposed seed list captured in CONTEXT.md
"Specific Ideas" for the planner to build; user can edit the migration before it ships.

---

## Claude's Discretion

- Exact photo cap (~6 starting point).
- Exact subcategory/fish rows within the lean bound.
- All engineering mechanics (auth/session, RLS SQL, table design, image pipeline, recipe data
  shape) — delegated to research/planning per canonical refs.

## Deferred Ideas

None — discussion stayed within phase scope. Recipe structure and signup/verify UX were
offered but not selected; downstream planning fills them from requirements.
