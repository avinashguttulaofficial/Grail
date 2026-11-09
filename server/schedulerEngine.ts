import { ServerHimalayasClient } from './himalayasClient';
import { ServerDatabase } from './db';
import { SchedulerRun, SchedulerTaskKey } from './types';
import { HimalayasRawJob } from '../src/services/himalayas';

export class SchedulerEngine {
  /**
   * Helper to check if a Himalayas raw job is eligible for India based on business rules:
   * 1. Location restrictions containing "India" (case-insensitive)
   * 2. Worldwide / Anywhere location restrictions
   * 3. Empty location restrictions (per existing worldwide eligibility rule)
   * 4. Excludes jobs restricted exclusively to other countries (e.g. ['US Only'], ['United States'])
   */
  static isJobEligibleForIndia(job: HimalayasRawJob): boolean {
    const locs = job.locationRestrictions || [];

    // Rule: Empty location restrictions = worldwide = eligible for India
    if (locs.length === 0) {
      return true;
    }

    const lowerLocs = locs.map((l) => l.toLowerCase().trim());

    // Check for explicit India inclusion
    const mentionsIndia = lowerLocs.some((l) => l.includes('india') || l === 'in');
    if (mentionsIndia) {
      return true;
    }

    // Check for worldwide / anywhere
    const mentionsWorldwide = lowerLocs.some(
      (l) => l.includes('worldwide') || l.includes('anywhere') || l.includes('global')
    );
    if (mentionsWorldwide) {
      return true;
    }

    // If there are specific location restrictions and none include India or Worldwide,
    // the job is restricted exclusively to other countries.
    return false;
  }

