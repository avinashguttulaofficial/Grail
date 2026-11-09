import { DataStore } from './store';

export type SchedulerTaskKey = 'task_a_nightly' | 'task_b_morning' | 'task_c_india';

export interface SchedulerTaskSummary {
  taskKey: SchedulerTaskKey;
  name: string;
  enabled: boolean;
  scheduleExpression: string;
  timezone: string;
  configurationJson: Record<string, any>;
  nextExecutionTime: string;
  lastRun: {
    id: string;
    task_key: SchedulerTaskKey;
    started_at: string;
    completed_at?: string;
    status: 'running' | 'success' | 'partial_success' | 'failed';
    fetched_count: number;
    matched_count: number;
    synced_count: number;
    duplicate_count: number;
    failed_count: number;
    error_message?: string;
  } | null;
  totalSyncedAllTime: number;
  totalRuns: number;
}

export interface SchedulerStatusResponse {
  success: boolean;
  currentServerTimeUtc: string;
  currentServerTimeIst: string;
  tasks: SchedulerTaskSummary[];
}

export interface SchedulerRunItem {
  id: string;
  task_key: SchedulerTaskKey;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'partial_success' | 'failed';
  fetched_count: number;
  matched_count: number;
  synced_count: number;
  duplicate_count: number;
  failed_count: number;
  error_message?: string;
}

export interface SchedulerJobErrorItem {
  id: string;
  run_id: string;
  external_job_id?: string;
  job_title: string;
  error_message: string;
  retry_count: number;
  created_at: string;
}

export class SchedulerClientService {
  private static baseUrl = '/api/scheduler';

  /**
   * Fetch current scheduler status, configs, last runs, and next execution times
   */
  static async getStatus(): Promise<SchedulerStatusResponse> {
    const res = await fetch(`${this.baseUrl}/status`);
    if (!res.ok) {
      throw new Error(`Failed to fetch scheduler status (${res.status})`);
    }
    return res.json();
  }

  /**
   * Toggle a task between enabled and disabled
   */
  static async toggleTask(taskKey: SchedulerTaskKey, enabled: boolean): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskKey, enabled }),
    });
    if (!res.ok) {
      throw new Error(`Failed to toggle scheduler task (${res.status})`);
    }
    const data = await res.json();
    return data.success;
  }

  /**
   * Trigger immediate execution ("Run Now")
   */
  static async triggerRun(taskKey: SchedulerTaskKey): Promise<SchedulerRunItem> {
    const res = await fetch(`${this.baseUrl}/run/${taskKey}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(err.error || `Failed to trigger task (${res.status})`);
    }
    const data = await res.json();
    return data.run;
  }

  /**
   * Fetch recent execution runs history
   */
  static async getRuns(taskKey?: SchedulerTaskKey, limit = 50): Promise<SchedulerRunItem[]> {
    const url = new URL(`${this.baseUrl}/runs`, window.location.origin);
    if (taskKey) url.searchParams.set('taskKey', taskKey);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch runs history (${res.status})`);
    }
    const data = await res.json();
    return data.runs || [];
  }

  /**
   * Fetch job-level errors for a specific run
   */
  static async getRunErrors(runId: string): Promise<SchedulerJobErrorItem[]> {
    const res = await fetch(`${this.baseUrl}/runs/${runId}/errors`);
    if (!res.ok) {
      throw new Error(`Failed to fetch run errors (${res.status})`);
    }
    const data = await res.json();
    return data.errors || [];
  }

  /**
   * Sync background jobs from server database into browser DataStore
   */
  static async syncBackgroundJobs(): Promise<number> {
    try {
      const res = await fetch(`${this.baseUrl}/jobs`);
      if (!res.ok) return 0;
      const data = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) return 0;

      const existingJobs = DataStore.getJobs();
      let importedCount = 0;

      for (const serverJob of data.jobs) {
        const alreadyExists = existingJobs.some(
          (j) =>
            (serverJob.external_job_id && (j as any).external_job_id === serverJob.external_job_id) ||
            j.external_application_url === serverJob.external_application_url ||
            j.title.toLowerCase().trim() === serverJob.title.toLowerCase().trim()
        );

        if (!alreadyExists) {
          // Add to local DataStore
          let company = DataStore.getCompanies().find(
            (c) => c.slug === serverJob.company?.slug || c.name === serverJob.company?.name
          );
          if (!company && serverJob.company) {
            company = DataStore.createCompany(serverJob.company);
          }

          DataStore.createJob({
            ...serverJob,
            company_id: company ? company.id : existingJobs[0]?.company_id || 'comp-1',
          });
          importedCount++;
        }
      }

      return importedCount;
    } catch (e) {
      console.warn('[SchedulerClientService] Background job sync to local store failed:', e);
      return 0;
    }
  }
}
