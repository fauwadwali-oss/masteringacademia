// MSDrills Research Tools - Literature Search Worker
// Cloudflare Worker for parallel database searches
// Version: 2.0.0 - Added MHA/MBA Literature Search

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
  APIFY_API_KEY?: string; // For Google Scholar and SSRN scraping
}

// ============================================
// MHA/MBA Types
// ============================================

interface MhambaPaper {
  doi?: string;
  title: string;
  abstract?: string;
  authors: Author[];
  journal?: string;
  journal_issn?: string;
  year?: number;
  url?: string;
  source: string;
  citation_count?: number;
  publication_type?: string;
  journal_tier?: number;
  abs_rating?: string;
  abdc_rating?: string;
  is_ft50?: boolean;
  raw?: any;
}

interface MhambaSearchRequest {
  query: string;
  sources?: string[];
  dateFrom?: string;
  dateTo?: string;
  maxResults?: number;
  projectId?: string;
  userId?: string;
  minJournalTier?: number;
}

interface MhambaSearchResult {
  source: string;
  papers: MhambaPaper[];
  totalCount: number;
  searchTime: number;
  error?: string;
}

interface JournalRanking {
  id: string;
  journal_name: string;
  issn?: string;
  abs_rating?: string;
  abdc_rating?: string;
  is_ft50: boolean;
  tier: number;
  subject_areas?: string[];
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
// MHA/MBA Search Adapters
// ============================================

// Crossref API - Great for DOI resolution and business journals
async function searchCrossref(
  query: string,
  maxResults: number = 100
): Promise<MhambaSearchResult> {
  const startTime = Date.now();
  const source = 'crossref';

  try {
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query', query);
    url.searchParams.set('rows', Math.min(maxResults, 1000).toString());
    url.searchParams.set('select', 'DOI,title,abstract,author,container-title,published,ISSN,is-referenced-by-count,type,URL');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MasteringAcademia/1.0 (https://masteringacademia.com; mailto:contact@masteringseries.com)'
      }
    });

    const data = await response.json() as any;

