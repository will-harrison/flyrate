-- Migration 0004 — taxonomy seed rows (D-05..D-07, "lean & curated")
--
-- Seeds exactly:
--   * 6 fly types (D-06): Dry Fly, Nymph, Streamer, Wet Fly, Emerger, Terrestrial.
--     Terrestrial is a TOP-LEVEL type, not a Dry Fly subcategory (D-06 / Pitfall 3).
--   * a few common subcategories per type (D-07). Ant/Beetle/Hopper appear ONLY
--     under Terrestrial — never under Dry Fly (Pitfall 3).
--   * 12 species-level fish (D-05): trout split into Rainbow/Brown/Brook/Cutthroat.
--
-- Subcategories are joined to their parent type by slug so this file needs no
-- hard-coded uuids. Editable: a maintainer may add/remove rows here (the user was
-- told this seed list is a starting point they can edit before the migration ships).

-- ---------------------------------------------------------------------------
-- Fly types (D-06)
-- ---------------------------------------------------------------------------
insert into public.fly_types (name, slug, position) values
  ('Dry Fly',     'dry-fly',     1),
  ('Nymph',       'nymph',       2),
  ('Streamer',    'streamer',    3),
  ('Wet Fly',     'wet-fly',     4),
  ('Emerger',     'emerger',     5),
  ('Terrestrial', 'terrestrial', 6);

-- ---------------------------------------------------------------------------
-- Fly subcategories (D-07). Each row references exactly one fly_type via slug.
-- Ant/Beetle/Hopper are seeded ONLY under 'terrestrial' (Pitfall 3 / D-06).
-- ---------------------------------------------------------------------------
insert into public.fly_subcategories (fly_type_id, name, slug, position)
select ft.id, s.name, s.slug, s.position
from (
  values
    -- Dry Fly
    ('dry-fly',     'Mayfly',              'mayfly',              1),
    ('dry-fly',     'Caddis',              'caddis',              2),
    ('dry-fly',     'Stonefly',            'stonefly',            3),
    ('dry-fly',     'Attractor',           'attractor',           4),
    -- Nymph
    ('nymph',       'Mayfly Nymph',        'mayfly-nymph',        1),
    ('nymph',       'Caddis Pupa',         'caddis-pupa',         2),
    ('nymph',       'Stonefly Nymph',      'stonefly-nymph',      3),
    ('nymph',       'Midge',               'midge',               4),
    -- Streamer
    ('streamer',    'Baitfish',            'baitfish',            1),
    ('streamer',    'Sculpin',             'sculpin',             2),
    ('streamer',    'Woolly Bugger / Leech','woolly-bugger-leech',3),
    -- Wet Fly
    ('wet-fly',     'Soft Hackle',         'soft-hackle',         1),
    ('wet-fly',     'Winged Wet',          'winged-wet',          2),
    -- Emerger
    ('emerger',     'Mayfly Emerger',      'mayfly-emerger',      1),
    ('emerger',     'Caddis Emerger',      'caddis-emerger',      2),
    -- Terrestrial (Ant/Beetle/Hopper ONLY here — Pitfall 3)
    ('terrestrial', 'Ant',                 'ant',                 1),
    ('terrestrial', 'Beetle',              'beetle',              2),
    ('terrestrial', 'Hopper',              'hopper',              3)
) as s(fly_type_slug, name, slug, position)
join public.fly_types ft on ft.slug = s.fly_type_slug;

-- ---------------------------------------------------------------------------
-- Fish types (D-05) — 12 species-level rows; trout split into 4 species.
-- ---------------------------------------------------------------------------
insert into public.fish_types (name, slug, position) values
  ('Rainbow Trout',    'rainbow-trout',    1),
  ('Brown Trout',      'brown-trout',      2),
  ('Brook Trout',      'brook-trout',      3),
  ('Cutthroat Trout',  'cutthroat-trout',  4),
  ('Largemouth Bass',  'largemouth-bass',  5),
  ('Smallmouth Bass',  'smallmouth-bass',  6),
  ('Steelhead',        'steelhead',        7),
  ('Atlantic Salmon',  'atlantic-salmon',  8),
  ('Grayling',         'grayling',         9),
  ('Panfish / Bluegill','panfish-bluegill',10),
  ('Carp',             'carp',             11),
  ('Northern Pike',    'northern-pike',    12);
