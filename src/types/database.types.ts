// Placeholder generated in Task 1 so the @supabase/ssr clients type-check.
// Task 2 replaces this with the full schema-derived Database type once
// migration 0001 is authored (hand-authored here because `supabase gen types`
// requires Docker + a linked project, unavailable in this environment).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
