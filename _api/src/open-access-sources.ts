// Open Access Source Integrations
// Handles searches across DOAJ, arXiv, RePEc, BASE, PLOS, PMC, WHO IRIS

interface Paper {
  doi?: string;
  pmid?: string;
  title: string;
  abstract?: string;
  authors: { name: string; affiliation?: string }[];
  journal?: string;
  year?: number;
  url?: string;
  source: string;
  citationCount?: number;
}

// ============================================
// DOAJ (Directory of Open Access Journals)
// ============================================
export async function searchDOAJ(query: string, subject?: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    const subjectFilter = subject ? `&fq=bibjson.subject.term:"${subject}"` : '';
    const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${maxResults}${subjectFilter}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DOAJ API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    return results.map((item: any) => ({
      doi: item.bibjson?.identifier?.find((id: any) => id.type === 'doi')?.id,
      title: item.bibjson?.title || 'Untitled',
      abstract: item.bibjson?.abstract || '',
      authors: (item.bibjson?.author || []).map((author: any) => ({
        name: author.name || 'Unknown',
        affiliation: author.affiliation,
      })),
      journal: item.bibjson?.journal?.title || '',
      year: item.bibjson?.year ? parseInt(item.bibjson.year) : undefined,
      url: item.bibjson?.link?.find((link: any) => link.type === 'fulltext')?.url || '',
      source: subject ? `doaj_${subject}` : 'doaj',
      citationCount: 0,
    }));
  } catch (error: any) {
    console.error('DOAJ search error:', error);
    return [];
  }
}

// ============================================
// arXiv Economics
// ============================================
export async function searchArXivEcon(query: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}+AND+cat:econ.*&start=0&max_results=${maxResults}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    const papers: Paper[] = [];
    
    // Parse XML (simple regex-based parsing for Cloudflare Worker)
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entry = match[1];
      
      const title = entry.match(/<title>(.*?)<\/title>/)?.[1]?.trim() || 'Untitled';
      const abstract = entry.match(/<summary>(.*?)<\/summary>/)?.[1]?.trim() || '';
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
      const year = published ? parseInt(published.substring(0, 4)) : undefined;
      const id = entry.match(/<id>(.*?)<\/id>/)?.[1];
      const doi = entry.match(/<arxiv:doi>(.*?)<\/arxiv:doi>/)?.[1];
      
      const authorMatches = entry.matchAll(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g);
      const authors = Array.from(authorMatches).map(m => ({
        name: m[1].trim(),
      }));
      
      papers.push({
        doi,
        title,
        abstract,
        authors,
        journal: 'arXiv Economics',
        year,
        url: id || '',
        source: 'arxiv_econ',
        citationCount: 0,
      });
    }
    
    return papers;
  } catch (error: any) {
    console.error('arXiv search error:', error);
    return [];
  }
}

// ============================================
// RePEc (Research Papers in Economics)
// ============================================
export async function searchRepEC(query: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    // RePEc uses IDEAS search interface
    const url = `https://ideas.repec.org/cgi-bin/htsearch?q=${encodeURIComponent(query)}&cmd=Search&form=extended&m=all&fmt=long&sp=1&sy=1&wm=wrd&wf=0F1F&dt=range`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`RePEc API error: ${response.statusText}`);
    }
    
    const html = await response.text();
    const papers: Paper[] = [];
    
    // Parse HTML to extract paper information
    // This is a simplified parser - in production, you'd want more robust parsing
    const itemRegex = /<li class="list-group-item downfree">([\s\S]*?)<\/li>/g;
    let match;
    let count = 0;
    
    while ((match = itemRegex.exec(html)) !== null && count < maxResults) {
      const item = match[1];
      
      const titleMatch = item.match(/<a href="(.*?)".*?>(.*?)<\/a>/);
      const title = titleMatch?.[2]?.replace(/<[^>]*>/g, '').trim() || 'Untitled';
      const url = titleMatch?.[1] ? `https://ideas.repec.org${titleMatch[1]}` : '';
      
      const authorMatch = item.match(/by (.*?)(?:<br>|$)/);
      const authorNames = authorMatch?.[1]?.split('&amp;').map(a => a.trim()) || [];
      
      const yearMatch = item.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
      
      papers.push({
        title,
        abstract: '',
        authors: authorNames.map(name => ({ name })),
        journal: 'RePEc',
        year,
        url,
        source: 'repec',
        citationCount: 0,
      });
      
      count++;
    }
    
    return papers;
  } catch (error: any) {
    console.error('RePEc search error:', error);
    return [];
  }
}

