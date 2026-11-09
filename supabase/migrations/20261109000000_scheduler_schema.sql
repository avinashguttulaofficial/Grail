-- Migration: 20261109000000_scheduler_schema.sql
-- Description: Himalayas Feed Automation, Job Expiry & Automatic Retention Scheduler

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enhance jobs table with source tracking, external ID, and lifecycle timestamps
DO $$
BEGIN
    -- Add source column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'source'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'himalayas'));
    END IF;

    -- Add external_job_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'external_job_id'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN external_job_id TEXT;
    END IF;

    -- Add imported_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'imported_at'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN imported_at TIMESTAMPTZ;
    END IF;

    -- Add closed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'closed_at'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN closed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes for performance & deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_external_id_unique ON public.jobs(external_job_id) WHERE external_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_source ON public.jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_application_deadline ON public.jobs(application_deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_closed_at ON public.jobs(closed_at);
CREATE INDEX IF NOT EXISTS idx_jobs_external_app_url ON public.jobs(external_application_url);

-- 3. Scheduler Configuration Table
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

-- 4. Scheduler Execution Runs Table
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
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 5. Scheduler Job Errors Table
CREATE TABLE IF NOT EXISTS public.scheduler_job_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.scheduler_runs(id) ON DELETE CASCADE,
    external_job_id TEXT,
    job_title TEXT NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for scheduler performance
CREATE INDEX IF NOT EXISTS idx_scheduler_runs_task_key_started ON public.scheduler_runs(task_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_errors_run_id ON public.scheduler_job_errors(run_id);

-- Enable RLS
ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_job_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can view and manage scheduler config and logs
DROP POLICY IF EXISTS "Admins manage scheduler config" ON public.scheduler_config;
CREATE POLICY "Admins manage scheduler config" ON public.scheduler_config FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view scheduler runs" ON public.scheduler_runs;
CREATE POLICY "Admins view scheduler runs" ON public.scheduler_runs FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view scheduler job errors" ON public.scheduler_job_errors;
CREATE POLICY "Admins view scheduler job errors" ON public.scheduler_job_errors FOR ALL USING (public.is_admin());

-- 6. Seed Default Tasks (5 Independent Schedulers)
INSERT INTO public.scheduler_config (task_key, name, enabled, schedule_expression, timezone, configuration_json)
VALUES 
    (
        'task_a_nightly',
        'Nightly Himalayas Import',
        true,
        '0 16 * * *',
        'Asia/Kolkata',
        '{"limit": 20, "pages": 5, "targetCount": 100, "istTime": "9:30 PM IST", "description": "Nightly full sync fetching 5 pages of 20 jobs (100 jobs total) at 9:30 PM IST"}'::jsonb
    ),
    (
        'task_b_morning',
        'Morning Himalayas Import',
        true,
        '0 2 * * *',
        'Asia/Kolkata',
        '{"limit": 20, "pages": 1, "targetCount": 20, "istTime": "7:30 AM IST", "description": "Morning pulse sync fetching 1 page of 20 jobs at 7:30 AM IST"}'::jsonb
    ),
    (
        'task_c_india',
        'India-Eligible Job Import',
        true,
        '30 18,0,6,12 * * *',
        'Asia/Kolkata',
        '{"limit": 20, "pages": 5, "maxFetch": 100, "filter": "india", "istTime": "00:00, 06:00, 12:00, 18:00 IST", "description": "Every 6 hours sync for India and Worldwide eligible jobs"}'::jsonb
    ),
    (
        'task_d_expiry',
        'Job Expiry Check',
        true,
        '0 20 * * *',
        'Asia/Kolkata',
        '{"istTime": "Daily 1:30 AM IST", "description": "Daily check marking published jobs with passed application deadlines as expired"}'::jsonb
    ),
    (
        'task_e_retention',
        'Job Retention Cleanup',
        true,
        '30 20 * * *',
        'Asia/Kolkata',
        '{"istTime": "Daily 2:00 AM IST", "retentionMonths": 3, "description": "Daily retention cleanup permanently deleting eligible Himalayas jobs closed > 3 months (never deletes manual jobs)"}'::jsonb
    )
ON CONFLICT (task_key) DO UPDATE SET
    name = EXCLUDED.name,
    schedule_expression = EXCLUDED.schedule_expression,
    configuration_json = EXCLUDED.configuration_json,
    updated_at = timezone('utc'::text, now());

-- 7. Application Eligibility Validation Trigger
-- Prevents applications to non-published, expired, filled, archived, or past-deadline jobs
CREATE OR REPLACE FUNCTION public.check_application_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
    v_deadline TIMESTAMPTZ;
BEGIN
    SELECT status, application_deadline INTO v_status, v_deadline
    FROM public.jobs
    WHERE id = NEW.job_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot apply: Job listing does not exist.';
    END IF;

    IF v_status <> 'published' THEN
        RAISE EXCEPTION 'Cannot apply: This job listing is % and is no longer accepting applications.', v_status;
    END IF;

    IF v_deadline IS NOT NULL AND v_deadline <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Cannot apply: The application deadline for this position has passed.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_application_eligibility ON public.applications;
CREATE TRIGGER trg_check_application_eligibility
BEFORE INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.check_application_eligibility();

-- 8. Job Expiry Management Function
CREATE OR REPLACE FUNCTION public.process_job_expiry()
RETURNS JSONB AS $$
DECLARE
    expired_count INTEGER := 0;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    WITH updated AS (
        UPDATE public.jobs
        SET status = 'expired',
            closed_at = COALESCE(closed_at, v_now),
            updated_at = v_now
        WHERE status = 'published'
          AND application_deadline IS NOT NULL
          AND application_deadline <= v_now
        RETURNING id
    )
    SELECT count(*) INTO expired_count FROM updated;

    -- Record run log in scheduler_runs
    INSERT INTO public.scheduler_runs (
        task_key, started_at, completed_at, status, fetched_count, matched_count, synced_count, duplicate_count, failed_count, metadata
    ) VALUES (
        'task_d_expiry',
        v_now,
        timezone('utc'::text, now()),
        'success',
        expired_count,
        expired_count,
        expired_count,
        0,
        0,
        jsonb_build_object('expired_jobs_count', expired_count)
    );

    RETURN jsonb_build_object('success', true, 'expired_count', expired_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Automatic Job Retention and Deletion Function
-- CRITICAL RULE: Permanently deletes ONLY Himalayas-imported jobs (source = 'himalayas').
-- Never deletes manually created jobs (source = 'manual').
CREATE OR REPLACE FUNCTION public.process_job_retention_cleanup()
RETURNS JSONB AS $$
DECLARE
    deleted_count INTEGER := 0;
    retention_cutoff TIMESTAMPTZ := timezone('utc'::text, now()) - INTERVAL '3 months';
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    WITH eligible_jobs AS (
        SELECT j.id
        FROM public.jobs j
        LEFT JOIN LATERAL (
            SELECT MAX(applied_at) as latest_application_date, COUNT(*) as app_count
            FROM public.applications a
            WHERE a.job_id = j.id
        ) app_stats ON true
        WHERE j.source = 'himalayas'
          AND j.status IN ('expired', 'filled', 'archived')
          AND (
              -- Rule A: Zero applications -> closed_at <= NOW() - INTERVAL '3 months'
              (COALESCE(app_stats.app_count, 0) = 0 AND j.closed_at IS NOT NULL AND j.closed_at <= retention_cutoff)
              OR
              -- Rule B & C: With applications -> GREATEST(closed_at, latest_application_date) <= retention_cutoff
              (COALESCE(app_stats.app_count, 0) > 0 AND GREATEST(COALESCE(j.closed_at, j.updated_at), app_stats.latest_application_date) <= retention_cutoff)
          )
    ),
    deleted_records AS (
        DELETE FROM public.jobs
        WHERE id IN (SELECT id FROM eligible_jobs)
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted_records;

    -- Record run log in scheduler_runs
    INSERT INTO public.scheduler_runs (
        task_key, started_at, completed_at, status, fetched_count, matched_count, synced_count, duplicate_count, failed_count, metadata
    ) VALUES (
        'task_e_retention',
        v_now,
        timezone('utc'::text, now()),
        'success',
        deleted_count,
        deleted_count,
        deleted_count,
        0,
        0,
        jsonb_build_object('deleted_jobs_count', deleted_count, 'retention_cutoff', retention_cutoff)
    );

    RETURN jsonb_build_object('success', true, 'deleted_count', deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Optional Supabase pg_cron Scheduling Setup
-- Safely schedules cron tasks if pg_cron extension is available on the Supabase project
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Safely unschedule previous jobs with these names
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grail-job-expiry') THEN
            PERFORM cron.unschedule('grail-job-expiry');
        END IF;
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'grail-job-retention') THEN
            PERFORM cron.unschedule('grail-job-retention');
        END IF;

        -- Job Expiry Check: Daily 1:30 AM IST -> 0 20 * * * UTC
        PERFORM cron.schedule('grail-job-expiry', '0 20 * * *', 'SELECT public.process_job_expiry();');

        -- Job Retention Cleanup: Daily 2:00 AM IST -> 30 20 * * * UTC
        PERFORM cron.schedule('grail-job-retention', '30 20 * * *', 'SELECT public.process_job_retention_cleanup();');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron configuration skipped: %', SQLERRM;
END $$;
