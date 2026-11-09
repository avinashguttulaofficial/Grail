import express, { Request, Response } from 'express';
import { ServerDatabase } from './db';
import { SchedulerEngine } from './schedulerEngine';
import { CronManager } from './cronManager';
import { SchedulerTaskKey } from './types';

export const schedulerRouter = express.Router();

/**
 * GET /api/scheduler/status
 * Return current status, configs, last runs, and next execution times for all 3 tasks
 */
schedulerRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const configs = await ServerDatabase.getSchedulerConfigs();
    const allRuns = await ServerDatabase.getSchedulerRuns(undefined, 100);

    const taskSummaries = configs.map((cfg) => {
      const taskRuns = allRuns.filter((r) => r.task_key === cfg.task_key);
      const lastRun = taskRuns[0] || undefined;
      const nextExecution = CronManager.getNextExecutionTime(cfg.task_key);

      // Aggregates
      const totalSyncedAllTime = taskRuns.reduce((acc, r) => acc + (r.synced_count || 0), 0);
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

    const istNow = CronManager.getNowInIST();

    res.json({
      success: true,
      currentServerTimeUtc: new Date().toISOString(),
      currentServerTimeIst: istNow.dateString,
      tasks: taskSummaries,
    });
  } catch (error: any) {
    console.error('[SchedulerRoutes] Failed to get scheduler status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scheduler/toggle
 * Enable or disable a scheduled task
 */
schedulerRouter.post('/toggle', async (req: Request, res: Response) => {
  try {
    const { taskKey, enabled } = req.body;
    if (!taskKey || typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'taskKey and enabled (boolean) are required' });
      return;
    }

    const updated = await ServerDatabase.updateSchedulerConfig(taskKey as SchedulerTaskKey, {
      enabled,
    });

    res.json({ success: true, config: updated });
  } catch (error: any) {
    console.error('[SchedulerRoutes] Failed to toggle scheduler:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scheduler/run/:taskKey
 * Manually trigger execution of a task ("Run Now")
 */
schedulerRouter.post('/run/:taskKey', async (req: Request, res: Response) => {
  try {
    const taskKey = req.params.taskKey as SchedulerTaskKey;
    const validKeys: SchedulerTaskKey[] = ['task_a_nightly', 'task_b_morning', 'task_c_india'];
    if (!validKeys.includes(taskKey)) {
      res.status(400).json({ success: false, error: `Invalid taskKey: ${taskKey}` });
      return;
    }

    const runResult = await SchedulerEngine.executeTask(taskKey, 'manual');
    res.json({ success: true, run: runResult });
  } catch (error: any) {
    console.error(`[SchedulerRoutes] Failed to run task ${req.params.taskKey}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scheduler/cron/:taskKey
 * Secure webhook endpoint for Render Cron Jobs or external scheduling services
 */
schedulerRouter.post('/cron/:taskKey', async (req: Request, res: Response) => {
  try {
    const taskKey = req.params.taskKey as SchedulerTaskKey;
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce Bearer authorization
    if (cronSecret) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({ success: false, error: 'Unauthorized cron webhook trigger' });
        return;
      }
    }

    const validKeys: SchedulerTaskKey[] = ['task_a_nightly', 'task_b_morning', 'task_c_india'];
    if (!validKeys.includes(taskKey)) {
      res.status(400).json({ success: false, error: `Invalid taskKey: ${taskKey}` });
      return;
    }

    const runResult = await SchedulerEngine.executeTask(taskKey, 'cron_webhook');
    res.json({ success: true, run: runResult });
  } catch (error: any) {
    console.error(`[SchedulerRoutes] Cron webhook failed for ${req.params.taskKey}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scheduler/runs
 * Fetch recent execution history with optional task filter
 */
schedulerRouter.get('/runs', async (req: Request, res: Response) => {
  try {
    const taskKey = req.query.taskKey as SchedulerTaskKey | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const runs = await ServerDatabase.getSchedulerRuns(taskKey, limit);
    res.json({ success: true, runs });
  } catch (error: any) {
    console.error('[SchedulerRoutes] Failed to fetch runs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scheduler/runs/:runId/errors
 * Fetch job-level errors for a specific run
 */
schedulerRouter.get('/runs/:runId/errors', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const errors = await ServerDatabase.getJobErrors(runId);
    res.json({ success: true, errors });
  } catch (error: any) {
    console.error('[SchedulerRoutes] Failed to fetch run errors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scheduler/jobs
 * Fetch background synced jobs from server database
 */
schedulerRouter.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = await ServerDatabase.getAllJobs();
    res.json({ success: true, jobs });
  } catch (error: any) {
    console.error('[SchedulerRoutes] Failed to fetch synced jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
