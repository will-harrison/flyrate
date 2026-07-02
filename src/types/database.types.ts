// Hand-authored to match supabase/migrations/0001-0006.
//
// NOTE: In a normal workflow this file is generated with
//   supabase gen types typescript --linked > src/types/database.types.ts
// That command requires the Supabase CLI + a linked cloud project, which are not
// available in this ephemeral container (no Docker daemon; .env.local holds
// placeholders). The type below is authored by hand to match the migrations
// exactly. Regenerate it locally after `supabase db push` (Plan 04 Task 2's
// consolidated push of 0002-0006) to pick up any drift.
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
      fly_types: {
        Row: {
          id: string;
          name: string;
          slug: string;
          position: number;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          position?: number;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          position?: number;
        };
        Relationships: [];
      };
      fly_subcategories: {
        Row: {
          id: string;
          fly_type_id: string;
          name: string;
          slug: string;
          position: number;
        };
        Insert: {
          id?: string;
          fly_type_id: string;
          name: string;
          slug: string;
          position?: number;
        };
        Update: {
          id?: string;
          fly_type_id?: string;
          name?: string;
          slug?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fly_subcategories_fly_type_id_fkey";
            columns: ["fly_type_id"];
            isOneToOne: false;
            referencedRelation: "fly_types";
            referencedColumns: ["id"];
          },
        ];
      };
      fish_types: {
        Row: {
          id: string;
          name: string;
          slug: string;
          position: number;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          position?: number;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          position?: number;
        };
        Relationships: [];
      };
      flies: {
        Row: {
          id: string;
          author_id: string;
          name: string;
          description: string | null;
          hook_size: string;
          thread: string;
          difficulty: "beginner" | "intermediate" | "advanced";
          fly_type_id: string;
          fly_subcategory_id: string;
          primary_photo_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          name: string;
          description?: string | null;
          hook_size: string;
          thread: string;
          difficulty: "beginner" | "intermediate" | "advanced";
          fly_type_id: string;
          fly_subcategory_id: string;
          primary_photo_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          name?: string;
          description?: string | null;
          hook_size?: string;
          thread?: string;
          difficulty?: "beginner" | "intermediate" | "advanced";
          fly_type_id?: string;
          fly_subcategory_id?: string;
          primary_photo_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flies_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flies_fly_type_id_fkey";
            columns: ["fly_type_id"];
            isOneToOne: false;
            referencedRelation: "fly_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flies_fly_subcategory_id_fkey";
            columns: ["fly_subcategory_id"];
            isOneToOne: false;
            referencedRelation: "fly_subcategories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flies_primary_photo_id_fkey";
            columns: ["primary_photo_id"];
            isOneToOne: false;
            referencedRelation: "fly_photos";
            referencedColumns: ["id"];
          },
        ];
      };
      fly_materials: {
        Row: {
          id: string;
          fly_id: string;
          position: number;
          label: string;
          material: string;
          color: string | null;
        };
        Insert: {
          id?: string;
          fly_id: string;
          position?: number;
          label: string;
          material: string;
          color?: string | null;
        };
        Update: {
          id?: string;
          fly_id?: string;
          position?: number;
          label?: string;
          material?: string;
          color?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fly_materials_fly_id_fkey";
            columns: ["fly_id"];
            isOneToOne: false;
            referencedRelation: "flies";
            referencedColumns: ["id"];
          },
        ];
      };
      fly_fish_types: {
        Row: {
          fly_id: string;
          fish_type_id: string;
        };
        Insert: {
          fly_id: string;
          fish_type_id: string;
        };
        Update: {
          fly_id?: string;
          fish_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fly_fish_types_fly_id_fkey";
            columns: ["fly_id"];
            isOneToOne: false;
            referencedRelation: "flies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fly_fish_types_fish_type_id_fkey";
            columns: ["fish_type_id"];
            isOneToOne: false;
            referencedRelation: "fish_types";
            referencedColumns: ["id"];
          },
        ];
      };
      fly_photos: {
        Row: {
          id: string;
          fly_id: string;
          storage_path: string;
          position: number;
        };
        Insert: {
          id?: string;
          fly_id: string;
          storage_path: string;
          position?: number;
        };
        Update: {
          id?: string;
          fly_id?: string;
          storage_path?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fly_photos_fly_id_fkey";
            columns: ["fly_id"];
            isOneToOne: false;
            referencedRelation: "flies";
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
      is_email_confirmed: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
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
