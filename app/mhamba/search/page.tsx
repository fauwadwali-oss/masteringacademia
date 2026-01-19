'use client';

import React from 'react';
import MhambaHeader from '@/components/MhambaHeader';
import MhambaLiteratureSearch from '@/components/tools/MhambaLiteratureSearch';

export default function MhambaSearchPage() {
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
        <MhambaLiteratureSearch />
      </main>
    </div>
  );
}
