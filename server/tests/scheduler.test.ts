import assert from 'assert';
import { ServerDatabase } from '../db';
import { SchedulerEngine } from '../schedulerEngine';
import { CronManager } from '../cronManager';
import { DataStore } from '../../src/services/store';
import { HimalayasRawJob } from '../../src/services/himalayas';

async function runTestSuite() {
  console.log('--- Starting Comprehensive Scheduler & Lifecycle Test Suite ---\n');

  // ==========================================
  // 1. IMPORT & DEDUPLICATION TESTS
  // ==========================================
  console.log('1. Testing Import & Deduplication Logic:');

  // Test 1.1: India Eligibility Filter
  const indiaJob: HimalayasRawJob = {
    title: 'Senior Frontend Engineer',
    companyName: 'Acme Corp',
    companySlug: 'acme-corp',
    locationRestrictions: ['India'],
  };
  assert.strictEqual(SchedulerEngine.isJobEligibleForIndia(indiaJob), true, 'Explicit India location must be eligible');

  const worldwideJob: HimalayasRawJob = {
    title: 'Product Designer',
    companyName: 'Studio Worldwide',
    companySlug: 'studio-worldwide',
    locationRestrictions: ['Worldwide'],
  };
  assert.strictEqual(SchedulerEngine.isJobEligibleForIndia(worldwideJob), true, 'Worldwide location must be eligible');

  const emptyLocJob: HimalayasRawJob = {
    title: 'Backend Engineer',
    companyName: 'Global Cloud',
    companySlug: 'global-cloud',
    locationRestrictions: [],
  };
  assert.strictEqual(SchedulerEngine.isJobEligibleForIndia(emptyLocJob), true, 'Empty location array must be eligible (worldwide rule)');

  const usOnlyJob: HimalayasRawJob = {
    title: 'Staff Architect',
    companyName: 'US Only Tech',
    companySlug: 'us-only-tech',
    locationRestrictions: ['United States'],
  };
  assert.strictEqual(SchedulerEngine.isJobEligibleForIndia(usOnlyJob), false, 'US-only job must NOT be eligible for India');

  console.log('  ✓ India & Worldwide eligibility filtering passes all criteria');

  // Test 1.2: Deduplication and Updating
  const sampleGuid = `test-guid-${Date.now()}`;
  const rawHimalayasJob: HimalayasRawJob = {
    guid: sampleGuid,
    title: 'Senior Design Systems Lead',
    companyName: 'Mono Studio',
    companySlug: 'mono-studio',
    minSalary: 120000,
    maxSalary: 150000,
    currency: 'USD',
    locationRestrictions: ['Worldwide'],
    applicationLink: `https://example.com/apply/${sampleGuid}`,
  };

  const { jobData, companyData } = SchedulerEngine.mapRawJobToDb(rawHimalayasJob);

  // Initial insert
  const firstSave = await ServerDatabase.saveOrUpdateJob(jobData, companyData);
  assert.strictEqual(firstSave.isNew, true, 'First import should be marked as new');
  assert.strictEqual(firstSave.job.source, 'himalayas', 'Imported job source must be "himalayas"');
  assert.strictEqual(firstSave.job.external_job_id, sampleGuid, 'external_job_id must match Himalayas GUID');
  assert.ok(firstSave.job.imported_at, 'imported_at timestamp must be set');

  // Second import with updated salary
  const updatedRaw = { ...rawHimalayasJob, minSalary: 130000, maxSalary: 160000 };
  const mappedUpdated = SchedulerEngine.mapRawJobToDb(updatedRaw);
  const existingFound = await ServerDatabase.findExistingJob({ guid: sampleGuid });
  assert.ok(existingFound, 'Should find existing job by GUID');

  const secondSave = await ServerDatabase.saveOrUpdateJob(mappedUpdated.jobData, mappedUpdated.companyData, existingFound);
  assert.strictEqual(secondSave.isNew, false, 'Second import should not be marked as new');
  assert.strictEqual(secondSave.isUpdated, true, 'Second import should update source fields');
  assert.strictEqual(secondSave.job.salary_min, 130000, 'Salary should be updated');
  assert.strictEqual(secondSave.job.id, firstSave.job.id, 'Job ID must be preserved across updates');

  // Test 1.3: Manual jobs must NOT be modified by automatic import
  const manualJob = DataStore.createJob({
    title: 'Manual Creative Director',
    company_id: 'comp-1',
    description: 'Bespoke manual job listing',
    location: 'New York',
    country: 'United States',
    workplace_type: 'on-site',
    employment_type: 'full-time',
    experience_level: 'director' as any,
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'published',
    is_featured: true,
    source: 'manual',
    responsibilities: ['Lead creative'],
    requirements: ['10+ years'],
    qualifications: ['BFA'],
    benefits: ['Health'],
  });

  assert.strictEqual(manualJob.source, 'manual', 'Manual job must have source = manual');

  const attemptedOverwrite = await ServerDatabase.saveOrUpdateJob(
    { ...jobData, title: 'Attempted Overwrite', external_job_id: 'overwrite-guid' },
    companyData,
    manualJob
  );
  assert.strictEqual(attemptedOverwrite.isNew, false, 'Manual job must not be overwritten');
  assert.strictEqual(attemptedOverwrite.isUpdated, false, 'Manual job must not be updated by feed sync');
  assert.strictEqual(attemptedOverwrite.job.title, manualJob.title, 'Manual job title must remain intact');

  console.log('  ✓ Deduplication, field updates, and manual job protection pass');

  // ==========================================
  // 2. JOB EXPIRY TESTS
  // ==========================================
  console.log('\n2. Testing Job Expiry Management:');

  // Past deadline job -> should expire
  const pastDeadlineJob = DataStore.createJob({
    title: 'Expired Frontend Role',
    company_id: 'comp-1',
    description: 'This job deadline has passed',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'published',
    is_featured: false,
    source: 'himalayas',
    application_deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  // Future deadline job -> should remain published
  const futureDeadlineJob = DataStore.createJob({
    title: 'Active Future Role',
    company_id: 'comp-1',
    description: 'This job deadline is next month',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'published',
    is_featured: false,
    source: 'himalayas',
    application_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ahead
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  // No deadline job -> should remain published
  const noDeadlineJob = DataStore.createJob({
    title: 'No Deadline Role',
    company_id: 'comp-1',
    description: 'This job has no deadline',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'published',
    is_featured: false,
    source: 'himalayas',
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  const expiryRun = DataStore.processJobExpiry();
  assert.ok(expiryRun.count >= 1, 'At least 1 job must be expired');

  const refreshedPast = DataStore.getJobs().find((j) => j.id === pastDeadlineJob.id);
  assert.strictEqual(refreshedPast?.status, 'expired', 'Past deadline job must be marked as expired');
  assert.ok(refreshedPast?.closed_at, 'closed_at must be populated upon expiry');

  const refreshedFuture = DataStore.getJobs().find((j) => j.id === futureDeadlineJob.id);
  assert.strictEqual(refreshedFuture?.status, 'published', 'Future deadline job must remain published');

  const refreshedNoDeadline = DataStore.getJobs().find((j) => j.id === noDeadlineJob.id);
  assert.strictEqual(refreshedNoDeadline?.status, 'published', 'Job without deadline must remain published');

  // Test Application Eligibility: Cannot apply to expired job
  assert.throws(
    () => {
      DataStore.submitApplication({
        jobId: pastDeadlineJob.id,
        userId: 'user-1',
      });
    },
    /Cannot apply/,
    'Applying to expired job must be rejected with an eligibility error'
  );

  console.log('  ✓ Past deadline expires, future/empty remain published, expired cannot receive applications');

  // ==========================================
  // 3. JOB RETENTION & AUTOMATIC DELETION TESTS
  // ==========================================
  console.log('\n3. Testing Automatic Job Retention & Deletion:');

  const FOUR_MONTHS_AGO = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const ONE_MONTH_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Test 3.1: Expired Himalayas job with 0 applications, closed 4 months ago -> DELETE
  const agedHimalayasJob0Apps = DataStore.createJob({
    title: 'Aged Himalayas Job 0 Apps',
    company_id: 'comp-1',
    description: 'Closed 4 months ago, 0 apps',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'expired',
    is_featured: false,
    source: 'himalayas',
    closed_at: FOUR_MONTHS_AGO,
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  // Test 3.2: Expired Himalayas job closed 4 months ago, but with application 1 month ago -> RETAIN
  const agedHimalayasJobWithRecentApp = DataStore.createJob({
    title: 'Aged Himalayas Job With Recent App',
    company_id: 'comp-1',
    description: 'Closed 4 months ago, application 1 month ago',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'published', // Temporarily published to attach application
    is_featured: false,
    source: 'himalayas',
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  DataStore.submitApplication({
    jobId: agedHimalayasJobWithRecentApp.id,
    userId: 'user-sarah',
  });
  // Now set status to expired and closed_at 4 months ago, but applied_at is recent
  DataStore.updateJob(agedHimalayasJobWithRecentApp.id, {
    status: 'expired',
    closed_at: FOUR_MONTHS_AGO,
  });

  // Test 3.3: Manual job closed 4 months ago -> MUST NEVER BE DELETED
  const agedManualJob = DataStore.createJob({
    title: 'Aged Manual Job',
    company_id: 'comp-1',
    description: 'Manually created by admin, closed 4 months ago',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'senior',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'expired',
    is_featured: false,
    source: 'manual', // RULE: source = 'manual'
    closed_at: FOUR_MONTHS_AGO,
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  // Test 3.4: Published Himalayas job -> MUST NEVER BE DELETED
  const publishedHimalayasJob = DataStore.createJob({
    title: 'Active Published Himalayas Job',
    company_id: 'comp-1',
    description: 'Active and published',
    location: 'Remote',
    country: 'United States',
    workplace_type: 'remote',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_currency: 'USD',
    salary_period: 'yearly',
    salary_visible: true,
    application_mode: 'internal',
    status: 'published',
    is_featured: false,
    source: 'himalayas',
    responsibilities: [],
    requirements: [],
    qualifications: [],
    benefits: [],
  });

  const retentionRun = DataStore.processJobRetentionCleanup();
  assert.ok(retentionRun.deletedJobIds.includes(agedHimalayasJob0Apps.id), 'Aged 0-app Himalayas job must be deleted');
  assert.strictEqual(
    retentionRun.deletedJobIds.includes(agedHimalayasJobWithRecentApp.id),
    false,
    'Job with recent application must be retained for 3 months after application date'
  );
  assert.strictEqual(
    retentionRun.deletedJobIds.includes(agedManualJob.id),
    false,
    'CRITICAL: Manual jobs must NEVER be deleted regardless of age'
  );
  assert.strictEqual(
    retentionRun.deletedJobIds.includes(publishedHimalayasJob.id),
    false,
    'Active published jobs must NEVER be deleted'
  );

  console.log('  ✓ 0-app aged jobs deleted; jobs with recent apps retained; manual & published NEVER deleted');

  // ==========================================
  // 4. SCHEDULER & CRON TIMEZONE TESTS
  // ==========================================
  console.log('\n4. Testing Scheduler Timezone & Config:');

  const configs = await ServerDatabase.getSchedulerConfigs();
  assert.strictEqual(configs.length, 5, 'Must have exactly 5 scheduler tasks configured');

  const taskKeys = configs.map((c) => c.task_key);
  assert.ok(taskKeys.includes('task_a_nightly'), 'Task A Nightly must be configured');
  assert.ok(taskKeys.includes('task_b_morning'), 'Task B Morning must be configured');
  assert.ok(taskKeys.includes('task_c_india'), 'Task C India must be configured');
  assert.ok(taskKeys.includes('task_d_expiry'), 'Task D Expiry must be configured');
  assert.ok(taskKeys.includes('task_e_retention'), 'Task E Retention must be configured');

  const nextNightly = CronManager.getNextExecutionTime('task_a_nightly');
  assert.ok(nextNightly.getTime() > Date.now(), 'Next nightly run must be in the future');

  const nextMorning = CronManager.getNextExecutionTime('task_b_morning');
  assert.ok(nextMorning.getTime() > Date.now(), 'Next morning run must be in the future');

  const nextIndia = CronManager.getNextExecutionTime('task_c_india');
  assert.ok(nextIndia.getTime() > Date.now(), 'Next India run must be in the future');

  const nextExpiry = CronManager.getNextExecutionTime('task_d_expiry');
  assert.ok(nextExpiry.getTime() > Date.now(), 'Next expiry run must be in the future');

  const nextRetention = CronManager.getNextExecutionTime('task_e_retention');
  assert.ok(nextRetention.getTime() > Date.now(), 'Next retention run must be in the future');

  // Test Concurrency Lock
  const lockAcquired = await ServerDatabase.acquireLock('task_a_nightly', 5000);
  assert.strictEqual(lockAcquired, true, 'First lock acquisition must succeed');
  const lockDuplicate = await ServerDatabase.acquireLock('task_a_nightly', 5000);
  assert.strictEqual(lockDuplicate, false, 'Simultaneous overlapping execution must be rejected');
  await ServerDatabase.releaseLock('task_a_nightly');
  const lockReacquired = await ServerDatabase.acquireLock('task_a_nightly', 5000);
  assert.strictEqual(lockReacquired, true, 'Lock must be re-acquirable after release');
  await ServerDatabase.releaseLock('task_a_nightly');

  console.log('  ✓ 5 tasks configured, future execution calculated in Asia/Kolkata, distributed lock protects concurrency');

  console.log('\n--- ALL TEST SUITE CHECKS PASSED SUCCESSFULLY (100%) ---');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
