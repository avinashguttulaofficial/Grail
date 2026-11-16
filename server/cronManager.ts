import { SchedulerEngine } from './schedulerEngine';
import { ServerDatabase } from './db';
import { SchedulerTaskKey } from './types';

export class CronManager {
  private static timer: NodeJS.Timeout | null = null;
  private static lastExecutedMinute: Map<SchedulerTaskKey, string> = new Map();
  private static isRunning = false;

  /**
   * Get the current date and time components in Asia/Kolkata (IST) timezone
   */
  static getNowInIST(): {
    date: Date;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dateString: string;
  } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => {
      const part = parts.find((p) => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');

    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    return {
      date: now,
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateString,
    };
  }

  /**
   * Calculate next execution time for any of the 5 tasks in Asia/Kolkata timezone
   */
  static getNextExecutionTime(taskKey: SchedulerTaskKey): Date {
    const ist = this.getNowInIST();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    const calcNextDaily = (targetHour: number, targetMinute: number) => {
      const targetUtcMillis =
        Date.UTC(ist.year, ist.month - 1, ist.day, targetHour, targetMinute, 0) - IST_OFFSET_MS;
      let nextDate = new Date(targetUtcMillis);
      if (nextDate.getTime() <= Date.now()) {
        nextDate = new Date(targetUtcMillis + 24 * 60 * 60 * 1000);
      }
      return nextDate;
    };

    if (taskKey === 'task_a_nightly') {
      // 9:30 PM IST (21:30)
      return calcNextDaily(21, 30);
    }

    if (taskKey === 'task_b_morning') {
      // 7:30 AM IST (07:30)
      return calcNextDaily(7, 30);
    }

    if (taskKey === 'task_c_india') {
      // Every 6 hours at 00:00, 06:00, 12:00, 18:00 IST
      const candidateHours = [0, 6, 12, 18];
      for (const h of candidateHours) {
        const targetUtcMillis = Date.UTC(ist.year, ist.month - 1, ist.day, h, 0, 0) - IST_OFFSET_MS;
        const candDate = new Date(targetUtcMillis);
        if (candDate.getTime() > Date.now()) {
          return candDate;
        }
      }
      const tomorrowMidnight = Date.UTC(ist.year, ist.month - 1, ist.day + 1, 0, 0, 0) - IST_OFFSET_MS;
      return new Date(tomorrowMidnight);
    }

    if (taskKey === 'task_d_expiry') {
      // Daily 1:30 AM IST (01:30)
      return calcNextDaily(1, 30);
    }

    if (taskKey === 'task_e_retention') {
      // Daily 2:00 AM IST (02:00)
      return calcNextDaily(2, 0);
    }

    return new Date(Date.now() + 60 * 60 * 1000);
  }

  /**
   * Start the in-process cron daemon
   */
  static start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[CronManager] Initialized 5-task in-process scheduler daemon for Asia/Kolkata.');

    // Run tick check every 30 seconds
    this.timer = setInterval(() => {
      this.checkAndTriggerDueTasks();
    }, 30000);

    this.checkAndTriggerDueTasks();
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * Evaluate if any of the 5 tasks are due right now in IST
   */
  private static async checkAndTriggerDueTasks(): Promise<void> {
    const ist = this.getNowInIST();
    const currentMinuteKey = `${ist.year}-${ist.month}-${ist.day} ${ist.hour}:${ist.minute}`;

    // 1. Task A: 9:30 PM IST (21:30)
    if (ist.hour === 21 && ist.minute === 30) {
      await this.triggerTaskIfDue('task_a_nightly', currentMinuteKey);
    }

    // 2. Task B: 7:30 AM IST (07:30)
    if (ist.hour === 7 && ist.minute === 30) {
      await this.triggerTaskIfDue('task_b_morning', currentMinuteKey);
    }

    // 3. Task C: 00:00, 06:00, 12:00, 18:00 IST
    if ([0, 6, 12, 18].includes(ist.hour) && ist.minute === 0) {
      await this.triggerTaskIfDue('task_c_india', currentMinuteKey);
    }

    // 4. Task D: Daily 1:30 AM IST (01:30)
    if (ist.hour === 1 && ist.minute === 30) {
      await this.triggerTaskIfDue('task_d_expiry', currentMinuteKey);
    }

    // 5. Task E: Daily 2:00 AM IST (02:00)
    if (ist.hour === 2 && ist.minute === 0) {
      await this.triggerTaskIfDue('task_e_retention', currentMinuteKey);
    }
  }

  private static async triggerTaskIfDue(
    taskKey: SchedulerTaskKey,
    currentMinuteKey: string
  ): Promise<void> {
    if (this.lastExecutedMinute.get(taskKey) === currentMinuteKey) {
      return;
    }

    try {
      const config = await ServerDatabase.getSchedulerConfig(taskKey);
      if (!config || !config.enabled) {
        return;
      }

      this.lastExecutedMinute.set(taskKey, currentMinuteKey);
      console.log(`[CronManager] Automatically triggering scheduled task ${taskKey} at ${currentMinuteKey} IST`);
      await SchedulerEngine.executeTask(taskKey, 'scheduled');
    } catch (err: any) {
      console.error(`[CronManager] Error running scheduled task ${taskKey}:`, err.message);
    }
  }
}
