-- 1. Add Permanent Google Meet URL, Email, and AI Minutes Permission to public.app_users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS personal_meet_url TEXT,
  ADD COLUMN IF NOT EXISTS can_use_ai_minutes BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create public.team_meetings table for Scheduled & Instant Google Meet sessions
CREATE TABLE IF NOT EXISTS public.team_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_email TEXT,
  meet_url TEXT NOT NULL,
  participant_ids TEXT[] NOT NULL DEFAULT '{}',
  participant_names TEXT[] NOT NULL DEFAULT '{}',
  participant_emails TEXT[] NOT NULL DEFAULT '{}',
  is_instant BOOLEAN NOT NULL DEFAULT TRUE,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  reminder_minutes INTEGER[] NOT NULL DEFAULT '{}',
  sent_reminders INTEGER[] NOT NULL DEFAULT '{}',
  ai_transcript TEXT,
  ai_minutes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_meetings_status_scheduled ON public.team_meetings(status, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_meetings_host_id ON public.team_meetings(host_id);

-- 3. Enable Realtime on public.team_meetings (safe idempotent block)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_meetings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
