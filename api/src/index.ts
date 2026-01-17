// MSDrills Research Tools - Literature Search Worker
// Cloudflare Worker for parallel database searches
// Version: 1.0.0

import { createClient } from '@supabase/supabase-js';

// Types
interface SearchRequest {
  query: string;
  databases?: string[];
  dateFrom?: string;
  dateTo?: string;
  maxResults?: number;
  projectId?: string;
  sessionId?: string;
}

interface Paper {
  doi?: string;
  pmid?: string;
  title: string;
  abstract?: string;
  authors: Author[];
  journal?: string;
  year?: number;
  url?: string;
  source: string;
  citationCount?: number;
  publicationType?: string;
  raw?: any;
}

interface Author {
  name: string;
  affiliation?: string;
  orcid?: string;
}

interface SearchResult {
  database: string;
  papers: Paper[];
  totalCount: number;
  searchTime: number;
  error?: string;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  NCBI_API_KEY?: string; // Optional, increases rate limit
}

// ============================================
// CORS Headers
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================
// API Clients
// ============================================

// PubMed E-utilities
async function searchPubMed(
  query: string,
  maxResults: number = 100,
  apiKey?: string
): Promise<SearchResult> {
  const startTime = Date.now();
  const database = 'pubmed';

  try {
    // Step 1: ESearch - get PMIDs
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    searchUrl.searchParams.set('db', 'pubmed');
    searchUrl.searchParams.set('term', query);
    searchUrl.searchParams.set('retmax', maxResults.toString());
    searchUrl.searchParams.set('retmode', 'json');
    searchUrl.searchParams.set('sort', 'relevance');
    if (apiKey) searchUrl.searchParams.set('api_key', apiKey);

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json() as any;

    const pmids = searchData.esearchresult?.idlist || [];
    const totalCount = parseInt(searchData.esearchresult?.count || '0');

    if (pmids.length === 0) {
      return { database, papers: [], totalCount: 0, searchTime: Date.now() - startTime };
    }

    // Step 2: EFetch - get paper details
    const fetchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi');
    fetchUrl.searchParams.set('db', 'pubmed');
    fetchUrl.searchParams.set('id', pmids.join(','));
    fetchUrl.searchParams.set('retmode', 'xml');
    if (apiKey) fetchUrl.searchParams.set('api_key', apiKey);

    const fetchResponse = await fetch(fetchUrl.toString());
    const xmlText = await fetchResponse.text();

    // Parse XML (simplified - in production use proper XML parser)
    const papers = parsePubMedXML(xmlText, pmids);

    return {
      database,
      papers,
      totalCount,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      database,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Simple PubMed XML parser
function parsePubMedXML(xml: string, pmids: string[]): Paper[] {
  const papers: Paper[] = [];

  // Extract articles using regex (simplified - use proper XML parser in production)
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;

  while ((match = articleRegex.exec(xml)) !== null) {
    const article = match[1];

    // Extract PMID
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const pmid = pmidMatch ? pmidMatch[1] : undefined;

    // Extract title
    const titleMatch = article.match(/<ArticleTitle>([^<]+)<\/ArticleTitle>/);
    const title = titleMatch ? decodeXMLEntities(titleMatch[1]) : 'No title';

    // Extract abstract
    const abstractMatch = article.match(/<AbstractText[^>]*>([^<]+)<\/AbstractText>/);
    const abstract = abstractMatch ? decodeXMLEntities(abstractMatch[1]) : undefined;

    // Extract journal
    const journalMatch = article.match(/<Title>([^<]+)<\/Title>/);
    const journal = journalMatch ? decodeXMLEntities(journalMatch[1]) : undefined;

    // Extract year
    const yearMatch = article.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
    const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

    // Extract DOI
    const doiMatch = article.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
    const doi = doiMatch ? doiMatch[1] : undefined;

    // Extract authors (simplified)
    const authors: Author[] = [];
    const authorRegex = /<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<ForeName>([^<]*)<\/ForeName>[\s\S]*?<\/Author>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(article)) !== null) {
      authors.push({
        name: `${authorMatch[2]} ${authorMatch[1]}`.trim()
      });
    }

    papers.push({
      pmid,
      doi,
      title,
      abstract,
      authors,
      journal,
      year,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
      source: 'pubmed'
    });
  }

  return papers;
}

function decodeXMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// OpenAlex API
async function searchOpenAlex(
  query: string,
  maxResults: number = 100
): Promise<SearchResult> {
  const startTime = Date.now();
  const database = 'openalex';

  try {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', Math.min(maxResults, 200).toString());
    url.searchParams.set('mailto', 'msdrills@masteringseries.com'); // Polite pool

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MSDrills/1.0 (https://msdrills.com; msdrills@masteringseries.com)'
      }
    });

    const data = await response.json() as any;

    const papers: Paper[] = (data.results || []).map((work: any) => ({
      doi: work.doi?.replace('https://doi.org/', ''),
      openalex_id: work.id,
      title: work.title || 'No title',
      abstract: work.abstract_inverted_index
        ? reconstructAbstract(work.abstract_inverted_index)
        : undefined,
      authors: (work.authorships || []).map((a: any) => ({
        name: a.author?.display_name || 'Unknown',
        orcid: a.author?.orcid,
        affiliation: a.institutions?.[0]?.display_name
      })),
      journal: work.primary_location?.source?.display_name,
      year: work.publication_year,
      url: work.primary_location?.landing_page_url || work.doi,
      citationCount: work.cited_by_count,
      publicationType: work.type,
      source: 'openalex',
      raw: work
    }));

    return {
      database,
      papers,
      totalCount: data.meta?.count || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      database,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Reconstruct abstract from inverted index (OpenAlex format)
function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const words: [string, number][] = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }

  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ');
}

