import { HimalayasRawJob, HimalayasApiResponse } from '../src/services/himalayas';

const BASE_URL = 'https://himalayas.app/jobs/api';

export interface FetchOptions {
  limit?: number;
  cursor?: string;
  pages?: number;
  maxRetries?: number;
}

export class ServerHimalayasClient {
  /**
   * Helper sleep function
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch a single page from Himalayas with exponential backoff retry
   */
  static async fetchPage(
    params: { limit?: number; cursor?: string },
    maxRetries = 3
  ): Promise<{ jobs: HimalayasRawJob[]; totalCount: number; nextCursor?: string }> {
    const url = new URL(BASE_URL);
    url.searchParams.set('limit', String(params.limit || 20));
    if (params.cursor) {
      url.searchParams.set('cursor', params.cursor);
    }

    let attempt = 0;
    let delay = 1000;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'NoahCrew-Himalayas-Scheduler/1.0',
          },
        });

        if (response.status === 429) {
          // Rate limited
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay * 2;
          console.warn(`[HimalayasClient] Rate limited (429). Retrying in ${waitTime}ms...`);
          await this.sleep(waitTime);
          attempt++;
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          throw new Error(`Himalayas API responded with HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        return {
          jobs: Array.isArray(data.jobs) ? data.jobs : [],
          totalCount: typeof data.totalCount === 'number' ? data.totalCount : 0,
          nextCursor: data.nextCursor || undefined,
        };
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error(`Failed to fetch from Himalayas API after ${maxRetries} retries: ${err.message}`);
        }
        console.warn(`[HimalayasClient] Fetch failed on attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`, err.message);
        await this.sleep(delay);
        delay *= 2;
      }
    }

    throw new Error('Unexpected retry loop termination in HimalayasClient');
  }

  /**
   * Fetch multiple pages with pagination cursor following
   */
  static async fetchMultiPage(options: FetchOptions = {}): Promise<HimalayasApiResponse> {
    const pagesToFetch = options.pages ?? 1;
    const limitPerPage = options.limit ?? 20;
    let currentCursor = options.cursor;
    const allJobs: HimalayasRawJob[] = [];
    let totalCount = 0;

    for (let page = 0; page < pagesToFetch; page++) {
      const pageResult = await this.fetchPage(
        { limit: limitPerPage, cursor: currentCursor },
        options.maxRetries ?? 3
      );

      totalCount = pageResult.totalCount || totalCount;
      if (pageResult.jobs && pageResult.jobs.length > 0) {
        allJobs.push(...pageResult.jobs);
      }

      currentCursor = pageResult.nextCursor;
      // If no next cursor, we reached the end of the feed
      if (!currentCursor) break;

      // Polite small inter-page delay to prevent rate spikes
      if (page < pagesToFetch - 1) {
        await this.sleep(250);
      }
    }

    return {
      totalCount: totalCount || allJobs.length,
      jobs: allJobs,
      nextCursor: currentCursor,
    };
  }
}
