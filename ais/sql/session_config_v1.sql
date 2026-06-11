-- =============================================================================
-- Session type and venue options — org-scoped configuration for sessions
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_type_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  default_venue text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_type_options_org_key_unique UNIQUE (org_id, key)
);

CREATE TABLE IF NOT EXISTS public.session_venue_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_venue_options_org_label_unique UNIQUE (org_id, label)
);

CREATE INDEX IF NOT EXISTS session_type_options_org_id_idx
  ON public.session_type_options (org_id, sort_order);

CREATE INDEX IF NOT EXISTS session_venue_options_org_id_idx
  ON public.session_venue_options (org_id, sort_order);

COMMIT;
