'use client';

import React, { useState, useCallback } from 'react';
import { LiteratureSearch, SearchFilters } from '@/components/search-enhanced/LiteratureSearch';
import { buildPubMedQuery, buildOpenAlexParams, buildRxivParams } from '@/components/search-enhanced/queryBuilder';

// API endpoint
const API_BASE = 'https://msdrills-research-api.fauwadwali.workers.dev';

// Types
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

interface DatabaseResult {
    database: string;
    count: number;
    totalAvailable: number;
    searchTime: number;
    error?: string;
}

interface SearchResponse {
    query: string;
    results: {
        papers: Paper[];
        totalUnique: number;
        totalFound: number;
        duplicatesRemoved: number;
    };
    perDatabase: DatabaseResult[];
    stats: {
        totalFound: number;
        duplicatesRemoved: number;
        uniqueCount: number;
        bySource: Record<string, number>;
        totalSearchTime: number;
    };
}

// Available databases
const DATABASES = [
    { id: 'pubmed', name: 'PubMed', papers: '35M', color: 'blue' },
    { id: 'openalex', name: 'OpenAlex', papers: '250M', color: 'green' },
    { id: 'semantic_scholar', name: 'Semantic Scholar', papers: '200M', color: 'purple' },
    { id: 'europe_pmc', name: 'Europe PMC', papers: '40M', color: 'teal' },
    { id: 'medrxiv', name: 'medRxiv', papers: '50K+', color: 'orange' },
    { id: 'biorxiv', name: 'bioRxiv', papers: '200K+', color: 'pink' },
];

interface LiteratureSearchToolProps {
    projectId?: string;
    logActivity?: (action: string, details: any) => Promise<void>;
    refreshStats?: () => Promise<void>;
}

