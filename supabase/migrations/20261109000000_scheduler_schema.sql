-- Migration: 20261109000000_scheduler_schema.sql
-- Description: Automated Himalayas Job Feed Scheduler schema, logs, and error tracking

-- 1. Scheduler Configuration Table
CREATE TABLE IF NOT EXISTS public.scheduler_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    schedule_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Scheduler Execution Runs Table
CREATE TABLE IF NOT EXISTS public.scheduler_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_key TEXT NOT NULL REFERENCES public.scheduler_config(task_key) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial_success', 'failed')),
    fetched_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    synced_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    execution_metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Scheduler Job Errors Table
CREATE TABLE IF NOT EXISTS public.scheduler_job_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.scheduler_runs(id) ON DELETE CASCADE,
    external_job_id TEXT,
    job_title TEXT NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Enhance jobs table with external_job_id for robust deduplication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs' 
        AND column_name = 'external_job_id'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN external_job_id TEXT;
    END IF;
END $$;

-- Indexes for performance & deduplication
CREATE INDEX IF NOT EXISTS idx_jobs_external_job_id ON public.jobs(external_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_external_app_url ON public.jobs(external_application_url);
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_task_key_started ON public.scheduler_runs(task_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_errors_run_id ON public.scheduler_job_errors(run_id);

-- Enable RLS
ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_job_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can view and manage scheduler config and logs
CREATE POLICY "Admins manage scheduler config" ON public.scheduler_config FOR ALL USING (public.is_admin());
CREATE POLICY "Admins view scheduler runs" ON public.scheduler_runs FOR ALL USING (public.is_admin());
CREATE POLICY "Admins view scheduler job errors" ON public.scheduler_job_errors FOR ALL USING (public.is_admin());

-- Seed Default Tasks
INSERT INTO public.scheduler_config (task_key, name, enabled, schedule_expression, timezone, configuration_json)
VALUES 
    (
        'task_a_nightly',
        'Nightly Full Feed Sync',
        true,
        '30 21 * * *',
        'Asia/Kolkata',
        '{"limit": 20, "pages": 5, "targetCount": 100, "description": "Nightly full sync fetching 5 pages of 20 jobs (100 jobs total) at 9:30 PM IST"}'::jsonb
    ),
    (
        'task_b_morning',
        'Morning Feed Sync',
        true,
        '30 7 * * *',
        'Asia/Kolkata',
        '{"limit": 20, "pages": 1, "targetCount": 20, "description": "Morning pulse sync fetching 1 page of 20 jobs at 7:30 AM IST"}'::jsonb
    ),
    (
        'task_c_india',
        'India Location Sync',
        true,
        '0 0,6,12,18 * * *',
        'Asia/Kolkata',
        '{"limit": 20, "pages": 5, "maxFetch": 100, "filter": "india", "description": "Every 6 hours (00:00, 06:00, 12:00, 18:00 IST) sync for India and Worldwide eligible jobs"}'::jsonb
    )
ON CONFLICT (task_key) DO UPDATE SET
    name = EXCLUDED.name,
    schedule_expression = EXCLUDED.schedule_expression,
    configuration_json = EXCLUDED.configuration_json,
    updated_at = timezone('utc'::text, now());
