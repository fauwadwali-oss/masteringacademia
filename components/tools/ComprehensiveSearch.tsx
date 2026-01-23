'use client';

import React, { useState } from 'react';
import { Search, Loader2, Sparkles, BookOpen, Lightbulb, Target, TrendingUp, FileText } from 'lucide-react';

// API endpoint
const API_BASE = 'https://msdrills-research-api.fauwadwali.workers.dev';

// Types
interface Theme {
    title: string;
    description: string;
    paperCount: number;
    keyPapers: string[];
}

interface ResearchGap {
    title: string;
    description: string;
    opportunity: string;
    relatedPapers: string[];
}

interface AnnotatedEntry {
    paper: any;
    annotation: {
        keyFindings: string[];
        methodology: string;
        theoreticalFramework: string;
        relevance: string;
        limitations: string;
    };
}

interface ComprehensiveResult {
    analysis: {
        summary: string;
        keyThemes: Theme[];
        researchGaps: ResearchGap[];
        suggestedQuestions: string[];
        methodologicalInsights: string[];
    };
    annotatedBibliography: AnnotatedEntry[];
    stats: {
        totalPapers: number;
        journalDistribution: Record<string, number>;
        yearDistribution: Record<string, number>;
        avgCitations: number;
        topJournals: Array<{ journal: string; count: number; avgTier: number }>;
    };
}

export default function ComprehensiveSearch() {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<ComprehensiveResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    const handleSearch = async () => {
        if (!query.trim()) {
            setError('Please enter a search query');
            return;
        }

        setIsSearching(true);
        setError(null);
        setResult(null);
        setProgress('Searching databases...');

        try {
            const response = await fetch(`${API_BASE}/mhamba/comprehensive-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    sources: ['openalex', 'crossref', 'semantic_scholar'],
                    maxResults: 100,
                }),
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            setProgress('Analyzing results with AI...');
            const data = await response.json();

            if (data.comprehensive) {
                setResult(data.comprehensive);
                setProgress('');
            } else {
                throw new Error('No comprehensive analysis returned');
            }
        } catch (err: any) {
            console.error('Search error:', err);
            setError(err.message || 'Search failed');
            setProgress('');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                    <h2 className="text-2xl font-bold text-white">AI-Powered Comprehensive Search</h2>
                </div>
                <p className="text-slate-300">
                    Get an intelligent synthesis of the research landscape with key themes, research gaps, and annotated bibliography.
                </p>
            </div>

            {/* Search Box */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                <div className="flex flex-col gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                            placeholder="Enter your research topic (e.g., 'founder conflict in startups')..."
                            className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-lg"
                            disabled={isSearching}
                        />
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={isSearching || !query.trim()}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isSearching ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {progress || 'Searching...'}
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Start Comprehensive Search
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-purple-400" />
                            <h3 className="text-xl font-bold text-white">Research Landscape Summary</h3>
                        </div>
                        <div className="prose prose-invert max-w-none">
                            <p className="text-slate-300 whitespace-pre-wrap">{result.analysis.summary}</p>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-purple-400">{result.stats.totalPapers}</div>
                            <div className="text-sm text-slate-400">Papers Analyzed</div>
                        </div>
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-blue-400">{result.analysis.keyThemes.length}</div>
                            <div className="text-sm text-slate-400">Key Themes</div>
                        </div>
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-green-400">{result.analysis.researchGaps.length}</div>
                            <div className="text-sm text-slate-400">Research Gaps</div>
                        </div>
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-yellow-400">{result.stats.avgCitations}</div>
                            <div className="text-sm text-slate-400">Avg Citations</div>
                        </div>
                    </div>

                    {/* Key Themes */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            <h3 className="text-xl font-bold text-white">Key Themes</h3>
                        </div>
                        <div className="space-y-4">
                            {result.analysis.keyThemes.map((theme, idx) => (
                                <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-white mb-2">{theme.title}</h4>
                                    <p className="text-slate-300 mb-2">{theme.description}</p>
                                    <div className="flex items-center gap-4 text-sm text-slate-400">
                                        <span>{theme.paperCount} papers</span>
                                        {theme.keyPapers.length > 0 && (
                                            <span>Key papers: {theme.keyPapers.slice(0, 2).join(', ')}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Research Gaps */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-green-400" />
                            <h3 className="text-xl font-bold text-white">Research Gaps & Opportunities</h3>
                        </div>
                        <div className="space-y-4">
                            {result.analysis.researchGaps.map((gap, idx) => (
                                <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-white mb-2">{gap.title}</h4>
                                    <p className="text-slate-300 mb-2">{gap.description}</p>
                                    <div className="bg-green-900/20 border border-green-500/30 rounded p-3 mt-2">
                                        <p className="text-sm text-green-300">
                                            <strong>Opportunity:</strong> {gap.opportunity}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suggested Questions */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Lightbulb className="w-5 h-5 text-yellow-400" />
                            <h3 className="text-xl font-bold text-white">Suggested Research Questions</h3>
                        </div>
                        <ul className="space-y-2">
                            {result.analysis.suggestedQuestions.map((question, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-slate-300">
                                    <span className="text-purple-400 font-bold">{idx + 1}.</span>
                                    <span>{question}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Methodological Insights */}
                    {result.analysis.methodologicalInsights.length > 0 && (
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5 text-blue-400" />
                                <h3 className="text-xl font-bold text-white">Methodological Insights</h3>
                            </div>
                            <ul className="space-y-2">
                                {result.analysis.methodologicalInsights.map((insight, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-slate-300">
                                        <span className="text-blue-400">•</span>
                                        <span>{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Annotated Bibliography */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-purple-400" />
                            <h3 className="text-xl font-bold text-white">Annotated Bibliography (Top 10 Papers)</h3>
                        </div>
                        <div className="space-y-6">
                            {result.annotatedBibliography.map((entry, idx) => (
                                <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-white mb-2">{entry.paper.title}</h4>
                                    <p className="text-sm text-slate-400 mb-3">
                                        {Array.isArray(entry.paper.authors) 
                                            ? entry.paper.authors.map((a: any) => a.name).join(', ')
                                            : 'Unknown authors'
                                        } ({entry.paper.year || 'N/A'})
                                    </p>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <h5 className="text-sm font-semibold text-purple-400 mb-1">Key Findings</h5>
                                            <ul className="list-disc list-inside space-y-1">
                                                {entry.annotation.keyFindings.map((finding, fidx) => (
                                                    <li key={fidx} className="text-sm text-slate-300">{finding}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        
                                        <div>
                                            <h5 className="text-sm font-semibold text-blue-400 mb-1">Methodology</h5>
                                            <p className="text-sm text-slate-300">{entry.annotation.methodology}</p>
                                        </div>
                                        
                                        <div>
                                            <h5 className="text-sm font-semibold text-green-400 mb-1">Relevance</h5>
                                            <p className="text-sm text-slate-300">{entry.annotation.relevance}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Journals */}
                    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Top Journals in Results</h3>
                        <div className="space-y-2">
                            {result.stats.topJournals.slice(0, 10).map((journal, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-800/50 rounded p-3">
                                    <span className="text-slate-300">{journal.journal}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-slate-400">{journal.count} papers</span>
                                        {journal.avgTier > 0 && (
                                            <span className="text-sm text-purple-400">Tier {journal.avgTier.toFixed(1)}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
