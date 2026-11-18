export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const subPath = Array.isArray(path) ? path.join('/') : path || '';

  try {
    const { ServerDatabase } = await import('../../server/db');
    const { CronManager } = await import('../../server/cronManager');
    const { SchedulerEngine } = await import('../../server/schedulerEngine');

    ServerDatabase.init();

    if (subPath === 'status' || subPath === '') {
      const configs = await ServerDatabase.getSchedulerConfigs();
      const allRuns = await ServerDatabase.getSchedulerRuns(undefined, 100);
      const overview = await ServerDatabase.getOverviewStats();

      const taskSummaries = configs.map((cfg: any) => {
        const taskRuns = allRuns.filter((r: any) => r.task_key === cfg.task_key);
        const lastRun = taskRuns[0] || undefined;
        const nextExecution = CronManager.getNextExecutionTime(cfg.task_key);
        const totalSyncedAllTime = taskRuns.reduce((acc: number, r: any) => acc + (r.synced_count || 0), 0);
        const totalRuns = taskRuns.length;

        return {
          taskKey: cfg.task_key,
          name: cfg.name,
          enabled: cfg.enabled,
          scheduleExpression: cfg.schedule_expression,
          timezone: cfg.timezone,
          configurationJson: cfg.configuration_json,
          nextExecutionTime: nextExecution.toISOString(),
          lastRun: lastRun || null,
          totalSyncedAllTime,
          totalRuns,
        };
      });

      return res.status(200).json({
        success: true,
        currentServerTimeUtc: new Date().toISOString(),
        currentServerTimeIst: CronManager.getNowInIST().dateString,
        overview,
        tasks: taskSummaries,
      });
    }

    if (subPath === 'runs') {
      const taskKey = req.query.taskKey;
      const limit = parseInt(req.query.limit, 10) || 50;
      const runs = await ServerDatabase.getSchedulerRuns(taskKey, limit);
      return res.status(200).json({ success: true, runs });
    }

    if (subPath === 'jobs') {
      const jobs = await ServerDatabase.getAllJobs();
      return res.status(200).json({ success: true, jobs });
    }

    if (subPath.startsWith('run/') && req.method === 'POST') {
      const taskKey = subPath.replace('run/', '');
      const run = await SchedulerEngine.executeTask(taskKey as any, 'manual');
      return res.status(200).json({ success: true, run });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err: any) {
    console.error('[API Scheduler Error]:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
