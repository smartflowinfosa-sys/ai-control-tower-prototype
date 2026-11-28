-- Add per-user allowed_sections array column to public.app_users
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS allowed_sections TEXT[] DEFAULT ARRAY['inventory']::TEXT[];

-- Ensure existing non-admin users have at least ['inventory'] when allowed_sections is NULL
UPDATE public.app_users
SET allowed_sections = ARRAY['inventory']::TEXT[]
WHERE allowed_sections IS NULL
  AND UPPER(COALESCE(role, '')) NOT IN ('ADMIN', 'SUPERADMIN');
