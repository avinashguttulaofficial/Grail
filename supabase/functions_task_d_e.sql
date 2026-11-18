-- ============================================================
-- SQL Functions for Task D (Expiry) and Task E (Retention)
-- Run this in Supabase SQL editor or via applySchema
-- ============================================================

-- Function for Task D: Mark expired jobs
create or replace function process_job_expiry()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_expired_count int := 0;
begin
  with updated as (
    update jobs
    set 
      status = 'expired',
      closed_at = coalesce(closed_at, now()),
      updated_at = now()
    where status = 'published'
      and application_deadline is not null
      and application_deadline <= now()
    returning id
  )
  select count(*) into v_expired_count from updated;

  return jsonb_build_object('success', true, 'expired_count', v_expired_count);
end;
$$;

-- Function for Task E: Retention cleanup (deletes Himalayas jobs closed > 3 months)
create or replace function process_job_retention_cleanup()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_deleted_count int := 0;
  three_months_ago timestamptz := now() - interval '90 days';
begin
  -- Rule D: Never delete manual jobs! Only delete source='himalayas'
  -- Rule D: Never delete published or draft jobs! Only expired, filled, or archived
  with to_delete as (
    select j.id
    from jobs j
    where j.source = 'himalayas'
      and j.status in ('expired', 'filled', 'archived')
      and coalesce(j.closed_at, j.updated_at) <= three_months_ago
      and not exists (
        select 1 from applications a 
        where a.job_id = j.id 
          and a.applied_at > three_months_ago
      )
  ),
  deleted as (
    delete from jobs
    where id in (select id from to_delete)
    returning id
  )
  select count(*) into v_deleted_count from deleted;

  return jsonb_build_object('success', true, 'deleted_count', v_deleted_count);
end;
$$;
