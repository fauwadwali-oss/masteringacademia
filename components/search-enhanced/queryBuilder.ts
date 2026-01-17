import { SearchFilters } from './LiteratureSearch';

// Build PubMed query string
export function buildPubMedQuery(query: string, filters: SearchFilters): string {
  const parts: string[] = [`(${query})`];

  // Must include
  filters.mustInclude.forEach(term => {
    parts.push(`AND (${term})`);
  });

  // Must exclude
  filters.mustExclude.forEach(term => {
    parts.push(`NOT (${term})`);
  });

  // MeSH terms
  filters.meshTerms.forEach(mesh => {
    parts.push(`AND "${mesh}"[MeSH Terms]`);
  });

  // Date range
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom?.replace(/-/g, '/') || '1900/01/01';
    const to = filters.dateTo?.replace(/-/g, '/') || '3000/12/31';
    parts.push(`AND ("${from}"[Date - Publication] : "${to}"[Date - Publication])`);
  }

  // Study types
  if (filters.studyTypes.length > 0) {
    const types = filters.studyTypes.map(t => `"${t}"[Publication Type]`).join(' OR ');
    parts.push(`AND (${types})`);
  }

  // Humans only
  if (filters.humansOnly) {
    parts.push('AND "humans"[MeSH Terms]');
  }

  // Free full text
  if (filters.freeFullText) {
    parts.push('AND free full text[filter]');
  }

  return parts.join(' ');
}

// Build OpenAlex query params
export function buildOpenAlexParams(query: string, filters: SearchFilters): { search: string; filter: string } {
  let search = query;
  filters.mustInclude.forEach(term => { search += ` AND ${term}`; });

  const filterParts: string[] = [];

  if (filters.dateFrom) filterParts.push(`from_publication_date:${filters.dateFrom}`);
  if (filters.dateTo) filterParts.push(`to_publication_date:${filters.dateTo}`);
  if (filters.freeFullText) filterParts.push('is_oa:true');

  return { search, filter: filterParts.join(',') };
}

// Build Europe PMC query
export function buildEuropePMCQuery(query: string, filters: SearchFilters): string {
  const parts: string[] = [query];

  filters.mustInclude.forEach(term => parts.push(`AND "${term}"`));
  filters.mustExclude.forEach(term => parts.push(`NOT "${term}"`));

  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || '1900-01-01';
    const to = filters.dateTo || '2099-12-31';
    parts.push(`AND (FIRST_PDATE:[${from} TO ${to}])`);
  }

  if (filters.freeFullText) parts.push('AND (HAS_FT:Y)');

  return parts.join(' ');
}

// Build medRxiv/bioRxiv params
export function buildRxivParams(query: string, filters: SearchFilters): { query: string; startDate?: string; endDate?: string } {
  let q = query;
  filters.mustInclude.forEach(term => { q += ` AND ${term}`; });
  filters.mustExclude.forEach(term => { q += ` NOT ${term}`; });

  return {
    query: q,
    startDate: filters.dateFrom || undefined,
    endDate: filters.dateTo || undefined,
  };
}

export default {
  buildPubMedQuery,
  buildOpenAlexParams,
  buildEuropePMCQuery,
  buildRxivParams,
};

