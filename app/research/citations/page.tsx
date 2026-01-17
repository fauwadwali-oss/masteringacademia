'use client';
import React, { useState, useCallback, useMemo } from 'react';

// ============================================
// Types
// ============================================

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi: string;
  citationCount: number;
  referencesCount: number;
  isOpenAccess: boolean;
  abstract?: string;
}

interface CitationNode {
  paper: Paper;
  depth: number;
  direction: 'seed' | 'forward' | 'backward';
  parentId?: string;
  isExpanded: boolean;
  children: CitationNode[];
}

interface SearchResult {
  papers: Paper[];
  total: number;
  cursor?: string;
}

// ============================================
// OpenAlex API
// ============================================

const OPENALEX_API = 'https://api.openalex.org';

const searchPapers = async (query: string): Promise<SearchResult> => {
  const params = new URLSearchParams({
    search: query,
    per_page: '20',
    mailto: 'research@msdrills.com',
  });

  const response = await fetch(`${OPENALEX_API}/works?${params}`);
  const data = await response.json();

  return {
    papers: (data.results || []).map(parseWork),
    total: data.meta?.count || 0,
  };
};

const getPaperById = async (id: string): Promise<Paper | null> => {
  try {
    // Handle different ID formats
    let openAlexId = id;
    if (id.startsWith('10.')) {
      // It's a DOI
      openAlexId = `https://doi.org/${id}`;
    } else if (!id.startsWith('W') && !id.startsWith('https://')) {
      // Assume it's an OpenAlex ID without prefix
      openAlexId = `W${id}`;
    }

    const response = await fetch(`${OPENALEX_API}/works/${encodeURIComponent(openAlexId)}?mailto=research@msdrills.com`);
    if (!response.ok) return null;
    const data = await response.json();
    return parseWork(data);
  } catch {
    return null;
  }
};

const getCitations = async (paperId: string, direction: 'forward' | 'backward', cursor?: string): Promise<SearchResult> => {
  const params = new URLSearchParams({
    per_page: '25',
    mailto: 'research@msdrills.com',
  });

  if (direction === 'forward') {
    // Papers that cite this one
    params.set('filter', `cites:${paperId}`);
    params.set('sort', 'cited_by_count:desc');
  } else {
    // Papers this one cites (references)
    params.set('filter', `cited_by:${paperId}`);
    params.set('sort', 'publication_date:desc');
  }

  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await fetch(`${OPENALEX_API}/works?${params}`);
  const data = await response.json();

  return {
    papers: (data.results || []).map(parseWork),
    total: data.meta?.count || 0,
    cursor: data.meta?.next_cursor,
  };
};

const parseWork = (work: any): Paper => {
  const authorships = work.authorships || [];
  const authors = authorships.slice(0, 5).map((a: any) =>
    a.author?.display_name || 'Unknown'
  );
  if (authorships.length > 5) {
    authors.push(`+${authorships.length - 5} more`);
  }

  return {
    id: work.id?.replace('https://openalex.org/', '') || '',
    title: work.title || 'Untitled',
    authors,
    year: work.publication_year || 0,
    journal: work.primary_location?.source?.display_name || 'Unknown',
    doi: work.doi?.replace('https://doi.org/', '') || '',
    citationCount: work.cited_by_count || 0,
    referencesCount: work.referenced_works_count || 0,
    isOpenAccess: work.open_access?.is_oa || false,
    abstract: work.abstract_inverted_index
      ? reconstructAbstract(work.abstract_inverted_index)
      : undefined,
  };
};

const reconstructAbstract = (invertedIndex: Record<string, number[]>): string => {
  if (!invertedIndex) return '';
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ').slice(0, 300) + '...';
};

// ============================================
// Main Component
// ============================================