// medRxiv/bioRxiv API
async function searchMedRxiv(
  query: string,
  maxResults: number = 100,
  server: 'medrxiv' | 'biorxiv' = 'medrxiv'
): Promise<SearchResult> {
  const startTime = Date.now();
  const database = server;

  try {
    // medRxiv API uses date-based endpoints, so we search recent papers
    // For keyword search, we need to use their search page or Europe PMC
    // Using Europe PMC as proxy for preprints
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query', `${query} AND SRC:PPR`); // PPR = preprints
    url.searchParams.set('resultType', 'core');
    url.searchParams.set('pageSize', Math.min(maxResults, 1000).toString());
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString());
    const data = await response.json() as any;

    const papers: Paper[] = (data.resultList?.result || [])
      .filter((r: any) => {
        const source = r.source?.toLowerCase() || '';
        return server === 'medrxiv'
          ? source.includes('medrxiv')
          : source.includes('biorxiv');
      })
      .map((article: any) => ({
        doi: article.doi,
        pmid: article.pmid,
        title: article.title || 'No title',
        abstract: article.abstractText,
        authors: parseEuropePMCAuthors(article.authorString),
        journal: article.journalTitle || server,
        year: parseInt(article.pubYear) || undefined,
        url: article.doi ? `https://doi.org/${article.doi}` : undefined,
        citationCount: article.citedByCount,
        publicationType: 'preprint',
        source: database
      }));

    return {
      database,
      papers,
      totalCount: data.hitCount || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      database,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function parseEuropePMCAuthors(authorString?: string): Author[] {
  if (!authorString) return [];
  return authorString.split(', ').map(name => ({ name: name.trim() }));
}

// Semantic Scholar API
async function searchSemanticScholar(
  query: string,
  maxResults: number = 100
): Promise<SearchResult> {
  const startTime = Date.now();
  const database = 'semantic_scholar';

  try {
    const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', Math.min(maxResults, 100).toString());
    url.searchParams.set('fields', 'paperId,externalIds,title,abstract,authors,year,venue,citationCount,url,publicationTypes');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MSDrills/1.0'
      }
    });

    const data = await response.json() as any;

    const papers: Paper[] = (data.data || []).map((paper: any) => ({
      doi: paper.externalIds?.DOI,
      pmid: paper.externalIds?.PubMed,
      semantic_scholar_id: paper.paperId,
      title: paper.title || 'No title',
      abstract: paper.abstract,
      authors: (paper.authors || []).map((a: any) => ({
        name: a.name || 'Unknown'
      })),
      journal: paper.venue,
      year: paper.year,
      url: paper.url,
      citationCount: paper.citationCount,
      publicationType: paper.publicationTypes?.[0],
      source: 'semantic_scholar'
    }));

    return {
      database,
      papers,
      totalCount: data.total || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      database,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Europe PMC API
async function searchEuropePMC(
  query: string,
  maxResults: number = 100
): Promise<SearchResult> {
  const startTime = Date.now();
  const database = 'europe_pmc';

  try {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query', query);
    url.searchParams.set('resultType', 'core');
    url.searchParams.set('pageSize', Math.min(maxResults, 1000).toString());
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString());
    const data = await response.json() as any;

    const papers: Paper[] = (data.resultList?.result || []).map((article: any) => ({
      doi: article.doi,
      pmid: article.pmid,
      pmcid: article.pmcid,
      title: article.title || 'No title',
      abstract: article.abstractText,
      authors: parseEuropePMCAuthors(article.authorString),
      journal: article.journalTitle,
      year: parseInt(article.pubYear) || undefined,
      url: article.doi ? `https://doi.org/${article.doi}` : undefined,
      citationCount: article.citedByCount,
      publicationType: article.pubType,
      source: 'europe_pmc'
    }));

    return {
      database,
      papers,
      totalCount: data.hitCount || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      database,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================
// Deduplication Logic
// ============================================

function deduplicatePapers(results: SearchResult[]): {
  unique: Paper[];
  duplicates: Paper[];
  stats: {
    totalFound: number;
    duplicatesRemoved: number;
    uniqueCount: number;
    bySource: Record<string, number>;
    overlap: Record<string, Record<string, number>>;
  };
} {
  const allPapers: Paper[] = results.flatMap(r => r.papers);
  const unique: Paper[] = [];
  const duplicates: Paper[] = [];
  const seenDOIs = new Set<string>();
  const seenTitles = new Map<string, Paper>(); // normalized title -> paper
  const bySource: Record<string, number> = {};
  const overlap: Record<string, Record<string, number>> = {};

  // Initialize overlap tracking
  for (const r of results) {
    overlap[r.database] = {};
    for (const r2 of results) {
      overlap[r.database][r2.database] = 0;
    }
  }

  for (const paper of allPapers) {
    let isDuplicate = false;
    let matchedPaper: Paper | undefined;

    // Check DOI first (exact match)
    if (paper.doi) {
      const normalizedDOI = paper.doi.toLowerCase();
      if (seenDOIs.has(normalizedDOI)) {
        isDuplicate = true;
        // Find the original for overlap tracking
        matchedPaper = unique.find(p => p.doi?.toLowerCase() === normalizedDOI);
      } else {
        seenDOIs.add(normalizedDOI);
      }
    }

    // Check title similarity if no DOI match
    if (!isDuplicate && paper.title) {
      const normalizedTitle = normalizeTitle(paper.title);

      for (const [existingTitle, existingPaper] of seenTitles) {
        const similarity = calculateSimilarity(normalizedTitle, existingTitle);
        if (similarity >= 0.9) {
          isDuplicate = true;
          matchedPaper = existingPaper;
          break;
        }
      }

      if (!isDuplicate) {
        seenTitles.set(normalizedTitle, paper);
      }
    }

    if (isDuplicate) {
      duplicates.push(paper);

      // Track overlap between sources
      if (matchedPaper) {
        overlap[paper.source][matchedPaper.source]++;
      }
    } else {
      unique.push(paper);
      bySource[paper.source] = (bySource[paper.source] || 0) + 1;
    }
  }

  return {
    unique,
    duplicates,
    stats: {
      totalFound: allPapers.length,
      duplicatesRemoved: duplicates.length,
      uniqueCount: unique.length,
      bySource,
      overlap
    }
  };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  // Jaccard similarity on word sets
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

// ============================================
// Export Functions
// ============================================

function exportToRIS(papers: Paper[]): string {
  return papers.map(paper => {
    const lines = [
      'TY  - JOUR',
      `TI  - ${paper.title}`,
    ];

    if (paper.abstract) lines.push(`AB  - ${paper.abstract}`);
    if (paper.journal) lines.push(`JO  - ${paper.journal}`);
    if (paper.year) lines.push(`PY  - ${paper.year}`);
    if (paper.doi) lines.push(`DO  - ${paper.doi}`);
    if (paper.pmid) lines.push(`AN  - ${paper.pmid}`);
    if (paper.url) lines.push(`UR  - ${paper.url}`);

    paper.authors.forEach(author => {
      lines.push(`AU  - ${author.name}`);
    });

    // Custom field for source tracking (PRISMA)
    lines.push(`N1  - Source: ${paper.source}`);

    lines.push('ER  - ');

    return lines.join('\n');
  }).join('\n');
}

function exportToCSV(papers: Paper[]): string {
  const headers = [
    'title',
    'abstract',
    'authors',
    'journal',
    'year',
    'doi',
    'pmid',
    'url',
    'source',
    'citation_count'
  ];

  const rows = papers.map(paper => [
    escapeCSV(paper.title),
    escapeCSV(paper.abstract || ''),
    escapeCSV(paper.authors.map(a => a.name).join('; ')),
    escapeCSV(paper.journal || ''),
    paper.year?.toString() || '',
    escapeCSV(paper.doi || ''),
    escapeCSV(paper.pmid || ''),
    escapeCSV(paper.url || ''),
    paper.source,
    paper.citationCount?.toString() || ''
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================
// Main Handler
// ============================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route: POST /search
      if (path === '/search' && request.method === 'POST') {
        const body = await request.json() as SearchRequest;
        return await handleSearch(body, env);
      }

      // Route: GET /search (simple query param search)
      if (path === '/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || url.searchParams.get('query');
        if (!query) {
          return jsonResponse({ error: 'Missing query parameter' }, 400);
        }

        const databases = url.searchParams.get('databases')?.split(',') || ['pubmed', 'openalex', 'medrxiv'];
        const maxResults = parseInt(url.searchParams.get('max') || '100');

        return await handleSearch({ query, databases, maxResults }, env);
      }

      // Route: POST /export
      if (path === '/export' && request.method === 'POST') {
        const body = await request.json() as { papers: Paper[]; format: 'ris' | 'csv' };
        return handleExport(body.papers, body.format);
      }

      // Route: GET /health
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      // Route: GET /databases
      if (path === '/databases') {
        return jsonResponse({
          available: [
            { id: 'pubmed', name: 'PubMed', papers: '35M', tier: 'core' },
            { id: 'openalex', name: 'OpenAlex', papers: '250M', tier: 'broad' },
            { id: 'semantic_scholar', name: 'Semantic Scholar', papers: '200M', tier: 'broad' },
            { id: 'europe_pmc', name: 'Europe PMC', papers: '40M', tier: 'core' },
            { id: 'medrxiv', name: 'medRxiv', papers: '50K+', tier: 'preprints' },
            { id: 'biorxiv', name: 'bioRxiv', papers: '200K+', tier: 'preprints' }
          ]
        });
      }

      // ============================================
      // Screening Routes
      // ============================================

      // POST /screening/sessions - Create new session
      if (path === '/screening/sessions' && request.method === 'POST') {
        return await createScreeningSession(request, env);
      }

      // GET /screening/sessions - List sessions
      if (path === '/screening/sessions' && request.method === 'GET') {
        const sessionId = request.headers.get('X-Session-ID') || url.searchParams.get('sessionId');
        if (!sessionId) {
          return jsonResponse({ error: 'Session ID required' }, 400);
        }
        return await listScreeningSessions(sessionId, env);
      }

      // GET /screening/sessions/:id - Get session with papers
      const sessionMatch = path.match(/^\/screening\/sessions\/([^/]+)$/);
      if (sessionMatch && request.method === 'GET') {
        return await getScreeningSession(sessionMatch[1], env);
      }

      // GET /screening/sessions/:id/stats - Get statistics
      const statsMatch = path.match(/^\/screening\/sessions\/([^/]+)\/stats$/);
      if (statsMatch && request.method === 'GET') {
        return await getScreeningStats(statsMatch[1], env);
      }

      // POST /screening/decisions - Save decision
      if (path === '/screening/decisions' && request.method === 'POST') {
        return await saveScreeningDecision(request, env);
      }

      // DELETE /screening/decisions - Undo decision
      if (path === '/screening/decisions' && request.method === 'DELETE') {
        return await deleteScreeningDecision(request, env);
      }

      // POST /screening/export - Export results
      if (path === '/screening/export' && request.method === 'POST') {
        return await exportScreeningResults(request, env);
      }

      // GET /screening/health
      if (path === '/screening/health') {
        return jsonResponse({
          status: 'ok',
          service: 'screening',
          timestamp: new Date().toISOString(),
        });
      }

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({
        error: error instanceof Error ? error.message : 'Internal server error'
      }, 500);
    }
  }
};

async function handleSearch(body: SearchRequest, env: Env): Promise<Response> {
  const { query, databases = ['pubmed', 'openalex', 'medrxiv'], maxResults = 100 } = body;

  if (!query) {
    return jsonResponse({ error: 'Missing query' }, 400);
  }

  // Execute searches in parallel
  const searchPromises: Promise<SearchResult>[] = [];

  for (const db of databases) {
    switch (db) {
      case 'pubmed':
        searchPromises.push(searchPubMed(query, maxResults, env.NCBI_API_KEY));
        break;
      case 'openalex':
        searchPromises.push(searchOpenAlex(query, maxResults));
        break;
      case 'semantic_scholar':
        searchPromises.push(searchSemanticScholar(query, maxResults));
        break;
      case 'europe_pmc':
        searchPromises.push(searchEuropePMC(query, maxResults));
        break;
      case 'medrxiv':
        searchPromises.push(searchMedRxiv(query, maxResults, 'medrxiv'));
        break;
      case 'biorxiv':
        searchPromises.push(searchMedRxiv(query, maxResults, 'biorxiv'));
        break;
    }
  }

  const results = await Promise.all(searchPromises);

  // Deduplicate
  const { unique, duplicates, stats } = deduplicatePapers(results);

  // Calculate total search time
  const totalSearchTime = results.reduce((sum, r) => sum + r.searchTime, 0);

  return jsonResponse({
    query,
    databases: databases,
    results: {
      papers: unique,
      totalUnique: unique.length,
      totalFound: stats.totalFound,
      duplicatesRemoved: stats.duplicatesRemoved
    },
    perDatabase: results.map(r => ({
      database: r.database,
      count: r.papers.length,
      totalAvailable: r.totalCount,
      searchTime: r.searchTime,
      error: r.error
    })),
    stats: {
      ...stats,
      totalSearchTime,
      timestamp: new Date().toISOString()
    }
  });
}

function handleExport(papers: Paper[], format: 'ris' | 'csv'): Response {
  if (format === 'ris') {
    return new Response(exportToRIS(papers), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-research-info-systems',
        'Content-Disposition': 'attachment; filename="search_results.ris"'
      }
    });
  }

  if (format === 'csv') {
    return new Response(exportToCSV(papers), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="search_results.csv"'
      }
    });
  }

  return jsonResponse({ error: 'Invalid format. Use "ris" or "csv"' }, 400);
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// ============================================
// Screening Handlers
// ============================================

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

// Create new screening session
async function createScreeningSession(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    name: string;
    stage?: 'title_abstract' | 'full_text';
    papers: Paper[];
    sessionId: string;
    projectId?: string;
  };

  if (!body.papers || body.papers.length === 0) {
    return jsonResponse({ error: 'No papers provided' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    // Create screening session
    const { data: session, error: sessionError } = await supabase
      .from('screening_sessions')
      .insert({
        session_id: body.sessionId,
        project_id: body.projectId,
        name: body.name || 'Untitled Session',
        stage: body.stage || 'title_abstract',
        total_papers: body.papers.length,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Insert papers (batch insert)
    const papersToInsert = body.papers.map(paper => ({
      screening_session_id: session.id,
      external_id: paper.doi || paper.pmid || paper.url, // Use what we have
      doi: paper.doi,
      pmid: paper.pmid,
      title: paper.title,
      abstract: paper.abstract,
      authors: JSON.stringify(paper.authors), // Convert Author[] to string for JSONB handled by Supabase? Or needs explicit JSON
      journal: paper.journal,
      year: paper.year,
      url: paper.url,
      source: paper.source,
    }));

    // Insert in chunks of 100 to avoid limits
    const chunkSize = 100;
    for (let i = 0; i < papersToInsert.length; i += chunkSize) {
      const chunk = papersToInsert.slice(i, i + chunkSize);
      const { error: papersError } = await supabase
        .from('screening_papers')
        .insert(chunk);

      if (papersError) throw papersError;
    }

    return jsonResponse({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        stage: session.stage,
        totalPapers: session.total_papers,
        createdAt: session.created_at,
      },
    });
  } catch (error) {
    console.error('Create session error:', error);
    return jsonResponse({ error: 'Failed to create session' }, 500);
  }
}

// Get screening session with papers and decisions
async function getScreeningSession(
  sessionId: string,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('screening_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return jsonResponse({ error: 'Session not found' }, 404);
      }
      throw sessionError;
    }

    // Get papers
    const { data: papers, error: papersError } = await supabase
      .from('screening_papers')
      .select('*')
      .eq('screening_session_id', sessionId)
      .order('created_at', { ascending: true });

    if (papersError) throw papersError;

    // Get decisions
    const { data: decisions, error: decisionsError } = await supabase
      .from('screening_decisions')
      .select('*')
      .eq('screening_session_id', sessionId);

    if (decisionsError) throw decisionsError;

    // Format decisions as lookup
    const decisionsMap: Record<string, any> = {};
    decisions?.forEach((d: any) => {
      decisionsMap[d.paper_id] = {
        decision: d.decision,
        reason: d.exclusion_reason,
        notes: d.notes,
        decidedAt: d.decided_at,
      };
    });

    return jsonResponse({
      session: {
        id: session.id,
        name: session.name,
        stage: session.stage,
        totalPapers: session.total_papers,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      papers: papers?.map((p: any) => ({
        id: p.id,
        doi: p.doi,
        pmid: p.pmid,
        title: p.title,
        abstract: p.abstract,
        authors: typeof p.authors === 'string' ? JSON.parse(p.authors) : (p.authors || []),
        journal: p.journal,
        year: p.year,
        url: p.url,
        source: p.source,
      })) || [],
      decisions: decisionsMap,
    });
  } catch (error) {
    console.error('Get session error:', error);
    return jsonResponse({ error: 'Failed to get session' }, 500);
  }
}

// Save screening decision
async function saveScreeningDecision(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    sessionId: string;
    paperId: string;
    decision: 'include' | 'exclude' | 'maybe';
    reason?: string;
    notes?: string;
    reviewerSession: string;
  };

  if (!body.sessionId || !body.paperId || !body.decision) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    // Upsert decision
    const { data, error } = await supabase
      .from('screening_decisions')
      .upsert({
        screening_session_id: body.sessionId,
        paper_id: body.paperId,
        decision: body.decision,
        exclusion_reason: body.reason,
        notes: body.notes,
        reviewer_session: body.reviewerSession,
        decided_at: new Date().toISOString(),
      }, {
        onConflict: 'screening_session_id,paper_id,reviewer_session',
      })
      .select()
      .single();

    if (error) throw error;

    // Update session updated_at
    await supabase
      .from('screening_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', body.sessionId);

    return jsonResponse({
      success: true,
      decision: {
        id: data.id,
        paperId: data.paper_id,
        decision: data.decision,
        reason: data.exclusion_reason,
        notes: data.notes,
        decidedAt: data.decided_at,
      },
    });
  } catch (error) {
    console.error('Save decision error:', error);
    return jsonResponse({ error: 'Failed to save decision' }, 500);
  }
}

// Delete decision (undo)
async function deleteScreeningDecision(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    sessionId: string;
    paperId: string;
    reviewerSession: string;
  };

  const supabase = getSupabase(env);

  try {
    const { error } = await supabase
      .from('screening_decisions')
      .delete()
      .eq('screening_session_id', body.sessionId)
      .eq('paper_id', body.paperId)
      .eq('reviewer_session', body.reviewerSession);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Delete decision error:', error);
    return jsonResponse({ error: 'Failed to delete decision' }, 500);
  }
}

