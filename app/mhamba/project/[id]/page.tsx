'use client';

export const runtime = 'edge';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MhambaHeader from '@/components/MhambaHeader';
import MhambaLiteratureSearch from '@/components/tools/MhambaLiteratureSearch';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft, Search, FileText, Star, Download, Trash2,
  Loader2, ChevronDown, ChevronUp, ExternalLink, Filter
} from 'lucide-react';

const API_BASE = 'https://msdrills-research-api.fauwadwali.workers.dev';

interface MhambaPaper {
  id: string;
  doi?: string;
  title: string;
  abstract?: string;
  authors: { name: string }[] | string;
  journal?: string;
  year?: number;
  url?: string;
  source: string;
  citation_count?: number;
  journal_tier?: number;
  abs_rating?: string;
  abdc_rating?: string;
  is_ft50?: boolean;
  created_at: string;
}

interface SearchRun {
  id: string;
  query: string;
  sources_used: string[];
  total_results: number;
  unique_results: number;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Elite', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  2: { label: 'Top Field', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  3: { label: 'High Quality', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  4: { label: 'Good', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  5: { label: 'Emerging', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

export default function MhambaProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [papers, setPapers] = useState<MhambaPaper[]>([]);
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [stats, setStats] = useState<{ totalPapers: number; byTier: Record<number, number>; bySource: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'papers' | 'search' | 'history'>('papers');
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'tier' | 'citations'>('date');

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/mhamba/projects/${projectId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Project not found');
        throw new Error('Failed to fetch project');
      }

      const data = await response.json();
      setProject(data.project);
      setPapers(data.papers || []);
      setSearchRuns(data.searchRuns || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePapers = useCallback(async (newPapers: any[]) => {
    if (!user || !projectId) return;

    try {
      const response = await fetch(`${API_BASE}/mhamba/projects/${projectId}/papers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: newPapers,
          userId: user.id
        })
      });

      if (!response.ok) throw new Error('Failed to save papers');

      // Refresh project data
      await fetchProject();
      setActiveTab('papers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save papers');
    }
  }, [user, projectId]);

  const handleDeletePapers = async () => {
    if (selectedPapers.size === 0) return;

    if (!confirm(`Delete ${selectedPapers.size} selected paper(s)?`)) return;

    try {
      const response = await fetch(`${API_BASE}/mhamba/projects/${projectId}/papers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: Array.from(selectedPapers)
        })
      });

      if (!response.ok) throw new Error('Failed to delete papers');

      setPapers(prev => prev.filter(p => !selectedPapers.has(p.id)));
      setSelectedPapers(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete papers');
    }
  };

  const handleExport = async (format: 'csv' | 'ris' | 'bibtex') => {
    try {
      const papersToExport = selectedPapers.size > 0
        ? papers.filter(p => selectedPapers.has(p.id))
        : papers;

      const response = await fetch(`${API_BASE}/mhamba/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: papersToExport,
          format
        })
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'papers'}.${format === 'bibtex' ? 'bib' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    }
  };

  const togglePaperSelection = (paperId: string) => {
    setSelectedPapers(prev => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  };

  const selectAllPapers = () => {
    if (selectedPapers.size === filteredPapers.length) {
      setSelectedPapers(new Set());
    } else {
      setSelectedPapers(new Set(filteredPapers.map(p => p.id)));
    }
  };

  const parseAuthors = (authors: any): { name: string }[] => {
    if (typeof authors === 'string') {
      try {
        return JSON.parse(authors);
      } catch {
        return [{ name: authors }];
      }
    }
    return authors || [];
  };

  const filteredPapers = papers
    .filter(p => !tierFilter || p.journal_tier === tierFilter)
    .sort((a, b) => {
      if (sortBy === 'tier') {
        return (a.journal_tier || 6) - (b.journal_tier || 6);
      } else if (sortBy === 'citations') {
        return (b.citation_count || 0) - (a.citation_count || 0);
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950">
        <MhambaHeader currentPage="Project" />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Link
              href="/mhamba/dashboard"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <MhambaHeader currentPage={project?.name || 'Project'} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Back link & Project Header */}
        <div className="mb-6">
          <Link
            href="/mhamba/dashboard"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{project?.name}</h1>
              {project?.description && (
                <p className="text-slate-400">{project.description}</p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats?.totalPapers || 0}</p>
                <p className="text-slate-400">Papers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{searchRuns.length}</p>
                <p className="text-slate-400">Searches</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 mb-6">
          <button
            onClick={() => setActiveTab('papers')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'papers'
                ? 'text-purple-400 border-purple-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Papers ({papers.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'text-purple-400 border-purple-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Search
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'text-purple-400 border-purple-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Search History ({searchRuns.length})
          </button>
        </div>

        {/* Papers Tab */}
        {activeTab === 'papers' && (
          <div className="space-y-4">
            {/* Toolbar */}
            {papers.length > 0 && (
              <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={selectAllPapers}
                      className="text-sm text-purple-400 hover:text-purple-300"
                    >
                      {selectedPapers.size === filteredPapers.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedPapers.size > 0 && (
                      <>
                        <span className="text-sm text-slate-400">{selectedPapers.size} selected</span>
                        <button
                          onClick={handleDeletePapers}
                          className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Tier Filter */}
                    <select
                      value={tierFilter || ''}
                      onChange={(e) => setTierFilter(e.target.value ? parseInt(e.target.value) : null)}
                      className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none"
                    >
                      <option value="">All Tiers</option>
                      {[1, 2, 3, 4, 5].map(t => (
                        <option key={t} value={t}>Tier {t}</option>
                      ))}
                    </select>

                    {/* Sort */}
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white focus:outline-none"
                    >
                      <option value="date">Newest First</option>
                      <option value="tier">By Tier</option>
                      <option value="citations">By Citations</option>
                    </select>

                    {/* Export */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExport('csv')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        CSV
                      </button>
                      <button
                        onClick={() => handleExport('ris')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        RIS
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tier Stats */}
                {stats?.byTier && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    {[1, 2, 3, 4, 5].map(tier => {
                      const count = stats.byTier[tier] || 0;
                      if (count === 0) return null;
                      return (
                        <button
                          key={tier}
                          onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                            tierFilter === tier
                              ? TIER_LABELS[tier].color
                              : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          Tier {tier}: {count}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Papers List */}
            {filteredPapers.length > 0 ? (
              <div className="space-y-3">
                {filteredPapers.map(paper => {
                  const isExpanded = expandedPaper === paper.id;
                  const isSelected = selectedPapers.has(paper.id);
                  const authors = parseAuthors(paper.authors);

                  return (
                    <div
                      key={paper.id}
                      className={`bg-slate-900 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-purple-500/50 bg-purple-500/5'
                          : 'border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => togglePaperSelection(paper.id)}
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
                              ) : paper.title}
                            </h3>

                            {/* Authors & Journal */}
                            <p className="text-sm text-slate-400 mb-2">
                              {authors.slice(0, 3).map(a => a.name).join(', ')}
                              {authors.length > 3 && ' et al.'}
                              {paper.journal && (
                                <span className="text-slate-500"> - {paper.journal}</span>
                              )}
                              {paper.year && <span className="text-slate-500"> ({paper.year})</span>}
                            </p>

                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {paper.journal_tier && TIER_LABELS[paper.journal_tier] && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${TIER_LABELS[paper.journal_tier].color}`}>
                                  <Star className="w-3 h-3 inline mr-1" />
                                  Tier {paper.journal_tier}
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
                            </div>

                            {/* Abstract */}
                            {paper.abstract && (
                              <div>
                                <p className={`text-sm text-slate-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                  {paper.abstract}
                                </p>
                                <button
                                  onClick={() => setExpandedPaper(isExpanded ? null : paper.id)}
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
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No papers yet</h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6">
                  Search for literature and save papers to this project.
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                >
                  <Search className="w-5 h-5" />
                  Search Literature
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <MhambaLiteratureSearch
            projectId={projectId}
            userId={user?.id}
            onSavePapers={handleSavePapers}
          />
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {searchRuns.length > 0 ? (
              searchRuns.map(run => (
                <div
                  key={run.id}
                  className="bg-slate-900 border border-slate-700/50 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-medium mb-1">{run.query}</p>
                      <p className="text-sm text-slate-400">
                        {run.unique_results} unique results from {run.total_results} total
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {run.sources_used.map(source => (
                          <span
                            key={source}
                            className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">
                      {new Date(run.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-12 text-center">
                <p className="text-slate-400">No search history yet.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
