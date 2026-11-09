export type SchedulerTaskKey = 'task_a_nightly' | 'task_b_morning' | 'task_c_india';

export interface SchedulerConfig {
  id: string;
  task_key: SchedulerTaskKey;
  name: string;
  enabled: boolean;
  schedule_expression: string;
  timezone: string;
  configuration_json: Record<string, any>;
  next_run_at?: string;
  last_run_at?: string;
  last_status?: 'success' | 'partial_success' | 'failed' | 'running';
  created_at?: string;
  updated_at?: string;
}

export type SchedulerRunStatus = 'running' | 'success' | 'partial_success' | 'failed';

export interface SchedulerRun {
  id: string;
  task_key: SchedulerTaskKey;
  started_at: string;
  completed_at?: string;
  status: SchedulerRunStatus;
  fetched_count: number;
  matched_count: number;
  synced_count: number;
  duplicate_count: number;
  failed_count: number;
  error_message?: string;
  execution_metadata?: Record<string, any>;
}

export interface SchedulerJobError {
  id: string;
  run_id: string;
  external_job_id?: string;
  job_title: string;
  error_message: string;
  retry_count: number;
  created_at: string;
}

export interface TaskSummaryStats {
  config: SchedulerConfig;
  lastRun?: SchedulerRun;
  totalSyncedAllTime: number;
  totalRuns: number;
}
