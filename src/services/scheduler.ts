import { DataStore } from './store';

export type SchedulerTaskKey =
  | 'task_a_nightly'
  | 'task_b_morning'
  | 'task_c_india'
  | 'task_d_expiry'
  | 'task_e_retention';

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

export interface SchedulerOverviewStats {
  totalImported: number;
  importedToday: number;
  updatedToday: number;
  duplicatesSkipped: number;
  failedImports: number;
  expiredJobs: number;
  retentionDeleted: number;
  lastSuccessfulSync: string | null;
  nextScheduledSync: string | null;
}

export interface SchedulerStatusResponse {
  success: boolean;
  currentServerTimeUtc: string;
  currentServerTimeIst: string;
  overview: SchedulerOverviewStats;
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
   * Fetch current scheduler status, overview metrics, configs, and last runs
   */
  static async getStatus(): Promise<SchedulerStatusResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/status`);
      if (!res.ok) {
        throw new Error(`Failed to fetch scheduler status (${res.status})`);
      }
      return await res.json();
    } catch (e) {
      // Offline / standalone browser fallback simulation if server is unreachable
      const istNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const localJobs = DataStore.getJobs();
      const himalayasJobs = localJobs.filter((j) => j.source === 'himalayas');

      return {
        success: true,
        currentServerTimeUtc: new Date().toISOString(),
        currentServerTimeIst: istNow,
        overview: {
          totalImported: himalayasJobs.length,
          importedToday: himalayasJobs.length,
          updatedToday: 0,
          duplicatesSkipped: 0,
          failedImports: 0,
          expiredJobs: localJobs.filter((j) => j.status === 'expired').length,
          retentionDeleted: 0,
          lastSuccessfulSync: new Date().toISOString(),
          nextScheduledSync: new Date(Date.now() + 3600000).toISOString(),
        },
        tasks: [
          {
            taskKey: 'task_a_nightly',
            name: 'Nightly Himalayas Import',
            enabled: true,
            scheduleExpression: '0 16 * * *',
            timezone: 'Asia/Kolkata',
            configurationJson: { limit: 20, pages: 5, targetCount: 100, istTime: '9:30 PM IST' },
            nextExecutionTime: new Date(Date.now() + 7200000).toISOString(),
            lastRun: null,
            totalSyncedAllTime: 0,
            totalRuns: 0,
          },
          {
            taskKey: 'task_b_morning',
            name: 'Morning Himalayas Import',
            enabled: true,
            scheduleExpression: '0 2 * * *',
            timezone: 'Asia/Kolkata',
            configurationJson: { limit: 20, pages: 1, targetCount: 20, istTime: '7:30 AM IST' },
            nextExecutionTime: new Date(Date.now() + 14400000).toISOString(),
            lastRun: null,
            totalSyncedAllTime: 0,
            totalRuns: 0,
          },
          {
            taskKey: 'task_c_india',
            name: 'India-Eligible Job Import',
            enabled: true,
            scheduleExpression: '30 18,0,6,12 * * *',
            timezone: 'Asia/Kolkata',
            configurationJson: { maxFetch: 100, filter: 'india', istTime: 'Every 6 hours IST' },
            nextExecutionTime: new Date(Date.now() + 3600000).toISOString(),
            lastRun: null,
            totalSyncedAllTime: 0,
            totalRuns: 0,
          },
          {
            taskKey: 'task_d_expiry',
            name: 'Job Expiry Check',
            enabled: true,
            scheduleExpression: '0 20 * * *',
            timezone: 'Asia/Kolkata',
            configurationJson: { istTime: 'Daily 1:30 AM IST' },
            nextExecutionTime: new Date(Date.now() + 21600000).toISOString(),
            lastRun: null,
            totalSyncedAllTime: 0,
            totalRuns: 0,
          },
          {
            taskKey: 'task_e_retention',
            name: 'Job Retention Cleanup',
            enabled: true,
            scheduleExpression: '30 20 * * *',
            timezone: 'Asia/Kolkata',
            configurationJson: { istTime: 'Daily 2:00 AM IST', retentionMonths: 3 },
            nextExecutionTime: new Date(Date.now() + 23400000).toISOString(),
            lastRun: null,
            totalSyncedAllTime: 0,
            totalRuns: 0,
          },
        ],
      };
    }
  }

  /**
   * Toggle a task between enabled and disabled
   */
  static async toggleTask(taskKey: SchedulerTaskKey, enabled: boolean): Promise<boolean> {
    try {
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
    } catch (e) {
      return true;
    }
  }

  /**
   * Trigger immediate execution ("Run Now", "Run Expiry", "Run Retention")
   */
  static async triggerRun(taskKey: SchedulerTaskKey): Promise<SchedulerRunItem> {
    try {
      const res = await fetch(`${this.baseUrl}/run/${taskKey}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(err.error || `Failed to trigger task (${res.status})`);
      }
      const data = await res.json();
      return data.run;
    } catch (e: any) {
      // Local fallback execution for Task D and Task E if offline
      if (taskKey === 'task_d_expiry') {
        const expiryResult = DataStore.processJobExpiry();
        return {
          id: `local-run-${Date.now()}`,
          task_key: 'task_d_expiry',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          status: 'success',
          fetched_count: expiryResult.count,
          matched_count: expiryResult.count,
          synced_count: expiryResult.count,
          duplicate_count: 0,
          failed_count: 0,
        };
      }
      if (taskKey === 'task_e_retention') {
        const retentionResult = DataStore.processJobRetentionCleanup();
        return {
          id: `local-run-${Date.now()}`,
          task_key: 'task_e_retention',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          status: 'success',
          fetched_count: retentionResult.count,
          matched_count: retentionResult.count,
          synced_count: retentionResult.count,
          duplicate_count: 0,
          failed_count: 0,
        };
      }
      throw e;
    }
  }

  /**
   * Fetch recent execution runs history
   */
  static async getRuns(taskKey?: SchedulerTaskKey, limit = 50): Promise<SchedulerRunItem[]> {
    try {
      const url = new URL(`${this.baseUrl}/runs`, window.location.origin);
      if (taskKey) url.searchParams.set('taskKey', taskKey);
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Failed to fetch runs history (${res.status})`);
      }
      const data = await res.json();
      return data.runs || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Fetch job-level errors for a specific run
   */
  static async getRunErrors(runId: string): Promise<SchedulerJobErrorItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/runs/${runId}/errors`);
      if (!res.ok) {
        throw new Error(`Failed to fetch run errors (${res.status})`);
      }
      const data = await res.json();
      return data.errors || [];
    } catch (e) {
      return [];
    }
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
          let company = DataStore.getCompanies().find(
            (c) => c.slug === serverJob.company?.slug || c.name === serverJob.company?.name
          );
          if (!company && serverJob.company) {
            company = DataStore.createCompany(serverJob.company);
          }

          DataStore.createJob({
            ...serverJob,
            source: 'himalayas',
            external_job_id: serverJob.external_job_id,
            imported_at: serverJob.imported_at || new Date().toISOString(),
            company_id: company ? company.id : existingJobs[0]?.company_id || 'comp-1',
          });
          importedCount++;
        }
      }

      return importedCount;
    } catch (e) {
      return 0;
    }
  }
}
