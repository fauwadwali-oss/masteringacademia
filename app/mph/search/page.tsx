'use client';

import React, { useState } from 'react';
import LiteratureSearchTool from '@/components/tools/LiteratureSearchTool';
import MphComprehensiveSearch from '@/components/tools/MphComprehensiveSearch';
import ResearchHeader from '@/components/ResearchHeader';
import { Search, Sparkles } from 'lucide-react';

export default function LiteratureSearchPage() {
  const [searchMode, setSearchMode] = useState<'standard' | 'comprehensive'>('standard');

  return (
    <div className="min-h-screen bg-slate-950">
      <ResearchHeader currentPage="Literature Search" />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Public Health Literature Search</h1>
          <p className="text-slate-400">
            Search across multiple academic sources with automatic journal quality ranking. Results are enriched with ABS, ABDC, and FT50 ratings.
          </p>
        </div>

        {/* Search Mode Toggle */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setSearchMode('standard')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-medium transition-all ${
              searchMode === 'standard'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Search className="w-5 h-5" />
            Standard Search
          </button>
          <button
            onClick={() => setSearchMode('comprehensive')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-medium transition-all ${
              searchMode === 'comprehensive'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            AI Comprehensive Search
          </button>
        </div>

        {/* Render appropriate search component */}
        {searchMode === 'standard' ? (
          <LiteratureSearchTool />
        ) : (
          <MphComprehensiveSearch />
        )}
      </main>
    </div>
  );
}
