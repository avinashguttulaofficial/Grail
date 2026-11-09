import dotenv from 'dotenv';
import { SchedulerEngine } from './schedulerEngine';
import { SchedulerTaskKey } from './types';

dotenv.config();

async function main() {
  const taskKey = process.argv[2] as SchedulerTaskKey;
  const validKeys: SchedulerTaskKey[] = ['task_a_nightly', 'task_b_morning', 'task_c_india'];

  if (!taskKey || !validKeys.includes(taskKey)) {
    console.error(`Error: Invalid or missing taskKey. Valid options are: ${validKeys.join(', ')}`);
    console.error(`Usage: tsx server/cli.ts <taskKey>`);
    process.exit(1);
  }

  console.log(`[Scheduler CLI] Triggering task: ${taskKey}...`);
  try {
    const run = await SchedulerEngine.executeTask(taskKey, 'cron_webhook');
    console.log(`[Scheduler CLI] Finished run ${run.id}:`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Fetched: ${run.fetched_count}`);
    console.log(`  Matched: ${run.matched_count}`);
    console.log(`  Synced: ${run.synced_count}`);
    console.log(`  Duplicates: ${run.duplicate_count}`);
    console.log(`  Failed: ${run.failed_count}`);
    if (run.error_message) {
      console.error(`  Error: ${run.error_message}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
  } catch (err: any) {
    console.error(`[Scheduler CLI] Fatal error:`, err.message);
    process.exitCode = 1;
  }
}

main();
