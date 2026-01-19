'use client';

import React, { useState, useEffect } from 'react';
import MhambaHeader from '@/components/MhambaHeader';
import { Search, Star, Award, Filter, ExternalLink, Loader2 } from 'lucide-react';

const API_BASE = 'https://msdrills-research-api.fauwadwali.workers.dev';

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

const TIER_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: 'Elite', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', desc: 'ABS 4*/ABDC A*/FT50' },
  2: { label: 'Top Field', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', desc: 'ABS 4/ABDC A*' },
  3: { label: 'High Quality', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', desc: 'ABS 3/ABDC A' },
  4: { label: 'Good', color: 'bg-green-500/20 text-green-400 border-green-500/30', desc: 'ABS 2/ABDC B' },
  5: { label: 'Emerging', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', desc: 'ABS 1/ABDC C' },
};

export default function JournalRankingsPage() {
  const [journals, setJournals] = useState<JournalRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [showFT50Only, setShowFT50Only] = useState(false);

  useEffect(() => {
    fetchJournals();
  }, [tierFilter, searchQuery]);

  const fetchJournals = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (tierFilter) params.set('tier', tierFilter.toString());
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '200');

      const response = await fetch(`${API_BASE}/mhamba/journals?${params}`);
      if (!response.ok) throw new Error('Failed to fetch journals');

      const data = await response.json();
      setJournals(data.journals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journals');
    } finally {
      setLoading(false);
    }
  };

  const filteredJournals = journals.filter(j => {
    if (showFT50Only && !j.is_ft50) return false;
    return true;
  });

  const journalsByTier = filteredJournals.reduce((acc, j) => {
    const tier = j.tier || 5;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(j);
    return acc;
  }, {} as Record<number, JournalRanking[]>);

  return (
    <div className="min-h-screen bg-slate-950">
      <MhambaHeader currentPage="Journal Rankings" />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Journal Quality Rankings</h1>
          <p className="text-slate-400">
            Browse business and management journal rankings based on ABS (UK), ABDC (Australia),
            and FT50 (Financial Times) lists. Use these to evaluate publication quality.
          </p>
        </div>

        {/* Tier Legend */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-400 mb-3">Journal Tier System</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(tier => (
              <div
                key={tier}
                className={`p-3 rounded-lg border ${TIER_LABELS[tier].color}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4" />
                  <span className="font-semibold">Tier {tier}</span>
                </div>
                <p className="text-xs opacity-80">{TIER_LABELS[tier].label}</p>
                <p className="text-xs opacity-60">{TIER_LABELS[tier].desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search journals..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {/* Tier Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={tierFilter || ''}
                onChange={(e) => setTierFilter(e.target.value ? parseInt(e.target.value) : null)}
                className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">All Tiers</option>
                <option value="1">Tier 1 - Elite</option>
                <option value="2">Tier 2 - Top Field</option>
                <option value="3">Tier 3 - High Quality</option>
                <option value="4">Tier 4 - Good</option>
                <option value="5">Tier 5 - Emerging</option>
              </select>
            </div>

            {/* FT50 Toggle */}
            <button
              onClick={() => setShowFT50Only(!showFT50Only)}
              className={`px-4 py-2.5 rounded-lg border transition-colors flex items-center gap-2 ${
                showFT50Only
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
              }`}
            >
              <Award className="w-5 h-5" />
              FT50 Only
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Journals by Tier */}
        {!loading && !error && (
          <div className="space-y-8">
            {[1, 2, 3, 4, 5].map(tier => {
              const tierJournals = journalsByTier[tier] || [];
              if (tierJournals.length === 0) return null;

              return (
                <div key={tier}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`px-3 py-1.5 rounded-lg border ${TIER_LABELS[tier].color}`}>
                      <Star className="w-4 h-4 inline mr-1" />
                      Tier {tier} - {TIER_LABELS[tier].label}
                    </div>
                    <span className="text-slate-400 text-sm">
                      {tierJournals.length} journals
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tierJournals.map((journal) => (
                      <div
                        key={journal.id}
                        className="bg-slate-900 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-white font-medium text-sm leading-tight">
                            {journal.journal_name}
                          </h3>
                          {journal.is_ft50 && (
                            <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              FT50
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {journal.abs_rating && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              ABS {journal.abs_rating}
                            </span>
                          )}
                          {journal.abdc_rating && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              ABDC {journal.abdc_rating}
                            </span>
                          )}
                        </div>

                        {journal.issn && (
                          <p className="text-xs text-slate-500 mt-2">
                            ISSN: {journal.issn}
                          </p>
                        )}

                        {journal.subject_areas && journal.subject_areas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {journal.subject_areas.slice(0, 3).map((area, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-xs bg-slate-800 text-slate-400"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredJournals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-400">No journals found matching your criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-12 bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white font-medium mb-2">About Journal Rankings</h3>
          <div className="text-sm text-slate-400 space-y-2">
            <p>
              <strong className="text-blue-400">ABS (Association of Business Schools):</strong> UK-based ranking
              from 1 (lowest) to 4* (highest). 4* journals are world-elite.
            </p>
            <p>
              <strong className="text-green-400">ABDC (Australian Business Deans Council):</strong> Australian
              ranking from C (lowest) to A* (highest).
            </p>
            <p>
              <strong className="text-yellow-400">FT50 (Financial Times):</strong> 50 journals used by FT
              for business school research rankings.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