    const papers: MhambaPaper[] = (data.message?.items || []).map((item: any) => ({
      doi: item.DOI,
      title: Array.isArray(item.title) ? item.title[0] : (item.title || 'No title'),
      abstract: item.abstract ? item.abstract.replace(/<[^>]*>/g, '') : undefined, // Strip HTML
      authors: (item.author || []).map((a: any) => ({
        name: `${a.given || ''} ${a.family || ''}`.trim() || 'Unknown',
        affiliation: a.affiliation?.[0]?.name,
        orcid: a.ORCID
      })),
      journal: Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'],
      journal_issn: Array.isArray(item.ISSN) ? item.ISSN[0] : item.ISSN,
      year: item.published?.['date-parts']?.[0]?.[0],
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : undefined),
      citation_count: item['is-referenced-by-count'],
      publication_type: item.type,
      source: 'crossref'
    }));

    return {
      source,
      papers,
      totalCount: data.message?.['total-results'] || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// CORE API - Open access research papers
async function searchCORE(
  query: string,
  maxResults: number = 100
): Promise<MhambaSearchResult> {
  const startTime = Date.now();
  const source = 'core';

  try {
    // CORE API v3
    const url = new URL('https://api.core.ac.uk/v3/search/works');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', Math.min(maxResults, 100).toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': 'Bearer free', // CORE has a free tier with limited calls
        'Accept': 'application/json'
      }
    });

    const data = await response.json() as any;

    const papers: MhambaPaper[] = (data.results || []).map((item: any) => ({
      doi: item.doi,
      title: item.title || 'No title',
      abstract: item.abstract,
      authors: (item.authors || []).map((a: any) => ({
        name: a.name || 'Unknown'
      })),
      journal: item.publisher,
      year: item.yearPublished,
      url: item.downloadUrl || item.sourceFulltextUrls?.[0] || (item.doi ? `https://doi.org/${item.doi}` : undefined),
      citation_count: item.citationCount,
      publication_type: item.documentType,
      source: 'core'
    }));

    return {
      source,
      papers,
      totalCount: data.totalHits || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// OpenAlex API for MHA/MBA (reusing existing but with business focus)
async function searchOpenAlexBusiness(
  query: string,
  maxResults: number = 100
): Promise<MhambaSearchResult> {
  const startTime = Date.now();
  const source = 'openalex';

  try {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', Math.min(maxResults, 200).toString());
    url.searchParams.set('mailto', 'contact@masteringseries.com');
    // Filter for business/management/economics concepts
    // OpenAlex concept IDs for business fields would be used in production

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MasteringAcademia/1.0 (https://masteringacademia.com; contact@masteringseries.com)'
      }
    });

    const data = await response.json() as any;

    const papers: MhambaPaper[] = (data.results || []).map((work: any) => ({
      doi: work.doi?.replace('https://doi.org/', ''),
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
      journal_issn: work.primary_location?.source?.issn_l,
      year: work.publication_year,
      url: work.primary_location?.landing_page_url || work.doi,
      citation_count: work.cited_by_count,
      publication_type: work.type,
      source: 'openalex',
      raw: work
    }));

    return {
      source,
      papers,
      totalCount: data.meta?.count || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Semantic Scholar for MHA/MBA
async function searchSemanticScholarBusiness(
  query: string,
  maxResults: number = 100
): Promise<MhambaSearchResult> {
  const startTime = Date.now();
  const source = 'semantic_scholar';

  try {
    const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', Math.min(maxResults, 100).toString());
    url.searchParams.set('fields', 'paperId,externalIds,title,abstract,authors,year,venue,citationCount,url,publicationTypes,journal');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MasteringAcademia/1.0'
      }
    });

    const data = await response.json() as any;

    const papers: MhambaPaper[] = (data.data || []).map((paper: any) => ({
      doi: paper.externalIds?.DOI,
      title: paper.title || 'No title',
      abstract: paper.abstract,
      authors: (paper.authors || []).map((a: any) => ({
        name: a.name || 'Unknown'
      })),
      journal: paper.journal?.name || paper.venue,
      journal_issn: paper.journal?.issn,
      year: paper.year,
      url: paper.url,
      citation_count: paper.citationCount,
      publication_type: paper.publicationTypes?.[0],
      source: 'semantic_scholar'
    }));

    return {
      source,
      papers,
      totalCount: data.total || papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Google Scholar via Apify
async function searchGoogleScholar(
  query: string,
  maxResults: number = 50,
  apifyApiKey?: string
): Promise<MhambaSearchResult> {
  const startTime = Date.now();
  const source = 'google_scholar';

  if (!apifyApiKey) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: 'Apify API key required for Google Scholar'
    };
  }

  try {
    // Start Apify actor run
    const actorId = 'marco-gullo/google-scholar-scraper'; // Popular Google Scholar actor
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}`;

    const response = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: query,
        maxResults: Math.min(maxResults, 100),
        csvFriendlyOutput: false
      })
    });

    const data = await response.json() as any[];

    const papers: MhambaPaper[] = (data || []).map((item: any) => ({
      doi: extractDOIFromUrl(item.url),
      title: item.title || 'No title',
      abstract: item.snippet,
      authors: parseGoogleScholarAuthors(item.authors),
      journal: item.publicationInfo,
      year: item.year ? parseInt(item.year) : undefined,
      url: item.url,
      citation_count: item.citedBy ? parseInt(item.citedBy) : undefined,
      publication_type: 'article',
      source: 'google_scholar'
    }));

    return {
      source,
      papers,
      totalCount: papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// SSRN via Apify
async function searchSSRN(
  query: string,
  maxResults: number = 50,
  apifyApiKey?: string
): Promise<MhambaSearchResult> {
  const startTime = Date.now();
  const source = 'ssrn';

  if (!apifyApiKey) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: 'Apify API key required for SSRN'
    };
  }

  try {
    // SSRN scraper actor - may need to find appropriate actor or use web scraper
    const actorId = 'apify/web-scraper';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}`;

    const ssrnSearchUrl = `https://papers.ssrn.com/sol3/results.cfm?txtKey_Words=${encodeURIComponent(query)}`;

    const response = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: ssrnSearchUrl }],
        pageFunction: `async function pageFunction(context) {
          const $ = context.jQuery;
          const results = [];
          $('.result-item, .paper-result').each((i, el) => {
            if (i >= ${maxResults}) return false;
            results.push({
              title: $(el).find('.title, h3 a').text().trim(),
              abstract: $(el).find('.abstract, .description').text().trim(),
              authors: $(el).find('.authors, .author-name').text().trim(),
              url: $(el).find('a.title, h3 a').attr('href'),
              downloads: $(el).find('.downloads, .download-count').text().trim()
            });
          });
          return results;
        }`
      })
    });

    const data = await response.json() as any[];

    const papers: MhambaPaper[] = (data || []).map((item: any) => ({
      doi: extractSSRNId(item.url),
      title: item.title || 'No title',
      abstract: item.abstract,
      authors: parseSSRNAuthors(item.authors),
      year: undefined,
      url: item.url?.startsWith('http') ? item.url : `https://papers.ssrn.com${item.url}`,
      citation_count: item.downloads ? parseInt(item.downloads.replace(/\D/g, '')) : undefined,
      publication_type: 'working_paper',
      source: 'ssrn'
    }));

    return {
      source,
      papers,
      totalCount: papers.length,
      searchTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      source,
      papers: [],
      totalCount: 0,
      searchTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper functions for MHA/MBA adapters
function extractDOIFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const doiMatch = url.match(/10\.\d{4,}\/[^\s]+/);
  return doiMatch ? doiMatch[0] : undefined;
}

function parseGoogleScholarAuthors(authorStr?: string): Author[] {
  if (!authorStr) return [];
  return authorStr.split(',').map(name => ({ name: name.trim() }));
}

function extractSSRNId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/abstract[_=](\d+)/i);
  return match ? `ssrn.${match[1]}` : undefined;
}

