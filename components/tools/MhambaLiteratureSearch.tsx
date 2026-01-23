'use client';

import React, { useState, useCallback } from 'react';
import { Search, Download, Filter, Star, BookOpen, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// API endpoint
const API_BASE = 'https://msdrills-research-api.fauwadwali.workers.dev';

// Types
interface MhambaPaper {
    doi?: string;
    title: string;
    abstract?: string;
    authors: { name: string; affiliation?: string }[];
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
}

interface SourceResult {
    source: string;
    count: number;
    totalAvailable: number;
    searchTime: number;
    error?: string;
}

interface SearchResponse {
    query: string;
    sources: string[];
    results: {
        papers: MhambaPaper[];
        totalUnique: number;
        totalFound: number;
        duplicatesRemoved: number;
    };
    perSource: SourceResult[];
    stats: {
        totalFound: number;
        duplicatesRemoved: number;
        uniqueCount: number;
        bySource: Record<string, number>;
        totalSearchTime: number;
    };
}

// Available sources for MHA/MBA
const SOURCES = [
    { id: 'openalex', name: 'OpenAlex', papers: '250M', color: 'green', type: 'api' },
    { id: 'crossref', name: 'Crossref', papers: '140M', color: 'blue', type: 'api' },
    { id: 'semantic_scholar', name: 'Semantic Scholar', papers: '200M', color: 'purple', type: 'api' },
    { id: 'core', name: 'CORE', papers: '200M', color: 'orange', type: 'api' },
    { id: 'doaj', name: 'DOAJ', papers: '18K+ Journals', color: 'indigo', type: 'api' },
    { id: 'arxiv_econ', name: 'arXiv Economics', papers: '50K+', color: 'pink', type: 'api' },
    { id: 'repec', name: 'RePEc', papers: '3.9M+', color: 'cyan', type: 'api' },
    { id: 'base', name: 'BASE', papers: '350M', color: 'amber', type: 'api' },
    { id: 'google_scholar', name: 'Google Scholar', papers: 'Broad', color: 'red', type: 'scraper', apify: true },
    { id: 'ssrn', name: 'SSRN', papers: '1M+', color: 'teal', type: 'scraper', apify: true },
];

// Journal tier labels
const TIER_LABELS: Record<number, { label: string; color: string; desc: string }> = {
    1: { label: 'Elite', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', desc: 'ABS 4*/ABDC A*/FT50' },
    2: { label: 'Top Field', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', desc: 'ABS 4/ABDC A*' },
    3: { label: 'High Quality', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', desc: 'ABS 3/ABDC A' },
    4: { label: 'Good', color: 'bg-green-500/20 text-green-400 border-green-500/30', desc: 'ABS 2/ABDC B' },
    5: { label: 'Emerging', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', desc: 'ABS 1/ABDC C' },
};

interface MhambaLiteratureSearchProps {
    projectId?: string;
    userId?: string;
    onSavePapers?: (papers: MhambaPaper[]) => Promise<void>;
}

export default function MhambaLiteratureSearch({ projectId, userId, onSavePapers }: MhambaLiteratureSearchProps) {
    const [query, setQuery] = useState('');
    const [selectedSources, setSelectedSources] = useState<string[]>(['openalex', 'crossref', 'semantic_scholar']);
    const [maxResults, setMaxResults] = useState(100);
    const [minTier, setMinTier] = useState<number | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedPaper, setExpandedPaper] = useState<string | null>(null);
    const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'tier' | 'citations' | 'year'>('tier');

    const handleSearch = useCallback(async () => {
        if (!query.trim()) {
            setError('Please enter a search query');
            return;
        }
        if (selectedSources.length === 0) {
            setError('Please select at least one source');
            return;
        }

        setIsSearching(true);
        setError(null);
        setSearchResponse(null);
        setSelectedPapers(new Set());

        try {
            const response = await fetch(`${API_BASE}/mhamba/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query.trim(),
                    sources: selectedSources,
                    maxResults,
                    minJournalTier: minTier,
                    projectId,
                    userId
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json() as SearchResponse;
            setSearchResponse(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearching(false);
        }
    }, [query, selectedSources, maxResults, minTier, projectId, userId]);

    const handleExport = async (format: 'csv' | 'ris' | 'bibtex') => {
        if (!searchResponse?.results.papers) return;

        const papersToExport = selectedPapers.size > 0
            ? searchResponse.results.papers.filter(p => selectedPapers.has(p.doi || p.title))
            : searchResponse.results.papers;

        try {
            const response = await fetch(`${API_BASE}/mhamba/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    papers: papersToExport,
                    format,
                    filter: minTier ? { minTier } : undefined
                })
            });

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mhamba_papers.${format === 'bibtex' ? 'bib' : format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('Export failed');
        }
    };

    const handleSaveSelected = async () => {
        if (!onSavePapers || !searchResponse) return;
        const papersToSave = selectedPapers.size > 0
            ? searchResponse.results.papers.filter(p => selectedPapers.has(p.doi || p.title))
            : searchResponse.results.papers;
        await onSavePapers(papersToSave);
    };

    const toggleSource = (sourceId: string) => {
        setSelectedSources(prev =>
            prev.includes(sourceId)
                ? prev.filter(id => id !== sourceId)
                : [...prev, sourceId]
        );
    };

    const togglePaperSelection = (paper: MhambaPaper) => {
        const key = paper.doi || paper.title;
        setSelectedPapers(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const selectAllPapers = () => {
        if (!searchResponse) return;
        if (selectedPapers.size === searchResponse.results.papers.length) {
            setSelectedPapers(new Set());
        } else {
            setSelectedPapers(new Set(searchResponse.results.papers.map(p => p.doi || p.title)));
        }
    };

    const getSourceColor = (source: string): string => {
        const colors: Record<string, string> = {
            openalex: 'bg-green-500/20 text-green-400 border-green-500/30',
            crossref: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            semantic_scholar: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            core: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            google_scholar: 'bg-red-500/20 text-red-400 border-red-500/30',
            ssrn: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
        };
        return colors[source] || colors.openalex;
    };

    const sortedPapers = searchResponse?.results.papers.slice().sort((a, b) => {
        if (sortBy === 'tier') {
            const tierA = a.journal_tier || 6;
            const tierB = b.journal_tier || 6;
            if (tierA !== tierB) return tierA - tierB;
            return (b.citation_count || 0) - (a.citation_count || 0);
        } else if (sortBy === 'citations') {
            return (b.citation_count || 0) - (a.citation_count || 0);
        } else {
            return (b.year || 0) - (a.year || 0);
        }
    });

    return (
        <div className="space-y-6">
            {/* Search Box */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                <div className="flex flex-col gap-4">
                    {/* Query Input */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search business & management literature..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                        />
                    </div>

                    {/* Source Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400">Sources</span>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                                <Filter className="w-4 h-4" />
                                {showFilters ? 'Hide Filters' : 'Show Filters'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {SOURCES.map(source => (
                                <button
                                    key={source.id}
                                    onClick={() => toggleSource(source.id)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                        selectedSources.includes(source.id)
                                            ? getSourceColor(source.id)
                                            : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    {source.name}
                                    {source.apify && <span className="ml-1 text-xs opacity-60">*</span>}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">* Requires Apify API key</p>
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Max Results per Source</label>
                                <select
                                    value={maxResults}
                                    onChange={(e) => setMaxResults(parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Minimum Journal Tier</label>
                                <select
                                    value={minTier || ''}
                                    onChange={(e) => setMinTier(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                >
                                    <option value="">All Journals</option>
                                    <option value={1}>Tier 1 - Elite (4*/A*/FT50)</option>
                                    <option value={2}>Tier 2+ - Top Field</option>
                                    <option value={3}>Tier 3+ - High Quality</option>
                                    <option value={4}>Tier 4+ - Good</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Sort Results By</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                >
                                    <option value="tier">Journal Tier</option>
                                    <option value="citations">Citations</option>
                                    <option value="year">Year (Newest)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Search Button */}
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isSearching ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Searching...
                            </>
                        ) : (
                            <>
                                <Search className="w-5 h-5" />
                                Search Literature
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Results */}
            {searchResponse && (
                <div className="space-y-4">
                    {/* Stats Bar */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-1">Search Results</h2>
                                <p className="text-sm text-slate-400">
                                    Found {searchResponse.stats.totalFound.toLocaleString()} papers,
                                    {' '}{searchResponse.stats.duplicatesRemoved.toLocaleString()} duplicates removed,
                                    {' '}<span className="text-purple-400 font-medium">{searchResponse.stats.uniqueCount.toLocaleString()} unique</span>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleExport('csv')}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    CSV
                                </button>
                                <button
                                    onClick={() => handleExport('ris')}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    RIS
                                </button>
                                <button
                                    onClick={() => handleExport('bibtex')}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    BibTeX
                                </button>
                                {onSavePapers && (
                                    <button
                                        onClick={handleSaveSelected}
                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <BookOpen className="w-4 h-4" />
                                        Save {selectedPapers.size > 0 ? `(${selectedPapers.size})` : 'All'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Per-source breakdown */}
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex flex-wrap gap-3">
                                {searchResponse.perSource.map((src) => (
                                    <div
                                        key={src.source}
                                        className={`px-3 py-2 rounded-lg border ${getSourceColor(src.source)}`}
                                    >
                                        <span className="font-medium">{src.source}</span>
                                        <span className="ml-2 opacity-80">
                                            {src.count} / {src.totalAvailable.toLocaleString()}
                                        </span>
                                        <span className="ml-2 text-xs opacity-60">
                                            {src.searchTime}ms
                                        </span>
                                        {src.error && (
                                            <span className="ml-2 text-red-400 text-xs" title={src.error}>!</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tier breakdown */}
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <p className="text-sm text-slate-400 mb-2">By Journal Tier:</p>
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map(tier => {
                                    const count = searchResponse.results.papers.filter(p => p.journal_tier === tier).length;
                                    const unranked = tier === 5 ? searchResponse.results.papers.filter(p => !p.journal_tier).length : 0;
                                    if (count === 0 && unranked === 0) return null;
                                    return (
                                        <div
                                            key={tier}
                                            className={`px-3 py-1.5 rounded-lg border ${TIER_LABELS[tier].color}`}
                                        >
                                            <span className="font-medium">{TIER_LABELS[tier].label}</span>
                                            <span className="ml-2">{count + unranked}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Selection Controls */}
                    {searchResponse.results.papers.length > 0 && (
                        <div className="flex items-center gap-4 px-2">
                            <button
                                onClick={selectAllPapers}
                                className="text-sm text-purple-400 hover:text-purple-300"
                            >
                                {selectedPapers.size === searchResponse.results.papers.length
                                    ? 'Deselect All'
                                    : 'Select All'}
                            </button>
                            {selectedPapers.size > 0 && (
                                <span className="text-sm text-slate-400">
                                    {selectedPapers.size} selected
                                </span>
                            )}
                        </div>
                    )}

                    {/* Papers List */}
                    <div className="space-y-3">
                        {sortedPapers?.map((paper, index) => {
                            const paperKey = paper.doi || paper.title;
                            const isExpanded = expandedPaper === paperKey;
                            const isSelected = selectedPapers.has(paperKey);

                            return (
                                <div
                                    key={paperKey + index}
                                    className={`bg-slate-900 rounded-xl border transition-all ${
                                        isSelected
                                            ? 'border-purple-500/50 bg-purple-500/5'
                                            : 'border-slate-700/50 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="p-4">
                                        <div className="flex items-start gap-3">
                                            {/* Selection checkbox */}
                                            <button
                                                onClick={() => togglePaperSelection(paper)}
                                                className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                                    isSelected
                                                        ? 'bg-purple-600 border-purple-600'
                                                        : 'border-slate-600 hover:border-purple-500'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                {/* Title */}
                                                <h3 className="text-white font-medium mb-1">
                                                    {paper.url ? (
                                                        <a
                                                            href={paper.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:text-purple-400 transition-colors inline-flex items-center gap-1"
                                                        >
                                                            {paper.title}
                                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                        </a>
                                                    ) : (
                                                        paper.title
                                                    )}
                                                </h3>

                                                {/* Authors & Journal */}
                                                <p className="text-sm text-slate-400 mb-2">
                                                    {paper.authors.slice(0, 3).map(a => a.name).join(', ')}
                                                    {paper.authors.length > 3 && ' et al.'}
                                                    {paper.journal && (
                                                        <span className="text-slate-500"> - {paper.journal}</span>
                                                    )}
                                                    {paper.year && <span className="text-slate-500"> ({paper.year})</span>}
                                                </p>

                                                {/* Badges row */}
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    {/* Journal Tier */}
                                                    {paper.journal_tier && TIER_LABELS[paper.journal_tier] && (
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${TIER_LABELS[paper.journal_tier].color}`}>
                                                            <Star className="w-3 h-3 inline mr-1" />
                                                            Tier {paper.journal_tier} - {TIER_LABELS[paper.journal_tier].label}
                                                        </span>
                                                    )}
                                                    {paper.is_ft50 && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                            FT50
                                                        </span>
                                                    )}
                                                    {paper.abs_rating && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                            ABS {paper.abs_rating}
                                                        </span>
                                                    )}
                                                    {paper.abdc_rating && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                                            ABDC {paper.abdc_rating}
                                                        </span>
                                                    )}
                                                    {/* Source badge */}
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSourceColor(paper.source)}`}>
                                                        {paper.source}
                                                    </span>
                                                </div>

                                                {/* Expandable Abstract */}
                                                {paper.abstract && (
                                                    <div>
                                                        <p className={`text-sm text-slate-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                            {paper.abstract}
                                                        </p>
                                                        <button
                                                            onClick={() => setExpandedPaper(isExpanded ? null : paperKey)}
                                                            className="text-xs text-purple-400 hover:text-purple-300 mt-1 flex items-center gap-1"
                                                        >
                                                            {isExpanded ? (
                                                                <>
                                                                    <ChevronUp className="w-3 h-3" />
                                                                    Show less
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown className="w-3 h-3" />
                                                                    Show more
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Identifiers & Stats */}
                                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                                                    {paper.doi && (
                                                        <a
                                                            href={`https://doi.org/${paper.doi}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:text-purple-400"
                                                        >
                                                            DOI: {paper.doi}
                                                        </a>
                                                    )}
                                                    {paper.citation_count !== undefined && paper.citation_count > 0 && (
                                                        <span>
                                                            {paper.citation_count.toLocaleString()} citations
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Results summary */}
                    {searchResponse.results.papers.length > 0 && (
                        <div className="text-center text-sm text-slate-500">
                            Showing {searchResponse.results.papers.length} of {searchResponse.stats.uniqueCount} unique papers.
                            Use journal tier filters for focused high-quality results.
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!searchResponse && !isSearching && !error && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Search className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Search Business Literature</h3>
                    <p className="text-slate-400 max-w-md mx-auto mb-4">
                        Search across OpenAlex, Crossref, Semantic Scholar, CORE, Google Scholar, and SSRN.
                        Results are automatically ranked by journal quality (ABS/ABDC/FT50).
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 text-xs">
                        {[1, 2, 3, 4, 5].map(tier => (
                            <span key={tier} className={`px-2 py-1 rounded border ${TIER_LABELS[tier].color}`}>
                                Tier {tier}: {TIER_LABELS[tier].desc}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