// ============================================
// BASE (Bielefeld Academic Search Engine)
// ============================================
export async function searchBASE(query: string, doctype?: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    const doctypeFilter = doctype ? `&dctype=${doctype}` : '';
    const url = `https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?func=PerformSearch&query=${encodeURIComponent(query)}&format=json&hits=${maxResults}${doctypeFilter}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BASE API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const docs = data.response?.docs || [];
    
    return docs.map((doc: any) => ({
      doi: doc.dcidentifier?.find((id: string) => id.startsWith('10.'))?.replace('doi:', ''),
      title: doc.dctitle?.[0] || 'Untitled',
      abstract: doc.dcdescription?.[0] || '',
      authors: (doc.dccreator || []).map((name: string) => ({ name })),
      journal: doc.dcsource?.[0] || '',
      year: doc.dcyear ? parseInt(doc.dcyear) : undefined,
      url: doc.dclink?.[0] || '',
      source: 'base',
      citationCount: 0,
    }));
  } catch (error: any) {
    console.error('BASE search error:', error);
    return [];
  }
}

// ============================================
// PLOS (Public Library of Science)
// ============================================
export async function searchPLOS(query: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    const url = `https://api.plos.org/search?q=${encodeURIComponent(query)}&rows=${maxResults}&wt=json&fl=id,title,abstract,author,journal,publication_date,article_type,counter_total_all`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`PLOS API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const docs = data.response?.docs || [];
    
    return docs.map((doc: any) => ({
      doi: doc.id?.replace('10.1371/journal.', '10.1371/journal.'),
      title: doc.title?.[0] || 'Untitled',
      abstract: doc.abstract?.[0] || '',
      authors: (doc.author || []).map((name: string) => ({ name })),
      journal: doc.journal || 'PLOS',
      year: doc.publication_date ? parseInt(doc.publication_date.substring(0, 4)) : undefined,
      url: `https://journals.plos.org/plosone/article?id=${doc.id}`,
      source: 'plos',
      citationCount: doc.counter_total_all || 0,
    }));
  } catch (error: any) {
    console.error('PLOS search error:', error);
    return [];
  }
}

// ============================================
// PMC Full Text (via OAI-PMH)
// ============================================
export async function searchPMCFullText(query: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    // Use PubMed Central's E-utilities API
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`PMC search error: ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    const pmcIds = searchData.esearchresult?.idlist || [];
    
    if (pmcIds.length === 0) {
      return [];
    }
    
    // Fetch details for the PMC IDs
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${pmcIds.join(',')}&retmode=json`;
    
    const summaryResponse = await fetch(summaryUrl);
    if (!summaryResponse.ok) {
      throw new Error(`PMC summary error: ${summaryResponse.statusText}`);
    }
    
    const summaryData = await summaryResponse.json();
    const papers: Paper[] = [];
    
    for (const id of pmcIds) {
      const article = summaryData.result?.[id];
      if (!article) continue;
      
      papers.push({
        pmid: article.pmid,
        title: article.title || 'Untitled',
        abstract: '', // Would need separate efetch call for abstracts
        authors: (article.authors || []).map((author: any) => ({
          name: author.name || 'Unknown',
        })),
        journal: article.fulljournalname || '',
        year: article.pubdate ? parseInt(article.pubdate.substring(0, 4)) : undefined,
        url: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${id}/`,
        source: 'pmc_fulltext',
        citationCount: 0,
      });
    }
    
    return papers;
  } catch (error: any) {
    console.error('PMC Full Text search error:', error);
    return [];
  }
}

// ============================================
// WHO IRIS (Institutional Repository)
// ============================================
export async function searchWHOIRIS(query: string, maxResults: number = 100): Promise<Paper[]> {
  try {
    // WHO IRIS uses DSpace API
    const url = `https://apps.who.int/iris/rest/items/find-by-metadata-field?expand=metadata&limit=${maxResults}&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`WHO IRIS API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const items = Array.isArray(data) ? data : [];
    
    return items.map((item: any) => {
      const metadata = item.metadata || [];
      
      const getMetadata = (key: string) => {
        const field = metadata.find((m: any) => m.key === key);
        return field?.value || '';
      };
      
      const authors = metadata
        .filter((m: any) => m.key === 'dc.contributor.author')
        .map((m: any) => ({ name: m.value }));
      
      return {
        title: getMetadata('dc.title') || 'Untitled',
        abstract: getMetadata('dc.description.abstract'),
        authors,
        journal: 'WHO IRIS',
        year: getMetadata('dc.date.issued') ? parseInt(getMetadata('dc.date.issued').substring(0, 4)) : undefined,
        url: `https://apps.who.int/iris/handle/${item.handle}`,
        source: 'who_iris',
        citationCount: 0,
      };
    });
  } catch (error: any) {
    console.error('WHO IRIS search error:', error);
    return [];
  }
}