function parseSSRNAuthors(authorStr?: string): Author[] {
  if (!authorStr) return [];
  return authorStr.split(/[,;]/).map(name => ({ name: name.trim() })).filter(a => a.name);
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

      // ============================================
      // MHA/MBA Routes
      // ============================================

      // POST /mhamba/search - Multi-source business literature search
      if (path === '/mhamba/search' && request.method === 'POST') {
        const body = await request.json() as MhambaSearchRequest;
        return await handleMhambaSearch(body, env);
      }

      // POST /mhamba/comprehensive-search - AI-powered comprehensive search
      if (path === '/mhamba/comprehensive-search' && request.method === 'POST') {
        const body = await request.json();
        return await handleComprehensiveSearchEndpoint(body, env);
      }

      // GET /mhamba/search - Simple query param search
      if (path === '/mhamba/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || url.searchParams.get('query');
        if (!query) {
          return jsonResponse({ error: 'Missing query parameter' }, 400);
        }
        const sources = url.searchParams.get('sources')?.split(',') || ['openalex', 'crossref', 'semantic_scholar'];
        const maxResults = parseInt(url.searchParams.get('max') || '100');
        const userId = url.searchParams.get('userId') || undefined;
        return await handleMhambaSearch({ query, sources, maxResults, userId }, env);
      }

      // GET /mhamba/sources - Available sources
      if (path === '/mhamba/sources') {
        return jsonResponse({
          available: [
            { id: 'openalex', name: 'OpenAlex', papers: '250M', type: 'api', tier: 'core' },
            { id: 'crossref', name: 'Crossref', papers: '140M', type: 'api', tier: 'core' },
            { id: 'semantic_scholar', name: 'Semantic Scholar', papers: '200M', type: 'api', tier: 'core' },
            { id: 'core', name: 'CORE', papers: '200M', type: 'api', tier: 'open_access' },
            { id: 'google_scholar', name: 'Google Scholar', papers: 'Unknown', type: 'scraper', tier: 'broad', requiresApify: true },
            { id: 'ssrn', name: 'SSRN', papers: '1M+', type: 'scraper', tier: 'working_papers', requiresApify: true }
          ]
        });
      }

      // GET /mhamba/journals - List journal rankings
      if (path === '/mhamba/journals' && request.method === 'GET') {
        const tier = url.searchParams.get('tier');
        const search = url.searchParams.get('search');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        return await listJournalRankings(tier, search, limit, env);
      }

      // POST /mhamba/journals - Add/update journal ranking
      if (path === '/mhamba/journals' && request.method === 'POST') {
        return await upsertJournalRanking(request, env);
      }

      // GET /mhamba/journals/lookup - Lookup journal by name or ISSN
      if (path === '/mhamba/journals/lookup' && request.method === 'GET') {
        const name = url.searchParams.get('name');
        const issn = url.searchParams.get('issn');
        return await lookupJournal(name, issn, env);
      }

      // POST /mhamba/projects - Create project
      if (path === '/mhamba/projects' && request.method === 'POST') {
        return await createMhambaProject(request, env);
      }

      // GET /mhamba/projects - List projects
      if (path === '/mhamba/projects' && request.method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return jsonResponse({ error: 'userId required' }, 400);
        }
        return await listMhambaProjects(userId, env);
      }

      // GET /mhamba/projects/:id - Get project with papers
      const mhambaProjectMatch = path.match(/^\/mhamba\/projects\/([^/]+)$/);
      if (mhambaProjectMatch && request.method === 'GET') {
        return await getMhambaProject(mhambaProjectMatch[1], env);
      }

      // DELETE /mhamba/projects/:id - Delete project
      if (mhambaProjectMatch && request.method === 'DELETE') {
        return await deleteMhambaProject(mhambaProjectMatch[1], env);
      }

      // POST /mhamba/projects/:id/papers - Add papers to project
      const mhambaPapersMatch = path.match(/^\/mhamba\/projects\/([^/]+)\/papers$/);
      if (mhambaPapersMatch && request.method === 'POST') {
        return await addPapersToProject(mhambaPapersMatch[1], request, env);
      }

      // DELETE /mhamba/projects/:id/papers - Remove papers from project
      if (mhambaPapersMatch && request.method === 'DELETE') {
        return await removePapersFromProject(mhambaPapersMatch[1], request, env);
      }

      // POST /mhamba/export - Export papers
      if (path === '/mhamba/export' && request.method === 'POST') {
        return await exportMhambaPapers(request, env);
      }

      // GET /mhamba/health
      if (path === '/mhamba/health') {
        return jsonResponse({
          status: 'ok',
          service: 'mhamba',
          timestamp: new Date().toISOString()
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

// ============================================
// MHA/MBA Handlers
// ============================================

// Main search handler for MHA/MBA
async function handleMhambaSearch(
  body: MhambaSearchRequest,
  env: Env
): Promise<Response> {
  const {
    query,
    sources = ['openalex', 'crossref', 'semantic_scholar'],
    maxResults = 100,
    userId,
    projectId,
    minJournalTier
  } = body;

  if (!query) {
    return jsonResponse({ error: 'Missing query' }, 400);
  }

  const supabase = getSupabase(env);

  // Execute searches in parallel
  const searchPromises: Promise<MhambaSearchResult>[] = [];

  for (const source of sources) {
    switch (source) {
      case 'openalex':
        searchPromises.push(searchOpenAlexBusiness(query, maxResults));
        break;
      case 'crossref':
        searchPromises.push(searchCrossref(query, maxResults));
        break;
      case 'semantic_scholar':
        searchPromises.push(searchSemanticScholarBusiness(query, maxResults));
        break;
      case 'core':
        searchPromises.push(searchCORE(query, maxResults));
        break;
      case 'google_scholar':
        searchPromises.push(searchGoogleScholar(query, maxResults, env.APIFY_API_KEY));
        break;
      case 'ssrn':
        searchPromises.push(searchSSRN(query, maxResults, env.APIFY_API_KEY));
        break;
    }
  }

  const results = await Promise.all(searchPromises);

  // Deduplicate papers
  const { unique, duplicates, stats } = deduplicateMhambaPapers(results);

  // Enrich with journal rankings
  const enrichedPapers = await enrichWithJournalRankings(unique, supabase);

  // Filter by tier if specified
  let finalPapers = enrichedPapers;
  if (minJournalTier) {
    finalPapers = enrichedPapers.filter(p => !p.journal_tier || p.journal_tier <= minJournalTier);
  }

  // Sort by tier (best first), then by citations
  finalPapers.sort((a, b) => {
    const tierA = a.journal_tier || 6;
    const tierB = b.journal_tier || 6;
    if (tierA !== tierB) return tierA - tierB;
    return (b.citation_count || 0) - (a.citation_count || 0);
  });

  // Save search run if projectId provided
  if (projectId && userId) {
    try {
      await supabase.from('mhamba_search_runs').insert({
        project_id: projectId,
        user_id: userId,
        query,
        sources_used: sources,
        total_results: stats.totalFound,
        unique_results: stats.uniqueCount,
        duplicates_removed: stats.duplicatesRemoved
      });
    } catch (e) {
      console.error('Failed to save search run:', e);
    }
  }

  const totalSearchTime = results.reduce((sum, r) => sum + r.searchTime, 0);

  return jsonResponse({
    query,
    sources,
    results: {
      papers: finalPapers,
      totalUnique: finalPapers.length,
      totalFound: stats.totalFound,
      duplicatesRemoved: stats.duplicatesRemoved
    },
    perSource: results.map(r => ({
      source: r.source,
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

// Deduplicate MHA/MBA papers
function deduplicateMhambaPapers(results: MhambaSearchResult[]): {
  unique: MhambaPaper[];
  duplicates: MhambaPaper[];
  stats: {
    totalFound: number;
    duplicatesRemoved: number;
    uniqueCount: number;
    bySource: Record<string, number>;
  };
} {
  const allPapers: MhambaPaper[] = results.flatMap(r => r.papers);
  const unique: MhambaPaper[] = [];
  const duplicates: MhambaPaper[] = [];
  const seenDOIs = new Set<string>();
  const seenTitles = new Map<string, MhambaPaper>();
  const bySource: Record<string, number> = {};

  for (const paper of allPapers) {
    let isDuplicate = false;

    // Check DOI first
    if (paper.doi) {
      const normalizedDOI = paper.doi.toLowerCase();
      if (seenDOIs.has(normalizedDOI)) {
        isDuplicate = true;
      } else {
        seenDOIs.add(normalizedDOI);
      }
    }

    // Check title similarity
    if (!isDuplicate && paper.title) {
      const normalizedTitle = normalizeTitle(paper.title);
      for (const [existingTitle] of seenTitles) {
        const similarity = calculateSimilarity(normalizedTitle, existingTitle);
        if (similarity >= 0.85) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        seenTitles.set(normalizedTitle, paper);
      }
    }

    if (isDuplicate) {
      duplicates.push(paper);
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
      bySource
    }
  };
}

// Enrich papers with journal rankings from database
async function enrichWithJournalRankings(
  papers: MhambaPaper[],
  supabase: any
): Promise<MhambaPaper[]> {
  // Collect all unique journal names and ISSNs
  const journalNames = new Set<string>();
  const issns = new Set<string>();

  for (const paper of papers) {
    if (paper.journal) journalNames.add(paper.journal.toLowerCase());
    if (paper.journal_issn) issns.add(paper.journal_issn);
  }

  if (journalNames.size === 0 && issns.size === 0) {
    return papers;
  }

  try {
    // Query journal rankings
    let query = supabase.from('mhamba_journal_rankings').select('*');

    // Build OR conditions for journals
    const conditions: string[] = [];
    if (journalNames.size > 0) {
      conditions.push(`journal_name_normalized.in.(${Array.from(journalNames).map(n => `"${n}"`).join(',')})`);
    }
    if (issns.size > 0) {
      conditions.push(`issn.in.(${Array.from(issns).join(',')})`);
    }

    const { data: rankings, error } = await query.or(conditions.join(','));

    if (error || !rankings) {
      console.error('Failed to fetch journal rankings:', error);
      return papers;
    }

    // Create lookup maps
    const rankingByName = new Map<string, any>();
    const rankingByISSN = new Map<string, any>();

    for (const ranking of rankings) {
      if (ranking.journal_name_normalized) {
        rankingByName.set(ranking.journal_name_normalized.toLowerCase(), ranking);
      }
      if (ranking.issn) {
        rankingByISSN.set(ranking.issn, ranking);
      }
    }

    // Enrich papers
    return papers.map(paper => {
      let ranking = null;

      // Try ISSN first (more reliable)
      if (paper.journal_issn) {
        ranking = rankingByISSN.get(paper.journal_issn);
      }

      // Fallback to name
      if (!ranking && paper.journal) {
        ranking = rankingByName.get(paper.journal.toLowerCase());
      }

      if (ranking) {
        return {
          ...paper,
          journal_tier: ranking.tier,
          abs_rating: ranking.abs_rating,
          abdc_rating: ranking.abdc_rating,
          is_ft50: ranking.is_ft50
        };
      }

      return paper;
    });
  } catch (e) {
    console.error('Error enriching with journal rankings:', e);
    return papers;
  }
}

// List journal rankings
async function listJournalRankings(
  tier: string | null,
  search: string | null,
  limit: number,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    let query = supabase
      .from('mhamba_journal_rankings')
      .select('*')
      .order('tier', { ascending: true })
      .order('journal_name', { ascending: true })
      .limit(limit);

    if (tier) {
      query = query.eq('tier', parseInt(tier));
    }

    if (search) {
      query = query.ilike('journal_name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({
      journals: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('List journals error:', error);
    return jsonResponse({ error: 'Failed to list journals' }, 500);
  }
}

// Upsert journal ranking
async function upsertJournalRanking(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    journal_name: string;
    issn?: string;
    abs_rating?: string;
    abdc_rating?: string;
    is_ft50?: boolean;
    tier?: number;
    subject_areas?: string[];
  };

  if (!body.journal_name) {
    return jsonResponse({ error: 'journal_name required' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    const { data, error } = await supabase
      .from('mhamba_journal_rankings')
      .upsert({
        journal_name: body.journal_name,
        journal_name_normalized: body.journal_name.toLowerCase().trim(),
        issn: body.issn,
        abs_rating: body.abs_rating,
        abdc_rating: body.abdc_rating,
        is_ft50: body.is_ft50 || false,
        tier: body.tier || 5,
        subject_areas: body.subject_areas
      }, {
        onConflict: 'journal_name_normalized'
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({ success: true, journal: data });
  } catch (error) {
    console.error('Upsert journal error:', error);
    return jsonResponse({ error: 'Failed to save journal' }, 500);
  }
}

// Lookup journal by name or ISSN
async function lookupJournal(
  name: string | null,
  issn: string | null,
  env: Env
): Promise<Response> {
  if (!name && !issn) {
    return jsonResponse({ error: 'name or issn required' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    let query = supabase.from('mhamba_journal_rankings').select('*');

    if (issn) {
      query = query.eq('issn', issn);
    } else if (name) {
      query = query.ilike('journal_name', `%${name}%`);
    }

    const { data, error } = await query.limit(10);

    if (error) throw error;

    return jsonResponse({
      journals: data || [],
      found: (data?.length || 0) > 0
    });
  } catch (error) {
    console.error('Lookup journal error:', error);
    return jsonResponse({ error: 'Failed to lookup journal' }, 500);
  }
}

// Create MHA/MBA project
async function createMhambaProject(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    name: string;
    description?: string;
    userId: string;
  };

  if (!body.name || !body.userId) {
    return jsonResponse({ error: 'name and userId required' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    const { data, error } = await supabase
      .from('mhamba_projects')
      .insert({
        name: body.name,
        description: body.description,
        user_id: body.userId,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({ success: true, project: data });
  } catch (error) {
    console.error('Create project error:', error);
    return jsonResponse({ error: 'Failed to create project' }, 500);
  }
}

// List MHA/MBA projects
async function listMhambaProjects(
  userId: string,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    const { data, error } = await supabase
      .from('mhamba_projects')
      .select(`
        *,
        mhamba_papers (count),
        mhamba_search_runs (count)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return jsonResponse({
      projects: (data || []).map((p: any) => ({
        ...p,
        paper_count: p.mhamba_papers?.[0]?.count || 0,
        search_count: p.mhamba_search_runs?.[0]?.count || 0
      }))
    });
  } catch (error) {
    console.error('List projects error:', error);
    return jsonResponse({ error: 'Failed to list projects' }, 500);
  }
}

// Get MHA/MBA project with papers
async function getMhambaProject(
  projectId: string,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    // Get project
    const { data: project, error: projectError } = await supabase
      .from('mhamba_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return jsonResponse({ error: 'Project not found' }, 404);
      }
      throw projectError;
    }

    // Get papers
    const { data: papers, error: papersError } = await supabase
      .from('mhamba_papers')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (papersError) throw papersError;

    // Get search runs
    const { data: searchRuns, error: searchError } = await supabase
      .from('mhamba_search_runs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (searchError) throw searchError;

    return jsonResponse({
      project,
      papers: papers || [],
      searchRuns: searchRuns || [],
      stats: {
        totalPapers: papers?.length || 0,
        byTier: countByTier(papers || []),
        bySource: countBySource(papers || [])
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    return jsonResponse({ error: 'Failed to get project' }, 500);
  }
}

// Helper to count papers by tier
function countByTier(papers: any[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 0: 0 };
  for (const p of papers) {
    const tier = p.journal_tier || 0;
    counts[tier] = (counts[tier] || 0) + 1;
  }
  return counts;
}

// Helper to count papers by source
function countBySource(papers: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of papers) {
    counts[p.source] = (counts[p.source] || 0) + 1;
  }
  return counts;
}

// Delete MHA/MBA project
async function deleteMhambaProject(
  projectId: string,
  env: Env
): Promise<Response> {
  const supabase = getSupabase(env);

  try {
    // Delete papers first (cascade should handle this but being explicit)
    await supabase
      .from('mhamba_papers')
      .delete()
      .eq('project_id', projectId);

    await supabase
      .from('mhamba_search_runs')
      .delete()
      .eq('project_id', projectId);

    const { error } = await supabase
      .from('mhamba_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return jsonResponse({ error: 'Failed to delete project' }, 500);
  }
}

// Add papers to project
async function addPapersToProject(
  projectId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    papers: MhambaPaper[];
    userId: string;
  };

  if (!body.papers || body.papers.length === 0) {
    return jsonResponse({ error: 'No papers provided' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    const papersToInsert = body.papers.map(paper => ({
      project_id: projectId,
      user_id: body.userId,
      doi: paper.doi,
      title: paper.title,
      abstract: paper.abstract,
      authors: JSON.stringify(paper.authors),
      journal: paper.journal,
      journal_issn: paper.journal_issn,
      year: paper.year,
      url: paper.url,
      source: paper.source,
      citation_count: paper.citation_count,
      publication_type: paper.publication_type,
      journal_tier: paper.journal_tier,
      abs_rating: paper.abs_rating,
      abdc_rating: paper.abdc_rating,
      is_ft50: paper.is_ft50
    }));

    // Insert in chunks
    const chunkSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < papersToInsert.length; i += chunkSize) {
      const chunk = papersToInsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('mhamba_papers')
        .insert(chunk);

      if (error) throw error;
      insertedCount += chunk.length;
    }

    // Update project timestamp
    await supabase
      .from('mhamba_projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', projectId);

    return jsonResponse({
      success: true,
      inserted: insertedCount
    });
  } catch (error) {
    console.error('Add papers error:', error);
    return jsonResponse({ error: 'Failed to add papers' }, 500);
  }
}

// Remove papers from project
async function removePapersFromProject(
  projectId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    paperIds: string[];
  };

  if (!body.paperIds || body.paperIds.length === 0) {
    return jsonResponse({ error: 'No paper IDs provided' }, 400);
  }

  const supabase = getSupabase(env);

  try {
    const { error } = await supabase
      .from('mhamba_papers')
      .delete()
      .eq('project_id', projectId)
      .in('id', body.paperIds);

    if (error) throw error;

    return jsonResponse({
      success: true,
      removed: body.paperIds.length
    });
  } catch (error) {
    console.error('Remove papers error:', error);
    return jsonResponse({ error: 'Failed to remove papers' }, 500);
  }
}

// Export MHA/MBA papers
async function exportMhambaPapers(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json() as {
    projectId?: string;
    papers?: MhambaPaper[];
    format: 'csv' | 'ris' | 'bibtex';
    filter?: {
      minTier?: number;
      sources?: string[];
    };
  };

  const supabase = getSupabase(env);
  let papers: any[] = body.papers || [];

  // If projectId provided, fetch papers from DB
  if (body.projectId && papers.length === 0) {
    const { data, error } = await supabase
      .from('mhamba_papers')
      .select('*')
      .eq('project_id', body.projectId);

    if (error) {
      return jsonResponse({ error: 'Failed to fetch papers' }, 500);
    }
    papers = data || [];
  }

  // Apply filters
  if (body.filter?.minTier) {
    papers = papers.filter(p => !p.journal_tier || p.journal_tier <= body.filter!.minTier!);
  }
  if (body.filter?.sources) {
    papers = papers.filter(p => body.filter!.sources!.includes(p.source));
  }

  // Format output
  if (body.format === 'csv') {
    const headers = [
      'title', 'abstract', 'authors', 'journal', 'year', 'doi', 'url',
      'source', 'citations', 'tier', 'abs_rating', 'abdc_rating', 'ft50'
    ];

    const rows = papers.map((p: any) => {
      let authorsStr = '';
      if (typeof p.authors === 'string') {
        try { authorsStr = JSON.parse(p.authors).map((a: any) => a.name).join('; '); }
        catch { authorsStr = p.authors; }
      } else if (Array.isArray(p.authors)) {
        authorsStr = p.authors.map((a: any) => a.name).join('; ');
      }

      return [
        escapeCSV(p.title || ''),
        escapeCSV(p.abstract || ''),
        escapeCSV(authorsStr),
        escapeCSV(p.journal || ''),
        p.year?.toString() || '',
        escapeCSV(p.doi || ''),
        escapeCSV(p.url || ''),
        p.source || '',
        p.citation_count?.toString() || '',
        p.journal_tier?.toString() || '',
        p.abs_rating || '',
        p.abdc_rating || '',
        p.is_ft50 ? 'Yes' : ''
      ].join(',');
    });

    return new Response([headers.join(','), ...rows].join('\n'), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="mhamba_papers.csv"'
      }
    });
  }

  if (body.format === 'ris') {
    const ris = papers.map((p: any) => {
      const lines = ['TY  - JOUR', `TI  - ${p.title}`];
      if (p.abstract) lines.push(`AB  - ${p.abstract}`);
      if (p.journal) lines.push(`JO  - ${p.journal}`);
      if (p.year) lines.push(`PY  - ${p.year}`);
      if (p.doi) lines.push(`DO  - ${p.doi}`);
      if (p.url) lines.push(`UR  - ${p.url}`);
      if (p.journal_tier) lines.push(`N1  - Journal Tier: ${p.journal_tier}`);
      if (p.abs_rating) lines.push(`N1  - ABS Rating: ${p.abs_rating}`);

      let authors: any[] = [];
      if (typeof p.authors === 'string') {
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
        'Content-Disposition': 'attachment; filename="mhamba_papers.ris"'
      }
    });
  }

  if (body.format === 'bibtex') {
    const bibtex = papers.map((p: any, i: number) => {
      const key = p.doi?.replace(/[^a-zA-Z0-9]/g, '') || `paper${i + 1}`;
      let authors: string[] = [];
      if (typeof p.authors === 'string') {
        try { authors = JSON.parse(p.authors).map((a: any) => a.name); } catch { }
      } else if (Array.isArray(p.authors)) {
        authors = p.authors.map((a: any) => a.name);
      }

      return `@article{${key},
  title = {${p.title || ''}},
  author = {${authors.join(' and ')}},
  journal = {${p.journal || ''}},
  year = {${p.year || ''}},
  doi = {${p.doi || ''}},
  url = {${p.url || ''}}
}`;
    }).join('\n\n');

    return new Response(bibtex, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-bibtex',
        'Content-Disposition': 'attachment; filename="mhamba_papers.bib"'
      }
    });
  }

  return jsonResponse({ error: 'Invalid format. Use "csv", "ris", or "bibtex"' }, 400);
}

// ============================================
// Comprehensive Search Handler
// ============================================

async function handleComprehensiveSearchEndpoint(
  body: any,
  env: Env
): Promise<Response> {
  const {
    query,
    sources = ['openalex', 'crossref', 'semantic_scholar'],
    maxResults = 100,
    targetJournals,
    timeFrame,
    minCitations,
    userId,
    projectId
  } = body;

  if (!query) {
    return jsonResponse({ error: 'Missing query' }, 400);
  }

  // Check if API keys are configured
  if (!env.ANTHROPIC_API_KEY && !env.GEMINI_API_KEY) {
    return jsonResponse({ 
      error: 'AI analysis not configured. Please contact administrator.' 
    }, 503);
  }

  try {
    // Step 1: Perform regular search first
    const searchBody = {
      query,
      sources,
      maxResults,
      userId,
      projectId
    };

    const searchResponse = await handleMhambaSearch(searchBody, env);
    const searchData = await searchResponse.json();

    if (!searchData.results || !searchData.results.papers) {
      return jsonResponse({ 
        error: 'Search failed or returned no results' 
      }, 500);
    }

    const papers = searchData.results.papers;

    // Step 2: Perform AI-powered comprehensive analysis
    const comprehensiveResult = await performComprehensiveAnalysis(
      query,
      papers,
      env
    );

    return jsonResponse({
      ...searchData,
      comprehensive: comprehensiveResult
    });

  } catch (error: any) {
    console.error('Comprehensive search error:', error);
    return jsonResponse({ 
      error: 'Comprehensive search failed',
      details: error.message 
    }, 500);
  }
}

async function performComprehensiveAnalysis(
  query: string,
  papers: any[],
  env: Env
): Promise<any> {
  // Prepare paper summaries for LLM
  const paperSummaries = papers.slice(0, 50).map((p, idx) => {
    return `[${idx + 1}] ${p.title} (${p.year || 'N/A'})
Journal: ${p.journal || 'Unknown'} ${p.abs_rating ? `(ABS ${p.abs_rating})` : ''}
Citations: ${p.citation_count || 0}
Abstract: ${p.abstract?.substring(0, 500) || 'No abstract available'}...
`;
  }).join('\n\n');

  const systemPrompt = `You are an expert research analyst specializing in business and management literature. You provide comprehensive, evidence-based analysis of academic research.`;

  const prompt = `I conducted a literature search on: "${query}"

Here are the top ${Math.min(50, papers.length)} papers found:

${paperSummaries}

Please provide a comprehensive analysis in the following JSON format:
{
  "summary": "A 3-4 paragraph synthesis of the research landscape",
  "keyThemes": [
    {
      "title": "Theme title",
      "description": "Detailed description",
      "paperCount": 10,
      "keyPapers": ["Paper title 1", "Paper title 2"]
    }
  ],
  "researchGaps": [
    {
      "title": "Gap title",
      "description": "What's missing",
      "opportunity": "Research opportunity",
      "relatedPapers": ["Paper title"]
    }
  ],
  "suggestedQuestions": ["Question 1", "Question 2", "Question 3"],
  "methodologicalInsights": ["Insight 1", "Insight 2", "Insight 3"]
}

Focus on:
1. Major themes and patterns in the literature
2. Theoretical frameworks being used
3. Methodological approaches
4. Clear research gaps and opportunities
5. Future research directions

Return ONLY valid JSON, no additional text.`;

  const response = await callLLM(prompt, systemPrompt, env);
  
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const analysis = JSON.parse(jsonMatch[0]);

    // Generate annotated bibliography for top 10 papers
    const annotatedBibliography = await generateAnnotations(papers.slice(0, 10), env);

    // Calculate statistics
    const stats = calculatePaperStats(papers);

    return {
      analysis,
      annotatedBibliography,
      stats
    };
  } catch (e) {
    console.error('Failed to parse analysis:', e);
    return {
      analysis: {
        summary: 'Analysis failed. Please try again.',
        keyThemes: [],
        researchGaps: [],
        suggestedQuestions: [],
        methodologicalInsights: []
      },
      annotatedBibliography: [],
      stats: calculatePaperStats(papers)
    };
  }
}

async function callLLM(
  prompt: string,
  systemPrompt: string,
  env: Env
): Promise<string> {
  const apiKey = env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY;
  const provider = env.ANTHROPIC_API_KEY ? 'anthropic' : 'gemini';

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } else {
    // Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\n${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 8000,
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
}

async function generateAnnotations(papers: any[], env: Env): Promise<any[]> {
  const annotated: any[] = [];
  
  for (const paper of papers) {
    const systemPrompt = `You are an expert research analyst. Create detailed, accurate annotations for academic papers.`;
    
    const prompt = `Create a detailed annotation for this paper:

Title: ${paper.title}
Authors: ${Array.isArray(paper.authors) ? paper.authors.map((a: any) => a.name).join(', ') : 'Unknown'}
Journal: ${paper.journal || 'Unknown'}
Year: ${paper.year || 'N/A'}
Abstract: ${paper.abstract || 'No abstract available'}

Provide a JSON response with:
{
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "methodology": "Description of research methodology",
  "theoreticalFramework": "Theoretical frameworks used",
  "relevance": "Why this paper is relevant",
  "limitations": "Key limitations"
}

Base your analysis ONLY on the information provided. Return ONLY valid JSON.`;

    try {
      const response = await callLLM(prompt, systemPrompt, env);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const annotation = JSON.parse(jsonMatch[0]);
        annotated.push({ paper, annotation });
      }
    } catch (e) {
      console.error(`Failed to annotate paper: ${paper.title}`, e);
      annotated.push({
        paper,
        annotation: {
          keyFindings: ['Analysis pending'],
          methodology: 'Not analyzed',
          theoreticalFramework: 'Not analyzed',
          relevance: 'Relevant to search query',
          limitations: 'Not analyzed'
        }
      });
    }
  }
  
  return annotated;
}

function calculatePaperStats(papers: any[]): any {
  const stats = {
    totalPapers: papers.length,
    journalDistribution: {} as Record<string, number>,
    yearDistribution: {} as Record<string, number>,
    avgCitations: 0,
    topJournals: [] as Array<{ journal: string; count: number; avgTier: number }>
  };

  let totalCitations = 0;
  const journalData = new Map<string, { count: number; tiers: number[] }>();

  for (const paper of papers) {
    if (paper.journal) {
      stats.journalDistribution[paper.journal] = (stats.journalDistribution[paper.journal] || 0) + 1;
      
      if (!journalData.has(paper.journal)) {
        journalData.set(paper.journal, { count: 0, tiers: [] });
      }
      const jData = journalData.get(paper.journal)!;
      jData.count++;
      if (paper.journal_tier) {
        jData.tiers.push(paper.journal_tier);
      }
    }

    if (paper.year) {
      const yearStr = paper.year.toString();
      stats.yearDistribution[yearStr] = (stats.yearDistribution[yearStr] || 0) + 1;
    }

    if (paper.citation_count) {
      totalCitations += paper.citation_count;
    }
  }

  stats.avgCitations = papers.length > 0 ? Math.round(totalCitations / papers.length) : 0;

  stats.topJournals = Array.from(journalData.entries())
    .map(([journal, data]) => ({
      journal,
      count: data.count,
      avgTier: data.tiers.length > 0 
        ? data.tiers.reduce((a, b) => a + b, 0) / data.tiers.length 
        : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return stats;
}
