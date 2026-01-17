'use client';
import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  frequency: 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  lastChecked: string | null;
  newResultsCount: number;
  totalResults: number;
  createdAt: string;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  hasFullText?: boolean;
  publicationTypes?: string[];
  sources?: string[];
}

interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi: string;
  abstract: string;
  citationCount: number;
  isOpenAccess: boolean;
  isNew: boolean;
  firstSeen: string;
}

interface AlertResult {
  searchId: string;
  searchName: string;
  results: SearchResult[];
  checkedAt: string;
}

// ============================================
// OpenAlex API
// ============================================

const OPENALEX_API = 'https://api.openalex.org';

const buildOpenAlexQuery = (query: string, filters: SearchFilters, cursor?: string): string => {
  const params = new URLSearchParams();

  // Search query
  params.set('search', query);

  // Filters
  const filterParts: string[] = [];

  if (filters.yearFrom) {
    filterParts.push(`from_publication_date:${filters.yearFrom}-01-01`);
  }
  if (filters.yearTo) {
    filterParts.push(`to_publication_date:${filters.yearTo}-12-31`);
  }
  if (filters.openAccess) {
    filterParts.push('is_oa:true');
  }
  if (filters.publicationTypes?.length) {
    filterParts.push(`type:${filters.publicationTypes.join('|')}`);
  }

  if (filterParts.length > 0) {
    params.set('filter', filterParts.join(','));
  }

  // Sorting by date for monitoring
  params.set('sort', 'publication_date:desc');
  params.set('per_page', '25');

  if (cursor) {
    params.set('cursor', cursor);
  }

  // Polite pool
  params.set('mailto', 'research@msdrills.com');

  return `${OPENALEX_API}/works?${params.toString()}`;
};

const parseOpenAlexResult = (work: any): SearchResult => {
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
    abstract: work.abstract_inverted_index
      ? reconstructAbstract(work.abstract_inverted_index)
      : '',
    citationCount: work.cited_by_count || 0,
    isOpenAccess: work.open_access?.is_oa || false,
    isNew: false,
    firstSeen: new Date().toISOString(),
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
  return words.map(w => w[0]).join(' ').slice(0, 500) + '...';
};

// ============================================
// Main Component
// ============================================

