// Hand-authored to match supabase/migrations/0001_profiles_and_bootstrap.sql.
//
// NOTE: In a normal workflow this file is generated with
//   supabase gen types typescript --linked > src/types/database.types.ts
// That command requires Docker + a linked cloud project, neither of which is
// available in this ephemeral container, so the type below is authored by hand
// to match the migration exactly. Regenerate it locally after `supabase db push`
// to pick up any schema drift (and each later migration adds more tables here).
//
// The shape follows the canonical `supabase gen types` output so that
// createBrowserClient<Database>() / createServerClient<Database>() type-check
// identically to the generated file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// Convenience helpers mirroring the generated file's ergonomics.
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
