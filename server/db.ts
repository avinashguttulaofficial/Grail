import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SchedulerConfig, SchedulerRun, SchedulerJobError, SchedulerTaskKey } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Default 5 Scheduler Configurations
const DEFAULT_CONFIGS: SchedulerConfig[] = [
  {
    id: 'cfg-task-a',
    task_key: 'task_a_nightly',
    name: 'Nightly Himalayas Import',
    enabled: true,
    schedule_expression: '0 16 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      limit: 20,
      pages: 5,
      targetCount: 100,
      istTime: '9:30 PM IST',
      description: 'Nightly full sync fetching 5 pages of 20 jobs (100 jobs total) at 9:30 PM IST',
    },
  },
  {
    id: 'cfg-task-b',
    task_key: 'task_b_morning',
    name: 'Morning Himalayas Import',
    enabled: true,
    schedule_expression: '0 2 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      limit: 20,
      pages: 1,
      targetCount: 20,
      istTime: '7:30 AM IST',
      description: 'Morning pulse sync fetching 1 page of 20 jobs at 7:30 AM IST',
    },
  },
  {
    id: 'cfg-task-c',
    task_key: 'task_c_india',
    name: 'India-Eligible Job Import',
    enabled: true,
    schedule_expression: '30 18,0,6,12 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      limit: 20,
      pages: 5,
      maxFetch: 100,
      filter: 'india',
      istTime: '00:00, 06:00, 12:00, 18:00 IST',
      description: 'Every 6 hours sync for India and Worldwide eligible jobs',
    },
  },
  {
    id: 'cfg-task-d',
    task_key: 'task_d_expiry',
    name: 'Job Expiry Check',
    enabled: true,
    schedule_expression: '0 20 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      istTime: 'Daily 1:30 AM IST',
      description: 'Daily check marking published jobs with passed application deadlines as expired',
    },
  },
  {
    id: 'cfg-task-e',
    task_key: 'task_e_retention',
    name: 'Job Retention Cleanup',
    enabled: true,
    schedule_expression: '30 20 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      istTime: 'Daily 2:00 AM IST',
      retentionMonths: 3,
      description: 'Daily retention cleanup permanently deleting eligible Himalayas jobs closed > 3 months (never deletes manual jobs)',
    },
  },
];

interface FileStorageData {
  configs: SchedulerConfig[];
  runs: SchedulerRun[];
  jobErrors: SchedulerJobError[];
  syncedJobs: any[];
  companies: any[];
  applications: any[];
}

export class ServerDatabase {
  private static supabase: SupabaseClient | null = null;
  private static storageFilePath = path.resolve(process.cwd(), 'data', 'scheduler_store.json');
  private static activeLocks: Map<string, number> = new Map(); // taskKey -> expiresAt

