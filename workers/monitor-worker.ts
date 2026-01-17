/**
 * Search Monitor Background Worker
 * 
 * Runs on a cron schedule to check saved searches for new papers.
 * Deploy to Cloudflare Workers with a cron trigger.
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RESEND_API_KEY?: string; // Optional email notifications
}

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  email_address?: string;
  notify_email: boolean;
  notify_in_app: boolean;
}

interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string } };
  cited_by_count?: number;
  open_access?: { is_oa?: boolean };
}

const OPENALEX_API = 'https://api.openalex.org';

export default {
  // Scheduled trigger (configure in wrangler.toml)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMonitorChecks(env));
  },

  // Manual trigger via HTTP (for testing)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/check' && request.method === 'POST') {
      const result = await runMonitorChecks(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (url.pathname === '/health') {
      return new Response('OK');
    }
    
    return new Response('Not found', { status: 404 });
  },
};

async function runMonitorChecks(env: Env): Promise<{ checked: number; newPapers: number }> {
  const supabase = createSupabaseClient(env);
  
  // Get monitors due for checking
  const { data: monitors, error } = await supabase.rpc('get_monitors_due_for_check');
  
  if (error || !monitors) {
    console.error('Failed to get monitors:', error);
    return { checked: 0, newPapers: 0 };
  }
  
  let totalChecked = 0;
  let totalNewPapers = 0;
  
  for (const monitor of monitors as Monitor[]) {
    try {
      const result = await checkMonitor(monitor, supabase, env);
      totalChecked++;
      totalNewPapers += result.newCount;
    } catch (err) {
      console.error(`Error checking monitor ${monitor.id}:`, err);
    }
  }
  
  return { checked: totalChecked, newPapers: totalNewPapers };
}

async function checkMonitor(
  monitor: Monitor,
  supabase: SupabaseClient,
  env: Env
): Promise<{ newCount: number }> {
  // Build OpenAlex query
  const params = new URLSearchParams({
    search: monitor.query,
    per_page: '50',
    sort: 'publication_date:desc',
    mailto: 'research@msdrills.com',
  });
  
  // Add filters
  const filterParts: string[] = [];
  if (monitor.filters?.yearFrom) {
    filterParts.push(`from_publication_date:${monitor.filters.yearFrom}-01-01`);
  }
  if (monitor.filters?.yearTo) {
    filterParts.push(`to_publication_date:${monitor.filters.yearTo}-12-31`);
  }
  if (monitor.filters?.openAccess) {
    filterParts.push('is_oa:true');
  }
  if (filterParts.length > 0) {
    params.set('filter', filterParts.join(','));
  }
  
  // Fetch results
  const response = await fetch(`${OPENALEX_API}/works?${params}`);
  const data = await response.json() as { results?: OpenAlexWork[]; meta?: { count?: number } };
  
  if (!data.results) {
    throw new Error('No results from OpenAlex');
  }
  
  // Get seen paper IDs for this monitor
  const { data: seenPapers } = await supabase
    .from('monitor_seen_papers')
    .select('openalex_id')
    .eq('monitor_id', monitor.id);
  
  const seenIds = new Set((seenPapers || []).map((p: { openalex_id: string }) => p.openalex_id));
  
  // Find new papers
  const newPapers = data.results.filter((work: OpenAlexWork) => {
    const id = work.id?.replace('https://openalex.org/', '');
    return id && !seenIds.has(id);
  });
  
  if (newPapers.length > 0) {
    // Mark papers as seen
    const papersToInsert = newPapers.map((work: OpenAlexWork) => ({
      monitor_id: monitor.id,
      openalex_id: work.id?.replace('https://openalex.org/', ''),
      doi: work.doi?.replace('https://doi.org/', ''),
      title: work.title,
    }));
    
    await supabase.from('monitor_seen_papers').insert(papersToInsert);
    
    // Create alert
    if (monitor.notify_in_app) {
      await supabase.from('monitor_alerts').insert({
        monitor_id: monitor.id,
        user_id: monitor.user_id,
        new_paper_count: newPapers.length,
        paper_ids: newPapers.map((w: OpenAlexWork) => w.id?.replace('https://openalex.org/', '')),
      });
    }
    
    // Send email notification
    if (monitor.notify_email && monitor.email_address && env.RESEND_API_KEY) {
      await sendEmailNotification(monitor, newPapers, env);
    }
  }
  
  // Update monitor stats
  await supabase
    .from('search_monitors')
    .update({
      last_checked_at: new Date().toISOString(),
      last_new_count: newPapers.length,
      total_results: data.meta?.count || 0,
    })
    .eq('id', monitor.id);
  
  return { newCount: newPapers.length };
}

async function sendEmailNotification(
  monitor: Monitor,
  newPapers: OpenAlexWork[],
  env: Env
): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  
  const paperList = newPapers.slice(0, 10).map((p: OpenAlexWork) => {
    const authors = p.authorships?.slice(0, 3).map(a => a.author?.display_name).join(', ') || 'Unknown';
    return `• ${p.title}\n  ${authors} (${p.publication_year})`;
  }).join('\n\n');
  
  const moreText = newPapers.length > 10 ? `\n\n...and ${newPapers.length - 10} more papers` : '';
  
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MSDrills Research <alerts@msdrills.com>',
      to: monitor.email_address,
      subject: `[Search Alert] ${newPapers.length} new papers: ${monitor.name}`,
      text: `Your saved search "${monitor.name}" found ${newPapers.length} new papers.\n\n${paperList}${moreText}\n\nView all results: https://msdrills.com/research/monitor`,
    }),
  });
}

// Simple Supabase client
interface SupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: string) => Promise<{ data: any; error: any }>;
    };
    insert: (data: any) => Promise<{ data: any; error: any }>;
    update: (data: any) => {
      eq: (column: string, value: string) => Promise<{ data: any; error: any }>;
    };
  };
  rpc: (fn: string, params?: any) => Promise<{ data: any; error: any }>;
}

function createSupabaseClient(env: Env): SupabaseClient {
  const baseUrl = env.SUPABASE_URL;
  const headers = {
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  
  return {
    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: async (column: string, value: string) => {
          const url = `${baseUrl}/rest/v1/${table}?${column}=eq.${value}${columns ? `&select=${columns}` : ''}`;
          const res = await fetch(url, { headers });
          return { data: await res.json(), error: res.ok ? null : 'Error' };
        },
      }),
      insert: async (data: any) => {
        const url = `${baseUrl}/rest/v1/${table}`;
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });
        return { data: await res.json(), error: res.ok ? null : 'Error' };
      },
      update: (data: any) => ({
        eq: async (column: string, value: string) => {
          const url = `${baseUrl}/rest/v1/${table}?${column}=eq.${value}`;
          const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(data),
          });
          return { data: await res.json(), error: res.ok ? null : 'Error' };
        },
      }),
    }),
    rpc: async (fn: string, params?: any) => {
      const url = `${baseUrl}/rest/v1/rpc/${fn}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: params ? JSON.stringify(params) : '{}',
      });
      return { data: await res.json(), error: res.ok ? null : 'Error' };
    },
  };
}
