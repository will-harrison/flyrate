import { createClient } from "@/lib/supabase/server";

/**
 * Server-side taxonomy fetch for the submit form (TAX-01).
 *
 * The submit form's fly-type, subcategory and fish choices come ONLY from these
 * seeded, admin-managed lookup tables — there is no free-text taxonomy entry.
 * Fetched server-side (Server Component) with the anon-key server client; the
 * public-read RLS policies in migration 0003 allow this read.
 *
 * `subcategoriesByFlyType` is pre-grouped so the client cascade Select can show
 * only the subcategories for the currently-selected fly type.
 */
export type FlyTypeOption = {
  id: string;
  name: string;
  slug: string;
};

export type FlySubcategoryOption = {
  id: string;
  flyTypeId: string;
  name: string;
  slug: string;
};

export type FishTypeOption = {
  id: string;
  name: string;
  slug: string;
};

export type TaxonomyOptions = {
  flyTypes: FlyTypeOption[];
  subcategoriesByFlyType: Record<string, FlySubcategoryOption[]>;
  fishTypes: FishTypeOption[];
};

export async function fetchTaxonomy(): Promise<TaxonomyOptions> {
  const supabase = await createClient();

  const [flyTypesRes, subcategoriesRes, fishTypesRes] = await Promise.all([
    supabase
      .from("fly_types")
      .select("id, name, slug, position")
      .order("position", { ascending: true }),
    supabase
      .from("fly_subcategories")
      .select("id, fly_type_id, name, slug, position")
      .order("position", { ascending: true }),
    supabase
      .from("fish_types")
      .select("id, name, slug, position")
      .order("position", { ascending: true }),
  ]);

  const flyTypes: FlyTypeOption[] = (flyTypesRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
  }));

  const subcategoriesByFlyType: Record<string, FlySubcategoryOption[]> = {};
  for (const s of subcategoriesRes.data ?? []) {
    const option: FlySubcategoryOption = {
      id: s.id,
      flyTypeId: s.fly_type_id,
      name: s.name,
      slug: s.slug,
    };
    (subcategoriesByFlyType[s.fly_type_id] ??= []).push(option);
  }

  const fishTypes: FishTypeOption[] = (fishTypesRes.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
  }));

  return { flyTypes, subcategoriesByFlyType, fishTypes };
}