  static init() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (
      supabaseUrl &&
      supabaseKey &&
      !supabaseUrl.includes('your-project') &&
      !supabaseKey.includes('...')
    ) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('[ServerDB] Connected to Supabase at:', supabaseUrl);
      } catch (e) {
        console.warn('[ServerDB] Failed to initialize Supabase client, falling back to local file storage:', e);
        this.supabase = null;
      }
    } else {
      console.log('[ServerDB] Running in local/offline persistent storage mode.');
    }

    const dataDir = path.dirname(this.storageFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.storageFilePath)) {
      const initial: FileStorageData = {
        configs: DEFAULT_CONFIGS,
        runs: [],
        jobErrors: [],
        syncedJobs: [],
        companies: [],
        applications: [],
      };
      fs.writeFileSync(this.storageFilePath, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  private static readFileStorage(): FileStorageData {
    try {
      if (!fs.existsSync(this.storageFilePath)) {
        return {
          configs: DEFAULT_CONFIGS,
          runs: [],
          jobErrors: [],
          syncedJobs: [],
          companies: [],
          applications: [],
        };
      }
      const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.applications) data.applications = [];
      // Ensure all 5 default configs exist
      for (const def of DEFAULT_CONFIGS) {
        if (!data.configs.some((c: SchedulerConfig) => c.task_key === def.task_key)) {
          data.configs.push(def);
        }
      }
      return data;
    } catch (e) {
      console.error('[ServerDB] Error reading local file storage:', e);
      return {
        configs: DEFAULT_CONFIGS,
        runs: [],
        jobErrors: [],
        syncedJobs: [],
        companies: [],
        applications: [],
      };
    }
  }

  private static writeFileStorage(data: FileStorageData): void {
    try {
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ServerDB] Error writing to local file storage:', e);
    }
  }

  // --- Concurrency / Distributed Lock Protection ---
  static async acquireLock(taskKey: string, ttlMs = 300000): Promise<boolean> {
    const now = Date.now();
    const existingExpiry = this.activeLocks.get(taskKey);
    if (existingExpiry && existingExpiry > now) {
      return false;
    }
    this.activeLocks.set(taskKey, now + ttlMs);
    return true;
  }

  static async releaseLock(taskKey: string): Promise<void> {
    this.activeLocks.delete(taskKey);
  }

  // --- Scheduler Configs ---
  static async getSchedulerConfigs(): Promise<SchedulerConfig[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('scheduler_config')
          .select('*')
          .order('task_key');
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase getSchedulerConfigs failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    return fileData.configs;
  }

  static async getSchedulerConfig(taskKey: SchedulerTaskKey): Promise<SchedulerConfig | null> {
    const configs = await this.getSchedulerConfigs();
    return configs.find((c) => c.task_key === taskKey) || null;
  }

  static async updateSchedulerConfig(
    taskKey: SchedulerTaskKey,
    updates: Partial<SchedulerConfig>
  ): Promise<SchedulerConfig> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('scheduler_config')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('task_key', taskKey)
          .select()
          .single();
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase updateSchedulerConfig failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    let updated: SchedulerConfig | null = null;
    fileData.configs = fileData.configs.map((c) => {
      if (c.task_key === taskKey) {
        updated = { ...c, ...updates, updated_at: new Date().toISOString() };
        return updated;
      }
      return c;
    });

    if (!updated) {
      const def = DEFAULT_CONFIGS.find((d) => d.task_key === taskKey);
      if (def) {
        updated = { ...def, ...updates, updated_at: new Date().toISOString() };
        fileData.configs.push(updated);
      }
    }

    this.writeFileStorage(fileData);
    return updated!;
  }

  // --- Scheduler Runs ---
  static async createSchedulerRun(runData: Omit<SchedulerRun, 'id'>): Promise<SchedulerRun> {
    const id = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newRun: SchedulerRun = {
      id,
      ...runData,
    };

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('scheduler_runs')
          .insert(newRun)
          .select()
          .single();
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase createSchedulerRun failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    fileData.runs.unshift(newRun);
    if (fileData.runs.length > 500) {
      fileData.runs = fileData.runs.slice(0, 500);
    }
    this.writeFileStorage(fileData);
    return newRun;
  }

  static async updateSchedulerRun(
    runId: string,
    updates: Partial<SchedulerRun>
  ): Promise<SchedulerRun> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('scheduler_runs')
          .update(updates)
          .eq('id', runId)
          .select()
          .single();
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase updateSchedulerRun failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    let updated: SchedulerRun | null = null;
    fileData.runs = fileData.runs.map((r) => {
      if (r.id === runId) {
        updated = { ...r, ...updates };
        return updated;
      }
      return r;
    });

    this.writeFileStorage(fileData);
    return updated!;
  }

  static async getSchedulerRuns(taskKey?: SchedulerTaskKey, limit = 50): Promise<SchedulerRun[]> {
    if (this.supabase) {
      try {
        let query = this.supabase
          .from('scheduler_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        if (taskKey) {
          query = query.eq('task_key', taskKey);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase getSchedulerRuns failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    let runs = fileData.runs;
    if (taskKey) {
      runs = runs.filter((r) => r.task_key === taskKey);
    }
    return runs.slice(0, limit);
  }

  // --- Scheduler Job Errors ---
  static async createJobError(
    errorData: Omit<SchedulerJobError, 'id' | 'created_at'>
  ): Promise<SchedulerJobError> {
    const newError: SchedulerJobError = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...errorData,
      created_at: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('scheduler_job_errors')
          .insert(newError)
          .select()
          .single();
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase createJobError failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    fileData.jobErrors.unshift(newError);
    if (fileData.jobErrors.length > 1000) {
      fileData.jobErrors = fileData.jobErrors.slice(0, 1000);
    }
    this.writeFileStorage(fileData);
    return newError;
  }

  static async getJobErrors(runId: string): Promise<SchedulerJobError[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('scheduler_job_errors')
          .select('*')
          .eq('run_id', runId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase getJobErrors failed, using fallback:', err);
      }
    }

    const fileData = this.readFileStorage();
    return fileData.jobErrors.filter((e) => e.run_id === runId);
  }

  // --- Duplicate Detection & Job Synchronization ---
  static async findExistingJob(criteria: {
    guid?: string;
    applicationUrl?: string;
    companySlug?: string;
    title?: string;
  }): Promise<any | null> {
    const normTitle = criteria.title
      ? criteria.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      : '';

    if (this.supabase) {
      try {
        // 1. Check external_job_id (Himalayas GUID)
        if (criteria.guid) {
          const { data: byGuid } = await this.supabase
            .from('jobs')
            .select('id, title, slug, source, external_job_id, external_application_url, imported_at, status')
            .eq('external_job_id', criteria.guid)
            .limit(1)
            .maybeSingle();
          if (byGuid) return byGuid;
        }

        // 2. Check external_application_url
        const checkUrl = criteria.applicationUrl || criteria.guid;
        if (checkUrl) {
          const { data: byUrl } = await this.supabase
            .from('jobs')
            .select('id, title, slug, source, external_job_id, external_application_url, imported_at, status')
            .eq('external_application_url', checkUrl)
            .limit(1)
            .maybeSingle();
          if (byUrl) return byUrl;
        }

        // 3. Fallback: Check company + title
        if (criteria.companySlug && criteria.title) {
          const { data: comp } = await this.supabase
            .from('companies')
            .select('id')
            .eq('slug', criteria.companySlug)
            .limit(1)
            .maybeSingle();

          if (comp) {
            const { data: jobs } = await this.supabase
              .from('jobs')
              .select('id, title, slug, source, external_job_id, external_application_url, imported_at, status')
              .eq('company_id', comp.id);

            if (jobs && jobs.length > 0) {
              const matched = jobs.find((j) => {
                const existingNorm = j.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                return existingNorm === normTitle;
              });
              if (matched) return matched;
            }
          }
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase findExistingJob query failed, checking local store:', err);
      }
    }

    const fileData = this.readFileStorage();
    const existing = fileData.syncedJobs.find((j: any) => {
      if (criteria.guid && (j.external_job_id === criteria.guid || j.guid === criteria.guid)) {
        return true;
      }
      const checkUrl = criteria.applicationUrl || criteria.guid;
      if (checkUrl && j.external_application_url === checkUrl) {
        return true;
      }
      if (criteria.companySlug && normTitle) {
        const jNorm = (j.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const jCompSlug = j.company?.slug || j.company_slug;
        if (jCompSlug === criteria.companySlug && jNorm === normTitle) {
          return true;
        }
      }
      return false;
    });

    return existing || null;
  }

  static async saveOrUpdateJob(
    jobData: any,
    companyData: any,
    existingJob?: any
  ): Promise<{ job: any; isNew: boolean; isUpdated: boolean }> {
    let savedCompany = companyData;

    // Handle existing job update
    if (existingJob) {
      // RULE: Do not overwrite manually created jobs!
      if (existingJob.source === 'manual') {
        return { job: existingJob, isNew: false, isUpdated: false };
      }

      // Existing Himalayas job: Update source fields while preserving imported_at and applications
      const updates = {
        external_job_id: jobData.external_job_id || existingJob.external_job_id,
        salary_min: jobData.salary_min !== undefined ? jobData.salary_min : existingJob.salary_min,
        salary_max: jobData.salary_max !== undefined ? jobData.salary_max : existingJob.salary_max,
        salary_currency: jobData.salary_currency || existingJob.salary_currency,
        external_application_url: jobData.external_application_url || existingJob.external_application_url,
        updated_at: new Date().toISOString(),
      };

      if (this.supabase) {
        try {
          await this.supabase.from('jobs').update(updates).eq('id', existingJob.id);
        } catch (err) {
          console.warn('[ServerDB] Supabase job update failed:', err);
        }
      }

      const fileData = this.readFileStorage();
      const idx = fileData.syncedJobs.findIndex((j) => j.id === existingJob.id);
      if (idx !== -1) {
        fileData.syncedJobs[idx] = { ...fileData.syncedJobs[idx], ...updates };
        this.writeFileStorage(fileData);
      }

      return { job: { ...existingJob, ...updates }, isNew: false, isUpdated: true };
    }

    // New Job Insertion
    let savedJob = {
      ...jobData,
      source: 'himalayas',
      imported_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        const { data: existingComp } = await this.supabase
          .from('companies')
          .select('*')
          .eq('slug', companyData.slug)
          .maybeSingle();

        if (existingComp) {
          savedCompany = existingComp;
        } else {
          const { data: createdComp, error: compErr } = await this.supabase
            .from('companies')
            .insert({
              name: companyData.name,
              slug: companyData.slug,
              logo_url: companyData.logo_url,
              description: companyData.description,
              website: companyData.website,
              industry: companyData.industry,
              company_size: companyData.company_size,
              headquarters: companyData.headquarters,
              country: companyData.country,
              city: companyData.city,
            })
            .select()
            .single();

          if (!compErr && createdComp) {
            savedCompany = createdComp;
          }
        }

        const jobToInsert = {
          ...savedJob,
          company_id: savedCompany.id,
        };

        const { data: createdJob, error: jobErr } = await this.supabase
          .from('jobs')
          .insert(jobToInsert)
          .select()
          .single();

        if (!jobErr && createdJob) {
          savedJob = { ...createdJob, company: savedCompany };
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase insert failed, storing locally:', err);
      }
    }

    const fileData = this.readFileStorage();
    const compIdx = fileData.companies.findIndex((c) => c.slug === savedCompany.slug);
    if (compIdx === -1) {
      fileData.companies.push(savedCompany);
    } else {
      fileData.companies[compIdx] = { ...fileData.companies[compIdx], ...savedCompany };
    }

    savedJob.company = savedCompany;
    savedJob.id = savedJob.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    fileData.syncedJobs.unshift(savedJob);
    this.writeFileStorage(fileData);

    return { job: savedJob, isNew: true, isUpdated: false };
  }

  // --- Task D: Process Job Expiry ---
  static async executeJobExpiry(): Promise<{ success: boolean; expiredCount: number }> {
    const now = new Date();
    let expiredCount = 0;

    if (this.supabase) {
      try {
        // Try calling stored SQL function first
        const { data: rpcData, error: rpcErr } = await this.supabase.rpc('process_job_expiry');
        if (!rpcErr && rpcData) {
          return { success: true, expiredCount: rpcData.expired_count || 0 };
        }

        // Fallback: direct query on Supabase
        const { data: expiredJobs, error: selectErr } = await this.supabase
          .from('jobs')
          .select('id')
          .eq('status', 'published')
          .not('application_deadline', 'is', null)
          .lte('application_deadline', now.toISOString());

        if (!selectErr && expiredJobs && expiredJobs.length > 0) {
          const ids = expiredJobs.map((j) => j.id);
          const { error: updateErr } = await this.supabase
            .from('jobs')
            .update({
              status: 'expired',
              closed_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .in('id', ids);

          if (!updateErr) {
            expiredCount = ids.length;
          }
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase executeJobExpiry failed, checking local store:', err);
      }
    }

    // Process local store
    const fileData = this.readFileStorage();
    fileData.syncedJobs = fileData.syncedJobs.map((job) => {
      if (
        job.status === 'published' &&
        job.application_deadline &&
        new Date(job.application_deadline) <= now
      ) {
        expiredCount++;
        return {
          ...job,
          status: 'expired',
          closed_at: job.closed_at || now.toISOString(),
          updated_at: now.toISOString(),
        };
      }
      return job;
    });

    this.writeFileStorage(fileData);
    return { success: true, expiredCount };
  }

  // --- Task E: Process Job Retention Cleanup ---
  static async executeJobRetention(): Promise<{ success: boolean; deletedCount: number }> {
    const now = Date.now();
    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    if (this.supabase) {
      try {
        // Try calling stored SQL function first
        const { data: rpcData, error: rpcErr } = await this.supabase.rpc('process_job_retention_cleanup');
        if (!rpcErr && rpcData) {
          return { success: true, deletedCount: rpcData.deleted_count || 0 };
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase process_job_retention_cleanup RPC failed:', err);
      }
    }

    // Process local store
    const fileData = this.readFileStorage();
    const remainingJobs: any[] = [];
    const deletedJobIds: string[] = [];

    for (const job of fileData.syncedJobs) {
      // RULE: Never delete manual jobs
      if (job.source !== 'himalayas') {
        remainingJobs.push(job);
        continue;
      }

      // RULE: Never delete published or active jobs
      if (job.status === 'published' || job.status === 'draft') {
        remainingJobs.push(job);
        continue;
      }

      if (!['expired', 'filled', 'archived'].includes(job.status)) {
        remainingJobs.push(job);
        continue;
      }

      // Applications for this job
      const apps = fileData.applications?.filter((a: any) => a.job_id === job.id) || [];
      const closedAtMs = job.closed_at ? new Date(job.closed_at).getTime() : new Date(job.updated_at).getTime();

      if (apps.length === 0) {
        // Rule A: Zero apps -> delete if closed >= 3 months
        if (now - closedAtMs >= THREE_MONTHS_MS) {
          deletedJobIds.push(job.id);
          deletedCount++;
          continue;
        }
      } else {
        // Rule B & C: With apps -> retention_start = GREATEST(closed_at, latest_application_date)
        const latestAppMs = Math.max(...apps.map((a: any) => new Date(a.applied_at).getTime()));
        const retentionStartMs = Math.max(closedAtMs, latestAppMs);
        if (now - retentionStartMs >= THREE_MONTHS_MS) {
          deletedJobIds.push(job.id);
          deletedCount++;
          continue;
        }
      }

      remainingJobs.push(job);
    }

    fileData.syncedJobs = remainingJobs;
    if (fileData.applications) {
      fileData.applications = fileData.applications.filter((a: any) => !deletedJobIds.includes(a.job_id));
    }
    this.writeFileStorage(fileData);

    return { success: true, deletedCount };
  }

  // --- Scheduler Overview Metrics ---
  static async getOverviewStats(): Promise<{
    totalImported: number;
    importedToday: number;
    updatedToday: number;
    duplicatesSkipped: number;
    failedImports: number;
    expiredJobs: number;
    retentionDeleted: number;
    lastSuccessfulSync: string | null;
  }> {
    const fileData = this.readFileStorage();
    const runs = fileData.runs;
    const today = new Date().toISOString().split('T')[0];

    const totalImported = fileData.syncedJobs.filter((j) => j.source === 'himalayas').length;
    const importedToday = fileData.syncedJobs.filter(
      (j) => j.source === 'himalayas' && j.imported_at?.startsWith(today)
    ).length;
    const updatedToday = fileData.syncedJobs.filter(
      (j) => j.source === 'himalayas' && j.updated_at?.startsWith(today) && !j.imported_at?.startsWith(today)
    ).length;

    const duplicatesSkipped = runs.reduce((sum, r) => sum + (r.duplicate_count || 0), 0);
    const failedImports = runs.reduce((sum, r) => sum + (r.failed_count || 0), 0);

    const expiredJobs = fileData.syncedJobs.filter((j) => j.status === 'expired').length;
    const retentionRuns = runs.filter((r) => r.task_key === 'task_e_retention');
    const retentionDeleted = retentionRuns.reduce((sum, r) => sum + (r.synced_count || 0), 0);

    const successRuns = runs.filter((r) => r.status === 'success');
    const lastSuccessfulSync = successRuns[0]?.completed_at || null;

    return {
      totalImported,
      importedToday,
      updatedToday,
      duplicatesSkipped,
      failedImports,
      expiredJobs,
      retentionDeleted,
      lastSuccessfulSync,
    };
  }

  static async getAllJobs(): Promise<any[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('jobs')
          .select('*, company:companies(*)')
          .order('published_at', { ascending: false });
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[ServerDB] Supabase getAllJobs failed:', err);
      }
    }

    const fileData = this.readFileStorage();
    return fileData.syncedJobs;
  }
}

ServerDatabase.init();
