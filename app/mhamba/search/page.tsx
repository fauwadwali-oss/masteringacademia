'use client';

import React, { useState } from 'react';
import MhambaHeader from '@/components/MhambaHeader';
import MhambaLiteratureSearch from '@/components/tools/MhambaLiteratureSearch';
import ComprehensiveSearch from '@/components/tools/ComprehensiveSearch';
import { Search, Sparkles } from 'lucide-react';

export default function MhambaSearchPage() {
  const [searchMode, setSearchMode] = useState<'standard' | 'comprehensive'>('standard');

  return (
    <div className="min-h-screen bg-slate-950">
      <MhambaHeader currentPage="Literature Search" />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Business Literature Search</h1>
          <p className="text-slate-400">
            Search across multiple academic sources with automatic journal quality ranking.
            Results are enriched with ABS, ABDC, and FT50 ratings.
          </p>
        </div>

        {/* Search Mode Toggle */}
        <div className="mb-6 flex gap-2 bg-slate-900 border border-slate-700/50 rounded-xl p-2">
          <button
            onClick={() => setSearchMode('standard')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              searchMode === 'standard'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-5 h-5" />
            Standard Search
          </button>
          <button
            onClick={() => setSearchMode('comprehensive')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              searchMode === 'comprehensive'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            AI Comprehensive Search
          </button>
        </div>

        {/* Search Components */}
        {searchMode === 'standard' ? (
          <MhambaLiteratureSearch />
        ) : (
          <ComprehensiveSearch />
        )}
      </main>
    </div>
  );
}