const CitationChainingTool: React.FC = () => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [seedPaper, setSeedPaper] = useState<Paper | null>(null);
  const [forwardCitations, setForwardCitations] = useState<Paper[]>([]);
  const [backwardCitations, setBackwardCitations] = useState<Paper[]>([]);
  const [forwardTotal, setForwardTotal] = useState(0);
  const [backwardTotal, setBackwardTotal] = useState(0);
  const [isLoadingForward, setIsLoadingForward] = useState(false);
  const [isLoadingBackward, setIsLoadingBackward] = useState(false);
  const [forwardCursor, setForwardCursor] = useState<string | undefined>();
  const [backwardCursor, setBackwardCursor] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'forward' | 'backward'>('forward');
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'search' | 'chain'>('search');
  const [chainHistory, setChainHistory] = useState<Paper[]>([]);

  // Search for papers
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Check if it's a DOI
      if (searchQuery.includes('10.') || searchQuery.startsWith('doi:')) {
        const doi = searchQuery.replace('doi:', '').trim();
        const paper = await getPaperById(doi);
        if (paper) {
          setSearchResults([paper]);
        } else {
          // Fall back to regular search
          const result = await searchPapers(searchQuery);
          setSearchResults(result.papers);
        }
      } else {
        const result = await searchPapers(searchQuery);
        setSearchResults(result.papers);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
    setIsSearching(false);
  }, [searchQuery]);

  // Select seed paper and load citations
  const selectSeedPaper = useCallback(async (paper: Paper) => {
    setSeedPaper(paper);
    setForwardCitations([]);
    setBackwardCitations([]);
    setSelectedPapers(new Set());
    setChainHistory([paper]);
    setViewMode('chain');

    // Load forward citations
    setIsLoadingForward(true);
    try {
      const result = await getCitations(paper.id, 'forward');
      setForwardCitations(result.papers);
      setForwardTotal(result.total);
      setForwardCursor(result.cursor);
    } catch (error) {
      console.error('Error loading forward citations:', error);
    }
    setIsLoadingForward(false);

    // Load backward citations
    setIsLoadingBackward(true);
    try {
      const result = await getCitations(paper.id, 'backward');
      setBackwardCitations(result.papers);
      setBackwardTotal(result.total);
      setBackwardCursor(result.cursor);
    } catch (error) {
      console.error('Error loading backward citations:', error);
    }
    setIsLoadingBackward(false);
  }, []);

  // Load more citations
  const loadMoreForward = useCallback(async () => {
    if (!seedPaper || !forwardCursor) return;

    setIsLoadingForward(true);
    try {
      const result = await getCitations(seedPaper.id, 'forward', forwardCursor);
      setForwardCitations(prev => [...prev, ...result.papers]);
      setForwardCursor(result.cursor);
    } catch (error) {
      console.error('Error loading more forward citations:', error);
    }
    setIsLoadingForward(false);
  }, [seedPaper, forwardCursor]);

  const loadMoreBackward = useCallback(async () => {
    if (!seedPaper || !backwardCursor) return;

    setIsLoadingBackward(true);
    try {
      const result = await getCitations(seedPaper.id, 'backward', backwardCursor);
      setBackwardCitations(prev => [...prev, ...result.papers]);
      setBackwardCursor(result.cursor);
    } catch (error) {
      console.error('Error loading more backward citations:', error);
    }
    setIsLoadingBackward(false);
  }, [seedPaper, backwardCursor]);

  // Chain to another paper (snowball)
  const chainToPaper = useCallback((paper: Paper) => {
    setChainHistory(prev => [...prev, paper]);
    selectSeedPaper(paper);
  }, [selectSeedPaper]);

  // Go back in chain
  const goBackInChain = useCallback((index: number) => {
    const paper = chainHistory[index];
    setChainHistory(prev => prev.slice(0, index + 1));
    selectSeedPaper(paper);
  }, [chainHistory, selectSeedPaper]);

  // Toggle paper selection
  const togglePaperSelection = useCallback((paperId: string) => {
    setSelectedPapers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paperId)) {
        newSet.delete(paperId);
      } else {
        newSet.add(paperId);
      }
      return newSet;
    });
  }, []);

  // Export selected papers
  const exportSelected = useCallback(() => {
    const allPapers = [...forwardCitations, ...backwardCitations];
    const selected = allPapers.filter(p => selectedPapers.has(p.id));

    if (selected.length === 0) {
      alert('No papers selected');
      return;
    }

    const csv = [
      'title,authors,year,journal,doi,citations,direction',
      ...selected.map(p => {
        const direction = forwardCitations.find(f => f.id === p.id) ? 'forward' : 'backward';
        return `"${p.title}","${p.authors.join('; ')}",${p.year},"${p.journal}",${p.doi},${p.citationCount},${direction}`;
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citations_${seedPaper?.title.slice(0, 30).replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedPapers, forwardCitations, backwardCitations, seedPaper]);

  // Export all citations
  const exportAll = useCallback((direction: 'forward' | 'backward' | 'both') => {
    let papers: Paper[] = [];
    if (direction === 'forward' || direction === 'both') {
      papers = [...papers, ...forwardCitations.map(p => ({ ...p, _direction: 'forward' }))];
    }
    if (direction === 'backward' || direction === 'both') {
      papers = [...papers, ...backwardCitations.map(p => ({ ...p, _direction: 'backward' }))];
    }

    const csv = [
      'title,authors,year,journal,doi,citations,direction',
      ...papers.map((p: any) =>
        `"${p.title}","${p.authors.join('; ')}",${p.year},"${p.journal}",${p.doi},${p.citationCount},${p._direction || direction}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_citations_${direction}_${seedPaper?.title.slice(0, 30).replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [forwardCitations, backwardCitations, seedPaper]);

  // Render paper card
  const renderPaperCard = (paper: Paper, direction: 'forward' | 'backward') => {
    const isSelected = selectedPapers.has(paper.id);

    return (
      <div
        key={paper.id}
        className={`p-4 rounded-lg border transition-all ${isSelected
          ? 'bg-cyan-500/10 border-cyan-500/50'
          : 'bg-slate-900/30 border-slate-700/50 hover:border-slate-600'
          }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => togglePaperSelection(paper.id)}
            className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {paper.isOpenAccess && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                  OA
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs ${direction === 'forward'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-purple-500/20 text-purple-400'
                }`}>
                {direction === 'forward' ? 'Cites this' : 'Cited by this'}
              </span>
            </div>
            <h4
              className="text-white font-medium leading-snug cursor-pointer hover:text-cyan-400"
              onClick={() => chainToPaper(paper)}
            >
              {paper.title}
            </h4>
            <p className="text-sm text-slate-400 mt-1">
              {paper.authors.join(', ')}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span>{paper.journal}</span>
              <span>{paper.year}</span>
              <span>{paper.citationCount} citations</span>
              <span>{paper.referencesCount} refs</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {paper.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300"
              >
                View
              </a>
            )}
            <button
              onClick={() => chainToPaper(paper)}
              className="px-3 py-1 bg-cyan-600/50 hover:bg-cyan-500 rounded text-xs text-white"
              title="Explore citations of this paper"
            >
              Chain →
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Header */}
      <nav className="border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/research" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MS</span>
              </div>
              <span className="text-white font-semibold">Homepage</span>
            </a>
            <span className="text-slate-500">/</span>
            <span className="text-cyan-400">Citation Chaining</span>
          </div>
          <a href="/research" className="text-slate-400 hover:text-white text-sm">
            ← All Tools
          </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Search view */}
        {viewMode === 'search' && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Citation Chaining</h1>
              <p className="text-slate-400">
                Explore forward and backward citations to find related papers
              </p>
            </div>

            {/* Search box */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Find a seed paper
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter title, keywords, or DOI..."
                  className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white font-medium"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Tip: Paste a DOI directly for exact paper lookup
              </p>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-sm font-medium text-slate-300 mb-4">
                  Select a seed paper ({searchResults.length} results)
                </h3>
                <div className="space-y-3">
                  {searchResults.map(paper => (
                    <div
                      key={paper.id}
                      onClick={() => selectSeedPaper(paper)}
                      className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50 hover:border-cyan-500/50 cursor-pointer transition-all"
                    >
                      <h4 className="text-white font-medium">{paper.title}</h4>
                      <p className="text-sm text-slate-400 mt-1">
                        {paper.authors.join(', ')}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>{paper.journal}</span>
                        <span>{paper.year}</span>
                        <span className="text-cyan-400">{paper.citationCount} citations</span>
                        <span className="text-purple-400">{paper.referencesCount} refs</span>
                        {paper.isOpenAccess && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">OA</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isSearching && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-8 text-slate-500">
                No papers found. Try different keywords.
              </div>
            )}

            {/* Explanation */}
            {searchResults.length === 0 && !searchQuery && (
              <div className="bg-slate-800/20 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">🔗</div>
                <h3 className="text-lg font-medium text-white mb-2">How Citation Chaining Works</h3>
                <div className="text-sm text-slate-400 max-w-lg mx-auto space-y-2">
                  <p><strong className="text-blue-400">Forward citations</strong> = Papers that cite your seed paper (newer work building on it)</p>
                  <p><strong className="text-purple-400">Backward citations</strong> = Papers your seed paper cites (foundational work)</p>
                  <p className="text-slate-500 mt-4">
                    Chain through citations to discover related literature systematically.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chain view */}
        {viewMode === 'chain' && seedPaper && (
          <>
            {/* Breadcrumb chain */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => {
                  setViewMode('search');
                  setSeedPaper(null);
                }}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 flex-shrink-0"
              >
                ← New Search
              </button>
              {chainHistory.map((paper, idx) => (
                <React.Fragment key={paper.id}>
                  <span className="text-slate-600">→</span>
                  <button
                    onClick={() => goBackInChain(idx)}
                    className={`px-3 py-1 rounded text-sm truncate max-w-[200px] ${idx === chainHistory.length - 1
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    title={paper.title}
                  >
                    {paper.title.length > 30 ? paper.title.slice(0, 30) + '...' : paper.title}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Seed paper info */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-white">{seedPaper.title}</h2>
                  <p className="text-sm text-slate-400 mt-1">{seedPaper.authors.join(', ')}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-slate-500">{seedPaper.journal} ({seedPaper.year})</span>
                    {seedPaper.doi && (
                      <a
                        href={`https://doi.org/${seedPaper.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline"
                      >
                        DOI
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-400">{forwardTotal}</div>
                    <div className="text-xs text-slate-500">Forward</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-400">{backwardTotal}</div>
                    <div className="text-xs text-slate-500">Backward</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs and actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('forward')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'forward'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'bg-slate-700 text-slate-300'
                    }`}
                >
                  Forward ({forwardCitations.length}/{forwardTotal})
                </button>
                <button
                  onClick={() => setActiveTab('backward')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'backward'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-slate-700 text-slate-300'
                    }`}
                >
                  Backward ({backwardCitations.length}/{backwardTotal})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedPapers.size > 0 && (
                  <button
                    onClick={exportSelected}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white"
                  >
                    Export Selected ({selectedPapers.size})
                  </button>
                )}
                <button
                  onClick={() => exportAll(activeTab)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
                >
                  Export All {activeTab === 'forward' ? 'Forward' : 'Backward'}
                </button>
              </div>
            </div>

            {/* Citation lists */}
            {activeTab === 'forward' && (
              <div className="space-y-3">
                {isLoadingForward && forwardCitations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-slate-400 text-sm">Loading forward citations...</p>
                  </div>
                ) : forwardCitations.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No forward citations found
                  </div>
                ) : (
                  <>
                    {forwardCitations.map(paper => renderPaperCard(paper, 'forward'))}

                    {forwardCursor && (
                      <button
                        onClick={loadMoreForward}
                        disabled={isLoadingForward}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm"
                      >
                        {isLoadingForward ? 'Loading...' : `Load more (${forwardCitations.length}/${forwardTotal})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'backward' && (
              <div className="space-y-3">
                {isLoadingBackward && backwardCitations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-slate-400 text-sm">Loading backward citations...</p>
                  </div>
                ) : backwardCitations.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No backward citations found
                  </div>
                ) : (
                  <>
                    {backwardCitations.map(paper => renderPaperCard(paper, 'backward'))}

                    {backwardCursor && (
                      <button
                        onClick={loadMoreBackward}
                        disabled={isLoadingBackward}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm"
                      >
                        {isLoadingBackward ? 'Loading...' : `Load more (${backwardCitations.length}/${backwardTotal})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CitationChainingTool;