// Get screening statistics
async function getScreeningStats(
  sessionId: string,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    const { data: session, error: sessionError } = await supabase
      .from('screening_sessions')
      .select('total_papers')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    const { data: decisions, error: decisionsError } = await supabase
      .from('screening_decisions')
      .select('decision, exclusion_reason')
      .eq('screening_session_id', sessionId);

    if (decisionsError) throw decisionsError;

    const stats = {
      total: session.total_papers,
      screened: decisions?.length || 0,
      pending: session.total_papers - (decisions?.length || 0),
      included: decisions?.filter((d: any) => d.decision === 'include').length || 0,
      excluded: decisions?.filter((d: any) => d.decision === 'exclude').length || 0,
      maybe: decisions?.filter((d: any) => d.decision === 'maybe').length || 0,
    };

    // Calculate exclusion reasons
    const reasonCounts: Record<string, number> = {};
    decisions?.forEach((d: any) => {
      if (d.decision === 'exclude' && d.exclusion_reason) {
        reasonCounts[d.exclusion_reason] = (reasonCounts[d.exclusion_reason] || 0) + 1;
      }
    });

    return jsonResponse({
      stats,
      exclusionReasons: reasonCounts,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return jsonResponse({ error: 'Failed to get stats' }, 500);
  }
}

// List user's screening sessions
async function listScreeningSessions(
  sessionId: string,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    const { data: sessions, error } = await supabase
      .from('screening_sessions')
      .select(`
        id,
        name,
        stage,
        total_papers,
        created_at,
        updated_at,
        screening_decisions (count)
      `)
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return jsonResponse({
      sessions: sessions?.map((s: any) => ({
        id: s.id,
        name: s.name,
        stage: s.stage,
        totalPapers: s.total_papers,
        screened: s.screening_decisions?.[0]?.count || 0,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })) || [],
    });
  } catch (error) {
    console.error('List sessions error:', error);
    return jsonResponse({ error: 'Failed to list sessions' }, 500);
  }
}

