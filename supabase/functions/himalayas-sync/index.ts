// Supabase Edge Function: himalayas-sync
// Deploy via: supabase functions deploy himalayas-sync --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let taskKey = 'task_a_nightly';
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.taskKey) taskKey = body.taskKey;
      } catch (_) {}
    } else {
      const url = new URL(req.url);
      if (url.searchParams.get('taskKey')) {
        taskKey = url.searchParams.get('taskKey')!;
      }
    }

    console.log(`[EdgeFunction] Executing ${taskKey}...`);

    // Handle Expiry
    if (taskKey === 'task_d_expiry') {
      const { data, error } = await supabaseClient.rpc('process_job_expiry');
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, taskKey, result: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle Retention Cleanup
    if (taskKey === 'task_e_retention') {
      const { data, error } = await supabaseClient.rpc('process_job_retention_cleanup');
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, taskKey, result: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Feed Sync: Determine parameters
    let limit = 20;
    let pages = 1;
    let targetCount = 20;

    if (taskKey === 'task_a_nightly') {
      limit = 20;
      pages = 5;
      targetCount = 100;
    } else if (taskKey === 'task_b_morning') {
      limit = 20;
      pages = 1;
      targetCount = 20;
    } else if (taskKey === 'task_c_india') {
      limit = 20;
      pages = 5;
      targetCount = 100;
    }

    // Fetch from Himalayas
    const fetchedJobs: any[] = [];
    let currentCursor: string | null = null;

    for (let p = 0; p < pages; p++) {
      const apiUrl = new URL('https://himalayas.app/jobs/api');
      apiUrl.searchParams.set('limit', String(limit));
      if (currentCursor) apiUrl.searchParams.set('cursor', currentCursor);

      const res = await fetch(apiUrl.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NoahCrew-GrailJobs-SupabaseEdge/1.0',
        },
      });

      if (!res.ok) break;
      const json = await res.json();
      if (json.jobs && Array.isArray(json.jobs)) {
        fetchedJobs.push(...json.jobs);
      }
      currentCursor = json.nextCursor;
      if (!currentCursor) break;
    }

    let candidateJobs = fetchedJobs.slice(0, targetCount);

    if (taskKey === 'task_c_india') {
      candidateJobs = candidateJobs.filter((job) => {
        const locs = job.locationRestrictions || [];
        if (locs.length === 0) return true; // empty = worldwide = eligible
        const lower = locs.map((l: string) => l.toLowerCase().trim());
        return lower.some((l: string) => l.includes('india') || l === 'in' || l.includes('worldwide') || l.includes('anywhere'));
      });
    }

    let syncedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const raw of candidateJobs) {
      try {
        const guid = raw.guid;
        const appUrl = raw.applicationLink || raw.guid;
        const compSlug = raw.companySlug || raw.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // Check duplicate
        let existingId: string | null = null;
        let existingSource: string | null = null;

        if (guid) {
          const { data: ex } = await supabaseClient
            .from('jobs')
            .select('id, source')
            .eq('external_job_id', guid)
            .maybeSingle();
          if (ex) {
            existingId = ex.id;
            existingSource = ex.source;
          }
        }

        if (!existingId && appUrl) {
          const { data: ex } = await supabaseClient
            .from('jobs')
            .select('id, source')
            .eq('external_application_url', appUrl)
            .maybeSingle();
          if (ex) {
            existingId = ex.id;
            existingSource = ex.source;
          }
        }

        if (existingId) {
          if (existingSource === 'manual') {
            duplicateCount++;
            continue;
          }
          // Update existing
          await supabaseClient
            .from('jobs')
            .update({
              salary_min: raw.minSalary || undefined,
              salary_max: raw.maxSalary || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);
          syncedCount++;
          continue;
        }

        // Company
        let companyId: string;
        const { data: exComp } = await supabaseClient
          .from('companies')
          .select('id')
          .eq('slug', compSlug)
          .maybeSingle();

        if (exComp) {
          companyId = exComp.id;
        } else {
          const { data: newComp, error: compErr } = await supabaseClient
            .from('companies')
            .insert({
              name: raw.companyName,
              slug: compSlug,
              logo_url: raw.companyLogo || undefined,
              website: (() => {
                try {
                  return raw.guid ? new URL(raw.guid).origin : 'https://himalayas.app';
                } catch (_) {
                  return 'https://himalayas.app';
                }
              })(),
              industry: raw.categories?.[0] || 'Software & Engineering',
              country: raw.locationRestrictions?.[0] || 'United States',
              city: 'Remote',
            })
            .select('id')
            .single();

          if (compErr) throw compErr;
          companyId = newComp.id;
        }

        // Clean Description
        const cleanDescription = (raw.excerpt || raw.description || '')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const baseSlug = `${compSlug}-${raw.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

        await supabaseClient.from('jobs').insert({
          title: raw.title,
          slug: `${baseSlug}-${Date.now().toString(36)}`,
          company_id: companyId,
          source: 'himalayas',
          external_job_id: raw.guid,
          imported_at: new Date().toISOString(),
          description: cleanDescription || `Remote ${raw.title} opportunity at ${raw.companyName}.`,
          location: raw.locationRestrictions?.length ? `Remote (${raw.locationRestrictions.slice(0, 3).join(', ')})` : 'Remote Worldwide',
          country: raw.locationRestrictions?.[0] || 'United States',
          workplace_type: 'remote',
          employment_type: 'full-time',
          experience_level: 'mid',
          salary_min: raw.minSalary || undefined,
          salary_max: raw.maxSalary || undefined,
          salary_currency: raw.currency || 'USD',
          application_mode: 'external',
          external_application_url: appUrl,
          status: 'published',
          published_at: new Date().toISOString(),
        });

        syncedCount++;
      } catch (err) {
        failedCount++;
        console.error(`[EdgeFunction] Failed job ${raw.title}:`, err);
      }
    }

    // Log run
    await supabaseClient.from('scheduler_runs').insert({
      task_key: taskKey,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: failedCount > 0 && syncedCount === 0 ? 'failed' : failedCount > 0 ? 'partial_success' : 'success',
      fetched_count: fetchedJobs.length,
      matched_count: candidateJobs.length,
      synced_count: syncedCount,
      duplicate_count: duplicateCount,
      failed_count: failedCount,
      metadata: { trigger: 'supabase_edge_function' },
    });

    return new Response(
      JSON.stringify({
        success: true,
        taskKey,
        fetched: fetchedJobs.length,
        matched: candidateJobs.length,
        synced: syncedCount,
        duplicates: duplicateCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[EdgeFunction] Error:', error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
