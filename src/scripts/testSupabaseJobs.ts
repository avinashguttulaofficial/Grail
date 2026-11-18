import { Jobs } from '../lib/supabaseJobs';

async function test() {
  try {
    const jobs = await Jobs.list();
    console.log('Supabase jobs count:', jobs.length);
    console.log('First job:', jobs[0] ?? 'none');
  } catch (e) {
    console.error('Error fetching jobs:', e);
  }
}

test();