export default function LiteratureSearchTool({ projectId, logActivity, refreshStats }: LiteratureSearchToolProps) {
    const [isSearching, setIsSearching] = useState(false);
    const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedPaper, setExpandedPaper] = useState<number | null>(null);

    const handleSearch = useCallback(async (
        query: string,
        filters: SearchFilters,
        databases: string[],
        maxResults: number
    ) => {
        if (!query.trim()) {
            setError('Please enter a search query');
            return;
        }
        if (databases.length === 0) {
            setError('Please select at least one database');
            return;
        }

        setIsSearching(true);
        setError(null);
        setSearchResponse(null);

        try {
            // Build enhanced query with filters
            // For now, we'll send the filters along and let the API handle them
            // The API can use the query builders if needed
            const enhancedQuery = query.trim();
            
            const response = await fetch(`${API_BASE}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: enhancedQuery,
                    databases: databases,
                    maxResults,
                    filters: filters // Send filters to API
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json() as SearchResponse;
            setSearchResponse(data);

            if (projectId && logActivity) {
                await logActivity('search_performed', {
                    query: enhancedQuery,
                    results_count: data.stats.uniqueCount,
                    databases: databases,
                    filters: filters
                });
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsSearching(false);
        }
    }, [projectId, logActivity]);

    const handleExport = async (format: 'ris' | 'csv') => {
        if (!searchResponse?.results.papers) return;

        try {
            const response = await fetch(`${API_BASE}/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    papers: searchResponse.results.papers,
                    format
                })
            });

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `search_results.${format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('Export failed');
        }
    };

    const getSourceColor = (source: string): string => {
        const colors: Record<string, string> = {
            pubmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            openalex: 'bg-green-500/20 text-green-400 border-green-500/30',
            semantic_scholar: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            europe_pmc: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
            medrxiv: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            biorxiv: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        };
        return colors[source] || colors.pubmed;
    };

    return (
        <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-6 space-y-6">
            {/* Enhanced Search Component */}
            <LiteratureSearch
                onSearch={handleSearch}
                isSearching={isSearching}
            />

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Search Results */}
            {searchResponse && (
                <div className="mt-8">
                    {/* Stats Bar */}
                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-1">Search Results</h2>
                                <p className="text-sm text-slate-400">
                                    Found {searchResponse.stats.totalFound.toLocaleString()} papers,
                                    {' '}{searchResponse.stats.duplicatesRemoved.toLocaleString()} duplicates removed,
                                    {' '}<span className="text-violet-400 font-medium">{searchResponse.stats.uniqueCount.toLocaleString()} unique</span>
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleExport('ris')}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export RIS
                                </button>
                                <button
                                    onClick={() => handleExport('csv')}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Per-database breakdown */}
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex flex-wrap gap-3">
                                {searchResponse.perDatabase.map((db) => (
                                    <div
                                        key={db.database}
                                        className={`px-3 py-2 rounded-lg border ${getSourceColor(db.database)}`}
                                    >
                                        <span className="font-medium">{db.database}</span>
                                        <span className="ml-2 opacity-80">
                                            {db.count} / {db.totalAvailable.toLocaleString()}
                                        </span>
                                        <span className="ml-2 text-xs opacity-60">
                                            {db.searchTime}ms
                                        </span>
                                        {db.error && (
                                            <span className="ml-2 text-red-400 text-xs">⚠️</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Papers List */}
                    <div className="space-y-3">
                        {searchResponse.results.papers.map((paper, index) => (
                            <div
                                key={`${paper.doi || paper.pmid || index}`}
                                className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4 hover:border-slate-600 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Title */}
                                        <h3 className="text-white font-medium mb-1 line-clamp-2">
                                            {paper.url ? (
                                                <a
                                                    href={paper.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:text-violet-400 transition-colors"
                                                >
                                                    {paper.title}
                                                </a>
                                            ) : (
                                                paper.title
                                            )}
                                        </h3>

                                        {/* Authors & Journal */}
                                        <p className="text-sm text-slate-400 mb-2">
                                            {paper.authors.slice(0, 3).map(a => a.name).join(', ')}
                                            {paper.authors.length > 3 && ` et al.`}
                                            {paper.journal && ` • ${paper.journal}`}
                                            {paper.year && ` (${paper.year})`}
                                        </p>

                                        {/* Abstract (expandable) */}
                                        {paper.abstract && (
                                            <div className="mb-2">
                                                <p className={`text-sm text-slate-300 ${expandedPaper === index ? '' : 'line-clamp-2'}`}>
                                                    {paper.abstract}
                                                </p>
                                                <button
                                                    onClick={() => setExpandedPaper(expandedPaper === index ? null : index)}
                                                    className="text-xs text-violet-400 hover:text-violet-300 mt-1"
                                                >
                                                    {expandedPaper === index ? 'Show less' : 'Show more'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Identifiers */}
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            {paper.doi && (
                                                <a
                                                    href={`https://doi.org/${paper.doi}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-500 hover:text-violet-400"
                                                >
                                                    DOI: {paper.doi}
                                                </a>
                                            )}
                                            {paper.pmid && (
                                                <a
                                                    href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-500 hover:text-violet-400"
                                                >
                                                    PMID: {paper.pmid}
                                                </a>
                                            )}
                                            {paper.citationCount !== undefined && paper.citationCount > 0 && (
                                                <span className="text-slate-500">
                                                    📚 {paper.citationCount} citations
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Source badge */}
                                    <div className={`px-2 py-1 rounded text-xs font-medium border flex-shrink-0 ${getSourceColor(paper.source)}`}>
                                        {paper.source}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load more hint */}
                    {searchResponse.results.papers.length > 0 && (
                        <div className="text-center mt-6 text-sm text-slate-500">
                            Showing {searchResponse.results.papers.length} of {searchResponse.stats.uniqueCount} unique papers.
                            Export to RIS for use with ASReview or Zotero.
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!searchResponse && !isSearching && !error && (
                <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Search Multiple Databases</h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                        Enter your search query above to search PubMed, OpenAlex, and medRxiv simultaneously.
                        Results are automatically deduplicated and tracked for PRISMA compliance.
                    </p>
                </div>
            )}
        </div>
    );
}