const SearchMonitorTool: React.FC = () => {
  // State
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<SavedSearch | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [seenPapers, setSeenPapers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'alerts' | 'create'>('list');
  const [alerts, setAlerts] = useState<AlertResult[]>([]);

  // New search form
  const [newSearch, setNewSearch] = useState<Partial<SavedSearch>>({
    name: '',
    query: '',
    frequency: 'weekly',
    filters: {},
    notifyEmail: false,
    notifyInApp: true,
  });

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('search_monitor_searches');
    if (stored) {
      setSavedSearches(JSON.parse(stored));
    }

    const storedSeen = localStorage.getItem('search_monitor_seen');
    if (storedSeen) {
      setSeenPapers(new Set(JSON.parse(storedSeen)));
    }

    const storedAlerts = localStorage.getItem('search_monitor_alerts');
    if (storedAlerts) {
      setAlerts(JSON.parse(storedAlerts));
    }
  }, []);

  // Save to localStorage
  const saveSearches = useCallback((searches: SavedSearch[]) => {
    setSavedSearches(searches);
    localStorage.setItem('search_monitor_searches', JSON.stringify(searches));
  }, []);

  const saveSeenPapers = useCallback((seen: Set<string>) => {
    setSeenPapers(seen);
    localStorage.setItem('search_monitor_seen', JSON.stringify([...seen]));
  }, []);

  const saveAlerts = useCallback((newAlerts: AlertResult[]) => {
    setAlerts(newAlerts);
    localStorage.setItem('search_monitor_alerts', JSON.stringify(newAlerts));
  }, []);

  // Create new saved search
  const createSearch = useCallback(async () => {
    if (!newSearch.name || !newSearch.query) return;

    const search: SavedSearch = {
      id: 'search_' + Math.random().toString(36).substring(2, 11),
      name: newSearch.name,
      query: newSearch.query,
      filters: newSearch.filters || {},
      frequency: newSearch.frequency || 'weekly',
      isActive: true,
      lastChecked: null,
      newResultsCount: 0,
      totalResults: 0,
      createdAt: new Date().toISOString(),
      notifyEmail: newSearch.notifyEmail || false,
      notifyInApp: newSearch.notifyInApp || true,
    };

    // Run initial search to get baseline
    setIsLoading(true);
    try {
      const url = buildOpenAlexQuery(search.query, search.filters);
      const response = await fetch(url);
      const data = await response.json();

      search.totalResults = data.meta?.count || 0;
      search.lastChecked = new Date().toISOString();

      // Mark all current results as seen
      const results = (data.results || []).map(parseOpenAlexResult);
      const newSeen = new Set(seenPapers);
      results.forEach((r: SearchResult) => newSeen.add(r.id));
      saveSeenPapers(newSeen);

    } catch (error) {
      console.error('Error running initial search:', error);
    }
    setIsLoading(false);

    saveSearches([...savedSearches, search]);
    setNewSearch({
      name: '',
      query: '',
      frequency: 'weekly',
      filters: {},
      notifyEmail: false,
      notifyInApp: true,
    });
    setViewMode('list');
  }, [newSearch, savedSearches, seenPapers, saveSearches, saveSeenPapers]);

  // Check search for new results
  const checkSearch = useCallback(async (search: SavedSearch) => {
    setIsLoading(true);
    setSelectedSearch(search);

    try {
      const url = buildOpenAlexQuery(search.query, search.filters);
      const response = await fetch(url);
      const data = await response.json();

      const results = (data.results || []).map(parseOpenAlexResult);

      // Mark new papers
      const newResults = results.map((r: SearchResult) => ({
        ...r,
        isNew: !seenPapers.has(r.id),
      }));

      const newCount = newResults.filter((r: SearchResult) => r.isNew).length;

      // Update search
      const updatedSearches = savedSearches.map(s =>
        s.id === search.id
          ? {
            ...s,
            lastChecked: new Date().toISOString(),
            newResultsCount: newCount,
            totalResults: data.meta?.count || 0,
          }
          : s
      );
      saveSearches(updatedSearches);

      setSearchResults(newResults);

      // Create alert if new results
      if (newCount > 0) {
        const alert: AlertResult = {
          searchId: search.id,
          searchName: search.name,
          results: newResults.filter((r: SearchResult) => r.isNew),
          checkedAt: new Date().toISOString(),
        };
        saveAlerts([alert, ...alerts.slice(0, 49)]); // Keep last 50 alerts
      }

    } catch (error) {
      console.error('Error checking search:', error);
    }

    setIsLoading(false);
  }, [savedSearches, seenPapers, alerts, saveSearches, saveAlerts]);

  // Mark results as seen
  const markAsSeen = useCallback((resultIds: string[]) => {
    const newSeen = new Set(seenPapers);
    resultIds.forEach(id => newSeen.add(id));
    saveSeenPapers(newSeen);

    // Update search results display
    setSearchResults(prev => prev.map(r => ({
      ...r,
      isNew: !newSeen.has(r.id),
    })));

    // Update search new count
    if (selectedSearch) {
      const updatedSearches = savedSearches.map(s =>
        s.id === selectedSearch.id
          ? { ...s, newResultsCount: Math.max(0, s.newResultsCount - resultIds.length) }
          : s
      );
      saveSearches(updatedSearches);
    }
  }, [seenPapers, selectedSearch, savedSearches, saveSeenPapers, saveSearches]);

  // Delete search
  const deleteSearch = useCallback((searchId: string) => {
    if (!confirm('Delete this saved search?')) return;
    saveSearches(savedSearches.filter(s => s.id !== searchId));
    if (selectedSearch?.id === searchId) {
      setSelectedSearch(null);
      setSearchResults([]);
    }
  }, [savedSearches, selectedSearch, saveSearches]);

  // Toggle search active state
  const toggleSearchActive = useCallback((searchId: string) => {
    const updatedSearches = savedSearches.map(s =>
      s.id === searchId ? { ...s, isActive: !s.isActive } : s
    );
    saveSearches(updatedSearches);
  }, [savedSearches, saveSearches]);

  // Check all active searches
  const checkAllSearches = useCallback(async () => {
    const activeSearches = savedSearches.filter(s => s.isActive);
    for (const search of activeSearches) {
      await checkSearch(search);
    }
  }, [savedSearches, checkSearch]);

  // Format relative time
  const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get total new results across all searches
  const totalNewResults = savedSearches.reduce((sum, s) => sum + s.newResultsCount, 0);

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
            <span className="text-cyan-400">Search Monitor</span>
          </div>
          <div className="flex items-center gap-4">
            {totalNewResults > 0 && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                {totalNewResults} new
              </span>
            )}
            <a href="/research" className="text-slate-400 hover:text-white text-sm">
              ← All Tools
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* View tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list'
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
            >
              Saved Searches
            </button>
            <button
              onClick={() => setViewMode('alerts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${viewMode === 'alerts'
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
            >
              Alerts
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-xs text-white flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('create')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'create'
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
            >
              + New Search
            </button>
          </div>

          {viewMode === 'list' && savedSearches.length > 0 && (
            <button
              onClick={checkAllSearches}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white text-sm"
            >
              {isLoading ? 'Checking...' : 'Check All Now'}
            </button>
          )}
        </div>

        {/* Create new search */}
        {viewMode === 'create' && (
          <div className="max-w-2xl">
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
              <h2 className="text-lg font-medium text-white mb-4">Create New Search Monitor</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Search Name *
                  </label>
                  <input
                    type="text"
                    value={newSearch.name || ''}
                    onChange={(e) => setNewSearch(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., CRISPR gene therapy"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Search Query *
                  </label>
                  <textarea
                    value={newSearch.query || ''}
                    onChange={(e) => setNewSearch(prev => ({ ...prev, query: e.target.value }))}
                    placeholder="Enter keywords, phrases, or Boolean query..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Supports: AND, OR, NOT, phrases in quotes
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Year From
                    </label>
                    <input
                      type="number"
                      value={newSearch.filters?.yearFrom || ''}
                      onChange={(e) => setNewSearch(prev => ({
                        ...prev,
                        filters: { ...prev.filters, yearFrom: parseInt(e.target.value) || undefined }
                      }))}
                      placeholder="e.g., 2020"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Year To
                    </label>
                    <input
                      type="number"
                      value={newSearch.filters?.yearTo || ''}
                      onChange={(e) => setNewSearch(prev => ({
                        ...prev,
                        filters: { ...prev.filters, yearTo: parseInt(e.target.value) || undefined }
                      }))}
                      placeholder="e.g., 2024"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Check Frequency
                  </label>
                  <select
                    value={newSearch.frequency}
                    onChange={(e) => setNewSearch(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSearch.filters?.openAccess || false}
                      onChange={(e) => setNewSearch(prev => ({
                        ...prev,
                        filters: { ...prev.filters, openAccess: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                    />
                    <span className="text-sm text-slate-300">Open Access only</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSearch.notifyInApp || false}
                      onChange={(e) => setNewSearch(prev => ({ ...prev, notifyInApp: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                    />
                    <span className="text-sm text-slate-300">In-app notifications</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setViewMode('list')}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createSearch}
                    disabled={!newSearch.name || !newSearch.query || isLoading}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-white text-sm"
                  >
                    {isLoading ? 'Creating...' : 'Create Monitor'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved searches list */}
        {viewMode === 'list' && (
          <div className="flex gap-6">
            {/* Searches sidebar */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  Saved Searches ({savedSearches.length})
                </h3>

                {savedSearches.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 text-sm mb-3">No saved searches yet</p>
                    <button
                      onClick={() => setViewMode('create')}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm"
                    >
                      Create First Search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedSearches.map(search => (
                      <div
                        key={search.id}
                        onClick={() => checkSearch(search)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${selectedSearch?.id === search.id
                          ? 'bg-cyan-500/20 border border-cyan-500/50'
                          : 'bg-slate-900/30 hover:bg-slate-800/50 border border-transparent'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium truncate ${selectedSearch?.id === search.id ? 'text-white' : 'text-slate-300'
                            }`}>
                            {search.name}
                          </span>
                          {search.newResultsCount > 0 && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">
                              {search.newResultsCount} new
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{search.totalResults.toLocaleString()} total</span>
                          <span>{formatRelativeTime(search.lastChecked)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSearchActive(search.id);
                            }}
                            className={`px-2 py-0.5 rounded text-xs ${search.isActive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-700 text-slate-500'
                              }`}
                          >
                            {search.isActive ? 'Active' : 'Paused'}
                          </button>
                          <span className="text-xs text-slate-600">{search.frequency}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSearch(search.id);
                            }}
                            className="ml-auto text-slate-600 hover:text-red-400 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Results area */}
            <div className="flex-1 min-w-0">
              {selectedSearch ? (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white">{selectedSearch.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Query: {selectedSearch.query}
                      </p>
                    </div>
                    {searchResults.some(r => r.isNew) && (
                      <button
                        onClick={() => markAsSeen(searchResults.filter(r => r.isNew).map(r => r.id))}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-slate-400 text-sm">Checking for new papers...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      No results found. Try adjusting your search query.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map(result => (
                        <div
                          key={result.id}
                          className={`p-4 rounded-lg border ${result.isNew
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-slate-900/30 border-slate-700/50'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {result.isNew && (
                                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                                    NEW
                                  </span>
                                )}
                                {result.isOpenAccess && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                                    OA
                                  </span>
                                )}
                              </div>
                              <h4 className="text-white font-medium leading-snug">
                                {result.title}
                              </h4>
                              <p className="text-sm text-slate-400 mt-1">
                                {result.authors.join(', ')}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                <span>{result.journal}</span>
                                <span>{result.year}</span>
                                <span>{result.citationCount} citations</span>
                              </div>
                              {result.abstract && (
                                <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                                  {result.abstract}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              {result.doi && (
                                <a
                                  href={`https://doi.org/${result.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300"
                                >
                                  View
                                </a>
                              )}
                              {result.isNew && (
                                <button
                                  onClick={() => markAsSeen([result.id])}
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-400"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
                  <div className="text-4xl mb-3">🔔</div>
                  <h3 className="text-lg font-medium text-white mb-2">Search Monitor</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Create saved searches to automatically track new publications matching your research interests.
                    Select a search from the left to view results.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alerts view */}
        {viewMode === 'alerts' && (
          <div className="max-w-3xl">
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">Recent Alerts</h2>
                {alerts.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all alerts?')) {
                        saveAlerts([]);
                      }
                    }}
                    className="text-sm text-slate-500 hover:text-slate-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-slate-400 text-sm">No new alerts</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Alerts appear when saved searches find new papers
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-900/30 rounded-lg border border-slate-700/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-white font-medium">{alert.searchName}</h4>
                          <p className="text-xs text-slate-500">
                            {formatRelativeTime(alert.checkedAt)} • {alert.results.length} new papers
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const search = savedSearches.find(s => s.id === alert.searchId);
                            if (search) {
                              checkSearch(search);
                              setViewMode('list');
                            }
                          }}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-xs text-white"
                        >
                          View
                        </button>
                      </div>
                      <div className="space-y-2">
                        {alert.results.slice(0, 3).map(result => (
                          <div key={result.id} className="text-sm">
                            <span className="text-slate-300">{result.title}</span>
                            <span className="text-slate-500 ml-2">({result.year})</span>
                          </div>
                        ))}
                        {alert.results.length > 3 && (
                          <p className="text-xs text-slate-500">
                            +{alert.results.length - 3} more papers
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchMonitorTool;
