export default async function handler(req: any, res: any) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const taskKey = req.query.taskKey || 'task_b_morning';
  const { SchedulerEngine } = await import('../server/schedulerEngine.js');

  try {
    const run = await SchedulerEngine.executeTask(taskKey, 'scheduled');
    return res.status(200).json({ success: true, run });
  } catch (error: any) {
    console.error(`[Vercel Cron] Error running ${taskKey}:`, error);
    return res.status(500).json({ error: error.message || 'Execution failed' });
  }
}