  /**
   * Normalize job title for fallback duplicate comparison
   */
  static normalizeTitle(title: string): string {
    return (title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /**
   * Transform raw Himalayas job into internal DB format
   */
  static mapRawJobToDb(raw: HimalayasRawJob) {
    const companySlug =
      raw.companySlug || raw.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const companyData = {
      name: raw.companyName,
      slug: companySlug,
      logo_url: raw.companyLogo || undefined,
      description: `${raw.companyName} is a remote-first organization hiring through the Himalayas talent network.`,
      website: raw.guid ? new URL(raw.guid).origin : 'https://himalayas.app',
      industry: raw.categories?.[0] || 'Software & Digital Products',
      company_size: '50-200',
      headquarters: raw.locationRestrictions?.[0] || 'Remote Worldwide',
      country: raw.locationRestrictions?.[0] || 'United States',
      city: 'Remote',
    };

    // Employment Type
    let employmentType = 'full-time';
    const rawType = (raw.employmentType || '').toLowerCase();
    if (rawType.includes('contract')) employmentType = 'contract';
    else if (rawType.includes('freelance')) employmentType = 'freelance';
    else if (rawType.includes('part')) employmentType = 'part-time';
    else if (rawType.includes('intern')) employmentType = 'internship';

    // Experience Level
    let experienceLevel = 'mid';
    const seniority = (raw.seniority?.[0] || '').toLowerCase();
    if (seniority.includes('senior')) experienceLevel = 'senior';
    else if (seniority.includes('fresher') || seniority.includes('intern') || seniority.includes('graduate')) experienceLevel = 'freshers';
    else if (seniority.includes('entry') || seniority.includes('junior')) experienceLevel = 'entry';
    else if (seniority.includes('lead') || seniority.includes('principal')) experienceLevel = 'lead';
    else if (seniority.includes('director') || seniority.includes('executive')) experienceLevel = 'executive';

    // Clean Description
    const cleanDescription = (raw.excerpt || raw.description || '')
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const location = raw.locationRestrictions?.length
      ? `Remote (${raw.locationRestrictions.slice(0, 3).join(', ')})`
      : 'Remote Worldwide';

    const baseSlug = `${companySlug}-${raw.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

    const jobData = {
      title: raw.title,
      slug: `${baseSlug}-${Date.now().toString(36)}`,
      description: cleanDescription || `Remote ${raw.title} opportunity at ${raw.companyName}.`,
      responsibilities: [
        'Deliver high-quality work aligned with team OKRs and sprint deliverables',
        'Collaborate across distributed timezones using asynchronous workflows',
        'Maintain clear documentation and technical standards',
      ],
      requirements: [
        'Demonstrated professional experience in relevant discipline',
        'Strong asynchronous communication and self-direction',
        'Comfort working within a fully remote, international engineering team',
      ],
      qualifications: ['Proven track record in digital products or modern web applications'],
      benefits: [
        '100% remote working flexibility',
        'Competitive compensation via Himalayas platform',
        'Global health and workstation allowances where applicable',
      ],
      location,
      country: raw.locationRestrictions?.[0] || 'United States',
      workplace_type: 'remote',
      employment_type: employmentType,
      experience_level: experienceLevel,
      salary_min: raw.minSalary || undefined,
      salary_max: raw.maxSalary || undefined,
      salary_currency: raw.currency || 'USD',
      salary_period: (raw.salaryPeriod as any) || 'yearly',
      salary_visible: Boolean(raw.minSalary),
      application_mode: 'external',
      external_application_url:
        raw.applicationLink ||
        raw.guid ||
        `https://himalayas.app/companies/${companySlug}/jobs/${raw.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      external_job_id: raw.guid,
      status: 'published',
      is_featured: false,
      skills: raw.categories || ['Remote', 'Engineering'],
    };

    return { jobData, companyData };
  }

  /**
   * Execute one of the three scheduled tasks
   */
  static async executeTask(
    taskKey: SchedulerTaskKey,
    triggerType: 'scheduled' | 'manual' | 'cron_webhook' = 'scheduled'
  ): Promise<SchedulerRun> {
    const config = await ServerDatabase.getSchedulerConfig(taskKey);
    if (!config) {
      throw new Error(`Configuration not found for task key: ${taskKey}`);
    }

    if (!config.enabled && triggerType === 'scheduled') {
      console.log(`[SchedulerEngine] Task ${taskKey} is disabled. Skipping scheduled execution.`);
      throw new Error(`Task ${taskKey} is currently disabled.`);
    }

    // 1. Concurrency Protection: Acquire Distributed Lock (5 min TTL)
    const acquired = await ServerDatabase.acquireLock(taskKey, 300000);
    if (!acquired) {
      console.warn(`[SchedulerEngine] Task ${taskKey} is already running. Skipping execution.`);
      throw new Error(`Task ${taskKey} is already running in another process.`);
    }

    const startedAt = new Date().toISOString();
    let run = await ServerDatabase.createSchedulerRun({
      task_key: taskKey,
      started_at: startedAt,
      status: 'running',
      fetched_count: 0,
      matched_count: 0,
      synced_count: 0,
      duplicate_count: 0,
      failed_count: 0,
      execution_metadata: {
        trigger_type: triggerType,
        config: config.configuration_json,
      },
    });

    try {
      console.log(`[SchedulerEngine] Starting run ${run.id} for ${config.name} (${taskKey})...`);

      // 2. Determine fetch parameters based on task specification
      let limitPerPage = config.configuration_json.limit || 20;
      let pagesToFetch = config.configuration_json.pages || 1;
      let targetJobCount = config.configuration_json.targetCount || 20;

      if (taskKey === 'task_a_nightly') {
        // Spec: Fetch 100 jobs, 5 pages, 20 jobs per page
        limitPerPage = 20;
        pagesToFetch = 5;
        targetJobCount = 100;
      } else if (taskKey === 'task_b_morning') {
        // Spec: Fetch 20 jobs, 1 page
        limitPerPage = 20;
        pagesToFetch = 1;
        targetJobCount = 20;
      } else if (taskKey === 'task_c_india') {
        // Spec: Configurable max feed-fetch size defaulting to 100 jobs
        const maxFetch = config.configuration_json.maxFetch || 100;
        pagesToFetch = Math.ceil(maxFetch / limitPerPage);
        targetJobCount = maxFetch;
      }

      // 3. Fetch from Himalayas with multi-page cursor pagination & retry
      const fetchResult = await ServerHimalayasClient.fetchMultiPage({
        limit: limitPerPage,
        pages: pagesToFetch,
        maxRetries: 3,
      });

      const fetchedJobs = fetchResult.jobs.slice(0, targetJobCount);
      console.log(`[SchedulerEngine] Fetched ${fetchedJobs.length} raw jobs for ${taskKey}.`);

      // 4. Apply filters (Task C India filter)
      let candidateJobs = fetchedJobs;
      if (taskKey === 'task_c_india') {
        candidateJobs = fetchedJobs.filter((j) => this.isJobEligibleForIndia(j));
        console.log(`[SchedulerEngine] Matched ${candidateJobs.length} India-eligible jobs out of ${fetchedJobs.length}.`);
      }

      let fetchedCount = fetchedJobs.length;
      let matchedCount = candidateJobs.length;
      let syncedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      // 5. Deduplicate and Sync Candidate Jobs
      // In-memory set for current batch to prevent intra-batch duplicates
      const batchGuids = new Set<string>();
      const batchUrls = new Set<string>();
      const batchKeys = new Set<string>();

      for (const rawJob of candidateJobs) {
        const guid = rawJob.guid;
        const appUrl = rawJob.applicationLink || rawJob.guid;
        const compSlug = rawJob.companySlug || rawJob.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const normTitle = this.normalizeTitle(rawJob.title);
        const compTitleKey = `${compSlug}:::${normTitle}`;

        // Intra-batch duplicate check
        if (
          (guid && batchGuids.has(guid)) ||
          (appUrl && batchUrls.has(appUrl)) ||
          batchKeys.has(compTitleKey)
        ) {
          duplicateCount++;
          continue;
        }

        try {
          // Database Duplicate Check
          const existing = await ServerDatabase.findExistingJob({
            guid,
            applicationUrl: appUrl,
            companySlug: compSlug,
            title: rawJob.title,
          });

          if (existing) {
            // Already exists in DB - Skip safely, preserve existing data & ID
            duplicateCount++;
            if (guid) batchGuids.add(guid);
            if (appUrl) batchUrls.add(appUrl);
            batchKeys.add(compTitleKey);
            continue;
          }

          // Not a duplicate: Map and Save to Database
          const { jobData, companyData } = this.mapRawJobToDb(rawJob);
          await ServerDatabase.saveJob(jobData, companyData);

          syncedCount++;
          if (guid) batchGuids.add(guid);
          if (appUrl) batchUrls.add(appUrl);
          batchKeys.add(compTitleKey);
        } catch (jobErr: any) {
          failedCount++;
          console.error(`[SchedulerEngine] Failed to sync job "${rawJob.title}":`, jobErr);
          // Record job-level error
          await ServerDatabase.createJobError({
            run_id: run.id,
            external_job_id: guid,
            job_title: rawJob.title,
            error_message: jobErr.message || String(jobErr),
            retry_count: 0,
          });
          // Resilient: One failed job does not stop the remaining batch
        }
      }

      // 6. Compute Final Run Status
      let finalStatus: 'success' | 'partial_success' | 'failed' = 'success';
      if (failedCount > 0 && syncedCount > 0) {
        finalStatus = 'partial_success';
      } else if (failedCount > 0 && syncedCount === 0 && matchedCount > 0) {
        finalStatus = 'failed';
      }

      const completedAt = new Date().toISOString();
      run = await ServerDatabase.updateSchedulerRun(run.id, {
        completed_at: completedAt,
        status: finalStatus,
        fetched_count: fetchedCount,
        matched_count: matchedCount,
        synced_count: syncedCount,
        duplicate_count: duplicateCount,
        failed_count: failedCount,
      });

      console.log(
        `[SchedulerEngine] Completed run ${run.id} for ${taskKey}: status=${finalStatus}, fetched=${fetchedCount}, matched=${matchedCount}, synced=${syncedCount}, duplicates=${duplicateCount}, failed=${failedCount}`
      );

      return run;
    } catch (criticalErr: any) {
      console.error(`[SchedulerEngine] Critical failure in run ${run.id} for ${taskKey}:`, criticalErr);
      const completedAt = new Date().toISOString();
      run = await ServerDatabase.updateSchedulerRun(run.id, {
        completed_at: completedAt,
        status: 'failed',
        error_message: criticalErr.message || String(criticalErr),
      });
      return run;
    } finally {
      // 7. Always Release Concurrency Lock
      await ServerDatabase.releaseLock(taskKey);
    }
  }
}