// Export screening results
async function exportScreeningResults(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    sessionId: string;
    format: 'csv' | 'ris';
    filter?: 'all' | 'include' | 'exclude' | 'maybe';
  };

  const supabase = getSupabase(env);

  try {
    const { data: papers, error } = await supabase
      .from('screening_papers')
      .select(`
        *,
        screening_decisions (
          decision,
          exclusion_reason,
          notes,
          decided_at
        )
      `)
      .eq('screening_session_id', body.sessionId);

    if (error) throw error;

    let filteredPapers = papers || [];
    if (body.filter && body.filter !== 'all') {
      filteredPapers = filteredPapers.filter((p: any) => {
        const decision = p.screening_decisions?.[0];
        return decision?.decision === body.filter;
      });
    }

    if (body.format === 'csv') {
      const headers = [
        'title', 'abstract', 'authors', 'journal', 'year', 'doi', 'pmid', 'source', 'decision', 'exclusion_reason', 'notes', 'decided_at'
      ];

      const rows = filteredPapers.map((p: any) => {
        const decision = p.screening_decisions?.[0];
        let authorsStr = '';
        if (typeof p.authors === 'string') authorsStr = p.authors; // Assuming already simplified or JSON string
        else if (Array.isArray(p.authors)) authorsStr = p.authors.map((a: any) => a.name).join('; ');

        return [
          escapeCSV(p.title || ''),
          escapeCSV(p.abstract || ''),
          escapeCSV(authorsStr),
          escapeCSV(p.journal || ''),
          p.year?.toString() || '',
          escapeCSV(p.doi || ''),
          escapeCSV(p.pmid || ''),
          escapeCSV(p.source || ''),
          decision?.decision || 'pending',
          escapeCSV(decision?.exclusion_reason || ''),
          escapeCSV(decision?.notes || ''),
          decision?.decided_at || '',
        ].join(',');
      });

      return new Response([headers.join(','), ...rows].join('\n'), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="screening_results.csv"`,
        },
      });
    }

    // Export included papers as RIS
    if (body.format === 'ris') {
      const includedPapers = filteredPapers.filter((p: any) =>
        p.screening_decisions?.[0]?.decision === 'include'
      );

      const ris = includedPapers.map((p: any) => {
        const lines = ['TY  - JOUR', `TI  - ${p.title}`];
        if (p.abstract) lines.push(`AB  - ${p.abstract}`);
        if (p.journal) lines.push(`JO  - ${p.journal}`);
        if (p.year) lines.push(`PY  - ${p.year}`);
        if (p.doi) lines.push(`DO  - ${p.doi}`);
        if (p.pmid) lines.push(`AN  - ${p.pmid}`);
        // Handle authors (could be JSON or array)
        let authors: any[] = [];
        if (typeof p.authors === 'string' && p.authors.startsWith('[')) {
          try { authors = JSON.parse(p.authors); } catch { }
        } else if (Array.isArray(p.authors)) {
          authors = p.authors;
        }
        authors.forEach((a: any) => lines.push(`AU  - ${a.name || a}`));

        lines.push('ER  - ');
        return lines.join('\n');
      }).join('\n');

      return new Response(ris, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/x-research-info-systems',
          'Content-Disposition': `attachment; filename="included_papers.ris"`,
        },
      });
    }

    return jsonResponse({ error: 'Invalid format' }, 400);
  } catch (error) {
    console.error('Export error:', error);
    return jsonResponse({ error: 'Failed to export results' }, 500);
  }
}
