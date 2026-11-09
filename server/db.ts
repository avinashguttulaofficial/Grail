import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SchedulerConfig, SchedulerRun, SchedulerJobError, SchedulerTaskKey } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Default scheduler configs
const DEFAULT_CONFIGS: SchedulerConfig[] = [
  {
    id: 'cfg-task-a',
    task_key: 'task_a_nightly',
    name: 'Nightly Full Feed Sync',
    enabled: true,
    schedule_expression: '30 21 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      limit: 20,
      pages: 5,
      targetCount: 100,
      description: 'Nightly full sync fetching 5 pages of 20 jobs (100 jobs total) at 9:30 PM IST',
    },
  },
  {
    id: 'cfg-task-b',
    task_key: 'task_b_morning',
    name: 'Morning Feed Sync',
    enabled: true,
    schedule_expression: '30 7 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      limit: 20,
      pages: 1,
      targetCount: 20,
      description: 'Morning pulse sync fetching 1 page of 20 jobs at 7:30 AM IST',
    },
  },
  {
    id: 'cfg-task-c',
    task_key: 'task_c_india',
    name: 'India Location Sync',
    enabled: true,
    schedule_expression: '0 0,6,12,18 * * *',
    timezone: 'Asia/Kolkata',
    configuration_json: {
      limit: 20,
      pages: 5,
      maxFetch: 100,
      filter: 'india',
      description: 'Every 6 hours (00:00, 06:00, 12:00, 18:00 IST) sync for India and Worldwide eligible jobs',
    },
  },
];

interface FileStorageData {
  configs: SchedulerConfig[];
  runs: SchedulerRun[];
  jobErrors: SchedulerJobError[];
  syncedJobs: any[];
  companies: any[];
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

    // Ensure data directory exists for local fallback
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
        };
      }
      const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
      const data = JSON.parse(raw);
      // Ensure all default configs exist
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
      // Lock is currently held
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
    // Keep max 500 recent runs in file storage to prevent unbounded growth
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
            .select('id, title, slug, external_job_id, external_application_url')
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
            .select('id, title, slug, external_job_id, external_application_url')
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
              .select('id, title, slug, external_job_id, external_application_url')
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

    // Check local file storage
    const fileData = this.readFileStorage();
    const existing = fileData.syncedJobs.find((j: any) => {
      // 1. GUID
      if (criteria.guid && (j.external_job_id === criteria.guid || j.guid === criteria.guid)) {
        return true;
      }
      // 2. Application URL
      const checkUrl = criteria.applicationUrl || criteria.guid;
      if (checkUrl && j.external_application_url === checkUrl) {
        return true;
      }
      // 3. Company slug + normalized title
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

  static async saveJob(jobData: any, companyData: any): Promise<{ job: any; company: any }> {
    let savedCompany = companyData;
    let savedJob = jobData;

    if (this.supabase) {
      try {
        // Upsert company
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

        // Insert job
        const jobToInsert = {
          title: jobData.title,
          slug: jobData.slug,
          company_id: savedCompany.id,
          description: jobData.description,
          responsibilities: jobData.responsibilities,
          requirements: jobData.requirements,
          qualifications: jobData.qualifications,
          benefits: jobData.benefits,
          location: jobData.location,
          country: jobData.country,
          workplace_type: jobData.workplace_type,
          employment_type: jobData.employment_type,
          experience_level: jobData.experience_level,
          salary_min: jobData.salary_min,
          salary_max: jobData.salary_max,
          salary_currency: jobData.salary_currency,
          salary_period: jobData.salary_period,
          salary_visible: jobData.salary_visible,
          application_mode: jobData.application_mode,
          external_application_url: jobData.external_application_url,
          external_job_id: jobData.external_job_id,
          status: 'published',
          is_featured: false,
          published_at: new Date().toISOString(),
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
        console.warn('[ServerDB] Supabase saveJob failed, saving to local store:', err);
      }
    }

    // Always mirror to local store as well
    const fileData = this.readFileStorage();
    // Company
    const compIdx = fileData.companies.findIndex((c) => c.slug === savedCompany.slug);
    if (compIdx === -1) {
      fileData.companies.push(savedCompany);
    } else {
      fileData.companies[compIdx] = { ...fileData.companies[compIdx], ...savedCompany };
    }

    // Job
    savedJob.company = savedCompany;
    fileData.syncedJobs.unshift(savedJob);
    this.writeFileStorage(fileData);

    return { job: savedJob, company: savedCompany };
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

// Initialize server database on load
ServerDatabase.init();
